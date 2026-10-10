//! Transform and Resizing Nodes (Phase 3).
//!
//! Provides Power-of-Two (POT) rounding calculations and high-fidelity
//! Bilinear, Lanczos3, and Nearest Neighbor resampling algorithms.

use crate::core::buffer::{SharedTextureBuffer, TextureBuffer};
use crate::graph::evaluator::EvaluationError;
use crate::graph::model::Node;
use image::imageops::FilterType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Strategy for Power-of-Two dimension rounding.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum PotRoundMode {
    None,
    Nearest,
    Next,
    Prev,
}

impl Default for PotRoundMode {
    fn default() -> Self {
        Self::Nearest
    }
}

impl PotRoundMode {
    pub fn from_str_loose(s: &str) -> Self {
        match s.trim().to_uppercase().as_str() {
            "NONE" | "CUSTOM" => Self::None,
            "NEXT" | "CEIL" | "UP" => Self::Next,
            "PREV" | "FLOOR" | "DOWN" => Self::Prev,
            _ => Self::Nearest,
        }
    }
}

/// Supported filter kernels for resampling.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResizeFilter {
    Nearest,
    Bilinear,
    Lanczos3,
}

impl Default for ResizeFilter {
    fn default() -> Self {
        Self::Bilinear
    }
}

impl ResizeFilter {
    pub fn from_str_loose(s: &str) -> Self {
        match s.trim().to_uppercase().as_str() {
            "NEAREST" | "POINT" => Self::Nearest,
            "LANCZOS" | "LANCZOS3" => Self::Lanczos3,
            _ => Self::Bilinear,
        }
    }

    pub fn to_image_filter(&self) -> FilterType {
        match self {
            Self::Nearest => FilterType::Nearest,
            Self::Bilinear => FilterType::Triangle,
            Self::Lanczos3 => FilterType::Lanczos3,
        }
    }
}

/// Checks whether a number is an exact power of two ($2^k$).
#[inline(always)]
pub fn is_pot(n: u32) -> bool {
    n > 0 && (n & (n - 1)) == 0
}

/// Returns the next highest power of two $\ge n$.
#[inline(always)]
pub fn next_pot(n: u32) -> u32 {
    if n <= 1 {
        1
    } else {
        n.next_power_of_two()
    }
}

/// Returns the previous power of two $\le n$.
#[inline(always)]
pub fn prev_pot(n: u32) -> u32 {
    if n <= 1 {
        1
    } else {
        let next = n.next_power_of_two();
        if next == n {
            n
        } else {
            next >> 1
        }
    }
}

/// Returns the nearest power of two closest to $n$.
#[inline(always)]
pub fn nearest_pot(n: u32) -> u32 {
    if n <= 1 {
        return 1;
    }
    let prev = prev_pot(n);
    let next = next_pot(n);

    let diff_prev = n - prev;
    let diff_next = next - n;

    if diff_next < diff_prev {
        next
    } else {
        prev
    }
}

/// Rounds 2D dimensions according to the specified `PotRoundMode`.
pub fn round_to_pot_dimensions(width: u32, height: u32, mode: PotRoundMode) -> (u32, u32) {
    match mode {
        PotRoundMode::None => (width.max(1), height.max(1)),
        PotRoundMode::Nearest => (nearest_pot(width), nearest_pot(height)),
        PotRoundMode::Next => (next_pot(width), next_pot(height)),
        PotRoundMode::Prev => (prev_pot(width), prev_pot(height)),
    }
}

/// Resamples a `TextureBuffer` to target dimensions using the specified filter.
pub fn resize_buffer(src: &TextureBuffer, target_width: u32, target_height: u32, filter: ResizeFilter) -> TextureBuffer {
    if src.width == target_width && src.height == target_height {
        return src.clone();
    }

    let resized_img = image::imageops::resize(
        &src.image,
        target_width.max(1),
        target_height.max(1),
        filter.to_image_filter(),
    );

    TextureBuffer::from_image(resized_img)
}

/// Executes a `Resize` / `Transform` node.
pub fn execute_resize(
    node: &Node,
    inputs: &HashMap<String, SharedTextureBuffer>,
    resolution: (u32, u32),
) -> Result<HashMap<String, SharedTextureBuffer>, EvaluationError> {
    let src = inputs.get("input").or_else(|| inputs.get("in")).or_else(|| inputs.values().next());
    let mut outputs = HashMap::new();

    if let Some(buf) = src {
        let pot_mode_str = node.get_string("pot_mode", "Nearest");
        let pot_mode = PotRoundMode::from_str_loose(&pot_mode_str);

        let filter_str = node.get_string("filter", "Bilinear");
        let filter = ResizeFilter::from_str_loose(&filter_str);

        let (target_w, target_h) = if pot_mode != PotRoundMode::None {
            round_to_pot_dimensions(buf.width, buf.height, pot_mode)
        } else if let (Some(w), Some(h)) = (node.get_param("width"), node.get_param("height")) {
            let w_val = w.as_int().unwrap_or(buf.width as i64) as u32;
            let h_val = h.as_int().unwrap_or(buf.height as i64) as u32;
            (w_val.max(1), h_val.max(1))
        } else {
            (resolution.0, resolution.1)
        };

        let resized = resize_buffer(buf.as_ref(), target_w, target_h, filter);
        let shared = Arc::new(resized);
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

    /// P3-T9 Acceptance & TC-306: POT Resizing Rounding
    #[test]
    pub fn test_pot_rounding() {
        // Non-POT texture: 1920x1080 -> nearest POT is 2048x1024
        let (pot_w, pot_h) = round_to_pot_dimensions(1920, 1080, PotRoundMode::Nearest);
        assert_eq!(pot_w, 2048);
        assert_eq!(pot_h, 1024);

        // Next POT: 1920x1080 -> 2048x2048
        let (next_w, next_h) = round_to_pot_dimensions(1920, 1080, PotRoundMode::Next);
        assert_eq!(next_w, 2048);
        assert_eq!(next_h, 2048);

        // Prev POT: 1920x1080 -> 1024x1024
        let (prev_w, prev_h) = round_to_pot_dimensions(1920, 1080, PotRoundMode::Prev);
        assert_eq!(prev_w, 1024);
        assert_eq!(prev_h, 1024);

        // Already POT
        assert_eq!(round_to_pot_dimensions(1024, 512, PotRoundMode::Nearest), (1024, 512));
    }

    #[test]
    pub fn test_resampling_filters() {
        let src = TextureBuffer::solid_color(16, 16, 100, 150, 200, 255);
        let nearest = resize_buffer(&src, 32, 32, ResizeFilter::Nearest);
        assert_eq!(nearest.width, 32);
        assert_eq!(nearest.height, 32);
        assert_eq!(nearest.get_pixel(0, 0), [100, 150, 200, 255]);

        let lanczos = resize_buffer(&src, 8, 8, ResizeFilter::Lanczos3);
        assert_eq!(lanczos.width, 8);
        assert_eq!(lanczos.height, 8);
        assert_eq!(lanczos.get_pixel(0, 0), [100, 150, 200, 255]);
    }
}
