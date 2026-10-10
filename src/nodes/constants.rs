//! Constant Scalar and Color Nodes (Phase 3).
//!
//! Provides solid color, scalar float values, and channel split outputs.

use crate::core::buffer::{SharedTextureBuffer, TextureBuffer};
use crate::graph::evaluator::EvaluationError;
use crate::graph::model::{Node, NodeParam};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Configuration payload for a `ConstantScalar` node.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ConstantScalarNodeData {
    pub value: f32,
}

impl Default for ConstantScalarNodeData {
    fn default() -> Self {
        Self { value: 1.0 }
    }
}

impl ConstantScalarNodeData {
    pub fn new(value: f32) -> Self {
        Self { value }
    }

    pub fn apply_to_node(&self, node: &mut Node) {
        node.set_param("value", NodeParam::Float(self.value));
    }

    pub fn from_node(node: &Node) -> Self {
        Self {
            value: node.get_float("value", 1.0),
        }
    }
}

/// Configuration payload for a `ConstantColor` node.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ConstantColorNodeData {
    pub color: [f32; 4],
}

impl Default for ConstantColorNodeData {
    fn default() -> Self {
        Self {
            color: [1.0, 1.0, 1.0, 1.0],
        }
    }
}

impl ConstantColorNodeData {
    pub fn new(color: [f32; 4]) -> Self {
        Self { color }
    }

    pub fn apply_to_node(&self, node: &mut Node) {
        node.set_param("color", NodeParam::Color(self.color));
    }

    pub fn from_node(node: &Node) -> Self {
        Self {
            color: node.get_color("color", [1.0, 1.0, 1.0, 1.0]),
        }
    }
}

/// Executes a `ConstantScalar` node, generating a solid scalar buffer (R=G=B=val, A=255).
pub fn execute_constant_scalar(
    node: &Node,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let (width, height) = resolution;
    let val = node.get_float("value", 1.0);
    let byte_val = (val * 255.0).clamp(0.0, 255.0) as u8;

    let buf = TextureBuffer::solid_color(width, height, byte_val, byte_val, byte_val, 255);
    let shared = Arc::new(buf);

    let mut outputs = HashMap::new();
    outputs.insert("output".to_string(), Arc::clone(&shared));
    outputs.insert("value".to_string(), Arc::clone(&shared));
    outputs.insert("scalar".to_string(), shared);

    Ok(outputs)
}

/// Executes a `ConstantColor` node, generating an RGBA solid color buffer and individual channel buffers.
pub fn execute_constant_color(
    node: &Node,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let (width, height) = resolution;
    let color = node.get_color("color", [1.0, 1.0, 1.0, 1.0]);
    let r = (color[0] * 255.0).clamp(0.0, 255.0) as u8;
    let g = (color[1] * 255.0).clamp(0.0, 255.0) as u8;
    let b = (color[2] * 255.0).clamp(0.0, 255.0) as u8;
    let a = (color[3] * 255.0).clamp(0.0, 255.0) as u8;

    let buf = TextureBuffer::solid_color(width, height, r, g, b, a);
    let shared = Arc::new(buf);

    let mut outputs = HashMap::new();
    outputs.insert("output".to_string(), Arc::clone(&shared));
    outputs.insert("RGBA".to_string(), Arc::clone(&shared));

    // Provide individual split channels if needed
    if node.outputs.iter().any(|p| p.name == "R" || p.name == "G" || p.name == "B" || p.name == "A") {
        outputs.insert("R".to_string(), Arc::new(TextureBuffer::solid_color(width, height, r, r, r, 255)));
        outputs.insert("G".to_string(), Arc::new(TextureBuffer::solid_color(width, height, g, g, g, 255)));
        outputs.insert("B".to_string(), Arc::new(TextureBuffer::solid_color(width, height, b, b, b, 255)));
        outputs.insert("A".to_string(), Arc::new(TextureBuffer::solid_color(width, height, a, a, a, 255)));
    }

    Ok(outputs)
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::graph::model::NodeId;

    #[test]
    pub fn test_constant_scalar_execution() {
        let mut node = Node::new(NodeId(1), "ConstantScalar", "Roughness", [0.0, 0.0]);
        node.set_param("value", NodeParam::Float(0.5));
        let outputs = execute_constant_scalar(&node, (16, 16)).unwrap();
        let buf = outputs.get("output").unwrap();
        assert_eq!(buf.get_pixel(0, 0), [127, 127, 127, 255]);
    }

    #[test]
    pub fn test_constant_color_execution() {
        let mut node = Node::new(NodeId(2), "ConstantColor", "Albedo", [0.0, 0.0]);
        node.set_param("color", NodeParam::Color([1.0, 0.0, 0.5, 1.0]));
        let outputs = execute_constant_color(&node, (8, 8)).unwrap();
        let buf = outputs.get("output").unwrap();
        assert_eq!(buf.get_pixel(0, 0), [255, 0, 127, 255]);
    }
}
