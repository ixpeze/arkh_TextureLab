//! User preferences modal dialog and hotkey remap manager (Phase 2 & Phase 5).
//!
//! Provides a DCC-grade modal configuration window with sections for
//! General (default resolution, export directory, autosave), Hotkeys (two-column
//! remap table with row-level resets), and Appearance (accent color swatches).

use egui::{Color32, RichText, Stroke, StrokeKind, Ui, Vec2};
use crate::hotkeys::{default_hotkey_table, parse_key_chord};
use crate::settings::{AppSettings, DEFAULT_ACCENT_COLOR, DEFAULT_AUTOSAVE_INTERVAL_SECS, DEFAULT_RESOLUTION};
use crate::ui::theme::{rgb_to_color32, BG_CARD, BG_HEADER, BORDER_DARK, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY};

/// Active category tab within the preferences modal dialog.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PreferencesSection {
    General,
    Hotkeys,
    Appearance,
}

/// Action emitted when closing or submitting the preferences modal dialog.
#[derive(Clone, Debug, PartialEq)]
pub enum PreferencesDialogResult {
    /// Save draft settings and write to disk (`settings.json`).
    Save(AppSettings),
    /// Discard all modifications and close.
    Cancel,
}

/// Interactive state controller for the modal preferences dialog.
pub struct PreferencesDialog {
    pub is_open: bool,
    pub active_section: PreferencesSection,
    pub draft_settings: AppSettings,
    pub hotkey_filter: String,
}

impl Default for PreferencesDialog {
    fn default() -> Self {
        Self::new()
    }
}

impl PreferencesDialog {
    /// Creates a new inactive preferences dialog instance.
    pub fn new() -> Self {
        Self {
            is_open: false,
            active_section: PreferencesSection::General,
            draft_settings: AppSettings::default(),
            hotkey_filter: String::new(),
        }
    }

    /// Opens the modal dialog initialized with a working copy of the current active settings.
    pub fn open(&mut self, current: &AppSettings) {
        self.is_open = true;
        self.draft_settings = current.clone();
        self.hotkey_filter.clear();
    }

    /// Closes the dialog immediately.
    pub fn close(&mut self) {
        self.is_open = false;
    }

    /// Renders the modal window on the given egui context.
    ///
    /// Returns `Some(PreferencesDialogResult::Save(settings))` or `Some(PreferencesDialogResult::Cancel)`.
    pub fn show(&mut self, ctx: &egui::Context) -> Option<PreferencesDialogResult> {
        if !self.is_open {
            return None;
        }

        let mut result = None;
        let mut close_dialog = false;

        let accent_color = rgb_to_color32(self.draft_settings.accent_color);

        egui::Window::new("Preferences")
            .collapsible(false)
            .resizable(true)
            .default_width(640.0)
            .default_height(500.0)
            .min_width(520.0)
            .min_height(400.0)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                ui.spacing_mut().item_spacing = Vec2::new(8.0, 8.0);

                // --- 1. Section Header Tabs ---
                ui.horizontal(|ui| {
                    for section in &[
                        PreferencesSection::General,
                        PreferencesSection::Hotkeys,
                        PreferencesSection::Appearance,
                    ] {
                        let is_active = self.active_section == *section;
                        let text = match section {
                            PreferencesSection::General => "General",
                            PreferencesSection::Hotkeys => "Hotkeys",
                            PreferencesSection::Appearance => "Appearance",
                        };

                        let label = if is_active {
                            RichText::new(text).color(accent_color).strong()
                        } else {
                            RichText::new(text).color(TEXT_SECONDARY)
                        };

                        if ui.selectable_label(is_active, label).clicked() {
                            self.active_section = *section;
                        }
                    }
                });

                ui.separator();

                // --- 2. Active Section Body ---
                ui.allocate_ui_with_layout(
                    Vec2::new(ui.available_width(), ui.available_height() - 44.0),
                    egui::Layout::top_down(egui::Align::Min),
                    |ui| match self.active_section {
                        PreferencesSection::General => {
                            self.render_general_section(ui, accent_color);
                        }
                        PreferencesSection::Hotkeys => {
                            self.render_hotkeys_section(ui, accent_color);
                        }
                        PreferencesSection::Appearance => {
                            self.render_appearance_section(ui, accent_color);
                        }
                    },
                );

                ui.separator();

                // --- 3. Modal Action Buttons: [Reset Defaults] ... [Cancel] [Save] ---
                ui.horizontal(|ui| {
                    if ui.button("Reset to Defaults").clicked() {
                        self.draft_settings = AppSettings::default();
                    }

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        // Save Button (Primary Accent)
                        let save_btn = ui.add(
                            egui::Button::new(
                                RichText::new("Save")
                                    .color(Color32::from_rgb(16, 16, 19))
                                    .strong(),
                            )
                            .fill(accent_color)
                            .min_size(Vec2::new(80.0, 24.0)),
                        );

                        if save_btn.clicked() {
                            result = Some(PreferencesDialogResult::Save(self.draft_settings.clone()));
                            close_dialog = true;
                        }

                        // Cancel Button
                        if ui.add(egui::Button::new("Cancel").min_size(Vec2::new(70.0, 24.0))).clicked() {
                            result = Some(PreferencesDialogResult::Cancel);
                            close_dialog = true;
                        }
                    });
                });
            });

        if close_dialog {
            self.is_open = false;
        }

        result
    }

    /// Renders General preferences: resolution, export directory, autosave interval.
    fn render_general_section(&mut self, ui: &mut Ui, accent_color: Color32) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            ui.add_space(4.0);

            // Resolution Presets
            ui.group(|ui| {
                ui.label(RichText::new("Default Resolution").color(accent_color).strong());
                ui.label(
                    RichText::new("Initial buffer dimension for newly spawned graphs and evaluation passes.")
                        .color(TEXT_MUTED)
                        .size(11.0),
                );
                ui.add_space(4.0);

                ui.horizontal(|ui| {
                    let (w, h) = self.draft_settings.default_resolution;

                    let presets = [
                        (512, 512, "512"),
                        (1024, 1024, "1K"),
                        (2048, 2048, "2K (Default)"),
                        (4096, 4096, "4K"),
                        (8192, 8192, "8K"),
                    ];

                    for (pw, ph, label) in presets {
                        let selected = w == pw && h == ph;
                        if ui.selectable_label(selected, label).clicked() {
                            self.draft_settings.default_resolution = (pw, ph);
                        }
                    }
                });

                ui.add_space(4.0);
                ui.horizontal(|ui| {
                    ui.label("Custom Width:");
                    let mut w = self.draft_settings.default_resolution.0;
                    if ui.add(egui::DragValue::new(&mut w).range(64..=16384).speed(64)).changed() {
                        self.draft_settings.default_resolution.0 = w;
                    }

                    ui.label("Height:");
                    let mut h = self.draft_settings.default_resolution.1;
                    if ui.add(egui::DragValue::new(&mut h).range(64..=16384).speed(64)).changed() {
                        self.draft_settings.default_resolution.1 = h;
                    }

                    if (w, h) != DEFAULT_RESOLUTION && ui.button("Reset").clicked() {
                        self.draft_settings.default_resolution = DEFAULT_RESOLUTION;
                    }
                });
            });

            ui.add_space(8.0);

            // Export Directory
            ui.group(|ui| {
                ui.label(RichText::new("Default Export Directory").color(accent_color).strong());
                ui.label(
                    RichText::new("Optional global export folder for direct-to-disk texture generation.")
                        .color(TEXT_MUTED)
                        .size(11.0),
                );
                ui.add_space(4.0);

                ui.horizontal(|ui| {
                    let mut path_str = self
                        .draft_settings
                        .export_directory
                        .clone()
                        .unwrap_or_default();

                    let text_edit = ui.add(
                        egui::TextEdit::singleline(&mut path_str)
                            .hint_text("None (use relative exports/ folder)")
                            .desired_width(360.0),
                    );

                    if text_edit.changed() {
                        if path_str.trim().is_empty() {
                            self.draft_settings.export_directory = None;
                        } else {
                            self.draft_settings.export_directory = Some(path_str.trim().to_string());
                        }
                    }

                    if ui.button("Browse...").clicked() {
                        if let Some(folder) = rfd::FileDialog::new().pick_folder() {
                            self.draft_settings.export_directory =
                                Some(folder.to_string_lossy().to_string());
                        }
                    }

                    if self.draft_settings.export_directory.is_some() && ui.button("Clear").clicked() {
                        self.draft_settings.export_directory = None;
                    }
                });
            });

            ui.add_space(8.0);

            // Autosave Interval
            ui.group(|ui| {
                ui.label(RichText::new("Autosave Interval").color(accent_color).strong());
                ui.label(
                    RichText::new("Frequency for background project recovery checkpoints.")
                        .color(TEXT_MUTED)
                        .size(11.0),
                );
                ui.add_space(4.0);

                ui.horizontal(|ui| {
                    let mut secs = self.draft_settings.autosave_interval_secs;
                    if ui
                        .add(
                            egui::Slider::new(&mut secs, 30..=1800)
                                .text("seconds")
                                .suffix("s"),
                        )
                        .changed()
                    {
                        self.draft_settings.autosave_interval_secs = secs;
                    }

                    let mins = secs as f64 / 60.0;
                    ui.label(
                        RichText::new(format!("({:.1} min)", mins))
                            .color(TEXT_MUTED),
                    );

                    if secs != DEFAULT_AUTOSAVE_INTERVAL_SECS && ui.button("Reset").clicked() {
                        self.draft_settings.autosave_interval_secs = DEFAULT_AUTOSAVE_INTERVAL_SECS;
                    }
                });
            });
        });
    }

    /// Renders Hotkeys section: two-column table with search and per-row reset.
    fn render_hotkeys_section(&mut self, ui: &mut Ui, accent_color: Color32) {
        ui.horizontal(|ui| {
            ui.label("Filter:");
            ui.add(
                egui::TextEdit::singleline(&mut self.hotkey_filter)
                    .hint_text("Search action or key...")
                    .desired_width(200.0),
            );

            if !self.hotkey_filter.is_empty() && ui.button("Clear").clicked() {
                self.hotkey_filter.clear();
            }

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let override_count = self.draft_settings.hotkey_overrides.len();
                if override_count > 0 {
                    ui.label(
                        RichText::new(format!("{} override(s)", override_count))
                            .color(accent_color)
                            .size(11.0),
                    );

                    if ui.button("Reset All Hotkeys").clicked() {
                        self.draft_settings.hotkey_overrides.clear();
                    }
                }
            });
        });

        ui.add_space(4.0);

        let table = default_hotkey_table();
        let query = self.hotkey_filter.trim().to_lowercase();

        egui::ScrollArea::vertical()
            .auto_shrink([false, false])
            .show(ui, |ui| {
                egui::Grid::new("hotkeys_remap_grid")
                    .num_columns(3)
                    .spacing([16.0, 6.0])
                    .striped(true)
                    .min_col_width(180.0)
                    .show(ui, |ui| {
                        // Header Row
                        ui.label(RichText::new("Action").color(TEXT_SECONDARY).strong());
                        ui.label(RichText::new("Binding").color(TEXT_SECONDARY).strong());
                        ui.label(RichText::new("Reset").color(TEXT_SECONDARY).strong());
                        ui.end_row();

                        for (action, default_key) in table {
                            let action_name = action.name();
                            let display_name = action.display_name();

                            // Filter matching
                            if !query.is_empty()
                                && !display_name.to_lowercase().contains(&query)
                                && !action_name.to_lowercase().contains(&query)
                                && !default_key.to_lowercase().contains(&query)
                            {
                                continue;
                            }

                            // Col 1: Action Name
                            ui.label(display_name);

                            // Col 2: Key Binding text editor
                            let has_override =
                                self.draft_settings.hotkey_overrides.contains_key(action_name);

                            let current_key = self
                                .draft_settings
                                .hotkey_overrides
                                .get(action_name)
                                .map(|s| s.as_str())
                                .unwrap_or(default_key);

                            let mut key_buf = current_key.to_string();

                            let response = ui.add(
                                egui::TextEdit::singleline(&mut key_buf)
                                    .desired_width(120.0)
                                    .text_color(if has_override {
                                        accent_color
                                    } else {
                                        TEXT_PRIMARY
                                    }),
                            );

                            if response.changed() {
                                let trimmed = key_buf.trim();
                                if trimmed == default_key || trimmed.is_empty() {
                                    self.draft_settings.hotkey_overrides.remove(action_name);
                                } else if parse_key_chord(trimmed).is_some() {
                                    self.draft_settings
                                        .hotkey_overrides
                                        .insert(action_name.to_string(), trimmed.to_string());
                                }
                            }

                            // Col 3: Reset to Default button per row
                            ui.add_enabled_ui(has_override, |ui| {
                                if ui.button("Reset to Default").clicked() {
                                    self.draft_settings.hotkey_overrides.remove(action_name);
                                }
                            });

                            ui.end_row();
                        }
                    });
            });
    }

    /// Renders Appearance section: accent color picker, swatches, and live preview.
    fn render_appearance_section(&mut self, ui: &mut Ui, accent_color: Color32) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            ui.add_space(4.0);

            ui.group(|ui| {
                ui.label(RichText::new("Accent Color").color(accent_color).strong());
                ui.label(
                    RichText::new("Theme highlight, socket wires, and active selection color.")
                        .color(TEXT_MUTED)
                        .size(11.0),
                );
                ui.add_space(6.0);

                ui.horizontal(|ui| {
                    ui.label("Custom Color:");
                    ui.color_edit_button_rgb(&mut self.draft_settings.accent_color);

                    ui.label(
                        RichText::new(format!(
                            "RGB: [{:.2}, {:.2}, {:.2}]",
                            self.draft_settings.accent_color[0],
                            self.draft_settings.accent_color[1],
                            self.draft_settings.accent_color[2]
                        ))
                        .color(TEXT_MUTED)
                        .size(11.0),
                    );

                    if self.draft_settings.accent_color != DEFAULT_ACCENT_COLOR
                        && ui.button("Reset to Amber").clicked()
                    {
                        self.draft_settings.accent_color = DEFAULT_ACCENT_COLOR;
                    }
                });

                ui.add_space(8.0);
                ui.label(RichText::new("Curated Swatches:").color(TEXT_SECONDARY).size(12.0));

                ui.horizontal(|ui| {
                    let swatches = [
                        (DEFAULT_ACCENT_COLOR, "Amber"),
                        ([0.36, 0.78, 0.91], "Cyan"),
                        ([0.44, 0.82, 0.55], "Mint"),
                        ([0.72, 0.61, 0.96], "Violet"),
                        ([0.98, 0.45, 0.09], "Orange"),
                        ([0.23, 0.51, 0.96], "Blue"),
                        ([0.94, 0.27, 0.27], "Red"),
                    ];

                    for (rgb, name) in swatches {
                        let color = rgb_to_color32(rgb);
                        let is_active = (self.draft_settings.accent_color[0] - rgb[0]).abs() < 0.02
                            && (self.draft_settings.accent_color[1] - rgb[1]).abs() < 0.02
                            && (self.draft_settings.accent_color[2] - rgb[2]).abs() < 0.02;

                        let btn = ui.add(
                            egui::Button::new(
                                RichText::new(name)
                                    .color(if is_active { Color32::BLACK } else { TEXT_PRIMARY })
                                    .size(11.0),
                            )
                            .fill(if is_active { color } else { BG_HEADER })
                            .stroke(Stroke::new(
                                if is_active { 2.0_f32 } else { 1.0_f32 },
                                if is_active { Color32::WHITE } else { BORDER_DARK },
                            )),
                        );

                        if btn.clicked() {
                            self.draft_settings.accent_color = rgb;
                        }
                    }
                });
            });

            ui.add_space(10.0);

            // Live Preview Card
            ui.group(|ui| {
                ui.label(RichText::new("Theme Preview").color(accent_color).strong());
                ui.add_space(4.0);

                let (rect, _response) = ui.allocate_exact_size(Vec2::new(320.0, 70.0), egui::Sense::hover());
                let painter = ui.painter_at(rect);

                // Card background
                painter.rect_filled(rect, 6.0, BG_CARD);
                painter.rect_stroke(rect, 6.0, Stroke::new(1.5_f32, accent_color), StrokeKind::Inside);

                // Card Header
                let header_rect = egui::Rect::from_min_size(rect.min, Vec2::new(rect.width(), 26.0));
                painter.rect_filled(header_rect, 6.0, BG_HEADER);
                painter.text(
                    header_rect.left_center() + Vec2::new(10.0, 0.0),
                    egui::Align2::LEFT_CENTER,
                    "Channel Combiner",
                    egui::FontId::proportional(12.0),
                    TEXT_PRIMARY,
                );

                // Socket preview
                let dot_center = rect.left_center() + Vec2::new(14.0, 12.0);
                painter.circle_filled(dot_center, 4.0, accent_color);
                painter.text(
                    dot_center + Vec2::new(10.0, 0.0),
                    egui::Align2::LEFT_CENTER,
                    "Selected Socket Preview",
                    egui::FontId::proportional(11.0),
                    TEXT_SECONDARY,
                );
            });
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preferences_dialog_open_and_cancel() {
        let mut dialog = PreferencesDialog::new();
        assert!(!dialog.is_open);

        let initial_settings = AppSettings::default();
        dialog.open(&initial_settings);
        assert!(dialog.is_open);

        // Mutate draft in dialog
        dialog.draft_settings.default_resolution = (4096, 4096);
        dialog.draft_settings.hotkey_overrides.insert("SpawnMath".to_string(), "X".to_string());

        // Cancel / close discards
        dialog.close();
        assert!(!dialog.is_open);

        // Initial settings remained untouched
        assert_eq!(initial_settings.default_resolution, (2048, 2048));
        assert!(initial_settings.hotkey_overrides.is_empty());
    }

    #[test]
    fn test_preferences_dialog_save_result() {
        let mut dialog = PreferencesDialog::new();
        let initial_settings = AppSettings::default();
        dialog.open(&initial_settings);

        dialog.draft_settings.export_directory = Some("C:/exports".to_string());
        dialog.draft_settings.accent_color = [0.2, 0.5, 0.8];

        let result = PreferencesDialogResult::Save(dialog.draft_settings.clone());
        if let PreferencesDialogResult::Save(saved) = result {
            assert_eq!(saved.export_directory, Some("C:/exports".to_string()));
            assert_eq!(saved.accent_color, [0.2, 0.5, 0.8]);
        } else {
            panic!("Expected Save result");
        }
    }
}
