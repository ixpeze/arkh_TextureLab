//! Input and Output Nodes (Phase 3).
//!
//! Provides configuration and execution for texture input (file or procedural color)
//! and texture export targets.

use crate::core::buffer::{SharedTextureBuffer, TextureBuffer};
use crate::graph::evaluator::EvaluationError;
use crate::graph::model::{Node, NodeId, NodeParam};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Supported image formats for I/O operations.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum TextureFileFormat {
    Auto,
    Png,
    Tga,
    Exr,
    Jpg,
}

impl Default for TextureFileFormat {
    fn default() -> Self {
        Self::Auto
    }
}

impl std::fmt::Display for TextureFileFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Auto => write!(f, "Auto"),
            Self::Png => write!(f, "PNG"),
            Self::Tga => write!(f, "TGA"),
            Self::Exr => write!(f, "EXR"),
            Self::Jpg => write!(f, "JPG"),
        }
    }
}

/// Bit-depth format configuration for texture buffers.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum TextureBitDepth {
    U8,
    U16,
    F32,
}

impl Default for TextureBitDepth {
    fn default() -> Self {
        Self::U8
    }
}

impl std::fmt::Display for TextureBitDepth {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::U8 => write!(f, "8-bit (U8)"),
            Self::U16 => write!(f, "16-bit (U16)"),
            Self::F32 => write!(f, "32-bit Float (F32)"),
        }
    }
}

/// Color space interpretation for texture channels.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum TextureColorSpace {
    #[serde(alias = "sRgb", alias = "sRGB")]
    SRgb,
    Linear,
}

impl Default for TextureColorSpace {
    fn default() -> Self {
        Self::SRgb
    }
}

impl std::fmt::Display for TextureColorSpace {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::SRgb => write!(f, "sRGB"),
            Self::Linear => write!(f, "Linear"),
        }
    }
}

/// Configuration payload for a `TextureInput` node.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TextureInputNodeData {
    pub file_path: Option<String>,
    pub color: [f32; 4],
    pub bit_depth: TextureBitDepth,
    pub format: TextureFileFormat,
    pub colorspace: TextureColorSpace,
}

impl Default for TextureInputNodeData {
    fn default() -> Self {
        Self {
            file_path: None,
            color: [1.0, 1.0, 1.0, 1.0],
            bit_depth: TextureBitDepth::U8,
            format: TextureFileFormat::Auto,
            colorspace: TextureColorSpace::SRgb,
        }
    }
}

impl TextureInputNodeData {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_file(file_path: impl Into<String>) -> Self {
        Self {
            file_path: Some(file_path.into()),
            ..Default::default()
        }
    }

    pub fn with_color(color: [f32; 4]) -> Self {
        Self {
            color,
            ..Default::default()
        }
    }

    pub fn apply_to_node(&self, node: &mut Node) {
        if let Some(path) = &self.file_path {
            node.set_param("file_path", NodeParam::String(path.clone()));
        }
        node.set_param("color", NodeParam::Color(self.color));
        node.set_param("bit_depth", NodeParam::String(self.bit_depth.to_string()));
        node.set_param("format", NodeParam::String(self.format.to_string()));
        node.set_param("colorspace", NodeParam::String(self.colorspace.to_string()));
    }

    pub fn from_node(node: &Node) -> Self {
        let file_path = node.get_param("file_path").and_then(|p| p.as_str()).map(ToString::to_string);
        let color = node.get_color("color", [1.0, 1.0, 1.0, 1.0]);
        let bit_depth = match node.get_string("bit_depth", "").as_str() {
            s if s.contains("16") => TextureBitDepth::U16,
            s if s.contains("32") || s.contains("F32") => TextureBitDepth::F32,
            _ => TextureBitDepth::U8,
        };
        let format = match node.get_string("format", "").as_str() {
            "PNG" => TextureFileFormat::Png,
            "TGA" => TextureFileFormat::Tga,
            "EXR" => TextureFileFormat::Exr,
            "JPG" => TextureFileFormat::Jpg,
            _ => TextureFileFormat::Auto,
        };
        let colorspace = match node.get_string("colorspace", "").as_str() {
            "Linear" => TextureColorSpace::Linear,
            _ => TextureColorSpace::SRgb,
        };

        Self {
            file_path,
            color,
            bit_depth,
            format,
            colorspace,
        }
    }
}

/// Configuration payload for a `TextureOutput` node.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TextureOutputNodeData {
    pub slot_name: String,
    pub format: TextureFileFormat,
    pub bit_depth: TextureBitDepth,
    pub colorspace: TextureColorSpace,
    pub resolution_override: Option<(u32, u32)>,
}

impl Default for TextureOutputNodeData {
    fn default() -> Self {
        Self {
            slot_name: "Albedo".to_string(),
            format: TextureFileFormat::Png,
            bit_depth: TextureBitDepth::U8,
            colorspace: TextureColorSpace::SRgb,
            resolution_override: None,
        }
    }
}

impl TextureOutputNodeData {
    pub fn new(slot_name: impl Into<String>) -> Self {
        Self {
            slot_name: slot_name.into(),
            ..Default::default()
        }
    }

    pub fn apply_to_node(&self, node: &mut Node) {
        node.set_param("slot_name", NodeParam::String(self.slot_name.clone()));
        node.set_param("format", NodeParam::String(self.format.to_string()));
        node.set_param("bit_depth", NodeParam::String(self.bit_depth.to_string()));
        node.set_param("colorspace", NodeParam::String(self.colorspace.to_string()));
        if let Some((w, h)) = self.resolution_override {
            node.set_param("resolution", NodeParam::Resolution { width: w, height: h });
        }
    }

    pub fn from_node(node: &Node) -> Self {
        let slot_name = node.get_string("slot_name", "Albedo");
        let format = match node.get_string("format", "").as_str() {
            "TGA" => TextureFileFormat::Tga,
            "EXR" => TextureFileFormat::Exr,
            "JPG" => TextureFileFormat::Jpg,
            _ => TextureFileFormat::Png,
        };
        let bit_depth = match node.get_string("bit_depth", "").as_str() {
            s if s.contains("16") => TextureBitDepth::U16,
            s if s.contains("32") || s.contains("F32") => TextureBitDepth::F32,
            _ => TextureBitDepth::U8,
        };
        let colorspace = match node.get_string("colorspace", "").as_str() {
            "Linear" => TextureColorSpace::Linear,
            _ => TextureColorSpace::SRgb,
        };
        let resolution_override = node.get_param("resolution").and_then(|p| p.as_resolution());

        Self {
            slot_name,
            format,
            bit_depth,
            colorspace,
            resolution_override,
        }
    }
}

/// Executes a `TextureInput` node.
pub fn execute_texture_input(
    node: &Node,
    custom_inputs: &HashMap<NodeId, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let (width, height) = resolution;
    let mut outputs = HashMap::new();

    let buf: SharedTextureBuffer = if let Some(custom) = custom_inputs.get(&node.id) {
        Arc::clone(custom)
    } else if let Some(path_str) = node.get_param("file_path").and_then(|p| p.as_str()) {
        let path = std::path::Path::new(path_str);
        if path.exists() {
            match crate::export::codecs::load_image(path) {
                Ok(loaded) => Arc::new(loaded),
                Err(e) => {
                    return Err(EvaluationError::Execution(format!(
                        "Failed to load image from {:?}: {}",
                        path_str, e
                    )));
                }
            }
        } else {
            // Path specified but missing on disk -> generate color fallback with warning
            let color = node.get_color("color", [1.0, 1.0, 1.0, 1.0]);
            let solid = TextureBuffer::solid_color(
                width,
                height,
                (color[0] * 255.0).clamp(0.0, 255.0) as u8,
                (color[1] * 255.0).clamp(0.0, 255.0) as u8,
                (color[2] * 255.0).clamp(0.0, 255.0) as u8,
                (color[3] * 255.0).clamp(0.0, 255.0) as u8,
            );
            Arc::new(solid)
        }
    } else {
        let color = node.get_color("color", [1.0, 1.0, 1.0, 1.0]);
        let solid = TextureBuffer::solid_color(
            width,
            height,
            (color[0] * 255.0).clamp(0.0, 255.0) as u8,
            (color[1] * 255.0).clamp(0.0, 255.0) as u8,
            (color[2] * 255.0).clamp(0.0, 255.0) as u8,
            (color[3] * 255.0).clamp(0.0, 255.0) as u8,
        );
        Arc::new(solid)
    };

    outputs.insert("output".to_string(), Arc::clone(&buf));
    outputs.insert("RGBA".to_string(), Arc::clone(&buf));

    // Also supply split channels if requested by downstream edges
    if node.outputs.iter().any(|p| p.name == "R" || p.name == "G" || p.name == "B" || p.name == "A") {
        let (r, g, b, a) = buf.split_channels();
        outputs.insert("R".to_string(), Arc::new(r));
        outputs.insert("G".to_string(), Arc::new(g));
        outputs.insert("B".to_string(), Arc::new(b));
        outputs.insert("A".to_string(), Arc::new(a));
    }

    Ok(outputs)
}

/// Executes a `TextureOutput` node by passing through connected inputs and recording export metadata.
pub fn execute_texture_output(
    _node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let mut outputs = HashMap::new();
    let src = inputs
        .get("input")
        .or_else(|| inputs.get("in"))
        .or_else(|| inputs.get("RGBA"))
        .or_else(|| inputs.values().next());

    if let Some(buf) = src {
        outputs.insert("output".to_string(), Arc::clone(buf));
        outputs.insert("RGBA".to_string(), Arc::clone(buf));
    } else {
        let fallback = Arc::new(TextureBuffer::new(resolution.0, resolution.1));
        outputs.insert("output".to_string(), fallback);
    }

    Ok(outputs)
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    pub fn test_io_node_data_defaults() {
        let in_data = TextureInputNodeData::default();
        assert_eq!(in_data.bit_depth, TextureBitDepth::U8);
        assert_eq!(in_data.format, TextureFileFormat::Auto);
        assert_eq!(in_data.color, [1.0, 1.0, 1.0, 1.0]);

        let out_data = TextureOutputNodeData::new("Roughness");
        assert_eq!(out_data.slot_name, "Roughness");
        assert_eq!(out_data.format, TextureFileFormat::Png);
    }

    #[test]
    pub fn test_io_node_apply_and_from_node() {
        let mut node = Node::new(NodeId(1), "TextureInput", "Albedo Map", [0.0, 0.0]);
        let data = TextureInputNodeData {
            file_path: Some("C:/textures/albedo.png".to_string()),
            color: [0.5, 0.2, 0.1, 1.0],
            bit_depth: TextureBitDepth::U16,
            format: TextureFileFormat::Png,
            colorspace: TextureColorSpace::Linear,
        };
        data.apply_to_node(&mut node);

        let extracted = TextureInputNodeData::from_node(&node);
        assert_eq!(extracted.file_path.as_deref(), Some("C:/textures/albedo.png"));
        assert_eq!(extracted.color, [0.5, 0.2, 0.1, 1.0]);
        assert_eq!(extracted.bit_depth, TextureBitDepth::U16);
        assert_eq!(extracted.colorspace, TextureColorSpace::Linear);
    }

    #[test]
    pub fn test_execute_texture_input_solid() {
        let mut node = Node::new(NodeId(10), "TextureInput", "Test", [0.0, 0.0]);
        node.set_param("color", NodeParam::Color([0.0, 1.0, 0.0, 1.0]));
        let custom = HashMap::new();
        let res = execute_texture_input(&node, &custom, (32, 32)).unwrap();
        let out = res.get("output").unwrap();
        assert_eq!(out.width, 32);
        assert_eq!(out.height, 32);
        assert_eq!(out.get_pixel(0, 0), [0, 255, 0, 255]);
    }

    #[test]
    pub fn test_execute_texture_output_passthrough() {
        let node = Node::new(NodeId(20), "TextureOutput", "Export Normal", [100.0, 0.0]);
        let mut inputs = HashMap::new();
        let src = Arc::new(TextureBuffer::solid_color(16, 16, 128, 128, 255, 255));
        inputs.insert("input".to_string(), Arc::clone(&src));

        let res = execute_texture_output(&node, &inputs, (16, 16)).unwrap();
        let out = res.get("output").unwrap();
        assert_eq!(out.get_pixel(0, 0), [128, 128, 255, 255]);
    }
}
