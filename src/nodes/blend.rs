//! Blending and Compositing Nodes (Phase 3).
//!
//! Provides Stephen Hill & Colin Barré-Brisebois Reoriented Normal Mapping (RNM)
//! and multi-mode Layer Blend (Lerp) with mask weighting and opacity control.

use crate::core::buffer::{SharedTextureBuffer, TextureBuffer};
use crate::graph::evaluator::EvaluationError;
use crate::graph::model::Node;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Supported blend modes for the `LayerBlend` node.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum BlendMode {
    Normal,
    Multiply,
    Add,
    Subtract,
    Screen,
    Overlay,
    Darken,
    Lighten,
}

impl Default for BlendMode {
    fn default() -> Self {
        Self::Normal
    }
}

impl BlendMode {
    pub fn from_str_loose(s: &str) -> Self {
        match s.trim().to_uppercase().as_str() {
            "MULTIPLY" => Self::Multiply,
            "ADD" | "LINEARDODGE" => Self::Add,
            "SUBTRACT" => Self::Subtract,
            "SCREEN" => Self::Screen,
            "OVERLAY" => Self::Overlay,
            "DARKEN" => Self::Darken,
            "LIGHTEN" => Self::Lighten,
            _ => Self::Normal,
        }
    }

    /// Evaluates blending between a base component $a$ and layer component $b$ in $[0.0, 1.0]$.
    #[inline(always)]
    pub fn blend_component(&self, a: f32, b: f32) -> f32 {
        match self {
            Self::Normal => b,
            Self::Multiply => a * b,
            Self::Add => (a + b).min(1.0),
            Self::Subtract => (a - b).max(0.0),
            Self::Screen => 1.0 - (1.0 - a) * (1.0 - b),
            Self::Overlay => {
                if a < 0.5 {
                    2.0 * a * b
                } else {
                    1.0 - 2.0 * (1.0 - a) * (1.0 - b)
                }
            }
            Self::Darken => a.min(b),
            Self::Lighten => a.max(b),
        }
    }
}

/// Stephen Hill & Colin Barré-Brisebois Reoriented Normal Mapping (RNM).
///
/// Blends base normal map $N_1$ with detail normal map $N_2$ preserving surface curvature
/// without squashing the Z component:
///
/// $$\vec{t} = N_1 \cdot 2.0 + (-1.0, -1.0, 0.0)$$
/// $$\vec{u} = N_2 \cdot (-2.0, -2.0, 2.0) + (1.0, 1.0, -1.0)$$
/// $$\vec{r} = \vec{t} \cdot (\vec{t} \cdot \vec{u}) - \vec{u} \cdot t_z$$
/// $$\vec{N}_{out} = \text{normalize}(\vec{r}) \cdot 0.5 + 0.5$$
pub fn blend_normals_rnm(base: &TextureBuffer, detail: &TextureBuffer) -> TextureBuffer {
    let width = base.width.max(detail.width);
    let height = base.height.max(detail.height);

    let mut out = TextureBuffer::new(width, height);
    let out_raw = out.image.as_mut();
    let row_stride = (width * 4) as usize;

    out_raw
        .par_chunks_exact_mut(row_stride)
        .enumerate()
        .for_each(|(y_idx, row)| {
            let y = y_idx as u32;
            row.chunks_exact_mut(4).enumerate().for_each(|(x_idx, px)| {
                let x = x_idx as u32;

                let b_px = base.get_pixel(
                    if base.width == width { x } else { (x * base.width) / width },
                    if base.height == height { y } else { (y * base.height) / height },
                );
                let d_px = detail.get_pixel(
                    if detail.width == width { x } else { (x * detail.width) / width },
                    if detail.height == height { y } else { (y * detail.height) / height },
                );

                let n1_x = (b_px[0] as f32 / 255.0) * 2.0 - 1.0;
                let n1_y = (b_px[1] as f32 / 255.0) * 2.0 - 1.0;
                let n1_z = (b_px[2] as f32 / 255.0) * 2.0;

                let t = [n1_x, n1_y, n1_z];

                let n2_x = (d_px[0] as f32 / 255.0) * -2.0 + 1.0;
                let n2_y = (d_px[1] as f32 / 255.0) * -2.0 + 1.0;
                let n2_z = (d_px[2] as f32 / 255.0) * 2.0 - 1.0;

                let u = [n2_x, n2_y, n2_z];

                let dot_tu = t[0] * u[0] + t[1] * u[1] + t[2] * u[2];
                let tz = t[2];

                let r = [
                    t[0] * dot_tu - u[0] * tz,
                    t[1] * dot_tu - u[1] * tz,
                    t[2] * dot_tu - u[2] * tz,
                ];

                let len = (r[0] * r[0] + r[1] * r[1] + r[2] * r[2]).sqrt();
                let (nx, ny, nz) = if len > 1e-6 {
                    (r[0] / len, r[1] / len, r[2] / len)
                } else {
                    (0.0, 0.0, 1.0)
                };

                px[0] = ((nx * 0.5 + 0.5) * 255.0).round().clamp(0.0, 255.0) as u8;
                px[1] = ((ny * 0.5 + 0.5) * 255.0).round().clamp(0.0, 255.0) as u8;
                px[2] = ((nz * 0.5 + 0.5) * 255.0).round().clamp(0.0, 255.0) as u8;
                px[3] = b_px[3];
            });
        });

    out
}

/// Component-wise linear interpolation between base $A$ and layer $B$ with optional mask and opacity.
///
/// $$\text{weight} = \text{clamp}(\text{opacity} \times \text{mask}, 0.0, 1.0)$$
/// $$\text{Result} = A \times (1.0 - \text{weight}) + B_{blended} \times \text{weight}$$
pub fn blend_layers(
    base: &TextureBuffer,
    layer: &TextureBuffer,
    mask: Option<&TextureBuffer>,
    opacity: f32,
    mode: BlendMode,
) -> TextureBuffer {
    let width = base.width.max(layer.width);
    let height = base.height.max(layer.height);
    let opacity = opacity.clamp(0.0, 1.0);

    let mut out = TextureBuffer::new(width, height);
    let out_raw = out.image.as_mut();
    let row_stride = (width * 4) as usize;

    out_raw
        .par_chunks_exact_mut(row_stride)
        .enumerate()
        .for_each(|(y_idx, row)| {
            let y = y_idx as u32;
            row.chunks_exact_mut(4).enumerate().for_each(|(x_idx, px)| {
                let x = x_idx as u32;

                let a_px = base.get_pixel(
                    if base.width == width { x } else { (x * base.width) / width },
                    if base.height == height { y } else { (y * base.height) / height },
                );
                let b_px = layer.get_pixel(
                    if layer.width == width { x } else { (x * layer.width) / width },
                    if layer.height == height { y } else { (y * layer.height) / height },
                );

                let mask_val = if let Some(m) = mask {
                    let mx = if m.width == width { x } else { (x * m.width) / width };
                    let my = if m.height == height { y } else { (y * m.height) / height };
                    m.get_sample(mx, my, 0) as f32 / 255.0
                } else {
                    1.0
                };

                let weight = (opacity * mask_val).clamp(0.0, 1.0);

                for c in 0..3 {
                    let a_norm = a_px[c] as f32 / 255.0;
                    let b_norm = b_px[c] as f32 / 255.0;
                    let blended_b = mode.blend_component(a_norm, b_norm);
                    let result_norm = a_norm * (1.0 - weight) + blended_b * weight;
                    px[c] = (result_norm * 255.0 + 0.5).clamp(0.0, 255.0) as u8;
                }

                // Preserve or lerp alpha
                let a_alpha = a_px[3] as f32 / 255.0;
                let b_alpha = b_px[3] as f32 / 255.0;
                let res_alpha = a_alpha * (1.0 - weight) + b_alpha * weight;
                px[3] = (res_alpha * 255.0 + 0.5).clamp(0.0, 255.0) as u8;
            });
        });

    out
}

/// Executes a `NormalBlendRNM` node.
pub fn execute_normal_blend_rnm(
    _node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let base = inputs.get("base").or_else(|| inputs.get("A")).or_else(|| inputs.get("N1"));
    let detail = inputs.get("detail").or_else(|| inputs.get("B")).or_else(|| inputs.get("N2"));

    let mut outputs = HashMap::new();

    match (base, detail) {
        (Some(b), Some(d)) => {
            let blended = blend_normals_rnm(b.as_ref(), d.as_ref());
            let shared = Arc::new(blended);
            outputs.insert("output".to_string(), Arc::clone(&shared));
            outputs.insert("out".to_string(), shared);
        }
        (Some(b), None) => {
            outputs.insert("output".to_string(), Arc::clone(b));
            outputs.insert("out".to_string(), Arc::clone(b));
        }
        (None, Some(d)) => {
            outputs.insert("output".to_string(), Arc::clone(d));
            outputs.insert("out".to_string(), Arc::clone(d));
        }
        (None, None) => {
            let flat = Arc::new(TextureBuffer::solid_color(resolution.0, resolution.1, 128, 128, 255, 255));
            outputs.insert("output".to_string(), flat);
        }
    }

    Ok(outputs)
}

/// Executes a `LayerBlend` node.
pub fn execute_layer_blend(
    node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let base = inputs.get("base").or_else(|| inputs.get("A")).or_else(|| inputs.get("input1"));
    let layer = inputs.get("layer").or_else(|| inputs.get("B")).or_else(|| inputs.get("input2"));
    let mask = inputs.get("mask").or_else(|| inputs.get("M"));

    let opacity = node.get_float("opacity", 1.0);
    let mode_str = node.get_string("mode", "Normal");
    let mode = BlendMode::from_str_loose(&mode_str);

    let mut outputs = HashMap::new();

    match (base, layer) {
        (Some(b), Some(l)) => {
            let blended = blend_layers(b.as_ref(), l.as_ref(), mask.map(|m| m.as_ref()), opacity, mode);
            let shared = Arc::new(blended);
            outputs.insert("output".to_string(), Arc::clone(&shared));
            outputs.insert("out".to_string(), shared);
        }
        (Some(b), None) => {
            outputs.insert("output".to_string(), Arc::clone(b));
        }
        (None, Some(l)) => {
            outputs.insert("output".to_string(), Arc::clone(l));
        }
        (None, None) => {
            let blank = Arc::new(TextureBuffer::new(resolution.0, resolution.1));
            outputs.insert("output".to_string(), blank);
        }
    }

    Ok(outputs)
}

#[cfg(test)]
pub mod tests {
    use super::*;

    /// P3-T6 Acceptance & TC-303: Normal Blend RNM Orthogonality
    #[test]
    pub fn test_normal_blend_rnm() {
        // Flat normal: (128, 128, 255) represents (0, 0, 1)
        let base_flat = TextureBuffer::solid_color(16, 16, 128, 128, 255, 255);
        // Tilted normalized detail normal: pointing slanted in X with (nx=0.6, ny=0.0, nz=0.8) -> (204, 128, 230)
        let detail_tilted = TextureBuffer::solid_color(16, 16, 204, 128, 230, 255);

        let blended = blend_normals_rnm(&base_flat, &detail_tilted);
        let px = blended.get_pixel(0, 0);

        // Blending flat base with tilted detail preserves tilted detail normal
        assert!((px[0] as i32 - 204).abs() <= 2);
        assert!((px[1] as i32 - 128).abs() <= 2);
        assert!((px[2] as i32 - 230).abs() <= 2);
        // Crucial RNM property: Z is never squashed to 0
        assert!(px[2] > 200);

        // Verify unit length property of result
        let nx = (px[0] as f32 / 255.0) * 2.0 - 1.0;
        let ny = (px[1] as f32 / 255.0) * 2.0 - 1.0;
        let nz = (px[2] as f32 / 255.0) * 2.0 - 1.0;
        let len = (nx * nx + ny * ny + nz * nz).sqrt();
        assert!((len - 1.0).abs() < 0.05);
    }

    /// P3-T7 Acceptance: Layer Blend (Lerp) 50% opacity blend of white and black produces 128 gray
    #[test]
    pub fn test_layer_blend_lerp_50_percent() {
        let white = TextureBuffer::solid_color(16, 16, 255, 255, 255, 255);
        let black = TextureBuffer::solid_color(16, 16, 0, 0, 0, 255);

        let blended = blend_layers(&white, &black, None, 0.5, BlendMode::Normal);
        let px = blended.get_pixel(0, 0);

        assert_eq!(px[0], 128);
        assert_eq!(px[1], 128);
        assert_eq!(px[2], 128);
        assert_eq!(px[3], 255);
    }

    #[test]
    pub fn test_layer_blend_with_mask() {
        let white = TextureBuffer::solid_color(16, 16, 255, 255, 255, 255);
        let red = TextureBuffer::solid_color(16, 16, 255, 0, 0, 255);
        let mask = TextureBuffer::solid_color(16, 16, 128, 128, 128, 255); // ~50% mask (128/255 ≈ 0.502)

        let blended = blend_layers(&white, &red, Some(&mask), 1.0, BlendMode::Normal);
        let px = blended.get_pixel(0, 0);

        assert_eq!(px[0], 255);
        assert!((px[1] as i32 - 128).abs() <= 1); // Green blended from 255 to 0 at ~50% -> 127/128
        assert!((px[2] as i32 - 128).abs() <= 1);
    }
}
