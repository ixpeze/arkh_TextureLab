//! Integration test harness verifying crate baseline and Phase 1 engine/codecs.

use std::fs;
use std::path::PathBuf;
use texturelab::app::TextureLabApp;
use texturelab::core::buffer::TextureBuffer;
use texturelab::core::colorspace::{linear_to_srgb_buffer, srgb_to_linear_buffer};
use texturelab::export::codecs::{load_image, save_png};
use texturelab::export::tga::{decode_tga, encode_tga_32, has_tga_2_0_footer, load_tga_file, save_tga_file, TgaHeader};
use texturelab::version;

#[test]
fn test_crate_version_and_metadata() {
    assert_eq!(version(), "1.0.0");
}

#[test]
fn test_app_instantiation() {
    let app = TextureLabApp::default();
    assert_eq!(app.version(), "1.0.0");
    assert!(!app.title().is_empty());
}

#[test]
fn test_core_dependencies_linkage() {
    // Verify Rayon
    let numbers: Vec<u32> = (0..100).collect();
    use rayon::prelude::*;
    let sum: u32 = numbers.par_iter().sum();
    assert_eq!(sum, 4950);

    // Verify Serde JSON
    #[derive(serde::Serialize, serde::Deserialize, PartialEq, Debug)]
    struct TestPayload {
        name: String,
        count: usize,
    }
    let payload = TestPayload {
        name: "test_node".to_string(),
        count: 42,
    };
    let json = serde_json::to_string(&payload).expect("Serialization failed");
    let deserialized: TestPayload = serde_json::from_str(&json).expect("Deserialization failed");
    assert_eq!(payload, deserialized);

    // Verify Image crate
    let img = image::RgbaImage::new(4, 4);
    assert_eq!(img.width(), 4);
    assert_eq!(img.height(), 4);
}

// =========================================================================
// Phase 1 Integration Tests (TC-101 .. TC-104 & Direct Disk Exporter Check)
// =========================================================================

/// TC-101: Solid Color & Channel Packing (4K RGBA matching)
#[test]
fn test_solid_and_channel_packing() {
    let r = TextureBuffer::solid_color(128, 128, 255, 0, 0, 255);
    let g = TextureBuffer::solid_color(128, 128, 0, 180, 0, 255);
    let b = TextureBuffer::solid_color(128, 128, 0, 0, 90, 255);
    let a = TextureBuffer::solid_color(128, 128, 0, 0, 0, 45);

    let packed = TextureBuffer::pack_channels(
        Some(&r),
        Some(&g),
        Some(&b),
        Some(&a),
        [0, 0, 0, 255],
        128,
        128,
    );

    assert_eq!(packed.width, 128);
    assert_eq!(packed.height, 128);
    assert_eq!(packed.get_pixel(0, 0), [255, 180, 90, 45]);
    assert_eq!(packed.get_pixel(127, 127), [255, 180, 90, 45]);
}

/// TC-102: Zero Alpha Channel Preservation (F-01 Solved)
#[test]
fn test_alpha_zero_preservation() {
    let mut buf = TextureBuffer::new(8, 8);
    // Texture with Alpha = 0 and distinct RGB
    buf.set_pixel(0, 0, [215, 120, 45, 0]);
    buf.set_pixel(4, 4, [190, 80, 230, 0]);

    assert_eq!(buf.get_pixel(0, 0), [215, 120, 45, 0]);
    assert_eq!(buf.get_pixel(4, 4), [190, 80, 230, 0]);

    // Split and re-pack must preserve RGB without canvas premultiplication
    let (r, g, b, a) = buf.split_channels();
    let repacked = TextureBuffer::pack_from_channels(
        Some((&r, 0)),
        Some((&g, 0)),
        Some((&b, 0)),
        Some((&a, 0)),
        [0, 0, 0, 0],
        8,
        8,
    );

    assert_eq!(repacked.get_pixel(0, 0), [215, 120, 45, 0]);
    assert_eq!(repacked.get_pixel(4, 4), [190, 80, 230, 0]);
}

/// TC-103: TGA 2.0 Header & Footer Byte Match
#[test]
fn test_tga_encode() {
    let buf = TextureBuffer::solid_color(64, 64, 10, 20, 30, 40);
    let bytes = encode_tga_32(&buf).expect("TGA 32-bit encode failed");

    // Header (18) + 64*64*4 (16384) + Footer (26) = 16428
    let expected_len = 18 + 64 * 64 * 4 + 26;
    assert_eq!(bytes.len(), expected_len);
    assert_eq!(bytes.len(), 16428);

    let header = TgaHeader::from_bytes(&bytes[0..18].try_into().unwrap());
    assert_eq!(header.width, 64);
    assert_eq!(header.height, 64);
    assert_eq!(header.pixel_depth, 32);
    assert_eq!(header.image_type, 2);

    assert!(has_tga_2_0_footer(&bytes));

    let decoded = decode_tga(&bytes).expect("TGA decode failed");
    assert_eq!(decoded.get_pixel(0, 0), [10, 20, 30, 40]);
}

/// TC-104: Multithreaded Performance Budget (Sub-50ms 4K Packing)
#[test]
fn test_4k_pack_perf() {
    let r = TextureBuffer::solid_color(4096, 4096, 200, 0, 0, 255);
    let g = TextureBuffer::solid_color(4096, 4096, 0, 150, 0, 255);
    let b = TextureBuffer::solid_color(4096, 4096, 0, 0, 100, 255);
    let a = TextureBuffer::solid_color(4096, 4096, 0, 0, 0, 50);

    let start = std::time::Instant::now();
    let packed = TextureBuffer::pack_channels(
        Some(&r),
        Some(&g),
        Some(&b),
        Some(&a),
        [0, 0, 0, 255],
        4096,
        4096,
    );
    let elapsed = start.elapsed();

    println!("Integration 4K 4096x4096 Pack elapsed: {:?}", elapsed);
    assert_eq!(packed.width, 4096);
    assert_eq!(packed.height, 4096);
    assert_eq!(packed.get_pixel(0, 0), [200, 150, 100, 50]);

    #[cfg(not(debug_assertions))]
    assert!(
        elapsed.as_millis() < 50,
        "Release 4K pack must finish in < 50ms, took {:?}",
        elapsed
    );
}

/// Owner Check test for Phase 1 direct disk export preflight and atomic write.
/// Verifies writing 32-bit TGA (exact byte size 18+W*H*4+26) and PNG to disk.
#[test]
fn test_direct_disk_exporter_preflight_and_write() {
    let temp_dir = std::env::temp_dir().join(format!(
        "texturelab_test_p1_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&temp_dir).expect("Failed to create temp test directory");

    let buf = TextureBuffer::solid_color(64, 64, 42, 84, 126, 0); // Note A=0 to verify F-01 on disk
    let tga_path: PathBuf = temp_dir.join("test_output.tga");
    let png_path: PathBuf = temp_dir.join("test_output.png");

    // Preflight: ensure files do not exist prior to writing
    assert!(!tga_path.exists());
    assert!(!png_path.exists());

    // Write TGA 32-bit
    save_tga_file(&buf, &tga_path, 32).expect("Writing TGA to disk failed");
    assert!(tga_path.exists());
    let tga_metadata = fs::metadata(&tga_path).expect("Failed to read TGA metadata");
    let expected_tga_len = (18 + 64 * 64 * 4 + 26) as u64;
    assert_eq!(
        tga_metadata.len(),
        expected_tga_len,
        "TGA disk file must match exact 18+W*H*4+26 byte size"
    );

    // Read back TGA from disk and assert bit-exact pixel match with A=0 preserved
    let read_tga = load_tga_file(&tga_path).expect("Failed to load written TGA from disk");
    assert_eq!(read_tga.width, 64);
    assert_eq!(read_tga.height, 64);
    assert_eq!(read_tga.get_pixel(0, 0), [42, 84, 126, 0]);

    // Write PNG
    save_png(&buf, &png_path).expect("Writing PNG to disk failed");
    assert!(png_path.exists());
    let png_metadata = fs::metadata(&png_path).expect("Failed to read PNG metadata");
    assert!(png_metadata.len() > 0);

    // Read back PNG from disk and assert bit-exact pixel match with A=0 preserved
    let read_png = load_image(&png_path).expect("Failed to load written PNG from disk");
    assert_eq!(read_png.width, 64);
    assert_eq!(read_png.height, 64);
    assert_eq!(read_png.get_pixel(0, 0), [42, 84, 126, 0]);

    // Clean up temporary directory
    let _ = fs::remove_dir_all(&temp_dir);
}

/// Color space integration test verifying sRGB <-> Linear roundtrip
#[test]
fn test_colorspace_conversions() {
    let buf = TextureBuffer::solid_color(16, 16, 200, 100, 50, 180);
    let linear = srgb_to_linear_buffer(&buf);
    let restored = linear_to_srgb_buffer(&linear);

    // Alpha channel preserved
    assert_eq!(linear.get_sample(0, 0, 3), 180);
    assert_eq!(restored.get_sample(0, 0, 3), 180);

    // RGB within 1 LSB
    let orig = buf.get_pixel(0, 0);
    let rest = restored.get_pixel(0, 0);
    assert!((orig[0] as i32 - rest[0] as i32).abs() <= 1);
    assert!((orig[1] as i32 - rest[1] as i32).abs() <= 1);
    assert!((orig[2] as i32 - rest[2] as i32).abs() <= 1);
}
