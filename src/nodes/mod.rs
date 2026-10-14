//! PBR Node Catalog & Processing Math Engine (Phase 3).
//!
//! Provides all 12 canonical PBR node families in pure Rust with Rayon multithreaded execution:
//! - **I/O:** `TextureInput`, `TextureOutput`
//! - **Constants:** `ConstantScalar`, `ConstantColor`
//! - **Channel Ops:** `ChannelCombine` (Pack), `ChannelSplit` (Unpack), `ChannelMixer` (4-row Swizzle)
//! - **Color & Adjust:** `Invert`, `Levels`, `BrightnessContrast`
//! - **Normal Ops:** `NormalFlipGreen` (DirectX <-> OpenGL), `NormalNormalize`, `NormalStrength`
//! - **Blend Ops:** `LayerBlend` (Lerp with mask), `NormalBlendRNM` (Reoriented Normal Mapping)
//! - **Math:** 13 scalar and vector operations (`Add`, `Subtract`, `Multiply`, `Divide`, etc.)
//! - **Transform:** `Resize` (Power-of-Two POT enforcement, Bilinear / Lanczos3 resampling)

pub mod adjust;
pub mod blend;
pub mod channel;
pub mod constants;
pub mod io;
pub mod math;
pub mod transform;

pub use adjust::{
    apply_brightness_contrast, apply_levels, flip_normal_green, invert_buffer,
    normalize_normal_map, scale_normal_strength, LevelsNodeData,
};
pub use blend::{blend_layers, blend_normals_rnm, BlendMode};
pub use channel::{
    ChannelCombiner, ChannelMixerNodeData, ChannelMixerRow, ChannelSelector, ChannelSplitter,
};
pub use constants::{ConstantColorNodeData, ConstantScalarNodeData};
pub use io::{
    TextureBitDepth, TextureColorSpace, TextureFileFormat, TextureInputNodeData,
    TextureOutputNodeData,
};
pub use math::MathOp;
pub use transform::{
    is_pot, nearest_pot, next_pot, prev_pot, resize_buffer, round_to_pot_dimensions,
    PotRoundMode, ResizeFilter,
};

use crate::core::buffer::SharedTextureBuffer;
use crate::graph::evaluator::{EvaluationError, NodeExecutor};
use crate::graph::model::{Node, NodeId, NodeParam};
use std::collections::HashMap;
use std::sync::Arc;

/// Comprehensive PBR Node Executor implementing `NodeExecutor` for the reactive DAG engine.
pub struct PbrNodeExecutor {
    custom_inputs: HashMap<NodeId, SharedTextureBuffer>,
}

impl Default for PbrNodeExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl PbrNodeExecutor {
    pub fn new() -> Self {
        Self {
            custom_inputs: HashMap::new(),
        }
    }

    /// Registers a custom input texture for a node ID.
    pub fn set_input_texture(&mut self, node_id: NodeId, buffer: SharedTextureBuffer) {
        self.custom_inputs.insert(node_id, buffer);
    }
}

impl NodeExecutor for PbrNodeExecutor {
    fn set_input_texture(&mut self, node_id: NodeId, buffer: SharedTextureBuffer) {
        self.set_input_texture(node_id, buffer);
    }

    fn execute(
        &self,
        node: &Node,
        inputs: &HashMap<String, SharedTextureBuffer>,
        resolution: (u32, u32),
    ) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
        match node.node_type.as_str() {
            // I/O Nodes
            "TextureInput" | "Input" => io::execute_texture_input(node, &self.custom_inputs, resolution),
            "SaveImage" | "TextureOutput" | "Output" => io::execute_texture_output(node, inputs, resolution),

            // Constants
            "ConstantScalar" | "Scalar" => constants::execute_constant_scalar(node, resolution),
            "ConstantColor" | "Color" => constants::execute_constant_color(node, resolution),

            // Channel Operations
            "ChannelCombine" | "ChannelPack" | "ChannelCombiner" => {
                channel::execute_channel_combine(node, inputs, resolution)
            }
            "ChannelSplit" | "ChannelUnpack" | "ChannelSplitter" => {
                channel::execute_channel_split(node, inputs, resolution)
            }
            "ChannelMixer" | "Swizzle" => channel::execute_channel_mixer(node, inputs, resolution),

            // Adjustments
            "Invert" => adjust::execute_invert(node, inputs, resolution),
            "Levels" => adjust::execute_levels(node, inputs, resolution),
            "BrightnessContrast" | "Brightness" => {
                adjust::execute_brightness_contrast(node, inputs, resolution)
            }

            // Normal Operations
            "NormalFlipGreen" | "FlipGreen" | "NormalInvertY" => {
                adjust::execute_normal_flip_green(node, inputs, resolution)
            }
            "NormalNormalize" => adjust::execute_normal_normalize(node, inputs, resolution),
            "NormalStrength" => adjust::execute_normal_strength(node, inputs, resolution),

            // Blend Operations
            "LayerBlend" | "Blend" => blend::execute_layer_blend(node, inputs, resolution),
            "NormalBlendRNM" | "NormalBlend" | "RNM" => {
                blend::execute_normal_blend_rnm(node, inputs, resolution)
            }

            // Math Operations
            "Math" | "Add" | "Subtract" | "Multiply" | "Divide" | "Power" | "Min" | "Max"
            | "Clamp" | "Abs" | "Step" | "Smoothstep" | "Modulo" => {
                math::execute_math(node, inputs, resolution)
            }

            // Transform & Resizing
            "Resize" | "Transform" => transform::execute_resize(node, inputs, resolution),

            // Utility Nodes
            "Comment" => Ok(HashMap::new()),
            "Reroute" => {
                let mut outputs = HashMap::new();
                if let Some(buf) = inputs.get("input").or_else(|| inputs.values().next()) {
                    outputs.insert("output".to_string(), Arc::clone(buf));
                } else {
                    let blank = Arc::new(crate::core::buffer::TextureBuffer::new(resolution.0, resolution.1));
                    outputs.insert("output".to_string(), blank);
                }
                Ok(outputs)
            }

            // Fallback: Passthrough first input or empty buffer
            _ => {
                let mut outputs = HashMap::new();
                if let Some(first) = inputs.values().next() {
                    outputs.insert("output".to_string(), Arc::clone(first));
                } else {
                    let blank = Arc::new(crate::core::buffer::TextureBuffer::new(resolution.0, resolution.1));
                    outputs.insert("output".to_string(), blank);
                }
                Ok(outputs)
            }
        }
    }
}

/// Category metadata for organizing nodes in library and search palettes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NodeCategory {
    Io,
    Constants,
    ChannelOps,
    ColorAdjust,
    NormalOps,
    BlendOps,
    Math,
    Transform,
    Utility,
}

impl std::fmt::Display for NodeCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io => write!(f, "I/O"),
            Self::Constants => write!(f, "Constants"),
            Self::ChannelOps => write!(f, "Channel Operations"),
            Self::ColorAdjust => write!(f, "Color & Adjust"),
            Self::NormalOps => write!(f, "Normal Operations"),
            Self::BlendOps => write!(f, "Blend Operations"),
            Self::Math => write!(f, "Math"),
            Self::Transform => write!(f, "Transform"),
            Self::Utility => write!(f, "Utility"),
        }
    }
}

/// Rich descriptor defining canonical sockets, hotkeys, and parameters for a node type.
#[derive(Clone, Debug)]
pub struct NodeDescriptor {
    pub type_name: &'static str,
    pub display_name: &'static str,
    pub category: NodeCategory,
    pub hotkey: Option<&'static str>,
    pub default_inputs: &'static [&'static str],
    pub default_outputs: &'static [&'static str],
}

impl NodeDescriptor {
    /// Instantiates a new `Node` configured with this descriptor's default sockets.
    pub fn create_node(&self, id: NodeId, position: [f32; 2]) -> Node {
        let mut node = Node::new(id, self.type_name, self.display_name, position);
        for &input in self.default_inputs {
            node.add_input(input);
        }
        for &output in self.default_outputs {
            node.add_output(output);
        }
        if self.type_name == "Comment" {
            node.set_param("text", NodeParam::String("Comment".to_string()));
            node.set_param("width", NodeParam::Float(300.0));
            node.set_param("height", NodeParam::Float(200.0));
            node.set_param("color", NodeParam::Color([0.18, 0.22, 0.28, 0.4]));
        }
        node
    }
}

/// Master catalog defining all 12 canonical PBR node families.
pub static NODE_CATALOG: &[NodeDescriptor] = &[
    // 1. I/O
    NodeDescriptor {
        type_name: "TextureInput",
        display_name: "Texture Input",
        category: NodeCategory::Io,
        hotkey: None,
        default_inputs: &[],
        default_outputs: &["output", "RGBA", "R", "G", "B", "A"],
    },
    NodeDescriptor {
        type_name: "SaveImage",
        display_name: "Save Image",
        category: NodeCategory::Io,
        hotkey: None,
        default_inputs: &["input"],
        default_outputs: &["output"],
    },
    // 2. Constants
    NodeDescriptor {
        type_name: "ConstantScalar",
        display_name: "Constant Scalar",
        category: NodeCategory::Constants,
        hotkey: Some("1"),
        default_inputs: &[],
        default_outputs: &["output", "value"],
    },
    NodeDescriptor {
        type_name: "ConstantColor",
        display_name: "Constant Color",
        category: NodeCategory::Constants,
        hotkey: Some("3"),
        default_inputs: &[],
        default_outputs: &["output", "RGBA", "R", "G", "B", "A"],
    },
    // 3. Channel Operations
    NodeDescriptor {
        type_name: "ChannelCombine",
        display_name: "Channel Combine (Pack)",
        category: NodeCategory::ChannelOps,
        hotkey: Some("C"),
        default_inputs: &["R", "G", "B", "A"],
        default_outputs: &["output", "RGBA"],
    },
    NodeDescriptor {
        type_name: "ChannelSplit",
        display_name: "Channel Split (Unpack)",
        category: NodeCategory::ChannelOps,
        hotkey: Some("S"),
        default_inputs: &["input"],
        default_outputs: &["R", "G", "B", "A"],
    },
    NodeDescriptor {
        type_name: "ChannelMixer",
        display_name: "Channel Mixer / Swizzle",
        category: NodeCategory::ChannelOps,
        hotkey: None,
        default_inputs: &["input"],
        default_outputs: &["output", "RGBA"],
    },
    // 4. Color & Adjust
    NodeDescriptor {
        type_name: "Invert",
        display_name: "Invert",
        category: NodeCategory::ColorAdjust,
        hotkey: Some("I"),
        default_inputs: &["input"],
        default_outputs: &["output"],
    },
    NodeDescriptor {
        type_name: "Levels",
        display_name: "Levels",
        category: NodeCategory::ColorAdjust,
        hotkey: Some("L"),
        default_inputs: &["input"],
        default_outputs: &["output"],
    },
    NodeDescriptor {
        type_name: "BrightnessContrast",
        display_name: "Brightness / Contrast",
        category: NodeCategory::ColorAdjust,
        hotkey: None,
        default_inputs: &["input"],
        default_outputs: &["output"],
    },
    // 5. Normal Operations
    NodeDescriptor {
        type_name: "NormalFlipGreen",
        display_name: "Normal Flip Green (DirectX <-> OpenGL)",
        category: NodeCategory::NormalOps,
        hotkey: Some("N"),
        default_inputs: &["input"],
        default_outputs: &["output"],
    },
    NodeDescriptor {
        type_name: "NormalNormalize",
        display_name: "Normal Normalize",
        category: NodeCategory::NormalOps,
        hotkey: None,
        default_inputs: &["input"],
        default_outputs: &["output"],
    },
    NodeDescriptor {
        type_name: "NormalStrength",
        display_name: "Normal Strength",
        category: NodeCategory::NormalOps,
        hotkey: None,
        default_inputs: &["input"],
        default_outputs: &["output"],
    },
    // 6. Blend Operations
    NodeDescriptor {
        type_name: "LayerBlend",
        display_name: "Layer Blend (Lerp)",
        category: NodeCategory::BlendOps,
        hotkey: Some("B"),
        default_inputs: &["base", "layer", "mask"],
        default_outputs: &["output"],
    },
    NodeDescriptor {
        type_name: "NormalBlendRNM",
        display_name: "Normal Blend (RNM)",
        category: NodeCategory::BlendOps,
        hotkey: None,
        default_inputs: &["base", "detail"],
        default_outputs: &["output"],
    },
    // 7. Math
    NodeDescriptor {
        type_name: "Math",
        display_name: "Math (13 Operations)",
        category: NodeCategory::Math,
        hotkey: None,
        default_inputs: &["A", "B"],
        default_outputs: &["output"],
    },
    NodeDescriptor {
        type_name: "Multiply",
        display_name: "Multiply",
        category: NodeCategory::Math,
        hotkey: Some("M"),
        default_inputs: &["A", "B"],
        default_outputs: &["output"],
    },
    NodeDescriptor {
        type_name: "Add",
        display_name: "Add",
        category: NodeCategory::Math,
        hotkey: Some("A"),
        default_inputs: &["A", "B"],
        default_outputs: &["output"],
    },
    // 8. Transform
    NodeDescriptor {
        type_name: "Resize",
        display_name: "Resize & POT Transform",
        category: NodeCategory::Transform,
        hotkey: None,
        default_inputs: &["input"],
        default_outputs: &["output"],
    },
    // 9. Utility
    NodeDescriptor {
        type_name: "Comment",
        display_name: "Comment",
        category: NodeCategory::Utility,
        hotkey: Some("/"),
        default_inputs: &[],
        default_outputs: &[],
    },
    NodeDescriptor {
        type_name: "Reroute",
        display_name: "Reroute",
        category: NodeCategory::Utility,
        hotkey: None,
        default_inputs: &["input"],
        default_outputs: &["output"],
    },
];

/// Finds a node descriptor by type name with full alias support.
pub fn find_descriptor(type_name: &str) -> Option<&'static NodeDescriptor> {
    if let Some(desc) = NODE_CATALOG
        .iter()
        .find(|d| d.type_name.eq_ignore_ascii_case(type_name))
    {
        return Some(desc);
    }

    match type_name.to_ascii_uppercase().as_str() {
        "MULTIPLY" | "MUL" => NODE_CATALOG.iter().find(|d| d.type_name == "Multiply"),
        "ADD" => NODE_CATALOG.iter().find(|d| d.type_name == "Add"),
        "SUBTRACT" | "SUB" | "DIVIDE" | "DIV" | "POWER" | "POW" | "MIN" | "MAX" | "CLAMP"
        | "ABS" | "STEP" | "SMOOTHSTEP" | "MODULO" | "MOD" => {
            NODE_CATALOG.iter().find(|d| d.type_name == "Math")
        }
        "CHANNELPACK" | "CHANNELCOMBINER" | "PACK" => {
            NODE_CATALOG.iter().find(|d| d.type_name == "ChannelCombine")
        }
        "CHANNELUNPACK" | "CHANNELSPLITTER" | "UNPACK" => {
            NODE_CATALOG.iter().find(|d| d.type_name == "ChannelSplit")
        }
        "SWIZZLE" => NODE_CATALOG.iter().find(|d| d.type_name == "ChannelMixer"),
        "ONEMINUS" => NODE_CATALOG.iter().find(|d| d.type_name == "Invert"),
        "FLIPGREEN" | "NORMALINVERTY" => {
            NODE_CATALOG.iter().find(|d| d.type_name == "NormalFlipGreen")
        }
        "RNM" | "NORMALBLEND" => NODE_CATALOG.iter().find(|d| d.type_name == "NormalBlendRNM"),
        "LERP" | "BLEND" => NODE_CATALOG.iter().find(|d| d.type_name == "LayerBlend"),
        "TRANSFORM" => NODE_CATALOG.iter().find(|d| d.type_name == "Resize"),
        "SAVEIMAGE" | "TEXTUREOUTPUT" | "SAVETEXTURE" | "SAVE" | "EXPORT" => {
            NODE_CATALOG.iter().find(|d| d.type_name == "SaveImage")
        }
        "COMMENT" | "COMMENTBOX" | "NOTE" => NODE_CATALOG.iter().find(|d| d.type_name == "Comment"),
        "REROUTE" | "DOT" | "PASSTHROUGH" => NODE_CATALOG.iter().find(|d| d.type_name == "Reroute"),
        _ => None,
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    pub fn test_catalog_census() {
        assert!(NODE_CATALOG.len() >= 14);
        assert!(find_descriptor("ChannelMixer").is_some());
        assert!(find_descriptor("NormalBlendRNM").is_some());
        assert!(find_descriptor("Levels").is_some());
        assert!(find_descriptor("Math").is_some());
        assert!(find_descriptor("Multiply").is_some());
        assert!(find_descriptor("Add").is_some());
        assert!(find_descriptor("OneMinus").is_some());
        assert!(find_descriptor("ChannelPack").is_some());
        assert!(find_descriptor("Comment").is_some());
        assert!(find_descriptor("Reroute").is_some());
    }

    #[test]
    pub fn test_create_node_from_descriptor() {
        let desc = find_descriptor("ChannelCombine").unwrap();
        let node = desc.create_node(NodeId(42), [100.0, 200.0]);
        assert_eq!(node.id, NodeId(42));
        assert_eq!(node.inputs.len(), 4);
        assert_eq!(node.outputs.len(), 2);
    }

    #[test]
    pub fn test_comment_node_catalog_and_params() {
        let desc = find_descriptor("Comment").expect("Comment node should exist in catalog");
        assert_eq!(desc.category, NodeCategory::Utility);
        assert_eq!(desc.default_inputs.len(), 0);
        assert_eq!(desc.default_outputs.len(), 0);

        let node = desc.create_node(NodeId(99), [150.0, 250.0]);
        assert_eq!(node.id, NodeId(99));
        assert_eq!(node.position, [150.0, 250.0]);
        assert_eq!(node.get_string("text", ""), "Comment");
        assert_eq!(node.get_float("width", 0.0), 300.0);
        assert_eq!(node.get_float("height", 0.0), 200.0);
        assert_eq!(node.get_color("color", [0.0; 4]), [0.18, 0.22, 0.28, 0.4]);
    }

    #[test]
    pub fn test_reroute_node_catalog() {
        let desc = find_descriptor("Reroute").expect("Reroute node should exist in catalog");
        assert_eq!(desc.category, NodeCategory::Utility);
        assert_eq!(desc.default_inputs, &["input"]);
        assert_eq!(desc.default_outputs, &["output"]);

        let node = desc.create_node(NodeId(100), [50.0, 60.0]);
        assert_eq!(node.inputs.len(), 1);
        assert_eq!(node.outputs.len(), 1);
    }
}
