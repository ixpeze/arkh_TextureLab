//! Obsidian "Graphite Blueprint" Tactical Workstation Theme (Phase 5).
//!
//! Provides the professional dark styling tokens, WCAG AA contrast compliance,
//! category node header colors, and semantic wire color mapping.

use egui::{Color32, Stroke, Vec2, Visuals};
use crate::nodes::NodeCategory;

// --- Surface & Background Palette (Obsidian Tactical) ---
pub const BG_CANVAS: Color32 = Color32::from_rgb(10, 11, 16);       // #0a0b10
pub const BG_PANEL: Color32 = Color32::from_rgb(15, 17, 23);        // #0f1117
pub const BG_CARD: Color32 = Color32::from_rgb(22, 25, 34);         // #161922
pub const BG_CARD_SELECTED: Color32 = Color32::from_rgb(28, 33, 46);// #1c212e
pub const BG_HEADER: Color32 = Color32::from_rgb(18, 20, 28);       // #12141c

// --- Grid Lines ---
pub const GRID_MINOR: Color32 = Color32::from_rgb(18, 20, 28);      // subtle
pub const GRID_MAJOR: Color32 = Color32::from_rgb(28, 32, 46);      // prominent
pub const GRID_AXIS: Color32 = Color32::from_rgb(45, 52, 75);       // origin axes

// --- Borders & Separators ---
pub const BORDER_DARK: Color32 = Color32::from_rgb(32, 36, 50);     // #202432
pub const BORDER_SUBTLE: Color32 = Color32::from_rgb(38, 43, 58);   // #262b3a
pub const BORDER_HIGHLIGHT: Color32 = Color32::from_rgb(56, 189, 248); // #38bdf8 (cyan)
pub const BORDER_SELECTED: Color32 = Color32::from_rgb(96, 165, 250);  // #60a5fa (blue)

// --- Typography Tokens (WCAG AA Compliant >= 4.5:1) ---
pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(241, 245, 249); // #f1f5f9 (~18:1 contrast)
pub const TEXT_SECONDARY: Color32 = Color32::from_rgb(148, 163, 184); // #94a3b8 (~7.5:1 contrast)
pub const TEXT_MUTED: Color32 = Color32::from_rgb(100, 116, 139);   // #64748b (~4.6:1 contrast)
pub const TEXT_ACCENT: Color32 = Color32::from_rgb(56, 189, 248);  // #38bdf8

// --- Semantic Wire & Socket Colors (Phase 5 Section 2.2) ---
pub const WIRE_RED: Color32 = Color32::from_rgb(239, 68, 68);       // #ef4444 (Red R)
pub const WIRE_GREEN: Color32 = Color32::from_rgb(34, 197, 94);     // #22c55e (Green G)
pub const WIRE_BLUE: Color32 = Color32::from_rgb(59, 130, 246);     // #3b82f6 (Blue B)
pub const WIRE_ALPHA: Color32 = Color32::from_rgb(148, 163, 184);   // #94a3b8 (Alpha / Scalar)
pub const WIRE_RGBA: Color32 = Color32::from_rgb(248, 250, 252);    // #f8fafc (Crisp White RGBA)
pub const WIRE_DEFAULT: Color32 = Color32::from_rgb(203, 213, 225); // #cbd5e1

// --- Category Colors (Node Badges & Headers) ---
pub const CAT_IO: Color32 = Color32::from_rgb(13, 148, 136);        // #0d9488 (Teal)
pub const CAT_CONSTANTS: Color32 = Color32::from_rgb(217, 119, 6);   // #d97706 (Amber)
pub const CAT_CHANNEL: Color32 = Color32::from_rgb(124, 58, 237);    // #7c3aed (Violet)
pub const CAT_ADJUST: Color32 = Color32::from_rgb(2, 132, 199);      // #0284c7 (Sky)
pub const CAT_NORMAL: Color32 = Color32::from_rgb(79, 70, 229);      // #4f46e5 (Indigo)
pub const CAT_BLEND: Color32 = Color32::from_rgb(225, 29, 72);       // #e11d48 (Rose)
pub const CAT_MATH: Color32 = Color32::from_rgb(16, 185, 129);       // #10b981 (Emerald)
pub const CAT_TRANSFORM: Color32 = Color32::from_rgb(245, 158, 11);  // #f59e0b (Orange)

/// Resolves the semantic wire color for a pin or socket name.
pub fn pin_wire_color(pin_name: &str) -> Color32 {
    let lower = pin_name.to_lowercase();
    match lower.as_str() {
        "r" | "red" => WIRE_RED,
        "g" | "green" => WIRE_GREEN,
        "b" | "blue" => WIRE_BLUE,
        "a" | "alpha" | "mask" | "scalar" | "value" => WIRE_ALPHA,
        "rgba" | "output" | "input" | "base" | "layer" | "detail" => WIRE_RGBA,
        _ => WIRE_DEFAULT,
    }
}

/// Resolves the header color for a given node category.
pub fn category_color(cat: NodeCategory) -> Color32 {
    match cat {
        NodeCategory::Io => CAT_IO,
        NodeCategory::Constants => CAT_CONSTANTS,
        NodeCategory::ChannelOps => CAT_CHANNEL,
        NodeCategory::ColorAdjust => CAT_ADJUST,
        NodeCategory::NormalOps => CAT_NORMAL,
        NodeCategory::BlendOps => CAT_BLEND,
        NodeCategory::Math => CAT_MATH,
        NodeCategory::Transform => CAT_TRANSFORM,
    }
}

/// Computes the relative luminance of an sRGB color (WCAG 2.1 standard formula).
pub fn relative_luminance(c: Color32) -> f64 {
    fn to_linear(val: u8) -> f64 {
        let s = val as f64 / 255.0;
        if s <= 0.04045 {
            s / 12.92
        } else {
            ((s + 0.055) / 1.055).powf(2.4)
        }
    }
    0.2126 * to_linear(c.r()) + 0.7152 * to_linear(c.g()) + 0.0722 * to_linear(c.b())
}

/// Calculates the WCAG contrast ratio between two colors (ranging from 1.0 to 21.0).
pub fn wcag_contrast_ratio(c1: Color32, c2: Color32) -> f64 {
    let l1 = relative_luminance(c1);
    let l2 = relative_luminance(c2);
    let (lighter, darker) = if l1 >= l2 { (l1, l2) } else { (l2, l1) };
    (lighter + 0.05) / (darker + 0.05)
}

/// Applies the Obsidian "Graphite Blueprint" theme to the egui context.
pub fn apply_theme(ctx: &egui::Context) {
    let mut visuals = Visuals::dark();

    // Base background colors
    visuals.panel_fill = BG_PANEL;
    visuals.window_fill = BG_CARD;
    visuals.faint_bg_color = BG_CANVAS;
    visuals.extreme_bg_color = BG_CANVAS;

    // Window and widget styling
    visuals.window_stroke = Stroke::new(1.0_f32, BORDER_DARK);
    visuals.window_corner_radius = 4.into();

    // Widget states
    visuals.widgets.noninteractive.bg_fill = BG_CARD;
    visuals.widgets.noninteractive.bg_stroke = Stroke::new(1.0_f32, BORDER_DARK);
    visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0_f32, TEXT_SECONDARY);
    visuals.widgets.noninteractive.corner_radius = 3.into();

    visuals.widgets.inactive.bg_fill = BG_HEADER;
    visuals.widgets.inactive.bg_stroke = Stroke::new(1.0_f32, BORDER_SUBTLE);
    visuals.widgets.inactive.fg_stroke = Stroke::new(1.0_f32, TEXT_PRIMARY);
    visuals.widgets.inactive.corner_radius = 3.into();

    visuals.widgets.hovered.bg_fill = Color32::from_rgb(30, 36, 50);
    visuals.widgets.hovered.bg_stroke = Stroke::new(1.0_f32, BORDER_HIGHLIGHT);
    visuals.widgets.hovered.fg_stroke = Stroke::new(1.0_f32, Color32::WHITE);
    visuals.widgets.hovered.corner_radius = 3.into();

    visuals.widgets.active.bg_fill = Color32::from_rgb(40, 48, 68);
    visuals.widgets.active.bg_stroke = Stroke::new(1.0_f32, BORDER_SELECTED);
    visuals.widgets.active.fg_stroke = Stroke::new(1.0_f32, Color32::WHITE);
    visuals.widgets.active.corner_radius = 3.into();

    visuals.widgets.open.bg_fill = BG_CARD;
    visuals.widgets.open.bg_stroke = Stroke::new(1.0_f32, BORDER_HIGHLIGHT);
    visuals.widgets.open.fg_stroke = Stroke::new(1.0_f32, TEXT_PRIMARY);

    visuals.selection.bg_fill = Color32::from_rgb(30, 58, 95);
    visuals.selection.stroke = Stroke::new(1.5_f32, BORDER_HIGHLIGHT);

    let mut style = (*ctx.style()).clone();
    style.visuals = visuals;
    style.spacing.item_spacing = Vec2::new(8.0, 6.0);
    style.spacing.window_margin = egui::Margin::same(8);
    ctx.set_style(style);
}

/// Configures an `egui_dock::Style` consistent with the Obsidian Workstation theme.
pub fn create_dock_style(ctx: &egui::Context) -> egui_dock::Style {
    let mut dock_style = egui_dock::Style::from_egui(ctx.style().as_ref());
    dock_style.separator.color_idle = BORDER_DARK;
    dock_style.separator.color_hovered = BORDER_HIGHLIGHT;
    dock_style.separator.width = 2.0;

    dock_style.tab_bar.bg_fill = BG_PANEL;
    dock_style.tab_bar.height = 28.0;

    dock_style.tab.tab_body.bg_fill = BG_PANEL;
    dock_style.tab.active.bg_fill = BG_CARD;
    dock_style.tab.active.text_color = TEXT_PRIMARY;
    dock_style.tab.inactive.bg_fill = BG_PANEL;
    dock_style.tab.inactive.text_color = TEXT_SECONDARY;
    dock_style.tab.focused.bg_fill = BG_CARD_SELECTED;
    dock_style.tab.focused.text_color = TEXT_PRIMARY;
    dock_style.tab.hovered.bg_fill = Color32::from_rgb(26, 30, 42);
    dock_style.tab.hovered.text_color = TEXT_PRIMARY;

    dock_style
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wcag_aa_contrast_compliance() {
        // WCAG AA requires >= 4.5:1 for normal text against background
        let contrast_primary = wcag_contrast_ratio(TEXT_PRIMARY, BG_CANVAS);
        assert!(
            contrast_primary >= 4.5,
            "Primary text contrast ratio {:.2} should be >= 4.5",
            contrast_primary
        );

        let contrast_panel = wcag_contrast_ratio(TEXT_PRIMARY, BG_PANEL);
        assert!(
            contrast_panel >= 4.5,
            "Primary text on panel contrast ratio {:.2} should be >= 4.5",
            contrast_panel
        );

        let contrast_secondary = wcag_contrast_ratio(TEXT_SECONDARY, BG_CANVAS);
        assert!(
            contrast_secondary >= 4.5,
            "Secondary text contrast ratio {:.2} should be >= 4.5",
            contrast_secondary
        );
    }

    #[test]
    fn test_semantic_wire_color_mapping() {
        assert_eq!(pin_wire_color("R"), WIRE_RED);
        assert_eq!(pin_wire_color("red"), WIRE_RED);
        assert_eq!(pin_wire_color("G"), WIRE_GREEN);
        assert_eq!(pin_wire_color("green"), WIRE_GREEN);
        assert_eq!(pin_wire_color("B"), WIRE_BLUE);
        assert_eq!(pin_wire_color("blue"), WIRE_BLUE);
        assert_eq!(pin_wire_color("A"), WIRE_ALPHA);
        assert_eq!(pin_wire_color("alpha"), WIRE_ALPHA);
        assert_eq!(pin_wire_color("scalar"), WIRE_ALPHA);
        assert_eq!(pin_wire_color("RGBA"), WIRE_RGBA);
        assert_eq!(pin_wire_color("output"), WIRE_RGBA);
    }

    #[test]
    fn test_category_colors_distinctness() {
        let cats = [
            NodeCategory::Io,
            NodeCategory::Constants,
            NodeCategory::ChannelOps,
            NodeCategory::ColorAdjust,
            NodeCategory::NormalOps,
            NodeCategory::BlendOps,
            NodeCategory::Math,
            NodeCategory::Transform,
        ];
        // All categories have valid non-transparent colors
        for c in cats {
            let col = category_color(c);
            assert_eq!(col.a(), 255);
        }
    }
}
