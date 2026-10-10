//! Main application state and eframe lifecycle implementation (Phase 5).
//!
//! Provides the complete workstation UI: Obsidian Graphite Blueprint dark theme,
//! egui_dock multi-panel layout, infinite Bezier canvas, 2D viewport,
//! property inspector, library browser, and DCC keyboard dispatcher.

use egui::{TopBottomPanel, Ui};
use egui_dock::{DockArea, DockState};
use std::path::PathBuf;
use std::time::Instant;

use crate::graph::evaluator::GraphEvaluator;
use crate::graph::history::HistoryStack;
use crate::graph::model::{Graph, NodeId, PinId, ProjectFile};
use crate::hotkeys::{dispatch_from_input, HotkeyAction};
use crate::nodes::{NodeDescriptor, NODE_CATALOG};
use crate::ui::canvas::{CanvasAction, CanvasState};
use crate::ui::inspector::{show_inspector, InspectorAction};
use crate::ui::library::{show_library_panel, SearchPaletteState};
use crate::export::{ExportItem, ExportPreset, ExportWriter, TokenContext};
use crate::ui::theme::{apply_theme, create_dock_style, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY};
use crate::ui::viewport::ViewportState;
use crate::ui::Tab;

/// Software edition capability tier for ARKH TextureLab.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
pub enum Edition {
    /// TextureLAB Lite — Core channel packing, unpacking, normalizer, and basic adjustments.
    Lite,
    /// TextureLAB Pro — Full feature set including RNM, 13-op Math, 16-bit codecs, and advanced tooling.
    #[default]
    Pro,
}

impl Edition {
    /// Returns the human-readable edition title.
    pub fn name(&self) -> &'static str {
        match self {
            Self::Lite => "TextureLAB Lite",
            Self::Pro => "TextureLAB Pro",
        }
    }

    /// Checks if the edition is Pro.
    pub fn is_pro(&self) -> bool {
        matches!(self, Self::Pro)
    }

    /// Checks if a node type is permitted to be spawned and evaluated in this edition.
    pub fn is_node_allowed(&self, type_name: &str) -> bool {
        match self {
            Self::Pro => true,
            Self::Lite => {
                // Reoriented Normal Mapping (RNM) and 13-Op Math & Vector nodes are locked in Lite
                !matches!(
                    type_name,
                    "NormalBlendRNM"
                        | "NormalBlend"
                        | "RNM"
                        | "Math"
                        | "Add"
                        | "Subtract"
                        | "Multiply"
                        | "Divide"
                        | "Power"
                        | "Min"
                        | "Max"
                        | "Clamp"
                        | "Abs"
                        | "Step"
                        | "Smoothstep"
                        | "Modulo"
                )
            }
        }
    }

    /// Checks if an export format is permitted in this edition.
    pub fn is_format_allowed(&self, format: &str) -> bool {
        match self {
            Self::Pro => true,
            Self::Lite => {
                let fmt = format.trim().to_uppercase();
                // 16-Bit TIFF & EXR Codecs are locked in Lite
                !matches!(fmt.as_str(), "EXR" | "TIFF" | "TIF" | "HDR")
            }
        }
    }

    /// Checks if A/B split comparison is unlocked.
    pub fn allows_ab_split(&self) -> bool {
        matches!(self, Self::Pro)
    }

    /// Checks if histogram inspection is unlocked.
    pub fn allows_histogram(&self) -> bool {
        matches!(self, Self::Pro)
    }
}

/// Root application state for ARKH TextureLab.
pub struct TextureLabApp {
    pub title: String,
    pub version: &'static str,
    pub edition: Edition,
    pub graph: Graph,
    pub evaluator: GraphEvaluator,
    pub history: HistoryStack,
    pub dock_state: Option<DockState<Tab>>,
    pub canvas_state: CanvasState,
    pub viewport_state: ViewportState,
    pub search_palette: SearchPaletteState,
    pub library_query: String,
    pub status_message: String,
    pub eval_time_ms: f64,
    pub project_file_path: Option<PathBuf>,
    pub show_about_dialog: bool,
    pub export_preset_id: String,
    pub export_asset_name: String,
    pub export_target_dir: String,
    pub export_report_summary: Option<String>,
}

impl TextureLabApp {
    /// Creates a new instance of TextureLabApp initialized with the starter PBR graph.
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        // 1. Initialize Obsidian "Graphite Blueprint" dark workstation theme
        apply_theme(&cc.egui_ctx);

        // 2. Build default starter PBR graph
        let graph = build_starter_graph();
        let mut evaluator = GraphEvaluator::new((1024, 1024));

        let start = Instant::now();
        let _ = evaluator.evaluate(&graph);
        let eval_time_ms = start.elapsed().as_secs_f64() * 1000.0;

        // 3. Initialize transactional history
        let mut history = HistoryStack::new();
        history.record(&graph, "Starter PBR Graph");

        // 4. Default docking workspace
        let dock_state = crate::ui::default_dock_layout();

        // 5. Canvas state (select node 1 by default for instant preview)
        let mut canvas_state = CanvasState::new();
        canvas_state.selected_node = Some(NodeId(1));

        Self {
            title: "TextureLAB — PBR Texture Workstation".to_string(),
            version: env!("CARGO_PKG_VERSION"),
            edition: Edition::Pro,
            graph,
            evaluator,
            history,
            dock_state: Some(dock_state),
            canvas_state,
            viewport_state: ViewportState::new(),
            search_palette: SearchPaletteState::new(),
            library_query: String::new(),
            status_message: "Ready. Pure Rust engine active.".to_string(),
            eval_time_ms,
            project_file_path: None,
            show_about_dialog: false,
            export_preset_id: "ue5".to_string(),
            export_asset_name: "Asset".to_string(),
            export_target_dir: "exports".to_string(),
            export_report_summary: None,
        }
    }

    /// Sets the application edition in builder pattern style.
    pub fn with_edition(mut self, edition: Edition) -> Self {
        self.edition = edition;
        self
    }

    /// Sets the active edition dynamically.
    pub fn set_edition(&mut self, edition: Edition) {
        self.edition = edition;
        self.status_message = format!("Active edition set to: {}", edition.name());
    }

    /// Spawns a node from a descriptor at the given canvas position if permitted by edition.
    pub fn spawn_node(&mut self, desc: &'static NodeDescriptor, position: [f32; 2]) -> Option<NodeId> {
        if !self.edition.is_node_allowed(desc.type_name) {
            let msg = format!("🔒 '{}' requires TextureLAB Pro edition.", desc.display_name);
            self.status_message = msg;
            return None;
        }

        let node_id = NodeId(self.graph.next_node_id);
        let node = desc.create_node(node_id, position);
        self.graph.add_node(node);
        self.canvas_state.selected_node = Some(node_id);

        self.evaluator.mark_dirty(&self.graph, node_id);
        let start = Instant::now();
        let _ = self.evaluator.evaluate(&self.graph);
        self.eval_time_ms = start.elapsed().as_secs_f64() * 1000.0;

        self.history.record(&self.graph, format!("Spawn {}", desc.display_name));
        self.status_message = format!("Spawned {}", desc.display_name);
        Some(node_id)
    }

    /// Spawns a node from its canonical type name at the center of the current canvas viewport if permitted.
    pub fn spawn_node_by_type(&mut self, type_name: &str) -> Option<NodeId> {
        let desc = NODE_CATALOG.iter().find(|d| d.type_name.eq_ignore_ascii_case(type_name))?;
        let canvas_center = [-self.canvas_state.pan.x + 300.0, -self.canvas_state.pan.y + 200.0];
        self.spawn_node(desc, canvas_center)
    }

    /// Re-evaluates the graph and tracks execution time.
    pub fn reevaluate(&mut self) {
        let start = Instant::now();
        match self.evaluator.evaluate(&self.graph) {
            Ok(report) => {
                self.eval_time_ms = start.elapsed().as_secs_f64() * 1000.0;
                self.status_message = format!(
                    "Evaluated {} nodes in {:.2}ms (Cache: {} hits, {} misses)",
                    report.evaluated_nodes.len(),
                    self.eval_time_ms,
                    report.cache_hits,
                    report.cache_misses
                );
            }
            Err(e) => {
                self.status_message = format!("Evaluation warning: {}", e);
            }
        }
    }

    /// Returns the application title.
    pub fn title(&self) -> &str {
        &self.title
    }

    /// Returns the application version string.
    pub fn version(&self) -> &'static str {
        self.version
    }
}

impl Default for TextureLabApp {
    fn default() -> Self {
        let graph = build_starter_graph();
        let mut evaluator = GraphEvaluator::new((1024, 1024));
        let _ = evaluator.evaluate(&graph);

        let mut history = HistoryStack::new();
        history.record(&graph, "Starter PBR Graph");

        let mut canvas_state = CanvasState::new();
        canvas_state.selected_node = Some(NodeId(1));

        Self {
            title: "TextureLAB — PBR Texture Workstation".to_string(),
            version: env!("CARGO_PKG_VERSION"),
            edition: Edition::Pro,
            graph,
            evaluator,
            history,
            dock_state: Some(crate::ui::default_dock_layout()),
            canvas_state,
            viewport_state: ViewportState::new(),
            search_palette: SearchPaletteState::new(),
            library_query: String::new(),
            status_message: "Ready. Pure Rust engine active.".to_string(),
            eval_time_ms: 0.0,
            project_file_path: None,
            show_about_dialog: false,
            export_preset_id: "ue5".to_string(),
            export_asset_name: "Asset".to_string(),
            export_target_dir: "exports".to_string(),
            export_report_summary: None,
        }
    }
}

impl eframe::App for TextureLabApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // 1. Hotkey Dispatcher Guard
        let is_text_focused = ctx.memory(|m| m.focused().is_some());
        let hotkey = ctx.input(|i| dispatch_from_input(i, is_text_focused));

        if let Some(action) = hotkey {
            match action {
                HotkeyAction::OpenSearchPalette => {
                    self.search_palette.open_at([-self.canvas_state.pan.x + 400.0, -self.canvas_state.pan.y + 250.0]);
                }
                HotkeyAction::FrameAll => {
                    self.canvas_state.frame_focus(&self.graph, ctx.screen_rect().size());
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
                        self.graph.remove_node(sel);
                        self.evaluator.invalidate_all();
                        self.reevaluate();
                        self.history.record(&self.graph, "Delete node");
                        self.status_message = format!("Deleted node {}", sel);
                    }
                }
                HotkeyAction::SaveProject => {
                    if let Some(path) = &self.project_file_path {
                        let project = ProjectFile::new(self.graph.clone(), "TextureLab Project");
                        if project.save_to_file(path).is_ok() {
                            self.status_message = format!("Project saved to {}", path.display());
                        }
                    }
                }
                HotkeyAction::OpenExportDialog => {
                    self.status_message = "Opened Export Preflight Drawer (Ctrl+E)".to_string();
                    if let Some(mut dock) = self.dock_state.take() {
                        if let Some(loc) = dock.find_tab(&Tab::ExportDrawer) {
                            dock.set_active_tab(loc);
                        }
                        self.dock_state = Some(dock);
                    }
                }
            }
        }

        // 2. Top Menu Bar
        TopBottomPanel::top("top_menu_bar").show(ctx, |ui| {
            egui::menu::bar(ui, |ui| {
                ui.menu_button("File", |ui| {
                    if ui.button("New Project").clicked() {
                        self.graph = build_starter_graph();
                        self.evaluator.invalidate_all();
                        self.reevaluate();
                        self.history.clear();
                        self.history.record(&self.graph, "New Project");
                        self.project_file_path = None;
                        ui.close_menu();
                    }
                    if ui.button("Open Project (.tlab)...").clicked() {
                        if let Some(path) = rfd::FileDialog::new()
                            .add_filter("TextureLab Project", &["tlab", "json"])
                            .pick_file()
                        {
                            if let Ok(project) = ProjectFile::load_from_file(&path) {
                                self.graph = project.graph;
                                self.evaluator.invalidate_all();
                                self.reevaluate();
                                self.history.clear();
                                self.history.record(&self.graph, "Loaded Project");
                                self.project_file_path = Some(path);
                            }
                        }
                        ui.close_menu();
                    }
                    if ui.button("Save Project (Ctrl+S)").clicked() {
                        if let Some(path) = &self.project_file_path {
                            let project = ProjectFile::new(self.graph.clone(), "TextureLab Project");
                            let _ = project.save_to_file(path);
                        } else if let Some(path) = rfd::FileDialog::new()
                            .add_filter("TextureLab Project", &["tlab"])
                            .save_file()
                        {
                            let project = ProjectFile::new(self.graph.clone(), "TextureLab Project");
                            if project.save_to_file(&path).is_ok() {
                                self.project_file_path = Some(path);
                            }
                        }
                        ui.close_menu();
                    }
                    if ui.button("Save As...").clicked() {
                        if let Some(path) = rfd::FileDialog::new()
                            .add_filter("TextureLab Project", &["tlab"])
                            .save_file()
                        {
                            let project = ProjectFile::new(self.graph.clone(), "TextureLab Project");
                            if project.save_to_file(&path).is_ok() {
                                self.project_file_path = Some(path);
                            }
                        }
                        ui.close_menu();
                    }
                    ui.separator();
                    if ui.button("Export Textures (Ctrl+E)...").clicked() {
                        self.status_message = "Opened Export Preflight Drawer (Ctrl+E)".to_string();
                        if let Some(mut dock) = self.dock_state.take() {
                            if let Some(loc) = dock.find_tab(&Tab::ExportDrawer) {
                                dock.set_active_tab(loc);
                            }
                            self.dock_state = Some(dock);
                        }
                        ui.close_menu();
                    }
                    ui.separator();
                    if ui.button("Exit").clicked() {
                        ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                    }
                });

                ui.menu_button("Edit", |ui| {
                    if ui.button("Undo (Ctrl+Z)").clicked() {
                        let desc = self.history.undo_description().map(|s| s.to_string());
                        if let Some(prev) = self.history.undo(&self.graph) {
                            self.graph = prev;
                            self.evaluator.invalidate_all();
                            self.reevaluate();
                            self.status_message = format!("Undo: {}", desc.as_deref().unwrap_or(""));
                        }
                        ui.close_menu();
                    }
                    if ui.button("Redo (Ctrl+Y)").clicked() {
                        let desc = self.history.redo_description().map(|s| s.to_string());
                        if let Some(next) = self.history.redo(&self.graph) {
                            self.graph = next;
                            self.evaluator.invalidate_all();
                            self.reevaluate();
                            self.status_message = format!("Redo: {}", desc.as_deref().unwrap_or(""));
                        }
                        ui.close_menu();
                    }
                    ui.separator();
                    if ui.button("Select All (Ctrl+A)").clicked() {
                        if let Some(&first) = self.graph.nodes.keys().next() {
                            self.canvas_state.selected_node = Some(first);
                        }
                        ui.close_menu();
                    }
                    if ui.button("Delete Selected (Del)").clicked() {
                        if let Some(sel) = self.canvas_state.selected_node.take() {
                            self.graph.remove_node(sel);
                            self.evaluator.invalidate_all();
                            self.reevaluate();
                            self.history.record(&self.graph, "Delete node");
                        }
                        ui.close_menu();
                    }
                });

                ui.menu_button("View", |ui| {
                    if ui.button("Frame All (F)").clicked() {
                        self.canvas_state.frame_focus(&self.graph, ctx.screen_rect().size());
                        ui.close_menu();
                    }
                    if ui.button("Reset Viewport").clicked() {
                        self.viewport_state.reset_view();
                        ui.close_menu();
                    }
                    if ui.button("Reset Dock Layout").clicked() {
                        self.dock_state = Some(crate::ui::default_dock_layout());
                        ui.close_menu();
                    }
                });

                ui.menu_button("Nodes", |ui| {
                    if ui.button("Quick Search Palette (Tab)").clicked() {
                        self.search_palette.open_at([-self.canvas_state.pan.x + 400.0, -self.canvas_state.pan.y + 250.0]);
                        ui.close_menu();
                    }
                    ui.separator();
                    for desc in NODE_CATALOG.iter() {
                        let is_allowed = self.edition.is_node_allowed(desc.type_name);
                        let pro_tag = if !is_allowed { " [PRO 🔒]" } else { "" };
                        let label = if let Some(k) = desc.hotkey {
                            format!("{}{}{}", desc.display_name, pro_tag, format!(" [{}]", k))
                        } else {
                            format!("{}{}", desc.display_name, pro_tag)
                        };
                        if ui.button(label).clicked() {
                            let pos = [-self.canvas_state.pan.x + 300.0, -self.canvas_state.pan.y + 200.0];
                            self.spawn_node(desc, pos);
                            ui.close_menu();
                        }
                    }
                });

                ui.menu_button(format!("Edition: {}", self.edition.name()), |ui| {
                    ui.label(egui::RichText::new("Capability Matrix:").strong());
                    ui.label("• Lite: Channel Pack/Unpack, Lexical Wizard, PNG/TGA");
                    ui.label("• Pro: RNM, 13-Op Math, 16-bit EXR/TIFF, A/B Split");
                    ui.separator();
                    if ui.selectable_label(self.edition == Edition::Pro, "TextureLAB Pro (Full Features)").clicked() {
                        self.edition = Edition::Pro;
                        self.status_message = "Active edition: TextureLAB Pro (All features unlocked)".to_string();
                        ui.close_menu();
                    }
                    if ui.selectable_label(self.edition == Edition::Lite, "TextureLAB Lite (Restricted Mode)").clicked() {
                        self.edition = Edition::Lite;
                        self.status_message = "Active edition: TextureLAB Lite (RNM, Math & EXR/TIFF locked)".to_string();
                        ui.close_menu();
                    }
                });

                ui.menu_button("Help", |ui| {
                    if ui.button("About TextureLAB").clicked() {
                        self.show_about_dialog = true;
                        ui.close_menu();
                    }
                });

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    ui.colored_label(
                        crate::ui::theme::TEXT_ACCENT,
                        format!("100% Native Rust • Zero Electron [{}]", self.edition.name()),
                    );
                    ui.separator();
                    ui.label(
                        egui::RichText::new(format!("v{}", self.version))
                            .color(crate::ui::theme::TEXT_MUTED),
                    );
                });
            });
        });

        // 3. Bottom Status Bar
        TopBottomPanel::bottom("bottom_status_bar").show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new("●").color(crate::ui::theme::CAT_MATH));
                ui.label(
                    egui::RichText::new(&self.status_message)
                        .color(TEXT_PRIMARY)
                        .size(12.0),
                );

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
                history: &mut self.history,
                canvas_state: &mut self.canvas_state,
                viewport_state: &mut self.viewport_state,
                library_query: &mut self.library_query,
                status_message: &mut self.status_message,
                eval_time_ms: &mut self.eval_time_ms,
                search_palette: &mut self.search_palette,
                export_preset_id: &mut self.export_preset_id,
                export_asset_name: &mut self.export_asset_name,
                export_target_dir: &mut self.export_target_dir,
                export_report_summary: &mut self.export_report_summary,
                edition: &mut self.edition,
            };

            DockArea::new(&mut dock_state)
                .style(dock_style)
                .show(ctx, &mut tab_viewer);

            self.dock_state = Some(dock_state);
        }

        // 5. Floating Quick-Search Palette (`Tab`)
        if let Some((desc, pos)) = self.search_palette.show(ctx) {
            self.spawn_node(desc, pos);
        }

        // 6. About Dialog Modal
        if self.show_about_dialog {
            egui::Window::new("About ARKH TextureLAB")
                .collapsible(false)
                .resizable(false)
                .show(ctx, |ui| {
                    ui.heading("ARKH TextureLAB");
                    ui.label("Professional PBR Texture Authoring and Channel Packing Workstation");
                    ui.label(format!("Version: {}", self.version));
                    ui.label(format!("Edition: {} ({})", self.edition.name(), if self.edition.is_pro() { "Full Capability Matrix" } else { "Lite Mode" }));
                    ui.separator();
                    ui.label("• 100% Native Desktop Engine (Rust 2021)");
                    ui.label("• Zero Electron • Zero WebViews • Zero Node.js runtime");
                    ui.label("• Rayon Multi-threaded SIMD parallel image pipeline");
                    ui.label("• High-performance Topological DAG execution");
                    ui.add_space(10.0);
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
    history: &'a mut HistoryStack,
    canvas_state: &'a mut CanvasState,
    viewport_state: &'a mut ViewportState,
    library_query: &'a mut String,
    status_message: &'a mut String,
    eval_time_ms: &'a mut f64,
    search_palette: &'a mut SearchPaletteState,
    export_preset_id: &'a mut String,
    export_asset_name: &'a mut String,
    export_target_dir: &'a mut String,
    export_report_summary: &'a mut Option<String>,
    edition: &'a mut Edition,
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
                            if let Ok(()) = self.graph.connect(from.clone(), to.clone()) {
                                self.evaluator.mark_dirty(self.graph, to.node_id);
                                let start = Instant::now();
                                let _ = self.evaluator.evaluate(self.graph);
                                *self.eval_time_ms = start.elapsed().as_secs_f64() * 1000.0;
                                self.history.record(self.graph, format!("Connect {} -> {}", from.name, to.name));
                                *self.status_message = format!("Connected {} to {}", from.name, to.name);
                            }
                        }
                        CanvasAction::DisconnectEdge(edge) => {
                            self.graph.disconnect(&edge.from, &edge.to);
                            self.evaluator.mark_dirty(self.graph, edge.to.node_id);
                            let _ = self.evaluator.evaluate(self.graph);
                            self.history.record(self.graph, "Disconnect edge");
                        }
                        CanvasAction::DeleteNode(node_id) => {
                            self.graph.remove_node(node_id);
                            self.evaluator.invalidate_all();
                            let _ = self.evaluator.evaluate(self.graph);
                            self.history.record(self.graph, format!("Delete node {}", node_id));
                            if self.canvas_state.selected_node == Some(node_id) {
                                self.canvas_state.selected_node = None;
                            }
                        }
                        CanvasAction::DeleteSelected => {
                            if let Some(sel) = self.canvas_state.selected_node.take() {
                                self.graph.remove_node(sel);
                                self.evaluator.invalidate_all();
                                let _ = self.evaluator.evaluate(self.graph);
                                self.history.record(self.graph, "Delete node");
                            }
                        }
                        CanvasAction::NodeMoved { node_id, new_pos: _ } => {
                            self.history.record(self.graph, format!("Move node {}", node_id));
                        }
                        CanvasAction::OpenSearchPalette(pos) => {
                            self.search_palette.open_at(pos);
                        }
                    }
                }
            }

            Tab::Viewport2D => {
                // Find evaluated buffer for selected node or first available output
                let mut buffer_to_show = None;
                let mut title = "2D Viewport (Empty)".to_string();

                if let Some(sel_id) = self.canvas_state.selected_node {
                    if let Some(node) = self.graph.get_node(sel_id) {
                        title = format!("2D Viewport: {} ({})", node.label, node.node_type);
                        // Search in node outputs
                        for pin in &node.outputs {
                            if let Some(buf) = self.evaluator.get_output(pin) {
                                buffer_to_show = Some(buf);
                                break;
                            }
                        }
                    }
                }

                if buffer_to_show.is_none() {
                    // Fallback to first available cached output in graph
                    for node in self.graph.nodes.values() {
                        for pin in &node.outputs {
                            if let Some(buf) = self.evaluator.get_output(pin) {
                                title = format!("2D Viewport: {} ({})", node.label, node.node_type);
                                buffer_to_show = Some(buf);
                                break;
                            }
                        }
                        if buffer_to_show.is_some() {
                            break;
                        }
                    }
                }

                self.viewport_state.show(
                    ui,
                    buffer_to_show.as_deref(),
                    &title,
                );
            }

            Tab::Inspector => {
                let selected_id = self.canvas_state.selected_node;
                let node_mut = selected_id.and_then(|id| self.graph.get_node_mut(id));

                if let Some(action) = show_inspector(ui, node_mut) {
                    match action {
                        InspectorAction::ParamChanged { node_id, param_name, new_value: _ } => {
                            self.evaluator.mark_dirty(self.graph, node_id);
                            let start = Instant::now();
                            let _ = self.evaluator.evaluate(self.graph);
                            *self.eval_time_ms = start.elapsed().as_secs_f64() * 1000.0;
                            self.history.record(self.graph, format!("Edit {}", param_name));
                            *self.status_message = format!("Updated {}", param_name);
                        }
                        InspectorAction::LabelChanged { node_id, new_label } => {
                            self.history.record(self.graph, format!("Rename node {}", node_id));
                            *self.status_message = format!("Renamed node to {}", new_label);
                        }
                        InspectorAction::DeleteNode(node_id) => {
                            self.graph.remove_node(node_id);
                            self.evaluator.invalidate_all();
                            let _ = self.evaluator.evaluate(self.graph);
                            self.history.record(self.graph, format!("Delete node {}", node_id));
                            self.canvas_state.selected_node = None;
                        }
                    }
                }
            }

            Tab::Library => {
                if let Some(desc) = show_library_panel(ui, self.library_query) {
                    if !self.edition.is_node_allowed(desc.type_name) {
                        *self.status_message = format!("🔒 '{}' requires TextureLAB Pro edition.", desc.display_name);
                    } else {
                        let node_id = NodeId(self.graph.next_node_id);
                        let spawn_pos = [-self.canvas_state.pan.x + 300.0, -self.canvas_state.pan.y + 200.0];
                        let node = desc.create_node(node_id, spawn_pos);
                        self.graph.add_node(node);
                        self.canvas_state.selected_node = Some(node_id);

                        self.evaluator.mark_dirty(self.graph, node_id);
                        let start = Instant::now();
                        let _ = self.evaluator.evaluate(self.graph);
                        *self.eval_time_ms = start.elapsed().as_secs_f64() * 1000.0;

                        self.history.record(self.graph, format!("Spawn {}", desc.display_name));
                        *self.status_message = format!("Spawned {}", desc.display_name);
                    }
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
                        if ui.button("📁 Browse...").clicked() {
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
                        .filter(|n| n.node_type == "TextureOutput")
                        .collect();

                    if output_nodes.is_empty() {
                        ui.label(
                            egui::RichText::new("No TextureOutput nodes present in the current graph.")
                                .color(TEXT_MUTED),
                        );
                        if ui.button("+ Add TextureOutput Node").clicked() {
                            let desc = NODE_CATALOG.iter().find(|d| d.type_name == "TextureOutput");
                            if let Some(desc) = desc {
                                let id = NodeId(self.graph.next_node_id);
                                let node = desc.create_node(id, [600.0, 200.0]);
                                self.graph.add_node(node);
                                self.canvas_state.selected_node = Some(id);
                                self.evaluator.invalidate_all();
                                let _ = self.evaluator.evaluate(&self.graph);
                            }
                        }
                    } else {
                        ui.label(format!("Found {} texture output targets:", output_nodes.len()));
                        ui.add_space(4.0);

                        let current_preset = ExportPreset::find_by_id(self.export_preset_id)
                            .unwrap_or_else(|| ExportPreset::builtin_presets().remove(0));

                        let mut items_to_export = Vec::new();

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
                                    let (w, h) = self.evaluator.resolve_node_dimensions(&self.graph, node);
                                    let has_input = node.inputs.iter().any(|pin| self.graph.incoming_edge(pin).is_some());
                                    let is_fmt_allowed = self.edition.is_format_allowed(&fmt);

                                    let ctx = TokenContext::new(&*self.export_asset_name, &slot)
                                        .with_format(&fmt)
                                        .with_resolution(format!("{}x{}", w, h));
                                    let resolved_file = current_preset.resolve_filename(&ctx);

                                    ui.label(format!("{} (#{})", node.label, node.id.0));
                                    ui.label(&slot);
                                    ui.label(&fmt);
                                    ui.label(format!("{}x{}", w, h));
                                    ui.label(&resolved_file);
                                    if !is_fmt_allowed {
                                        ui.colored_label(crate::ui::theme::CAT_CONSTANTS, "🔒 Pro Format (Locked in Lite)");
                                    } else if has_input {
                                        ui.colored_label(crate::ui::theme::CAT_MATH, "✅ Ready");
                                        let out_pin = PinId::output(node.id, "output");
                                        if let Some(buf) = self.evaluator.get_output(&out_pin) {
                                            let target_path = PathBuf::from(&*self.export_target_dir).join(&resolved_file);
                                            items_to_export.push(ExportItem::new(buf.as_ref().clone(), target_path));
                                        }
                                    } else {
                                        ui.colored_label(crate::ui::theme::CAT_CONSTANTS, "⚠ Unlinked");
                                    }
                                    ui.end_row();
                                }
                            });

                        ui.add_space(8.0);
                        ui.horizontal(|ui| {
                            let can_export = !items_to_export.is_empty();
                            if ui.add_enabled(can_export, egui::Button::new("🚀 Export All Ready Maps (Direct Disk Write)")).clicked() {
                                let report = ExportWriter::execute_export(&items_to_export);
                                if report.is_success() {
                                    let msg = format!(
                                        "✅ Successfully exported {} files ({:.2} MB) in {}ms",
                                        report.files_written.len(),
                                        report.bytes_written as f64 / 1_048_576.0,
                                        report.elapsed_ms
                                    );
                                    *self.status_message = msg.clone();
                                    *self.export_report_summary = Some(msg);
                                } else {
                                    let err_msg = format!("❌ Export error: {}", report.errors.join("; "));
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

/// Helper building a canonical starter PBR graph for immediate evaluation.
pub fn build_starter_graph() -> Graph {
    let mut graph = Graph::new();

    // 1. Constant Color (Albedo Base)
    let n1 = graph.create_node("ConstantColor", "Base Color (Albedo)", [100.0, 140.0]);
    if let Some(node) = graph.get_node_mut(n1) {
        node.add_output("RGBA");
        node.add_output("output");
        node.add_output("R");
        node.add_output("G");
        node.add_output("B");
        node.add_output("A");
        node.set_param("color", crate::graph::model::NodeParam::Color([0.85, 0.45, 0.20, 1.0]));
    }

    // 2. Channel Splitter
    let n2 = graph.create_node("ChannelSplit", "Unpack Channels", [350.0, 140.0]);
    if let Some(node) = graph.get_node_mut(n2) {
        node.add_input("input");
        node.add_output("R");
        node.add_output("G");
        node.add_output("B");
        node.add_output("A");
    }

    // 3. Normal Flip Green
    let n3 = graph.create_node("NormalFlipGreen", "Normal DX <-> GL", [580.0, 60.0]);
    if let Some(node) = graph.get_node_mut(n3) {
        node.add_input("input");
        node.add_output("output");
    }

    // 4. Levels (Roughness)
    let n4 = graph.create_node("Levels", "Roughness Remap", [580.0, 220.0]);
    if let Some(node) = graph.get_node_mut(n4) {
        node.add_input("input");
        node.add_output("output");
        node.set_param("gamma", crate::graph::model::NodeParam::Float(1.2));
    }

    // 5. Texture Output
    let n5 = graph.create_node("TextureOutput", "Final Albedo Output", [820.0, 140.0]);
    if let Some(node) = graph.get_node_mut(n5) {
        node.add_input("input");
        node.add_output("output");
        node.set_param("slot_name", crate::graph::model::NodeParam::String("Albedo".to_string()));
    }

    // Connect wires
    let _ = graph.connect(PinId::output(n1, "RGBA"), PinId::input(n2, "input"));
    let _ = graph.connect(PinId::output(n2, "G"), PinId::input(n3, "input"));
    let _ = graph.connect(PinId::output(n2, "R"), PinId::input(n4, "input"));
    let _ = graph.connect(PinId::output(n1, "output"), PinId::input(n5, "input"));

    graph
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
        assert_eq!(app.edition, Edition::Pro);
    }

    #[test]
    fn test_edition_capability_matrix_rules() {
        assert!(Edition::Pro.is_pro());
        assert!(!Edition::Lite.is_pro());

        // Basic nodes allowed in both Lite and Pro
        assert!(Edition::Lite.is_node_allowed("ChannelCombine"));
        assert!(Edition::Lite.is_node_allowed("ChannelSplit"));
        assert!(Edition::Lite.is_node_allowed("ConstantScalar"));
        assert!(Edition::Lite.is_node_allowed("ConstantColor"));
        assert!(Edition::Lite.is_node_allowed("Invert"));
        assert!(Edition::Lite.is_node_allowed("Levels"));
        assert!(Edition::Lite.is_node_allowed("NormalFlipGreen"));
        assert!(Edition::Lite.is_node_allowed("LayerBlend"));
        assert!(Edition::Lite.is_node_allowed("TextureInput"));
        assert!(Edition::Lite.is_node_allowed("TextureOutput"));

        // Pro-only nodes locked in Lite
        assert!(!Edition::Lite.is_node_allowed("NormalBlendRNM"));
        assert!(!Edition::Lite.is_node_allowed("Math"));
        assert!(!Edition::Lite.is_node_allowed("Add"));
        assert!(!Edition::Lite.is_node_allowed("Multiply"));

        // All nodes allowed in Pro
        assert!(Edition::Pro.is_node_allowed("NormalBlendRNM"));
        assert!(Edition::Pro.is_node_allowed("Math"));
        assert!(Edition::Pro.is_node_allowed("ChannelCombine"));

        // Codec format capabilities
        assert!(Edition::Lite.is_format_allowed("PNG"));
        assert!(Edition::Lite.is_format_allowed("TGA"));
        assert!(!Edition::Lite.is_format_allowed("EXR"));
        assert!(!Edition::Lite.is_format_allowed("TIFF"));
        assert!(Edition::Pro.is_format_allowed("EXR"));
        assert!(Edition::Pro.is_format_allowed("TIFF"));

        // Advanced Viewport tooling capabilities
        assert!(!Edition::Lite.allows_ab_split());
        assert!(Edition::Pro.allows_ab_split());
        assert!(!Edition::Lite.allows_histogram());
        assert!(Edition::Pro.allows_histogram());
    }

    #[test]
    fn test_lite_edition_prevents_spawning_pro_nodes() {
        let mut app = TextureLabApp::default().with_edition(Edition::Lite);
        let initial_node_count = app.graph.nodes.len();

        // Attempting to spawn Math node in Lite edition must fail
        let result_math = app.spawn_node_by_type("Math");
        assert!(result_math.is_none());
        assert_eq!(app.graph.nodes.len(), initial_node_count);
        assert!(app.status_message.contains("TextureLAB Pro"));

        // Attempting to spawn RNM node in Lite edition must fail
        let result_rnm = app.spawn_node_by_type("NormalBlendRNM");
        assert!(result_rnm.is_none());
        assert_eq!(app.graph.nodes.len(), initial_node_count);
        assert!(app.status_message.contains("TextureLAB Pro"));

        // Standard node like ChannelSplit should succeed in Lite
        let result_split = app.spawn_node_by_type("ChannelSplit");
        assert!(result_split.is_some());
        assert_eq!(app.graph.nodes.len(), initial_node_count + 1);
        assert!(app.status_message.contains("Channel Split"));
    }

    #[test]
    fn test_pro_edition_allows_spawning_all_nodes() {
        let mut app = TextureLabApp::default().with_edition(Edition::Pro);
        let initial_node_count = app.graph.nodes.len();

        let result_math = app.spawn_node_by_type("Math");
        assert!(result_math.is_some());
        assert_eq!(app.graph.nodes.len(), initial_node_count + 1);

        let result_rnm = app.spawn_node_by_type("NormalBlendRNM");
        assert!(result_rnm.is_some());
        assert_eq!(app.graph.nodes.len(), initial_node_count + 2);
    }
}
