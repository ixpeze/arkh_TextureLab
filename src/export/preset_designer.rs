//! User-definable export preset designer and channel routing system.
//!
//! Allows artists and technical directors to define custom multi-channel texture
//! packing presets with arbitrary channel routing (R, G, B, A), bit depth, output format,
//! and tokenized naming patterns, persisted to `presets.json`.

use std::path::{Path, PathBuf};
use egui::{Color32, RichText, Vec2};
use serde::{Deserialize, Serialize};

use crate::export::presets::ExportPreset;
use crate::export::tokens::{TokenContext, TokenResolver};
use crate::ui::theme::{
    pin_wire_color, ACCENT_AMBER, BG_INSET, BORDER_DARK,
    TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY,
};

/// Supported image export formats for user presets.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum OutputFormat {
    #[default]
    PNG,
    TGA,
    EXR,
    TIFF,
}

impl OutputFormat {
    /// List of all supported formats.
    pub const ALL: [OutputFormat; 4] = [
        OutputFormat::PNG,
        OutputFormat::TGA,
        OutputFormat::EXR,
        OutputFormat::TIFF,
    ];

    /// Returns lowercase file extension without dot.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::PNG => "png",
            Self::TGA => "tga",
            Self::EXR => "exr",
            Self::TIFF => "tif",
        }
    }

    /// Human-friendly display label.
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::PNG => "PNG (.png)",
            Self::TGA => "TGA (.tga)",
            Self::EXR => "OpenEXR (.exr)",
            Self::TIFF => "TIFF (.tif)",
        }
    }
}

impl std::fmt::Display for OutputFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", match self {
            Self::PNG => "PNG",
            Self::TGA => "TGA",
            Self::EXR => "EXR",
            Self::TIFF => "TIFF",
        })
    }
}


/// Channel source specifying an upstream node/slot output and channel extraction.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChannelSource {
    /// Upstream source map or node output identifier (e.g. "Roughness", "Metallic").
    pub node_output: String,
    /// Channel to extract from the source ('R', 'G', 'B', 'A').
    pub channel: char,
}

impl ChannelSource {
    /// Constructs a new channel routing source.
    pub fn new(node_output: impl Into<String>, channel: char) -> Self {
        Self {
            node_output: node_output.into(),
            channel: channel.to_ascii_uppercase(),
        }
    }

    /// Returns a short label e.g. "Roughness.R"
    pub fn summary(&self) -> String {
        format!("{}.{}", self.node_output, self.channel)
    }
}

impl Default for ChannelSource {
    fn default() -> Self {
        Self {
            node_output: "None".to_string(),
            channel: 'R',
        }
    }
}

/// Standard industry source map names for dropdown auto-complete.
pub const STANDARD_SOURCE_MAPS: &[&str] = &[
    "AmbientOcclusion",
    "Roughness",
    "Metallic",
    "BaseColor",
    "Normal",
    "Height",
    "Displacement",
    "Emission",
    "Opacity",
    "DetailMask",
    "Smoothness",
    "Specular",
    "Curvature",
    "White",
    "Black",
    "None",
];

/// Standard 4 channel selectors.
pub const CHANNELS: [char; 4] = ['R', 'G', 'B', 'A'];

/// User-definable export preset with arbitrary 4-channel routing.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct UserPreset {
    /// Preset display name (e.g. "UE5 ORM", "Unity MaskMap").
    pub name: String,
    /// Description and DCC engine notes.
    pub description: String,
    /// Channel routing source for target channels [R, G, B, A].
    pub channels: [ChannelSource; 4],
    /// Target image format (PNG, TGA, EXR, TIFF).
    pub output_format: OutputFormat,
    /// Color bit depth: 8 or 16 bits per channel.
    pub bit_depth: u32,
    /// Token-based filename pattern (e.g. "T_{asset}_{slot}").
    pub token_pattern: String,
}

impl UserPreset {
    /// Constructs a new UserPreset.
    pub fn new(
        name: impl Into<String>,
        description: impl Into<String>,
        channels: [ChannelSource; 4],
        output_format: OutputFormat,
        bit_depth: u32,
        token_pattern: impl Into<String>,
    ) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            channels,
            output_format,
            bit_depth,
            token_pattern: token_pattern.into(),
        }
    }

    /// Returns the canonical default starter user presets.
    pub fn default_presets() -> Vec<Self> {
        vec![
            Self::new(
                "UE5 ORM",
                "Unreal Engine 5 Packed ORM (R: AO, G: Roughness, B: Metallic)",
                [
                    ChannelSource::new("AmbientOcclusion", 'R'),
                    ChannelSource::new("Roughness", 'R'),
                    ChannelSource::new("Metallic", 'R'),
                    ChannelSource::new("White", 'R'),
                ],
                OutputFormat::TGA,
                8,
                "T_{asset}_ORM",
            ),
            Self::new(
                "Unity MaskMap",
                "Unity HDRP / URP MaskMap (R: Metallic, G: AO, B: DetailMask, A: Smoothness)",
                [
                    ChannelSource::new("Metallic", 'R'),
                    ChannelSource::new("AmbientOcclusion", 'R'),
                    ChannelSource::new("DetailMask", 'R'),
                    ChannelSource::new("Smoothness", 'R'),
                ],
                OutputFormat::PNG,
                8,
                "{asset}_MaskMap",
            ),
            Self::new(
                "Blender RMA",
                "Blender Principled Packed RMA (R: Roughness, G: Metallic, B: AO)",
                [
                    ChannelSource::new("Roughness", 'R'),
                    ChannelSource::new("Metallic", 'R'),
                    ChannelSource::new("AmbientOcclusion", 'R'),
                    ChannelSource::new("White", 'R'),
                ],
                OutputFormat::PNG,
                8,
                "{asset}_RMA",
            ),
            Self::new(
                "High Precision Normal",
                "16-bit Linear Normal map export",
                [
                    ChannelSource::new("Normal", 'R'),
                    ChannelSource::new("Normal", 'G'),
                    ChannelSource::new("Normal", 'B'),
                    ChannelSource::new("White", 'R'),
                ],
                OutputFormat::PNG,
                16,
                "T_{asset}_Normal",
            ),
        ]
    }

    /// Converts this `UserPreset` into an `ExportPreset` compatible with the preflight grid.
    pub fn to_export_preset(&self) -> ExportPreset {
        let slots: Vec<String> = self
            .channels
            .iter()
            .map(|c| c.node_output.clone())
            .filter(|s| !s.is_empty() && s != "None" && s != "White" && s != "Black")
            .collect();

        ExportPreset {
            id: format!("user:{}", self.name.to_lowercase().replace(' ', "_")),
            name: self.name.clone(),
            pattern: self.token_pattern.clone(),
            default_format: self.output_format.as_str().to_string(),
            description: self.description.clone(),
            default_slots: if slots.is_empty() {
                vec![self.name.clone()]
            } else {
                slots
            },
        }
    }

    /// Resolves preview filename for a sample asset and resolution.
    pub fn preview_filename(&self, asset_name: &str, res: &str) -> String {
        let ctx = TokenContext::new(asset_name, &self.name)
            .with_format(self.output_format.as_str())
            .with_resolution(res);
        TokenResolver::resolve(&self.token_pattern, &ctx)
    }

    /// Returns a compact channel routing summary string.
    pub fn routing_summary(&self) -> String {
        format!(
            "R: {} | G: {} | B: {} | A: {}",
            self.channels[0].summary(),
            self.channels[1].summary(),
            self.channels[2].summary(),
            self.channels[3].summary(),
        )
    }
}

impl Default for UserPreset {
    fn default() -> Self {
        Self::new(
            "New Custom Preset",
            "Custom 4-channel texture packing configuration",
            [
                ChannelSource::new("Roughness", 'R'),
                ChannelSource::new("Metallic", 'R'),
                ChannelSource::new("AmbientOcclusion", 'R'),
                ChannelSource::new("White", 'R'),
            ],
            OutputFormat::PNG,
            8,
            "T_{asset}_{slot}",
        )
    }
}

/// Resolves candidate path for `presets.json` adjacent to the executable,
/// falling back to the current working directory.
pub fn resolve_presets_path() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let next_to_exe = parent.join("presets.json");
            if next_to_exe.exists() {
                return next_to_exe;
            }
        }
    }

    let cwd_path = PathBuf::from("presets.json");
    if cwd_path.exists() {
        return cwd_path;
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            return parent.join("presets.json");
        }
    }

    cwd_path
}

/// Reads user-definable presets from an arbitrary file path.
pub fn load_presets_from_path(path: &Path) -> Vec<UserPreset> {
    if !path.exists() {
        return UserPreset::default_presets();
    }
    match std::fs::read_to_string(path) {
        Ok(json) => match serde_json::from_str::<Vec<UserPreset>>(&json) {
            Ok(presets) if !presets.is_empty() => presets,
            Ok(_) => UserPreset::default_presets(),
            Err(e) => {
                eprintln!("Warning: Failed to parse presets from {:?}: {}", path, e);
                UserPreset::default_presets()
            }
        },
        Err(e) => {
            eprintln!("Warning: Failed to read presets from {:?}: {}", path, e);
            UserPreset::default_presets()
        }
    }
}

/// Writes user-definable presets to an arbitrary file path.
pub fn save_presets_to_path(presets: &[UserPreset], path: &Path) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            let _ = std::fs::create_dir_all(parent);
        }
    }
    let json = serde_json::to_string_pretty(presets)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    std::fs::write(path, json)
}

/// Reads user presets from `presets.json` adjacent to the executable.
pub fn load_presets() -> Vec<UserPreset> {
    load_presets_from_path(&resolve_presets_path())
}

/// Writes user presets to `presets.json` adjacent to the executable.
pub fn save_presets(presets: &[UserPreset]) {
    let path = resolve_presets_path();
    if let Err(e) = save_presets_to_path(presets, &path) {
        eprintln!("Failed to save presets to {:?}: {}", path, e);
    }
}

/// Result emitted when the Preset Designer modal closes or saves.
#[derive(Clone, Debug, PartialEq)]
pub enum PresetDesignerResult {
    /// Presets saved and applied.
    Saved(Vec<UserPreset>),
    /// Modal closed without saving.
    Cancel,
}

/// Interactive state controller for the modal Preset Designer dialog.
pub struct PresetDesignerDialog {
    /// Whether the modal dialog window is currently visible.
    pub is_open: bool,
    /// Editable working draft of presets.
    pub draft_presets: Vec<UserPreset>,
    /// Currently selected preset index in the list.
    pub selected_index: usize,
    /// Search filter for the preset list.
    pub preset_filter: String,
    /// Status message or validation warning.
    pub status_message: Option<String>,
}

impl Default for PresetDesignerDialog {
    fn default() -> Self {
        Self::new()
    }
}

impl PresetDesignerDialog {
    /// Creates a new inactive Preset Designer dialog.
    pub fn new() -> Self {
        Self {
            is_open: false,
            draft_presets: Vec::new(),
            selected_index: 0,
            preset_filter: String::new(),
            status_message: None,
        }
    }

    /// Opens the dialog initialized with a working copy of the current active presets.
    pub fn open(&mut self, current: &[UserPreset]) {
        self.is_open = true;
        self.draft_presets = if current.is_empty() {
            UserPreset::default_presets()
        } else {
            current.to_vec()
        };
        self.selected_index = 0;
        self.preset_filter.clear();
        self.status_message = None;
    }

    /// Closes the dialog immediately.
    pub fn close(&mut self) {
        self.is_open = false;
    }

    /// Renders the modal window on the given egui context.
    pub fn show(&mut self, ctx: &egui::Context) -> Option<PresetDesignerResult> {
        if !self.is_open {
            return None;
        }

        let mut result = None;
        let mut close_dialog = false;

        egui::Window::new("Export Preset Designer")
            .collapsible(false)
            .resizable(true)
            .default_width(760.0)
            .default_height(580.0)
            .min_width(620.0)
            .min_height(460.0)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                ui.spacing_mut().item_spacing = Vec2::new(8.0, 8.0);

                // --- 1. Dialog Header ---
                ui.horizontal(|ui| {
                    ui.heading(
                        RichText::new("Export Preset Designer")
                            .color(TEXT_PRIMARY)
                            .size(16.0),
                    );
                    ui.label(
                        RichText::new("Configure 4-channel packing, bit depth, format, & token patterns.")
                            .color(TEXT_SECONDARY),
                    );
                });
                ui.separator();

                // --- 2. Two-Column Body: Preset List (Left) | Preset Details (Right) ---
                let total_height = ui.available_height() - 44.0; // Reserve footer space

                ui.allocate_ui_with_layout(
                    Vec2::new(ui.available_width(), total_height),
                    egui::Layout::left_to_right(egui::Align::Min),
                    |ui| {
                        // Left Column: Preset Management List (~220px)
                        ui.allocate_ui_with_layout(
                            Vec2::new(230.0, total_height),
                            egui::Layout::top_down(egui::Align::Min),
                            |ui| {
                                ui.label(RichText::new("Presets").color(ACCENT_AMBER).strong());

                                // Filter input
                                ui.add(
                                    egui::TextEdit::singleline(&mut self.preset_filter)
                                        .hint_text("Filter presets...")
                                        .desired_width(220.0),
                                );
                                ui.add_space(4.0);

                                // Preset List ScrollArea
                                let list_height = total_height - 95.0;
                                egui::ScrollArea::vertical()
                                    .id_salt("preset_list_scroll")
                                    .max_height(list_height)
                                    .show(ui, |ui| {
                                        ui.set_width(220.0);
                                        let filter_lower = self.preset_filter.to_lowercase();

                                        for (i, preset) in self.draft_presets.iter().enumerate() {
                                            if !filter_lower.is_empty()
                                                && !preset.name.to_lowercase().contains(&filter_lower)
                                            {
                                                continue;
                                            }

                                            let is_selected = self.selected_index == i;
                                            let label_text = format!(
                                                "{} [{}-{}]",
                                                preset.name,
                                                preset.output_format,
                                                preset.bit_depth
                                            );

                                            if ui
                                                .selectable_label(is_selected, RichText::new(label_text).color(if is_selected {
                                                    TEXT_PRIMARY
                                                } else {
                                                    TEXT_SECONDARY
                                                }))
                                                .clicked()
                                            {
                                                self.selected_index = i;
                                            }
                                        }
                                    });

                                ui.add_space(4.0);
                                ui.separator();

                                // List action buttons: Add, Duplicate, Remove
                                ui.horizontal(|ui| {
                                    if ui.button("+ Add").on_hover_text("Add a new blank preset").clicked() {
                                        let new_p = UserPreset {
                                            name: format!("Custom Preset {}", self.draft_presets.len() + 1),
                                            ..Default::default()
                                        };
                                        self.draft_presets.push(new_p);
                                        self.selected_index = self.draft_presets.len() - 1;
                                    }

                                    let can_dup = !self.draft_presets.is_empty();
                                    if ui.add_enabled(can_dup, egui::Button::new("Copy")).on_hover_text("Duplicate selected preset").clicked() {
                                        if let Some(src) = self.draft_presets.get(self.selected_index).cloned() {
                                            let mut dup = src;
                                            dup.name = format!("{} (Copy)", dup.name);
                                            self.draft_presets.push(dup);
                                            self.selected_index = self.draft_presets.len() - 1;
                                        }
                                    }

                                    let can_remove = self.draft_presets.len() > 1;
                                    if ui.add_enabled(can_remove, egui::Button::new("Delete")).on_hover_text("Delete selected preset").clicked()
                                        && self.selected_index < self.draft_presets.len()
                                    {
                                        self.draft_presets.remove(self.selected_index);
                                        if self.selected_index >= self.draft_presets.len() && !self.draft_presets.is_empty() {
                                            self.selected_index = self.draft_presets.len() - 1;
                                        }
                                    }
                                });
                            },
                        );

                        ui.separator();

                        // Right Column: Active Preset Editor
                        let right_width = ui.available_width();
                        ui.allocate_ui_with_layout(
                            Vec2::new(right_width, total_height),
                            egui::Layout::top_down(egui::Align::Min),
                            |ui| {
                                if let Some(preset) = self.draft_presets.get_mut(self.selected_index) {
                                    egui::ScrollArea::vertical()
                                        .id_salt("preset_details_scroll")
                                        .show(ui, |ui| {
                                            // 1. Basic Metadata
                                            ui.label(RichText::new("Preset Configuration").color(ACCENT_AMBER).strong());

                                            ui.horizontal(|ui| {
                                                ui.label(RichText::new("Preset Name:").color(TEXT_SECONDARY));
                                                ui.add(egui::TextEdit::singleline(&mut preset.name).desired_width(260.0));
                                            });

                                            ui.horizontal(|ui| {
                                                ui.label(RichText::new("Description:").color(TEXT_SECONDARY));
                                                ui.add(egui::TextEdit::singleline(&mut preset.description).desired_width(360.0));
                                            });

                                            ui.add_space(4.0);
                                            ui.separator();

                                            // 2. Channel Routing (4 Channels)
                                            ui.label(RichText::new("Channel Routing (RGBA Packing)").color(ACCENT_AMBER).strong());
                                            ui.label(RichText::new("Route upstream texture maps and components into packed export channels:").color(TEXT_MUTED));

                                            let channel_names = ["Red (R)", "Green (G)", "Blue (B)", "Alpha (A)"];
                                            let channel_wire_keys = ["R", "G", "B", "A"];

                                            egui::Grid::new("channel_routing_grid")
                                                .striped(true)
                                                .min_col_width(70.0)
                                                .show(ui, |ui| {
                                                    ui.strong("Target");
                                                    ui.strong("Source Map / Node Output");
                                                    ui.strong("Source Channel");
                                                    ui.end_row();

                                                    for ch_idx in 0..4 {
                                                        let wire_col = pin_wire_color(channel_wire_keys[ch_idx]);

                                                        // Target channel badge
                                                        ui.horizontal(|ui| {
                                                            let (rect, _) = ui.allocate_exact_size(Vec2::new(14.0, 14.0), egui::Sense::hover());
                                                            ui.painter().rect_filled(rect, 3.0, wire_col);
                                                            ui.colored_label(wire_col, channel_names[ch_idx]);
                                                        });

                                                        // Source Map ComboBox
                                                        let cs = &mut preset.channels[ch_idx];
                                                        egui::ComboBox::from_id_salt(format!("src_map_{}", ch_idx))
                                                            .selected_text(&cs.node_output)
                                                            .width(170.0)
                                                            .show_ui(ui, |ui| {
                                                                for &opt in STANDARD_SOURCE_MAPS {
                                                                    let is_sel = cs.node_output == opt;
                                                                    if ui.selectable_label(is_sel, opt).clicked() {
                                                                        cs.node_output = opt.to_string();
                                                                    }
                                                                }
                                                            });

                                                        // Source Channel ComboBox (R, G, B, A)
                                                        egui::ComboBox::from_id_salt(format!("src_ch_{}", ch_idx))
                                                            .selected_text(cs.channel.to_string())
                                                            .width(55.0)
                                                            .show_ui(ui, |ui| {
                                                                for &c in &CHANNELS {
                                                                    let is_sel = cs.channel == c;
                                                                    if ui.selectable_label(is_sel, c.to_string()).clicked() {
                                                                        cs.channel = c;
                                                                    }
                                                                }
                                                            });

                                                        ui.end_row();
                                                    }
                                                });

                                            ui.add_space(4.0);
                                            ui.separator();

                                            // 3. Output Format and Bit Depth
                                            ui.label(RichText::new("Output Specifications").color(ACCENT_AMBER).strong());

                                            ui.horizontal(|ui| {
                                                ui.label(RichText::new("Format:").color(TEXT_SECONDARY));
                                                for fmt in &OutputFormat::ALL {
                                                    let is_sel = preset.output_format == *fmt;
                                                    if ui.selectable_label(is_sel, fmt.display_name()).clicked() {
                                                        preset.output_format = *fmt;
                                                    }
                                                }
                                            });

                                            ui.horizontal(|ui| {
                                                ui.label(RichText::new("Bit Depth:").color(TEXT_SECONDARY));
                                                let is_8 = preset.bit_depth == 8;
                                                let is_16 = preset.bit_depth == 16;

                                                if ui.selectable_label(is_8, "8-bit (Standard PBR)").clicked() {
                                                    preset.bit_depth = 8;
                                                }
                                                if ui.selectable_label(is_16, "16-bit (HDR / Precision)").clicked() {
                                                    preset.bit_depth = 16;
                                                }
                                            });

                                            ui.add_space(4.0);
                                            ui.separator();

                                            // 4. Token Pattern Editor with Live Preview
                                            ui.label(RichText::new("Naming Pattern & Tokens").color(ACCENT_AMBER).strong());

                                            ui.horizontal(|ui| {
                                                ui.label(RichText::new("Pattern:").color(TEXT_SECONDARY));
                                                ui.add(egui::TextEdit::singleline(&mut preset.token_pattern).desired_width(280.0));
                                            });

                                            // Quick token pill insert buttons
                                            ui.horizontal_wrapped(|ui| {
                                                ui.label(RichText::new("Insert Token:").color(TEXT_MUTED));
                                                let tokens = ["{asset}", "{slot}", "{res}", "{format}", "{project}"];
                                                for tok in tokens {
                                                    if ui.small_button(tok).on_hover_text(format!("Append {}", tok)).clicked() {
                                                        if !preset.token_pattern.is_empty() && !preset.token_pattern.ends_with('_') {
                                                            preset.token_pattern.push('_');
                                                        }
                                                        preset.token_pattern.push_str(tok);
                                                    }
                                                }
                                            });

                                            ui.add_space(4.0);

                                            // Live filename preview box
                                            let preview_resolved = preset.preview_filename("SciFiDoor", "2048");
                                            egui::Frame::new()
                                                .fill(BG_INSET)
                                                .stroke(egui::Stroke::new(1.0_f32, BORDER_DARK))
                                                .inner_margin(8.0)
                                                .corner_radius(4.0)
                                                .show(ui, |ui| {
                                                    ui.horizontal(|ui| {
                                                        ui.label(RichText::new("Filename Preview:").color(TEXT_SECONDARY).strong());
                                                        ui.label(
                                                            RichText::new(&preview_resolved)
                                                                .color(ACCENT_AMBER)
                                                                .monospace()
                                                                .strong(),
                                                        );
                                                    });
                                                    ui.label(
                                                        RichText::new(format!(
                                                            "Summary: {} ({} {}b)",
                                                            preset.routing_summary(),
                                                            preset.output_format,
                                                            preset.bit_depth
                                                        ))
                                                        .color(TEXT_MUTED)
                                                        .size(11.0),
                                                    );
                                                });
                                        });
                                } else {
                                    ui.centered_and_justified(|ui| {
                                        ui.label(RichText::new("No preset selected").color(TEXT_MUTED));
                                    });
                                }
                            },
                        );
                    },
                );

                // --- 3. Modal Action Buttons: [Reset Defaults] ... [Cancel] [Save & Apply] ---
                ui.separator();
                ui.horizontal(|ui| {
                    if ui.button("Reset Defaults").on_hover_text("Restore default built-in presets").clicked() {
                        self.draft_presets = UserPreset::default_presets();
                        self.selected_index = 0;
                    }

                    if let Some(msg) = &self.status_message {
                        ui.label(RichText::new(msg).color(ACCENT_AMBER));
                    }

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        let save_btn = egui::Button::new(
                            RichText::new("Save & Apply").color(Color32::BLACK).strong(),
                        )
                        .fill(ACCENT_AMBER);

                        if ui.add(save_btn).clicked() {
                            save_presets(&self.draft_presets);
                            result = Some(PresetDesignerResult::Saved(self.draft_presets.clone()));
                            close_dialog = true;
                        }

                        if ui.button("Cancel").clicked() {
                            result = Some(PresetDesignerResult::Cancel);
                            close_dialog = true;
                        }
                    });
                });
            });

        if close_dialog {
            self.close();
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_preset_construction_and_summary() {
        let preset = UserPreset::new(
            "Custom ORM",
            "Custom ambient roughness metallic pack",
            [
                ChannelSource::new("AmbientOcclusion", 'R'),
                ChannelSource::new("Roughness", 'G'),
                ChannelSource::new("Metallic", 'B'),
                ChannelSource::new("White", 'A'),
            ],
            OutputFormat::TGA,
            8,
            "T_{asset}_{slot}",
        );

        assert_eq!(preset.name, "Custom ORM");
        assert_eq!(preset.output_format, OutputFormat::TGA);
        assert_eq!(preset.bit_depth, 8);
        assert_eq!(preset.channels[0].node_output, "AmbientOcclusion");
        assert_eq!(preset.channels[0].channel, 'R');
        assert_eq!(preset.channels[1].node_output, "Roughness");
        assert_eq!(preset.channels[1].channel, 'G');
        assert_eq!(preset.channels[2].node_output, "Metallic");
        assert_eq!(preset.channels[2].channel, 'B');
        assert_eq!(preset.channels[3].node_output, "White");
        assert_eq!(preset.channels[3].channel, 'A');

        assert_eq!(
            preset.routing_summary(),
            "R: AmbientOcclusion.R | G: Roughness.G | B: Metallic.B | A: White.A"
        );
    }

    #[test]
    fn test_user_preset_to_export_preset_interop() {
        let up = UserPreset::new(
            "Unity MaskMap",
            "Unity mask pack",
            [
                ChannelSource::new("Metallic", 'R'),
                ChannelSource::new("AmbientOcclusion", 'R'),
                ChannelSource::new("DetailMask", 'R'),
                ChannelSource::new("Smoothness", 'R'),
            ],
            OutputFormat::PNG,
            8,
            "{asset}_MaskMap",
        );

        let ep = up.to_export_preset();
        assert_eq!(ep.id, "user:unity_maskmap");
        assert_eq!(ep.name, "Unity MaskMap");
        assert_eq!(ep.pattern, "{asset}_MaskMap");
        assert_eq!(ep.default_format, "png");
        assert_eq!(
            ep.default_slots,
            vec!["Metallic", "AmbientOcclusion", "DetailMask", "Smoothness"]
        );
    }

    #[test]
    fn test_preview_filename_token_resolution() {
        let preset = UserPreset::new(
            "ORM",
            "Standard ORM",
            [
                ChannelSource::new("AO", 'R'),
                ChannelSource::new("Roughness", 'R'),
                ChannelSource::new("Metallic", 'R'),
                ChannelSource::new("White", 'R'),
            ],
            OutputFormat::TGA,
            8,
            "T_{asset}_ORM",
        );

        let preview = preset.preview_filename("ConcreteWall", "4K");
        assert_eq!(preview, "T_ConcreteWall_ORM.tga");

        let preset_res = UserPreset::new(
            "SubstanceStyle",
            "Substance with resolution",
            [
                ChannelSource::new("BaseColor", 'R'),
                ChannelSource::new("BaseColor", 'G'),
                ChannelSource::new("BaseColor", 'B'),
                ChannelSource::new("Opacity", 'R'),
            ],
            OutputFormat::PNG,
            16,
            "{asset}_Albedo_{res}",
        );

        let preview2 = preset_res.preview_filename("Weapon_Axe", "2048");
        assert_eq!(preview2, "Weapon_Axe_Albedo_2048.png");
    }

    #[test]
    fn test_preset_save_and_reload_roundtrip() {
        let temp_dir = std::env::temp_dir();
        let unique_name = format!("test_presets_{}.json", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let file_path = temp_dir.join(unique_name);

        let test_presets = vec![
            UserPreset::new(
                "Custom Channel Packed",
                "Arbitrary routing for game engine",
                [
                    ChannelSource::new("CavityMask", 'G'),
                    ChannelSource::new("Glossiness", 'R'),
                    ChannelSource::new("Metallic", 'B'),
                    ChannelSource::new("AlphaMask", 'A'),
                ],
                OutputFormat::EXR,
                16,
                "T_{asset}_Custom_{res}",
            ),
            UserPreset::new(
                "Mobile Compact",
                "Lightweight 8-bit pack",
                [
                    ChannelSource::new("BaseColor", 'R'),
                    ChannelSource::new("BaseColor", 'G'),
                    ChannelSource::new("BaseColor", 'B'),
                    ChannelSource::new("Roughness", 'R'),
                ],
                OutputFormat::TIFF,
                8,
                "{asset}_BaseRough",
            ),
        ];

        // 1. Save presets to disk
        save_presets_to_path(&test_presets, &file_path).expect("Failed to write test presets");

        // 2. Reload presets from disk
        let reloaded = load_presets_from_path(&file_path);

        // 3. Verify count and exact channel routing preservation
        assert_eq!(reloaded.len(), 2);

        let p0 = &reloaded[0];
        assert_eq!(p0.name, "Custom Channel Packed");
        assert_eq!(p0.output_format, OutputFormat::EXR);
        assert_eq!(p0.bit_depth, 16);
        assert_eq!(p0.token_pattern, "T_{asset}_Custom_{res}");

        assert_eq!(p0.channels[0].node_output, "CavityMask");
        assert_eq!(p0.channels[0].channel, 'G');

        assert_eq!(p0.channels[1].node_output, "Glossiness");
        assert_eq!(p0.channels[1].channel, 'R');

        assert_eq!(p0.channels[2].node_output, "Metallic");
        assert_eq!(p0.channels[2].channel, 'B');

        assert_eq!(p0.channels[3].node_output, "AlphaMask");
        assert_eq!(p0.channels[3].channel, 'A');

        let p1 = &reloaded[1];
        assert_eq!(p1.name, "Mobile Compact");
        assert_eq!(p1.output_format, OutputFormat::TIFF);
        assert_eq!(p1.bit_depth, 8);
        assert_eq!(p1.channels[3].node_output, "Roughness");
        assert_eq!(p1.channels[3].channel, 'R');

        // Cleanup
        let _ = std::fs::remove_file(file_path);
    }

    #[test]
    fn test_default_presets_census() {
        let defaults = UserPreset::default_presets();
        assert!(defaults.len() >= 3);

        let names: Vec<&str> = defaults.iter().map(|p| p.name.as_str()).collect();
        assert!(names.contains(&"UE5 ORM"));
        assert!(names.contains(&"Unity MaskMap"));
        assert!(names.contains(&"Blender RMA"));

        for p in &defaults {
            assert_eq!(p.channels.len(), 4);
            assert!(p.bit_depth == 8 || p.bit_depth == 16);
            assert!(!p.token_pattern.is_empty());
        }
    }

    #[test]
    fn test_preset_designer_dialog_lifecycle() {
        let mut dialog = PresetDesignerDialog::new();
        assert!(!dialog.is_open);

        let initial = vec![UserPreset::default()];
        dialog.open(&initial);
        assert!(dialog.is_open);
        assert_eq!(dialog.draft_presets.len(), 1);

        dialog.close();
        assert!(!dialog.is_open);
    }
}
