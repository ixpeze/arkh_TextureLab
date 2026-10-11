//! Node Catalog Library & Quick Search Palette (React/xyflow SpawnPalette Style).
//!
//! Provides the categorized node catalog browser and the high-speed
//! `Tab`-activated floating search palette with fuzzy filtering, keyboard navigation,
//! and modern Graphite Blueprint aesthetic.

use egui::{Color32, Key, Pos2, Rect, ScrollArea, Sense, Stroke, Ui, Vec2};
use crate::nodes::{NodeCategory, NodeDescriptor, NODE_CATALOG};
use crate::ui::theme::{
    category_color, ACCENT_AMBER, BG_CARD, BORDER_DARK, TEXT_MUTED, TEXT_PRIMARY,
    TEXT_SECONDARY,
};

/// State for the floating quick-search palette (`Tab` key).
pub struct SearchPaletteState {
    pub is_open: bool,
    pub query: String,
    pub selected_index: usize,
    pub canvas_spawn_pos: [f32; 2],
    pub just_opened: bool,
}

impl Default for SearchPaletteState {
    fn default() -> Self {
        Self {
            is_open: false,
            query: String::new(),
            selected_index: 0,
            canvas_spawn_pos: [0.0, 0.0],
            just_opened: false,
        }
    }
}

impl SearchPaletteState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn open_at(&mut self, canvas_pos: [f32; 2]) {
        self.is_open = true;
        self.query.clear();
        self.selected_index = 0;
        self.canvas_spawn_pos = canvas_pos;
        self.just_opened = true;
    }

    pub fn close(&mut self) {
        self.is_open = false;
        self.query.clear();
        self.selected_index = 0;
    }

    /// Renders the floating search palette popup (frameless glassmorphic card).
    /// Returns `Some((descriptor, canvas_pos))` if a node was selected for spawning.
    pub fn show(
        &mut self,
        ctx: &egui::Context,
    ) -> Option<(&'static NodeDescriptor, [f32; 2])> {
        if !self.is_open {
            return None;
        }

        let mut spawned = None;
        let mut close_requested = false;

        let screen_rect = ctx.screen_rect();
        let modal_size = Vec2::new(360.0, 400.0);
        let center = screen_rect.center();

        egui::Window::new("spawn_palette_window")
            .fixed_size(modal_size)
            .fixed_pos(center - modal_size * 0.5)
            .collapsible(false)
            .resizable(false)
            .title_bar(false)
            .frame(
                egui::Frame::window(&ctx.style())
                    .fill(BG_CARD)
                    .stroke(Stroke::new(1.5_f32, ACCENT_AMBER))
                    .corner_radius(8.0)
                    .inner_margin(12.0)
            )
            .show(ctx, |ui| {
                // Top Search Bar
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new("Search")
                            .color(ACCENT_AMBER)
                            .size(13.0)
                            .strong(),
                    );
                    let text_edit = egui::TextEdit::singleline(&mut self.query)
                        .hint_text("Find nodes...")
                        .desired_width(260.0);
                    let resp = ui.add(text_edit);
                    if self.just_opened {
                        resp.request_focus();
                        self.just_opened = false;
                    }

                    if ui.small_button("x").clicked() {
                        close_requested = true;
                    }
                });

                ui.add_space(4.0);
                ui.separator();
                ui.add_space(4.0);

                // Filter catalog
                let filtered: Vec<&'static NodeDescriptor> = filter_catalog(&self.query);

                if filtered.is_empty() {
                    ui.vertical_centered(|ui| {
                        ui.add_space(40.0);
                        ui.label(
                            egui::RichText::new("No matching nodes found")
                                .color(TEXT_MUTED)
                                .size(12.0),
                        );
                    });
                } else {
                    // Keyboard navigation
                    if ui.input(|i| i.key_pressed(Key::ArrowDown)) {
                        self.selected_index = (self.selected_index + 1) % filtered.len();
                    }
                    if ui.input(|i| i.key_pressed(Key::ArrowUp)) {
                        self.selected_index = if self.selected_index == 0 {
                            filtered.len().saturating_sub(1)
                        } else {
                            self.selected_index - 1
                        };
                    }
                    if ui.input(|i| i.key_pressed(Key::Enter)) {
                        if let Some(&desc) = filtered.get(self.selected_index) {
                            spawned = Some((desc, self.canvas_spawn_pos));
                            close_requested = true;
                        }
                    }

                    if self.selected_index >= filtered.len() {
                        self.selected_index = 0;
                    }

                    ScrollArea::vertical().max_height(320.0).show(ui, |ui| {
                        for (idx, &desc) in filtered.iter().enumerate() {
                            let is_highlighted = idx == self.selected_index;
                            let cat_color = category_color(desc.category);

                            let desired_size = Vec2::new(ui.available_width(), 26.0);
                            let (rect, resp) = ui.allocate_at_least(desired_size, Sense::click());

                            let is_hovered = resp.hovered();
                            let is_active = is_highlighted || is_hovered;

                            let bg_fill = if is_active {
                                Color32::from_rgb(42, 42, 58)
                            } else {
                                Color32::from_rgb(28, 28, 38)
                            };
                            let stroke = if is_active {
                                Stroke::new(1.0_f32, ACCENT_AMBER)
                            } else {
                                Stroke::new(1.0_f32, BORDER_DARK)
                            };

                            ui.painter().rect_filled(rect, 4.0, bg_fill);
                            ui.painter().rect_stroke(rect, 4.0, stroke, egui::StrokeKind::Inside);

                            // Left Category Accent Bar
                            let accent_rect = Rect::from_min_size(rect.min, Vec2::new(3.5, rect.height()));
                            ui.painter().rect_filled(
                                accent_rect,
                                egui::CornerRadius { nw: 4, ne: 0, sw: 4, se: 0 },
                                cat_color,
                            );

                            // Category Dot
                            ui.painter().circle_filled(Pos2::new(rect.min.x + 12.0, rect.center().y), 3.0, cat_color);

                            // Node Display Name
                            ui.painter().text(
                                Pos2::new(rect.min.x + 22.0, rect.center().y),
                                egui::Align2::LEFT_CENTER,
                                desc.display_name,
                                egui::FontId::proportional(12.0),
                                if is_active { Color32::WHITE } else { TEXT_PRIMARY },
                            );

                            // Category tag
                            ui.painter().text(
                                Pos2::new(rect.min.x + 150.0, rect.center().y),
                                egui::Align2::LEFT_CENTER,
                                format!("({})", desc.category),
                                egui::FontId::proportional(10.0),
                                TEXT_MUTED,
                            );

                            // Hotkey keycap tag on right
                            if let Some(key) = desc.hotkey {
                                let pill_rect = Rect::from_center_size(
                                    Pos2::new(rect.max.x - 16.0, rect.center().y),
                                    Vec2::new(22.0, 16.0),
                                );
                                ui.painter().rect_filled(pill_rect, 3.0, Color32::from_rgb(36, 36, 48));
                                ui.painter().rect_stroke(
                                    pill_rect,
                                    3.0,
                                    Stroke::new(1.0_f32, if is_active { ACCENT_AMBER } else { BORDER_DARK }),
                                    egui::StrokeKind::Inside,
                                );
                                ui.painter().text(
                                    pill_rect.center(),
                                    egui::Align2::CENTER_CENTER,
                                    format!("[{}]", key),
                                    egui::FontId::proportional(9.5),
                                    if is_active { ACCENT_AMBER } else { TEXT_SECONDARY },
                                );
                            }

                            if resp.clicked() {
                                spawned = Some((desc, self.canvas_spawn_pos));
                                close_requested = true;
                            }

                            ui.add_space(2.0);
                        }
                    });
                }
            });

        // Close on escape or tab
        if ctx.input(|i| i.key_pressed(Key::Escape)) || close_requested {
            self.close();
        }

        spawned
    }
}

/// Renders the docking Library panel with grouped categories.
pub fn show_library_panel(
    ui: &mut Ui,
    query: &mut String,
) -> Option<&'static NodeDescriptor> {
    let mut spawned_desc = None;

    ui.vertical(|ui| {
        // Search bar
        ui.horizontal(|ui| {
            let has_query = !query.is_empty();
            let desired_w = ui.available_width() - if has_query { 24.0 } else { 0.0 };
            let text_edit = egui::TextEdit::singleline(query)
                .hint_text("Search library nodes...")
                .desired_width(desired_w);
            ui.add(text_edit);
            if has_query && ui.small_button("x").clicked() {
                query.clear();
            }
        });

        ui.add_space(3.0);
        ui.separator();

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
                                || n.hotkey.map_or(false, |k| k.to_lowercase().contains(&query_lower))
                        }
                    })
                    .collect();

                if cat_nodes.is_empty() {
                    continue;
                }

                let cat_color = category_color(cat);

                egui::CollapsingHeader::new(
                    egui::RichText::new(format!("● {} ({})", cat, cat_nodes.len()))
                        .color(cat_color)
                        .size(12.5)
                        .strong(),
                )
                .default_open(true)
                .show(ui, |ui| {
                    for &desc in &cat_nodes {
                        let desired_size = Vec2::new(ui.available_width(), 26.0);
                        let (rect, resp) = ui.allocate_at_least(desired_size, Sense::click_and_drag());

                        let is_hovered = resp.hovered();
                        let is_dragged = resp.dragged();

                        // Visual feedback on hover and drag
                        if is_dragged {
                            ui.ctx().set_cursor_icon(egui::CursorIcon::Grabbing);
                        } else if is_hovered {
                            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                        }

                        // Background: High-contrast tactile card surface (idle, hover, dragged)
                        let bg_fill = if is_dragged {
                            Color32::from_rgb(52, 52, 72)
                        } else if is_hovered {
                            Color32::from_rgb(42, 42, 58)
                        } else {
                            Color32::from_rgb(28, 28, 38)
                        };

                        let stroke = if is_dragged || is_hovered {
                            Stroke::new(1.0_f32, ACCENT_AMBER)
                        } else {
                            Stroke::new(1.0_f32, BORDER_DARK)
                        };

                        ui.painter().rect_filled(rect, 4.0, bg_fill);
                        ui.painter().rect_stroke(rect, 4.0, stroke, egui::StrokeKind::Inside);

                        // 3.5px Category Left Accent Bar
                        let accent_rect = Rect::from_min_size(rect.min, Vec2::new(3.5, rect.height()));
                        ui.painter().rect_filled(
                            accent_rect,
                            egui::CornerRadius { nw: 4, ne: 0, sw: 4, se: 0 },
                            cat_color,
                        );

                        // Category Dot Indicator
                        ui.painter().circle_filled(Pos2::new(rect.min.x + 12.0, rect.center().y), 3.0, cat_color);

                        // Node Name Label (High Contrast)
                        let text_color = if is_hovered || is_dragged {
                            Color32::WHITE
                        } else {
                            TEXT_PRIMARY
                        };
                        ui.painter().text(
                            Pos2::new(rect.min.x + 22.0, rect.center().y),
                            egui::Align2::LEFT_CENTER,
                            desc.display_name,
                            egui::FontId::proportional(12.0),
                            text_color,
                        );

                        // Hotkey keycap tag on right
                        if let Some(key) = desc.hotkey {
                            let pill_rect = Rect::from_center_size(
                                Pos2::new(rect.max.x - 16.0, rect.center().y),
                                Vec2::new(22.0, 16.0),
                            );
                            ui.painter().rect_filled(pill_rect, 3.0, Color32::from_rgb(36, 36, 48));
                            ui.painter().rect_stroke(
                                pill_rect,
                                3.0,
                                Stroke::new(1.0_f32, if is_hovered { ACCENT_AMBER } else { BORDER_DARK }),
                                egui::StrokeKind::Inside,
                            );
                            ui.painter().text(
                                pill_rect.center(),
                                egui::Align2::CENTER_CENTER,
                                format!("[{}]", key),
                                egui::FontId::proportional(9.5),
                                if is_hovered { ACCENT_AMBER } else { TEXT_SECONDARY },
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

                        ui.add_space(2.0);
                    }
                });
            }
        });
    });

    spawned_desc
}

/// Filters the node catalog based on a text query.
pub fn filter_catalog(query: &str) -> Vec<&'static NodeDescriptor> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return NODE_CATALOG.iter().collect();
    }

    NODE_CATALOG
        .iter()
        .filter(|n| {
            n.display_name.to_lowercase().contains(&q)
                || n.type_name.to_lowercase().contains(&q)
                || n.category.to_string().to_lowercase().contains(&q)
                || n.hotkey.map_or(false, |k| k.to_lowercase().contains(&q))
        })
        .collect()
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
