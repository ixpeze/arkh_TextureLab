//! Node Parameter Inspector (Phase 5).
//!
//! Provides the properties panel editing node parameters (min/max, gamma,
//! routing rows, color, formats, and blend modes) and emits mutations
//! to trigger reactive evaluation.

use egui::{Color32, DragValue, Pos2, Rect, Sense, Slider, Stroke, Ui, Vec2};
use crate::graph::model::{Graph, Node, NodeId, NodeParam};
use crate::nodes::NodeCategory;
use crate::ui::theme::{
    category_color, category_tinted_bg, pin_wire_color, ACCENT_AMBER, BORDER_DARK, CHEVRON_MUTED,
    INSPECTOR_SECTION_BG, INSPECTOR_SECTION_HOVER, TEXT_MUTED, TEXT_PRIMARY,
    TEXT_SECONDARY, WIRE_RED,
};

/// Action emitted when user modifies node configuration in the Inspector.
#[derive(Clone, Debug, PartialEq)]
pub enum InspectorAction {
    ParamChanged {
        node_id: NodeId,
        param_name: String,
        new_value: NodeParam,
    },
    LabelChanged {
        node_id: NodeId,
        new_label: String,
    },
    DeleteNode(NodeId),
}

/// Renders a collapsible accordion section in the properties inspector.
fn property_section<R>(
    ui: &mut Ui,
    id_source: &str,
    title: &str,
    default_open: bool,
    add_contents: impl FnOnce(&mut Ui) -> R,
) -> Option<R> {
    let id = ui.make_persistent_id(id_source);
    let mut is_open = ui.data_mut(|d| d.get_temp::<bool>(id)).unwrap_or(default_open);

    let (header_rect, header_resp) = ui.allocate_exact_size(
        Vec2::new(ui.available_width(), 31.0),
        Sense::click(),
    );

    if header_resp.clicked() {
        is_open = !is_open;
        ui.data_mut(|d| d.insert_temp(id, is_open));
    }

    let bg = if header_resp.hovered() {
        INSPECTOR_SECTION_HOVER
    } else {
        INSPECTOR_SECTION_BG
    };

    ui.painter().rect_filled(header_rect, 0.0, bg);
    ui.painter().line_segment(
        [header_rect.left_bottom(), header_rect.right_bottom()],
        Stroke::new(1.0_f32, BORDER_DARK),
    );

    // Section title
    ui.painter().text(
        Pos2::new(header_rect.min.x + 10.0, header_rect.center().y),
        egui::Align2::LEFT_CENTER,
        title,
        egui::FontId::proportional(12.0),
        TEXT_SECONDARY,
    );

    // Right-aligned Chevron
    let ch_x = header_rect.max.x - 14.0;
    let ch_y = header_rect.center().y;
    let chevron_stroke = Stroke::new(1.2_f32, CHEVRON_MUTED);
    if is_open {
        ui.painter().line_segment([Pos2::new(ch_x - 3.5, ch_y - 2.0), Pos2::new(ch_x, ch_y + 2.0)], chevron_stroke);
        ui.painter().line_segment([Pos2::new(ch_x, ch_y + 2.0), Pos2::new(ch_x + 3.5, ch_y - 2.0)], chevron_stroke);
    } else {
        ui.painter().line_segment([Pos2::new(ch_x - 2.0, ch_y - 3.5), Pos2::new(ch_x + 2.0, ch_y)], chevron_stroke);
        ui.painter().line_segment([Pos2::new(ch_x + 2.0, ch_y), Pos2::new(ch_x - 2.0, ch_y + 3.5)], chevron_stroke);
    }

    if is_open {
        ui.add_space(6.0);
        let res = add_contents(ui);
        ui.add_space(6.0);
        Some(res)
    } else {
        None
    }
}

/// Traces upstream connections to auto-detect (slot_name, asset_name) from the input stream.
/// Smartly traces through intermediate math/adjust/blend/channel nodes back to source nodes.
pub fn detect_upstream_context(graph: &Graph, target_node_id: NodeId) -> (Option<String>, Option<String>) {
    let Some(incoming) = graph.edges.iter().find(|e| e.to.node_id == target_node_id) else {
        return (None, None);
    };

    let mut current_pin = incoming.from.clone();
    let mut visited = std::collections::HashSet::new();

    // Trace up to 20 steps backwards
    for _ in 0..20 {
        if !visited.insert(current_pin.node_id) {
            break;
        }

        let Some(upstream_node) = graph.get_node(current_pin.node_id) else {
            break;
        };

        match upstream_node.node_type.as_str() {
            "TextureInput" => {
                let filename = crate::ui::canvas::get_texture_input_filename(upstream_node);
                let pin_name = current_pin.name.as_str();
                let asset_name = extract_asset_stem(&filename);

                // If connected to a split channel pin R, G, B, A:
                if matches!(pin_name, "R" | "G" | "B" | "A") {
                    let tags = crate::ui::canvas::detect_texture_channel_tags(&filename);
                    let tag = match pin_name {
                        "R" => tags.0,
                        "G" => tags.1,
                        "B" => tags.2,
                        "A" => tags.3,
                        _ => None,
                    };
                    if let Some((role, _, _)) = tag {
                        return (Some(role.to_string()), Some(asset_name));
                    }
                }

                // If connected to whole texture (RGBA or output) or tag not assigned:
                let inferred_slot = infer_slot_from_filename(&filename);
                return (Some(inferred_slot), Some(asset_name));
            }

            "ChannelSplit" => {
                let pin_name = current_pin.name.clone();
                if let Some(edge) = graph.edges.iter().find(|e| e.to.node_id == upstream_node.id) {
                    current_pin = edge.from.clone();
                    if let Some(src_node) = graph.get_node(current_pin.node_id) {
                        if src_node.node_type == "TextureInput" {
                            let filename = crate::ui::canvas::get_texture_input_filename(src_node);
                            let asset_name = extract_asset_stem(&filename);
                            let tags = crate::ui::canvas::detect_texture_channel_tags(&filename);
                            let tag = match pin_name.as_str() {
                                "R" => tags.0,
                                "G" => tags.1,
                                "B" => tags.2,
                                "A" => tags.3,
                                _ => None,
                            };
                            if let Some((role, _, _)) = tag {
                                return (Some(role.to_string()), Some(asset_name));
                            }
                            return (Some(infer_slot_from_filename(&filename)), Some(asset_name));
                        }
                    }
                } else {
                    break;
                }
            }

            "ChannelCombine" => {
                let has_a = graph.edges.iter().any(|e| e.to.node_id == upstream_node.id && e.to.name == "A");
                let has_rgb = graph.edges.iter().any(|e| e.to.node_id == upstream_node.id && (e.to.name == "R" || e.to.name == "G" || e.to.name == "B"));
                let slot = if has_a { "ORMH".to_string() } else if has_rgb { "ORM".to_string() } else { "Pack".to_string() };
                return (Some(slot), Some("Asset".to_string()));
            }

            // Intermediate mathematical/adjust/filter nodes
            _ => {
                let next_edge = graph.edges.iter().find(|e| {
                    e.to.node_id == upstream_node.id && (e.to.name == "input" || e.to.name == "base" || e.to.name == "A" || e.to.name == "in")
                }).or_else(|| {
                    graph.edges.iter().find(|e| e.to.node_id == upstream_node.id)
                });

                if let Some(edge) = next_edge {
                    current_pin = edge.from.clone();
                } else {
                    break;
                }
            }
        }
    }

    (None, None)
}

/// Helper to infer default slot role name from texture filename.
pub fn infer_slot_from_filename(filename: &str) -> String {
    let lower = filename.to_lowercase();
    if lower.contains("albedo") || lower.contains("basecolor") || lower.contains("diffuse") || lower.contains("color") {
        "BaseColor".to_string()
    } else if lower.contains("normal") || lower.contains("nrm") || lower.contains("norm") {
        "Normal".to_string()
    } else if lower.contains("roughness") || lower.contains("rough") {
        "Roughness".to_string()
    } else if lower.contains("metallic") || lower.contains("metal") {
        "Metallic".to_string()
    } else if lower.contains("ormh") || lower.contains("aormh") {
        "ORMH".to_string()
    } else if lower.contains("orm") || lower.contains("aorm") {
        "ORM".to_string()
    } else if lower.contains("rma") {
        "RMA".to_string()
    } else if lower.contains("height") || lower.contains("disp") || lower.contains("displacement") {
        "Height".to_string()
    } else if lower.contains("ao") || lower.contains("ambientocclusion") || lower.contains("occlusion") {
        "AO".to_string()
    } else if lower.contains("specular") || lower.contains("spec") {
        "Specular".to_string()
    } else if lower.contains("gloss") || lower.contains("glossiness") {
        "Gloss".to_string()
    } else if lower.contains("mask") {
        "Mask".to_string()
    } else if lower.contains("emissive") || lower.contains("emission") {
        "Emissive".to_string()
    } else {
        "BaseColor".to_string()
    }
}

/// Extracts clean asset base stem from filename.
pub fn extract_asset_stem(filename: &str) -> String {
    let clean = std::path::Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename);

    if clean.is_empty() || clean == "No texture loaded" || clean == "TextureInput" {
        return "Asset".to_string();
    }

    let mut stem = clean;
    for prefix in &["T_", "t_", "SM_", "sm_", "M_", "m_", "TX_", "tx_"] {
        if stem.starts_with(prefix) {
            stem = &stem[prefix.len()..];
            break;
        }
    }

    let lower = stem.to_lowercase();
    for suffix in &[
        "_ormh", "_aormh", "_orm", "_aorm", "_rma", "_basecolor", "_albedo", "_diffuse",
        "_normal", "_nrm", "_roughness", "_rough", "_metallic", "_metal", "_height",
        "_displacement", "_disp", "_ao", "_ambientocclusion", "_specular", "_spec",
        "_gloss", "_glossiness", "_mask", "_emissive", "_emission",
        "_4k", "_2k", "_1k", "_8k",
    ] {
        if lower.ends_with(suffix) {
            stem = &stem[..stem.len() - suffix.len()];
            break;
        }
    }

    let trimmed = stem.trim_matches(['_', '-', ' ']);
    if trimmed.is_empty() {
        "Asset".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Resolves tokens like {slot}, {name}, {res}, {format}, {colorspace} in a hybrid filename template.
pub fn resolve_token_name(
    template: &str,
    slot: &str,
    asset_name: &str,
    res: Option<(u32, u32)>,
    format_ext: &str,
    colorspace: &str,
) -> String {
    let mut result = template.to_string();
    result = result.replace("{slot}", slot);
    result = result.replace("{SLOT}", &slot.to_uppercase());
    result = result.replace("{name}", asset_name);
    result = result.replace("{NAME}", &asset_name.to_uppercase());
    result = result.replace("{asset}", asset_name);
    result = result.replace("{ASSET}", &asset_name.to_uppercase());
    if let Some((w, _h)) = res {
        result = result.replace("{res}", &w.to_string());
        result = result.replace("{resolution}", &w.to_string());
    } else {
        result = result.replace("{res}", "Auto");
        result = result.replace("{resolution}", "Auto");
    }
    result = result.replace("{format}", format_ext);
    result = result.replace("{ext}", format_ext);
    result = result.replace("{colorspace}", colorspace);
    result
}

/// Renders the Properties Inspector panel for the currently selected node.
pub fn show_inspector(
    ui: &mut Ui,
    node: Option<&mut Node>,
    upstream_context: (Option<&str>, Option<&str>),
) -> Option<InspectorAction> {
    let Some(node) = node else {
        ui.vertical_centered(|ui| {
            ui.add_space(30.0);
            ui.label(
                egui::RichText::new("No node selected")
                    .color(crate::ui::theme::TEXT_MUTED)
                    .size(14.0),
            );
            ui.label(
                egui::RichText::new("Select a node on the canvas to inspect and edit parameters.")
                    .color(crate::ui::theme::TEXT_MUTED)
                    .size(12.0),
            );
        });
        return None;
    };

    let mut action = None;
    let node_id = node.id;

    ui.vertical(|ui| {
        // Node Header Banner (Design Guide Section 3: 40px height, #20202A background with subtle category tint, 3px solid category color along top, bottom border #3A3A4C)
        let cat = infer_category(&node.node_type);
        let cat_color = category_color(cat);

        let (banner_rect, _) = ui.allocate_exact_size(
            Vec2::new(ui.available_width(), 40.0),
            Sense::hover(),
        );

        let banner_bg = category_tinted_bg(cat);
        ui.painter().rect_filled(banner_rect, 0.0, banner_bg);

        // 3px solid category color along top edge (flat, continuous straight horizontal line)
        let top_strip = Rect::from_min_size(banner_rect.min, Vec2::new(banner_rect.width(), 3.0));
        ui.painter().rect_filled(top_strip, 0.0, cat_color);

        // Bottom border line #3A3A4C
        ui.painter().line_segment(
            [banner_rect.left_bottom(), banner_rect.right_bottom()],
            Stroke::new(1.0_f32, BORDER_DARK),
        );

        let is_save_image = node.node_type == "SaveImage" || node.node_type == "TextureOutput";
        let title_text = if is_save_image {
            "Save Image"
        } else {
            &node.node_type
        };

        // Node Title (14px Semibold #F1F5F9)
        ui.painter().text(
            Pos2::new(banner_rect.min.x + 12.0, banner_rect.center().y + 1.0),
            egui::Align2::LEFT_CENTER,
            title_text,
            egui::FontId::proportional(14.0),
            TEXT_PRIMARY,
        );

        // Category Badge (suppressed for SaveImage to keep minimal and clutter-free)
        if !is_save_image {
            let badge_text = cat.to_string();
            let badge_rect = Rect::from_center_size(
                Pos2::new(banner_rect.max.x - 72.0, banner_rect.center().y + 1.0),
                Vec2::new(58.0, 18.0),
            );
            ui.painter().rect_filled(
                badge_rect,
                4.0,
                Color32::from_rgba_premultiplied(cat_color.r() / 5, cat_color.g() / 5, cat_color.b() / 5, 120),
            );
            ui.painter().text(
                badge_rect.center(),
                egui::Align2::CENTER_CENTER,
                &badge_text,
                egui::FontId::proportional(10.5),
                cat_color,
            );
        }

        // Delete button
        let del_rect = Rect::from_center_size(
            Pos2::new(banner_rect.max.x - 22.0, banner_rect.center().y + 1.0),
            Vec2::new(24.0, 20.0),
        );
        let del_resp = ui.interact(del_rect, ui.make_persistent_id("del_node_btn"), Sense::click());
        let del_bg = if del_resp.hovered() { Color32::from_rgb(52, 28, 32) } else { Color32::TRANSPARENT };
        ui.painter().rect_filled(del_rect, 4.0, del_bg);
        ui.painter().text(
            del_rect.center(),
            egui::Align2::CENTER_CENTER,
            "✕",
            egui::FontId::proportional(11.0),
            if del_resp.hovered() { WIRE_RED } else { TEXT_MUTED },
        );
        if del_resp.clicked() {
            action = Some(InspectorAction::DeleteNode(node_id));
        }

        ui.add_space(4.0);

        egui::ScrollArea::vertical().show(ui, |ui| {
            if is_save_image {
                // Bespoke Minimal SaveImage Inspector Surface (Clutter-Free, Direct, No Sockets/Routing)
                let (detected_slot, detected_asset) = upstream_context;
                let asset_name = detected_asset.unwrap_or("Asset");

                ui.add_space(6.0);

                // 1. Name Field (Hybrid custom name + Token system)
                ui.horizontal(|ui| {
                    ui.label(egui::RichText::new("Name").color(TEXT_PRIMARY).strong().size(12.0));
                });

                let mut name_template = if node.label.is_empty() || node.label == "SaveImage" || node.label == "TextureOutput" {
                    "T_{name}_{slot}".to_string()
                } else {
                    node.label.clone()
                };

                if ui.text_edit_singleline(&mut name_template).changed() {
                    node.label = name_template.clone();
                    action = Some(InspectorAction::LabelChanged {
                        node_id,
                        new_label: name_template.clone(),
                    });
                }

                // Token Chips Row
                ui.horizontal_wrapped(|ui| {
                    ui.label(egui::RichText::new("Tokens:").color(TEXT_MUTED).size(10.5));
                    for &token in &["{slot}", "{name}", "{res}", "{format}", "{colorspace}"] {
                        let chip_text = format!("+ {}", token);
                        let chip_btn = ui.add(
                            egui::Button::new(egui::RichText::new(chip_text).size(10.0).color(TEXT_SECONDARY))
                                .fill(Color32::from_rgb(32, 32, 44))
                                .corner_radius(8.0),
                        );
                        if chip_btn.clicked() {
                            if name_template.ends_with('_') || name_template.is_empty() {
                                name_template.push_str(token);
                            } else {
                                name_template.push('_');
                                name_template.push_str(token);
                            }
                            node.label = name_template.clone();
                            action = Some(InspectorAction::LabelChanged {
                                node_id,
                                new_label: name_template.clone(),
                            });
                        }
                    }
                });

                ui.add_space(2.0);

                // Current slot name
                let auto_slot = detected_slot.unwrap_or("BaseColor");
                let mut slot = node.get_string("slot_name", "");
                if slot.is_empty() {
                    slot = auto_slot.to_string();
                    node.set_param("slot_name", NodeParam::String(slot.clone()));
                }

                let fmt = node.get_string("format", "PNG");
                let colorspace = node.get_string("colorspace", "sRGB");
                let resolution_override = node.get_param("resolution").and_then(|p| p.as_resolution());

                // Live preview of resolved name
                let resolved_preview = resolve_token_name(
                    &name_template,
                    &slot,
                    asset_name,
                    resolution_override,
                    &fmt.to_lowercase(),
                    &colorspace,
                );
                ui.horizontal(|ui| {
                    ui.label(egui::RichText::new("Preview:").color(TEXT_MUTED).size(10.5));
                    ui.label(
                        egui::RichText::new(format!("{}.{}", resolved_preview, fmt.to_lowercase()))
                            .color(ACCENT_AMBER)
                            .size(11.0)
                            .strong(),
                    );
                });

                ui.add_space(8.0);
                ui.separator();
                ui.add_space(6.0);

                // 2. Slot Name Field with Auto-detect and Quick Capsule Presets
                ui.horizontal(|ui| {
                    ui.label(egui::RichText::new("Slot Name").color(TEXT_PRIMARY).strong().size(12.0));
                    if let Some(detected) = detected_slot {
                        ui.label(
                            egui::RichText::new(format!("⚡ Auto: {}", detected))
                                .color(Color32::from_rgb(56, 189, 248))
                                .size(10.5),
                        );
                    }
                });

                if ui.text_edit_singleline(&mut slot).changed() {
                    node.set_param("slot_name", NodeParam::String(slot.clone()));
                    action = Some(InspectorAction::ParamChanged {
                        node_id,
                        param_name: "slot_name".to_string(),
                        new_value: NodeParam::String(slot.clone()),
                    });
                }

                ui.add_space(3.0);
                ui.label(egui::RichText::new("Quick Presets:").color(TEXT_MUTED).size(10.5));

                // Preset capsule buttons
                ui.horizontal_wrapped(|ui| {
                    let presets = [
                        "BaseColor", "Normal", "Roughness", "Metallic", "AO",
                        "Height", "Mask", "ORM", "RMA",
                    ];
                    for preset in presets {
                        let is_selected = slot.eq_ignore_ascii_case(preset);
                        let btn_color = if is_selected {
                            Color32::from_rgba_premultiplied(255, 176, 46, 45)
                        } else {
                            Color32::from_rgb(32, 32, 42)
                        };
                        let text_color = if is_selected {
                            ACCENT_AMBER
                        } else {
                            TEXT_SECONDARY
                        };
                        let stroke = if is_selected {
                            Stroke::new(1.0_f32, ACCENT_AMBER)
                        } else {
                            Stroke::new(1.0_f32, BORDER_DARK)
                        };

                        let resp = ui.add(
                            egui::Button::new(egui::RichText::new(preset).size(10.5).color(text_color))
                                .fill(btn_color)
                                .stroke(stroke)
                                .corner_radius(10.0),
                        );
                        if resp.clicked() {
                            node.set_param("slot_name", NodeParam::String(preset.to_string()));
                            action = Some(InspectorAction::ParamChanged {
                                node_id,
                                param_name: "slot_name".to_string(),
                                new_value: NodeParam::String(preset.to_string()),
                            });
                        }
                    }

                    // Auto capsule button if auto-detected
                    if let Some(detected) = detected_slot {
                        let is_selected = slot.eq_ignore_ascii_case(detected);
                        let auto_label = format!("⚡ Auto ({})", detected);
                        let btn_color = if is_selected {
                            Color32::from_rgba_premultiplied(56, 189, 248, 45)
                        } else {
                            Color32::from_rgb(28, 36, 48)
                        };
                        let text_color = if is_selected {
                            Color32::from_rgb(56, 189, 248)
                        } else {
                            Color32::from_rgb(148, 163, 184)
                        };
                        let stroke = if is_selected {
                            Stroke::new(1.0_f32, Color32::from_rgb(56, 189, 248))
                        } else {
                            Stroke::new(1.0_f32, BORDER_DARK)
                        };
                        let resp = ui.add(
                            egui::Button::new(egui::RichText::new(auto_label).size(10.5).color(text_color))
                                .fill(btn_color)
                                .stroke(stroke)
                                .corner_radius(10.0),
                        );
                        if resp.clicked() {
                            node.set_param("slot_name", NodeParam::String(detected.to_string()));
                            action = Some(InspectorAction::ParamChanged {
                                node_id,
                                param_name: "slot_name".to_string(),
                                new_value: NodeParam::String(detected.to_string()),
                            });
                        }
                    }
                });

                ui.add_space(8.0);
                ui.separator();
                ui.add_space(6.0);

                // 3. Saved Image Size with Auto-Resize Feature
                ui.horizontal(|ui| {
                    ui.label(egui::RichText::new("Image Size").color(TEXT_PRIMARY).strong().size(12.0));
                });

                let current_res_label = match resolution_override {
                    None => "Source (Same as Input)".to_string(),
                    Some((512, 512)) => "512 x 512".to_string(),
                    Some((1024, 1024)) => "1024 x 1024 (1K)".to_string(),
                    Some((2048, 2048)) => "2048 x 2048 (2K)".to_string(),
                    Some((4096, 4096)) => "4096 x 4096 (4K)".to_string(),
                    Some((8192, 8192)) => "8192 x 8192 (8K)".to_string(),
                    Some((w, h)) => format!("Custom: {} x {}", w, h),
                };

                egui::ComboBox::from_id_salt("saveimage_size_select")
                    .selected_text(&current_res_label)
                    .show_ui(ui, |ui| {
                        if ui.selectable_label(resolution_override.is_none(), "Source (Same as Input)").clicked() {
                            node.params.remove("resolution");
                            action = Some(InspectorAction::ParamChanged {
                                node_id,
                                param_name: "resolution".to_string(),
                                new_value: NodeParam::Resolution { width: 0, height: 0 },
                            });
                        }
                        for &(w, h, label) in &[
                            (512, 512, "512 x 512"),
                            (1024, 1024, "1024 x 1024 (1K)"),
                            (2048, 2048, "2048 x 2048 (2K)"),
                            (4096, 4096, "4096 x 4096 (4K)"),
                            (8192, 8192, "8192 x 8192 (8K)"),
                        ] {
                            let is_sel = resolution_override == Some((w, h));
                            if ui.selectable_label(is_sel, label).clicked() {
                                node.set_param("resolution", NodeParam::Resolution { width: w, height: h });
                                action = Some(InspectorAction::ParamChanged {
                                    node_id,
                                    param_name: "resolution".to_string(),
                                    new_value: NodeParam::Resolution { width: w, height: h },
                                });
                            }
                        }
                    });

                ui.add_space(2.0);
                ui.label(
                    egui::RichText::new("Auto-resizes buffer during evaluation & export (Lanczos3)")
                        .color(TEXT_MUTED)
                        .size(10.5),
                );

                ui.add_space(8.0);
                ui.separator();
                ui.add_space(6.0);

                // 4. File Format & Colorspace
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(egui::RichText::new("Format").color(TEXT_PRIMARY).strong().size(12.0));
                        egui::ComboBox::from_id_salt("saveimage_fmt_select")
                            .selected_text(&fmt)
                            .show_ui(ui, |ui| {
                                for &upper in &["PNG", "TGA", "EXR", "JPG"] {
                                    if ui.selectable_label(fmt == upper, upper).clicked() {
                                        node.set_param("format", NodeParam::String(upper.to_string()));
                                        action = Some(InspectorAction::ParamChanged {
                                            node_id,
                                            param_name: "format".to_string(),
                                            new_value: NodeParam::String(upper.to_string()),
                                        });
                                    }
                                }
                            });
                    });

                    ui.add_space(16.0);

                    ui.vertical(|ui| {
                        ui.label(egui::RichText::new("Colorspace").color(TEXT_PRIMARY).strong().size(12.0));
                        egui::ComboBox::from_id_salt("saveimage_cs_select")
                            .selected_text(&colorspace)
                            .show_ui(ui, |ui| {
                                for &cs in &["sRGB", "Linear"] {
                                    if ui.selectable_label(colorspace == cs, cs).clicked() {
                                        node.set_param("colorspace", NodeParam::String(cs.to_string()));
                                        action = Some(InspectorAction::ParamChanged {
                                            node_id,
                                            param_name: "colorspace".to_string(),
                                            new_value: NodeParam::String(cs.to_string()),
                                        });
                                    }
                                }
                            });
                    });
                });
            } else {
                // Section 1: Node Identity
                property_section(ui, "section_identity", "Node Identity", true, |ui| {
                ui.horizontal(|ui| {
                    ui.label(egui::RichText::new("Label:").color(TEXT_MUTED).size(12.0));
                    let mut label_text = node.label.clone();
                    if ui.text_edit_singleline(&mut label_text).changed() {
                        node.label = label_text.clone();
                        action = Some(InspectorAction::LabelChanged {
                            node_id,
                            new_label: label_text,
                        });
                    }
                });

                ui.horizontal(|ui| {
                    ui.label(egui::RichText::new(format!("ID: #{}  |  Type: {}", node.id, node.node_type)).color(TEXT_MUTED).size(11.0));
                });
            });

            // Section 2: Parameters (Collapsible accordion section)
            property_section(ui, "section_params", "Parameters", true, |ui| {

            match node.node_type.as_str() {
                "ConstantScalar" | "Scalar" => {
                    let mut val = node.get_float("value", 1.0);
                    ui.label("Scalar Value (0.0 - 1.0):");
                    if ui.add(Slider::new(&mut val, 0.0..=1.0).step_by(0.01)).changed() {
                        node.set_param("value", NodeParam::Float(val));
                        action = Some(InspectorAction::ParamChanged {
                            node_id,
                            param_name: "value".to_string(),
                            new_value: NodeParam::Float(val),
                        });
                    }
                }

                "ConstantColor" | "Color" => {
                    let mut col = node.get_color("color", [1.0, 1.0, 1.0, 1.0]);
                    ui.label("Color RGBA:");
                    let mut egui_col = Color32::from_rgba_unmultiplied(
                        (col[0] * 255.0) as u8,
                        (col[1] * 255.0) as u8,
                        (col[2] * 255.0) as u8,
                        (col[3] * 255.0) as u8,
                    );
                    if ui.color_edit_button_srgba(&mut egui_col).changed() {
                        col = [
                            egui_col.r() as f32 / 255.0,
                            egui_col.g() as f32 / 255.0,
                            egui_col.b() as f32 / 255.0,
                            egui_col.a() as f32 / 255.0,
                        ];
                        node.set_param("color", NodeParam::Color(col));
                        action = Some(InspectorAction::ParamChanged {
                            node_id,
                            param_name: "color".to_string(),
                            new_value: NodeParam::Color(col),
                        });
                    }

                    // Float sliders for high precision
                    ui.add_space(4.0);
                    let mut changed = false;
                    ui.horizontal(|ui| {
                        ui.label("R:");
                        changed |= ui.add(Slider::new(&mut col[0], 0.0..=1.0)).changed();
                    });
                    ui.horizontal(|ui| {
                        ui.label("G:");
                        changed |= ui.add(Slider::new(&mut col[1], 0.0..=1.0)).changed();
                    });
                    ui.horizontal(|ui| {
                        ui.label("B:");
                        changed |= ui.add(Slider::new(&mut col[2], 0.0..=1.0)).changed();
                    });
                    ui.horizontal(|ui| {
                        ui.label("A:");
                        changed |= ui.add(Slider::new(&mut col[3], 0.0..=1.0)).changed();
                    });
                    if changed {
                        node.set_param("color", NodeParam::Color(col));
                        action = Some(InspectorAction::ParamChanged {
                            node_id,
                            param_name: "color".to_string(),
                            new_value: NodeParam::Color(col),
                        });
                    }
                }

                "Levels" => {
                    let mut in_low = node.get_float("in_low", 0.0);
                    let mut in_high = node.get_float("in_high", 1.0);
                    let mut gamma = node.get_float("gamma", 1.0);
                    let mut out_low = node.get_float("out_low", 0.0);
                    let mut out_high = node.get_float("out_high", 1.0);
                    let mut contrast = node.get_float("contrast", 1.0);

                    let mut changed = false;
                    ui.label("Input Black Point:");
                    changed |= ui.add(Slider::new(&mut in_low, 0.0..=1.0)).changed();
                    ui.label("Input White Point:");
                    changed |= ui.add(Slider::new(&mut in_high, 0.0..=1.0)).changed();
                    ui.label("Gamma:");
                    changed |= ui.add(Slider::new(&mut gamma, 0.1..=5.0).logarithmic(true)).changed();
                    ui.label("Output Black Point:");
                    changed |= ui.add(Slider::new(&mut out_low, 0.0..=1.0)).changed();
                    ui.label("Output White Point:");
                    changed |= ui.add(Slider::new(&mut out_high, 0.0..=1.0)).changed();
                    ui.label("Contrast:");
                    changed |= ui.add(Slider::new(&mut contrast, 0.0..=3.0)).changed();

                    if changed {
                        node.set_param("in_low", NodeParam::Float(in_low));
                        node.set_param("in_high", NodeParam::Float(in_high));
                        node.set_param("gamma", NodeParam::Float(gamma));
                        node.set_param("out_low", NodeParam::Float(out_low));
                        node.set_param("out_high", NodeParam::Float(out_high));
                        node.set_param("contrast", NodeParam::Float(contrast));
                        action = Some(InspectorAction::ParamChanged {
                            node_id,
                            param_name: "gamma".to_string(),
                            new_value: NodeParam::Float(gamma),
                        });
                    }
                }

                "Invert" => {
                    let mut invert_rgb = node.get_bool("invert_rgb", true);
                    let mut invert_a = node.get_bool("invert_alpha", false);
                    let mut changed = false;

                    changed |= ui.checkbox(&mut invert_rgb, "Invert RGB").changed();
                    changed |= ui.checkbox(&mut invert_a, "Invert Alpha").changed();

                    if changed {
                        node.set_param("invert_rgb", NodeParam::Bool(invert_rgb));
                        node.set_param("invert_alpha", NodeParam::Bool(invert_a));
                        action = Some(InspectorAction::ParamChanged {
                            node_id,
                            param_name: "invert_rgb".to_string(),
                            new_value: NodeParam::Bool(invert_rgb),
                        });
                    }
                }

                "NormalFlipGreen" | "FlipGreen" => {
                    let mut flip_green = node.get_bool("flip_green", true);
                    ui.label("DirectX <-> OpenGL Standard:");
                    if ui.checkbox(&mut flip_green, "Invert Green Channel (Y)").changed() {
                        node.set_param("flip_green", NodeParam::Bool(flip_green));
                        action = Some(InspectorAction::ParamChanged {
                            node_id,
                            param_name: "flip_green".to_string(),
                            new_value: NodeParam::Bool(flip_green),
                        });
                    }
                }

                "NormalStrength" => {
                    let mut strength = node.get_float("strength", 1.0);
                    ui.label("Normal Map Strength:");
                    if ui.add(Slider::new(&mut strength, 0.0..=5.0)).changed() {
                        node.set_param("strength", NodeParam::Float(strength));
                        action = Some(InspectorAction::ParamChanged {
                            node_id,
                            param_name: "strength".to_string(),
                            new_value: NodeParam::Float(strength),
                        });
                    }
                }

                "BrightnessContrast" => {
                    let mut brightness = node.get_float("brightness", 0.0);
                    let mut contrast = node.get_float("contrast", 1.0);
                    let mut changed = false;

                    ui.label("Brightness:");
                    changed |= ui.add(Slider::new(&mut brightness, -1.0..=1.0)).changed();
                    ui.label("Contrast:");
                    changed |= ui.add(Slider::new(&mut contrast, 0.0..=3.0)).changed();

                    if changed {
                        node.set_param("brightness", NodeParam::Float(brightness));
                        node.set_param("contrast", NodeParam::Float(contrast));
                        action = Some(InspectorAction::ParamChanged {
                            node_id,
                            param_name: "brightness".to_string(),
                            new_value: NodeParam::Float(brightness),
                        });
                    }
                }

                "LayerBlend" | "Blend" => {
                    let current_mode = node.get_string("mode", "Normal");
                    let mut opacity = node.get_float("opacity", 1.0);

                    ui.label("Blend Mode:");
                    egui::ComboBox::from_id_salt("blend_mode_select")
                        .selected_text(&current_mode)
                        .show_ui(ui, |ui| {
                            for &label in &[
                                "Normal", "Multiply", "Add", "Subtract", "Screen", "Overlay", "Darken", "Lighten",
                            ] {
                                let is_selected = current_mode == label;
                                if ui.selectable_label(is_selected, label).clicked() {
                                    node.set_param("mode", NodeParam::String(label.to_string()));
                                    action = Some(InspectorAction::ParamChanged {
                                        node_id,
                                        param_name: "mode".to_string(),
                                        new_value: NodeParam::String(label.to_string()),
                                    });
                                }
                            }
                        });

                    ui.label("Layer Opacity:");
                    if ui.add(Slider::new(&mut opacity, 0.0..=1.0)).changed() {
                        node.set_param("opacity", NodeParam::Float(opacity));
                        action = Some(InspectorAction::ParamChanged {
                            node_id,
                            param_name: "opacity".to_string(),
                            new_value: NodeParam::Float(opacity),
                        });
                    }
                }

                "Math" => {
                    let current_op = node.get_string("op", "Multiply");
                    let mut scalar_b = node.get_float("scalar_b", 1.0);

                    ui.label("Math Operation:");
                    egui::ComboBox::from_id_salt("math_op_select")
                        .selected_text(&current_op)
                        .show_ui(ui, |ui| {
                            for &label in &[
                                "Add", "Subtract", "Multiply", "Divide", "Power", "Min", "Max",
                                "Clamp", "Abs", "Step", "Smoothstep", "Modulo", "Invert",
                            ] {
                                let is_selected = current_op == label;
                                if ui.selectable_label(is_selected, label).clicked() {
                                    node.set_param("op", NodeParam::String(label.to_string()));
                                    action = Some(InspectorAction::ParamChanged {
                                        node_id,
                                        param_name: "op".to_string(),
                                        new_value: NodeParam::String(label.to_string()),
                                    });
                                }
                            }
                        });

                    ui.label("Fallback Scalar B (when port B unlinked):");
                    if ui.add(DragValue::new(&mut scalar_b).speed(0.01)).changed() {
                        node.set_param("scalar_b", NodeParam::Float(scalar_b));
                        action = Some(InspectorAction::ParamChanged {
                            node_id,
                            param_name: "scalar_b".to_string(),
                            new_value: NodeParam::Float(scalar_b),
                        });
                    }
                }

                "Resize" => {
                    let (mut w, mut h) = node.get_param("resolution")
                        .and_then(|p| p.as_resolution())
                        .unwrap_or((2048, 2048));

                    ui.label("Resolution Preset:");
                    for &res in &[512, 1024, 2048, 4096] {
                        if ui.selectable_label(w == res && h == res, format!("{}x{}", res, res)).clicked() {
                            w = res;
                            h = res;
                            node.set_param("resolution", NodeParam::Resolution { width: w, height: h });
                            action = Some(InspectorAction::ParamChanged {
                                node_id,
                                param_name: "resolution".to_string(),
                                new_value: NodeParam::Resolution { width: w, height: h },
                            });
                        }
                    }

                    let current_filter = node.get_string("filter", "Bilinear");
                    ui.label("Resampling Filter:");
                    egui::ComboBox::from_id_salt("resize_filter_select")
                        .selected_text(&current_filter)
                        .show_ui(ui, |ui| {
                            for &label in &["Nearest", "Bilinear", "Lanczos3"] {
                                if ui.selectable_label(current_filter == label, label).clicked() {
                                    node.set_param("filter", NodeParam::String(label.to_string()));
                                    action = Some(InspectorAction::ParamChanged {
                                        node_id,
                                        param_name: "filter".to_string(),
                                        new_value: NodeParam::String(label.to_string()),
                                    });
                                }
                            }
                        });
                }

                "TextureInput" => {
                    let mut path = node.get_string("file_path", "");
                    if path.is_empty() {
                        path = node.get_string("path", "");
                    }
                    ui.label("Texture File Path:");
                    ui.horizontal(|ui| {
                        if ui.text_edit_singleline(&mut path).changed() {
                            let path_clone = path.clone();
                            node.set_param("file_path", NodeParam::String(path_clone.clone()));
                            node.set_param("path", NodeParam::String(path_clone.clone()));
                            if !path_clone.is_empty() {
                                let file_name = std::path::Path::new(&path_clone)
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or(&path_clone)
                                    .to_string();
                                node.label = file_name;
                                let metadata = crate::normalizer::LexicalNormalizer::normalize(&path_clone);
                                if let Some(role) = metadata.inferred_role {
                                    node.set_param("colorspace", NodeParam::String(role.default_colorspace().to_string()));
                                }
                            }
                            action = Some(InspectorAction::ParamChanged {
                                node_id,
                                param_name: "file_path".to_string(),
                                new_value: NodeParam::String(path_clone),
                            });
                        }
                        if ui.button("Browse...").clicked() {
                            if let Some(file) = rfd::FileDialog::new()
                                .add_filter("Images", &["png", "tga", "jpg", "jpeg", "webp", "bmp", "exr", "tif", "tiff"])
                                .pick_file()
                            {
                                let path_str = file.display().to_string();
                                let file_name = file
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or(&path_str)
                                    .to_string();
                                node.set_param("file_path", NodeParam::String(path_str.clone()));
                                node.set_param("path", NodeParam::String(path_str.clone()));
                                node.label = file_name;
                                let metadata = crate::normalizer::LexicalNormalizer::normalize(&path_str);
                                if let Some(role) = metadata.inferred_role {
                                    node.set_param("colorspace", NodeParam::String(role.default_colorspace().to_string()));
                                }
                                action = Some(InspectorAction::ParamChanged {
                                    node_id,
                                    param_name: "file_path".to_string(),
                                    new_value: NodeParam::String(path_str),
                                });
                            }
                        }
                    });

                    let cs = node.get_string("colorspace", "sRGB");
                    ui.label("Color Space:");
                    egui::ComboBox::from_id_salt("input_cs_select")
                        .selected_text(&cs)
                        .show_ui(ui, |ui| {
                            for &opt in &["sRGB", "Linear"] {
                                if ui.selectable_label(cs == opt, opt).clicked() {
                                    node.set_param("colorspace", NodeParam::String(opt.to_string()));
                                    action = Some(InspectorAction::ParamChanged {
                                        node_id,
                                        param_name: "colorspace".to_string(),
                                        new_value: NodeParam::String(opt.to_string()),
                                    });
                                }
                            }
                        });
                }

                _ => {
                    ui.label(
                        egui::RichText::new("Generic Node Parameters:")
                            .color(crate::ui::theme::TEXT_MUTED),
                    );
                    let keys: Vec<String> = node.params.keys().cloned().collect();
                    for key in keys {
                        if let Some(param) = node.params.get(&key) {
                            ui.label(format!("{}: {:?}", key, param));
                        }
                    }
                }
            }
            });

            // Section 3: Sockets & Routing
            property_section(ui, "section_sockets", "Sockets & Routing", false, |ui| {
                ui.horizontal(|ui| {
                    if !node.inputs.is_empty() {
                        ui.vertical(|ui| {
                            ui.label(egui::RichText::new("Inputs").size(11.0).color(TEXT_MUTED));
                            for pin in &node.inputs {
                                let col = pin_wire_color(&pin.name);
                                ui.horizontal(|ui| {
                                    ui.colored_label(col, "◀");
                                    ui.label(egui::RichText::new(&pin.name).size(11.5).color(TEXT_PRIMARY));
                                });
                            }
                        });
                    }
                    if !node.inputs.is_empty() && !node.outputs.is_empty() {
                        ui.separator();
                    }
                    if !node.outputs.is_empty() {
                        ui.vertical(|ui| {
                            ui.label(egui::RichText::new("Outputs").size(11.0).color(TEXT_MUTED));
                            for pin in &node.outputs {
                                let col = pin_wire_color(&pin.name);
                                ui.horizontal(|ui| {
                                    ui.colored_label(col, "▶");
                                    ui.label(egui::RichText::new(&pin.name).size(11.5).color(TEXT_PRIMARY));
                                });
                            }
                        });
                    }
                });
            });
            }
        });
    });

    action
}

/// Infers node category from type name for badge color styling.
fn infer_category(node_type: &str) -> NodeCategory {
    match node_type {
        "SaveImage" | "TextureInput" | "TextureOutput" | "Input" | "Output" => NodeCategory::Io,
        "ConstantScalar" | "ConstantColor" | "Scalar" | "Color" => NodeCategory::Constants,
        "ChannelCombine" | "ChannelSplit" | "ChannelMixer" | "ChannelPack" | "ChannelUnpack" => {
            NodeCategory::ChannelOps
        }
        "Invert" | "Levels" | "BrightnessContrast" => NodeCategory::ColorAdjust,
        "NormalFlipGreen" | "NormalNormalize" | "NormalStrength" | "FlipGreen" => {
            NodeCategory::NormalOps
        }
        "LayerBlend" | "NormalBlendRNM" | "Blend" => NodeCategory::BlendOps,
        "Math" => NodeCategory::Math,
        "Resize" => NodeCategory::Transform,
        _ => NodeCategory::Math,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inspector_category_inference() {
        assert_eq!(infer_category("TextureInput"), NodeCategory::Io);
        assert_eq!(infer_category("ConstantScalar"), NodeCategory::Constants);
        assert_eq!(infer_category("ChannelCombine"), NodeCategory::ChannelOps);
        assert_eq!(infer_category("Levels"), NodeCategory::ColorAdjust);
        assert_eq!(infer_category("NormalFlipGreen"), NodeCategory::NormalOps);
        assert_eq!(infer_category("LayerBlend"), NodeCategory::BlendOps);
        assert_eq!(infer_category("Math"), NodeCategory::Math);
        assert_eq!(infer_category("Resize"), NodeCategory::Transform);
    }

    #[test]
    fn test_node_param_mutation_and_action() {
        let mut node = Node::new(NodeId(1), "ConstantScalar", "Scalar Test", [0.0, 0.0]);
        node.set_param("value", NodeParam::Float(0.5));

        assert_eq!(node.get_float("value", 0.0), 0.5);

        node.set_param("value", NodeParam::Float(0.85));
        assert_eq!(node.get_float("value", 0.0), 0.85);
    }

    #[test]
    fn test_texture_input_manual_loading_and_colorspace_autodetect() {
        let mut node = Node::new(NodeId(10), "TextureInput", "TextureInput", [0.0, 0.0]);
        let test_path = "C:/Assets/Textures/T_Cobblestone_Wall_ORM.png";

        let file_name = std::path::Path::new(test_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap()
            .to_string();
        node.set_param("file_path", NodeParam::String(test_path.to_string()));
        node.set_param("path", NodeParam::String(test_path.to_string()));
        node.label = file_name;

        let meta = crate::normalizer::LexicalNormalizer::normalize(test_path);
        assert_eq!(meta.inferred_role, Some(crate::normalizer::PbrRole::PackedOrm));
        node.set_param("colorspace", NodeParam::String(meta.inferred_role.unwrap().default_colorspace().to_string()));

        assert_eq!(node.label, "T_Cobblestone_Wall_ORM.png");
        assert_eq!(node.get_string("file_path", ""), test_path);
        assert_eq!(node.get_string("colorspace", ""), "Linear");
    }

    #[test]
    fn test_resolve_token_name() {
        let template = "T_{name}_{slot}_{res}";
        let resolved = resolve_token_name(
            template,
            "AO",
            "Cobblestone_Wall",
            Some((2048, 2048)),
            "png",
            "sRGB",
        );
        assert_eq!(resolved, "T_Cobblestone_Wall_AO_2048");

        let plain = resolve_token_name("Final_Albedo", "Albedo", "Asset", None, "png", "sRGB");
        assert_eq!(plain, "Final_Albedo");
    }

    #[test]
    fn test_detect_upstream_slot_name_through_math_adjust() {
        let mut graph = Graph::new();

        // 1. TextureInput with ORM texture
        let n1_id = NodeId(1);
        let mut n1 = Node::new(n1_id, "TextureInput", "T_Rock_ORM.png", [0.0, 0.0]);
        n1.add_output("output");
        n1.add_output("RGBA");
        n1.add_output("R");
        n1.add_output("G");
        n1.add_output("B");
        n1.add_output("A");
        graph.add_node(n1);

        // 2. Intermediate Levels node
        let n2_id = NodeId(2);
        let mut n2 = Node::new(n2_id, "Levels", "Levels", [200.0, 0.0]);
        n2.add_input("input");
        n2.add_output("output");
        graph.add_node(n2);

        // 3. Intermediate Invert node
        let n3_id = NodeId(3);
        let mut n3 = Node::new(n3_id, "Invert", "Invert", [400.0, 0.0]);
        n3.add_input("input");
        n3.add_output("output");
        graph.add_node(n3);

        // 4. SaveImage node
        let n4_id = NodeId(4);
        let mut n4 = Node::new(n4_id, "SaveImage", "Save Image", [600.0, 0.0]);
        n4.add_input("input");
        graph.add_node(n4);

        // Connect n1 (R pin = AO in ORM) -> Levels -> Invert -> SaveImage
        graph.connect(crate::graph::model::PinId::output(n1_id, "R"), crate::graph::model::PinId::input(n2_id, "input")).unwrap();
        graph.connect(crate::graph::model::PinId::output(n2_id, "output"), crate::graph::model::PinId::input(n3_id, "input")).unwrap();
        graph.connect(crate::graph::model::PinId::output(n3_id, "output"), crate::graph::model::PinId::input(n4_id, "input")).unwrap();

        // Trace upstream
        let (slot, asset) = detect_upstream_context(&graph, n4_id);
        assert_eq!(slot.as_deref(), Some("AO"));
        assert_eq!(asset.as_deref(), Some("Rock"));
    }
}
