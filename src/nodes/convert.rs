//! Format Conversion Nodes (Phase 3).
//!
//! Provides `SpecGlossToMetalRough` converting legacy Specular/Glossiness workflow
//! textures into modern Metallic/Roughness PBR textures using Rayon parallel execution.

use crate::core::buffer::{SharedTextureBuffer, TextureBuffer};
use crate::graph::evaluator::EvaluationError;
use crate::graph::model::{Node, NodeParam};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Configuration payload for a `SpecGlossToMetalRough` node.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SpecGlossToMetalRoughNodeData {
    /// Metallic threshold (0.0..=1.0) for standard binary specular approximation (default 0.5).
    pub threshold: f32,
    /// When true, uses continuous linear ramp approximation instead of binary threshold.
    pub continuous: bool,
}

impl Default for SpecGlossToMetalRoughNodeData {
    fn default() -> Self {
        Self {
            threshold: 0.5,
            continuous: false,
        }
    }
}

impl SpecGlossToMetalRoughNodeData {
    pub fn new(threshold: f32, continuous: bool) -> Self {
        Self {
            threshold,
            continuous,
        }
    }

    pub fn from_node(node: &Node) -> Self {
        Self {
            threshold: node.get_float("threshold", 0.5),
            continuous: node.get_bool("continuous", false),
        }
    }

    pub fn apply_to_node(&self, node: &mut Node) {
        node.set_param("threshold", NodeParam::Float(self.threshold));
        node.set_param("continuous", NodeParam::Bool(self.continuous));
    }
}

/// Converts Specular/Glossiness texture inputs into Metallic/Roughness outputs.
///
/// Output buffers: `(base_color, metallic, roughness)`.
///
/// # Conversion Algorithm:
/// - `roughness` = $1.0 - \text{glossiness}$ (per-pixel grayscale)
/// - `metallic` = $\max(\text{specular.r}, \text{specular.g}, \text{specular.b}) > \text{threshold} \ ? \ 1.0 : 0.0$
/// - `base_color` = $\text{lerp}(\text{diffuse}, \text{specular}, \text{metallic})$
#[allow(clippy::chunks_exact_to_as_chunks)]
pub fn convert_spec_gloss_to_metal_rough(
    diffuse: Option<&TextureBuffer>,
    specular: Option<&TextureBuffer>,
    glossiness: Option<&TextureBuffer>,
    threshold: f32,
    continuous: bool,
    width: u32,
    height: u32,
) -> (TextureBuffer, TextureBuffer, TextureBuffer) {
    let mut base_buf = TextureBuffer::new(width, height);
    let mut metal_buf = TextureBuffer::new(width, height);
    let mut rough_buf = TextureBuffer::new(width, height);

    let d_broadcast = diffuse.and_then(|b| if b.is_broadcast() { Some(b.broadcast_pixel()) } else { None });
    let s_broadcast = specular.and_then(|b| if b.is_broadcast() { Some(b.broadcast_pixel()) } else { None });
    let g_broadcast = glossiness.and_then(|b| if b.is_broadcast() { Some(b.broadcast_pixel()) } else { None });

    let row_stride = (width * 4) as usize;
    let base_slice = base_buf.image.as_mut();
    let metal_slice = metal_buf.image.as_mut();
    let rough_slice = rough_buf.image.as_mut();

    base_slice
        .par_chunks_exact_mut(row_stride)
        .zip(metal_slice.par_chunks_exact_mut(row_stride))
        .zip(rough_slice.par_chunks_exact_mut(row_stride))
        .enumerate()
        .for_each(|(y_idx, ((base_row, metal_row), rough_row))| {
            let y = y_idx as u32;
            base_row
                .chunks_exact_mut(4)
                .zip(metal_row.chunks_exact_mut(4))
                .zip(rough_row.chunks_exact_mut(4))
                .enumerate()
                .for_each(|(x_idx, ((b_px, m_px), r_px))| {
                    let x = x_idx as u32;

                    let d_pixel = if let Some(p) = d_broadcast {
                        p
                    } else if let Some(buf) = diffuse {
                        let sx = if buf.width == width { x } else { (x * buf.width) / width };
                        let sy = if buf.height == height { y } else { (y * buf.height) / height };
                        buf.get_pixel(sx, sy)
                    } else {
                        [0, 0, 0, 255]
                    };

                    let s_pixel = if let Some(p) = s_broadcast {
                        p
                    } else if let Some(buf) = specular {
                        let sx = if buf.width == width { x } else { (x * buf.width) / width };
                        let sy = if buf.height == height { y } else { (y * buf.height) / height };
                        buf.get_pixel(sx, sy)
                    } else {
                        [0, 0, 0, 255]
                    };

                    let g_val = if let Some(p) = g_broadcast {
                        p[0] as f32 / 255.0
                    } else if let Some(buf) = glossiness {
                        let sx = if buf.width == width { x } else { (x * buf.width) / width };
                        let sy = if buf.height == height { y } else { (y * buf.height) / height };
                        buf.get_sample(sx, sy, 0) as f32 / 255.0
                    } else {
                        0.5
                    };

                    // 1. Roughness = 1.0 - Glossiness
                    let rough_f = (1.0 - g_val).clamp(0.0, 1.0);
                    let rough_u8 = (rough_f * 255.0 + 0.5).clamp(0.0, 255.0) as u8;
                    r_px[0] = rough_u8;
                    r_px[1] = rough_u8;
                    r_px[2] = rough_u8;
                    r_px[3] = 255;

                    // 2. Metallic = max(specular.r, specular.g, specular.b) > threshold ? 1.0 : 0.0
                    let s_r = s_pixel[0] as f32 / 255.0;
                    let s_g = s_pixel[1] as f32 / 255.0;
                    let s_b = s_pixel[2] as f32 / 255.0;
                    let max_spec = s_r.max(s_g).max(s_b);

                    let metal_f = if continuous {
                        // Substance continuous approximation: ramp from dielectric F0 (~0.04) to metal (>0.5)
                        ((max_spec - 0.04) / (0.5 - 0.04)).clamp(0.0, 1.0)
                    } else if max_spec > threshold {
                        1.0
                    } else {
                        0.0
                    };

                    let metal_u8 = (metal_f * 255.0 + 0.5).clamp(0.0, 255.0) as u8;
                    m_px[0] = metal_u8;
                    m_px[1] = metal_u8;
                    m_px[2] = metal_u8;
                    m_px[3] = 255;

                    // 3. Base Color = lerp(diffuse, specular, metallic)
                    let d_r = d_pixel[0] as f32 / 255.0;
                    let d_g = d_pixel[1] as f32 / 255.0;
                    let d_b = d_pixel[2] as f32 / 255.0;

                    let bc_r = (d_r * (1.0 - metal_f) + s_r * metal_f) * 255.0 + 0.5;
                    let bc_g = (d_g * (1.0 - metal_f) + s_g * metal_f) * 255.0 + 0.5;
                    let bc_b = (d_b * (1.0 - metal_f) + s_b * metal_f) * 255.0 + 0.5;

                    b_px[0] = bc_r.clamp(0.0, 255.0) as u8;
                    b_px[1] = bc_g.clamp(0.0, 255.0) as u8;
                    b_px[2] = bc_b.clamp(0.0, 255.0) as u8;
                    b_px[3] = d_pixel[3];
                });
        });

    (base_buf, metal_buf, rough_buf)
}

/// Executes a `SpecGlossToMetalRough` node.
pub fn execute_spec_gloss_to_metal_rough(
    node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let diffuse = inputs
        .get("diffuse")
        .or_else(|| inputs.get("Diffuse"))
        .or_else(|| inputs.get("albedo"))
        .or_else(|| inputs.get("Albedo"))
        .or_else(|| inputs.get("color"))
        .or_else(|| inputs.get("Color"))
        .or_else(|| inputs.get("base"))
        .or_else(|| inputs.get("input"));

    let specular = inputs
        .get("specular")
        .or_else(|| inputs.get("Specular"))
        .or_else(|| inputs.get("spec"))
        .or_else(|| inputs.get("Spec"));

    let glossiness = inputs
        .get("glossiness")
        .or_else(|| inputs.get("Glossiness"))
        .or_else(|| inputs.get("gloss"))
        .or_else(|| inputs.get("Gloss"))
        .or_else(|| inputs.get("smoothness"));

    let data = SpecGlossToMetalRoughNodeData::from_node(node);

    let mut width = resolution.0;
    let mut height = resolution.1;

    for buf in [diffuse, specular, glossiness].into_iter().flatten() {
        if !buf.is_broadcast() {
            width = width.max(buf.width);
            height = height.max(buf.height);
        }
    }
    if width == 0 {
        width = 1;
    }
    if height == 0 {
        height = 1;
    }

    let (base_buf, metal_buf, rough_buf) = convert_spec_gloss_to_metal_rough(
        diffuse.map(|b| b.as_ref()),
        specular.map(|b| b.as_ref()),
        glossiness.map(|b| b.as_ref()),
        data.threshold,
        data.continuous,
        width,
        height,
    );

    let base_shared = Arc::new(base_buf);
    let metal_shared = Arc::new(metal_buf);
    let rough_shared = Arc::new(rough_buf);

    let mut outputs = HashMap::new();
    outputs.insert("base_color".to_string(), Arc::clone(&base_shared));
    outputs.insert("BaseColor".to_string(), Arc::clone(&base_shared));
    outputs.insert("output".to_string(), base_shared);

    outputs.insert("metallic".to_string(), Arc::clone(&metal_shared));
    outputs.insert("Metallic".to_string(), metal_shared);

    outputs.insert("roughness".to_string(), Arc::clone(&rough_shared));
    outputs.insert("Roughness".to_string(), rough_shared);

    Ok(outputs)
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::graph::model::NodeId;

    /// Verification: solid white specular + 0 glossiness -> roughness = 1.0, metallic = 1.0
    #[test]
    pub fn test_spec_gloss_white_spec_zero_gloss() {
        let node = Node::new(
            NodeId(1),
            "SpecGlossToMetalRough",
            "Spec to Metal",
            [0.0, 0.0],
        );

        let mut inputs = HashMap::new();
        let white_spec = Arc::new(TextureBuffer::solid_color(16, 16, 255, 255, 255, 255));
        let zero_gloss = Arc::new(TextureBuffer::solid_color(16, 16, 0, 0, 0, 255));
        let diffuse = Arc::new(TextureBuffer::solid_color(16, 16, 128, 64, 32, 255));

        inputs.insert("specular".to_string(), white_spec);
        inputs.insert("glossiness".to_string(), zero_gloss);
        inputs.insert("diffuse".to_string(), diffuse);

        let outputs = execute_spec_gloss_to_metal_rough(&node, &inputs, (16, 16)).unwrap();

        let rough = outputs.get("roughness").expect("roughness output must exist");
        let metal = outputs.get("metallic").expect("metallic output must exist");
        let base_color = outputs.get("base_color").expect("base_color output must exist");

        // Roughness must be 1.0 (255)
        let r_px = rough.get_pixel(0, 0);
        assert_eq!(r_px[0], 255, "0 glossiness must yield 1.0 (255) roughness");
        assert_eq!(r_px[1], 255);
        assert_eq!(r_px[2], 255);
        assert_eq!(r_px[3], 255);

        // Metallic must be 1.0 (255)
        let m_px = metal.get_pixel(0, 0);
        assert_eq!(m_px[0], 255, "White specular must yield 1.0 (255) metallic");
        assert_eq!(m_px[1], 255);
        assert_eq!(m_px[2], 255);
        assert_eq!(m_px[3], 255);

        // Base color must lerp to specular (white: 255, 255, 255) when metallic is 1.0
        let bc_px = base_color.get_pixel(0, 0);
        assert_eq!(bc_px[0], 255);
        assert_eq!(bc_px[1], 255);
        assert_eq!(bc_px[2], 255);
    }

    /// Verification: black specular -> metallic = 0.0
    #[test]
    pub fn test_spec_gloss_black_spec() {
        let node = Node::new(
            NodeId(2),
            "SpecGlossToMetalRough",
            "Spec to Metal",
            [0.0, 0.0],
        );

        let mut inputs = HashMap::new();
        let black_spec = Arc::new(TextureBuffer::solid_color(8, 8, 0, 0, 0, 255));
        let diffuse = Arc::new(TextureBuffer::solid_color(8, 8, 200, 100, 50, 255));
        let full_gloss = Arc::new(TextureBuffer::solid_color(8, 8, 255, 255, 255, 255));

        inputs.insert("specular".to_string(), black_spec);
        inputs.insert("diffuse".to_string(), diffuse);
        inputs.insert("glossiness".to_string(), full_gloss);

        let outputs = execute_spec_gloss_to_metal_rough(&node, &inputs, (8, 8)).unwrap();

        let metal = outputs.get("metallic").expect("metallic output must exist");
        let rough = outputs.get("roughness").expect("roughness output must exist");
        let base_color = outputs.get("base_color").expect("base_color output must exist");

        // Metallic must be 0.0 (0)
        let m_px = metal.get_pixel(0, 0);
        assert_eq!(m_px[0], 0, "Black specular must yield 0.0 (0) metallic");
        assert_eq!(m_px[1], 0);
        assert_eq!(m_px[2], 0);

        // Roughness must be 0.0 (0) with 1.0 glossiness
        let r_px = rough.get_pixel(0, 0);
        assert_eq!(r_px[0], 0, "1.0 glossiness must yield 0.0 roughness");

        // Base color must equal diffuse (200, 100, 50) when metallic is 0.0
        let bc_px = base_color.get_pixel(0, 0);
        assert_eq!(bc_px[0], 200);
        assert_eq!(bc_px[1], 100);
        assert_eq!(bc_px[2], 50);
        assert_eq!(bc_px[3], 255);
    }

    #[test]
    pub fn test_spec_gloss_threshold_tuning() {
        let mut node = Node::new(
            NodeId(3),
            "SpecGlossToMetalRough",
            "Spec to Metal",
            [0.0, 0.0],
        );
        // Custom threshold = 0.8
        node.set_param("threshold", NodeParam::Float(0.8));

        let mut inputs = HashMap::new();
        // Specular is 0.6 (153/255), which is > 0.5 standard threshold, but <= 0.8 custom threshold
        let mid_spec = Arc::new(TextureBuffer::solid_color(4, 4, 153, 153, 153, 255));
        inputs.insert("specular".to_string(), mid_spec);

        let outputs = execute_spec_gloss_to_metal_rough(&node, &inputs, (4, 4)).unwrap();
        let metal = outputs.get("metallic").unwrap();
        // Since 0.6 <= 0.8, metallic must be 0
        assert_eq!(metal.get_pixel(0, 0)[0], 0);

        // Lower threshold to 0.4
        node.set_param("threshold", NodeParam::Float(0.4));
        let outputs2 = execute_spec_gloss_to_metal_rough(&node, &inputs, (4, 4)).unwrap();
        let metal2 = outputs2.get("metallic").unwrap();
        // Since 0.6 > 0.4, metallic must be 255
        assert_eq!(metal2.get_pixel(0, 0)[0], 255);
    }

    #[test]
    pub fn test_spec_gloss_continuous_mode() {
        let mut node = Node::new(
            NodeId(4),
            "SpecGlossToMetalRough",
            "Spec to Metal",
            [0.0, 0.0],
        );
        node.set_param("continuous", NodeParam::Bool(true));

        let mut inputs = HashMap::new();
        // Dielectric F0 = ~0.04 (approx 10/255)
        let dielectric = Arc::new(TextureBuffer::solid_color(4, 4, 10, 10, 10, 255));
        inputs.insert("specular".to_string(), dielectric);

        let outputs = execute_spec_gloss_to_metal_rough(&node, &inputs, (4, 4)).unwrap();
        let metal = outputs.get("metallic").unwrap();
        assert_eq!(metal.get_pixel(0, 0)[0], 0, "Dielectric F0 ~0.04 should yield 0 metallic in continuous mode");

        // High spec = ~0.5+ (130/255)
        let metal_spec = Arc::new(TextureBuffer::solid_color(4, 4, 130, 130, 130, 255));
        inputs.insert("specular".to_string(), metal_spec);
        let outputs2 = execute_spec_gloss_to_metal_rough(&node, &inputs, (4, 4)).unwrap();
        let metal2 = outputs2.get("metallic").unwrap();
        assert_eq!(metal2.get_pixel(0, 0)[0], 255, "Specular >= 0.5 should saturate to 255 metallic");
    }
}
