//! Truevision TGA 2.0 Binary Encoder & Decoder.
//!
//! Encodes uncompressed 24-bit (BGR) and 32-bit (BGRA) TGA files with official
//! Truevision TGA 2.0 standard 26-byte footers (`TRUEVISION-XFILE.\0`).
//! Guarantees byte-exact file lengths: `18 + width * height * bpp + 26`.

use crate::core::buffer::TextureBuffer;
use rayon::prelude::*;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

/// Standard TGA 18-byte file header size.
pub const TGA_HEADER_SIZE: usize = 18;

/// Standard TGA 2.0 26-byte file footer size.
pub const TGA_FOOTER_SIZE: usize = 26;

/// Official 18-byte TGA 2.0 footer ASCII signature (including trailing dot and null).
pub const TGA_SIGNATURE: &[u8; 18] = b"TRUEVISION-XFILE.\0";

/// TGA image descriptor flag for top-to-bottom origin (bit 5).
pub const TGA_ORIGIN_TOP_LEFT: u8 = 0x20;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TgaError {
    IoError(String),
    BufferTooSmall { expected: usize, got: usize },
    InvalidHeader(String),
    UnsupportedBitsPerPixel(u8),
    UnsupportedImageType(u8),
    DimensionOverflow,
}

impl std::fmt::Display for TgaError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TgaError::IoError(msg) => write!(f, "TGA I/O error: {}", msg),
            TgaError::BufferTooSmall { expected, got } => {
                write!(f, "TGA buffer too small: expected {}, got {}", expected, got)
            }
            TgaError::InvalidHeader(msg) => write!(f, "Invalid TGA header: {}", msg),
            TgaError::UnsupportedBitsPerPixel(bpp) => {
                write!(f, "Unsupported TGA bits-per-pixel: {} (expected 24 or 32)", bpp)
            }
            TgaError::UnsupportedImageType(t) => {
                write!(f, "Unsupported TGA image type: {} (expected 2 uncompressed)", t)
            }
            TgaError::DimensionOverflow => write!(f, "TGA image dimensions exceed u16 max (65535)"),
        }
    }
}

impl std::error::Error for TgaError {}

impl From<std::io::Error> for TgaError {
    fn from(err: std::io::Error) -> Self {
        TgaError::IoError(err.to_string())
    }
}

/// Parsed Truevision TGA Header.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TgaHeader {
    pub id_length: u8,
    pub color_map_type: u8,
    pub image_type: u8,
    pub color_map_origin: u16,
    pub color_map_length: u16,
    pub color_map_depth: u8,
    pub x_origin: u16,
    pub y_origin: u16,
    pub width: u16,
    pub height: u16,
    pub pixel_depth: u8,
    pub image_descriptor: u8,
}

impl TgaHeader {
    /// Serializes the header into an exact 18-byte little-endian array.
    pub fn to_bytes(&self) -> [u8; 18] {
        let mut bytes = [0u8; 18];
        bytes[0] = self.id_length;
        bytes[1] = self.color_map_type;
        bytes[2] = self.image_type;

        let c_orig = self.color_map_origin.to_le_bytes();
        bytes[3] = c_orig[0];
        bytes[4] = c_orig[1];

        let c_len = self.color_map_length.to_le_bytes();
        bytes[5] = c_len[0];
        bytes[6] = c_len[1];

        bytes[7] = self.color_map_depth;

        let x_orig = self.x_origin.to_le_bytes();
        bytes[8] = x_orig[0];
        bytes[9] = x_orig[1];

        let y_orig = self.y_origin.to_le_bytes();
        bytes[10] = y_orig[0];
        bytes[11] = y_orig[1];

        let w_bytes = self.width.to_le_bytes();
        bytes[12] = w_bytes[0];
        bytes[13] = w_bytes[1];

        let h_bytes = self.height.to_le_bytes();
        bytes[14] = h_bytes[0];
        bytes[15] = h_bytes[1];

        bytes[16] = self.pixel_depth;
        bytes[17] = self.image_descriptor;
        bytes
    }

    /// Deserializes a header from an 18-byte slice.
    pub fn from_bytes(bytes: &[u8; 18]) -> Self {
        Self {
            id_length: bytes[0],
            color_map_type: bytes[1],
            image_type: bytes[2],
            color_map_origin: u16::from_le_bytes([bytes[3], bytes[4]]),
            color_map_length: u16::from_le_bytes([bytes[5], bytes[6]]),
            color_map_depth: bytes[7],
            x_origin: u16::from_le_bytes([bytes[8], bytes[9]]),
            y_origin: u16::from_le_bytes([bytes[10], bytes[11]]),
            width: u16::from_le_bytes([bytes[12], bytes[13]]),
            height: u16::from_le_bytes([bytes[14], bytes[15]]),
            pixel_depth: bytes[16],
            image_descriptor: bytes[17],
        }
    }
}

/// Encodes a `TextureBuffer` to a byte vector representing a 32-bit (BGRA) Truevision TGA 2.0 file.
///
/// Output size is guaranteed to be exactly `18 + width * height * 4 + 26` bytes.
pub fn encode_tga_32(buffer: &TextureBuffer) -> Result<Vec<u8>, TgaError> {
    if buffer.width > 65535 || buffer.height > 65535 {
        return Err(TgaError::DimensionOverflow);
    }

    let w = buffer.width as u16;
    let h = buffer.height as u16;
    let pixel_count = (buffer.width as usize) * (buffer.height as usize);
    let pixel_bytes = pixel_count * 4;
    let total_size = TGA_HEADER_SIZE + pixel_bytes + TGA_FOOTER_SIZE;

    let header = TgaHeader {
        id_length: 0,
        color_map_type: 0,
        image_type: 2, // Uncompressed true-color
        color_map_origin: 0,
        color_map_length: 0,
        color_map_depth: 0,
        x_origin: 0,
        y_origin: 0,
        width: w,
        height: h,
        pixel_depth: 32,
        image_descriptor: TGA_ORIGIN_TOP_LEFT, // 0x20
    };

    let mut out = vec![0u8; total_size];
    out[0..TGA_HEADER_SIZE].copy_from_slice(&header.to_bytes());

    let src_slice = buffer.as_slice();
    let dst_pixel_slice = &mut out[TGA_HEADER_SIZE..TGA_HEADER_SIZE + pixel_bytes];

    // Parallel BGRA swizzle into destination buffer
    dst_pixel_slice
        .par_chunks_exact_mut(4)
        .zip(src_slice.par_chunks_exact(4))
        .for_each(|(dst, src)| {
            dst[0] = src[2]; // B
            dst[1] = src[1]; // G
            dst[2] = src[0]; // R
            dst[3] = src[3]; // A
        });

    // Write 26-byte TGA 2.0 footer
    let footer_start = total_size - TGA_FOOTER_SIZE;
    out[footer_start..footer_start + 8].copy_from_slice(&[0u8; 8]); // 0 extension, 0 developer
    out[footer_start + 8..total_size].copy_from_slice(TGA_SIGNATURE);

    Ok(out)
}

/// Encodes a `TextureBuffer` to a byte vector representing a 24-bit (BGR) Truevision TGA 2.0 file.
///
/// Output size is guaranteed to be exactly `18 + width * height * 3 + 26` bytes.
pub fn encode_tga_24(buffer: &TextureBuffer) -> Result<Vec<u8>, TgaError> {
    if buffer.width > 65535 || buffer.height > 65535 {
        return Err(TgaError::DimensionOverflow);
    }

    let w = buffer.width as u16;
    let h = buffer.height as u16;
    let pixel_count = (buffer.width as usize) * (buffer.height as usize);
    let pixel_bytes = pixel_count * 3;
    let total_size = TGA_HEADER_SIZE + pixel_bytes + TGA_FOOTER_SIZE;

    let header = TgaHeader {
        id_length: 0,
        color_map_type: 0,
        image_type: 2, // Uncompressed true-color
        color_map_origin: 0,
        color_map_length: 0,
        color_map_depth: 0,
        x_origin: 0,
        y_origin: 0,
        width: w,
        height: h,
        pixel_depth: 24,
        image_descriptor: TGA_ORIGIN_TOP_LEFT, // 0x20
    };

    let mut out = vec![0u8; total_size];
    out[0..TGA_HEADER_SIZE].copy_from_slice(&header.to_bytes());

    let src_slice = buffer.as_slice();
    let dst_pixel_slice = &mut out[TGA_HEADER_SIZE..TGA_HEADER_SIZE + pixel_bytes];

    // Parallel BGR swizzle into destination buffer
    dst_pixel_slice
        .par_chunks_exact_mut(3)
        .zip(src_slice.par_chunks_exact(4))
        .for_each(|(dst, src)| {
            dst[0] = src[2]; // B
            dst[1] = src[1]; // G
            dst[2] = src[0]; // R
        });

    // Write 26-byte TGA 2.0 footer
    let footer_start = total_size - TGA_FOOTER_SIZE;
    out[footer_start..footer_start + 8].copy_from_slice(&[0u8; 8]);
    out[footer_start + 8..total_size].copy_from_slice(TGA_SIGNATURE);

    Ok(out)
}

/// Decodes an uncompressed Truevision TGA byte buffer into a `TextureBuffer`.
#[allow(clippy::chunks_exact_to_as_chunks)] // Evaluated: array_chunks / array_chunks_mut are not available on stable Rust; chunks_exact and chunks_exact_mut provide stable and portable fixed-size chunking
pub fn decode_tga(bytes: &[u8]) -> Result<TextureBuffer, TgaError> {
    if bytes.len() < TGA_HEADER_SIZE {
        return Err(TgaError::BufferTooSmall {
            expected: TGA_HEADER_SIZE,
            got: bytes.len(),
        });
    }

    let mut header_bytes = [0u8; 18];
    header_bytes.copy_from_slice(&bytes[0..18]);
    let header = TgaHeader::from_bytes(&header_bytes);

    if header.image_type != 2 {
        return Err(TgaError::UnsupportedImageType(header.image_type));
    }

    if header.pixel_depth != 24 && header.pixel_depth != 32 {
        return Err(TgaError::UnsupportedBitsPerPixel(header.pixel_depth));
    }

    let width = header.width as u32;
    let height = header.height as u32;
    let bytes_per_pixel = (header.pixel_depth / 8) as usize;
    let data_offset = TGA_HEADER_SIZE + (header.id_length as usize);
    let expected_pixel_bytes = (width as usize) * (height as usize) * bytes_per_pixel;

    if bytes.len() < data_offset + expected_pixel_bytes {
        return Err(TgaError::BufferTooSmall {
            expected: data_offset + expected_pixel_bytes,
            got: bytes.len(),
        });
    }

    let pixel_src = &bytes[data_offset..data_offset + expected_pixel_bytes];
    let mut out = TextureBuffer::new(width, height);
    let is_top_down = (header.image_descriptor & TGA_ORIGIN_TOP_LEFT) != 0;

    let row_stride_src = (width as usize) * bytes_per_pixel;
    let out_slice = out.image.as_mut();
    let row_stride_dst = (width as usize) * 4;

    // Decode row-by-row respecting top-down vs bottom-up orientation
    out_slice
        .par_chunks_exact_mut(row_stride_dst)
        .enumerate()
        .for_each(|(y_idx, dst_row)| {
            let src_y = if is_top_down {
                y_idx
            } else {
                (height as usize) - 1 - y_idx
            };

            let src_row_start = src_y * row_stride_src;
            let src_row = &pixel_src[src_row_start..src_row_start + row_stride_src];

            if bytes_per_pixel == 4 {
                dst_row
                    .chunks_exact_mut(4)
                    .zip(src_row.chunks_exact(4))
                    .for_each(|(dst, src)| {
                        dst[0] = src[2]; // R from B
                        dst[1] = src[1]; // G from G
                        dst[2] = src[0]; // B from R
                        dst[3] = src[3]; // A from A
                    });
            } else {
                dst_row
                    .chunks_exact_mut(4)
                    .zip(src_row.chunks_exact(3))
                    .for_each(|(dst, src)| {
                        dst[0] = src[2]; // R
                        dst[1] = src[1]; // G
                        dst[2] = src[0]; // B
                        dst[3] = 255;    // Opaque A
                    });
            }
        });

    Ok(out)
}

/// Checks if a TGA byte slice contains a valid official Truevision TGA 2.0 footer.
pub fn has_tga_2_0_footer(bytes: &[u8]) -> bool {
    if bytes.len() < TGA_FOOTER_SIZE {
        return false;
    }
    let footer_sig = &bytes[bytes.len() - 18..];
    footer_sig == TGA_SIGNATURE
}

/// Saves a `TextureBuffer` to disk as a Truevision TGA file.
pub fn save_tga_file<P: AsRef<Path>>(
    buffer: &TextureBuffer,
    path: P,
    bits_per_pixel: u8,
) -> Result<(), TgaError> {
    let bytes = match bits_per_pixel {
        24 => encode_tga_24(buffer)?,
        32 => encode_tga_32(buffer)?,
        other => return Err(TgaError::UnsupportedBitsPerPixel(other)),
    };

    let mut file = File::create(path)?;
    file.write_all(&bytes)?;
    Ok(())
}

/// Loads a Truevision TGA file from disk.
pub fn load_tga_file<P: AsRef<Path>>(path: P) -> Result<TextureBuffer, TgaError> {
    let mut file = File::open(path)?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)?;
    decode_tga(&bytes)
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    pub fn test_tga_encode() {
        // TC-103: File length = 18 + 64*64*4 + 26 = 16428 bytes
        let buf = TextureBuffer::solid_color(64, 64, 12, 34, 56, 78);
        let bytes = encode_tga_32(&buf).expect("TGA encoding failed");

        let expected_len = 18 + 64 * 64 * 4 + 26;
        assert_eq!(bytes.len(), expected_len, "TGA 32-bit file size mismatch");
        assert_eq!(bytes.len(), 16428);

        // Check header
        let header = TgaHeader::from_bytes(&bytes[0..18].try_into().unwrap());
        assert_eq!(header.width, 64);
        assert_eq!(header.height, 64);
        assert_eq!(header.pixel_depth, 32);
        assert_eq!(header.image_type, 2);
        assert_eq!(header.image_descriptor, 0x20);

        // Check footer
        assert!(has_tga_2_0_footer(&bytes));
        let footer_sig = &bytes[bytes.len() - 18..];
        assert_eq!(footer_sig, b"TRUEVISION-XFILE.\0");

        // Decode and verify roundtrip pixel equality
        let decoded = decode_tga(&bytes).expect("TGA decoding failed");
        assert_eq!(decoded.width, 64);
        assert_eq!(decoded.height, 64);
        assert_eq!(decoded.get_pixel(0, 0), [12, 34, 56, 78]);
        assert_eq!(decoded.get_pixel(63, 63), [12, 34, 56, 78]);
    }

    #[test]
    pub fn test_tga_24_encode() {
        let buf = TextureBuffer::solid_color(32, 32, 100, 150, 200, 255);
        let bytes = encode_tga_24(&buf).expect("TGA 24-bit encoding failed");

        let expected_len = 18 + 32 * 32 * 3 + 26;
        assert_eq!(bytes.len(), expected_len, "TGA 24-bit file size mismatch");

        assert!(has_tga_2_0_footer(&bytes));

        let decoded = decode_tga(&bytes).expect("TGA decoding failed");
        assert_eq!(decoded.get_pixel(0, 0), [100, 150, 200, 255]);
    }

    #[test]
    pub fn test_tga_alpha_preservation_roundtrip() {
        // Critical F-01 validation: Alpha=0 must preserve RGB
        let mut buf = TextureBuffer::new(2, 2);
        buf.set_pixel(0, 0, [255, 128, 40, 0]);
        buf.set_pixel(1, 1, [10, 20, 30, 0]);

        let bytes = encode_tga_32(&buf).unwrap();
        let decoded = decode_tga(&bytes).unwrap();

        assert_eq!(decoded.get_pixel(0, 0), [255, 128, 40, 0]);
        assert_eq!(decoded.get_pixel(1, 1), [10, 20, 30, 0]);
    }
}
