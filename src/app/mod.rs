//! Main application state and eframe lifecycle implementation (Phase 5).
//!
//! Provides the complete workstation UI: Obsidian Graphite Blueprint dark theme,
//! egui_dock multi-panel layout, infinite Bezier canvas, 2D viewport,
//! property inspector, library browser, and DCC keyboard dispatcher.

pub mod drop;
pub mod menu;
pub mod state;

pub use state::{build_starter_graph, TextureLabApp};

use std::path::PathBuf;
use egui::{TopBottomPanel, Ui};
use egui_dock::DockArea;

use crate::export::{ExportItem, ExportPreset, ExportWriter, TokenContext};
use crate::graph::evaluator::{AsyncEvaluator, GraphEvaluator};
use crate::graph::history::HistoryStack;
use crate::graph::model::{Graph, NodeId, PinId, ProjectFile};
use crate::hotkeys::{dispatch_from_input, HotkeyAction};
use crate::nodes::NODE_CATALOG;
use crate::ui::canvas::{CanvasAction, CanvasState};
use crate::ui::inspector::{show_inspector, InspectorAction};
use crate::ui::library::{show_library_panel, SearchPaletteState};
use crate::ui::theme::{create_dock_style, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY};
use crate::ui::viewport::ViewportState;
use crate::ui::Tab;

impl eframe::App for TextureLabApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Poll background async evaluator for completed computation results
        self.poll_evaluator(ctx);
        if self.async_evaluator.is_evaluating() {
            ctx.request_repaint_after(std::time::Duration::from_millis(16));
        }

        // Sync 2D Viewport locked node to canvas state
        self.canvas_state.locked_viewport_node = self.viewport_state.locked_node;

        // 1. Hotkey Dispatcher Guard
        let is_text_focused = ctx.memory(|m| m.focused().is_some());
        let hotkey = ctx.input(|i| dispatch_from_input(i, is_text_focused));

        if let Some(action) = hotkey {
            match action {
                HotkeyAction::OpenSearchPalette => {
                    self.search_palette.open_at([-self.canvas_state.pan.x + 400.0, -self.canvas_state.pan.y + 250.0]);
                }
                HotkeyAction::FrameAll => {
                    // Auto-framing feature removed
                }
                HotkeyAction::SpawnConstantScalar => {
                    self.spawn_node_by_type("ConstantScalar");
                }
                HotkeyAction::SpawnConstantColor => {
                    self.spawn_node_by_type("ConstantColor");
                }
                HotkeyAction::SpawnMath => {
                    self.spawn_node_by_type("Math");
                }
                HotkeyAction::SpawnBlend => {
                    self.spawn_node_by_type("LayerBlend");
                }
                HotkeyAction::SpawnSplitter => {
                    self.spawn_node_by_type("ChannelSplit");
                }
                HotkeyAction::SpawnNormalFlipGreen => {
                    self.spawn_node_by_type("NormalFlipGreen");
                }
                HotkeyAction::SpawnLevels => {
                    self.spawn_node_by_type("Levels");
                }
                HotkeyAction::SpawnInvert => {
                    self.spawn_node_by_type("Invert");
                }
                HotkeyAction::SpawnCombiner => {
                    self.spawn_node_by_type("ChannelCombine");
                }
                HotkeyAction::SpawnComment => {
                    let mouse_canvas = ctx.input(|i| i.pointer.latest_pos()).and_then(|ptr| {
                        if self.canvas_state.last_canvas_rect.contains(ptr) {
                            Some(self.canvas_state.screen_to_canvas(ptr, self.canvas_state.last_canvas_rect))
                        } else {
                            None
                        }
                    });
                    if let Some(pos) = mouse_canvas {
                        self.spawn_node_by_type_at("Comment", [pos.x, pos.y]);
                    } else {
                        self.spawn_node_by_type("Comment");
                    }
                }
                HotkeyAction::Undo => {
                    let desc = self.history.undo_description().map(|s| s.to_string());
                    if let Some(prev) = self.history.undo(&self.graph) {
                        self.graph = prev;
                        self.evaluator.invalidate_all();
                        self.reevaluate();
                        self.status_message = format!("Undo: {}", desc.as_deref().unwrap_or(""));
                    }
                }
                HotkeyAction::Redo => {
                    let desc = self.history.redo_description().map(|s| s.to_string());
                    if let Some(next) = self.history.redo(&self.graph) {
                        self.graph = next;
                        self.evaluator.invalidate_all();
                        self.reevaluate();
                        self.status_message = format!("Redo: {}", desc.as_deref().unwrap_or(""));
                    }
                }
                HotkeyAction::SelectAll => {
                    if let Some(&first) = self.graph.nodes.keys().next() {
                        self.canvas_state.selected_node = Some(first);
                    }
                }
                HotkeyAction::DeleteSelected => {
                    if let Some(sel) = self.canvas_state.selected_node.take() {
                        self.history.record(&self.graph, "Delete node");
                        self.graph.remove_node(sel);
                        self.evaluator.invalidate_all();
                        self.reevaluate();
                        self.status_message = format!("Deleted node {}", sel);
                    }
                }
                HotkeyAction::SaveProject => {
                    if let Some(path) = &self.project_file_path {
                        let project = ProjectFile::with_metadata(self.graph.clone(), self.project_metadata.clone());
                        if project.save_to_file(path).is_ok() {
                            self.status_message = format!("Project saved to {}", path.display());
                        }
                    }
                }
                HotkeyAction::OpenExportDialog => {
                    self.status_message = "Opened Export Preflight Drawer (Ctrl+E)".to_string();
                    if let Some(mut dock) = self.dock_state.take() {
                        if dock.find_tab(&Tab::ExportDrawer).is_none() {
                            dock.main_surface_mut().push_to_focused_leaf(Tab::ExportDrawer);
                        }
                        if let Some(loc) = dock.find_tab(&Tab::ExportDrawer) {
                            dock.set_active_tab(loc);
                        }
                        self.dock_state = Some(dock);
                    }
                }
                HotkeyAction::AutoLayout => {
                    self.execute_auto_layout();
                }
                HotkeyAction::Copy => {
                    self.copy_selected_nodes();
                }
                HotkeyAction::Paste => {
                    let mouse_canvas = ctx.input(|i| i.pointer.latest_pos()).and_then(|ptr| {
                        if self.canvas_state.last_canvas_rect.contains(ptr) {
                            let p = self.canvas_state.screen_to_canvas(ptr, self.canvas_state.last_canvas_rect);
                            Some([p.x, p.y])
                        } else {
                            None
                        }
                    });
                    self.paste_clipboard(mouse_canvas);
                }
                HotkeyAction::Duplicate => {
                    self.duplicate_selected_nodes();
                }
            }
        }

        // 1.5. Intercept Explorer File Drag & Drop directly onto Canvas
        self.handle_dropped_files(ctx);

        // 2. Top Menu Bar
        TopBottomPanel::top("top_menu_bar").show(ctx, |ui| {
            self.render_menu_bar(ui, ctx);
        });

        // 3. Bottom Status Bar
        TopBottomPanel::bottom("bottom_status_bar").show(ctx, |ui| {
            ui.horizontal(|ui| {
                if self.async_evaluator.is_evaluating() {
                    ui.label(egui::RichText::new("●").color(crate::ui::theme::ACCENT_AMBER));
                    ui.label(
                        egui::RichText::new("Computing in background...")
                            .color(crate::ui::theme::ACCENT_AMBER)
                            .size(12.0),
                    );
                } else {
                    ui.label(egui::RichText::new("●").color(crate::ui::theme::CAT_MATH));
                    ui.label(
                        egui::RichText::new(&self.status_message)
                            .color(TEXT_PRIMARY)
                            .size(12.0),
                    );
                }

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    ui.label(
                        egui::RichText::new(format!(
                            "Resolution: {}x{}",
                            self.evaluator.default_resolution().0,
                            self.evaluator.default_resolution().1
                        ))
                        .color(TEXT_SECONDARY)
                        .size(11.0),
                    );
                    ui.separator();
                    ui.label(
                        egui::RichText::new(format!(
                            "Eval: {:.2}ms (Cache: {}H / {}M)",
                            self.eval_time_ms,
                            self.evaluator.cache_hits,
                            self.evaluator.cache_misses
                        ))
                        .color(TEXT_SECONDARY)
                        .size(11.0),
                    );
                    ui.separator();
                    ui.label(
                        egui::RichText::new(format!(
                            "Nodes: {} | Edges: {}",
                            self.graph.nodes.len(),
                            self.graph.edges.len()
                        ))
                        .color(TEXT_SECONDARY)
                        .size(11.0),
                    );
                });
            });
        });

        // 4. Central Multi-Panel DockArea
        if let Some(mut dock_state) = self.dock_state.take() {
            let dock_style = create_dock_style(ctx);

            let mut tab_viewer = AppTabViewer {
                graph: &mut self.graph,
                evaluator: &mut self.evaluator,
                async_evaluator: &mut self.async_evaluator,
                history: &mut self.history,
                canvas_state: &mut self.canvas_state,
                viewport_state: &mut self.viewport_state,
                library_query: &mut self.library_query,
                status_message: &mut self.status_message,
                search_palette: &mut self.search_palette,
                export_preset_id: &mut self.export_preset_id,
                export_asset_name: &mut self.export_asset_name,
                export_target_dir: &mut self.export_target_dir,
                export_report_summary: &mut self.export_report_summary,
            };

            DockArea::new(&mut dock_state)
                .style(dock_style)
                .show(ctx, &mut tab_viewer);

            self.dock_state = Some(dock_state);
        }

        // 4.5 Native Multi-Monitor OS Viewport for 2D Viewport
        if self.viewport_state.is_undocked {
            let preview_data = crate::ui::viewport::resolve_viewport_preview(
                &self.graph,
                &self.evaluator,
                self.viewport_state.locked_node,
                self.canvas_state.selected_node,
                self.viewport_state.selected_socket.as_deref(),
            );

            ctx.show_viewport_immediate(
                egui::ViewportId::from_hash_of("viewport_2d_secondary_monitor"),
                egui::ViewportBuilder::default()
                    .with_title("2D Viewport — TextureLAB")
                    .with_inner_size([800.0, 600.0])
                    .with_min_inner_size([400.0, 300.0]),
                |ctx, class| {
                    if class == egui::ViewportClass::Immediate {
                        if ctx.input(|i| i.viewport().close_requested()) {
                            self.viewport_state.is_undocked = false;
                        }

                        egui::CentralPanel::default().show(ctx, |ui| {
                            self.viewport_state.show(ui, &preview_data);
                        });
                    }
                },
            );
        }

        // 5. Floating Quick-Search Palette (`Tab`)
        if let Some((desc, pos)) = self.search_palette.show(ctx) {
            self.spawn_node(desc, pos);
        }

        // 6. About Dialog Modal
        if self.show_about_dialog {
            egui::Window::new("About TextureLAB")
                .collapsible(false)
                .resizable(false)
                .show(ctx, |ui| {
                    ui.heading(format!("TextureLab v{}", self.version));
                    ui.separator();
                    ui.label("PBR Texture Authoring & Channel Packing Workstation");
                    ui.add_space(8.0);
                    if ui.button("Close").clicked() {
                        self.show_about_dialog = false;
                    }
                });
        }
    }
}

/// Helper tab viewer implementing `egui_dock::TabViewer`.
struct AppTabViewer<'a> {
    graph: &'a mut Graph,
    evaluator: &'a mut GraphEvaluator,
    async_evaluator: &'a mut AsyncEvaluator,
    history: &'a mut HistoryStack,
    canvas_state: &'a mut CanvasState,
    viewport_state: &'a mut ViewportState,
    library_query: &'a mut String,
    status_message: &'a mut String,
    search_palette: &'a mut SearchPaletteState,
    export_preset_id: &'a mut String,
    export_asset_name: &'a mut String,
    export_target_dir: &'a mut String,
    export_report_summary: &'a mut Option<String>,
}

impl<'a> egui_dock::TabViewer for AppTabViewer<'a> {
    type Tab = Tab;

    fn title(&mut self, tab: &mut Self::Tab) -> egui::WidgetText {
        tab.title().into()
    }

    fn ui(&mut self, ui: &mut Ui, tab: &mut Self::Tab) {
        match tab {
            Tab::NodeCanvas => {
                let actions = self.canvas_state.show(ui, self.graph);
                for action in actions {
                    match action {
                        CanvasAction::SelectNode(node_id) => {
                            self.canvas_state.selected_node = node_id;
                        }
                        CanvasAction::ConnectPins { from, to } => {
                            if crate::graph::compiler::GraphCompiler::would_create_cycle(self.graph, from.node_id, to.node_id) {
                                *self.status_message = "Cannot connect: would create circular loop in graph".to_string();
                            } else {
                                self.history.record(self.graph, format!("Connect {} -> {}", from.name, to.name));
                                if let Ok(()) = self.graph.connect(from.clone(), to.clone()) {
                                    self.evaluator.mark_dirty(self.graph, to.node_id);
                                    self.async_evaluator.request_evaluation(
                                        self.graph,
                                        vec![to.node_id],
                                        false,
                                        self.evaluator.default_resolution(),
                                    );
                                    *self.status_message = format!("Connected {} to {}", from.name, to.name);
                                }
                            }
                        }
                        CanvasAction::DisconnectEdge(edge) => {
                            self.history.record(self.graph, "Disconnect edge");
                            self.graph.disconnect(&edge.from, &edge.to);
                            self.evaluator.mark_dirty(self.graph, edge.to.node_id);
                            self.async_evaluator.request_evaluation(
                                self.graph,
                                vec![edge.to.node_id],
                                false,
                                self.evaluator.default_resolution(),
                            );
                        }
                        CanvasAction::DeleteNode(node_id) => {
                            self.history.record(self.graph, format!("Delete node {}", node_id));
                            self.graph.remove_node(node_id);
                            self.evaluator.invalidate_all();
                            self.async_evaluator.request_evaluation(
                                self.graph,
                                vec![],
                                true,
                                self.evaluator.default_resolution(),
                            );
                            if self.canvas_state.selected_node == Some(node_id) {
                                self.canvas_state.selected_node = None;
                            }
                        }
                        CanvasAction::DeleteSelected => {
                            if let Some(sel) = self.canvas_state.selected_node.take() {
                                self.history.record(self.graph, "Delete node");
                                self.graph.remove_node(sel);
                                self.evaluator.invalidate_all();
                                self.async_evaluator.request_evaluation(
                                    self.graph,
                                    vec![],
                                    true,
                                    self.evaluator.default_resolution(),
                                );
                            }
                        }
                        CanvasAction::NodeMoved { node_id, old_pos, new_pos } => {
                            if let Some(node) = self.graph.get_node_mut(node_id) {
                                node.position = old_pos;
                            }
                            self.history.record(self.graph, format!("Move node {}", node_id));
                            if let Some(node) = self.graph.get_node_mut(node_id) {
                                node.position = new_pos;
                            }
                        }
                        CanvasAction::OpenSearchPalette(pos) => {
                            self.search_palette.open_at(pos);
                        }
                        CanvasAction::DisconnectPin(pin) => {
                            let edges_to_remove: Vec<_> = self.graph.edges.iter()
                                .filter(|e| e.from == pin || e.to == pin)
                                .cloned()
                                .collect();
                            if !edges_to_remove.is_empty() {
                                self.history.record(self.graph, format!("Sever pin {}", pin.name));
                                let mut affected = Vec::new();
                                for edge in edges_to_remove {
                                    self.graph.disconnect(&edge.from, &edge.to);
                                    self.evaluator.mark_dirty(self.graph, edge.to.node_id);
                                    affected.push(edge.to.node_id);
                                }
                                self.async_evaluator.request_evaluation(
                                    self.graph,
                                    affected,
                                    false,
                                    self.evaluator.default_resolution(),
                                );
                                *self.status_message = format!("Severed connections to {}", pin.name);
                            }
                        }
                        CanvasAction::SpawnNodeAt { type_name, pos } => {
                            if let Some(desc) = crate::nodes::find_descriptor(&type_name) {
                                self.history.record(self.graph, format!("Spawn {}", desc.display_name));
                                let node_id = NodeId(self.graph.next_node_id);
                                let node = desc.create_node(node_id, pos);
                                self.graph.add_node(node);
                                self.canvas_state.selected_node = Some(node_id);
                                self.evaluator.mark_dirty(self.graph, node_id);
                                self.async_evaluator.request_evaluation(
                                    self.graph,
                                    vec![node_id],
                                    false,
                                    self.evaluator.default_resolution(),
                                );
                                *self.status_message = format!("Spawned {}", desc.display_name);
                            }
                        }
                        CanvasAction::FrameFocus => {
                            // Auto-framing feature removed
                        }
                        CanvasAction::AutoLayout => {
                            let sel = self.canvas_state.selected_node;
                            self.history.record(self.graph, "Auto Layout Nodes");
                            crate::graph::layout::auto_layout_graph_contextual(self.graph, sel);
                            let count = if let Some(target) = sel {
                                let mut back = crate::graph::compiler::GraphCompiler::upstream_nodes(self.graph, target);
                                back.insert(target);
                                back.len()
                            } else {
                                self.graph.nodes.len()
                            };
                            if let Some(target) = sel {
                                *self.status_message = format!(
                                    "Auto-arranged back-hierarchy of Node#{} ({} nodes, Right-to-Left) [Ctrl+F]",
                                    target.0, count
                                );
                            } else {
                                *self.status_message = format!(
                                    "Auto-arranged {} nodes into compact layout (Ctrl+F)",
                                    count
                                );
                            }
                        }
                    }
                }
            }

            Tab::Viewport2D => {
                if self.viewport_state.is_undocked {
                    ui.vertical_centered(|ui| {
                        ui.add_space(40.0);
                        ui.label(
                            egui::RichText::new("2D Viewport is detached to secondary monitor")
                                .color(crate::ui::theme::TEXT_SECONDARY)
                                .size(13.0),
                        );
                        ui.add_space(8.0);
                        if ui.button("Dock back to main workspace").clicked() {
                            self.viewport_state.is_undocked = false;
                        }
                    });
                    return;
                }

                let preview_data = crate::ui::viewport::resolve_viewport_preview(
                    self.graph,
                    self.evaluator,
                    self.viewport_state.locked_node,
                    self.canvas_state.selected_node,
                    self.viewport_state.selected_socket.as_deref(),
                );
                self.viewport_state.show(ui, &preview_data);
            }

            Tab::Inspector => {
                let selected_id = self.canvas_state.selected_node;
                let upstream_ctx = selected_id
                    .map(|id| crate::ui::inspector::detect_upstream_context(self.graph, id))
                    .unwrap_or((None, None));
                let (detected_slot, detected_asset) = (upstream_ctx.0.as_deref(), upstream_ctx.1.as_deref());
                let node_mut = selected_id.and_then(|id| self.graph.get_node_mut(id));

                if let Some(action) = show_inspector(ui, node_mut, (detected_slot, detected_asset)) {
                    match action {
                        InspectorAction::ParamChanged { node_id, param_name, new_value: _ } => {
                            self.history.record_coalesced(self.graph, format!("Edit {}", param_name), 1.0);
                            self.evaluator.mark_dirty(self.graph, node_id);
                            let invalidate_all = param_name == "file_path" || param_name == "path";
                            self.async_evaluator.request_evaluation(
                                self.graph,
                                vec![node_id],
                                invalidate_all,
                                self.evaluator.default_resolution(),
                            );
                            *self.status_message = format!("Updated {}", param_name);
                            ui.ctx().request_repaint();
                        }
                        InspectorAction::LabelChanged { node_id, new_label } => {
                            self.history.record_coalesced(self.graph, format!("Rename node {}", node_id), 1.0);
                            *self.status_message = format!("Renamed node to {}", new_label);
                        }
                        InspectorAction::DeleteNode(node_id) => {
                            self.history.record(self.graph, format!("Delete node {}", node_id));
                            self.graph.remove_node(node_id);
                            self.evaluator.invalidate_all();
                            self.async_evaluator.request_evaluation(
                                self.graph,
                                vec![],
                                true,
                                self.evaluator.default_resolution(),
                            );
                            self.canvas_state.selected_node = None;
                        }
                    }
                }
            }

            Tab::Library => {
                if let Some(desc) = show_library_panel(ui, self.library_query) {
                    self.history.record(self.graph, format!("Spawn {}", desc.display_name));
                    let node_id = NodeId(self.graph.next_node_id);
                    let spawn_pos = [-self.canvas_state.pan.x + 300.0, -self.canvas_state.pan.y + 200.0];
                    let node = desc.create_node(node_id, spawn_pos);
                    self.graph.add_node(node);
                    self.canvas_state.selected_node = Some(node_id);

                    self.evaluator.mark_dirty(self.graph, node_id);
                    self.async_evaluator.request_evaluation(
                        self.graph,
                        vec![node_id],
                        false,
                        self.evaluator.default_resolution(),
                    );
                    *self.status_message = format!("Spawned {}", desc.display_name);
                }
            }

            Tab::ExportDrawer => {
                ui.vertical(|ui| {
                    ui.horizontal(|ui| {
                        ui.heading(
                            egui::RichText::new("Export Preflight Pipeline")
                                .color(TEXT_PRIMARY)
                                .size(16.0),
                        );
                        ui.label(
                            egui::RichText::new("Direct disk exporter preflight validation & output census.")
                                .color(TEXT_SECONDARY),
                        );
                    });
                    ui.separator();

                    // Preset selection & export target settings
                    ui.horizontal(|ui| {
                        ui.label("Preset:");
                        let presets = ExportPreset::builtin_presets();
                        for p in &presets {
                            let is_selected = *self.export_preset_id == p.id;
                            if ui.selectable_label(is_selected, &p.name).clicked() {
                                *self.export_preset_id = p.id.clone();
                            }
                        }
                    });

                    ui.horizontal(|ui| {
                        ui.label("Asset Name:");
                        ui.add(egui::TextEdit::singleline(self.export_asset_name).desired_width(130.0));

                        ui.add_space(8.0);
                        ui.label("Target Directory:");
                        ui.add(egui::TextEdit::singleline(self.export_target_dir).desired_width(200.0));
                        if ui.button("Browse...").clicked() {
                            if let Some(dir) = rfd::FileDialog::new().pick_folder() {
                                *self.export_target_dir = dir.to_string_lossy().to_string();
                            }
                        }
                    });
                    ui.add_space(4.0);

                    let output_nodes: Vec<_> = self
                        .graph
                        .nodes
                        .values()
                        .filter(|n| n.node_type == "SaveImage" || n.node_type == "TextureOutput")
                        .collect();

                    if output_nodes.is_empty() {
                        ui.label(
                            egui::RichText::new("No SaveImage nodes present in the current graph.")
                                .color(TEXT_MUTED),
                        );
                        if ui.button("+ Add SaveImage Node").clicked() {
                            let desc = NODE_CATALOG.iter().find(|d| d.type_name == "SaveImage" || d.type_name == "TextureOutput");
                            if let Some(desc) = desc {
                                let id = NodeId(self.graph.next_node_id);
                                let node = desc.create_node(id, [600.0, 200.0]);
                                self.history.record(self.graph, "Add SaveImage");
                                self.graph.add_node(node);
                                self.canvas_state.selected_node = Some(id);
                                self.evaluator.invalidate_all();
                                self.async_evaluator.request_evaluation(
                                    self.graph,
                                    vec![],
                                    true,
                                    self.evaluator.default_resolution(),
                                );
                            }
                        }
                    } else {
                        ui.label(format!("Found {} texture output targets:", output_nodes.len()));
                        ui.add_space(4.0);

                        let current_preset = ExportPreset::find_by_id(self.export_preset_id)
                            .unwrap_or_else(|| ExportPreset::builtin_presets().remove(0));

                        let mut ready_targets: Vec<(PinId, PathBuf)> = Vec::new();

                        egui::Grid::new("export_preflight_grid")
                            .striped(true)
                            .min_col_width(90.0)
                            .show(ui, |ui| {
                                ui.strong("Node");
                                ui.strong("Slot");
                                ui.strong("Format");
                                ui.strong("Dimensions");
                                ui.strong("Resolved Filename");
                                ui.strong("Preflight");
                                ui.end_row();

                                for node in &output_nodes {
                                    let slot = node.get_string("slot_name", "BaseColor");
                                    let fmt = node.get_string("format", "PNG");
                                    let (w, h) = self.evaluator.resolve_node_dimensions(self.graph, node);
                                    let has_input = node.inputs.iter().any(|pin| self.graph.incoming_edge(pin).is_some());

                                    let ctx = TokenContext::new(&*self.export_asset_name, &slot)
                                        .with_format(&fmt)
                                        .with_resolution(format!("{}x{}", w, h));
                                    let resolved_file = current_preset.resolve_filename(&ctx);

                                    ui.label(format!("{} (#{})", node.label, node.id.0));
                                    ui.label(&slot);
                                    ui.label(&fmt);
                                    ui.label(format!("{}x{}", w, h));
                                    ui.label(&resolved_file);
                                    if has_input {
                                        ui.colored_label(crate::ui::theme::CAT_MATH, "[Ready]");
                                        let out_pin = PinId::output(node.id, "output");
                                        if self.evaluator.get_output(&out_pin).is_some() {
                                            let target_path = PathBuf::from(&*self.export_target_dir).join(&resolved_file);
                                            ready_targets.push((out_pin, target_path));
                                        }
                                    } else {
                                        ui.colored_label(crate::ui::theme::CAT_CONSTANTS, "[Unlinked]");
                                    }
                                    ui.end_row();
                                }
                            });

                        ui.add_space(8.0);
                        ui.horizontal(|ui| {
                            let can_export = !ready_targets.is_empty();
                            if ui.add_enabled(can_export, egui::Button::new("Export All Ready Maps (Direct Disk Write)")).clicked() {
                                let _ = self.evaluator.evaluate(self.graph);
                                let items_to_export: Vec<ExportItem> = ready_targets
                                    .into_iter()
                                    .filter_map(|(pin, path)| {
                                        self.evaluator.get_output(&pin).map(|buf| ExportItem::new(buf.as_ref().clone(), path))
                                    })
                                    .collect();
                                let report = ExportWriter::execute_export(&items_to_export);
                                if report.is_success() {
                                    let msg = format!(
                                        "Successfully exported {} files ({:.2} MB) in {}ms",
                                        report.files_written.len(),
                                        report.bytes_written as f64 / 1_048_576.0,
                                        report.elapsed_ms
                                    );
                                    *self.status_message = msg.clone();
                                    *self.export_report_summary = Some(msg);
                                } else {
                                    let err_msg = format!("Export error: {}", report.errors.join("; "));
                                    *self.status_message = err_msg.clone();
                                    *self.export_report_summary = Some(err_msg);
                                }
                            }

                            if let Some(summary) = self.export_report_summary.as_ref() {
                                ui.label(egui::RichText::new(summary).color(TEXT_PRIMARY));
                            }
                        });
                    }
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_starter_graph_construction() {
        let graph = build_starter_graph();
        assert_eq!(graph.nodes.len(), 5);
        assert_eq!(graph.edges.len(), 4);
    }

    #[test]
    fn test_app_initialization() {
        let app = TextureLabApp::default();
        assert_eq!(app.graph.nodes.len(), 5);
        assert!(app.eval_time_ms >= 0.0);
        assert!(app.title().contains("TextureLAB"));
    }

    #[test]
    fn test_spawn_node_by_type_all_nodes() {
        let mut app = TextureLabApp::default();
        let initial_node_count = app.graph.nodes.len();

        let result_math = app.spawn_node_by_type("Math");
        assert!(result_math.is_some());
        assert_eq!(app.graph.nodes.len(), initial_node_count + 1);

        let result_rnm = app.spawn_node_by_type("NormalBlendRNM");
        assert!(result_rnm.is_some());
        assert_eq!(app.graph.nodes.len(), initial_node_count + 2);

        let result_comment = app.spawn_node_by_type("Comment");
        assert!(result_comment.is_some());
        assert_eq!(app.graph.nodes.len(), initial_node_count + 3);

        let result_reroute = app.spawn_node_by_type("Reroute");
        assert!(result_reroute.is_some());
        assert_eq!(app.graph.nodes.len(), initial_node_count + 4);
    }

    #[test]
    fn test_auto_layout_execution_and_undo() {
        let mut app = TextureLabApp::default();
        let initial_pan = app.canvas_state.pan;

        // Deselect node to test full-graph layout
        app.canvas_state.selected_node = None;

        // Mess up coordinates
        for node in app.graph.nodes.values_mut() {
            node.position = [0.0, 0.0];
        }

        // Execute auto layout without auto-framing
        app.execute_auto_layout();
        assert!(app.status_message.contains("Auto-arranged 5 nodes into compact layout (Ctrl+F)"));

        // Camera pan MUST remain untouched (no auto-framing)
        assert_eq!(app.canvas_state.pan, initial_pan, "Camera pan must not change on auto-layout");

        // Positions should now be properly organized and non-overlapping
        let layout_positions: Vec<[f32; 2]> = app.graph.nodes.values().map(|n| n.position).collect();
        assert_ne!(layout_positions, vec![[0.0, 0.0]; 5]);

        // Undo auto layout
        let restored_graph = app.history.undo(&app.graph).expect("Undo should succeed");
        app.graph = restored_graph;
        let restored_positions: Vec<[f32; 2]> = app.graph.nodes.values().map(|n| n.position).collect();
        assert_eq!(restored_positions, vec![[0.0, 0.0]; 5]);

        // Contextual selection: select Node 3 and auto-layout back hierarchy
        app.canvas_state.selected_node = Some(NodeId(3));
        app.execute_auto_layout();
        assert!(app.status_message.contains("Auto-arranged back-hierarchy of Node#3"));
        assert_eq!(app.canvas_state.pan, initial_pan, "Camera pan must remain unchanged");
    }

    #[test]
    fn test_spawn_node_undo_roundtrip() {
        let mut app = TextureLabApp::default();
        let initial_count = app.graph.nodes.len();
        assert_eq!(app.history.undo_depth(), 0, "Initial app history depth must be 0");

        let spawned = app.spawn_node_by_type("Invert").expect("Should spawn Invert");
        assert_eq!(app.graph.nodes.len(), initial_count + 1);
        assert_eq!(app.history.undo_depth(), 1);
        assert_eq!(app.history.undo_description(), Some("Spawn Invert"));

        // Undoing must restore exact prior node count and remove the spawned node
        let undone_graph = app.history.undo(&app.graph).expect("Undo should succeed");
        app.graph = undone_graph;
        assert_eq!(app.graph.nodes.len(), initial_count);
        assert!(!app.graph.nodes.contains_key(&spawned));
        assert_eq!(app.history.undo_depth(), 0);

        // Redoing must restore the spawned node
        let redone_graph = app.history.redo(&app.graph).expect("Redo should succeed");
        app.graph = redone_graph;
        assert_eq!(app.graph.nodes.len(), initial_count + 1);
        assert!(app.graph.nodes.contains_key(&spawned));
    }

    #[test]
    fn test_spawn_node_aliases() {
        let mut app = TextureLabApp::default();
        let add_id = app.spawn_node_by_type("Add").expect("Add alias should resolve");
        assert_eq!(app.graph.nodes[&add_id].node_type, "Add");

        let mul_id = app.spawn_node_by_type("Multiply").expect("Multiply alias should resolve");
        assert_eq!(app.graph.nodes[&mul_id].node_type, "Multiply");

        let rnm_id = app.spawn_node_by_type("RNM").expect("RNM alias should resolve");
        assert_eq!(app.graph.nodes[&rnm_id].node_type, "NormalBlendRNM");
    }

    #[test]
    fn test_delete_node_undo_roundtrip() {
        let mut app = TextureLabApp::default();
        let initial_count = app.graph.nodes.len();

        let target_node = NodeId(1);
        assert!(app.graph.nodes.contains_key(&target_node));

        // Delete node with proper pre-mutation recording
        app.history.record(&app.graph, "Delete node");
        app.graph.remove_node(target_node);
        assert_eq!(app.graph.nodes.len(), initial_count - 1);
        assert!(!app.graph.nodes.contains_key(&target_node));

        // Undo must restore the deleted node and all its socket data
        let restored = app.history.undo(&app.graph).expect("Undo should succeed");
        app.graph = restored;
        assert_eq!(app.graph.nodes.len(), initial_count);
        assert!(app.graph.nodes.contains_key(&target_node));
    }
}
