//! Lossless PNG & Multi-format Image Codecs.
//!
//! Provides zero-compression-loss 8-bit and 16-bit PNG reading and writing,
//! along with direct memory encoding and general texture loading.

use crate::core::buffer::TextureBuffer;
use image::codecs::png::{CompressionType, FilterType as PngFilterType, PngEncoder};
use image::{ExtendedColorType, ImageEncoder, ImageReader};
use std::fs::File;
use std::io::{BufWriter, Cursor, Read};
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CodecError {
    IoError(String),
    ImageError(String),
    UnsupportedFormat(String),
}

impl std::fmt::Display for CodecError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CodecError::IoError(msg) => write!(f, "Codec I/O error: {}", msg),
            CodecError::ImageError(msg) => write!(f, "Image codec error: {}", msg),
            CodecError::UnsupportedFormat(fmt) => write!(f, "Unsupported image format: {}", fmt),
        }
    }
}

impl std::error::Error for CodecError {}

impl From<std::io::Error> for CodecError {
    fn from(err: std::io::Error) -> Self {
        CodecError::IoError(err.to_string())
    }
}

impl From<image::ImageError> for CodecError {
    fn from(err: image::ImageError) -> Self {
        CodecError::ImageError(err.to_string())
    }
}

/// Encodes an 8-bit RGBA `TextureBuffer` to lossless PNG bytes in memory.
pub fn encode_png_rgba8(buffer: &TextureBuffer) -> Result<Vec<u8>, CodecError> {
    let mut bytes = Vec::new();
    let encoder = PngEncoder::new_with_quality(
        &mut bytes,
        CompressionType::Fast,
        PngFilterType::Adaptive,
    );
    encoder.write_image(
        buffer.as_slice(),
        buffer.width,
        buffer.height,
        ExtendedColorType::Rgba8,
    )?;
    Ok(bytes)
}

/// Encodes a 16-bit RGBA pixel slice to lossless PNG bytes in memory.
pub fn encode_png_rgba16(
    width: u32,
    height: u32,
    u16_data: &[u16],
) -> Result<Vec<u8>, CodecError> {
    let mut bytes = Vec::new();
    let encoder = PngEncoder::new_with_quality(
        &mut bytes,
        CompressionType::Fast,
        PngFilterType::Adaptive,
    );

    // Provide native-endian memory representation for image encoder
    let mut raw_bytes = Vec::with_capacity(u16_data.len() * 2);
    for &sample in u16_data {
        raw_bytes.extend_from_slice(&sample.to_ne_bytes());
    }

    encoder.write_image(
        &raw_bytes,
        width,
        height,
        ExtendedColorType::Rgba16,
    )?;
    Ok(bytes)
}

/// Encodes an 8-bit Grayscale slice to lossless PNG bytes in memory.
pub fn encode_png_gray8(
    width: u32,
    height: u32,
    gray_data: &[u8],
) -> Result<Vec<u8>, CodecError> {
    let mut bytes = Vec::new();
    let encoder = PngEncoder::new_with_quality(
        &mut bytes,
        CompressionType::Fast,
        PngFilterType::Adaptive,
    );
    encoder.write_image(
        gray_data,
        width,
        height,
        ExtendedColorType::L8,
    )?;
    Ok(bytes)
}

/// Decodes PNG or any supported image bytes from memory into a `TextureBuffer`.
pub fn decode_image_from_memory(bytes: &[u8]) -> Result<TextureBuffer, CodecError> {
    let reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()?;
    let dynamic_img = reader.decode()?;
    let rgba8 = dynamic_img.to_rgba8();
    Ok(TextureBuffer::from_image(rgba8))
}

/// Decodes 16-bit PNG bytes from memory, returning dimensions and raw u16 samples.
pub fn decode_png_rgba16_from_memory(bytes: &[u8]) -> Result<(u32, u32, Vec<u16>), CodecError> {
    let reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()?;
    let dynamic_img = reader.decode()?;
    let (w, h) = (dynamic_img.width(), dynamic_img.height());
    let rgba16 = dynamic_img.to_rgba16();
    let u16_data = rgba16.into_raw();
    Ok((w, h, u16_data))
}

/// Saves a `TextureBuffer` to disk as a lossless PNG file.
pub fn save_png<P: AsRef<Path>>(buffer: &TextureBuffer, path: P) -> Result<(), CodecError> {
    let file = File::create(path)?;
    let mut writer = BufWriter::new(file);
    let encoder = PngEncoder::new_with_quality(
        &mut writer,
        CompressionType::Default,
        PngFilterType::Adaptive,
    );
    encoder.write_image(
        buffer.as_slice(),
        buffer.width,
        buffer.height,
        ExtendedColorType::Rgba8,
    )?;
    Ok(())
}

/// Saves a `TextureBuffer` to disk as a JPEG file with the specified quality (1..=100).
pub fn save_jpeg<P: AsRef<Path>>(buffer: &TextureBuffer, path: P, quality: u8) -> Result<(), CodecError> {
    let file = File::create(path)?;
    let mut writer = BufWriter::new(file);
    // Convert RGBA8 to RGB8 (JPEG does not support alpha channel)
    let rgb = image::DynamicImage::ImageRgba8(buffer.image.clone()).to_rgb8();
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut writer, quality.clamp(1, 100));
    encoder.encode(rgb.as_raw(), buffer.width, buffer.height, ExtendedColorType::Rgb8)?;
    Ok(())
}

/// Saves a `TextureBuffer` to disk as a WebP file.
pub fn save_webp<P: AsRef<Path>>(buffer: &TextureBuffer, path: P) -> Result<(), CodecError> {
    let dyn_img = image::DynamicImage::ImageRgba8(buffer.image.clone());
    dyn_img.save_with_format(path, image::ImageFormat::WebP)?;
    Ok(())
}

/// Saves a `TextureBuffer` to disk as a BMP file.
pub fn save_bmp<P: AsRef<Path>>(buffer: &TextureBuffer, path: P) -> Result<(), CodecError> {
    let dyn_img = image::DynamicImage::ImageRgba8(buffer.image.clone());
    dyn_img.save_with_format(path, image::ImageFormat::Bmp)?;
    Ok(())
}

/// Saves a `TextureBuffer` to disk as an OpenEXR file.
pub fn save_exr<P: AsRef<Path>>(buffer: &TextureBuffer, path: P) -> Result<(), CodecError> {
    let dyn_img = image::DynamicImage::ImageRgba8(buffer.image.clone());
    dyn_img.save_with_format(path, image::ImageFormat::OpenExr)?;
    Ok(())
}

/// Saves a `TextureBuffer` to disk, automatically inferring the codec from the file extension.
pub fn save_image<P: AsRef<Path>>(buffer: &TextureBuffer, path: P) -> Result<(), CodecError> {
    let path_ref = path.as_ref();
    let ext = path_ref
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "tga" => crate::export::tga::save_tga_file(buffer, path_ref, 32).map_err(|e| CodecError::IoError(e.to_string())),
        "exr" => save_exr(buffer, path_ref),
        "jpg" | "jpeg" => save_jpeg(buffer, path_ref, 95),
        "webp" => save_webp(buffer, path_ref),
        "bmp" => save_bmp(buffer, path_ref),
        _ => save_png(buffer, path_ref),
    }
}

/// Loads a 16-bit image from disk into a `TextureBuffer16`.
pub fn load_image_16<P: AsRef<Path>>(path: P) -> Result<crate::core::buffer::TextureBuffer16, CodecError> {
    let path_ref = path.as_ref();
    let mut file = File::open(path_ref)?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)?;
    let reader = ImageReader::new(Cursor::new(&bytes)).with_guessed_format()?;
    let dynamic_img = reader.decode()?;
    let (width, height) = (dynamic_img.width(), dynamic_img.height());
    let rgba16 = dynamic_img.to_rgba16();
    Ok(crate::core::buffer::TextureBuffer16 {
        width,
        height,
        data: rgba16.into_raw(),
    })
}

/// Saves a `TextureBuffer16` to disk as a lossless 16-bit PNG file.
pub fn save_png_16<P: AsRef<Path>>(buffer: &crate::core::buffer::TextureBuffer16, path: P) -> Result<(), CodecError> {
    let bytes = encode_png_rgba16(buffer.width, buffer.height, &buffer.data)?;
    std::fs::write(path, bytes)?;
    Ok(())
}

/// Loads an image file from disk (supporting PNG, JPEG, WebP, TGA, BMP) into a `TextureBuffer`.
pub fn load_image<P: AsRef<Path>>(path: P) -> Result<TextureBuffer, CodecError> {
    let path_ref = path.as_ref();
    let mut file = File::open(path_ref)?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)?;

    // Check if it's a TGA file by extension or signature
    if let Some(ext) = path_ref.extension().and_then(|s| s.to_str()) {
        if ext.eq_ignore_ascii_case("tga") {
            if let Ok(tga_buf) = crate::export::tga::decode_tga(&bytes) {
                return Ok(tga_buf);
            }
        }
    }

    decode_image_from_memory(&bytes)
}

#[derive(Clone, Debug, Hash, PartialEq, Eq)]
struct DiskCacheKey {
    path: std::path::PathBuf,
    mtime: Option<std::time::SystemTime>,
    file_size: u64,
}

struct DiskImageCache {
    entries: std::collections::HashMap<DiskCacheKey, std::sync::Arc<TextureBuffer>>,
    access_order: Vec<DiskCacheKey>,
    max_entries: usize,
}

static DISK_IMAGE_CACHE: std::sync::OnceLock<std::sync::Mutex<DiskImageCache>> = std::sync::OnceLock::new();

fn get_disk_cache() -> &'static std::sync::Mutex<DiskImageCache> {
    DISK_IMAGE_CACHE.get_or_init(|| {
        std::sync::Mutex::new(DiskImageCache {
            entries: std::collections::HashMap::new(),
            access_order: Vec::new(),
            max_entries: 64,
        })
    })
}

/// Loads an image from disk using a thread-safe LRU cache.
///
/// If the file on disk has matching timestamp and size, returns the existing `Arc<TextureBuffer>`
/// without decoding. If modified or uncached, decodes from disk and updates the cache.
pub fn load_image_cached<P: AsRef<Path>>(path: P) -> Result<std::sync::Arc<TextureBuffer>, CodecError> {
    let path_buf = path.as_ref().to_path_buf();
    let metadata = std::fs::metadata(&path_buf)?;
    let mtime = metadata.modified().ok();
    let file_size = metadata.len();

    let key = DiskCacheKey {
        path: path_buf,
        mtime,
        file_size,
    };

    let cache_lock = get_disk_cache();
    {
        let cache = cache_lock.lock().unwrap();
        if let Some(buf) = cache.entries.get(&key) {
            return Ok(std::sync::Arc::clone(buf));
        }
    }

    // Decode on miss
    let loaded = std::sync::Arc::new(load_image(&key.path)?);

    {
        let mut cache = cache_lock.lock().unwrap();
        if cache.entries.len() >= cache.max_entries {
            if let Some(oldest_key) = cache.access_order.first().cloned() {
                cache.entries.remove(&oldest_key);
                cache.access_order.retain(|k| k != &oldest_key);
            }
        }
        cache.access_order.push(key.clone());
        cache.entries.insert(key, std::sync::Arc::clone(&loaded));
    }

    Ok(loaded)
}


#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    pub fn test_png_lossless_roundtrip_8bit() {
        let mut original = TextureBuffer::new(16, 16);
        for y in 0..16 {
            for x in 0..16 {
                original.set_pixel(x, y, [x as u8 * 16, y as u8 * 16, (x + y) as u8 * 8, 255]);
            }
        }

        let encoded_bytes = encode_png_rgba8(&original).expect("PNG encode failed");
        assert!(!encoded_bytes.is_empty());

        let decoded = decode_image_from_memory(&encoded_bytes).expect("PNG decode failed");
        assert_eq!(decoded.width, original.width);
        assert_eq!(decoded.height, original.height);
        assert_eq!(decoded.as_slice(), original.as_slice());
    }

    #[test]
    pub fn test_png_alpha_zero_lossless_preservation() {
        // Critical F-01 validation: PNG encoding must not premultiply alpha
        let mut buf = TextureBuffer::new(4, 4);
        buf.set_pixel(0, 0, [215, 120, 45, 0]);
        buf.set_pixel(2, 2, [100, 200, 50, 0]);

        let bytes = encode_png_rgba8(&buf).unwrap();
        let decoded = decode_image_from_memory(&bytes).unwrap();

        assert_eq!(decoded.get_pixel(0, 0), [215, 120, 45, 0]);
        assert_eq!(decoded.get_pixel(2, 2), [100, 200, 50, 0]);
    }

    #[test]
    pub fn test_png_16bit_roundtrip() {
        let width = 8;
        let height = 8;
        let mut u16_data = Vec::with_capacity((width * height * 4) as usize);
        for i in 0..(width * height * 4) {
            u16_data.push((i * 1024) as u16);
        }

        let bytes = encode_png_rgba16(width, height, &u16_data).expect("16-bit PNG encode failed");
        assert!(!bytes.is_empty());

        let (dec_w, dec_h, dec_data) = decode_png_rgba16_from_memory(&bytes).expect("16-bit PNG decode failed");
        assert_eq!(dec_w, width);
        assert_eq!(dec_h, height);
        assert_eq!(dec_data, u16_data);
    }

    #[test]
    pub fn test_load_image_cached_pointer_equality() {
        let temp_dir = std::env::temp_dir().join(format!("tlab_cache_test_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let test_path = temp_dir.join("sample_tex.png");

        let original = TextureBuffer::solid_color(16, 16, 120, 200, 80, 255);
        save_png(&original, &test_path).expect("Failed to write test PNG");

        // First load: cache miss, decodes from disk
        let buf1 = load_image_cached(&test_path).expect("First load failed");
        assert_eq!(buf1.get_pixel(0, 0), [120, 200, 80, 255]);

        // Second load: cache hit, must return the exact same Arc pointer!
        let buf2 = load_image_cached(&test_path).expect("Second load failed");
        assert!(std::sync::Arc::ptr_eq(&buf1, &buf2), "Cache hit must reuse identical Arc allocation");

        let _ = std::fs::remove_file(&test_path);
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}

