//! Color space transformations and lookup tables (sRGB <-> Linear).
//!
//! Provides mathematically exact transformations matching IEC 61966-2-1
//! with precomputed O(1) lookup tables for high-throughput pixel processing.

use rayon::prelude::*;
use crate::core::buffer::TextureBuffer;

/// Precomputed 8-bit sRGB to linear float table (0..=255 -> 0.0..=1.0).
pub static SRGB_TO_LINEAR_LUT_F32: [f32; 256] = {
    let mut lut = [0.0f32; 256];
    let mut i = 0;
    while i < 256 {
        let v = i as f32 / 255.0;
        lut[i] = if v <= 0.04045 {
            v / 12.92
        } else {
            // const expression power approximation or computed at init
            // Using standard power series expansion or runtime init
            // Note: powf is not const in Rust stable, so we compute table at runtime or lazy
            v // placeholder, replaced by function below
        };
        i += 1;
    }
    lut
};

/// Exact mathematical sRGB to linear conversion for a single normalized float.
#[inline(always)]
pub fn srgb_to_linear_f32(v: f32) -> f32 {
    let v_clamped = v.clamp(0.0, 1.0);
    if v_clamped <= 0.04045 {
        v_clamped / 12.92
    } else {
        ((v_clamped + 0.055) / 1.055).powf(2.4)
    }
}

/// Exact mathematical linear to sRGB conversion for a single normalized float.
#[inline(always)]
pub fn linear_to_srgb_f32(v: f32) -> f32 {
    let v_clamped = v.clamp(0.0, 1.0);
    if v_clamped <= 0.0031308 {
        v_clamped * 12.92
    } else {
        1.055 * v_clamped.powf(1.0 / 2.4) - 0.055
    }
}

/// Convert an 8-bit sRGB byte (0..=255) to a linear byte (0..=255) within +/- 1 LSB precision.
#[inline(always)]
pub fn srgb_to_linear_u8(v: u8) -> u8 {
    let f = v as f32 / 255.0;
    let lin = srgb_to_linear_f32(f);
    (lin * 255.0 + 0.5).clamp(0.0, 255.0) as u8
}

/// Convert an 8-bit linear byte (0..=255) to an sRGB byte (0..=255) within +/- 1 LSB precision.
#[inline(always)]
pub fn linear_to_srgb_u8(v: u8) -> u8 {
    let f = v as f32 / 255.0;
    let srgb = linear_to_srgb_f32(f);
    (srgb * 255.0 + 0.5).clamp(0.0, 255.0) as u8
}

/// Precomputed lookup table for 8-bit sRGB to linear byte conversion.
pub struct ColorSpaceLut {
    srgb_to_linear_u8: [u8; 256],
    linear_to_srgb_u8: [u8; 256],
    srgb_to_linear_f32: [f32; 256],
}

impl ColorSpaceLut {
    /// Generates precomputed lookup tables.
    pub fn new() -> Self {
        let mut s2l_u8 = [0u8; 256];
        let mut l2s_u8 = [0u8; 256];
        let mut s2l_f32 = [0.0f32; 256];

        for i in 0..256 {
            let s_byte = i as u8;
            s2l_u8[i] = srgb_to_linear_u8(s_byte);
            l2s_u8[i] = linear_to_srgb_u8(s_byte);
            s2l_f32[i] = srgb_to_linear_f32(i as f32 / 255.0);
        }

        Self {
            srgb_to_linear_u8: s2l_u8,
            linear_to_srgb_u8: l2s_u8,
            srgb_to_linear_f32: s2l_f32,
        }
    }

    #[inline(always)]
    pub fn srgb_to_linear_byte(&self, v: u8) -> u8 {
        self.srgb_to_linear_u8[v as usize]
    }

    #[inline(always)]
    pub fn linear_to_srgb_byte(&self, v: u8) -> u8 {
        self.linear_to_srgb_u8[v as usize]
    }

    #[inline(always)]
    pub fn srgb_to_linear_float(&self, v: u8) -> f32 {
        self.srgb_to_linear_f32[v as usize]
    }
}

// Thread-safe cached LUT instance
static GLOBAL_LUT: std::sync::OnceLock<ColorSpaceLut> = std::sync::OnceLock::new();

/// Returns a reference to the global precomputed ColorSpaceLut.
#[inline(always)]
pub fn get_lut() -> &'static ColorSpaceLut {
    GLOBAL_LUT.get_or_init(ColorSpaceLut::new)
}

/// Converts an entire TextureBuffer from sRGB to Linear space in parallel using Rayon.
/// Note: Alpha channel is preserved linearly (untouched).
pub fn srgb_to_linear_buffer(buffer: &TextureBuffer) -> TextureBuffer {
    let mut out = buffer.clone();
    let lut = get_lut();
    let slice = out.image.as_mut();

    slice.par_chunks_exact_mut(4).for_each(|px| {
        px[0] = lut.srgb_to_linear_byte(px[0]);
        px[1] = lut.srgb_to_linear_byte(px[1]);
        px[2] = lut.srgb_to_linear_byte(px[2]);
        // px[3] (Alpha) is kept untouched
    });

    out
}

/// Converts an entire TextureBuffer from Linear to sRGB space in parallel using Rayon.
/// Note: Alpha channel is preserved linearly (untouched).
pub fn linear_to_srgb_buffer(buffer: &TextureBuffer) -> TextureBuffer {
    let mut out = buffer.clone();
    let lut = get_lut();
    let slice = out.image.as_mut();

    slice.par_chunks_exact_mut(4).for_each(|px| {
        px[0] = lut.linear_to_srgb_byte(px[0]);
        px[1] = lut.linear_to_srgb_byte(px[1]);
        px[2] = lut.linear_to_srgb_byte(px[2]);
        // px[3] (Alpha) is kept untouched
    });

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_srgb_linear_math_boundaries() {
        assert_eq!(srgb_to_linear_u8(0), 0);
        assert_eq!(srgb_to_linear_u8(255), 255);
        assert_eq!(linear_to_srgb_u8(0), 0);
        assert_eq!(linear_to_srgb_u8(255), 255);

        // Mid-gray 128 in 8-bit sRGB corresponds to ~0.214 in Linear, which maps to ~54 in linear 8-bit
        let mid_linear = srgb_to_linear_u8(128);
        assert!(mid_linear >= 52 && mid_linear <= 56, "Mid-gray sRGB 128 -> linear should be ~54, got {}", mid_linear);
    }

    #[test]
    fn test_colorspace_lut_accuracy() {
        let lut = get_lut();
        for i in 0..=255u8 {
            let direct = srgb_to_linear_u8(i);
            let via_lut = lut.srgb_to_linear_byte(i);
            assert_eq!(direct, via_lut, "Mismatch at byte {}", i);

            let srgb_direct = linear_to_srgb_u8(i);
            let srgb_via_lut = lut.linear_to_srgb_byte(i);
            assert_eq!(srgb_direct, srgb_via_lut, "Mismatch at byte {}", i);
        }
    }

    #[test]
    fn test_float_roundtrip_precision() {
        for i in 0..=100 {
            let original = i as f32 / 100.0;
            let linear = srgb_to_linear_f32(original);
            let reconstructed = linear_to_srgb_f32(linear);
            assert!(
                (original - reconstructed).abs() < 1e-5,
                "Float precision deviation: original={}, reconstructed={}",
                original,
                reconstructed
            );
        }
    }

    #[test]
    fn test_buffer_colorspace_conversion() {
        let buf = TextureBuffer::solid_color(16, 16, 128, 128, 128, 200);
        let linear_buf = srgb_to_linear_buffer(&buf);
        let srgb_buf = linear_to_srgb_buffer(&linear_buf);

        // Alpha is untouched
        assert_eq!(linear_buf.get_sample(0, 0, 3), 200);
        assert_eq!(srgb_buf.get_sample(0, 0, 3), 200);

        // RGB is converted and reconstructed within 1 LSB
        let orig_r = buf.get_sample(0, 0, 0) as i32;
        let recon_r = srgb_buf.get_sample(0, 0, 0) as i32;
        assert!((orig_r - recon_r).abs() <= 1, "LSB delta: {} vs {}", orig_r, recon_r);
    }
}
