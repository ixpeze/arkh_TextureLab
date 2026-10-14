//! Node Card rendering (header, body, sockets, LOD) and channel badge detection.

use egui::{Color32, Painter, Pos2, Rect, Stroke, StrokeKind, Vec2};
use crate::graph::model::{Node, PinId};
use crate::nodes::NodeCategory;
use crate::normalizer::{LexicalNormalizer, PbrRole};
use crate::ui::theme::{
    category_color, category_tinted_bg, pin_wire_color, ACCENT_AMBER, ACCENT_GLOW,
    BADGE_AO_BG, BADGE_AO_TEXT, BADGE_GLOSS_BG, BADGE_GLOSS_TEXT, BADGE_HEIGHT_BG,
    BADGE_HEIGHT_TEXT, BADGE_MASK_BG, BADGE_MASK_TEXT, BADGE_METAL_BG, BADGE_METAL_TEXT,
    BADGE_ROUGH_BG, BADGE_ROUGH_TEXT, BADGE_SPEC_BG, BADGE_SPEC_TEXT, BG_CARD,
    BG_CARD_SELECTED, BG_HEADER, BORDER_DARK, HAIRLINE_ROW_GRAY, TEXT_MUTED, TEXT_PRIMARY,
    TEXT_SECONDARY,
};

/// Level-of-Detail (LOD) render mode based on canvas zoom factor.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NodeLod {
    /// Full parameter and socket cards (zoom > 0.6).
    Full,
    /// Compact card with socket dots and title bar (0.35 <= zoom <= 0.6).
    Compact,
    /// Solid category colored block (zoom < 0.35).
    Block,
}

impl NodeLod {
    pub fn from_zoom(zoom: f32) -> Self {
        if zoom > 0.6 {
            Self::Full
        } else if zoom >= 0.35 {
            Self::Compact
        } else {
            Self::Block
        }
    }
}

/// Dynamically calculates node card width based on title, custom label, and socket name metrics.
pub fn calculate_node_width(node: &Node) -> f32 {
    let title_len = node.node_type.len();
    let label_len = if !node.label.is_empty() && node.label != node.node_type {
        node.label.len()
    } else {
        0
    };
    let max_in_len = node.inputs.iter().map(|p| p.name.len()).max().unwrap_or(0);
    let max_out_len = node.outputs.iter().map(|p| p.name.len()).max().unwrap_or(0);

    let content_len = (title_len.max(label_len)).max(max_in_len + max_out_len);
    (240.0 + (content_len as f32 * 2.0)).clamp(260.0, 280.0)
}

/// Extracts clean texture display filename from a TextureInput node parameter or label.
pub fn get_texture_input_filename(node: &Node) -> String {
    if let Some(path_str) = node
        .get_param("file_path")
        .or_else(|| node.get_param("path"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
    {
        std::path::Path::new(path_str)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(path_str)
            .to_string()
    } else if !node.label.is_empty() && node.label != node.node_type {
        if let Some(pos) = node.label.find(" (") {
            node.label[..pos].to_string()
        } else {
            node.label.clone()
        }
    } else {
        "No texture loaded".to_string()
    }
}

pub type ChannelBadgeTag = (&'static str, Color32, Color32);
pub type ChannelBadgeTuple = (
    Option<ChannelBadgeTag>,
    Option<ChannelBadgeTag>,
    Option<ChannelBadgeTag>,
    Option<ChannelBadgeTag>,
);

/// Dynamically detects token-tags for R, G, B, A connectors from texture filename or label.
/// Returns (R_tag, G_tag, B_tag, A_tag) where each tag is Option<(&'static str, Color32, Color32)>.
pub fn detect_texture_channel_tags(source_name: &str) -> ChannelBadgeTuple {
    let clean = std::path::Path::new(source_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(source_name)
        .trim();

    if clean.is_empty() || clean == "TextureInput" || clean == "No texture loaded" {
        return (None, None, None, None);
    }

    let lower = clean.to_lowercase();
    let stripped = LexicalNormalizer::strip_vendor_prefix(&lower);
    let tokens = LexicalNormalizer::tokenize(&stripped);

    let tag_ao = ("AO", BADGE_AO_BG, BADGE_AO_TEXT);
    let tag_rough = ("Roughness", BADGE_ROUGH_BG, BADGE_ROUGH_TEXT);
    let tag_metal = ("Metal", BADGE_METAL_BG, BADGE_METAL_TEXT);
    let tag_height = ("Height", BADGE_HEIGHT_BG, BADGE_HEIGHT_TEXT);
    let tag_gloss = ("Gloss", BADGE_GLOSS_BG, BADGE_GLOSS_TEXT);
    let tag_spec = ("Specular", BADGE_SPEC_BG, BADGE_SPEC_TEXT);
    let tag_mask = ("Mask", BADGE_MASK_BG, BADGE_MASK_TEXT);

    // 1. Packed map detection (multi-channel)
    let is_token = |kw: &str| tokens.iter().any(|t| t == kw);

    // 1.1 ORMH / AORMH (AO, Rough, Metal, Height)
    if is_token("ormh")
        || is_token("aormh")
        || lower.ends_with("_ormh")
        || lower.ends_with("-ormh")
        || lower.contains("orm_h")
        || (lower.contains("orm") && (lower.contains("height") || lower.contains("disp") || lower.contains("_h")))
    {
        return (Some(tag_ao), Some(tag_rough), Some(tag_metal), Some(tag_height));
    }

    // 1.2 ORM / AORM (AO, Rough, Metal)
    if is_token("orm")
        || is_token("aorm")
        || lower.ends_with("_orm")
        || lower.ends_with("-orm")
        || lower.contains("ao_rough_metal")
    {
        let a_tag = if lower.contains("height") || lower.contains("disp") || lower.ends_with("_h") {
            Some(tag_height)
        } else if lower.contains("mask") || lower.contains("opacity") || lower.contains("alpha") {
            Some(tag_mask)
        } else {
            None
        };
        return (Some(tag_ao), Some(tag_rough), Some(tag_metal), a_tag);
    }

    // 1.3 OGMH / AOGMH (AO, Gloss, Metal, Height)
    if is_token("ogmh") || is_token("aogmh") || lower.ends_with("_ogmh") {
        return (Some(tag_ao), Some(tag_gloss), Some(tag_metal), Some(tag_height));
    }

    // 1.4 OGM / AOGM (AO, Gloss, Metal)
    if is_token("ogm") || is_token("aogm") || lower.ends_with("_ogm") {
        return (Some(tag_ao), Some(tag_gloss), Some(tag_metal), None);
    }

    // 1.5 RMA (Roughness, Metal, AO)
    if is_token("rma") || lower.ends_with("_rma") || lower.contains("rough_metal_ao") {
        let a_tag = if lower.contains("height") || lower.contains("disp") {
            Some(tag_height)
        } else {
            None
        };
        return (Some(tag_rough), Some(tag_metal), Some(tag_ao), a_tag);
    }

    // 1.6 ARM (AO, Roughness, Metal)
    if is_token("arm") || lower.ends_with("_arm") {
        return (Some(tag_ao), Some(tag_rough), Some(tag_metal), None);
    }

    // 1.7 MRA (Metal, Roughness, AO)
    if is_token("mra") || lower.ends_with("_mra") {
        return (Some(tag_metal), Some(tag_rough), Some(tag_ao), None);
    }

    // 1.8 MSRA (Metal, Smoothness/Gloss, Roughness, AO)
    if is_token("msra") || lower.ends_with("_msra") {
        return (Some(tag_metal), Some(tag_gloss), Some(tag_rough), Some(tag_ao));
    }

    // 1.9 Specular + Gloss packed combinations
    if lower.contains("spec_gloss") || lower.contains("specgloss") {
        return (Some(tag_spec), Some(tag_gloss), None, None);
    }
    if lower.contains("gloss_spec") {
        return (Some(tag_gloss), Some(tag_spec), None, None);
    }

    // 2. Single Map or Role-based detection via LexicalNormalizer
    match LexicalNormalizer::infer_role(clean) {
        Some(PbrRole::AmbientOcclusion) => (Some(tag_ao), None, None, None),
        Some(PbrRole::Roughness) => (Some(tag_rough), None, None, None),
        Some(PbrRole::Glossiness) => (Some(tag_gloss), None, None, None),
        Some(PbrRole::Metallic) => (Some(tag_metal), None, None, None),
        Some(PbrRole::Height) => (Some(tag_height), None, None, None),
        Some(PbrRole::Mask) => {
            if lower.contains("spec") {
                (Some(tag_spec), None, None, None)
            } else {
                (Some(tag_mask), None, None, None)
            }
        }
        Some(PbrRole::BaseColor) => {
            let a_tag = if lower.contains("alpha") || lower.contains("opacity") || lower.contains("mask") {
                Some(tag_mask)
            } else if lower.contains("rough") {
                Some(tag_rough)
            } else if lower.contains("gloss") {
                Some(tag_gloss)
            } else if lower.contains("height") || lower.contains("disp") {
                Some(tag_height)
            } else {
                None
            };
            (None, None, None, a_tag)
        }
        Some(PbrRole::Normal) => {
            let a_tag = if lower.contains("rough") {
                Some(tag_rough)
            } else if lower.contains("gloss") {
                Some(tag_gloss)
            } else if lower.contains("height") || lower.contains("disp") {
                Some(tag_height)
            } else {
                None
            };
            (None, None, None, a_tag)
        }
        _ => {
            // Check specific substrings if lexical normalizer returned None
            if lower.contains("specular") || is_token("spec") {
                (Some(tag_spec), None, None, None)
            } else if is_token("ao") || lower.ends_with("_ao") {
                (Some(tag_ao), None, None, None)
            } else if is_token("rough") || is_token("roughness") || lower.ends_with("_rough") {
                (Some(tag_rough), None, None, None)
            } else if is_token("gloss") || is_token("glossiness") || lower.ends_with("_gloss") {
                (Some(tag_gloss), None, None, None)
            } else if is_token("metal") || is_token("metallic") || is_token("metalness") {
                (Some(tag_metal), None, None, None)
            } else if is_token("height") || is_token("disp") || is_token("displacement") {
                (Some(tag_height), None, None, None)
            } else {
                (None, None, None, None)
            }
        }
    }
}

/// Parameters for rendering a node card on canvas.
#[derive(Clone, Copy, Debug)]
pub struct NodeCardRenderParams<'a> {
    pub screen_pos: Pos2,
    pub zoom: f32,
    pub lod: NodeLod,
    pub is_selected: bool,
    pub is_viewport_locked: bool,
    pub hovered_pin_id: Option<&'a PinId>,
}

/// Renders a semi-transparent Comment Box (Unreal Engine style annotation container).
pub fn render_comment_box(
    painter: &Painter,
    node: &Node,
    params: &NodeCardRenderParams<'_>,
) -> (Rect, Vec<(PinId, Pos2)>) {
    let NodeCardRenderParams {
        screen_pos,
        zoom,
        is_selected,
        ..
    } = *params;

    let w = (node.get_float("width", 300.0) * zoom).max(100.0 * zoom);
    let h = (node.get_float("height", 200.0) * zoom).max(60.0 * zoom);
    let rect = Rect::from_min_size(screen_pos, Vec2::new(w, h));
    let corner_r = (8.0 * zoom).clamp(4.0, 10.0);

    let raw_color = node.get_color("color", [0.18, 0.22, 0.28, 0.4]);
    let fill_color = Color32::from_rgba_unmultiplied(
        (raw_color[0] * 255.0).clamp(0.0, 255.0) as u8,
        (raw_color[1] * 255.0).clamp(0.0, 255.0) as u8,
        (raw_color[2] * 255.0).clamp(0.0, 255.0) as u8,
        (raw_color[3] * 255.0).clamp(0.0, 255.0) as u8,
    );

    // 1. Semi-transparent body fill
    painter.rect_filled(rect, corner_r, fill_color);

    // 2. Header banner bar
    let header_h = (28.0 * zoom).max(18.0);
    let header_rect = Rect::from_min_size(screen_pos, Vec2::new(w, header_h));
    let header_fill = Color32::from_rgba_unmultiplied(
        (raw_color[0] * 255.0 * 0.7).clamp(0.0, 255.0) as u8,
        (raw_color[1] * 255.0 * 0.7).clamp(0.0, 255.0) as u8,
        (raw_color[2] * 255.0 * 0.7).clamp(0.0, 255.0) as u8,
        ((raw_color[3] * 255.0 * 1.8).min(235.0)) as u8,
    );
    let r_top = egui::CornerRadius {
        nw: corner_r as u8,
        ne: corner_r as u8,
        sw: 0,
        se: 0,
    };
    painter.rect_filled(header_rect, r_top, header_fill);

    // 3. Perimeter border
    let border_stroke = if is_selected {
        Stroke::new((1.8 * zoom).max(1.2), ACCENT_AMBER)
    } else {
        let border_col = Color32::from_rgba_unmultiplied(
            (raw_color[0] * 255.0 * 1.5).min(255.0) as u8,
            (raw_color[1] * 255.0 * 1.5).min(255.0) as u8,
            (raw_color[2] * 255.0 * 1.5).min(255.0) as u8,
            ((raw_color[3] * 255.0 + 50.0).min(255.0)) as u8,
        );
        Stroke::new(1.0_f32, border_col)
    };
    painter.rect_stroke(rect, corner_r, border_stroke, StrokeKind::Inside);
    painter.line_segment(
        [header_rect.left_bottom(), header_rect.right_bottom()],
        border_stroke,
    );

    // 4. Comment Text Label
    let text = node.get_string("text", if node.label.is_empty() || node.label == "Comment" { "Comment" } else { &node.label });
    let font_id = egui::FontId::proportional((13.0 * zoom).max(9.5));
    let title_pos = Pos2::new(screen_pos.x + 10.0 * zoom, header_rect.center().y);
    painter.text(
        title_pos,
        egui::Align2::LEFT_CENTER,
        text,
        font_id,
        TEXT_PRIMARY,
    );

    // 5. Tactile corner resize handle on bottom-right corner
    let handle_col = if is_selected { ACCENT_AMBER } else { TEXT_MUTED };
    for offset in [4.0, 8.0, 12.0] {
        let p1 = Pos2::new(rect.max.x - offset * zoom, rect.max.y);
        let p2 = Pos2::new(rect.max.x, rect.max.y - offset * zoom);
        painter.line_segment([p1, p2], Stroke::new((1.2 * zoom).max(1.0), handle_col));
    }

    (rect, Vec::new())
}

/// Renders a small 12px circular reroute dot (Unreal Engine style passthrough node).
pub fn render_reroute_dot(
    painter: &Painter,
    node: &Node,
    params: &NodeCardRenderParams<'_>,
) -> (Rect, Vec<(PinId, Pos2)>) {
    let NodeCardRenderParams {
        screen_pos,
        zoom,
        is_selected,
        hovered_pin_id,
        ..
    } = *params;

    let radius = (6.0 * zoom).max(4.0); // 12px diameter base
    let center = screen_pos;
    let rect = Rect::from_center_size(center, Vec2::splat(radius * 2.4));

    // Connection points: input on left, output on right
    let in_pos = Pos2::new(center.x - radius, center.y);
    let out_pos = Pos2::new(center.x + radius, center.y);

    let mut pin_positions = Vec::new();
    if let Some(in_pin) = node.inputs.first() {
        pin_positions.push((in_pin.clone(), in_pos));
    }
    if let Some(out_pin) = node.outputs.first() {
        pin_positions.push((out_pin.clone(), out_pos));
    }

    let wire_col = pin_wire_color("output");
    let is_pin_hovered = hovered_pin_id.is_some_and(|p| p.node_id == node.id);

    // 1. Selection or Hover Outer Glow Ring
    if is_selected {
        painter.circle_stroke(
            center,
            radius + 3.0 * zoom,
            Stroke::new((1.5 * zoom).max(1.2), ACCENT_AMBER),
        );
    } else if is_pin_hovered {
        painter.circle_stroke(
            center,
            radius + 2.5 * zoom,
            Stroke::new((1.2 * zoom).max(1.0), Color32::from_rgba_premultiplied(255, 255, 255, 160)),
        );
    }

    // 2. Dark perimeter backing ring (depth & separation from wires)
    painter.circle_filled(center, radius + 1.2 * zoom, Color32::from_rgb(18, 18, 24));

    // 3. Dot body filled with wire color
    painter.circle_filled(center, radius, wire_col);

    // 4. Subtle inner highlight
    let inner_col = if is_selected || is_pin_hovered {
        Color32::WHITE
    } else {
        Color32::from_rgba_premultiplied(255, 255, 255, 180)
    };
    painter.circle_stroke(center, radius, Stroke::new(1.0_f32, inner_col));

    (rect, pin_positions)
}

/// Renders a single node card according to active LOD level (React/xyflow NodeCard architecture).
pub fn render_node_card(
    painter: &Painter,
    node: &Node,
    params: &NodeCardRenderParams<'_>,
) -> (Rect, Vec<(PinId, Pos2)>) {
    if node.node_type == "Comment" {
        return render_comment_box(painter, node, params);
    }
    if node.node_type == "Reroute" {
        return render_reroute_dot(painter, node, params);
    }

    let NodeCardRenderParams {
        screen_pos,
        zoom,
        lod,
        is_selected,
        is_viewport_locked,
        hovered_pin_id,
    } = *params;
    let cat = infer_category(&node.node_type);
    let cat_col = category_color(cat);

    let mut pin_positions = Vec::new();

    match lod {
        NodeLod::Full => {
            // LOD Full: Complete parameters, category accent bar, socket names & glowing pins
            let is_texture_input = node.node_type == "TextureInput";
            let width = calculate_node_width(node) * zoom;
            let header_height = 36.0 * zoom;
            let (filename_height, texture_galley, texture_filename) = if is_texture_input {
                let filename = get_texture_input_filename(node);
                let max_text_width = (width - 24.0 * zoom).max(80.0 * zoom);
                let font_id = egui::FontId::proportional((11.5 * zoom).max(9.0));
                let galley = painter.layout(filename.clone(), font_id, TEXT_SECONDARY, max_text_width);
                let h = (galley.size().y + 12.0 * zoom).max(30.0 * zoom);
                (h, Some(galley), filename)
            } else {
                (0.0, None, String::new())
            };
            let socket_row_height = if is_texture_input { 34.0 * zoom } else { 24.0 * zoom };
            let max_sockets = node.inputs.len().max(node.outputs.len()).max(1);
            let body_height = filename_height + (max_sockets as f32 * socket_row_height) + 16.0 * zoom;
            let total_height = header_height + body_height;

            let rect = Rect::from_min_size(screen_pos, Vec2::new(width, total_height));
            let corner_r = 6.0 * zoom;

            // 1. Ambient Drop Shadow (Crisp Workstation Depth)
            let shadow_rect = Rect::from_min_size(screen_pos + Vec2::new(0.0, 4.0 * zoom), Vec2::new(width, total_height));
            painter.rect_filled(shadow_rect, corner_r + 2.0 * zoom, Color32::from_black_alpha(80));

            // 2. Selection Glow
            if is_selected {
                let glow_rect = rect.expand(2.5 * zoom);
                painter.rect_stroke(glow_rect, corner_r + 1.5 * zoom, Stroke::new(1.5 * zoom, ACCENT_GLOW), StrokeKind::Outside);
            }

            // 3. Precision High-Contrast Charcoal Card Base
            let bg_col = if is_selected { BG_CARD_SELECTED } else { BG_CARD };
            painter.rect_filled(rect, corner_r, bg_col);

            // 4. Raised Card Header Surface with subtle category tint
            let r_top = egui::CornerRadius {
                nw: corner_r as u8,
                ne: corner_r as u8,
                sw: 0,
                se: 0,
            };
            let header_rect = Rect::from_min_size(screen_pos, Vec2::new(width, header_height));
            painter.rect_filled(header_rect, r_top, BG_HEADER);
            painter.rect_filled(header_rect, r_top, category_tinted_bg(cat));

            // 5. 3.0px Flat Top Category Accent Bar (straight horizontal line, no curl/endpoint flare)
            let cat_bar_h = (3.0 * zoom).max(2.0);
            let cat_bar_rect = Rect::from_min_size(screen_pos, Vec2::new(width, cat_bar_h));
            painter.rect_filled(cat_bar_rect, r_top, cat_col);

            // Header Bottom Separator Line
            painter.line_segment(
                [header_rect.left_bottom(), header_rect.right_bottom()],
                Stroke::new(1.0_f32, BORDER_DARK),
            );

            // Header Category Dot Indicator
            let cat_dot_center = Pos2::new(screen_pos.x + 14.0 * zoom, header_rect.center().y);
            painter.circle_filled(cat_dot_center, 3.5 * zoom, cat_col);

            // Header Title (14px semibold)
            let title_pos = Pos2::new(screen_pos.x + 24.0 * zoom, header_rect.center().y);
            painter.text(
                title_pos,
                egui::Align2::LEFT_CENTER,
                &node.node_type,
                egui::FontId::proportional((13.5 * zoom).max(10.5)),
                TEXT_PRIMARY,
            );

            // Header Viewport Lock Pin Badge (if locked)
            if is_viewport_locked {
                let lock_badge_center = Pos2::new(header_rect.right() - 14.0 * zoom, header_rect.center().y);
                painter.circle_filled(lock_badge_center, 5.5 * zoom, Color32::from_rgba_premultiplied(255, 176, 46, 50));
                painter.circle_stroke(lock_badge_center, 5.5 * zoom, Stroke::new(1.0 * zoom, ACCENT_AMBER));
                painter.circle_filled(lock_badge_center, 2.0 * zoom, ACCENT_AMBER);
            }

            // 6. Perimeter Border Stroke
            let border_stroke = if is_selected {
                Stroke::new(1.5 * zoom.max(1.2), ACCENT_AMBER)
            } else {
                Stroke::new(1.0_f32, BORDER_DARK)
            };
            painter.rect_stroke(rect, corner_r, border_stroke, StrokeKind::Inside);

            if is_texture_input {
                // Dedicated TextureInput Layout
                // Filename sub-row directly beneath header with responsive text wrapping
                let filename_rect = Rect::from_min_size(
                    Pos2::new(screen_pos.x, screen_pos.y + header_height),
                    Vec2::new(width, filename_height),
                );
                painter.rect_filled(filename_rect, egui::CornerRadius::ZERO, Color32::from_rgb(26, 26, 34));

                if let Some(galley) = texture_galley {
                    let text_pos = Pos2::new(
                        screen_pos.x + 12.0 * zoom,
                        filename_rect.min.y + ((filename_height - galley.size().y) * 0.5).max(6.0 * zoom),
                    );
                    painter.galley(text_pos, galley, TEXT_SECONDARY);
                }

                let channel_tags = detect_texture_channel_tags(&texture_filename);

                // Thin divider beneath filename row
                painter.line_segment(
                    [filename_rect.left_bottom(), filename_rect.right_bottom()],
                    Stroke::new(1.0_f32, BORDER_DARK),
                );

                // Socket start Y
                let socket_start_y = screen_pos.y + header_height + filename_height + (socket_row_height * 0.5);

                for (idx, pin) in node.outputs.iter().enumerate() {
                    let pin_y = socket_start_y + idx as f32 * socket_row_height;
                    let pin_x = screen_pos.x + width;
                    let pin_pos = Pos2::new(pin_x, pin_y);
                    pin_positions.push((pin.clone(), pin_pos));

                    let is_hovered = hovered_pin_id == Some(pin);
                    let pin_col = pin_wire_color(&pin.name);
                    let pin_r = if is_hovered { (7.0 * zoom).clamp(5.5, 9.0) } else { (6.0 * zoom).clamp(4.5, 7.5) };

                    // Row hairline divider
                    if idx + 1 < node.outputs.len() {
                        let div_y = pin_y + (socket_row_height * 0.5);
                        painter.line_segment(
                            [
                                Pos2::new(screen_pos.x + 8.0 * zoom, div_y),
                                Pos2::new(screen_pos.x + width - 8.0 * zoom, div_y),
                            ],
                            Stroke::new(1.0_f32, HAIRLINE_ROW_GRAY),
                        );
                    }

                    // Channel letter right aligned column
                    let channel_right_x = pin_x - (16.0 * zoom);
                    let badge_right_x = channel_right_x - (20.0 * zoom);

                    // Dynamic map token tag
                    let badge_info: Option<(&str, Color32, Color32)> = match pin.name.as_str() {
                        "R" => channel_tags.0,
                        "G" => channel_tags.1,
                        "B" => channel_tags.2,
                        "A" => channel_tags.3,
                        _ => None,
                    };

                    if let Some((badge_label, badge_bg, badge_text_col)) = badge_info {
                        let badge_w = match badge_label {
                            "Roughness" => 64.0 * zoom,
                            "Specular" => 58.0 * zoom,
                            "Height" => 46.0 * zoom,
                            "Metal" => 42.0 * zoom,
                            "Gloss" => 42.0 * zoom,
                            "Mask" => 38.0 * zoom,
                            _ => 30.0 * zoom,
                        };
                        let badge_h = 18.0 * zoom;
                        let badge_rect = Rect::from_min_max(
                            Pos2::new(badge_right_x - badge_w, pin_y - badge_h * 0.5),
                            Pos2::new(badge_right_x, pin_y + badge_h * 0.5),
                        );
                        painter.rect_filled(badge_rect, 4.0 * zoom, badge_bg);
                        painter.text(
                            badge_rect.center(),
                            egui::Align2::CENTER_CENTER,
                            badge_label,
                            egui::FontId::proportional((11.0 * zoom).max(8.5)),
                            badge_text_col,
                        );
                    }

                    // Channel letter
                    painter.text(
                        Pos2::new(channel_right_x, pin_y),
                        egui::Align2::RIGHT_CENTER,
                        &pin.name,
                        egui::FontId::proportional((12.0 * zoom).max(9.5)),
                        if is_hovered { TEXT_PRIMARY } else { TEXT_SECONDARY },
                    );

                    // Glowing outer halo when hovered
                    if is_hovered {
                        painter.circle_filled(
                            pin_pos,
                            pin_r + 4.0 * zoom,
                            Color32::from_rgba_premultiplied(pin_col.r(), pin_col.g(), pin_col.b(), 65),
                        );
                    }

                    // Socket pin circle overlapping right border
                    painter.circle_filled(pin_pos, pin_r + 1.5 * zoom, BG_CARD);
                    painter.circle_filled(pin_pos, pin_r, pin_col);
                    let ring_col = if is_hovered { Color32::WHITE } else { BORDER_DARK };
                    let ring_stroke = if is_hovered { 1.8_f32 } else { 1.0_f32 };
                    painter.circle_stroke(pin_pos, pin_r, Stroke::new(ring_stroke, ring_col));

                    if is_hovered {
                        painter.circle_filled(pin_pos, 2.5 * zoom, Color32::WHITE);
                    }
                }
            } else {
                // Standard Node Layout
                let socket_start_y = screen_pos.y + header_height + 14.0 * zoom;
                let row_half_h = socket_row_height * 0.5;

                for row_idx in 0..max_sockets {
                    let pin_y = socket_start_y + row_idx as f32 * socket_row_height;

                    if row_idx + 1 < max_sockets {
                        let divider_y = pin_y + row_half_h;
                        painter.line_segment(
                            [
                                Pos2::new(screen_pos.x + 8.0 * zoom, divider_y),
                                Pos2::new(screen_pos.x + width - 8.0 * zoom, divider_y),
                            ],
                            Stroke::new(1.0_f32, HAIRLINE_ROW_GRAY),
                        );
                    }
                }

                // Inputs
                for (idx, pin) in node.inputs.iter().enumerate() {
                    let pin_y = socket_start_y + idx as f32 * socket_row_height;
                    let pin_x = screen_pos.x;
                    let pin_pos = Pos2::new(pin_x, pin_y);
                    pin_positions.push((pin.clone(), pin_pos));

                    let is_hovered = hovered_pin_id == Some(pin);
                    let pin_col = pin_wire_color(&pin.name);
                    let pin_r = if is_hovered { (7.0 * zoom).clamp(5.5, 9.0) } else { (5.5 * zoom).clamp(4.5, 7.5) };

                    if is_hovered {
                        painter.circle_filled(
                            pin_pos,
                            pin_r + 4.0 * zoom,
                            Color32::from_rgba_premultiplied(pin_col.r(), pin_col.g(), pin_col.b(), 65),
                        );
                    }

                    painter.circle_filled(pin_pos, pin_r + 1.5 * zoom, BG_CARD);
                    painter.circle_filled(pin_pos, pin_r, pin_col);
                    let ring_col = if is_hovered { Color32::WHITE } else { BORDER_DARK };
                    let ring_stroke = if is_hovered { 1.8_f32 } else { 1.0_f32 };
                    painter.circle_stroke(pin_pos, pin_r, Stroke::new(ring_stroke, ring_col));

                    if is_hovered {
                        painter.circle_filled(pin_pos, 2.5 * zoom, Color32::WHITE);
                    }

                    painter.text(
                        pin_pos + Vec2::new(pin_r + 8.0 * zoom, 0.0),
                        egui::Align2::LEFT_CENTER,
                        &pin.name,
                        egui::FontId::proportional((11.5 * zoom).max(9.0)),
                        if is_hovered { TEXT_PRIMARY } else { TEXT_SECONDARY },
                    );
                }

                // Outputs
                for (idx, pin) in node.outputs.iter().enumerate() {
                    let pin_y = socket_start_y + idx as f32 * socket_row_height;
                    let pin_x = screen_pos.x + width;
                    let pin_pos = Pos2::new(pin_x, pin_y);
                    pin_positions.push((pin.clone(), pin_pos));

                    let is_hovered = hovered_pin_id == Some(pin);
                    let pin_col = pin_wire_color(&pin.name);
                    let pin_r = if is_hovered { (7.0 * zoom).clamp(5.5, 9.0) } else { (5.5 * zoom).clamp(4.5, 7.5) };

                    if is_hovered {
                        painter.circle_filled(
                            pin_pos,
                            pin_r + 4.0 * zoom,
                            Color32::from_rgba_premultiplied(pin_col.r(), pin_col.g(), pin_col.b(), 65),
                        );
                    }

                    painter.circle_filled(pin_pos, pin_r + 1.5 * zoom, BG_CARD);
                    painter.circle_filled(pin_pos, pin_r, pin_col);
                    let ring_col = if is_hovered { Color32::WHITE } else { BORDER_DARK };
                    let ring_stroke = if is_hovered { 1.8_f32 } else { 1.0_f32 };
                    painter.circle_stroke(pin_pos, pin_r, Stroke::new(ring_stroke, ring_col));

                    if is_hovered {
                        painter.circle_filled(pin_pos, 2.5 * zoom, Color32::WHITE);
                    }

                    painter.text(
                        pin_pos - Vec2::new(pin_r + 8.0 * zoom, 0.0),
                        egui::Align2::RIGHT_CENTER,
                        &pin.name,
                        egui::FontId::proportional((11.5 * zoom).max(9.0)),
                        if is_hovered { TEXT_PRIMARY } else { TEXT_SECONDARY },
                    );
                }

                if !node.label.is_empty() && node.label != node.node_type {
                    painter.text(
                        Pos2::new(screen_pos.x + 10.0 * zoom, rect.max.y - 7.0 * zoom),
                        egui::Align2::LEFT_BOTTOM,
                        &node.label,
                        egui::FontId::proportional((10.0 * zoom).max(8.0)),
                        TEXT_MUTED,
                    );
                }
            }

            (rect, pin_positions)
        }

        NodeLod::Compact => {
            // LOD Compact: Scaled down card with category bar, title, and pin dots
            let width = (calculate_node_width(node) * 0.75 * zoom).max(130.0 * zoom);
            let height = 48.0 * zoom;
            let rect = Rect::from_min_size(screen_pos, Vec2::new(width, height));
            let corner_r = 4.0 * zoom;

            // Ambient Drop Shadow
            let shadow_rect = Rect::from_min_size(screen_pos + Vec2::new(0.0, 3.0 * zoom), Vec2::new(width, height));
            painter.rect_filled(shadow_rect, corner_r + 1.0 * zoom, Color32::from_black_alpha(70));

            let bg_col = if is_selected { BG_CARD_SELECTED } else { BG_CARD };
            painter.rect_filled(rect, corner_r, bg_col);

            // 3.0px Category Bar with rounded top corners
            let r_top = egui::CornerRadius {
                nw: corner_r as u8,
                ne: corner_r as u8,
                sw: 0,
                se: 0,
            };
            let bar_rect = Rect::from_min_size(screen_pos, Vec2::new(width, (3.0 * zoom).max(2.0)));
            painter.rect_filled(bar_rect, r_top, cat_col);

            // Perimeter Border
            painter.rect_stroke(
                rect,
                corner_r,
                if is_selected {
                    Stroke::new(1.8_f32, ACCENT_AMBER)
                } else {
                    Stroke::new(1.0_f32, BORDER_DARK)
                },
                StrokeKind::Inside,
            );

            // Centered Title
            painter.text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                &node.node_type,
                egui::FontId::proportional((11.0 * zoom).max(8.5)),
                TEXT_PRIMARY,
            );

            // Input Pin Dots
            let in_count = node.inputs.len();
            for (i, pin) in node.inputs.iter().enumerate() {
                let frac = (i + 1) as f32 / (in_count + 1) as f32;
                let pin_pos = Pos2::new(screen_pos.x, screen_pos.y + height * frac);
                pin_positions.push((pin.clone(), pin_pos));

                let is_hovered = hovered_pin_id == Some(pin);
                let pin_r = if is_hovered { 5.5 * zoom } else { 3.5 * zoom };
                if is_hovered {
                    painter.circle_filled(pin_pos, pin_r + 2.5 * zoom, Color32::from_rgba_premultiplied(255, 176, 46, 70));
                }
                painter.circle_filled(pin_pos, pin_r, pin_wire_color(&pin.name));
                if is_hovered {
                    painter.circle_stroke(pin_pos, pin_r, Stroke::new(1.5_f32, Color32::WHITE));
                }
            }

            // Output Pin Dots
            let out_count = node.outputs.len();
            for (i, pin) in node.outputs.iter().enumerate() {
                let frac = (i + 1) as f32 / (out_count + 1) as f32;
                let pin_pos = Pos2::new(screen_pos.x + width, screen_pos.y + height * frac);
                pin_positions.push((pin.clone(), pin_pos));

                let is_hovered = hovered_pin_id == Some(pin);
                let pin_r = if is_hovered { 5.5 * zoom } else { 3.5 * zoom };
                if is_hovered {
                    painter.circle_filled(pin_pos, pin_r + 2.5 * zoom, Color32::from_rgba_premultiplied(255, 176, 46, 70));
                }
                painter.circle_filled(pin_pos, pin_r, pin_wire_color(&pin.name));
                if is_hovered {
                    painter.circle_stroke(pin_pos, pin_r, Stroke::new(1.5_f32, Color32::WHITE));
                }
            }

            (rect, pin_positions)
        }

        NodeLod::Block => {
            // LOD Block: Solid category colored mini card for extreme zoom
            let width = 75.0 * zoom;
            let height = 32.0 * zoom;
            let rect = Rect::from_min_size(screen_pos, Vec2::new(width, height));

            painter.rect_filled(rect, 3.0 * zoom, cat_col);
            if is_selected {
                painter.rect_stroke(rect, 3.0 * zoom, Stroke::new(1.8_f32, ACCENT_AMBER), StrokeKind::Inside);
            }

            let in_pos = Pos2::new(screen_pos.x, screen_pos.y + height * 0.5);
            for pin in &node.inputs {
                pin_positions.push((pin.clone(), in_pos));
            }

            let out_pos = Pos2::new(screen_pos.x + width, screen_pos.y + height * 0.5);
            for pin in &node.outputs {
                pin_positions.push((pin.clone(), out_pos));
            }

            (rect, pin_positions)
        }
    }
}

pub fn infer_category(node_type: &str) -> NodeCategory {
    match node_type {
        "SaveImage" | "TextureInput" | "TextureOutput" | "Input" | "Output" => NodeCategory::Io,
        "ConstantScalar" | "ConstantColor" | "Scalar" | "Color" => NodeCategory::Constants,
        "ChannelCombine" | "ChannelSplit" | "ChannelMixer" | "ChannelPack" | "ChannelUnpack"
        | "SpecGlossToMetalRough" => {
            NodeCategory::ChannelOps
        }
        "Invert" | "Levels" | "BrightnessContrast" => NodeCategory::ColorAdjust,
        "NormalFlipGreen" | "NormalNormalize" | "NormalStrength" | "FlipGreen" => {
            NodeCategory::NormalOps
        }
        "LayerBlend" | "NormalBlendRNM" | "Blend" => NodeCategory::BlendOps,
        "Math" => NodeCategory::Math,
        "Resize" => NodeCategory::Transform,
        "Comment" | "Reroute" => NodeCategory::Utility,
        _ => NodeCategory::Math,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::model::NodeId;

    #[test]
    fn test_node_lod_determination() {
        assert_eq!(NodeLod::from_zoom(1.0), NodeLod::Full);
        assert_eq!(NodeLod::from_zoom(0.7), NodeLod::Full);
        assert_eq!(NodeLod::from_zoom(0.6), NodeLod::Compact);
        assert_eq!(NodeLod::from_zoom(0.4), NodeLod::Compact);
        assert_eq!(NodeLod::from_zoom(0.35), NodeLod::Compact);
        assert_eq!(NodeLod::from_zoom(0.34), NodeLod::Block);
        assert_eq!(NodeLod::from_zoom(0.15), NodeLod::Block);
    }

    #[test]
    fn test_calculate_node_width() {
        // Standard compact node
        let mut node_compact = Node::new(NodeId(1), "Add", "Add", [0.0, 0.0]);
        node_compact.add_input("A");
        node_compact.add_input("B");
        node_compact.add_output("Out");
        let w_compact = calculate_node_width(&node_compact);
        assert!((200.0..=280.0).contains(&w_compact));

        // Node with lengthy custom label
        let mut node_long = Node::new(NodeId(2), "TextureInput", "TextureInput", [0.0, 0.0]);
        node_long.add_output("RGBA");
        node_long.label = "T_Cobblestone_Wall_Very_Long_Identifier_BaseColor".to_string();
        let w_long = calculate_node_width(&node_long);
        assert!(w_long > w_compact);
        assert_eq!(w_long, 280.0, "Clamped to maximum node width 280.0");
    }

    #[test]
    fn test_node_card_horizontal_hairline_dividers() {
        let mut node = Node::new(NodeId(1), "Multiply", "Multiply", [100.0, 100.0]);
        node.add_input("A");
        node.add_input("B");
        node.add_output("Out");

        let zoom = 1.0;
        let screen_pos = Pos2::new(100.0, 100.0);
        let header_height = 36.0 * zoom;
        let socket_row_height = 24.0 * zoom;
        let socket_start_y = screen_pos.y + header_height + 14.0 * zoom;
        let row_half_h = socket_row_height * 0.5;
        let max_sockets = node.inputs.len().max(node.outputs.len());
        assert_eq!(max_sockets, 2);

        // Row 0
        let pin0_y = socket_start_y;
        let row0_top = pin0_y - row_half_h;
        let row0_bottom = pin0_y + row_half_h;
        assert_eq!(row0_top, screen_pos.y + 38.0);
        assert_eq!(row0_bottom, screen_pos.y + 62.0);

        // Row 1
        let pin1_y = socket_start_y + socket_row_height;
        let row1_top = pin1_y - row_half_h;
        let row1_bottom = pin1_y + row_half_h;
        assert_eq!(row1_top, row0_bottom); // Rows seamlessly meet at divider line
        assert_eq!(row1_bottom, screen_pos.y + 86.0);
    }

    #[test]
    fn test_texture_input_node_card_layout() {
        let mut node = Node::new(NodeId(2), "TextureInput", "TextureInput", [100.0, 100.0]);
        node.add_output("output");
        node.add_output("RGBA");
        node.add_output("R");
        node.add_output("G");
        node.add_output("B");
        node.add_output("A");

        assert_eq!(infer_category(&node.node_type), NodeCategory::Io);
        let width = calculate_node_width(&node);
        assert!(width >= 260.0);
    }

    #[test]
    fn test_detect_texture_channel_tags() {
        // 1. Packed ORMH
        let ormh = detect_texture_channel_tags("Anthracite_Concrete_ORMH.png");
        assert_eq!(ormh.0.map(|t| t.0), Some("AO"));
        assert_eq!(ormh.1.map(|t| t.0), Some("Roughness"));
        assert_eq!(ormh.2.map(|t| t.0), Some("Metal"));
        assert_eq!(ormh.3.map(|t| t.0), Some("Height"));

        // 2. Packed ORM
        let orm = detect_texture_channel_tags("Cobblestone_Wall_ORM.png");
        assert_eq!(orm.0.map(|t| t.0), Some("AO"));
        assert_eq!(orm.1.map(|t| t.0), Some("Roughness"));
        assert_eq!(orm.2.map(|t| t.0), Some("Metal"));
        assert_eq!(orm.3.map(|t| t.0), None);

        // 3. Packed RMA
        let rma = detect_texture_channel_tags("T_Rock_RMA.png");
        assert_eq!(rma.0.map(|t| t.0), Some("Roughness"));
        assert_eq!(rma.1.map(|t| t.0), Some("Metal"));
        assert_eq!(rma.2.map(|t| t.0), Some("AO"));
        assert_eq!(rma.3.map(|t| t.0), None);

        // 4. Single Roughness map
        let rough = detect_texture_channel_tags("T_Wood_Roughness.png");
        assert_eq!(rough.0.map(|t| t.0), Some("Roughness"));
        assert_eq!(rough.1.map(|t| t.0), None);
        assert_eq!(rough.2.map(|t| t.0), None);
        assert_eq!(rough.3.map(|t| t.0), None);

        // 5. Single Glossiness map
        let gloss = detect_texture_channel_tags("T_Wood_Gloss.png");
        assert_eq!(gloss.0.map(|t| t.0), Some("Gloss"));
        assert_eq!(gloss.1.map(|t| t.0), None);
        assert_eq!(gloss.2.map(|t| t.0), None);
        assert_eq!(gloss.3.map(|t| t.0), None);

        // 6. Single Specular map
        let spec = detect_texture_channel_tags("T_Character_Specular.png");
        assert_eq!(spec.0.map(|t| t.0), Some("Specular"));
        assert_eq!(spec.1.map(|t| t.0), None);
        assert_eq!(spec.2.map(|t| t.0), None);
        assert_eq!(spec.3.map(|t| t.0), None);

        // 7. BaseColor / Albedo (no false tags)
        let albedo = detect_texture_channel_tags("T_Brick_Albedo.png");
        assert_eq!(albedo.0.map(|t| t.0), None);
        assert_eq!(albedo.1.map(|t| t.0), None);
        assert_eq!(albedo.2.map(|t| t.0), None);
        assert_eq!(albedo.3.map(|t| t.0), None);

        // 8. Normal map (no false tags)
        let normal = detect_texture_channel_tags("T_Brick_Normal.png");
        assert_eq!(normal.0.map(|t| t.0), None);
        assert_eq!(normal.1.map(|t| t.0), None);
        assert_eq!(normal.2.map(|t| t.0), None);
        assert_eq!(normal.3.map(|t| t.0), None);

        // 9. Empty / Default node
        let empty = detect_texture_channel_tags("TextureInput");
        assert_eq!(empty.0.map(|t| t.0), None);
        assert_eq!(empty.1.map(|t| t.0), None);
        assert_eq!(empty.2.map(|t| t.0), None);
        assert_eq!(empty.3.map(|t| t.0), None);
    }

    #[test]
    fn test_texture_input_filename_wrapping() {
        let ctx = egui::Context::default();
        let _ = ctx.run(Default::default(), |ctx| {
            let painter = ctx.layer_painter(egui::LayerId::background());

            let mut node = Node::new(NodeId(2), "TextureInput", "TextureInput", [100.0, 100.0]);
            node.label = "T_Cobblestone_Wall_Very_Long_Identifier_BaseColor_4K_Albedo.png".to_string();

            let filename = get_texture_input_filename(&node);
            assert_eq!(filename, "T_Cobblestone_Wall_Very_Long_Identifier_BaseColor_4K_Albedo.png");

            let zoom = 1.0;
            let width = calculate_node_width(&node) * zoom;
            let max_text_width = (width - 24.0 * zoom).max(80.0 * zoom);
            let font_id = egui::FontId::proportional((11.5 * zoom).max(9.0));

            let galley = painter.layout(filename, font_id, TEXT_SECONDARY, max_text_width);
            let filename_height = (galley.size().y + 12.0 * zoom).max(30.0 * zoom);

            // Verified text wrapping into multiple rows within the node's bounded width
            assert!(galley.rows.len() > 1, "Long texture name should wrap into multiple lines");
            assert!(filename_height > 30.0, "Filename sub-row should expand height to contain wrapped text");
            assert!(galley.size().x <= max_text_width, "Wrapped width should not exceed available width");
        });
    }
}
