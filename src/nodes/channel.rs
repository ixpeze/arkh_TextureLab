//! Channel Packing, Splitting, and Routing Operations (Phase 3).
//!
//! Provides `ChannelCombiner` (Pack R,G,B,A), `ChannelSplitter` (Unpack RGBA),
//! and `ChannelMixer` (4-row swizzle matrix with invert and constant fallbacks)
//! using Rayon row-chunked parallel execution.

use crate::core::buffer::{SharedTextureBuffer, TextureBuffer};
use crate::graph::evaluator::EvaluationError;
use crate::graph::model::{Node, NodeParam};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Source channel selector for swizzle routing.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ChannelSelector {
    R,
    G,
    B,
    A,
    Luminance,
    Constant,
}

impl Default for ChannelSelector {
    fn default() -> Self {
        Self::R
    }
}

impl ChannelSelector {
    pub fn from_str_loose(s: &str) -> Self {
        match s.trim().to_uppercase().as_str() {
            "G" | "GREEN" | "1" => Self::G,
            "B" | "BLUE" | "2" => Self::B,
            "A" | "ALPHA" | "3" => Self::A,
            "L" | "LUM" | "LUMINANCE" => Self::Luminance,
            "CONST" | "CONSTANT" | "FALLBACK" | "NONE" => Self::Constant,
            _ => Self::R,
        }
    }

    pub fn to_index(&self) -> usize {
        match self {
            Self::R => 0,
            Self::G => 1,
            Self::B => 2,
            Self::A => 3,
            Self::Luminance => 0,
            Self::Constant => 0,
        }
    }
}

/// A single routing row within the 4-row Channel Mixer matrix.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ChannelMixerRow {
    /// Target input socket name (e.g. "input", "in", "A", "B").
    pub source_input: String,
    /// Channel selector from source (R, G, B, A, or Luminance).
    pub source_channel: ChannelSelector,
    /// Constant fallback scalar (0.0..1.0) when source socket is unconnected.
    pub fallback: f32,
    /// Whether to invert the value (1.0 - x).
    pub invert: bool,
}

impl ChannelMixerRow {
    pub fn new(source_input: impl Into<String>, source_channel: ChannelSelector) -> Self {
        Self {
            source_input: source_input.into(),
            source_channel,
            fallback: 0.0,
            invert: false,
        }
    }

    pub fn with_fallback(mut self, fallback: f32) -> Self {
        self.fallback = fallback;
        self
    }

    pub fn with_invert(mut self, invert: bool) -> Self {
        self.invert = invert;
        self
    }

    /// Evaluates a single sample from input buffers or fallback constant.
    #[inline(always)]
    pub fn sample(
        &self,
        inputs: &HashMap<String, SharedTextureBuffer>,
        x: u32,
        y: u32,
        target_w: u32,
        target_h: u32,
    ) -> u8 {
        let src_buf = inputs.get(&self.source_input).or_else(|| {
            // Flexible socket fallback alias
            if self.source_input == "input" || self.source_input == "in" {
                inputs.get("RGBA").or_else(|| inputs.values().next())
            } else {
                None
            }
        });

        let raw_val = if self.source_channel == ChannelSelector::Constant {
            (self.fallback * 255.0).clamp(0.0, 255.0) as u8
        } else if let Some(buf) = src_buf {
            let sx = if buf.width == target_w { x } else { (x * buf.width) / target_w };
            let sy = if buf.height == target_h { y } else { (y * buf.height) / target_h };
            match self.source_channel {
                ChannelSelector::R => buf.get_sample(sx, sy, 0),
                ChannelSelector::G => buf.get_sample(sx, sy, 1),
                ChannelSelector::B => buf.get_sample(sx, sy, 2),
                ChannelSelector::A => buf.get_sample(sx, sy, 3),
                ChannelSelector::Luminance => {
                    let px = buf.get_pixel(sx, sy);
                    let lum = 0.2126 * (px[0] as f32) + 0.7152 * (px[1] as f32) + 0.0722 * (px[2] as f32);
                    lum.round().clamp(0.0, 255.0) as u8
                }
                ChannelSelector::Constant => (self.fallback * 255.0).clamp(0.0, 255.0) as u8,
            }
        } else {
            (self.fallback * 255.0).clamp(0.0, 255.0) as u8
        };

        if self.invert {
            255 - raw_val
        } else {
            raw_val
        }
    }
}

/// 4-row routing configuration for `ChannelMixer`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ChannelMixerNodeData {
    pub r_row: ChannelMixerRow,
    pub g_row: ChannelMixerRow,
    pub b_row: ChannelMixerRow,
    pub a_row: ChannelMixerRow,
}

impl Default for ChannelMixerNodeData {
    fn default() -> Self {
        Self {
            r_row: ChannelMixerRow::new("input", ChannelSelector::R),
            g_row: ChannelMixerRow::new("input", ChannelSelector::G),
            b_row: ChannelMixerRow::new("input", ChannelSelector::B),
            a_row: ChannelMixerRow::new("input", ChannelSelector::A).with_fallback(1.0),
        }
    }
}

impl ChannelMixerNodeData {
    pub fn new() -> Self {
        Self::default()
    }

    /// Swizzle to BGRA (commonly required for graphics pipelines).
    pub fn bgra() -> Self {
        Self {
            r_row: ChannelMixerRow::new("input", ChannelSelector::B),
            g_row: ChannelMixerRow::new("input", ChannelSelector::G),
            b_row: ChannelMixerRow::new("input", ChannelSelector::R),
            a_row: ChannelMixerRow::new("input", ChannelSelector::A).with_fallback(1.0),
        }
    }

    pub fn apply_to_node(&self, node: &mut Node) {
        node.set_param("r_src", NodeParam::String(format!("{:?}", self.r_row.source_channel)));
        node.set_param("g_src", NodeParam::String(format!("{:?}", self.g_row.source_channel)));
        node.set_param("b_src", NodeParam::String(format!("{:?}", self.b_row.source_channel)));
        node.set_param("a_src", NodeParam::String(format!("{:?}", self.a_row.source_channel)));
        node.set_param("r_invert", NodeParam::Bool(self.r_row.invert));
        node.set_param("g_invert", NodeParam::Bool(self.g_row.invert));
        node.set_param("b_invert", NodeParam::Bool(self.b_row.invert));
        node.set_param("a_invert", NodeParam::Bool(self.a_row.invert));
        node.set_param("r_fallback", NodeParam::Float(self.r_row.fallback));
        node.set_param("g_fallback", NodeParam::Float(self.g_row.fallback));
        node.set_param("b_fallback", NodeParam::Float(self.b_row.fallback));
        node.set_param("a_fallback", NodeParam::Float(self.a_row.fallback));
    }

    pub fn from_node(node: &Node) -> Self {
        let r_src = ChannelSelector::from_str_loose(&node.get_string("r_src", "R"));
        let g_src = ChannelSelector::from_str_loose(&node.get_string("g_src", "G"));
        let b_src = ChannelSelector::from_str_loose(&node.get_string("b_src", "B"));
        let a_src = ChannelSelector::from_str_loose(&node.get_string("a_src", "A"));

        let r_input = node.get_string("r_input", "input");
        let g_input = node.get_string("g_input", "input");
        let b_input = node.get_string("b_input", "input");
        let a_input = node.get_string("a_input", "input");

        let r_row = ChannelMixerRow::new(r_input, r_src)
            .with_fallback(node.get_float("r_fallback", 0.0))
            .with_invert(node.get_bool("r_invert", false));
        let g_row = ChannelMixerRow::new(g_input, g_src)
            .with_fallback(node.get_float("g_fallback", 0.0))
            .with_invert(node.get_bool("g_invert", false));
        let b_row = ChannelMixerRow::new(b_input, b_src)
            .with_fallback(node.get_float("b_fallback", 0.0))
            .with_invert(node.get_bool("b_invert", false));
        let a_row = ChannelMixerRow::new(a_input, a_src)
            .with_fallback(node.get_float("a_fallback", 1.0))
            .with_invert(node.get_bool("a_invert", false));

        Self {
            r_row,
            g_row,
            b_row,
            a_row,
        }
    }
}

/// Helper struct for packing channels into an RGBA texture.
pub struct ChannelCombiner;

impl ChannelCombiner {
    /// Packs independent channel buffers into a single RGBA buffer with Rayon parallelization.
    pub fn combine(
        r: Option<&TextureBuffer>,
        g: Option<&TextureBuffer>,
        b: Option<&TextureBuffer>,
        a: Option<&TextureBuffer>,
        fallback: [u8; 4],
        width: u32,
        height: u32,
    ) -> TextureBuffer {
        let mut out = TextureBuffer::new(width, height);
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
                        .map(|buf| {
                            let sx = if buf.width == width { x } else { (x * buf.width) / width };
                            let sy = if buf.height == height { y } else { (y * buf.height) / height };
                            buf.get_sample(sx, sy, 0)
                        })
                        .unwrap_or(fallback[0]);

                    px[1] = g
                        .map(|buf| {
                            let sx = if buf.width == width { x } else { (x * buf.width) / width };
                            let sy = if buf.height == height { y } else { (y * buf.height) / height };
                            // If input is single-channel grayscale (R=G=B), sample 0; otherwise channel 1
                            let p = buf.get_pixel(sx, sy);
                            if p[0] == p[1] && p[1] == p[2] {
                                p[0]
                            } else {
                                p[1]
                            }
                        })
                        .unwrap_or(fallback[1]);

                    px[2] = b
                        .map(|buf| {
                            let sx = if buf.width == width { x } else { (x * buf.width) / width };
                            let sy = if buf.height == height { y } else { (y * buf.height) / height };
                            let p = buf.get_pixel(sx, sy);
                            if p[0] == p[1] && p[1] == p[2] {
                                p[0]
                            } else {
                                p[2]
                            }
                        })
                        .unwrap_or(fallback[2]);

                    px[3] = a
                        .map(|buf| {
                            let sx = if buf.width == width { x } else { (x * buf.width) / width };
                            let sy = if buf.height == height { y } else { (y * buf.height) / height };
                            let p = buf.get_pixel(sx, sy);
                            // If single-channel grayscale where R=G=B and A=255, read channel 0 (the actual value)
                            if p[0] == p[1] && p[1] == p[2] {
                                p[0]
                            } else {
                                p[3]
                            }
                        })
                        .unwrap_or(fallback[3]);
                });
            });

        out
    }
}

/// Helper struct for unpacking RGBA textures into independent channel buffers.
pub struct ChannelSplitter;

impl ChannelSplitter {
    /// Splits an RGBA buffer into 4 separate grayscale channel buffers (R, G, B, A).
    pub fn split(src: &TextureBuffer) -> (TextureBuffer, TextureBuffer, TextureBuffer, TextureBuffer) {
        src.split_channels()
    }
}

/// Executes a `ChannelCombine` / `ChannelPack` node.
pub fn execute_channel_combine(
    node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let (width, height) = resolution;
    let r_buf = inputs.get("R").or_else(|| inputs.get("r"));
    let g_buf = inputs.get("G").or_else(|| inputs.get("g"));
    let b_buf = inputs.get("B").or_else(|| inputs.get("b"));
    let a_buf = inputs.get("A").or_else(|| inputs.get("a"));

    let fallback_r = (node.get_float("fallback_r", 0.0) * 255.0).clamp(0.0, 255.0) as u8;
    let fallback_g = (node.get_float("fallback_g", 0.0) * 255.0).clamp(0.0, 255.0) as u8;
    let fallback_b = (node.get_float("fallback_b", 0.0) * 255.0).clamp(0.0, 255.0) as u8;
    let fallback_a = (node.get_float("fallback_a", 1.0) * 255.0).clamp(0.0, 255.0) as u8;

    let packed = ChannelCombiner::combine(
        r_buf.map(|b| b.as_ref()),
        g_buf.map(|b| b.as_ref()),
        b_buf.map(|b| b.as_ref()),
        a_buf.map(|b| b.as_ref()),
        [fallback_r, fallback_g, fallback_b, fallback_a],
        width,
        height,
    );

    let shared = Arc::new(packed);
    let mut outputs = HashMap::new();
    outputs.insert("output".to_string(), Arc::clone(&shared));
    outputs.insert("RGBA".to_string(), shared);

    Ok(outputs)
}

/// Executes a `ChannelSplit` / `ChannelUnpack` node.
pub fn execute_channel_split(
    _node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let (width, height) = resolution;
    let src_buf = inputs
        .get("input")
        .or_else(|| inputs.get("RGBA"))
        .or_else(|| inputs.values().next());

    let mut outputs = HashMap::new();
    if let Some(src) = src_buf {
        let (r, g, b, a) = ChannelSplitter::split(src.as_ref());
        outputs.insert("R".to_string(), Arc::new(r));
        outputs.insert("G".to_string(), Arc::new(g));
        outputs.insert("B".to_string(), Arc::new(b));
        outputs.insert("A".to_string(), Arc::new(a));
    } else {
        let black = Arc::new(TextureBuffer::new(width, height));
        let white = Arc::new(TextureBuffer::solid_color(width, height, 255, 255, 255, 255));
        outputs.insert("R".to_string(), Arc::clone(&black));
        outputs.insert("G".to_string(), Arc::clone(&black));
        outputs.insert("B".to_string(), Arc::clone(&black));
        outputs.insert("A".to_string(), white);
    }

    Ok(outputs)
}

/// Executes a `ChannelMixer` / `Swizzle` node with 4-row routing matrix.
pub fn execute_channel_mixer(
    node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let (width, height) = resolution;
    let matrix = ChannelMixerNodeData::from_node(node);

    let mut out = TextureBuffer::new(width, height);
    let out_slice = out.image.as_mut();
    let row_stride = (width * 4) as usize;

    out_slice
        .par_chunks_exact_mut(row_stride)
        .enumerate()
        .for_each(|(y_idx, row)| {
            let y = y_idx as u32;
            row.chunks_exact_mut(4).enumerate().for_each(|(x_idx, px)| {
                let x = x_idx as u32;
                px[0] = matrix.r_row.sample(inputs, x, y, width, height);
                px[1] = matrix.g_row.sample(inputs, x, y, width, height);
                px[2] = matrix.b_row.sample(inputs, x, y, width, height);
                px[3] = matrix.a_row.sample(inputs, x, y, width, height);
            });
        });

    let shared = Arc::new(out);
    let mut outputs = HashMap::new();
    outputs.insert("output".to_string(), Arc::clone(&shared));
    outputs.insert("RGBA".to_string(), shared);

    Ok(outputs)
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::graph::model::NodeId;

    /// P3-T2 Acceptance & TC-301: Channel Pack & Split Roundtrip
    #[test]
    pub fn test_combine_and_split() {
        let r_in = TextureBuffer::solid_color(64, 64, 100, 100, 100, 255);
        let g_in = TextureBuffer::solid_color(64, 64, 150, 150, 150, 255);
        let b_in = TextureBuffer::solid_color(64, 64, 200, 200, 200, 255);
        let a_in = TextureBuffer::solid_color(64, 64, 250, 250, 250, 255);

        // Pack R, G, B, A
        let packed = ChannelCombiner::combine(
            Some(&r_in),
            Some(&g_in),
            Some(&b_in),
            Some(&a_in),
            [0, 0, 0, 255],
            64,
            64,
        );

        assert_eq!(packed.get_pixel(0, 0), [100, 150, 200, 250]);
        assert_eq!(packed.get_pixel(63, 63), [100, 150, 200, 250]);

        // Split RGBA back to individual channels
        let (r_out, g_out, b_out, a_out) = ChannelSplitter::split(&packed);

        // Each extracted channel must match original inputs exactly
        assert_eq!(r_out.get_pixel(0, 0), r_in.get_pixel(0, 0));
        assert_eq!(g_out.get_pixel(0, 0), g_in.get_pixel(0, 0));
        assert_eq!(b_out.get_pixel(0, 0), b_in.get_pixel(0, 0));
        assert_eq!(a_out.get_pixel(0, 0), a_in.get_pixel(0, 0));
    }

    /// P3-T3 Acceptance & TC-302: Channel Mixer Swizzle
    #[test]
    pub fn test_mixer_swizzle() {
        let mut node = Node::new(NodeId(50), "ChannelMixer", "Swizzle", [0.0, 0.0]);
        // Swizzle: R -> B, B -> R, preserve G and A
        node.set_param("r_src", NodeParam::String("B".to_string()));
        node.set_param("g_src", NodeParam::String("G".to_string()));
        node.set_param("b_src", NodeParam::String("R".to_string()));
        node.set_param("a_src", NodeParam::String("A".to_string()));

        let mut inputs = HashMap::new();
        let src = Arc::new(TextureBuffer::solid_color(32, 32, 10, 20, 30, 40));
        inputs.insert("input".to_string(), src);

        let outputs = execute_channel_mixer(&node, &inputs, (32, 32)).unwrap();
        let out = outputs.get("output").unwrap();

        // Pixel (10, 20, 30, 40) swizzled with R<->B must yield (30, 20, 10, 40)
        assert_eq!(out.get_pixel(0, 0), [30, 20, 10, 40]);
        assert_eq!(out.get_pixel(31, 31), [30, 20, 10, 40]);
    }

    #[test]
    pub fn test_mixer_invert_and_fallback() {
        let mut node = Node::new(NodeId(51), "ChannelMixer", "Invert Red", [0.0, 0.0]);
        node.set_param("r_src", NodeParam::String("R".to_string()));
        node.set_param("r_invert", NodeParam::Bool(true));
        node.set_param("g_src", NodeParam::String("Constant".to_string()));
        node.set_param("g_fallback", NodeParam::Float(0.5));
        node.set_param("b_src", NodeParam::String("Constant".to_string()));
        node.set_param("b_fallback", NodeParam::Float(1.0));
        node.set_param("a_src", NodeParam::String("Constant".to_string()));
        node.set_param("a_fallback", NodeParam::Float(0.0));

        let mut inputs = HashMap::new();
        let src = Arc::new(TextureBuffer::solid_color(8, 8, 50, 0, 0, 255));
        inputs.insert("input".to_string(), src);

        let outputs = execute_channel_mixer(&node, &inputs, (8, 8)).unwrap();
        let out = outputs.get("output").unwrap();

        // R inverted: 255 - 50 = 205
        // G fallback: 0.5 * 255 = 127 or 128
        // B fallback: 1.0 * 255 = 255
        // A fallback: 0.0 = 0
        let px = out.get_pixel(0, 0);
        assert_eq!(px[0], 205);
        assert!((px[1] as i32 - 127).abs() <= 1);
        assert_eq!(px[2], 255);
        assert_eq!(px[3], 0);
    }
}
