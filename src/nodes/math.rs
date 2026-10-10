//! 13 Canonical Mathematical Operations Engine (Phase 3).
//!
//! Provides scalar and vector operations (`Add`, `Subtract`, `Multiply`, `Divide`,
//! `Power`, `Min`, `Max`, `Clamp`, `Abs`, `Step`, `Smoothstep`, `Modulo`, `Invert`)
//! with division-by-zero protection and Rayon multithreading.

use crate::core::buffer::{SharedTextureBuffer, TextureBuffer};
use crate::graph::evaluator::EvaluationError;
use crate::graph::model::Node;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Supported 13 mathematical operations.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum MathOp {
    Add,
    Subtract,
    Multiply,
    Divide,
    Power,
    Min,
    Max,
    Clamp,
    Abs,
    Step,
    Smoothstep,
    Modulo,
    Invert,
}

impl Default for MathOp {
    fn default() -> Self {
        Self::Add
    }
}

impl MathOp {
    pub fn from_str_loose(s: &str) -> Self {
        match s.trim().to_uppercase().as_str() {
            "SUB" | "SUBTRACT" => Self::Subtract,
            "MUL" | "MULTIPLY" => Self::Multiply,
            "DIV" | "DIVIDE" => Self::Divide,
            "POW" | "POWER" => Self::Power,
            "MIN" => Self::Min,
            "MAX" => Self::Max,
            "CLAMP" => Self::Clamp,
            "ABS" => Self::Abs,
            "STEP" => Self::Step,
            "SMOOTHSTEP" => Self::Smoothstep,
            "MOD" | "MODULO" => Self::Modulo,
            "INV" | "INVERT" | "ONE_MINUS" => Self::Invert,
            _ => Self::Add,
        }
    }

    /// Evaluates the mathematical operation on normalized floating-point components in $[0.0, 1.0]$.
    /// Guarantees complete floating-point safety: zero panics, zero NaNs, zero infinities.
    #[inline(always)]
    pub fn compute(&self, a: f32, b: f32, edge0: f32, edge1: f32, min_val: f32, max_val: f32) -> f32 {
        match self {
            Self::Add => (a + b).clamp(0.0, 1.0),
            Self::Subtract => (a - b).clamp(0.0, 1.0),
            Self::Multiply => (a * b).clamp(0.0, 1.0),
            Self::Divide => {
                if b.abs() < 1e-6 {
                    0.0 // Division-by-zero guard
                } else {
                    (a / b).clamp(0.0, 1.0)
                }
            }
            Self::Power => {
                let base = a.max(0.0);
                let exp = b.max(0.0);
                if base == 0.0 && exp == 0.0 {
                    1.0
                } else {
                    base.powf(exp).clamp(0.0, 1.0)
                }
            }
            Self::Min => a.min(b),
            Self::Max => a.max(b),
            Self::Clamp => a.clamp(min_val, max_val),
            Self::Abs => a.abs().clamp(0.0, 1.0),
            Self::Step => {
                if a >= edge0 {
                    1.0
                } else {
                    0.0
                }
            }
            Self::Smoothstep => {
                let range = edge1 - edge0;
                if range.abs() < 1e-6 {
                    if a >= edge0 {
                        1.0
                    } else {
                        0.0
                    }
                } else {
                    let t = ((a - edge0) / range).clamp(0.0, 1.0);
                    t * t * (3.0 - 2.0 * t)
                }
            }
            Self::Modulo => {
                if b.abs() < 1e-6 {
                    0.0
                } else {
                    (a % b).clamp(0.0, 1.0)
                }
            }
            Self::Invert => (1.0 - a).clamp(0.0, 1.0),
        }
    }
}

/// Applies a mathematical operation between input textures and/or constant scalar fallbacks.
pub fn apply_math_op(
    a_buf: Option<&TextureBuffer>,
    b_buf: Option<&TextureBuffer>,
    op: MathOp,
    scalar_a: f32,
    scalar_b: f32,
    edge0: f32,
    edge1: f32,
    min_val: f32,
    max_val: f32,
    affect_alpha: bool,
    width: u32,
    height: u32,
) -> TextureBuffer {
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

                let a_px = if let Some(a) = a_buf {
                    let sx = if a.width == width { x } else { (x * a.width) / width };
                    let sy = if a.height == height { y } else { (y * a.height) / height };
                    a.get_pixel(sx, sy)
                } else {
                    let v = (scalar_a * 255.0).clamp(0.0, 255.0) as u8;
                    [v, v, v, 255]
                };

                let b_px = if let Some(b) = b_buf {
                    let sx = if b.width == width { x } else { (x * b.width) / width };
                    let sy = if b.height == height { y } else { (y * b.height) / height };
                    b.get_pixel(sx, sy)
                } else {
                    let v = (scalar_b * 255.0).clamp(0.0, 255.0) as u8;
                    [v, v, v, 255]
                };

                for c in 0..3 {
                    let an = a_px[c] as f32 / 255.0;
                    let bn = b_px[c] as f32 / 255.0;
                    let res = op.compute(an, bn, edge0, edge1, min_val, max_val);
                    px[c] = (res * 255.0 + 0.5).clamp(0.0, 255.0) as u8;
                }

                if affect_alpha {
                    let an = a_px[3] as f32 / 255.0;
                    let bn = b_px[3] as f32 / 255.0;
                    let res = op.compute(an, bn, edge0, edge1, min_val, max_val);
                    px[3] = (res * 255.0 + 0.5).clamp(0.0, 255.0) as u8;
                } else {
                    px[3] = a_px[3];
                }
            });
        });

    out
}

/// Executes a `Math` node (or explicit operation node like `Add`, `Multiply`).
pub fn execute_math(
    node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let (width, height) = resolution;

    let op_name = if node.node_type == "Math" {
        node.get_string("operation", "Add")
    } else {
        node.node_type.clone()
    };
    let op = MathOp::from_str_loose(&op_name);

    let a_buf = inputs.get("A").or_else(|| inputs.get("input1")).or_else(|| inputs.get("input"));
    let b_buf = inputs.get("B").or_else(|| inputs.get("input2"));

    let scalar_a = node.get_float("scalar_a", 0.0);
    let scalar_b = node.get_float("scalar_b", 0.5);
    let edge0 = node.get_float("edge0", node.get_float("edge", 0.5));
    let edge1 = node.get_float("edge1", 1.0);
    let min_val = node.get_float("min_val", 0.0);
    let max_val = node.get_float("max_val", 1.0);
    let affect_alpha = node.get_bool("affect_alpha", false);

    let result = apply_math_op(
        a_buf.map(|a| a.as_ref()),
        b_buf.map(|b| b.as_ref()),
        op,
        scalar_a,
        scalar_b,
        edge0,
        edge1,
        min_val,
        max_val,
        affect_alpha,
        width,
        height,
    );

    let shared = Arc::new(result);
    let mut outputs = HashMap::new();
    outputs.insert("output".to_string(), Arc::clone(&shared));
    outputs.insert("out".to_string(), shared);

    Ok(outputs)
}

#[cfg(test)]
pub mod tests {
    use super::*;

    /// P3-T8 Acceptance & TC-305: Math Operations Suite (All 13 Operations)
    #[test]
    pub fn test_math_operations() {
        let op_add = MathOp::Add;
        assert!((op_add.compute(0.3, 0.4, 0.0, 1.0, 0.0, 1.0) - 0.7).abs() < 1e-5);

        let op_sub = MathOp::Subtract;
        assert!((op_sub.compute(0.8, 0.3, 0.0, 1.0, 0.0, 1.0) - 0.5).abs() < 1e-5);

        let op_mul = MathOp::Multiply;
        assert!((op_mul.compute(0.5, 0.4, 0.0, 1.0, 0.0, 1.0) - 0.2).abs() < 1e-5);

        let op_div = MathOp::Divide;
        assert!((op_div.compute(0.6, 0.3, 0.0, 1.0, 0.0, 1.0) - 1.0).abs() < 1e-5); // Clamped to 1.0
        // Division by zero protection:
        assert_eq!(op_div.compute(0.8, 0.0, 0.0, 1.0, 0.0, 1.0), 0.0);

        let op_pow = MathOp::Power;
        assert!((op_pow.compute(0.5, 2.0, 0.0, 1.0, 0.0, 1.0) - 0.25).abs() < 1e-5);

        let op_min = MathOp::Min;
        assert_eq!(op_min.compute(0.2, 0.9, 0.0, 1.0, 0.0, 1.0), 0.2);

        let op_max = MathOp::Max;
        assert_eq!(op_max.compute(0.2, 0.9, 0.0, 1.0, 0.0, 1.0), 0.9);

        let op_clamp = MathOp::Clamp;
        assert_eq!(op_clamp.compute(0.8, 0.0, 0.0, 1.0, 0.2, 0.6), 0.6);

        let op_abs = MathOp::Abs;
        assert_eq!(op_abs.compute(0.75, 0.0, 0.0, 1.0, 0.0, 1.0), 0.75);

        let op_step = MathOp::Step;
        assert_eq!(op_step.compute(0.4, 0.0, 0.5, 1.0, 0.0, 1.0), 0.0);
        assert_eq!(op_step.compute(0.6, 0.0, 0.5, 1.0, 0.0, 1.0), 1.0);

        let op_smooth = MathOp::Smoothstep;
        assert_eq!(op_smooth.compute(0.0, 0.0, 0.0, 1.0, 0.0, 1.0), 0.0);
        assert_eq!(op_smooth.compute(1.0, 0.0, 0.0, 1.0, 0.0, 1.0), 1.0);
        assert_eq!(op_smooth.compute(0.5, 0.0, 0.0, 1.0, 0.0, 1.0), 0.5);

        let op_mod = MathOp::Modulo;
        assert!((op_mod.compute(0.7, 0.4, 0.0, 1.0, 0.0, 1.0) - 0.3).abs() < 1e-5);
        // Modulo by zero protection:
        assert_eq!(op_mod.compute(0.7, 0.0, 0.0, 1.0, 0.0, 1.0), 0.0);

        let op_inv = MathOp::Invert;
        assert!((op_inv.compute(0.3, 0.0, 0.0, 1.0, 0.0, 1.0) - 0.7).abs() < 1e-5);
    }

    #[test]
    pub fn test_apply_math_op_buffer() {
        let a = TextureBuffer::solid_color(16, 16, 100, 100, 100, 255);
        let b = TextureBuffer::solid_color(16, 16, 50, 50, 50, 255);

        let result = apply_math_op(
            Some(&a),
            Some(&b),
            MathOp::Add,
            0.0,
            0.0,
            0.0,
            1.0,
            0.0,
            1.0,
            false,
            16,
            16,
        );

        let px = result.get_pixel(0, 0);
        // 100/255 + 50/255 = 150/255 -> 150
        assert!((px[0] as i32 - 150).abs() <= 1);
        assert_eq!(px[3], 255);
    }
}
