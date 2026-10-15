//! Texture Set Completeness & Consistency Validator (Phase 3).
//!
//! Provides comprehensive pre-export validation checking:
//! 1. Map Completeness — verifies all expected PBR channel maps are connected to export targets.
//! 2. Resolution Consistency — verifies all maps in the set share uniform pixel dimensions.
//! 3. Power-of-Two (POT) Compliance — detects non-POT textures causing GPU mipmap / streaming issues.
//! 4. PBR Naming Conventions — validates filenames and tokens against 60+ industry standards.
//!
//! Also provides one-click automated "Fix" actions (e.g., auto-inserting `Resize` nodes).

use std::collections::{HashMap, HashSet};
use std::path::Path;

use egui::{Color32, RichText, Ui};
use serde::{Deserialize, Serialize};

use crate::graph::evaluator::GraphEvaluator;
use crate::graph::model::{Graph, Node, NodeId, NodeParam, PinId};
use crate::normalizer::rules::LexicalNormalizer;
use crate::ui::theme::{
    BORDER_DARK, BORDER_SUBTLE, BG_CARD, BG_PANEL,
    TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY,
};

/// Color tokens for pass/warn/fail badges.
pub const COLOR_PASS: Color32 = Color32::from_rgb(64, 200, 120);
pub const COLOR_WARN: Color32 = Color32::from_rgb(255, 179, 0);
pub const COLOR_FAIL: Color32 = Color32::from_rgb(239, 83, 80);

/// Detailed texture set validation report.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct TextureSetReport {
    /// Expected but not connected maps (e.g. "Normal" missing).
    pub missing_maps: Vec<String>,
    /// Maps at different resolutions across the set: `(map_name, (width, height))`.
    pub resolution_mismatches: Vec<(String, (u32, u32))>,
    /// Maps with non-power-of-two dimensions: `(map_name, (width, height))`.
    pub non_pot_maps: Vec<(String, (u32, u32))>,
    /// Files or inputs not matching any known PBR naming convention.
    pub naming_warnings: Vec<String>,
    /// Recommended target resolution for the set (width, height).
    pub target_resolution: (u32, u32),
    /// Offending node IDs for resolution mismatches (map_name -> node_id).
    #[serde(skip)]
    pub offending_nodes: HashMap<String, NodeId>,
}

impl TextureSetReport {
    /// Returns true if all checks passed without any errors or warnings.
    pub fn is_all_green(&self) -> bool {
        self.missing_maps.is_empty()
            && self.resolution_mismatches.is_empty()
            && self.non_pot_maps.is_empty()
            && self.naming_warnings.is_empty()
    }

    /// Returns true if any critical error exists (missing map, mismatch, non-POT).
    pub fn has_errors(&self) -> bool {
        !self.missing_maps.is_empty()
            || !self.resolution_mismatches.is_empty()
            || !self.non_pot_maps.is_empty()
    }

    /// Returns true if any non-critical naming warning exists.
    pub fn has_warnings(&self) -> bool {
        !self.naming_warnings.is_empty()
    }

    /// Total count of errors and warnings.
    pub fn total_issues(&self) -> usize {
        self.missing_maps.len()
            + self.resolution_mismatches.len()
            + self.non_pot_maps.len()
            + self.naming_warnings.len()
    }

    /// Returns a short human-readable summary status.
    pub fn status_summary(&self) -> String {
        if self.is_all_green() {
            "All checks passed — Ready for production export".to_string()
        } else if self.has_errors() {
            format!("{} critical issue(s) detected", self.total_issues())
        } else {
            format!("{} naming convention warning(s)", self.naming_warnings.len())
        }
    }
}

/// Validates a texture authoring graph and evaluated cache for completeness and consistency.
pub fn validate_texture_set(graph: &Graph, evaluator: &GraphEvaluator) -> TextureSetReport {
    let mut report = TextureSetReport::default();

    // 1. Discover all output targets and active input maps
    let output_nodes: Vec<&Node> = graph
        .nodes
        .values()
        .filter(|n| n.node_type == "SaveImage" || n.node_type == "TextureOutput")
        .collect();

    let input_nodes: Vec<&Node> = graph
        .nodes
        .values()
        .filter(|n| n.node_type == "TextureInput" || n.node_type == "Input")
        .collect();

    let default_res = evaluator.default_resolution();

    // -------------------------------------------------------------
    // Check 1: Missing Maps (Expected but not connected)
    // -------------------------------------------------------------
    // A. Output nodes with no incoming connection
    for node in &output_nodes {
        let is_connected = node.inputs.iter().any(|pin| graph.incoming_edge(pin).is_some());
        if !is_connected {
            let slot = node.get_string("slot_name", "");
            let name = if !slot.is_empty() {
                slot
            } else {
                node.label.clone()
            };
            if !report.missing_maps.contains(&name) {
                report.missing_maps.push(name);
            }
        }
    }

    // B. Channel combiner / packing nodes with unconnected primary channels
    for node in graph.nodes.values() {
        if node.node_type == "ChannelCombine" || node.node_type == "ChannelPack" {
            let is_used = graph.edges.iter().any(|e| e.from.node_id == node.id)
                || graph.edges.iter().any(|e| e.to.node_id == node.id);

            if is_used {
                let is_orm = node.label.to_lowercase().contains("orm");
                let is_maskmap = node.label.to_lowercase().contains("mask");

                // Check R, G, B channels
                let check_pins = if is_maskmap {
                    vec![("R", "Metallic"), ("G", "Ambient Occlusion"), ("B", "Detail Mask"), ("A", "Smoothness")]
                } else if is_orm {
                    vec![("R", "Ambient Occlusion (R)"), ("G", "Roughness (G)"), ("B", "Metallic (B)")]
                } else {
                    vec![("R", "R Channel"), ("G", "G Channel"), ("B", "B Channel")]
                };

                for (pin_name, desc) in check_pins {
                    let pin_id = PinId::input(node.id, pin_name);
                    if graph.incoming_edge(&pin_id).is_none() {
                        let missing_desc = format!("{}: {}", node.label, desc);
                        if !report.missing_maps.contains(&missing_desc) {
                            report.missing_maps.push(missing_desc);
                        }
                    }
                }
            }
        }
    }

    // C. Spec/Gloss to Metal/Rough missing input connections
    for node in graph.nodes.values() {
        if node.node_type == "SpecGlossToMetalRough" {
            let is_used = graph.edges.iter().any(|e| e.from.node_id == node.id);
            if is_used {
                let spec_pin = PinId::input(node.id, "specular");
                let gloss_pin = PinId::input(node.id, "glossiness");
                if graph.incoming_edge(&spec_pin).is_none() {
                    let msg = format!("{}: Specular input", node.label);
                    if !report.missing_maps.contains(&msg) {
                        report.missing_maps.push(msg);
                    }
                }
                if graph.incoming_edge(&gloss_pin).is_none() {
                    let msg = format!("{}: Glossiness input", node.label);
                    if !report.missing_maps.contains(&msg) {
                        report.missing_maps.push(msg);
                    }
                }
            }
        }
    }

    // D. Incomplete PBR Material set: If graph exports individual Albedo and Metallic/Roughness,
    // but lacks any Normal map output or node
    if !output_nodes.is_empty() {
        let has_albedo = output_nodes.iter().any(|n| {
            let s = n.get_string("slot_name", &n.label).to_lowercase();
            s.contains("albedo") || s.contains("basecolor") || s.contains("diffuse")
        });
        let has_rough_or_metal = output_nodes.iter().any(|n| {
            let s = n.get_string("slot_name", &n.label).to_lowercase();
            (s.contains("rough") || s.contains("metal")) && !s.contains("orm")
        });
        let has_normal = output_nodes.iter().any(|n| {
            let s = n.get_string("slot_name", &n.label).to_lowercase();
            s.contains("normal") || s == "n"
        }) || graph.nodes.values().any(|n| {
            n.node_type == "NormalFlipGreen"
                || n.node_type == "NormalNormalize"
                || n.node_type == "NormalStrength"
                || n.node_type == "NormalBlend"
        });

        if has_albedo && has_rough_or_metal && !has_normal
            && !report.missing_maps.contains(&"Normal".to_string())
        {
            report.missing_maps.push("Normal".to_string());
        }
    }

    // -------------------------------------------------------------
    // Check 2 & 3: Resolution Consistency and POT Dimensions
    // -------------------------------------------------------------
    // Collect active map entries: (name, (width, height), node_id)
    struct MapEntry {
        name: String,
        resolution: (u32, u32),
        node_id: NodeId,
    }

    let mut map_entries: Vec<MapEntry> = Vec::new();

    // 1. Output targets that are connected
    for node in &output_nodes {
        let is_connected = node.inputs.iter().any(|pin| graph.incoming_edge(pin).is_some());
        if is_connected {
            let slot = node.get_string("slot_name", "");
            let name = if !slot.is_empty() {
                slot
            } else {
                node.label.clone()
            };
            let out_pin = PinId::output(node.id, "output");
            let res = evaluator
                .get_output(&out_pin)
                .map(|b| (b.width, b.height))
                .unwrap_or_else(|| evaluator.resolve_node_dimensions(graph, node));
            map_entries.push(MapEntry {
                name,
                resolution: res,
                node_id: node.id,
            });
        }
    }

    // 2. Input maps that are connected downstream (skipping raw inputs that directly feed a Resize node)
    for node in &input_nodes {
        let is_connected = node.outputs.iter().any(|pin| {
            graph.edges.iter().any(|e| e.from == *pin)
        });

        let is_explicitly_resized = graph.edges.iter().any(|e| {
            e.from.node_id == node.id
                && graph
                    .get_node(e.to.node_id)
                    .map(|n| n.node_type == "Resize" || n.node_type == "Transform")
                    .unwrap_or(false)
        });

        if (is_connected || output_nodes.is_empty()) && !is_explicitly_resized {
            let name = if let Some(path_str) = node.get_param("file_path").and_then(|p| p.as_str()) {
                Path::new(path_str)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or(&node.label)
                    .to_string()
            } else {
                node.label.clone()
            };

            let out_pin = PinId::output(node.id, "output");
            let res = evaluator
                .get_output(&out_pin)
                .or_else(|| evaluator.get_output(&PinId::output(node.id, "RGBA")))
                .map(|b| (b.width, b.height))
                .unwrap_or_else(|| evaluator.resolve_node_dimensions(graph, node));

            map_entries.push(MapEntry {
                name,
                resolution: res,
                node_id: node.id,
            });
        }
    }

    // Determine target/reference resolution
    let target_resolution = if map_entries.is_empty() {
        default_res
    } else {
        // Count frequencies of each resolution
        let mut freq_map: HashMap<(u32, u32), usize> = HashMap::new();
        for m in &map_entries {
            *freq_map.entry(m.resolution).or_insert(0) += 1;
        }

        // Pick mode; break ties in favor of default_res, or largest resolution
        freq_map
            .into_iter()
            .max_by(|a, b| {
                if a.1 != b.1 {
                    a.1.cmp(&b.1)
                } else if a.0 == default_res {
                    std::cmp::Ordering::Greater
                } else if b.0 == default_res {
                    std::cmp::Ordering::Less
                } else {
                    (a.0 .0 * a.0 .1).cmp(&(b.0 .0 * b.0 .1))
                }
            })
            .map(|(res, _)| res)
            .unwrap_or(default_res)
    };

    report.target_resolution = target_resolution;

    // Check POT and resolution equality for every map
    let mut seen_mismatches: HashSet<String> = HashSet::new();
    let mut seen_non_pot: HashSet<String> = HashSet::new();

    for m in &map_entries {
        let (w, h) = m.resolution;

        // POT check
        let is_pot = w > 0 && w.is_power_of_two() && h > 0 && h.is_power_of_two();
        if !is_pot && seen_non_pot.insert(m.name.clone()) {
            report.non_pot_maps.push((m.name.clone(), (w, h)));
            report.offending_nodes.insert(m.name.clone(), m.node_id);
        }

        // Resolution consistency check
        if m.resolution != target_resolution && seen_mismatches.insert(m.name.clone()) {
            report.resolution_mismatches.push((m.name.clone(), (w, h)));
            report.offending_nodes.insert(m.name.clone(), m.node_id);
        }
    }

    // -------------------------------------------------------------
    // Check 4: PBR Lexical Naming Conventions
    // -------------------------------------------------------------
    for node in &input_nodes {
        if let Some(path_str) = node.get_param("file_path").and_then(|p| p.as_str()) {
            let path = Path::new(path_str);
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(path_str);
            let filename = path.file_name().and_then(|s| s.to_str()).unwrap_or(path_str);

            if LexicalNormalizer::infer_role(stem).is_none() {
                let warn_msg = format!("'{}' does not match any known PBR role convention", filename);
                if !report.naming_warnings.contains(&warn_msg) {
                    report.naming_warnings.push(warn_msg);
                }
            }
        } else {
            // If no file_path, check if label contains a file extension but is unrecognized
            let lower_label = node.label.to_lowercase();
            if lower_label.ends_with(".png")
                || lower_label.ends_with(".jpg")
                || lower_label.ends_with(".tga")
                || lower_label.ends_with(".exr")
            {
                let stem = Path::new(&node.label)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or(&node.label);
                if LexicalNormalizer::infer_role(stem).is_none() {
                    let warn_msg = format!("'{}' does not match any known PBR role convention", node.label);
                    if !report.naming_warnings.contains(&warn_msg) {
                        report.naming_warnings.push(warn_msg);
                    }
                }
            }
        }
    }

    report
}

/// Auto-fixes a resolution mismatch or non-POT dimension by inserting a `Resize` node
/// targeting `target_res` downstream of `offending_node_id`.
///
/// Returns the new `NodeId` of the inserted Resize node.
pub fn insert_resize_node_for(
    graph: &mut Graph,
    offending_node_id: NodeId,
    target_res: (u32, u32),
) -> Option<NodeId> {
    let (pos, is_output_node, from_pin) = {
        let offending_node = graph.get_node(offending_node_id)?;
        let pos = offending_node.position;
        let is_output_node = offending_node.node_type == "SaveImage" || offending_node.node_type == "TextureOutput";
        let from_pin = offending_node
            .outputs
            .iter()
            .find(|p| p.name == "output" || p.name == "RGBA")
            .cloned()
            .unwrap_or_else(|| PinId::output(offending_node_id, "output"));
        (pos, is_output_node, from_pin)
    };

    let resize_id = NodeId(graph.next_node_id);
    let spawn_pos = if is_output_node {
        [pos[0] - 220.0, pos[1]]
    } else {
        [pos[0] + 240.0, pos[1]]
    };

    let mut resize_node = Node::new(
        resize_id,
        "Resize",
        format!("Resize ({}x{})", target_res.0, target_res.1),
        spawn_pos,
    );
    resize_node.add_input("input");
    resize_node.add_output("output");
    resize_node.add_output("out");
    resize_node.set_param("width", NodeParam::Int(target_res.0 as i64));
    resize_node.set_param("height", NodeParam::Int(target_res.1 as i64));
    resize_node.set_param("pot_mode", NodeParam::String("None".to_string()));
    resize_node.set_param("filter", NodeParam::String("Lanczos3".to_string()));

    if is_output_node {
        // Splice upstream of output node
        let incoming_edges: Vec<_> = graph
            .edges
            .iter()
            .filter(|e| e.to.node_id == offending_node_id)
            .cloned()
            .collect();

        graph.add_node(resize_node);

        for edge in incoming_edges {
            graph.disconnect(&edge.from, &edge.to);
            let _ = graph.connect(edge.from, PinId::input(resize_id, "input"));
            let _ = graph.connect(PinId::output(resize_id, "output"), edge.to);
        }
    } else {
        // Splice downstream of input/intermediate node
        let outgoing_edges: Vec<_> = graph
            .edges
            .iter()
            .filter(|e| e.from.node_id == offending_node_id)
            .cloned()
            .collect();

        graph.add_node(resize_node);

        let _ = graph.connect(from_pin, PinId::input(resize_id, "input"));

        for edge in outgoing_edges {
            graph.disconnect(&edge.from, &edge.to);
            let _ = graph.connect(PinId::output(resize_id, "output"), edge.to);
        }
    }

    Some(resize_id)
}

/// Action generated by the Texture Set Validator UI.
#[derive(Clone, Debug, PartialEq)]
pub enum ValidatorAction {
    /// Auto-inserts a Resize node to enforce the target resolution.
    InsertResize {
        node_id: NodeId,
        target_resolution: (u32, u32),
    },
    /// Auto-inserts a missing SaveImage output node.
    InsertOutputNode {
        slot_name: String,
    },
    /// Triggers synchronous graph re-evaluation.
    Reevaluate,
}

/// Renders the complete Texture Set Validator panel inside an egui dock tab.
pub fn show_validator_panel(
    ui: &mut Ui,
    graph: &mut Graph,
    evaluator: &mut GraphEvaluator,
    mut history: Option<&mut crate::graph::history::HistoryStack>,
    mut async_evaluator: Option<&mut crate::graph::evaluator::AsyncEvaluator>,
    mut status_message: Option<&mut String>,
) -> Vec<ValidatorAction> {
    let mut actions = Vec::new();
    let report = validate_texture_set(graph, evaluator);

    egui::ScrollArea::vertical().show(ui, |ui| {
        ui.add_space(4.0);

        // 1. Panel Header & Summary Badge
        ui.horizontal(|ui| {
            ui.heading(
                RichText::new("Texture Set Validator")
                    .color(TEXT_PRIMARY)
                    .size(16.0),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui.button("Re-evaluate").on_hover_text("Refresh cache and re-check texture set").clicked() {
                    actions.push(ValidatorAction::Reevaluate);
                }
            });
        });

        ui.label(
            RichText::new("Verifies completeness, resolution uniformity, power-of-two compliance, and PBR naming before export.")
                .color(TEXT_SECONDARY)
                .size(12.0),
        );
        ui.add_space(8.0);

        // 2. High-Level Status Banner
        egui::Frame::new()
            .fill(BG_PANEL)
            .stroke(egui::Stroke::new(1.0_f32, BORDER_SUBTLE))
            .inner_margin(10.0)
            .corner_radius(4.0)
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    if report.is_all_green() {
                        ui.label(RichText::new("✔").color(COLOR_PASS).size(22.0));
                        ui.vertical(|ui| {
                            ui.label(RichText::new("TEXTURE SET VALID: ALL CHECKS PASSED").color(COLOR_PASS).strong());
                            ui.label(RichText::new("All required maps are connected, resolutions match, and dimensions are POT compliant.").color(TEXT_SECONDARY).size(11.0));
                        });
                    } else if report.has_errors() {
                        ui.label(RichText::new("✖").color(COLOR_FAIL).size(22.0));
                        ui.vertical(|ui| {
                            ui.label(RichText::new(format!("VALIDATION FAILED ({} ISSUES)", report.total_issues())).color(COLOR_FAIL).strong());
                            ui.label(RichText::new("Critical issues detected. Click 'Fix' buttons below to automatically resolve them.").color(TEXT_SECONDARY).size(11.0));
                        });
                    } else {
                        ui.label(RichText::new("⚠").color(COLOR_WARN).size(22.0));
                        ui.vertical(|ui| {
                            ui.label(RichText::new(format!("PASSED WITH {} WARNINGS", report.naming_warnings.len())).color(COLOR_WARN).strong());
                            ui.label(RichText::new("Texture set is functional, but some filenames deviate from standard conventions.").color(TEXT_SECONDARY).size(11.0));
                        });
                    }
                });
            });

        ui.add_space(10.0);

        // 3. Checklist Item 1: Map Completeness
        render_checklist_section(
            ui,
            "1. Map Completeness",
            report.missing_maps.is_empty(),
            if report.missing_maps.is_empty() {
                "All expected PBR channels and export targets are connected.".to_string()
            } else {
                format!("{} expected map(s) are missing or unconnected:", report.missing_maps.len())
            },
            |ui| {
                for missing in &report.missing_maps {
                    ui.horizontal(|ui| {
                        ui.label(RichText::new("✖").color(COLOR_FAIL));
                        ui.label(RichText::new(missing).color(TEXT_PRIMARY).strong());
                        ui.label(RichText::new("— unconnected output or channel").color(TEXT_MUTED));

                        let missing_slot = missing.clone();
                        if ui.button(format!("+ Add '{}' Output", missing_slot)).on_hover_text("Insert a SaveImage node for this slot").clicked() {
                            actions.push(ValidatorAction::InsertOutputNode { slot_name: missing_slot });
                        }
                    });
                }
            },
        );

        ui.add_space(6.0);

        // 4. Checklist Item 2: Resolution Uniformity
        render_checklist_section(
            ui,
            "2. Resolution Uniformity",
            report.resolution_mismatches.is_empty(),
            if report.resolution_mismatches.is_empty() {
                format!("All maps match set target resolution ({}×{}).", report.target_resolution.0, report.target_resolution.1)
            } else {
                format!("{} map(s) have conflicting resolutions (Target: {}×{}):", report.resolution_mismatches.len(), report.target_resolution.0, report.target_resolution.1)
            },
            |ui| {
                for (name, res) in &report.resolution_mismatches {
                    ui.horizontal(|ui| {
                        ui.label(RichText::new("✖").color(COLOR_FAIL));
                        ui.label(RichText::new(name).color(TEXT_PRIMARY).strong());
                        ui.label(RichText::new(format!("{}×{} (Target: {}×{})", res.0, res.1, report.target_resolution.0, report.target_resolution.1)).color(COLOR_WARN));

                        if let Some(&node_id) = report.offending_nodes.get(name) {
                            let target = report.target_resolution;
                            let btn_text = format!("Fix: Add Resize to {}×{}", target.0, target.1);
                            if ui.button(btn_text).on_hover_text("Auto-insert a Resize node configured to the target resolution").clicked() {
                                actions.push(ValidatorAction::InsertResize {
                                    node_id,
                                    target_resolution: target,
                                });
                            }
                        }
                    });
                }
            },
        );

        ui.add_space(6.0);

        // 5. Checklist Item 3: Power-of-Two (POT) Compliance
        render_checklist_section(
            ui,
            "3. Power-of-Two (POT) Compliance",
            report.non_pot_maps.is_empty(),
            if report.non_pot_maps.is_empty() {
                "All texture dimensions are valid powers of two (required for GPU mipmapping and BC compression).".to_string()
            } else {
                format!("{} map(s) have non-power-of-two dimensions:", report.non_pot_maps.len())
            },
            |ui| {
                for (name, res) in &report.non_pot_maps {
                    ui.horizontal(|ui| {
                        ui.label(RichText::new("✖").color(COLOR_FAIL));
                        ui.label(RichText::new(name).color(TEXT_PRIMARY).strong());
                        ui.label(RichText::new(format!("{}×{} (Non-POT)", res.0, res.1)).color(COLOR_FAIL));

                        if let Some(&node_id) = report.offending_nodes.get(name) {
                            let nearest_pot = (
                                res.0.next_power_of_two(),
                                res.1.next_power_of_two(),
                            );
                            let btn_text = format!("Fix: Add POT Resize ({}×{})", nearest_pot.0, nearest_pot.1);
                            if ui.button(btn_text).on_hover_text("Auto-insert a Resize node rounding to the next power of two").clicked() {
                                actions.push(ValidatorAction::InsertResize {
                                    node_id,
                                    target_resolution: nearest_pot,
                                });
                            }
                        }
                    });
                }
            },
        );

        ui.add_space(6.0);

        // 6. Checklist Item 4: PBR Naming Conventions
        render_checklist_section(
            ui,
            "4. PBR Naming Conventions",
            report.naming_warnings.is_empty(),
            if report.naming_warnings.is_empty() {
                "All input files adhere to recognized PBR token conventions (Albedo, Normal, Roughness, Metallic, ORM).".to_string()
            } else {
                format!("{} file(s) deviate from standard PBR conventions:", report.naming_warnings.len())
            },
            |ui| {
                for warning in &report.naming_warnings {
                    ui.horizontal(|ui| {
                        ui.label(RichText::new("⚠").color(COLOR_WARN));
                        ui.label(RichText::new(warning).color(TEXT_PRIMARY));
                    });
                }
            },
        );
    });

    // Execute any immediate actions if history and evaluators were passed
    for action in &actions {
        match action {
            ValidatorAction::InsertResize { node_id, target_resolution } => {
                if let Some(ref mut h) = history {
                    h.record(graph, format!("Auto-fix: Resize to {}x{}", target_resolution.0, target_resolution.1));
                }
                if let Some(new_id) = insert_resize_node_for(graph, *node_id, *target_resolution) {
                    evaluator.mark_dirty(graph, new_id);
                    if let Some(ref mut async_eval) = async_evaluator {
                        async_eval.request_evaluation(graph, vec![new_id], false, evaluator.default_resolution());
                    }
                    if let Some(ref mut msg) = status_message {
                        **msg = format!("Auto-inserted Resize node #{} ({}x{})", new_id.0, target_resolution.0, target_resolution.1);
                    }
                }
            }
            ValidatorAction::InsertOutputNode { slot_name } => {
                if let Some(ref mut h) = history {
                    h.record(graph, format!("Auto-fix: Add {} Output", slot_name));
                }
                let id = NodeId(graph.next_node_id);
                let mut out_node = Node::new(id, "SaveImage", format!("Save {}", slot_name), [720.0, 200.0]);
                out_node.add_input("input");
                out_node.add_output("output");
                out_node.set_param("slot_name", NodeParam::String(slot_name.clone()));
                graph.add_node(out_node);
                evaluator.mark_dirty(graph, id);
                if let Some(ref mut async_eval) = async_evaluator {
                    async_eval.request_evaluation(graph, vec![id], false, evaluator.default_resolution());
                }
                if let Some(ref mut msg) = status_message {
                    **msg = format!("Auto-inserted SaveImage node for '{}'", slot_name);
                }
            }
            ValidatorAction::Reevaluate => {
                evaluator.invalidate_all();
                let _ = evaluator.evaluate(graph);
                if let Some(ref mut async_eval) = async_evaluator {
                    async_eval.request_evaluation(graph, vec![], true, evaluator.default_resolution());
                }
                if let Some(ref mut msg) = status_message {
                    **msg = "Re-evaluated texture set for validation".to_string();
                }
            }
        }
    }

    actions
}

/// Helper rendering a collapsible / checklist group container.
fn render_checklist_section(
    ui: &mut Ui,
    title: &str,
    passed: bool,
    summary_text: String,
    render_details: impl FnOnce(&mut Ui),
) {
    egui::Frame::new()
        .fill(BG_CARD)
        .stroke(egui::Stroke::new(1.0_f32, BORDER_DARK))
        .inner_margin(8.0)
        .corner_radius(4.0)
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                if passed {
                    ui.label(RichText::new("✔").color(COLOR_PASS).strong());
                    ui.label(RichText::new(title).color(TEXT_PRIMARY).strong());
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(RichText::new("[PASS]").color(COLOR_PASS).size(11.0).strong());
                    });
                } else {
                    ui.label(RichText::new("✖").color(COLOR_FAIL).strong());
                    ui.label(RichText::new(title).color(COLOR_FAIL).strong());
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(RichText::new("[ACTION REQUIRED]").color(COLOR_FAIL).size(11.0).strong());
                    });
                }
            });

            ui.add_space(2.0);
            ui.label(RichText::new(summary_text).color(if passed { TEXT_SECONDARY } else { TEXT_PRIMARY }).size(11.5));

            if !passed {
                ui.add_space(4.0);
                ui.separator();
                ui.add_space(4.0);
                render_details(ui);
            }
        });
}

/// Renders a compact preflight validation summary badge suitable for the Export drawer.
pub fn show_compact_validator_summary(ui: &mut Ui, report: &TextureSetReport) {
    ui.horizontal(|ui| {
        if report.is_all_green() {
            ui.label(RichText::new("✔").color(COLOR_PASS).size(14.0));
            ui.label(RichText::new("Preflight Check: All Green (4/4 checks passed)").color(COLOR_PASS));
        } else if report.has_errors() {
            ui.label(RichText::new("✖").color(COLOR_FAIL).size(14.0));
            ui.label(
                RichText::new(format!(
                    "Preflight Check: {} issue(s) detected (Mismatches: {}, Missing: {}, Non-POT: {})",
                    report.total_issues(),
                    report.resolution_mismatches.len(),
                    report.missing_maps.len(),
                    report.non_pot_maps.len(),
                ))
                .color(COLOR_FAIL),
            );
        } else {
            ui.label(RichText::new("⚠").color(COLOR_WARN).size(14.0));
            ui.label(
                RichText::new(format!(
                    "Preflight Check: {} naming warning(s)",
                    report.naming_warnings.len()
                ))
                .color(COLOR_WARN),
            );
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::templates::builtin_templates;

    #[test]
    fn test_complete_ue5_orm_set_all_green() {
        let template = builtin_templates()
            .into_iter()
            .find(|t| t.name == "Pack Texture")
            .expect("Pack Texture template not found");

        let graph = template.load_graph().expect("Failed to load Pack Texture graph");
        let mut evaluator = GraphEvaluator::new((2048, 2048));
        evaluator.evaluate(&graph).expect("Evaluation failed");

        let report = validate_texture_set(&graph, &evaluator);

        assert!(
            report.missing_maps.is_empty(),
            "Expected 0 missing maps, got: {:?}",
            report.missing_maps
        );
        assert!(
            report.resolution_mismatches.is_empty(),
            "Expected 0 resolution mismatches, got: {:?}",
            report.resolution_mismatches
        );
        assert!(
            report.non_pot_maps.is_empty(),
            "Expected 0 non-POT maps, got: {:?}",
            report.non_pot_maps
        );
        assert!(
            report.naming_warnings.is_empty(),
            "Expected 0 naming warnings, got: {:?}",
            report.naming_warnings
        );
        assert!(report.is_all_green());
        assert!(!report.has_errors());
        assert_eq!(report.total_issues(), 0);
    }

    #[test]
    fn test_resolution_mismatch_detection() {
        let mut graph = Graph::new();

        // Node 1: 2048x2048 input
        let n1 = graph.create_node("TextureInput", "Albedo", [0.0, 0.0]);
        if let Some(node) = graph.get_node_mut(n1) {
            node.set_param("resolution", NodeParam::Resolution { width: 2048, height: 2048 });
            node.add_output("output");
        }

        // Node 2: 1024x1024 input (mismatch!)
        let n2 = graph.create_node("TextureInput", "Roughness", [0.0, 100.0]);
        if let Some(node) = graph.get_node_mut(n2) {
            node.set_param("resolution", NodeParam::Resolution { width: 1024, height: 1024 });
            node.add_output("output");
        }

        let mut evaluator = GraphEvaluator::new((2048, 2048));
        evaluator.evaluate(&graph).unwrap();

        let report = validate_texture_set(&graph, &evaluator);

        assert!(
            !report.resolution_mismatches.is_empty(),
            "Expected resolution mismatch detection"
        );
        assert!(
            report.resolution_mismatches.iter().any(|(_, res)| *res == (1024, 1024)),
            "Expected (1024, 1024) in mismatches: {:?}",
            report.resolution_mismatches
        );
        assert!(report.has_errors());
        assert!(!report.is_all_green());
    }

    #[test]
    fn test_non_pot_dimension_detection() {
        let mut graph = Graph::new();

        // Node with non-POT 1920x1080 dimensions
        let n1 = graph.create_node("TextureInput", "PhotoTexture", [0.0, 0.0]);
        if let Some(node) = graph.get_node_mut(n1) {
            node.set_param("resolution", NodeParam::Resolution { width: 1920, height: 1080 });
            node.add_output("output");
        }

        let mut evaluator = GraphEvaluator::new((2048, 2048));
        evaluator.evaluate(&graph).unwrap();

        let report = validate_texture_set(&graph, &evaluator);

        assert!(
            !report.non_pot_maps.is_empty(),
            "Expected non-POT map detection"
        );
        assert_eq!(report.non_pot_maps[0].1, (1920, 1080));
        assert!(report.has_errors());
    }

    #[test]
    fn test_missing_maps_detection() {
        let mut graph = Graph::new();

        // SaveImage node with slot "Normal" but unconnected input
        let n1 = graph.create_node("SaveImage", "Save Normal", [400.0, 100.0]);
        if let Some(node) = graph.get_node_mut(n1) {
            node.add_input("input");
            node.set_param("slot_name", NodeParam::String("Normal".to_string()));
        }

        let evaluator = GraphEvaluator::new((2048, 2048));
        let report = validate_texture_set(&graph, &evaluator);

        assert!(
            !report.missing_maps.is_empty(),
            "Expected missing map detection for unconnected Normal output"
        );
        assert!(
            report.missing_maps.contains(&"Normal".to_string()),
            "Expected 'Normal' in missing maps: {:?}",
            report.missing_maps
        );
        assert!(report.has_errors());
    }

    #[test]
    fn test_naming_warnings_detection() {
        let mut graph = Graph::new();

        // Node with unrecognized file name
        let n1 = graph.create_node("TextureInput", "Texture Input", [0.0, 0.0]);
        if let Some(node) = graph.get_node_mut(n1) {
            node.set_param("file_path", NodeParam::String("arbitrary_unknown_photo.jpg".to_string()));
            node.add_output("output");
        }

        let evaluator = GraphEvaluator::new((2048, 2048));
        let report = validate_texture_set(&graph, &evaluator);

        assert!(
            !report.naming_warnings.is_empty(),
            "Expected naming warning for unknown file"
        );
        assert!(
            report.naming_warnings[0].contains("arbitrary_unknown_photo.jpg"),
            "Warning should reference the offending filename"
        );
        assert!(report.has_warnings());
    }

    #[test]
    fn test_auto_fix_resolution_mismatch() {
        let mut graph = Graph::new();

        // Input node at 1024x1024
        let n1 = graph.create_node("TextureInput", "Roughness", [100.0, 100.0]);
        if let Some(node) = graph.get_node_mut(n1) {
            node.set_param("resolution", NodeParam::Resolution { width: 1024, height: 1024 });
            node.add_output("output");
        }

        // Output node
        let n2 = graph.create_node("SaveImage", "Save Roughness", [400.0, 100.0]);
        if let Some(node) = graph.get_node_mut(n2) {
            node.add_input("input");
            node.set_param("slot_name", NodeParam::String("Roughness".to_string()));
        }

        let _ = graph.connect(PinId::output(n1, "output"), PinId::input(n2, "input"));

        // Insert Resize node auto-fix
        let resize_id = insert_resize_node_for(&mut graph, n1, (2048, 2048));
        assert!(resize_id.is_some());

        let mut evaluator = GraphEvaluator::new((2048, 2048));
        evaluator.evaluate(&graph).unwrap();

        let report = validate_texture_set(&graph, &evaluator);
        assert!(
            report.resolution_mismatches.is_empty(),
            "Resolution mismatch should be resolved after auto-fix: {:?}",
            report.resolution_mismatches
        );
    }
}
