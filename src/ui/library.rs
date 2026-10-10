//! Node Catalog Library & Quick Search Palette (Phase 5).
//!
//! Provides the categorized node catalog browser and the high-speed
//! `Tab`-activated floating search palette with fuzzy filtering.

use egui::{Key, ScrollArea, Stroke, Ui, Vec2};
use crate::nodes::{NodeCategory, NodeDescriptor, NODE_CATALOG};

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

    /// Renders the floating search palette popup.
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
        let modal_size = Vec2::new(340.0, 380.0);
        let center = screen_rect.center();

        egui::Window::new("Quick Spawn Palette (Tab)")
            .fixed_size(modal_size)
            .fixed_pos(center - modal_size * 0.5)
            .collapsible(false)
            .resizable(false)
            .title_bar(true)
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    ui.label("🔍");
                    let text_edit = egui::TextEdit::singleline(&mut self.query)
                        .hint_text("Search nodes by name, type, or hotkey...")
                        .desired_width(280.0);
                    let resp = ui.add(text_edit);
                    if self.just_opened {
                        resp.request_focus();
                        self.just_opened = false;
                    }
                });

                ui.separator();

                // Filter catalog
                let filtered: Vec<&'static NodeDescriptor> = filter_catalog(&self.query);

                if filtered.is_empty() {
                    ui.vertical_centered(|ui| {
                        ui.add_space(30.0);
                        ui.label(
                            egui::RichText::new("No matching nodes found")
                                .color(crate::ui::theme::TEXT_MUTED),
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

                    ScrollArea::vertical().show(ui, |ui| {
                        for (idx, &desc) in filtered.iter().enumerate() {
                            let is_highlighted = idx == self.selected_index;
                            let cat_color = crate::ui::theme::category_color(desc.category);

                            let item_resp = ui.horizontal(|ui| {
                                ui.colored_label(cat_color, "●");
                                ui.strong(
                                    egui::RichText::new(desc.display_name).color(if is_highlighted {
                                        crate::ui::theme::TEXT_ACCENT
                                    } else {
                                        crate::ui::theme::TEXT_PRIMARY
                                    }),
                                );
                                if let Some(key) = desc.hotkey {
                                    ui.with_layout(
                                        egui::Layout::right_to_left(egui::Align::Center),
                                        |ui| {
                                            ui.colored_label(
                                                crate::ui::theme::TEXT_MUTED,
                                                format!("[{}]", key),
                                            );
                                        },
                                    );
                                }
                            });

                            if is_highlighted {
                                let rect = item_resp.response.rect;
                                ui.painter().rect_stroke(
                                    rect,
                                    2.0,
                                    Stroke::new(1.0_f32, crate::ui::theme::BORDER_HIGHLIGHT),
                                    egui::StrokeKind::Inside,
                                );
                            }

                            if item_resp.response.clicked() {
                                spawned = Some((desc, self.canvas_spawn_pos));
                                close_requested = true;
                            }
                        }
                    });
                }
            });

        // Close on escape
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
        ui.horizontal(|ui| {
            ui.label("🔍");
            ui.text_edit_singleline(query);
            if !query.is_empty() && ui.button("✖").clicked() {
                query.clear();
            }
        });

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

                let cat_color = crate::ui::theme::category_color(cat);
                egui::CollapsingHeader::new(
                    egui::RichText::new(format!("● {}", cat))
                        .color(cat_color)
                        .strong(),
                )
                .default_open(true)
                .show(ui, |ui| {
                    for desc in cat_nodes {
                        ui.horizontal(|ui| {
                            ui.label(
                                egui::RichText::new(desc.display_name)
                                    .color(crate::ui::theme::TEXT_PRIMARY),
                            );

                            if let Some(key) = desc.hotkey {
                                ui.colored_label(
                                    crate::ui::theme::TEXT_MUTED,
                                    format!("[{}]", key),
                                );
                            }

                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    if ui.button("+ Add").clicked() {
                                        spawned_desc = Some(desc);
                                    }
                                },
                            );
                        });
                    }
                });
            }
        });
    });

    spawned_desc
}

/// Filters node catalog items based on query substring matches.
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
