//! Node Parameter Inspector (Phase 5).
//!
//! Provides the properties panel editing node parameters (min/max, gamma,
//! routing rows, color, formats, and blend modes) and emits mutations
//! to trigger reactive evaluation.

use egui::{Color32, DragValue, Slider, Ui, Vec2};
use crate::graph::model::{Node, NodeId, NodeParam};
use crate::nodes::NodeCategory;

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

/// Renders the Properties Inspector panel for the currently selected node.
pub fn show_inspector(
    ui: &mut Ui,
    node: Option<&mut Node>,
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
        // Node Header Banner with Category Accent Strip
        let cat = infer_category(&node.node_type);
        let badge_color = crate::ui::theme::category_color(cat);

        let (accent_strip_rect, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 2.5), egui::Sense::hover());
        ui.painter().rect_filled(accent_strip_rect, 1.0, badge_color);

        ui.add_space(4.0);

        ui.horizontal(|ui| {
            ui.colored_label(badge_color, "•");
            ui.label(
                egui::RichText::new(&node.node_type)
                    .color(crate::ui::theme::TEXT_PRIMARY)
                    .size(15.0)
                    .strong(),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui
                    .button(egui::RichText::new("Delete").color(crate::ui::theme::WIRE_RED).size(11.0))
                    .clicked()
                {
                    action = Some(InspectorAction::DeleteNode(node_id));
                }
            });
        });

        ui.label(
            egui::RichText::new(format!("Category: {}  •  Node ID: {}", cat, node.id))
                .color(crate::ui::theme::TEXT_MUTED)
                .size(11.0),
        );

        ui.separator();

        // Editable Label
        ui.horizontal(|ui| {
            ui.label("Label:");
            let mut label_text = node.label.clone();
            if ui.text_edit_singleline(&mut label_text).changed() {
                node.label = label_text.clone();
                action = Some(InspectorAction::LabelChanged {
                    node_id,
                    new_label: label_text,
                });
            }
        });

        ui.separator();

        // Parameter Sections based on Node Type
        egui::ScrollArea::vertical().show(ui, |ui| {
            ui.heading(egui::RichText::new("Parameters").size(14.0).color(crate::ui::theme::TEXT_SECONDARY));
            ui.add_space(4.0);

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
                    let mut path = node.get_string("path", "");
                    ui.label("Texture File Path:");
                    ui.horizontal(|ui| {
                        if ui.text_edit_singleline(&mut path).changed() {
                            node.set_param("path", NodeParam::String(path.clone()));
                            action = Some(InspectorAction::ParamChanged {
                                node_id,
                                param_name: "path".to_string(),
                                new_value: NodeParam::String(path.clone()),
                            });
                        }
                        if ui.button("📁 Browse...").clicked() {
                            if let Some(file) = rfd::FileDialog::new()
                                .add_filter("Images", &["png", "tga", "jpg", "jpeg", "webp", "bmp"])
                                .pick_file()
                            {
                                let path_str = file.display().to_string();
                                node.set_param("path", NodeParam::String(path_str.clone()));
                                action = Some(InspectorAction::ParamChanged {
                                    node_id,
                                    param_name: "path".to_string(),
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

                "TextureOutput" => {
                    let mut slot = node.get_string("slot_name", "BaseColor");
                    ui.label("Slot Name (e.g. Albedo, Normal, Roughness, ORM):");
                    if ui.text_edit_singleline(&mut slot).changed() {
                        node.set_param("slot_name", NodeParam::String(slot.clone()));
                        action = Some(InspectorAction::ParamChanged {
                            node_id,
                            param_name: "slot_name".to_string(),
                            new_value: NodeParam::String(slot),
                        });
                    }

                    let fmt = node.get_string("format", "PNG");
                    ui.label("Output File Format:");
                    egui::ComboBox::from_id_salt("output_fmt_select")
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

            ui.add_space(10.0);
            ui.separator();

            // Sockets Summary
            ui.heading(egui::RichText::new("Sockets").size(14.0).color(crate::ui::theme::TEXT_SECONDARY));
            ui.horizontal(|ui| {
                ui.vertical(|ui| {
                    ui.label(egui::RichText::new("Inputs:").strong());
                    for pin in &node.inputs {
                        ui.colored_label(
                            crate::ui::theme::pin_wire_color(&pin.name),
                            format!("◀ {}", pin.name),
                        );
                    }
                });
                ui.separator();
                ui.vertical(|ui| {
                    ui.label(egui::RichText::new("Outputs:").strong());
                    for pin in &node.outputs {
                        ui.colored_label(
                            crate::ui::theme::pin_wire_color(&pin.name),
                            format!("{} ▶", pin.name),
                        );
                    }
                });
            });
        });
    });

    action
}

/// Infers node category from type name for badge color styling.
fn infer_category(node_type: &str) -> NodeCategory {
    match node_type {
        "TextureInput" | "TextureOutput" | "Input" | "Output" => NodeCategory::Io,
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
}
