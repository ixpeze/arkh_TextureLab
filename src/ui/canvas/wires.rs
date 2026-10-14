//! Cubic Bezier wire rendering and hit-testing.

use egui::{epaint::CubicBezierShape, Color32, Painter, Pos2, Stroke, Vec2};
use crate::ui::theme::ACCENT_AMBER;

/// Calculates the minimum Euclidean distance from a screen point to a cubic Bezier wire.
pub fn distance_to_bezier_wire(pt: Pos2, p0: Pos2, p3: Pos2, zoom: f32) -> f32 {
    let dx = (p3.x - p0.x).abs().max(40.0 * zoom);
    let p1 = p0 + Vec2::new(dx * 0.45, 0.0);
    let p2 = p3 - Vec2::new(dx * 0.45, 0.0);

    let mut min_dist_sq = f32::MAX;
    let steps = 16;
    for i in 0..=steps {
        let t = i as f32 / steps as f32;
        let one_minus_t = 1.0 - t;
        let p = p0 * (one_minus_t * one_minus_t * one_minus_t)
            + p1.to_vec2() * (3.0 * one_minus_t * one_minus_t * t)
            + p2.to_vec2() * (3.0 * one_minus_t * t * t)
            + p3.to_vec2() * (t * t * t);
        let dist_sq = (pt - p).length_sq();
        if dist_sq < min_dist_sq {
            min_dist_sq = dist_sq;
        }
    }
    min_dist_sq.sqrt()
}

/// Renders a smooth cubic Bezier curve wire between socket centers (backward-compatible).
pub fn draw_cubic_bezier_wire(
    painter: &Painter,
    p0: Pos2,
    p3: Pos2,
    color: Color32,
    zoom: f32,
    is_active: bool,
) {
    draw_cubic_bezier_wire_animated(painter, p0, p3, color, zoom, is_active, 0.0);
}

/// Renders a smooth cubic Bezier wire with amber highlight, outer glow, and traveling data pulse.
pub fn draw_cubic_bezier_wire_animated(
    painter: &Painter,
    p0: Pos2,
    p3: Pos2,
    color: Color32,
    zoom: f32,
    is_active: bool,
    anim_phase: f32,
) {
    let dx = (p3.x - p0.x).abs().max(40.0 * zoom);
    let p1 = p0 + Vec2::new(dx * 0.45, 0.0);
    let p2 = p3 - Vec2::new(dx * 0.45, 0.0);

    let (stroke_width, wire_color) = if is_active {
        (2.6 * zoom.clamp(0.7, 1.3), ACCENT_AMBER)
    } else {
        (1.8 * zoom.clamp(0.6, 1.1), color)
    };

    // Ambient golden glow for active wire
    if is_active {
        let glow_stroke = Stroke::new(6.0 * zoom, Color32::from_rgba_premultiplied(255, 176, 46, 35));
        let glow_shape = CubicBezierShape::from_points_stroke(
            [p0, p1, p2, p3],
            false,
            Color32::TRANSPARENT,
            glow_stroke,
        );
        painter.add(glow_shape);
    }

    // Main anti-aliased wire
    let wire_stroke = Stroke::new(stroke_width, wire_color);
    let shape = CubicBezierShape::from_points_stroke(
        [p0, p1, p2, p3],
        false,
        Color32::TRANSPARENT,
        wire_stroke,
    );
    painter.add(shape);

    // Directional animated pulse (marching dot along bezier curve)
    if is_active {
        let t = (anim_phase % 1.0).clamp(0.0, 1.0);
        let u = 1.0 - t;
        let pt = p0 * (u * u * u)
            + p1.to_vec2() * (3.0 * u * u * t)
            + p2.to_vec2() * (3.0 * u * t * t)
            + p3.to_vec2() * (t * t * t);
        painter.circle_filled(pt, 3.5 * zoom, Color32::WHITE);
        painter.circle_stroke(pt, 5.0 * zoom, Stroke::new(1.0_f32, ACCENT_AMBER));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ui::theme::pin_wire_color;

    #[test]
    fn test_semantic_wire_colors() {
        assert_eq!(pin_wire_color("R"), Color32::from_rgb(239, 68, 68));
        assert_eq!(pin_wire_color("G"), Color32::from_rgb(34, 197, 94));
        assert_eq!(pin_wire_color("B"), Color32::from_rgb(59, 130, 246));
        assert_eq!(pin_wire_color("A"), Color32::from_rgb(148, 163, 184));
        assert_eq!(pin_wire_color("RGBA"), Color32::from_rgb(248, 250, 252));
    }

    #[test]
    fn test_distance_to_bezier_wire() {
        let p0 = Pos2::new(100.0, 100.0);
        let p3 = Pos2::new(300.0, 100.0);
        let zoom = 1.0;

        // Exactly on start
        let dist_start = distance_to_bezier_wire(p0, p0, p3, zoom);
        assert!(dist_start < 1.0);

        // Exactly on end
        let dist_end = distance_to_bezier_wire(p3, p0, p3, zoom);
        assert!(dist_end < 1.0);

        // Far away from curve
        let dist_far = distance_to_bezier_wire(Pos2::new(200.0, 500.0), p0, p3, zoom);
        assert!(dist_far > 300.0);
    }
}
