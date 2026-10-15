//! Node Catalog Library & Quick Search Palette (React/xyflow SpawnPalette Style).
//!
//! Provides the categorized node catalog browser and the high-speed
//! `Tab`-activated floating search palette with fuzzy filtering, keyboard navigation,
//! and modern Graphite Blueprint aesthetic.

use egui::{Color32, Pos2, Rect, ScrollArea, Sense, Stroke, Ui, Vec2};
use crate::nodes::{NodeCategory, NodeDescriptor, NODE_CATALOG};
use crate::ui::theme::{
    category_color, category_header_hover_bg, category_tinted_bg, ACCENT_AMBER, BG_CARD,
    BG_INSET, BORDER_DARK, BORDER_HOVER, CHEVRON_COLOR, TEXT_MUTED, TEXT_PRIMARY,
};

pub use crate::ui::canvas::search::{filter_catalog, SearchPaletteState};

/// Renders the docking Library panel with grouped categories.
pub fn show_library_panel(
    ui: &mut Ui,
    query: &mut String,
) -> Option<&'static NodeDescriptor> {
    let mut spawned_desc = None;

    ui.vertical(|ui| {
        // Search Input Box (Design Guide Section 2: Height 32px, Radius 5px, BG #121218, Border #3A3A4C)
        let has_query = !query.is_empty();
        egui::Frame::NONE
            .fill(BG_INSET)
            .stroke(Stroke::new(1.0_f32, BORDER_DARK))
            .corner_radius(5.0)
            .inner_margin(egui::Margin::symmetric(8, 5))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(egui::RichText::new("🔍").size(11.0).color(TEXT_MUTED));
                    let desired_w = ui.available_width() - if has_query { 22.0 } else { 0.0 };
                    let text_edit = egui::TextEdit::singleline(query)
                        .hint_text(egui::RichText::new("Search nodes...").color(TEXT_MUTED))
                        .frame(false)
                        .text_color(TEXT_PRIMARY)
                        .desired_width(desired_w);
                    ui.add(text_edit);
                    if has_query && ui.small_button("×").clicked() {
                        query.clear();
                    }
                });
            });

        ui.add_space(4.0);

        ScrollArea::vertical().show(ui, |ui| {
            let categories = [
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

            let query_lower = query.trim().to_lowercase();

            for cat in categories {
                let cat_nodes: Vec<&'static NodeDescriptor> = NODE_CATALOG
                    .iter()
                    .filter(|n| n.category == cat)
                    .filter(|n| {
                        if query_lower.is_empty() {
                            true
                        } else {
                            n.display_name.to_lowercase().contains(&query_lower)
                                || n.type_name.to_lowercase().contains(&query_lower)
                                || n.hotkey.is_some_and(|k| k.to_lowercase().contains(&query_lower))
                        }
                    })
                    .collect();

                if cat_nodes.is_empty() {
                    continue;
                }

                let cat_color = category_color(cat);

                // Custom Accordion Header (Design Guide Section 2: Height 30-32px, full-width tinted background, rotating chevron on right, no dots)
                let accordion_id = ui.make_persistent_id(format!("cat_accordion_{:?}", cat));
                let mut is_open = ui.data_mut(|d| d.get_temp::<bool>(accordion_id)).unwrap_or(true);

                let header_h = 25.0;
                let (header_rect, header_resp) = ui.allocate_exact_size(
                    Vec2::new(ui.available_width(), header_h),
                    Sense::click(),
                );

                if header_resp.clicked() {
                    is_open = !is_open;
                    ui.data_mut(|d| d.insert_temp(accordion_id, is_open));
                }

                let header_bg = if header_resp.hovered() {
                    category_header_hover_bg(cat)
                } else {
                    category_tinted_bg(cat)
                };

                ui.painter().rect_filled(header_rect, 0.0, header_bg);

                // Category name + item count (Aligned left, compact 8px padding)
                ui.painter().text(
                    Pos2::new(header_rect.min.x + 8.0, header_rect.center().y),
                    egui::Align2::LEFT_CENTER,
                    format!("{} ({})", cat, cat_nodes.len()),
                    egui::FontId::proportional(11.5),
                    cat_color,
                );

                // Chevron (Aligned right with smooth rotation)
                let ch_x = header_rect.max.x - 12.0;
                let ch_y = header_rect.center().y;
                let chevron_stroke = Stroke::new(1.2_f32, CHEVRON_COLOR);
                if is_open {
                    // Down chevron
                    ui.painter().line_segment(
                        [Pos2::new(ch_x - 3.0, ch_y - 1.5), Pos2::new(ch_x, ch_y + 1.5)],
                        chevron_stroke,
                    );
                    ui.painter().line_segment(
                        [Pos2::new(ch_x, ch_y + 1.5), Pos2::new(ch_x + 3.0, ch_y - 1.5)],
                        chevron_stroke,
                    );
                } else {
                    // Right chevron
                    ui.painter().line_segment(
                        [Pos2::new(ch_x - 1.5, ch_y - 3.0), Pos2::new(ch_x + 1.5, ch_y)],
                        chevron_stroke,
                    );
                    ui.painter().line_segment(
                        [Pos2::new(ch_x + 1.5, ch_y), Pos2::new(ch_x - 1.5, ch_y + 3.0)],
                        chevron_stroke,
                    );
                }

                if is_open {
                    ui.add_space(2.0);
                    for (item_idx, &desc) in cat_nodes.iter().enumerate() {
                        let desired_size = Vec2::new(ui.available_width(), 23.0);
                        let (rect, resp) = ui.allocate_at_least(desired_size, Sense::click_and_drag());

                        let is_hovered = resp.hovered();
                        let is_dragged = resp.dragged();

                        // Visual feedback on hover and drag
                        if is_dragged {
                            ui.ctx().set_cursor_icon(egui::CursorIcon::Grabbing);
                        } else if is_hovered {
                            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                        }

                        // Background with subtle horizontal banding:
                        // Even rows: BG_CARD (#20202A), Odd rows: #242432, Hover: #2A2A3A
                        let bg_fill = if is_dragged {
                            Color32::from_rgb(46, 46, 62)
                        } else if is_hovered {
                            Color32::from_rgb(38, 38, 52)
                        } else if item_idx % 2 == 1 {
                            Color32::from_rgb(34, 34, 46)
                        } else {
                            BG_CARD
                        };

                        let stroke = if is_dragged {
                            Stroke::new(1.0_f32, ACCENT_AMBER)
                        } else if is_hovered {
                            Stroke::new(1.0_f32, BORDER_HOVER)
                        } else {
                            Stroke::new(1.0_f32, BORDER_DARK)
                        };

                        ui.painter().rect_filled(rect, 3.0, bg_fill);
                        ui.painter().rect_stroke(rect, 3.0, stroke, egui::StrokeKind::Inside);

                        // 2.5px Category Left Accent Bar
                        let accent_rect = Rect::from_min_size(rect.min, Vec2::new(2.5, rect.height()));
                        ui.painter().rect_filled(
                            accent_rect,
                            egui::CornerRadius { nw: 3, ne: 0, sw: 3, se: 0 },
                            cat_color,
                        );

                        // Node Name Label
                        let text_color = if is_hovered || is_dragged {
                            Color32::WHITE
                        } else {
                            TEXT_PRIMARY
                        };
                        ui.painter().text(
                            Pos2::new(rect.min.x + 8.0, rect.center().y),
                            egui::Align2::LEFT_CENTER,
                            desc.display_name,
                            egui::FontId::proportional(11.0),
                            text_color,
                        );

                        // Keyboard Shortcut Badge on right edge
                        if let Some(key) = desc.hotkey {
                            let pill_rect = Rect::from_center_size(
                                Pos2::new(rect.max.x - 14.0, rect.center().y),
                                Vec2::new(18.0, 14.0),
                            );
                            ui.painter().rect_filled(pill_rect, 3.0, Color32::from_rgb(44, 44, 58));
                            ui.painter().rect_stroke(
                                pill_rect,
                                3.0,
                                Stroke::new(1.0_f32, Color32::from_rgb(64, 64, 80)),
                                egui::StrokeKind::Inside,
                            );
                            ui.painter().text(
                                pill_rect.center(),
                                egui::Align2::CENTER_CENTER,
                                format!("[{}]", key),
                                egui::FontId::proportional(9.0),
                                if is_hovered { ACCENT_AMBER } else { CHEVRON_COLOR },
                            );
                        }

                        // Click spawns node
                        if resp.clicked() {
                            spawned_desc = Some(desc);
                        }

                        // Drag payload setup
                        if resp.drag_started() {
                            egui::DragAndDrop::set_payload(ui.ctx(), desc.type_name.to_string());
                        }

                        ui.add_space(1.5);
                    }
                    ui.add_space(3.0);
                }
            }
        });
    });

    spawned_desc
}



#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_catalog_queries() {
        let all = filter_catalog("");
        assert_eq!(all.len(), NODE_CATALOG.len());

        let math = filter_catalog("math");
        assert!(math.iter().any(|n| n.type_name == "Math"));

        let split = filter_catalog("split");
        assert!(split.iter().any(|n| n.type_name == "ChannelSplit"));

        let hotkey_m = filter_catalog("M");
        assert!(hotkey_m.iter().any(|n| n.hotkey == Some("M")));
    }

    #[test]
    fn test_search_palette_open_close() {
        let mut palette = SearchPaletteState::new();
        assert!(!palette.is_open);

        palette.open_at([150.0, 250.0]);
        assert!(palette.is_open);
        assert_eq!(palette.canvas_spawn_pos, [150.0, 250.0]);
        assert!(palette.just_opened);

        palette.close();
        assert!(!palette.is_open);
    }
}
