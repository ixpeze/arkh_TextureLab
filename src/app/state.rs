//! Application state, lifecycle initialization, and starter graph.

use std::path::PathBuf;
use std::time::Instant;
use egui_dock::DockState;

use crate::graph::evaluator::{AsyncEvaluator, GraphEvaluator};
use crate::graph::history::HistoryStack;
use crate::graph::model::{Graph, NodeId, PinId, ProjectMetadata};
use crate::export::{load_presets, PresetDesignerDialog, UserPreset};
use crate::nodes::NodeDescriptor;
use crate::settings::AppSettings;
use crate::ui::canvas::CanvasState;
use crate::ui::library::SearchPaletteState;
use crate::ui::preferences::PreferencesDialog;
use crate::ui::theme::{apply_theme_with_accent, rgb_to_color32};
use crate::ui::viewport::ViewportState;
use crate::ui::Tab;

/// Root application state for ARKH TextureLab.
pub struct TextureLabApp {
    pub title: String,
    pub version: &'static str,
    pub graph: Graph,
    pub evaluator: GraphEvaluator,
    pub async_evaluator: AsyncEvaluator,
    pub history: HistoryStack,
    pub project_metadata: ProjectMetadata,
    pub dock_state: Option<DockState<Tab>>,
    pub canvas_state: CanvasState,
    pub viewport_state: ViewportState,
    pub search_palette: SearchPaletteState,
    pub library_query: String,
    pub status_message: String,
    pub eval_time_ms: f64,
    pub project_file_path: Option<PathBuf>,
    pub show_about_dialog: bool,
    pub settings: AppSettings,
    pub preferences_dialog: PreferencesDialog,
    pub export_preset_id: String,
    pub export_asset_name: String,
    pub export_target_dir: String,
    pub export_report_summary: Option<String>,
    pub user_presets: Vec<UserPreset>,
    pub preset_designer_dialog: PresetDesignerDialog,
    pub batch_processor: crate::batch::BatchProcessor,
}


impl TextureLabApp {
    /// Creates a new instance of TextureLabApp initialized with the starter PBR graph.
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        // 1. Load user settings from settings.json
        let settings = AppSettings::load();

        // 2. Initialize Obsidian "Graphite Blueprint" dark workstation theme with configured accent color
        apply_theme_with_accent(&cc.egui_ctx, rgb_to_color32(settings.accent_color));

        // 3. Build default starter PBR graph
        let graph = build_starter_graph();
        let mut evaluator = GraphEvaluator::new(settings.default_resolution);

        let start = Instant::now();
        let _ = evaluator.evaluate(&graph);
        let eval_time_ms = start.elapsed().as_secs_f64() * 1000.0;

        // 4. Initialize transactional history (clean starting state with 0 undo steps)
        let history = HistoryStack::new();

        // 5. Default docking workspace
        let dock_state = crate::ui::default_dock_layout();

        // 6. Canvas state (select node 1 by default for instant preview)
        let mut canvas_state = CanvasState::new();
        canvas_state.selected_node = Some(NodeId(1));

        let export_target_dir = settings
            .export_directory
            .clone()
            .unwrap_or_else(|| "exports".to_string());

        Self {
            title: "TextureLAB".to_string(),
            version: env!("CARGO_PKG_VERSION"),
            graph,
            evaluator,
            async_evaluator: AsyncEvaluator::new(settings.default_resolution),
            history,
            project_metadata: ProjectMetadata::default(),
            dock_state: Some(dock_state),
            canvas_state,
            viewport_state: ViewportState::new(),
            search_palette: SearchPaletteState::new(),
            library_query: String::new(),
            status_message: "Ready".to_string(),
            eval_time_ms,
            project_file_path: None,
            show_about_dialog: false,
            settings,
            preferences_dialog: PreferencesDialog::new(),
            export_preset_id: "ue5".to_string(),
            export_asset_name: "Asset".to_string(),
            export_target_dir,
            export_report_summary: None,
            user_presets: load_presets(),
            preset_designer_dialog: PresetDesignerDialog::new(),
            batch_processor: crate::batch::BatchProcessor::new(),
        }
    }

    /// Spawns a node from a descriptor at the given canvas position.
    pub fn spawn_node(&mut self, desc: &'static NodeDescriptor, position: [f32; 2]) -> Option<NodeId> {
        // Record pre-mutation state before adding node
        self.history.record(&self.graph, format!("Spawn {}", desc.display_name));

        let node_id = NodeId(self.graph.next_node_id);
        let node = desc.create_node(node_id, position);
        self.graph.add_node(node);
        self.canvas_state.selected_node = Some(node_id);

        self.evaluator.mark_dirty(&self.graph, node_id);
        self.async_evaluator.request_evaluation(
            &self.graph,
            vec![node_id],
            false,
            self.evaluator.default_resolution(),
        );

        self.status_message = format!("Spawned {}", desc.display_name);
        Some(node_id)
    }

    /// Spawns a node from its canonical type name or alias at the center of the current canvas viewport if permitted.
    pub fn spawn_node_by_type(&mut self, type_name: &str) -> Option<NodeId> {
        let desc = crate::nodes::find_descriptor(type_name)?;
        let canvas_center = [-self.canvas_state.pan.x + 300.0, -self.canvas_state.pan.y + 200.0];
        self.spawn_node(desc, canvas_center)
    }

    /// Spawns a node from its canonical type name or alias at the specified canvas position.
    pub fn spawn_node_by_type_at(&mut self, type_name: &str, position: [f32; 2]) -> Option<NodeId> {
        let desc = crate::nodes::find_descriptor(type_name)?;
        self.spawn_node(desc, position)
    }

    /// Polls the background async evaluation worker and applies any completed texture snapshots to the UI state.
    pub fn poll_evaluator(&mut self, ctx: &egui::Context) {
        if let Some(resp) = self.async_evaluator.try_recv() {
            match resp.report {
                Ok(report) => {
                    self.eval_time_ms = resp.eval_time_ms;
                    self.evaluator.apply_cache_update(resp.cache_snapshot);
                    self.status_message = format!(
                        "Evaluated {} nodes in {:.2}ms (Async worker)",
                        report.evaluated_nodes.len(),
                        self.eval_time_ms,
                    );
                    ctx.request_repaint();
                }
                Err(e) => {
                    self.status_message = format!("Evaluation warning: {}", e);
                }
            }
        }
    }

    /// Dispatches an asynchronous evaluation request to the background worker.
    pub fn request_async_eval(&mut self, dirty_nodes: Vec<NodeId>, invalidate_all: bool) {
        if invalidate_all {
            self.evaluator.invalidate_all();
        } else {
            for id in &dirty_nodes {
                self.evaluator.mark_dirty(&self.graph, *id);
            }
        }
        self.async_evaluator.request_evaluation(
            &self.graph,
            dirty_nodes,
            invalidate_all,
            self.evaluator.default_resolution(),
        );
    }

    /// Re-evaluates the graph synchronously and tracks execution time (for deterministic testing and pre-export guarantees).
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

    /// Loads a starter template, replacing the current graph with an undo snapshot.
    pub fn load_template(&mut self, template: &crate::templates::TemplateEntry) -> bool {
        if let Ok(project) = template.load_project() {
            self.history.record(&self.graph, format!("Load Template: {}", template.name));
            self.graph = project.graph;
            self.project_metadata = project.metadata;
            self.project_file_path = None;
            self.canvas_state.selected_node = self.graph.nodes.keys().next().copied();
            self.canvas_state.dismiss_splash = false;
            self.evaluator.invalidate_all();
            self.reevaluate();
            self.async_evaluator.request_evaluation(
                &self.graph,
                vec![],
                true,
                self.evaluator.default_resolution(),
            );
            self.status_message = format!("Loaded template: {}", template.name);
            true
        } else {
            false
        }
    }

    /// Loads a starter template by its name.
    pub fn load_template_by_name(&mut self, name: &str) -> bool {
        if let Some(template) = crate::templates::builtin_templates()
            .into_iter()
            .find(|t| t.name.eq_ignore_ascii_case(name))
        {
            self.load_template(&template)
        } else {
            false
        }
    }

    /// Opens or focuses the Texture Set Validator dock tab.
    pub fn open_validator_tab(&mut self) {
        if let Some(mut dock) = self.dock_state.take() {
            if dock.find_tab(&Tab::Validator).is_none() {
                dock.main_surface_mut().push_to_focused_leaf(Tab::Validator);
            }
            if let Some(loc) = dock.find_tab(&Tab::Validator) {
                dock.set_active_tab(loc);
            }
            self.dock_state = Some(dock);
        }
        self.status_message = "Opened Texture Set Validator panel".to_string();
    }

    /// Opens or focuses the Batch Processor dock tab.
    pub fn open_batch_tab(&mut self) {
        if let Some(mut dock) = self.dock_state.take() {
            if dock.find_tab(&Tab::Batch).is_none() {
                dock.main_surface_mut().push_to_focused_leaf(Tab::Batch);
            }
            if let Some(loc) = dock.find_tab(&Tab::Batch) {
                dock.set_active_tab(loc);
            }
            self.dock_state = Some(dock);
        }
        self.status_message = "Opened Batch Processor panel".to_string();
    }

    /// Automatically organizes nodes into a compact, non-overlapping hierarchical layout.
    ///
    /// If a node is selected, organizes only its upstream back-hierarchy (Right to Left)
    /// anchored to that node. If no node is selected, arranges the entire graph.
    /// Preserves current canvas camera pan and zoom without altering the view.
    pub fn execute_auto_layout(&mut self) {
        let sel = self.canvas_state.selected_node;
        self.history.record(&self.graph, "Auto Layout Nodes");
        crate::graph::layout::auto_layout_graph_contextual(&mut self.graph, sel);

        let count = if let Some(target) = sel {
            let mut back = crate::graph::compiler::GraphCompiler::upstream_nodes(&self.graph, target);
            back.insert(target);
            back.len()
        } else {
            self.graph.nodes.len()
        };

        if let Some(target) = sel {
            self.status_message = format!(
                "Auto-arranged back-hierarchy of Node#{} ({} nodes, Right-to-Left) [Ctrl+F]",
                target.0, count
            );
        } else {
            self.status_message = format!(
                "Auto-arranged {} nodes into compact layout (Ctrl+F)",
                count
            );
        }
    }

    /// Clones currently selected node(s) and their internal connections to clipboard (`Ctrl + C`).
    pub fn copy_selected_nodes(&mut self) -> bool {
        let copied = self.canvas_state.copy_selected(&self.graph);
        if copied {
            let count = self.canvas_state.clipboard.as_ref().map(|(n, _)| n.len()).unwrap_or(0);
            self.status_message = format!("Copied {} node(s) to clipboard (Ctrl+C)", count);
        }
        copied
    }

    /// Pastes clipboard subgraph into the graph with undo history and re-evaluation (`Ctrl + V`).
    ///
    /// If `mouse_pos` in canvas coordinates is supplied, positions the pasted subgraph at
    /// the mouse position with a [50, 50] offset; otherwise applies a [50, 50] relative offset.
    pub fn paste_clipboard(&mut self, mouse_pos: Option<[f32; 2]>) -> Vec<NodeId> {
        let offset = if let Some(target_pos) = mouse_pos {
            if let Some((nodes, _)) = &self.canvas_state.clipboard {
                if let Some(first) = nodes.first() {
                    [
                        target_pos[0] - first.position[0] + 50.0,
                        target_pos[1] - first.position[1] + 50.0,
                    ]
                } else {
                    [50.0, 50.0]
                }
            } else {
                [50.0, 50.0]
            }
        } else {
            [50.0, 50.0]
        };

        if self.canvas_state.clipboard.is_some() {
            self.history.record(&self.graph, "Paste node(s)");
            let new_ids = self.canvas_state.paste_clipboard(&mut self.graph, offset);
            if !new_ids.is_empty() {
                self.evaluator.invalidate_all();
                self.reevaluate();
                self.status_message = format!("Pasted {} node(s) (Ctrl+V)", new_ids.len());
            }
            new_ids
        } else {
            Vec::new()
        }
    }

    /// Copies selected nodes and immediately pastes them offset by [30, 30] (`Ctrl + D`).
    pub fn duplicate_selected_nodes(&mut self) -> Vec<NodeId> {
        if self.canvas_state.selected_node.is_some() {
            self.history.record(&self.graph, "Duplicate node(s)");
            let new_ids = self.canvas_state.duplicate_selected(&mut self.graph, [30.0, 30.0]);
            if !new_ids.is_empty() {
                self.evaluator.invalidate_all();
                self.reevaluate();
                self.status_message = format!("Duplicated {} node(s) (Ctrl+D)", new_ids.len());
            }
            new_ids
        } else {
            Vec::new()
        }
    }
}

impl Default for TextureLabApp {
    fn default() -> Self {
        let graph = build_starter_graph();
        let mut evaluator = GraphEvaluator::new((1024, 1024));
        let _ = evaluator.evaluate(&graph);

        let history = HistoryStack::new();

        let mut canvas_state = CanvasState::new();
        canvas_state.selected_node = Some(NodeId(1));

        Self {
            title: "TextureLAB".to_string(),
            version: env!("CARGO_PKG_VERSION"),
            graph,
            evaluator,
            async_evaluator: AsyncEvaluator::new((1024, 1024)),
            history,
            project_metadata: ProjectMetadata::default(),
            dock_state: Some(crate::ui::default_dock_layout()),
            canvas_state,
            viewport_state: ViewportState::new(),
            search_palette: SearchPaletteState::new(),
            library_query: String::new(),
            status_message: "Ready".to_string(),
            eval_time_ms: 0.0,
            project_file_path: None,
            show_about_dialog: false,
            settings: AppSettings::default(),
            preferences_dialog: PreferencesDialog::new(),
            export_preset_id: "ue5".to_string(),
            export_asset_name: "Asset".to_string(),
            export_target_dir: "exports".to_string(),
            export_report_summary: None,
            user_presets: UserPreset::default_presets(),
            preset_designer_dialog: PresetDesignerDialog::new(),
            batch_processor: crate::batch::BatchProcessor::new(),
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
