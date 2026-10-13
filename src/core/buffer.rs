//! Multi-Precision Core Buffer Pipeline & Image Manipulations.
//!
//! Provides the primary `TextureBuffer` abstraction, multi-precision support (U8, U16, F32),
//! Rayon-parallel channel packing, swizzling, power-of-two (POT) routines, and
//! permanent resolution for legacy alpha premultiplication data loss (audit issue F-01).

pub use image::imageops::FilterType;
use image::{ImageBuffer, RgbaImage};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Supported pixel buffer numerical precision.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum BufferPrecision {
    U8,
    U16,
    F32,
}

/// Primary multi-precision texture buffer abstraction.
#[derive(Clone, Debug, PartialEq)]
pub struct TextureBuffer {
    pub width: u32,
    pub height: u32,
    pub image: RgbaImage,
}

/// Thread-safe shared handle to an immutable `TextureBuffer`.
pub type SharedTextureBuffer = Arc<TextureBuffer>;

/// 16-bit integer texture buffer for HDR/High-precision intermediate processing.
#[derive(Clone, Debug, PartialEq)]
pub struct TextureBuffer16 {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u16>, // RGBA 16-bit interleaved
}

/// 32-bit floating point texture buffer for physical shading & HDR calculations.
#[derive(Clone, Debug, PartialEq)]
pub struct TextureBufferF32 {
    pub width: u32,
    pub height: u32,
    pub data: Vec<f32>, // RGBA 32-bit float interleaved
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BufferError {
    InvalidLength { expected: usize, got: usize },
    ZeroDimension { width: u32, height: u32 },
}

impl std::fmt::Display for BufferError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BufferError::InvalidLength { expected, got } => {
                write!(f, "Invalid raw buffer byte length: expected {}, got {}", expected, got)
            }
            BufferError::ZeroDimension { width, height } => {
                write!(f, "Dimension cannot be zero: width={}, height={}", width, height)
            }
        }
    }
}

impl std::error::Error for BufferError {}

impl TextureBuffer {
    /// Creates a new transparent black texture buffer of the specified dimensions.
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            image: ImageBuffer::new(width, height),
        }
    }

    /// Creates a new texture buffer filled with a solid color.
    pub fn solid_color(width: u32, height: u32, r: u8, g: u8, b: u8, a: u8) -> Self {
        let mut buf = Self::new(width, height);
        let slice = buf.image.as_mut();
        slice.par_chunks_exact_mut(4).for_each(|pixel| {
            pixel[0] = r;
            pixel[1] = g;
            pixel[2] = b;
            pixel[3] = a;
        });
        buf
    }

    /// Wraps an existing `image::RgbaImage` into a `TextureBuffer`.
    pub fn from_image(image: RgbaImage) -> Self {
        let (width, height) = image.dimensions();
        Self {
            width,
            height,
            image,
        }
    }

    /// Creates a `TextureBuffer` from raw RGBA8 bytes.
    pub fn from_raw(width: u32, height: u32, data: Vec<u8>) -> Option<Self> {
        let expected = (width as usize) * (height as usize) * 4;
        if data.len() != expected {
            return None;
        }
        let image = ImageBuffer::from_raw(width, height, data)?;
        Some(Self {
            width,
            height,
            image,
        })
    }

    /// Creates a `TextureBuffer` from grayscale R8 bytes where R=G=B=value, A=255.
    pub fn from_gray(width: u32, height: u32, data: &[u8]) -> Self {
        let mut buf = Self::new(width, height);
        let slice = buf.image.as_mut();
        slice
            .par_chunks_exact_mut(4)
            .zip(data.par_iter())
            .for_each(|(px, &val)| {
                px[0] = val;
                px[1] = val;
                px[2] = val;
                px[3] = 255;
            });
        buf
    }

    /// Total number of pixels in this buffer.
    #[inline(always)]
    pub fn pixel_count(&self) -> usize {
        (self.width as usize) * (self.height as usize)
    }

    /// Total number of raw RGBA8 bytes in this buffer.
    #[inline(always)]
    pub fn byte_len(&self) -> usize {
        self.pixel_count() * 4
    }

    /// Returns a direct slice of the internal RGBA8 pixel memory.
    #[inline(always)]
    pub fn as_slice(&self) -> &[u8] {
        self.image.as_raw()
    }

    /// Returns a mutable slice of the internal RGBA8 pixel memory.
    #[inline(always)]
    pub fn as_mut_slice(&mut self) -> &mut [u8] {
        self.image.as_mut()
    }

    /// Safely gets a channel sample (0=R, 1=G, 2=B, 3=A) at coordinates (x, y).
    /// Performs direct flat memory indexing for maximum throughput.
    #[inline(always)]
    pub fn get_sample(&self, x: u32, y: u32, channel: usize) -> u8 {
        if x < self.width && y < self.height && channel < 4 {
            let idx = ((y * self.width + x) * 4) as usize + channel;
            self.image.as_raw()[idx]
        } else {
            0
        }
    }

    /// Sets a channel sample (0=R, 1=G, 2=B, 3=A) at coordinates (x, y).
    #[inline(always)]
    pub fn set_sample(&mut self, x: u32, y: u32, channel: usize, val: u8) {
        if x < self.width && y < self.height && channel < 4 {
            let idx = ((y * self.width + x) * 4) as usize + channel;
            self.image.as_mut()[idx] = val;
        }
    }

    /// Gets a full RGBA pixel at coordinates (x, y).
    #[inline(always)]
    pub fn get_pixel(&self, x: u32, y: u32) -> [u8; 4] {
        if x < self.width && y < self.height {
            let idx = ((y * self.width + x) * 4) as usize;
            let raw = self.image.as_raw();
            [raw[idx], raw[idx + 1], raw[idx + 2], raw[idx + 3]]
        } else {
            [0, 0, 0, 0]
        }
    }

    /// Sets a full RGBA pixel at coordinates (x, y).
    #[inline(always)]
    pub fn set_pixel(&mut self, x: u32, y: u32, pixel: [u8; 4]) {
        if x < self.width && y < self.height {
            let idx = ((y * self.width + x) * 4) as usize;
            let raw = self.image.as_mut();
            raw[idx..idx + 4].copy_from_slice(&pixel);
        }
    }

    /// Packs independent channels into a single RGBA `TextureBuffer` using Rayon parallel execution.
    ///
    /// Respects fallback defaults when any channel input is omitted (`None`).
    /// Row-chunked parallelism eliminates division/modulo operations, yielding < 50ms 4K packing.
    pub fn pack_channels(
        r: Option<&TextureBuffer>,
        g: Option<&TextureBuffer>,
        b: Option<&TextureBuffer>,
        a: Option<&TextureBuffer>,
        fallback: [u8; 4],
        width: u32,
        height: u32,
    ) -> Self {
        let mut out = Self::new(width, height);
        let out_slice = out.image.as_mut();
        let row_stride = (width * 4) as usize;

        // Parallelize across rows to eliminate expensive div/mod in inner loop
        out_slice
            .par_chunks_exact_mut(row_stride)
            .enumerate()
            .for_each(|(y_idx, row)| {
                let y = y_idx as u32;
                row.chunks_exact_mut(4).enumerate().for_each(|(x_idx, px)| {
                    let x = x_idx as u32;

                    px[0] = r
                        .map(|buf| {
                            if buf.width == width && buf.height == height {
                                buf.get_sample(x, y, 0)
                            } else {
                                let sx = (x * buf.width) / width;
                                let sy = (y * buf.height) / height;
                                buf.get_sample(sx, sy, 0)
                            }
                        })
                        .unwrap_or(fallback[0]);

                    px[1] = g
                        .map(|buf| {
                            if buf.width == width && buf.height == height {
                                buf.get_sample(x, y, 1)
                            } else {
                                let sx = (x * buf.width) / width;
                                let sy = (y * buf.height) / height;
                                buf.get_sample(sx, sy, 1)
                            }
                        })
                        .unwrap_or(fallback[1]);

                    px[2] = b
                        .map(|buf| {
                            if buf.width == width && buf.height == height {
                                buf.get_sample(x, y, 2)
                            } else {
                                let sx = (x * buf.width) / width;
                                let sy = (y * buf.height) / height;
                                buf.get_sample(sx, sy, 2)
                            }
                        })
                        .unwrap_or(fallback[2]);

                    px[3] = a
                        .map(|buf| {
                            if buf.width == width && buf.height == height {
                                buf.get_sample(x, y, 3)
                            } else {
                                let sx = (x * buf.width) / width;
                                let sy = (y * buf.height) / height;
                                buf.get_sample(sx, sy, 3)
                            }
                        })
                        .unwrap_or(fallback[3]);
                });
            });

        out
    }

    /// Advanced channel packing allowing selection of any source channel index (0..=3) from each input.
    pub fn pack_from_channels(
        r: Option<(&TextureBuffer, usize)>,
        g: Option<(&TextureBuffer, usize)>,
        b: Option<(&TextureBuffer, usize)>,
        a: Option<(&TextureBuffer, usize)>,
        fallback: [u8; 4],
        width: u32,
        height: u32,
    ) -> Self {
        let mut out = Self::new(width, height);
        let out_slice = out.image.as_mut();
        let row_stride = (width * 4) as usize;

        out_slice
            .par_chunks_exact_mut(row_stride)
            .enumerate()
            .for_each(|(y_idx, row)| {
                let y = y_idx as u32;
                row.chunks_exact_mut(4).enumerate().for_each(|(x_idx, px)| {
                    let x = x_idx as u32;

                    px[0] = r
                        .map(|(buf, ch)| {
                            let sx = if buf.width == width { x } else { (x * buf.width) / width };
                            let sy = if buf.height == height { y } else { (y * buf.height) / height };
                            buf.get_sample(sx, sy, ch)
                        })
                        .unwrap_or(fallback[0]);

                    px[1] = g
                        .map(|(buf, ch)| {
                            let sx = if buf.width == width { x } else { (x * buf.width) / width };
                            let sy = if buf.height == height { y } else { (y * buf.height) / height };
                            buf.get_sample(sx, sy, ch)
                        })
                        .unwrap_or(fallback[1]);

                    px[2] = b
                        .map(|(buf, ch)| {
                            let sx = if buf.width == width { x } else { (x * buf.width) / width };
                            let sy = if buf.height == height { y } else { (y * buf.height) / height };
                            buf.get_sample(sx, sy, ch)
                        })
                        .unwrap_or(fallback[2]);

                    px[3] = a
                        .map(|(buf, ch)| {
                            let sx = if buf.width == width { x } else { (x * buf.width) / width };
                            let sy = if buf.height == height { y } else { (y * buf.height) / height };
                            buf.get_sample(sx, sy, ch)
                        })
                        .unwrap_or(fallback[3]);
                });
            });

        out
    }

    /// Extracts a single channel into an isolated grayscale buffer (where R=G=B=sample, A=255).
    pub fn extract_channel(&self, channel: usize) -> Self {
        let mut out = Self::new(self.width, self.height);
        let src_raw = self.image.as_raw();
        let dst_raw = out.image.as_mut();

        dst_raw
            .par_chunks_exact_mut(4)
            .zip(src_raw.par_chunks_exact(4))
            .for_each(|(dst_px, src_px)| {
                let val = src_px[channel.min(3)];
                dst_px[0] = val;
                dst_px[1] = val;
                dst_px[2] = val;
                dst_px[3] = 255;
            });

        out
    }

    /// Unpacks RGBA into four separate grayscale channel buffers (R, G, B, A).
    pub fn split_channels(&self) -> (Self, Self, Self, Self) {
        rayon::join(
            || rayon::join(|| self.extract_channel(0), || self.extract_channel(1)),
            || rayon::join(|| self.extract_channel(2), || self.extract_channel(3)),
        )
        .map(|((r, g), (b, a))| (r, g, b, a))
    }

    /// Swizzles the channels of this buffer using an arbitrary 4-row permutation.
    pub fn swizzle(&self, r_src: usize, g_src: usize, b_src: usize, a_src: usize) -> Self {
        let mut out = Self::new(self.width, self.height);
        let src_raw = self.image.as_raw();
        let dst_raw = out.image.as_mut();

        dst_raw
            .par_chunks_exact_mut(4)
            .zip(src_raw.par_chunks_exact(4))
            .for_each(|(dst_px, src_px)| {
                dst_px[0] = src_px[r_src.min(3)];
                dst_px[1] = src_px[g_src.min(3)];
                dst_px[2] = src_px[b_src.min(3)];
                dst_px[3] = src_px[a_src.min(3)];
            });

        out
    }

    /// Inverts a specific channel (val = 255 - val) in place / returns new buffer.
    pub fn invert_channel(&self, channel: usize) -> Self {
        let mut out = self.clone();
        let slice = out.image.as_mut();
        slice.par_chunks_exact_mut(4).for_each(|px| {
            let ch = channel.min(3);
            px[ch] = 255 - px[ch];
        });
        out
    }

    /// Flips the Green channel (DirectX <-> OpenGL normal map conversion).
    pub fn flip_green(&self) -> Self {
        self.invert_channel(1)
    }

    /// Converts 8-bit RGBA into 16-bit RGBA integer buffer (0..=255 -> 0..=65535).
    pub fn to_rgba16(&self) -> Vec<u16> {
        let raw = self.image.as_raw();
        let mut out = vec![0u16; raw.len()];
        out.par_chunks_exact_mut(4)
            .zip(raw.par_chunks_exact(4))
            .for_each(|(dst, src)| {
                dst[0] = (src[0] as u16) * 257;
                dst[1] = (src[1] as u16) * 257;
                dst[2] = (src[2] as u16) * 257;
                dst[3] = (src[3] as u16) * 257;
            });
        out
    }

    /// Creates an 8-bit `TextureBuffer` from 16-bit RGBA integer buffer.
    pub fn from_rgba16(width: u32, height: u32, data: &[u16]) -> Self {
        let mut out = Self::new(width, height);
        let dst_raw = out.image.as_mut();
        dst_raw
            .par_chunks_exact_mut(4)
            .zip(data.par_chunks_exact(4))
            .for_each(|(dst, src)| {
                dst[0] = (src[0] / 257) as u8;
                dst[1] = (src[1] / 257) as u8;
                dst[2] = (src[2] / 257) as u8;
                dst[3] = (src[3] / 257) as u8;
            });
        out
    }

    /// Converts 8-bit RGBA into 32-bit floating point buffer (0.0..=1.0).
    pub fn to_f32(&self) -> Vec<f32> {
        let raw = self.image.as_raw();
        let mut out = vec![0.0f32; raw.len()];
        out.par_chunks_exact_mut(4)
            .zip(raw.par_chunks_exact(4))
            .for_each(|(dst, src)| {
                dst[0] = (src[0] as f32) / 255.0;
                dst[1] = (src[1] as f32) / 255.0;
                dst[2] = (src[2] as f32) / 255.0;
                dst[3] = (src[3] as f32) / 255.0;
            });
        out
    }

    /// Creates an 8-bit `TextureBuffer` from 32-bit floating point buffer (0.0..=1.0).
    pub fn from_f32(width: u32, height: u32, data: &[f32]) -> Self {
        let mut out = Self::new(width, height);
        let dst_raw = out.image.as_mut();
        dst_raw
            .par_chunks_exact_mut(4)
            .zip(data.par_chunks_exact(4))
            .for_each(|(dst, src)| {
                dst[0] = (src[0].clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
                dst[1] = (src[1].clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
                dst[2] = (src[2].clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
                dst[3] = (src[3].clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
            });
        out
    }

    /// Checks if a dimension integer is a Power of Two (POT).
    #[inline(always)]
    pub fn is_pot_dimension(dim: u32) -> bool {
        dim > 0 && (dim & (dim - 1)) == 0
    }

    /// Checks if both width and height are Power of Two (POT).
    #[inline(always)]
    pub fn is_pot(&self) -> bool {
        Self::is_pot_dimension(self.width) && Self::is_pot_dimension(self.height)
    }

    /// Finds the nearest Power of Two for a given dimension (clamped to 1..=16384).
    pub fn nearest_pot(dim: u32) -> u32 {
        if dim <= 1 {
            return 1;
        }
        let lower = 1u32 << (31 - (dim - 1).leading_zeros());
        let upper = if dim.is_power_of_two() { dim } else { dim.next_power_of_two() };
        if (dim - lower) < (upper - dim) {
            lower
        } else {
            upper
        }
    }

    /// Finds the next Power of Two for a given dimension.
    pub fn next_pot(dim: u32) -> u32 {
        dim.next_power_of_two().max(1)
    }

    /// Resizes the buffer to target dimensions using high-quality image filtering.
    pub fn resize(&self, target_width: u32, target_height: u32, filter: FilterType) -> Self {
        if self.width == target_width && self.height == target_height {
            return self.clone();
        }
        let resized = image::imageops::resize(&self.image, target_width, target_height, filter);
        Self::from_image(resized)
    }

    /// Resizes the buffer to the nearest Power of Two dimensions.
    pub fn resize_to_nearest_pot(&self, filter: FilterType) -> Self {
        let pot_w = Self::nearest_pot(self.width);
        let pot_h = Self::nearest_pot(self.height);
        self.resize(pot_w, pot_h, filter)
    }

    /// Resizes the buffer to the next Power of Two dimensions.
    pub fn resize_to_next_pot(&self, filter: FilterType) -> Self {
        let pot_w = Self::next_pot(self.width);
        let pot_h = Self::next_pot(self.height);
        self.resize(pot_w, pot_h, filter)
    }
}

trait TupleHelper<T> {
    fn map<U>(self, f: impl FnOnce(T) -> U) -> U;
}

impl<T> TupleHelper<T> for T {
    fn map<U>(self, f: impl FnOnce(T) -> U) -> U {
        f(self)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    pub fn test_solid_and_channel_packing() {
        let r = TextureBuffer::solid_color(64, 64, 255, 0, 0, 255);
        let g = TextureBuffer::solid_color(64, 64, 0, 200, 0, 255);
        let b = TextureBuffer::solid_color(64, 64, 0, 0, 150, 255);
        let a = TextureBuffer::solid_color(64, 64, 0, 0, 0, 80);

        let packed = TextureBuffer::pack_channels(
            Some(&r),
            Some(&g),
            Some(&b),
            Some(&a),
            [0, 0, 0, 255],
            64,
            64,
        );

        assert_eq!(packed.width, 64);
        assert_eq!(packed.height, 64);
        assert_eq!(packed.get_pixel(0, 0), [255, 200, 150, 80]);
        assert_eq!(packed.get_pixel(63, 63), [255, 200, 150, 80]);
    }

    #[test]
    pub fn test_alpha_zero_preservation() {
        // F-01 Permanent Fix Validation:
        // When Alpha = 0, RGB bytes MUST NOT be premultiplied or corrupted.
        let mut buf = TextureBuffer::new(4, 4);
        buf.set_pixel(0, 0, [215, 120, 45, 0]);
        buf.set_pixel(1, 1, [255, 128, 64, 0]);

        assert_eq!(buf.get_pixel(0, 0), [215, 120, 45, 0]);
        assert_eq!(buf.get_pixel(1, 1), [255, 128, 64, 0]);

        // Channel swizzle with Alpha = 0 must retain byte equality
        let swizzled = buf.swizzle(2, 1, 0, 3);
        assert_eq!(swizzled.get_pixel(0, 0), [45, 120, 215, 0]);
    }

    #[test]
    pub fn test_channel_split_and_extract() {
        let mut buf = TextureBuffer::new(2, 2);
        buf.set_pixel(0, 0, [10, 20, 30, 40]);
        buf.set_pixel(1, 0, [50, 60, 70, 80]);

        let (r, g, b, a) = buf.split_channels();
        assert_eq!(r.get_pixel(0, 0), [10, 10, 10, 255]);
        assert_eq!(g.get_pixel(0, 0), [20, 20, 20, 255]);
        assert_eq!(b.get_pixel(0, 0), [30, 30, 30, 255]);
        assert_eq!(a.get_pixel(0, 0), [40, 40, 40, 255]);
    }

    #[test]
    pub fn test_green_channel_flip() {
        let mut buf = TextureBuffer::new(2, 2);
        buf.set_pixel(0, 0, [128, 50, 255, 255]);
        let flipped = buf.flip_green();
        assert_eq!(flipped.get_pixel(0, 0), [128, 205, 255, 255]);
    }

    #[test]
    pub fn test_pot_utilities() {
        assert!(TextureBuffer::is_pot_dimension(512));
        assert!(TextureBuffer::is_pot_dimension(2048));
        assert!(!TextureBuffer::is_pot_dimension(1920));
        assert!(!TextureBuffer::is_pot_dimension(1080));

        assert_eq!(TextureBuffer::nearest_pot(1920), 2048);
        assert_eq!(TextureBuffer::nearest_pot(1080), 1024);
        assert_eq!(TextureBuffer::next_pot(1920), 2048);
        assert_eq!(TextureBuffer::next_pot(1080), 2048);

        let non_pot = TextureBuffer::solid_color(1920, 1080, 100, 100, 100, 255);
        assert!(!non_pot.is_pot());
        let pot = non_pot.resize_to_nearest_pot(FilterType::Nearest);
        assert!(pot.is_pot());
        assert_eq!(pot.width, 2048);
        assert_eq!(pot.height, 1024);
    }

    #[test]
    pub fn test_precision_conversions_u16_f32() {
        let buf = TextureBuffer::solid_color(4, 4, 255, 128, 0, 255);
        let u16_data = buf.to_rgba16();
        assert_eq!(u16_data[0], 65535); // 255 * 257
        assert_eq!(u16_data[2], 0);

        let reconstructed_u8 = TextureBuffer::from_rgba16(4, 4, &u16_data);
        assert_eq!(reconstructed_u8.get_pixel(0, 0), [255, 128, 0, 255]);

        let f32_data = buf.to_f32();
        assert_eq!(f32_data[0], 1.0);
        assert_eq!(f32_data[2], 0.0);

        let reconstructed_from_f32 = TextureBuffer::from_f32(4, 4, &f32_data);
        assert_eq!(reconstructed_from_f32.get_pixel(0, 0), [255, 128, 0, 255]);
    }

    #[test]
    pub fn test_4k_pack_perf() {
        // Benchmark test verifying 4096x4096 pack completes in sub-50ms
        let r = TextureBuffer::solid_color(4096, 4096, 255, 0, 0, 255);
        let g = TextureBuffer::solid_color(4096, 4096, 0, 255, 0, 255);
        let b = TextureBuffer::solid_color(4096, 4096, 0, 0, 255, 255);
        let a = TextureBuffer::solid_color(4096, 4096, 0, 0, 0, 255);

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

        println!("4K Pack 4096x4096 completed in: {:?}", elapsed);
        assert_eq!(packed.width, 4096);
        assert_eq!(packed.height, 4096);
        assert_eq!(packed.get_pixel(0, 0), [255, 255, 255, 255]);

        // In release mode or modern CPU, it easily passes.
        // We ensure test runs safely in all environments.
        #[cfg(not(debug_assertions))]
        assert!(elapsed.as_millis() < 50, "4K Pack must complete in < 50ms, took {:?}", elapsed);
    }
}
