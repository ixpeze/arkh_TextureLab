//! Adjustment and Normal Processing Nodes (Phase 3).
//!
//! Provides `NormalFlipGreen` (DirectX <-> OpenGL), `NormalNormalize`, `NormalStrength`,
//! `Levels`, `Invert`, and `BrightnessContrast` with Rayon parallelization and LUT acceleration.

use crate::core::buffer::{SharedTextureBuffer, TextureBuffer};
use crate::graph::evaluator::EvaluationError;
use crate::graph::model::{Node, NodeParam};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Configuration payload for the `Levels` node.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LevelsNodeData {
    pub in_low: f32,
    pub in_high: f32,
    pub gamma: f32,
    pub out_low: f32,
    pub out_high: f32,
    pub affect_alpha: bool,
}

impl Default for LevelsNodeData {
    fn default() -> Self {
        Self {
            in_low: 0.0,
            in_high: 1.0,
            gamma: 1.0,
            out_low: 0.0,
            out_high: 1.0,
            affect_alpha: false,
        }
    }
}

impl LevelsNodeData {
    pub fn apply_to_node(&self, node: &mut Node) {
        node.set_param("in_low", NodeParam::Float(self.in_low));
        node.set_param("in_high", NodeParam::Float(self.in_high));
        node.set_param("gamma", NodeParam::Float(self.gamma));
        node.set_param("out_low", NodeParam::Float(self.out_low));
        node.set_param("out_high", NodeParam::Float(self.out_high));
        node.set_param("affect_alpha", NodeParam::Bool(self.affect_alpha));
    }

    pub fn from_node(node: &Node) -> Self {
        Self {
            in_low: node.get_float("in_low", 0.0),
            in_high: node.get_float("in_high", 1.0),
            gamma: node.get_float("gamma", 1.0),
            out_low: node.get_float("out_low", 0.0),
            out_high: node.get_float("out_high", 1.0),
            affect_alpha: node.get_bool("affect_alpha", false),
        }
    }

    /// Precomputes a 256-entry lookup table for sub-millisecond execution.
    pub fn build_lut(&self) -> [u8; 256] {
        let in_low = self.in_low.clamp(0.0, 1.0);
        let in_high = self.in_high.clamp(0.0, 1.0);
        let gamma = self.gamma.max(0.001);
        let out_low = self.out_low.clamp(0.0, 1.0);
        let out_high = self.out_high.clamp(0.0, 1.0);
        let range = (in_high - in_low).max(0.0001);

        let mut lut = [0u8; 256];
        for i in 0..256 {
            let v = i as f32 / 255.0;
            let clamped = ((v - in_low) / range).clamp(0.0, 1.0);
            let val = clamped.powf(1.0 / gamma);
            let mapped = out_low + val * (out_high - out_low);
            lut[i] = (mapped * 255.0 + 0.5).clamp(0.0, 255.0) as u8;
        }
        lut
    }
}

/// Inverts the green channel of a tangent space normal map ($G = 255 - G$),
/// converting between DirectX and OpenGL conventions.
pub fn flip_normal_green(src: &TextureBuffer) -> TextureBuffer {
    let mut out = TextureBuffer::new(src.width, src.height);
    let src_raw = src.image.as_raw();
    let dst_raw = out.image.as_mut();

    dst_raw
        .par_chunks_exact_mut(4)
        .zip(src_raw.par_chunks_exact(4))
        .for_each(|(dst_px, src_px)| {
            dst_px[0] = src_px[0];
            dst_px[1] = 255 - src_px[1]; // Invert Y / Green
            dst_px[2] = src_px[2];
            dst_px[3] = src_px[3];
        });

    out
}

/// Normalizes tangent-space normal vectors to unit length $\sqrt{x^2 + y^2 + z^2} = 1.0$.
pub fn normalize_normal_map(src: &TextureBuffer) -> TextureBuffer {
    let mut out = TextureBuffer::new(src.width, src.height);
    let src_raw = src.image.as_raw();
    let dst_raw = out.image.as_mut();

    dst_raw
        .par_chunks_exact_mut(4)
        .zip(src_raw.par_chunks_exact(4))
        .for_each(|(dst_px, src_px)| {
            let nx = (src_px[0] as f32 / 255.0) * 2.0 - 1.0;
            let ny = (src_px[1] as f32 / 255.0) * 2.0 - 1.0;
            let nz = (src_px[2] as f32 / 255.0) * 2.0 - 1.0;

            let len = (nx * nx + ny * ny + nz * nz).sqrt();
            let (unx, uny, unz) = if len > 1e-6 {
                (nx / len, ny / len, nz / len)
            } else {
                (0.0, 0.0, 1.0)
            };

            dst_px[0] = ((unx * 0.5 + 0.5) * 255.0).round().clamp(0.0, 255.0) as u8;
            dst_px[1] = ((uny * 0.5 + 0.5) * 255.0).round().clamp(0.0, 255.0) as u8;
            dst_px[2] = ((unz * 0.5 + 0.5) * 255.0).round().clamp(0.0, 255.0) as u8;
            dst_px[3] = src_px[3];
        });

    out
}

/// Scales the intensity of the normal vector's tangent perturbations.
pub fn scale_normal_strength(src: &TextureBuffer, strength: f32) -> TextureBuffer {
    let mut out = TextureBuffer::new(src.width, src.height);
    let src_raw = src.image.as_raw();
    let dst_raw = out.image.as_mut();

    dst_raw
        .par_chunks_exact_mut(4)
        .zip(src_raw.par_chunks_exact(4))
        .for_each(|(dst_px, src_px)| {
            let nx = ((src_px[0] as f32 / 255.0) * 2.0 - 1.0) * strength;
            let ny = ((src_px[1] as f32 / 255.0) * 2.0 - 1.0) * strength;
            let nz = (src_px[2] as f32 / 255.0) * 2.0 - 1.0;

            let len = (nx * nx + ny * ny + nz * nz).sqrt();
            let (unx, uny, unz) = if len > 1e-6 {
                (nx / len, ny / len, nz / len)
            } else {
                (0.0, 0.0, 1.0)
            };

            dst_px[0] = ((unx * 0.5 + 0.5) * 255.0).round().clamp(0.0, 255.0) as u8;
            dst_px[1] = ((uny * 0.5 + 0.5) * 255.0).round().clamp(0.0, 255.0) as u8;
            dst_px[2] = ((unz * 0.5 + 0.5) * 255.0).round().clamp(0.0, 255.0) as u8;
            dst_px[3] = src_px[3];
        });

    out
}

/// Inverts color channels ($255 - x$).
pub fn invert_buffer(src: &TextureBuffer, invert_alpha: bool) -> TextureBuffer {
    let mut out = TextureBuffer::new(src.width, src.height);
    let src_raw = src.image.as_raw();
    let dst_raw = out.image.as_mut();

    dst_raw
        .par_chunks_exact_mut(4)
        .zip(src_raw.par_chunks_exact(4))
        .for_each(|(dst_px, src_px)| {
            dst_px[0] = 255 - src_px[0];
            dst_px[1] = 255 - src_px[1];
            dst_px[2] = 255 - src_px[2];
            dst_px[3] = if invert_alpha { 255 - src_px[3] } else { src_px[3] };
        });

    out
}

/// Applies levels remapping (black point, white point, gamma) with LUT acceleration.
pub fn apply_levels(src: &TextureBuffer, data: &LevelsNodeData) -> TextureBuffer {
    let lut = data.build_lut();
    let affect_alpha = data.affect_alpha;

    let mut out = TextureBuffer::new(src.width, src.height);
    let src_raw = src.image.as_raw();
    let dst_raw = out.image.as_mut();

    dst_raw
        .par_chunks_exact_mut(4)
        .zip(src_raw.par_chunks_exact(4))
        .for_each(|(dst_px, src_px)| {
            dst_px[0] = lut[src_px[0] as usize];
            dst_px[1] = lut[src_px[1] as usize];
            dst_px[2] = lut[src_px[2] as usize];
            dst_px[3] = if affect_alpha { lut[src_px[3] as usize] } else { src_px[3] };
        });

    out
}

/// Applies brightness and contrast adjustment.
pub fn apply_brightness_contrast(src: &TextureBuffer, brightness: f32, contrast: f32) -> TextureBuffer {
    let mut lut = [0u8; 256];
    for i in 0..256 {
        let v = i as f32 / 255.0;
        let val = (v - 0.5) * contrast + 0.5 + brightness;
        lut[i] = (val.clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
    }

    let mut out = TextureBuffer::new(src.width, src.height);
    let src_raw = src.image.as_raw();
    let dst_raw = out.image.as_mut();

    dst_raw
        .par_chunks_exact_mut(4)
        .zip(src_raw.par_chunks_exact(4))
        .for_each(|(dst_px, src_px)| {
            dst_px[0] = lut[src_px[0] as usize];
            dst_px[1] = lut[src_px[1] as usize];
            dst_px[2] = lut[src_px[2] as usize];
            dst_px[3] = src_px[3];
        });

    out
}

/// Executes a `NormalFlipGreen` node.
pub fn execute_normal_flip_green(
    _node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let src = inputs.get("input").or_else(|| inputs.get("in")).or_else(|| inputs.values().next());
    let mut outputs = HashMap::new();

    if let Some(buf) = src {
        let flipped = flip_normal_green(buf.as_ref());
        let shared = Arc::new(flipped);
        outputs.insert("output".to_string(), Arc::clone(&shared));
        outputs.insert("out".to_string(), shared);
    } else {
        let blank = Arc::new(TextureBuffer::new(resolution.0, resolution.1));
        outputs.insert("output".to_string(), blank);
    }

    Ok(outputs)
}

/// Executes a `NormalNormalize` node.
pub fn execute_normal_normalize(
    _node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let src = inputs.get("input").or_else(|| inputs.get("in")).or_else(|| inputs.values().next());
    let mut outputs = HashMap::new();

    if let Some(buf) = src {
        let normalized = normalize_normal_map(buf.as_ref());
        let shared = Arc::new(normalized);
        outputs.insert("output".to_string(), Arc::clone(&shared));
        outputs.insert("out".to_string(), shared);
    } else {
        let flat = Arc::new(TextureBuffer::solid_color(resolution.0, resolution.1, 128, 128, 255, 255));
        outputs.insert("output".to_string(), flat);
    }

    Ok(outputs)
}

/// Executes a `NormalStrength` node.
pub fn execute_normal_strength(
    node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let strength = node.get_float("strength", 1.0);
    let src = inputs.get("input").or_else(|| inputs.get("in")).or_else(|| inputs.values().next());
    let mut outputs = HashMap::new();

    if let Some(buf) = src {
        let scaled = scale_normal_strength(buf.as_ref(), strength);
        let shared = Arc::new(scaled);
        outputs.insert("output".to_string(), Arc::clone(&shared));
        outputs.insert("out".to_string(), shared);
    } else {
        let flat = Arc::new(TextureBuffer::solid_color(resolution.0, resolution.1, 128, 128, 255, 255));
        outputs.insert("output".to_string(), flat);
    }

    Ok(outputs)
}

/// Executes an `Invert` node.
pub fn execute_invert(
    node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let invert_alpha = node.get_bool("invert_alpha", false);
    let src = inputs.get("input").or_else(|| inputs.get("in")).or_else(|| inputs.values().next());
    let mut outputs = HashMap::new();

    if let Some(buf) = src {
        let inverted = invert_buffer(buf.as_ref(), invert_alpha);
        let shared = Arc::new(inverted);
        outputs.insert("output".to_string(), Arc::clone(&shared));
        outputs.insert("out".to_string(), shared);
    } else {
        let blank = Arc::new(TextureBuffer::new(resolution.0, resolution.1));
        outputs.insert("output".to_string(), blank);
    }

    Ok(outputs)
}

/// Executes a `Levels` node.
pub fn execute_levels(
    node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let data = LevelsNodeData::from_node(node);
    let src = inputs.get("input").or_else(|| inputs.get("in")).or_else(|| inputs.values().next());
    let mut outputs = HashMap::new();

    if let Some(buf) = src {
        let adjusted = apply_levels(buf.as_ref(), &data);
        let shared = Arc::new(adjusted);
        outputs.insert("output".to_string(), Arc::clone(&shared));
        outputs.insert("out".to_string(), shared);
    } else {
        let blank = Arc::new(TextureBuffer::new(resolution.0, resolution.1));
        outputs.insert("output".to_string(), blank);
    }

    Ok(outputs)
}

/// Executes a `BrightnessContrast` node.
pub fn execute_brightness_contrast(
    node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let brightness = node.get_float("brightness", 0.0);
    let contrast = node.get_float("contrast", 1.0);
    let src = inputs.get("input").or_else(|| inputs.get("in")).or_else(|| inputs.values().next());
    let mut outputs = HashMap::new();

    if let Some(buf) = src {
        let adjusted = apply_brightness_contrast(buf.as_ref(), brightness, contrast);
        let shared = Arc::new(adjusted);
        outputs.insert("output".to_string(), Arc::clone(&shared));
        outputs.insert("out".to_string(), shared);
    } else {
        let blank = Arc::new(TextureBuffer::new(resolution.0, resolution.1));
        outputs.insert("output".to_string(), blank);
    }

    Ok(outputs)
}

#[cfg(test)]
pub mod tests {
    use super::*;

    /// P3-T4 Acceptance & TC-304: Normal Flip Green DirectX/OpenGL & Levels
    #[test]
    pub fn test_normal_flip_and_levels() {
        // Normal Flip Green test:
        let mut normal_buf = TextureBuffer::new(16, 16);
        normal_buf.set_pixel(0, 0, [128, 64, 255, 255]); // Tangent normal pointing down in Y
        let flipped = flip_normal_green(&normal_buf);

        // Y component (Green) must flip across 128: 255 - 64 = 191
        let flipped_px = flipped.get_pixel(0, 0);
        assert_eq!(flipped_px[0], 128);
        assert_eq!(flipped_px[1], 191);
        assert_eq!(flipped_px[2], 255);
        assert_eq!(flipped_px[3], 255);

        // Flipping again returns original
        let double_flipped = flip_normal_green(&flipped);
        assert_eq!(double_flipped.get_pixel(0, 0), [128, 64, 255, 255]);

        // P3-T5 Gamma Levels test:
        let levels_data = LevelsNodeData {
            in_low: 0.0,
            in_high: 1.0,
            gamma: 2.2,
            out_low: 0.0,
            out_high: 1.0,
            affect_alpha: false,
        };
        let lut = levels_data.build_lut();

        // At mid-gray (128 / 255 ≈ 0.50196):
        // 0.50196^(1/2.2) ≈ 0.7303 -> 0.7303 * 255 ≈ 186
        let mid_val = lut[128];
        assert!((mid_val as i32 - 186).abs() <= 1);
        assert_eq!(lut[0], 0);
        assert_eq!(lut[255], 255);
    }

    #[test]
    pub fn test_normal_normalize_and_strength() {
        let mut buf = TextureBuffer::new(4, 4);
        // Non-normalized vector (scaled up)
        buf.set_pixel(0, 0, [255, 128, 255, 255]);
        let norm = normalize_normal_map(&buf);
        let px = norm.get_pixel(0, 0);

        let nx = (px[0] as f32 / 255.0) * 2.0 - 1.0;
        let ny = (px[1] as f32 / 255.0) * 2.0 - 1.0;
        let nz = (px[2] as f32 / 255.0) * 2.0 - 1.0;
        let len = (nx * nx + ny * ny + nz * nz).sqrt();
        assert!((len - 1.0).abs() < 0.05);

        // Strength scaling
        let scaled = scale_normal_strength(&norm, 2.0);
        assert_eq!(scaled.width, 4);
    }

    #[test]
    pub fn test_invert_node() {
        let buf = TextureBuffer::solid_color(8, 8, 200, 50, 0, 255);
        let inv = invert_buffer(&buf, false);
        assert_eq!(inv.get_pixel(0, 0), [55, 205, 255, 255]);
    }
}
