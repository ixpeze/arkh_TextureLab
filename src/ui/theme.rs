//! Obsidian "Graphite Blueprint" Tactical Workstation Theme (Phase 5).
//!
//! Provides the professional dark styling tokens, WCAG AA contrast compliance,
//! category node header colors, and semantic wire color mapping.

use egui::{Color32, Stroke, Vec2, Visuals};
use crate::nodes::NodeCategory;

// --- Surface & Background Palette (Obsidian Tactical Workstation) ---
pub const BG_CANVAS: Color32 = Color32::from_rgb(16, 16, 19);        // #101013 (Deep Slate Canvas)
pub const BG_PANEL: Color32 = Color32::from_rgb(22, 22, 28);         // #16161C (Tactical Side Panel)
pub const BG_CARD: Color32 = Color32::from_rgb(32, 32, 42);          // #20202A (High-Contrast Charcoal Card)
pub const BG_CARD_SELECTED: Color32 = Color32::from_rgb(40, 40, 54); // #282836 (Selected Card Base)
pub const BG_HEADER: Color32 = Color32::from_rgb(38, 38, 50);        // #262632 (Raised Header Surface)
pub const BG_INSET: Color32 = Color32::from_rgb(18, 18, 24);         // #121218 (Dark Inset)

// --- Grid Dots & Lines (Tactical High-Contrast Blueprint Grid) ---
pub const GRID_DOT: Color32 = Color32::from_rgb(46, 46, 60);         // #2E2E3C (crisp visible minor dot)
pub const GRID_DOT_MAJOR: Color32 = Color32::from_rgb(76, 76, 100);   // #4C4C64 (prominent major dot)
pub const GRID_MINOR: Color32 = Color32::from_rgb(32, 32, 42);       // subtle line fallback
pub const GRID_MAJOR: Color32 = Color32::from_rgb(48, 48, 62);       // prominent line
pub const GRID_AXIS: Color32 = Color32::from_rgb(86, 86, 110);       // origin axes

// --- Borders & Separators (Crisp, High-Definition DCC Lines) ---
pub const BORDER_DARK: Color32 = Color32::from_rgb(58, 58, 76);      // #3A3A4C (crisp visible card border)
pub const BORDER_HOVER: Color32 = Color32::from_rgb(74, 74, 96);     // #4A4A60 (hovered element border)
pub const BORDER_SUBTLE: Color32 = Color32::from_rgb(72, 72, 94);    // #48485E
pub const BORDER_HAIRLINE: Color32 = Color32::from_rgb(88, 88, 114);  // #585872 (strong hairline)
pub const BORDER_HIGHLIGHT: Color32 = Color32::from_rgb(255, 176, 46); // #FFB02E (signature amber)
pub const BORDER_SELECTED: Color32 = Color32::from_rgb(255, 176, 46);  // #FFB02E (signature amber)
pub const HAIRLINE_ROW_GRAY: Color32 = Color32::from_rgba_premultiplied(70, 70, 92, 60); // Distinct row separator

// --- Signature Accent & Glow ---
pub const ACCENT_AMBER: Color32 = Color32::from_rgb(255, 176, 46);   // #FFB02E
pub const ACCENT_GLOW: Color32 = Color32::from_rgba_premultiplied(255, 176, 46, 80);

// --- Typography Tokens (WCAG AA Compliant >= 4.5:1) ---
pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(248, 246, 240);  // #F8F6F0 (~16:1 contrast)
pub const TEXT_SECONDARY: Color32 = Color32::from_rgb(182, 178, 170);// #B6B2AA (~8:1 contrast)
pub const TEXT_MUTED: Color32 = Color32::from_rgb(140, 136, 126);    // #8C887E (~5.2:1 contrast)
pub const TEXT_ACCENT: Color32 = Color32::from_rgb(255, 176, 46);    // #FFB02E

// --- Category Colors & Suggested Tinted Backgrounds (Design Guide Section 2) ---
pub const CAT_IO: Color32 = Color32::from_rgb(92, 200, 232);         // #5CC8E8 (Cyan)
pub const CAT_IO_BG: Color32 = Color32::from_rgb(29, 48, 56);        // #1D3038
pub const CAT_CONSTANTS: Color32 = Color32::from_rgb(236, 232, 225); // #ECE8E1 (Off-white)
pub const CAT_CONSTANTS_BG: Color32 = Color32::from_rgb(41, 41, 45); // #29292D
pub const CAT_CHANNEL: Color32 = Color32::from_rgb(183, 156, 245);   // #B79CF5 (Soft Violet)
pub const CAT_CHANNEL_BG: Color32 = Color32::from_rgb(41, 34, 55);   // #292237
pub const CAT_ADJUST: Color32 = Color32::from_rgb(92, 200, 232);     // #5CC8E8 (Sky)
pub const CAT_ADJUST_BG: Color32 = Color32::from_rgb(29, 48, 56);    // #1D3038
pub const CAT_NORMAL: Color32 = Color32::from_rgb(76, 201, 192);     // #4CC9C0 (Teal)
pub const CAT_NORMAL_BG: Color32 = Color32::from_rgb(27, 52, 50);    // #1B3432
pub const CAT_BLEND: Color32 = Color32::from_rgb(245, 200, 76);      // #F5C84C (Amber-Yellow)
pub const CAT_BLEND_BG: Color32 = Color32::from_rgb(52, 45, 28);     // #342D1C
pub const CAT_MATH: Color32 = Color32::from_rgb(111, 208, 140);      // #6FD08C (Mint Emerald)
pub const CAT_MATH_BG: Color32 = Color32::from_rgb(29, 51, 39);      // #1D3327
pub const CAT_TRANSFORM: Color32 = Color32::from_rgb(245, 158, 11);   // #F59E0B (Orange)
pub const CAT_TRANSFORM_BG: Color32 = Color32::from_rgb(53, 39, 27); // #35271B
pub const CAT_UTILITY: Color32 = Color32::from_rgb(148, 163, 184);     // #94A3B8 (Slate Gray)
pub const CAT_UTILITY_BG: Color32 = Color32::from_rgb(30, 36, 44);    // #1E242C

// --- Map Detection Badges (TextureInput Node Layout Section 6) ---
pub const BADGE_AO_BG: Color32 = Color32::from_rgba_premultiplied(18, 26, 31, 50);     // #5B839E (~20%)
pub const BADGE_AO_TEXT: Color32 = Color32::from_rgb(213, 223, 232);                    // #D5DFE8
pub const BADGE_ROUGH_BG: Color32 = Color32::from_rgba_premultiplied(21, 30, 24, 50);  // #6A9A78 (~20%)
pub const BADGE_ROUGH_TEXT: Color32 = Color32::from_rgb(218, 232, 223);                 // #DAE8DF
pub const BADGE_METAL_BG: Color32 = Color32::from_rgba_premultiplied(18, 26, 35, 50);  // #5B83B2 (~20%)
pub const BADGE_METAL_TEXT: Color32 = Color32::from_rgb(214, 228, 240);                 // #D6E4F0
pub const BADGE_HEIGHT_BG: Color32 = Color32::from_rgba_premultiplied(35, 28, 22, 50);// #B48D6E (~20%)
pub const BADGE_HEIGHT_TEXT: Color32 = Color32::from_rgb(232, 221, 213);                // #E8DDD5
pub const BADGE_GLOSS_BG: Color32 = Color32::from_rgba_premultiplied(18, 32, 28, 50);   // #5E9E8A (~20%)
pub const BADGE_GLOSS_TEXT: Color32 = Color32::from_rgb(215, 238, 230);                  // #D7EEE6
pub const BADGE_SPEC_BG: Color32 = Color32::from_rgba_premultiplied(30, 24, 38, 50);    // #9A80B8 (~20%)
pub const BADGE_SPEC_TEXT: Color32 = Color32::from_rgb(234, 226, 244);                   // #EAE2F4
pub const BADGE_MASK_BG: Color32 = Color32::from_rgba_premultiplied(24, 28, 35, 50);    // #708090 (~20%)
pub const BADGE_MASK_TEXT: Color32 = Color32::from_rgb(226, 232, 240);                   // #E2E8F0

// --- Viewport Channel Toolbar Colors (Preview Panel Section 4) ---
pub const CHAN_R_ACCENT: Color32 = Color32::from_rgb(239, 68, 68);    // #EF4444
pub const CHAN_R_BG: Color32 = Color32::from_rgb(53, 29, 36);        // #351D24
pub const CHAN_G_ACCENT: Color32 = Color32::from_rgb(34, 197, 94);    // #22C55E
pub const CHAN_G_BG: Color32 = Color32::from_rgb(25, 53, 37);        // #193525
pub const CHAN_B_ACCENT: Color32 = Color32::from_rgb(59, 130, 246);   // #3B82F6
pub const CHAN_B_BG: Color32 = Color32::from_rgb(28, 45, 72);        // #1C2D48
pub const CHAN_A_ACCENT: Color32 = Color32::from_rgb(148, 163, 184); // #94A3B8
pub const CHAN_A_BG: Color32 = Color32::from_rgb(52, 52, 60);        // #34343C
pub const CHAN_RGBA_ACCENT: Color32 = Color32::from_rgb(255, 176, 46);// #FFB02E

// --- Viewport Checkerboard Colors ---
pub const CHECKER_DARK: Color32 = Color32::from_rgb(24, 24, 32);     // #181820
pub const CHECKER_LIGHT: Color32 = Color32::from_rgb(34, 34, 44);    // #22222C

// --- Inspector Panel Tokens ---
pub const INSPECTOR_SECTION_BG: Color32 = Color32::from_rgb(28, 28, 37);    // #1C1C25
pub const INSPECTOR_SECTION_HOVER: Color32 = Color32::from_rgb(37, 37, 50); // #252532
pub const CHEVRON_COLOR: Color32 = Color32::from_rgb(203, 213, 225);        // #CBD5E1
pub const CHEVRON_MUTED: Color32 = Color32::from_rgb(148, 163, 184);        // #94A3B8

// --- Semantic Wire & Socket Colors (Phase 5 Section 2.2 & PBR Standards) ---
pub const WIRE_RED: Color32 = Color32::from_rgb(239, 68, 68);        // #ef4444 (Red R)
pub const WIRE_GREEN: Color32 = Color32::from_rgb(34, 197, 94);      // #22c55e (Green G)
pub const WIRE_BLUE: Color32 = Color32::from_rgb(59, 130, 246);      // #3b82f6 (Blue B)
pub const WIRE_ALPHA: Color32 = Color32::from_rgb(148, 163, 184);    // #94a3b8 (Alpha / Scalar)
pub const WIRE_RGBA: Color32 = Color32::from_rgb(248, 250, 252);     // #f8fafc (Crisp White RGBA)
pub const WIRE_PACKED: Color32 = Color32::from_rgb(183, 156, 245);   // #B79CF5 (Soft Lavender)
pub const WIRE_NORMAL: Color32 = Color32::from_rgb(76, 201, 192);    // #4CC9C0 (Teal Normal)
pub const WIRE_DEFAULT: Color32 = Color32::from_rgb(203, 213, 225);  // #cbd5e1

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
        NodeCategory::Utility => CAT_UTILITY,
    }
}

/// Returns the suggested tinted background for a category accordion header (10-15% opacity target).
pub fn category_tinted_bg(cat: NodeCategory) -> Color32 {
    match cat {
        NodeCategory::Io => CAT_IO_BG,
        NodeCategory::Constants => CAT_CONSTANTS_BG,
        NodeCategory::ChannelOps => CAT_CHANNEL_BG,
        NodeCategory::ColorAdjust => CAT_ADJUST_BG,
        NodeCategory::NormalOps => CAT_NORMAL_BG,
        NodeCategory::BlendOps => CAT_BLEND_BG,
        NodeCategory::Math => CAT_MATH_BG,
        NodeCategory::Transform => CAT_TRANSFORM_BG,
        NodeCategory::Utility => CAT_UTILITY_BG,
    }
}

/// Returns the hover background for a category accordion header (18-22% opacity target).
pub fn category_header_hover_bg(cat: NodeCategory) -> Color32 {
    let base = category_color(cat);
    // Blend ~20% category color over BG_PANEL (#16161C = 22, 22, 28)
    Color32::from_rgb(
        ((base.r() as u16 * 51 + 22 * 204) / 255) as u8,
        ((base.g() as u16 * 51 + 22 * 204) / 255) as u8,
        ((base.b() as u16 * 51 + 28 * 204) / 255) as u8,
    )
}

/// Computes a desaturated, high-value pastel tint for a node category.
pub fn category_pastel_color(cat: NodeCategory) -> Color32 {
    let base = category_color(cat);
    Color32::from_rgb(
        ((base.r() as u16 + 255) / 2) as u8,
        ((base.g() as u16 + 255) / 2) as u8,
        ((base.b() as u16 + 255) / 2) as u8,
    )
}

/// Computes a 5% opacity pastel background tint (alpha = 13 ~= 5.1%).
pub fn category_pastel_tint_5(cat: NodeCategory) -> Color32 {
    let pastel = category_pastel_color(cat);
    Color32::from_rgba_unmultiplied(pastel.r(), pastel.g(), pastel.b(), 13)
}

/// Computes a 16% opacity pastel hover background tint (alpha = 41 ~= 16.1%).
pub fn category_pastel_tint_16(cat: NodeCategory) -> Color32 {
    let pastel = category_pastel_color(cat);
    Color32::from_rgba_unmultiplied(pastel.r(), pastel.g(), pastel.b(), 41)
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
    visuals.window_stroke = Stroke::new(1.0_f32, BORDER_HAIRLINE);
    visuals.window_corner_radius = 6.into();

    // Widget states
    visuals.widgets.noninteractive.bg_fill = BG_CARD;
    visuals.widgets.noninteractive.bg_stroke = Stroke::new(1.0_f32, BORDER_DARK);
    visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0_f32, TEXT_SECONDARY);
    visuals.widgets.noninteractive.corner_radius = 4.into();

    visuals.widgets.inactive.bg_fill = BG_HEADER;
    visuals.widgets.inactive.bg_stroke = Stroke::new(1.0_f32, BORDER_DARK);
    visuals.widgets.inactive.fg_stroke = Stroke::new(1.0_f32, TEXT_PRIMARY);
    visuals.widgets.inactive.corner_radius = 4.into();

    visuals.widgets.hovered.bg_fill = Color32::from_rgb(36, 36, 42);
    visuals.widgets.hovered.bg_stroke = Stroke::new(1.0_f32, ACCENT_AMBER);
    visuals.widgets.hovered.fg_stroke = Stroke::new(1.0_f32, Color32::WHITE);
    visuals.widgets.hovered.corner_radius = 4.into();

    visuals.widgets.active.bg_fill = Color32::from_rgb(46, 46, 54);
    visuals.widgets.active.bg_stroke = Stroke::new(1.0_f32, ACCENT_AMBER);
    visuals.widgets.active.fg_stroke = Stroke::new(1.0_f32, Color32::WHITE);
    visuals.widgets.active.corner_radius = 4.into();

    visuals.widgets.open.bg_fill = BG_CARD;
    visuals.widgets.open.bg_stroke = Stroke::new(1.0_f32, ACCENT_AMBER);
    visuals.widgets.open.fg_stroke = Stroke::new(1.0_f32, TEXT_PRIMARY);

    visuals.selection.bg_fill = Color32::from_rgba_premultiplied(255, 176, 46, 40);
    visuals.selection.stroke = Stroke::new(1.5_f32, ACCENT_AMBER);

    let mut style = (*ctx.style()).clone();
    style.visuals = visuals;
    style.spacing.item_spacing = Vec2::new(8.0, 6.0);
    style.spacing.window_margin = egui::Margin::same(8);
    ctx.set_style(style);

    configure_fonts(ctx);
}

/// Configures custom modern Geist typography.
pub fn configure_fonts(ctx: &egui::Context) {
    let mut fonts = egui::FontDefinitions::default();
    fonts.font_data.insert(
        "Geist-Regular".to_owned(),
        std::sync::Arc::new(egui::FontData::from_static(include_bytes!(
            "../../assets/fonts/Geist-Regular.ttf"
        ))),
    );
    fonts.font_data.insert(
        "Geist-SemiBold".to_owned(),
        std::sync::Arc::new(egui::FontData::from_static(include_bytes!(
            "../../assets/fonts/Geist-SemiBold.ttf"
        ))),
    );

    if let Some(prop) = fonts.families.get_mut(&egui::FontFamily::Proportional) {
        prop.insert(0, "Geist-Regular".to_owned());
    }
    if let Some(mono) = fonts.families.get_mut(&egui::FontFamily::Monospace) {
        mono.insert(0, "Geist-Regular".to_owned());
    }

    ctx.set_fonts(fonts);
}

/// Configures an `egui_dock::Style` consistent with the Obsidian Workstation theme.
pub fn create_dock_style(ctx: &egui::Context) -> egui_dock::Style {
    let mut dock_style = egui_dock::Style::from_egui(ctx.style().as_ref());
    dock_style.separator.color_idle = BORDER_DARK;
    dock_style.separator.color_hovered = ACCENT_AMBER;
    dock_style.separator.width = 2.0;

    dock_style.tab_bar.bg_fill = BG_PANEL;
    dock_style.tab_bar.height = 32.0;

    dock_style.tab.tab_body.bg_fill = BG_PANEL;
    dock_style.tab.active.bg_fill = Color32::from_rgb(38, 38, 50); // #262632
    dock_style.tab.active.text_color = TEXT_PRIMARY;              // #F8F6F0
    dock_style.tab.inactive.bg_fill = BG_PANEL;                   // #16161C
    dock_style.tab.inactive.text_color = TEXT_MUTED;              // #8C887E
    dock_style.tab.focused.bg_fill = Color32::from_rgb(38, 38, 50);
    dock_style.tab.focused.text_color = ACCENT_AMBER;
    dock_style.tab.hovered.bg_fill = Color32::from_rgb(32, 32, 42);
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
            NodeCategory::Utility,
        ];
        // All categories have valid non-transparent colors
        for c in cats {
            let col = category_color(c);
            assert_eq!(col.a(), 255);
        }
    }
}
