//! Infinite Node Canvas with Cubic Bezier Wires & LOD Zoom (React/xyflow DCC Style).
//!
//! Provides smooth 60+ FPS pan/zoom, React Flow dot grid, semantic Bezier wire rendering
//! with animated data flow, socket hit-testing & hover glow, 3-level LOD cards with
//! 2.5px category accent bars, and marquee box selection.

pub mod cards;
pub mod search;
pub mod wires;

pub use cards::{
    calculate_node_width, detect_texture_channel_tags, get_texture_input_filename,
    infer_category, ChannelBadgeTag, ChannelBadgeTuple, NodeCardRenderParams, NodeLod,
};
pub use search::{filter_catalog, SearchPaletteState};
pub use wires::{
    distance_to_bezier_wire, draw_cubic_bezier_wire, draw_cubic_bezier_wire_animated,
};

use egui::{
    Color32, Key, Painter, Pos2, Rect, Sense, Stroke, StrokeKind, Ui, Vec2,
};
use crate::graph::model::{Edge, Graph, Node, NodeId, NodeParam, PinId};
use crate::ui::theme::{
    pin_wire_color, ACCENT_AMBER, BG_CANVAS, BG_CARD, BG_CARD_SELECTED, BG_INSET,
    BORDER_DARK, CAT_BLEND, CAT_TRANSFORM, CAT_UTILITY,
    GRID_AXIS, GRID_DOT, GRID_DOT_MAJOR, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY,
};
use self::cards::render_node_card;

/// Active wire connection drag state.
#[derive(Clone, Debug)]
pub struct WireDragState {
    pub from_pin: PinId,
    pub current_screen_pos: Pos2,
}

/// Canvas user interactions emitted back to application state.
#[derive(Clone, Debug, PartialEq)]
pub enum CanvasAction {
    SelectNode(Option<NodeId>),
    SelectNodes(Vec<NodeId>),
    ConnectPins { from: PinId, to: PinId },
    DisconnectEdge(Edge),
    DisconnectPin(PinId),
    SplitWireWithReroute { edge: Edge, pos: [f32; 2] },
    DeleteNode(NodeId),
    DeleteSelected,
    NodeMoved {
        node_id: NodeId,
        old_pos: [f32; 2],
        new_pos: [f32; 2],
    },
    OpenSearchPalette([f32; 2]),
    OpenSearchPaletteAt {
        screen_pos: Pos2,
        canvas_pos: [f32; 2],
        source_pin: Option<PinId>,
    },
    SpawnNodeAt { type_name: String, pos: [f32; 2] },
    FrameFocus,
    AutoLayout,
    LoadTemplate(String),
}

/// Persistent canvas navigation and interaction state.
pub struct CanvasState {
    pub pan: Vec2,
    pub target_pan: Vec2,
    pub zoom: f32,
    pub selected_node: Option<NodeId>,
    pub selected_nodes: std::collections::HashSet<NodeId>,
    pub locked_viewport_node: Option<NodeId>,
    pub wire_drag: Option<WireDragState>,
    dragging_node: Option<NodeId>,
    drag_started_pos: Option<[f32; 2]>,
    pub resizing_comment: Option<NodeId>,
    box_select_start: Option<Pos2>,
    box_select_current: Option<Pos2>,
    pub last_canvas_rect: Rect,
    pub clipboard: Option<(Vec<Node>, Vec<Edge>)>,
    pub dismiss_splash: bool,
    pub rendered_node_rects: Vec<(NodeId, Rect)>,
}

impl Default for CanvasState {
    fn default() -> Self {
        Self {
            pan: Vec2::new(100.0, 100.0),
            target_pan: Vec2::new(100.0, 100.0),
            zoom: 1.0,
            selected_node: None,
            selected_nodes: std::collections::HashSet::new(),
            locked_viewport_node: None,
            wire_drag: None,
            dragging_node: None,
            drag_started_pos: None,
            resizing_comment: None,
            box_select_start: None,
            box_select_current: None,
            last_canvas_rect: Rect::from_min_size(Pos2::ZERO, Vec2::new(1920.0, 1080.0)),
            clipboard: None,
            dismiss_splash: false,
            rendered_node_rects: Vec::new(),
        }
    }
}

impl CanvasState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns the NodeId of the topmost node whose rendered card screen rect contains `screen_pos`.
    pub fn find_node_at_screen_pos(&self, screen_pos: Pos2) -> Option<NodeId> {
        let margin = (6.0 * self.zoom).clamp(4.0, 16.0);
        for &(id, rect) in self.rendered_node_rects.iter().rev() {
            if rect.expand(margin).contains(screen_pos) {
                return Some(id);
            }
        }
        None
    }

    /// Returns the NodeId of any node whose bounding box in canvas coordinates contains `canvas_pos`.
    pub fn find_node_at_canvas_pos(&self, canvas_pos: Pos2, graph: &Graph) -> Option<NodeId> {
        for node in graph.nodes.values() {
            if node.node_type == "Comment" {
                continue;
            }
            let (w, h) = crate::graph::layout::calculate_node_size(node);
            let rect = Rect::from_min_size(
                Pos2::new(node.position[0], node.position[1]),
                Vec2::new(w, h),
            );
            if rect.expand(12.0).contains(canvas_pos) {
                return Some(node.id);
            }
        }
        None
    }

    /// Finds a node under `screen_pos`, querying rendered screen rects first with canvas coordinate fallback.
    pub fn find_node_at(&self, screen_pos: Pos2, graph: &Graph) -> Option<NodeId> {
        if let Some(id) = self.find_node_at_screen_pos(screen_pos) {
            return Some(id);
        }
        let canvas_pt = self.screen_to_canvas(screen_pos, self.last_canvas_rect);
        self.find_node_at_canvas_pos(canvas_pt, graph)
    }

    /// Finds a TextureInput node under `screen_pos` or `canvas_pos` with generous hit margins (Corona Bitmap loader drop standard).
    pub fn find_texture_input_at(
        &self,
        screen_pos: Option<Pos2>,
        canvas_pos: Option<Pos2>,
        graph: &Graph,
    ) -> Option<NodeId> {
        // 1. First priority: Check rendered screen rects if screen_pos is provided
        if let Some(s_pos) = screen_pos {
            let hit_margin = (20.0 * self.zoom).clamp(14.0, 36.0);
            for &(id, rect) in self.rendered_node_rects.iter().rev() {
                if graph.get_node(id).is_some_and(|n| n.node_type == "TextureInput")
                    && rect.expand(hit_margin).contains(s_pos)
                {
                    return Some(id);
                }
            }
        }

        // 2. Second priority: Check world canvas coordinates
        let c_pos = canvas_pos.or_else(|| {
            screen_pos.map(|sp| self.screen_to_canvas(sp, self.last_canvas_rect))
        })?;

        let mut closest_hit: Option<(NodeId, f32)> = None;
        for node in graph.nodes.values() {
            if node.node_type != "TextureInput" {
                continue;
            }
            let (w, h) = crate::graph::layout::calculate_node_size(node);
            let card_rect = Rect::from_min_size(
                Pos2::new(node.position[0], node.position[1]),
                Vec2::new(w, h),
            );
            let hit_rect = card_rect.expand(28.0);
            if hit_rect.contains(c_pos) {
                let dist_sq = card_rect.center().distance_sq(c_pos);
                if closest_hit.is_none_or(|(_, best_dist)| dist_sq < best_dist) {
                    closest_hit = Some((node.id, dist_sq));
                }
            }
        }

        closest_hit.map(|(id, _)| id)
    }

    /// Clones specified nodes and internal connections into the canvas clipboard.
    pub fn copy_nodes(&mut self, graph: &Graph, node_ids: &[NodeId]) -> bool {
        let (nodes, edges) = graph.clone_subgraph(node_ids);
        if nodes.is_empty() {
            return false;
        }
        self.clipboard = Some((nodes, edges));
        true
    }

    /// Clones currently selected node(s) into the canvas clipboard.
    pub fn copy_selected(&mut self, graph: &Graph) -> bool {
        let mut ids: Vec<NodeId> = self.selected_nodes.iter().copied().collect();
        if ids.is_empty() {
            ids = self.selected_node.into_iter().collect();
        }
        self.copy_nodes(graph, &ids)
    }

    /// Pastes clipboard contents into the graph at the specified offset and selects newly created nodes.
    pub fn paste_clipboard(&mut self, graph: &mut Graph, offset: [f32; 2]) -> Vec<NodeId> {
        if let Some((nodes, edges)) = &self.clipboard {
            let new_ids = graph.paste_subgraph(nodes.clone(), edges.clone(), offset);
            self.selected_node = new_ids.first().copied();
            self.selected_nodes = new_ids.iter().copied().collect();
            new_ids
        } else {
            Vec::new()
        }
    }

    /// Copies selected nodes and immediately pastes them at the specified offset (Ctrl+D duplicate).
    pub fn duplicate_selected(&mut self, graph: &mut Graph, offset: [f32; 2]) -> Vec<NodeId> {
        if self.copy_selected(graph) {
            self.paste_clipboard(graph, offset)
        } else {
            Vec::new()
        }
    }

    /// Converts canvas world coordinates into screen pixel coordinates.
    pub fn canvas_to_screen(&self, canvas_pos: Pos2, canvas_rect: Rect) -> Pos2 {
        canvas_rect.min + self.pan + (canvas_pos.to_vec2() * self.zoom)
    }

    /// Converts screen pixel coordinates into canvas world coordinates.
    pub fn screen_to_canvas(&self, screen_pos: Pos2, canvas_rect: Rect) -> Pos2 {
        let offset = screen_pos - canvas_rect.min - self.pan;
        Pos2::new(offset.x / self.zoom, offset.y / self.zoom)
    }

    /// Auto-framing feature removed: preserves current screen pan and zoom.
    pub fn frame_focus(&mut self, _graph: &Graph, _canvas_size: Vec2) {
        // Preserves current canvas camera pan and zoom without auto-framing
    }

    /// Renders the complete infinite node canvas and handles all mouse/hotkey interactions.
    pub fn show(
        &mut self,
        ui: &mut Ui,
        graph: &mut Graph,
    ) -> Vec<CanvasAction> {
        let mut actions = Vec::new();
        let available_size = ui.available_size();
        let (rect, response) = ui.allocate_exact_size(available_size, Sense::click_and_drag());
        self.last_canvas_rect = rect;
        let painter = ui.painter_at(rect);

        // Animation phase for wire rendering and connection flow pulses
        let anim_phase = (ui.input(|i| i.time) * 1.5) as f32;

        // Request continuous repaint only during active drag, file hover, or interactive gestures to eliminate idle GPU/CPU burn
        if self.wire_drag.is_some() || self.dragging_node.is_some() || self.box_select_start.is_some() || !ui.ctx().input(|i| i.raw.hovered_files.is_empty()) {
            ui.ctx().request_repaint();
        }

        // Reset dismiss_splash if nodes are added so it re-appears if graph becomes empty again
        if !graph.nodes.is_empty() {
            self.dismiss_splash = false;
        }

        let is_splash_visible = graph.nodes.is_empty() && !self.dismiss_splash;
        let card_w = 520.0_f32.min(rect.width() - 32.0);
        let card_h = 285.0_f32.min(rect.height() - 32.0);
        let card_rect = Rect::from_center_size(rect.center(), Vec2::new(card_w, card_h));
        let is_over_splash = is_splash_visible && response.hover_pos().is_some_and(|p| card_rect.contains(p));

        // 1. Pan and Zoom Handling
        let is_middle_drag = response.dragged_by(egui::PointerButton::Middle);
        let is_space_drag = ui.input(|i| i.key_down(Key::Space))
            && response.dragged_by(egui::PointerButton::Primary);
        let is_secondary_drag = response.dragged_by(egui::PointerButton::Secondary);

        if (is_middle_drag || is_space_drag || (is_secondary_drag && self.dragging_node.is_none())) && !is_over_splash {
            self.target_pan += response.drag_delta();
        }

        // Mouse scroll zoom towards cursor
        let scroll = ui.input(|i| i.smooth_scroll_delta.y);
        if response.hovered() && scroll.abs() > 0.0 {
            if let Some(mouse_screen) = response.hover_pos() {
                let old_zoom = self.zoom;
                let factor = (scroll * 0.002).exp();
                let new_zoom = (old_zoom * factor).clamp(0.15, 3.0);

                let mouse_canvas = (mouse_screen - rect.min - self.pan) / old_zoom;
                self.target_pan = mouse_screen - rect.min - mouse_canvas * new_zoom;
                self.pan = self.target_pan;
                self.zoom = new_zoom;
            }
        }

        // Critically damped exponential pan smoothing (silky smooth pan lag)
        let dt = ui.input(|i| i.stable_dt).clamp(0.001, 0.1);
        let pan_diff = self.target_pan - self.pan;
        if pan_diff.length_sq() > 0.04 {
            let t = 1.0 - (-22.0 * dt).exp();
            self.pan += pan_diff * t;
            ui.ctx().request_repaint();
        } else {
            self.pan = self.target_pan;
        }

        // 2. Clean Dot Grid (React Flow Style)
        draw_background_grid(&painter, rect, self.pan, self.zoom);

        let lod = NodeLod::from_zoom(self.zoom);

        // Map socket pin screen positions for wire routing: PinId -> Pos2
        let mut pin_positions: std::collections::HashMap<PinId, Pos2> =
            std::collections::HashMap::new();

        // 3. Render Nodes & Collect Pin Positions
        let mut clicked_node = None;
        let mut hovered_pin = None;

        // Preliminary hit-test for pins to inform node rendering and wire routing.
        // Full-width horizontal drag and drop: each socket row acts as an interactive horizontal band.
        if let Some(hover) = response.hover_pos() {
            'pin_search: for node in graph.nodes.values() {
                if node.node_type == "Comment" {
                    continue;
                }
                if node.node_type == "Reroute" {
                    let screen_pos = self.canvas_to_screen(Pos2::new(node.position[0], node.position[1]), rect);
                    let radius = (6.0 * self.zoom).max(4.0);
                    let out_pos = Pos2::new(screen_pos.x + radius, screen_pos.y);
                    let in_pos = Pos2::new(screen_pos.x - radius, screen_pos.y);
                    let hit_radius = (8.0 * self.zoom).max(6.0);
                    if hover.distance(out_pos) <= hit_radius {
                        if let Some(pin) = node.outputs.first() {
                            hovered_pin = Some(pin.clone());
                            break 'pin_search;
                        }
                    } else if hover.distance(in_pos) <= hit_radius {
                        if let Some(pin) = node.inputs.first() {
                            hovered_pin = Some(pin.clone());
                            break 'pin_search;
                        }
                    } else if hover.distance(screen_pos) <= hit_radius {
                        if hover.x <= screen_pos.x {
                            if let Some(pin) = node.inputs.first() {
                                hovered_pin = Some(pin.clone());
                                break 'pin_search;
                            }
                        } else if let Some(pin) = node.outputs.first() {
                            hovered_pin = Some(pin.clone());
                            break 'pin_search;
                        }
                    }
                    continue;
                }

                let screen_pos = self.canvas_to_screen(Pos2::new(node.position[0], node.position[1]), rect);
                let width = calculate_node_width(node) * self.zoom;
                let is_texture_input = node.node_type == "TextureInput";
                let header_height = 36.0 * self.zoom;
                let filename_height = if is_texture_input {
                    let filename = get_texture_input_filename(node);
                    let max_text_width = (width - 24.0 * self.zoom).max(80.0 * self.zoom);
                    let font_id = egui::FontId::proportional((11.5 * self.zoom).max(9.0));
                    let galley = painter.layout(filename, font_id, TEXT_SECONDARY, max_text_width);
                    (galley.size().y + 12.0 * self.zoom).max(30.0 * self.zoom)
                } else {
                    0.0
                };
                let socket_row_height = if is_texture_input { 34.0 * self.zoom } else { 24.0 * self.zoom };
                let socket_start_y = if is_texture_input {
                    screen_pos.y + header_height + filename_height + (socket_row_height * 0.5)
                } else {
                    screen_pos.y + header_height + 14.0 * self.zoom
                };

                let has_inputs = !node.inputs.is_empty();
                let has_outputs = !node.outputs.is_empty();
                let max_sockets = node.inputs.len().max(node.outputs.len());

                // Check horizontal bounds with generous edge tolerance
                let in_horizontal_band = hover.x >= (screen_pos.x - 12.0 * self.zoom)
                    && hover.x <= (screen_pos.x + width + 12.0 * self.zoom);

                if !in_horizontal_band {
                    continue;
                }

                for row_idx in 0..max_sockets {
                    let pin_y = socket_start_y + row_idx as f32 * socket_row_height;
                    let row_half_h = socket_row_height * 0.55;

                    if (hover.y - pin_y).abs() <= row_half_h {
                        if has_inputs && has_outputs {
                            // Split row: left half routes to input, right half routes to output
                            let mid_x = screen_pos.x + width * 0.5;
                            if hover.x <= mid_x {
                                if let Some(pin) = node.inputs.get(row_idx) {
                                    hovered_pin = Some(pin.clone());
                                    break 'pin_search;
                                }
                            } else {
                                if let Some(pin) = node.outputs.get(row_idx) {
                                    hovered_pin = Some(pin.clone());
                                    break 'pin_search;
                                }
                            }
                        } else if has_inputs {
                            // Single-sided input node: entire horizontal row routes to input
                            if let Some(pin) = node.inputs.get(row_idx) {
                                hovered_pin = Some(pin.clone());
                                break 'pin_search;
                            }
                        } else if has_outputs {
                            // Single-sided output node: entire horizontal row routes to output
                            if let Some(pin) = node.outputs.get(row_idx) {
                                hovered_pin = Some(pin.clone());
                                break 'pin_search;
                            }
                        }
                    }
                }
            }
        }

        // 3. Render Nodes & Collect Pin Positions
        // Pass 1: Render Comment nodes first (sit behind other nodes in paint order)
        let mut comment_rects = Vec::new();
        for node in graph.nodes.values_mut() {
            if node.node_type != "Comment" {
                continue;
            }
            let is_selected = self.selected_node == Some(node.id) || self.selected_nodes.contains(&node.id);
            let is_viewport_locked = self.locked_viewport_node == Some(node.id);
            let screen_pos = self.canvas_to_screen(Pos2::new(node.position[0], node.position[1]), rect);

            let params = NodeCardRenderParams {
                screen_pos,
                zoom: self.zoom,
                lod,
                is_selected,
                is_viewport_locked,
                hovered_pin_id: hovered_pin.as_ref(),
                is_drop_target: false,
            };
            let (node_rect, _) = render_node_card(&painter, node, &params);
            comment_rects.push((node.id, node_rect));
        }

        // Active file drag-and-drop detection for interactive node hover (Corona Bitmap loader drop highlight)
        let hovered_files = ui.ctx().input(|i| i.raw.hovered_files.clone());
        let drop_hover_screen_pos = ui.ctx().pointer_hover_pos()
            .or_else(|| ui.ctx().pointer_interact_pos())
            .or_else(|| ui.ctx().input(|i| i.pointer.latest_pos()))
            .or_else(|| ui.ctx().input(|i| i.pointer.hover_pos()))
            .or_else(|| ui.ctx().input(|i| i.pointer.interact_pos()))
            .or_else(|| {
                ui.ctx().input(|i| {
                    i.raw.events.iter().rev().find_map(|e| match e {
                        egui::Event::PointerMoved(pos) => Some(*pos),
                        egui::Event::PointerButton { pos, .. } => Some(*pos),
                        _ => None,
                    })
                })
            });
        let drop_hovered_node = if !hovered_files.is_empty() {
            self.find_texture_input_at(drop_hover_screen_pos, None, graph)
        } else {
            None
        };

        // Pass 2: Render regular and reroute nodes on top
        let mut foreground_rects = Vec::new();
        for node in graph.nodes.values_mut() {
            if node.node_type == "Comment" {
                continue;
            }
            let is_selected = self.selected_node == Some(node.id) || self.selected_nodes.contains(&node.id);
            let is_viewport_locked = self.locked_viewport_node == Some(node.id);
            let screen_pos = self.canvas_to_screen(Pos2::new(node.position[0], node.position[1]), rect);
            let is_drop_target = drop_hovered_node == Some(node.id) && node.node_type == "TextureInput";

            let params = NodeCardRenderParams {
                screen_pos,
                zoom: self.zoom,
                lod,
                is_selected,
                is_viewport_locked,
                hovered_pin_id: hovered_pin.as_ref(),
                is_drop_target,
            };
            let (node_rect, pin_coords) = render_node_card(&painter, node, &params);

            // Register pin screen coordinates
            for (pin_id, coord) in pin_coords {
                pin_positions.insert(pin_id, coord);
            }
            foreground_rects.push((node.id, node_rect, screen_pos, node.node_type == "Reroute"));
        }

        // Cache rendered node screen rects for accurate hit-testing and drop targeting
        self.rendered_node_rects = foreground_rects.iter().map(|(id, r, ..)| (*id, *r)).collect();

        // Hit testing and dragging interaction:
        // Check foreground nodes first (front-to-back priority)
        if let Some(ptr) = response.interact_pointer_pos() {
            for &(id, node_rect, screen_pos, is_reroute) in &foreground_rects {
                if node_rect.contains(ptr) {
                    if response.clicked() {
                        clicked_node = Some(id);
                    }
                    if response.drag_started() {
                        let in_header = ptr.y <= screen_pos.y + 36.0 * self.zoom || is_reroute;
                        if in_header || hovered_pin.is_none() {
                            self.dragging_node = Some(id);
                            if let Some(n) = graph.get_node(id) {
                                self.drag_started_pos = Some(n.position);
                            }
                            clicked_node = Some(id);
                        }
                    }
                }
            }
        }

        // If no foreground node was clicked or dragged, check comment nodes
        if clicked_node.is_none() && self.dragging_node.is_none() {
            if let Some(ptr) = response.interact_pointer_pos() {
                for &(id, node_rect) in &comment_rects {
                    let handle_size = (16.0 * self.zoom).clamp(12.0, 24.0);
                    let resize_handle_rect = Rect::from_min_max(
                        node_rect.max - Vec2::splat(handle_size),
                        node_rect.max + Vec2::splat(4.0 * self.zoom),
                    );

                    if resize_handle_rect.contains(ptr) {
                        ui.ctx().set_cursor_icon(egui::CursorIcon::ResizeNwSe);
                        if response.drag_started() {
                            self.resizing_comment = Some(id);
                            clicked_node = Some(id);
                            break;
                        }
                    } else if node_rect.contains(ptr) {
                        if response.clicked() {
                            clicked_node = Some(id);
                        }
                        if response.drag_started() {
                            self.dragging_node = Some(id);
                            if let Some(n) = graph.get_node(id) {
                                self.drag_started_pos = Some(n.position);
                            }
                            clicked_node = Some(id);
                            break;
                        }
                    }
                }
            }
        }

        // Hover cursor over comment resize handles
        if let Some(hover) = response.hover_pos() {
            if self.dragging_node.is_none() && self.resizing_comment.is_none() {
                for &(_id, node_rect) in &comment_rects {
                    let handle_size = (16.0 * self.zoom).clamp(12.0, 24.0);
                    let resize_handle_rect = Rect::from_min_max(
                        node_rect.max - Vec2::splat(handle_size),
                        node_rect.max + Vec2::splat(4.0 * self.zoom),
                    );
                    if resize_handle_rect.contains(hover) {
                        ui.ctx().set_cursor_icon(egui::CursorIcon::ResizeNwSe);
                        break;
                    }
                }
            }
        }

        // Handle active node dragging
        if let Some(dragged_id) = self.dragging_node {
            if response.dragged_by(egui::PointerButton::Primary) && !ui.input(|i| i.key_down(Key::Space)) {
                let delta = response.drag_delta() / self.zoom;
                if self.selected_nodes.contains(&dragged_id) {
                    for &id in &self.selected_nodes {
                        if let Some(node) = graph.get_node_mut(id) {
                            node.position[0] += delta.x;
                            node.position[1] += delta.y;
                        }
                    }
                } else if let Some(node) = graph.get_node_mut(dragged_id) {
                    node.position[0] += delta.x;
                    node.position[1] += delta.y;
                }
            }
        }

        // Handle active comment resizing
        if let Some(resizing_id) = self.resizing_comment {
            if response.dragged_by(egui::PointerButton::Primary) && !ui.input(|i| i.key_down(Key::Space)) {
                let delta = response.drag_delta() / self.zoom;
                if let Some(node) = graph.get_node_mut(resizing_id) {
                    let w = node.get_float("width", 300.0);
                    let h = node.get_float("height", 200.0);
                    node.set_param("width", NodeParam::Float((w + delta.x).max(100.0)));
                    node.set_param("height", NodeParam::Float((h + delta.y).max(60.0)));
                }
            }
        }

        // Drag release
        if response.drag_stopped() {
            self.resizing_comment = None;
            if let Some(node_id) = self.dragging_node.take() {
                let initial_pos = self.drag_started_pos.take();
                if let Some(node) = graph.get_node(node_id) {
                    if let Some(old_pos) = initial_pos {
                        if (old_pos[0] - node.position[0]).abs() > 0.01 || (old_pos[1] - node.position[1]).abs() > 0.01 {
                            actions.push(CanvasAction::NodeMoved {
                                node_id,
                                old_pos,
                                new_pos: node.position,
                            });
                        }
                    }
                }
            }
        }

        // 4. Marquee Box Selection on Empty Canvas
        let is_primary_drag = response.dragged_by(egui::PointerButton::Primary);
        if is_primary_drag && !is_space_drag && self.dragging_node.is_none() && self.wire_drag.is_none() {
            if let Some(ptr) = response.interact_pointer_pos() {
                if self.box_select_start.is_none() && response.drag_started() && clicked_node.is_none() && !is_over_splash {
                    self.box_select_start = Some(ptr);
                }
                if self.box_select_start.is_some() {
                    self.box_select_current = Some(ptr);
                }
            }
        }

        if let (Some(start), Some(curr)) = (self.box_select_start, self.box_select_current) {
            let select_rect = Rect::from_two_pos(start, curr);
            let is_left_to_right = curr.x >= start.x;

            let (fill_col, stroke_col) = if is_left_to_right {
                // Window selection (Left-to-Right): Blue solid border, select all inside
                (
                    Color32::from_rgba_premultiplied(40, 110, 220, 28),
                    Color32::from_rgb(70, 150, 255),
                )
            } else {
                // Crossing selection (Right-to-Left): Green distinct border, select all touched
                (
                    Color32::from_rgba_premultiplied(35, 180, 80, 28),
                    Color32::from_rgb(60, 220, 120),
                )
            };

            painter.rect_filled(select_rect, 2.0, fill_col);
            painter.rect_stroke(select_rect, 2.0, Stroke::new(1.2_f32, stroke_col), StrokeKind::Inside);

            // On mouse release, select nodes according to CAD directional rule
            if response.drag_stopped() {
                let mut matched_nodes = Vec::new();

                for &(id, node_rect, ..) in &foreground_rects {
                    let is_match = if is_left_to_right {
                        // Left-to-Right: all inside (node_rect completely enclosed by select_rect)
                        select_rect.contains(node_rect.min) && select_rect.contains(node_rect.max)
                    } else {
                        // Right-to-Left: all touched (select_rect intersects node_rect)
                        select_rect.intersects(node_rect)
                    };
                    if is_match {
                        matched_nodes.push(id);
                    }
                }

                for &(id, node_rect) in &comment_rects {
                    let is_match = if is_left_to_right {
                        // Left-to-Right: all inside
                        select_rect.contains(node_rect.min) && select_rect.contains(node_rect.max)
                    } else {
                        // Right-to-Left: all touched
                        select_rect.intersects(node_rect)
                    };
                    if is_match {
                        matched_nodes.push(id);
                    }
                }

                if !matched_nodes.is_empty() {
                    self.selected_node = matched_nodes.first().copied();
                    self.selected_nodes = matched_nodes.iter().copied().collect();
                    actions.push(CanvasAction::SelectNodes(matched_nodes));
                } else {
                    self.selected_node = None;
                    self.selected_nodes.clear();
                    actions.push(CanvasAction::SelectNode(None));
                }
                self.box_select_start = None;
                self.box_select_current = None;
            }
        } else if response.drag_stopped() {
            self.box_select_start = None;
            self.box_select_current = None;
        }

        // Wire hover test for selection, cutting, or inspection
        let mut hovered_wire = None;
        if let Some(hover) = response.hover_pos() {
            for edge in &graph.edges {
                if let (Some(&p0), Some(&p3)) = (pin_positions.get(&edge.from), pin_positions.get(&edge.to)) {
                    let dist = distance_to_bezier_wire(hover, p0, p3, self.zoom);
                    if dist <= (12.0 * self.zoom).max(8.0) {
                        hovered_wire = Some(edge.clone());
                        break;
                    }
                }
            }
        }

        // Unreal Alt + Click wire / pin cutting cursor and action
        let is_alt_down = ui.input(|i| i.modifiers.alt);
        if is_alt_down {
            if hovered_pin.is_some() || hovered_wire.is_some() {
                ui.ctx().set_cursor_icon(egui::CursorIcon::Crosshair);
            }

            if response.clicked() {
                if let Some(pin) = &hovered_pin {
                    actions.push(CanvasAction::DisconnectPin(pin.clone()));
                } else if let Some(edge) = &hovered_wire {
                    actions.push(CanvasAction::DisconnectEdge(edge.clone()));
                }
            }
        }

        // Selection update or Hold-Key Quick Spawn on single click (when not Alt cutting)
        if response.clicked() && !is_alt_down && !is_space_drag && !is_over_splash {
            if let Some(id) = clicked_node {
                self.selected_node = Some(id);
                self.selected_nodes.clear();
                self.selected_nodes.insert(id);
                actions.push(CanvasAction::SelectNode(Some(id)));
            } else if hovered_pin.is_none() && hovered_wire.is_none() {
                // Unreal Engine Quick-Spawn Hotkeys (Hold Key + Left Click)
                let quick_spawn = if ui.input(|i| i.key_down(Key::T)) {
                    Some("TextureInput")
                } else if ui.input(|i| i.key_down(Key::Num1)) {
                    Some("ConstantScalar")
                } else if ui.input(|i| i.key_down(Key::Num3)) {
                    Some("ConstantColor")
                } else if ui.input(|i| i.key_down(Key::M)) {
                    Some("Multiply")
                } else if ui.input(|i| i.key_down(Key::A)) {
                    Some("Add")
                } else if ui.input(|i| i.key_down(Key::L)) {
                    Some("LayerBlend")
                } else if ui.input(|i| i.key_down(Key::O)) {
                    Some("Invert")
                } else if ui.input(|i| i.key_down(Key::Slash)) {
                    Some("Comment")
                } else {
                    None
                };

                if let Some(type_name) = quick_spawn {
                    if let Some(mouse_screen) = response.interact_pointer_pos() {
                        let canvas_pos = self.screen_to_canvas(mouse_screen, rect);
                        actions.push(CanvasAction::SpawnNodeAt {
                            type_name: type_name.to_string(),
                            pos: [canvas_pos.x, canvas_pos.y],
                        });
                    }
                } else {
                    // Clicked on empty canvas background
                    self.selected_node = None;
                    self.selected_nodes.clear();
                    actions.push(CanvasAction::SelectNode(None));
                }
            }
        }

        // Double-click on any wire inserts a Reroute node splitting the wire (Part B)
        if response.double_clicked() && hovered_pin.is_none() && clicked_node.is_none() && !is_over_splash {
            if let Some(wire) = hovered_wire.clone() {
                if let Some(mouse_screen) = response.interact_pointer_pos() {
                    let canvas_pos = self.screen_to_canvas(mouse_screen, rect);
                    actions.push(CanvasAction::SplitWireWithReroute {
                        edge: wire,
                        pos: [canvas_pos.x, canvas_pos.y],
                    });
                }
            } else {
                // Double-click on empty canvas spawns Comment at cursor
                if let Some(mouse_screen) = response.interact_pointer_pos() {
                    let canvas_pos = self.screen_to_canvas(mouse_screen, rect);
                    actions.push(CanvasAction::SpawnNodeAt {
                        type_name: "Comment".to_string(),
                        pos: [canvas_pos.x, canvas_pos.y],
                    });
                }
            }
        }

        // 5. Render Established Wires (Smooth Cubic Bezier with Flow Animation)
        for edge in &graph.edges {
            if let (Some(&p0), Some(&p3)) = (pin_positions.get(&edge.from), pin_positions.get(&edge.to)) {
                let is_cut_target = is_alt_down && hovered_wire.as_ref() == Some(edge);
                let wire_color = if is_cut_target {
                    Color32::from_rgb(239, 68, 68) // Crimson cut indicator
                } else {
                    pin_wire_color(&edge.from.name)
                };
                let is_edge_active = self.selected_node == Some(edge.from.node_id)
                    || self.selected_node == Some(edge.to.node_id)
                    || self.selected_nodes.contains(&edge.from.node_id)
                    || self.selected_nodes.contains(&edge.to.node_id)
                    || is_cut_target;

                draw_cubic_bezier_wire_animated(
                    &painter,
                    p0,
                    p3,
                    wire_color,
                    self.zoom,
                    is_edge_active,
                    anim_phase,
                );
            }
        }

        // 6. Wire Dragging & Connection Creation (Two-way Out <> In, Dashed amber preview curve)
        if let Some(ptr) = response.hover_pos() {
            // Start wire drag if clicking ANY pin (both input and output support two-way drag)
            if response.drag_started() && !is_alt_down {
                if let Some(pin_id) = hovered_pin.clone() {
                    self.wire_drag = Some(WireDragState {
                        from_pin: pin_id,
                        current_screen_pos: ptr,
                    });
                }
            }

            // Update active wire drag
            if let Some(drag) = &mut self.wire_drag {
                drag.current_screen_pos = ptr;

                if let Some(&start_pin_pos) = pin_positions.get(&drag.from_pin) {
                    // Check if hovering a valid candidate pin of opposite polarity from a different node
                    let target_pos = if let Some(target) = &hovered_pin {
                        if target.is_input != drag.from_pin.is_input && target.node_id != drag.from_pin.node_id {
                            pin_positions.get(target).copied().unwrap_or(ptr)
                        } else {
                            ptr
                        }
                    } else {
                        ptr
                    };

                    // Flow direction: Bezier always curves from output (p0) to input (p3)
                    let (p0, p3) = if !drag.from_pin.is_input {
                        (start_pin_pos, target_pos)
                    } else {
                        (target_pos, start_pin_pos)
                    };

                    draw_cubic_bezier_wire_animated(
                        &painter,
                        p0,
                        p3,
                        ACCENT_AMBER,
                        self.zoom,
                        true,
                        anim_phase,
                    );

                    // Glowing endpoint ring at cursor / target pin
                    painter.circle_filled(target_pos, 5.0 * self.zoom, ACCENT_AMBER);
                    painter.circle_stroke(target_pos, 8.0 * self.zoom, Stroke::new(1.5_f32, Color32::WHITE));
                }
            }

            // Finish wire drag on release
            if response.drag_stopped() {
                if let Some(drag) = self.wire_drag.take() {
                    let mut connected = false;
                    if let Some(target_pin) = hovered_pin.clone() {
                        if target_pin.is_input != drag.from_pin.is_input && target_pin.node_id != drag.from_pin.node_id {
                            if !drag.from_pin.is_input {
                                actions.push(CanvasAction::ConnectPins {
                                    from: drag.from_pin.clone(),
                                    to: target_pin,
                                });
                            } else {
                                actions.push(CanvasAction::ConnectPins {
                                    from: target_pin,
                                    to: drag.from_pin.clone(),
                                });
                            }
                            connected = true;
                        }
                    }

                    // Wire drop into empty canvas: open search palette to auto-wire!
                    if !connected && hovered_pin.is_none() && clicked_node.is_none() && !is_over_splash {
                        let canvas_pos = self.screen_to_canvas(ptr, rect);
                        actions.push(CanvasAction::OpenSearchPaletteAt {
                            screen_pos: ptr,
                            canvas_pos: [canvas_pos.x, canvas_pos.y],
                            source_pin: Some(drag.from_pin),
                        });
                    }
                }
            }
        }

        // Drag & Drop payload preview and drop from Node Library
        if egui::DragAndDrop::has_payload_of_type::<String>(ui.ctx()) {
            if let Some(mouse_screen) = response.hover_pos() {
                if let Some(payload) = egui::DragAndDrop::payload::<String>(ui.ctx()) {
                    let ghost_w = 170.0 * self.zoom;
                    let ghost_h = 42.0 * self.zoom;
                    let ghost_rect = Rect::from_center_size(mouse_screen, Vec2::new(ghost_w, ghost_h));
                    painter.rect_filled(ghost_rect, 6.0, Color32::from_rgba_premultiplied(30, 36, 44, 220));
                    painter.rect_stroke(ghost_rect, 6.0, Stroke::new(1.5_f32, ACCENT_AMBER), StrokeKind::Inside);
                    painter.text(
                        ghost_rect.center(),
                        egui::Align2::CENTER_CENTER,
                        format!("+ Drop {}", payload),
                        egui::FontId::proportional((12.0 * self.zoom).clamp(10.0, 14.0)),
                        TEXT_PRIMARY,
                    );
                }

                if ui.input(|i| i.pointer.any_released()) {
                    if let Some(payload) = egui::DragAndDrop::take_payload::<String>(ui.ctx()) {
                        let canvas_pos = self.screen_to_canvas(mouse_screen, rect);
                        actions.push(CanvasAction::SpawnNodeAt {
                            type_name: (*payload).clone(),
                            pos: [canvas_pos.x - 85.0, canvas_pos.y - 20.0],
                        });
                    }
                }
            }
        }

        // Right click tap on empty canvas opens quick search palette at cursor
        if response.secondary_clicked() && hovered_pin.is_none() && clicked_node.is_none() && !is_over_splash {
            if let Some(mouse_screen) = response.interact_pointer_pos() {
                let canvas_pos = self.screen_to_canvas(mouse_screen, rect);
                actions.push(CanvasAction::OpenSearchPaletteAt {
                    screen_pos: mouse_screen,
                    canvas_pos: [canvas_pos.x, canvas_pos.y],
                    source_pin: None,
                });
            }
        }

        // Auto-Layout on 'Ctrl + F' (auto-framing feature completely removed)
        if ui.input(|i| i.key_pressed(Key::F)) && !ui.memory(|m| m.focused().is_some()) {
            let is_ctrl = ui.input(|i| i.modifiers.ctrl || i.modifiers.command);
            if is_ctrl {
                actions.push(CanvasAction::AutoLayout);
            }
        }

        // Delete key removes selected node(s) (suppressed when typing or text field focused)
        if ui.input(|i| i.key_pressed(Key::Delete))
            && !ui.ctx().wants_keyboard_input()
            && !ui.memory(|m| m.focused().is_some())
        {
            if !self.selected_nodes.is_empty() {
                actions.push(CanvasAction::DeleteSelected);
            } else if let Some(sel) = self.selected_node {
                actions.push(CanvasAction::DeleteNode(sel));
            }
        }

        // 6.5 Render "Start" Splash Card if graph is empty
        if is_splash_visible {
            self.render_start_splash(&painter, &response, card_rect, &mut actions);
        }

        // 7. Sleek Floating Canvas HUD (Bottom Left Pill Badge)
        let hud_rect = Rect::from_min_size(
            rect.left_bottom() + Vec2::new(16.0, -36.0),
            Vec2::new(260.0, 24.0),
        );
        painter.rect_filled(hud_rect, 12.0, Color32::from_black_alpha(160));
        painter.rect_stroke(hud_rect, 12.0, Stroke::new(1.0_f32, BORDER_DARK), StrokeKind::Inside);

        let hud_text = format!(
            "Zoom {:.0}%  •  {} Nodes  •  {} Wires",
            self.zoom * 100.0,
            graph.nodes.len(),
            graph.edges.len(),
        );
        painter.text(
            hud_rect.center(),
            egui::Align2::CENTER_CENTER,
            hud_text,
            egui::FontId::proportional(11.0),
            TEXT_SECONDARY,
        );

        // 8. Auto-Layout Floating Action Button (Zero-Emoji, sleek tactile charcoal pill with amber hover)
        let layout_btn_rect = Rect::from_min_size(
            rect.right_bottom() + Vec2::new(-164.0, -36.0),
            Vec2::new(148.0, 24.0),
        );
        let layout_hovered = if let Some(ptr) = response.hover_pos() {
            layout_btn_rect.contains(ptr)
        } else {
            false
        };
        let layout_bg = if layout_hovered {
            Color32::from_rgba_premultiplied(48, 56, 68, 240)
        } else {
            Color32::from_black_alpha(170)
        };
        let layout_stroke_col = if layout_hovered {
            ACCENT_AMBER
        } else {
            BORDER_DARK
        };
        painter.rect_filled(layout_btn_rect, 12.0, layout_bg);
        painter.rect_stroke(layout_btn_rect, 12.0, Stroke::new(1.0_f32, layout_stroke_col), StrokeKind::Inside);
        painter.text(
            layout_btn_rect.center(),
            egui::Align2::CENTER_CENTER,
            "Auto Layout (Ctrl+F)",
            egui::FontId::proportional(11.0),
            if layout_hovered { TEXT_PRIMARY } else { TEXT_SECONDARY },
        );

        if layout_hovered && response.clicked() {
            actions.push(CanvasAction::AutoLayout);
        }

        actions
    }

    /// Renders the centered "Start" splash card when the graph is empty, providing immediate 1-click starter template access.
    fn render_start_splash(
        &mut self,
        painter: &Painter,
        response: &egui::Response,
        card_rect: Rect,
        actions: &mut Vec<CanvasAction>,
    ) {
        // Card Background & Border
        painter.rect_filled(card_rect, 8.0, BG_CARD);
        painter.rect_stroke(card_rect, 8.0, Stroke::new(1.0_f32, BORDER_DARK), StrokeKind::Inside);

        // Signature Top Amber Bar
        let top_bar = Rect::from_min_size(card_rect.min, Vec2::new(card_rect.width(), 3.0));
        painter.rect_filled(top_bar, 8.0, ACCENT_AMBER);

        // Header Title
        let title_pos = card_rect.min + Vec2::new(20.0, 18.0);
        painter.text(
            title_pos,
            egui::Align2::LEFT_TOP,
            "Starter Templates",
            egui::FontId::proportional(16.0),
            TEXT_PRIMARY,
        );

        // Header Subtitle with automatic text wrapping
        let subtitle_pos = title_pos + Vec2::new(0.0, 22.0);
        let sub_max_w = (card_rect.width() - 40.0 - 76.0).max(120.0);
        let sub_galley = painter.layout(
            "Choose a pre-built workflow graph to begin, or start blank.".to_string(),
            egui::FontId::proportional(11.5),
            TEXT_SECONDARY,
            sub_max_w,
        );
        painter.galley(subtitle_pos, sub_galley, TEXT_SECONDARY);

        // Dismiss button in header
        let dismiss_rect = Rect::from_min_size(
            Pos2::new(card_rect.max.x - 76.0, card_rect.min.y + 16.0),
            Vec2::new(60.0, 22.0),
        );
        let dismiss_hovered = response.hover_pos().is_some_and(|p| dismiss_rect.contains(p));
        let dismiss_bg = if dismiss_hovered {
            Color32::from_rgba_premultiplied(48, 56, 68, 240)
        } else {
            Color32::from_black_alpha(140)
        };
        painter.rect_filled(dismiss_rect, 4.0, dismiss_bg);
        painter.rect_stroke(
            dismiss_rect,
            4.0,
            Stroke::new(1.0_f32, if dismiss_hovered { ACCENT_AMBER } else { BORDER_DARK }),
            StrokeKind::Inside,
        );
        painter.text(
            dismiss_rect.center(),
            egui::Align2::CENTER_CENTER,
            "Dismiss",
            egui::FontId::proportional(11.0),
            if dismiss_hovered { TEXT_PRIMARY } else { TEXT_SECONDARY },
        );
        if dismiss_hovered && response.clicked() {
            self.dismiss_splash = true;
        }

        // Templates List (Blank Canvas, Pack Texture, Unpack Texture)
        let start_y = card_rect.min.y + 60.0;
        let templates = crate::templates::builtin_templates();
        for (i, template) in templates.iter().enumerate() {
            let item_h = 56.0_f32;
            let item_gap = 8.0_f32;
            let item_rect = Rect::from_min_size(
                Pos2::new(card_rect.min.x + 16.0, start_y + i as f32 * (item_h + item_gap)),
                Vec2::new(card_rect.width() - 32.0, item_h),
            );
            let item_hovered = response.hover_pos().is_some_and(|p| item_rect.contains(p));

            let item_bg = if item_hovered {
                BG_CARD_SELECTED
            } else {
                BG_INSET
            };
            let item_stroke_col = if item_hovered {
                ACCENT_AMBER
            } else {
                BORDER_DARK
            };

            painter.rect_filled(item_rect, 6.0, item_bg);
            painter.rect_stroke(item_rect, 6.0, Stroke::new(1.0_f32, item_stroke_col), StrokeKind::Inside);

            // Badge Pill
            let (badge_text, badge_color) = match template.name {
                "Blank Canvas" => ("BLANK", CAT_UTILITY),
                "Pack Texture" => ("PACK", CAT_BLEND),
                "Unpack Texture" => ("UNPACK", CAT_TRANSFORM),
                _ => ("GRAPH", CAT_UTILITY),
            };

            let badge_rect = Rect::from_min_size(
                Pos2::new(item_rect.min.x + 10.0, item_rect.min.y + 17.0),
                Vec2::new(56.0, 22.0),
            );
            painter.rect_filled(
                badge_rect,
                4.0,
                Color32::from_rgba_premultiplied(badge_color.r() / 4, badge_color.g() / 4, badge_color.b() / 4, 160),
            );
            painter.rect_stroke(badge_rect, 4.0, Stroke::new(1.0_f32, badge_color), StrokeKind::Inside);
            painter.text(
                badge_rect.center(),
                egui::Align2::CENTER_CENTER,
                badge_text,
                egui::FontId::proportional(10.0),
                badge_color,
            );

            // Template Name
            painter.text(
                Pos2::new(item_rect.min.x + 74.0, item_rect.min.y + 8.0),
                egui::Align2::LEFT_TOP,
                template.name,
                egui::FontId::proportional(12.5),
                TEXT_PRIMARY,
            );

            // Template Description with strict automatic word-wrapping
            let desc_wrap_w = (item_rect.width() - 74.0 - if item_hovered { 65.0 } else { 16.0 }).max(120.0);
            let desc_galley = painter.layout(
                template.description.to_string(),
                egui::FontId::proportional(10.5),
                if item_hovered { TEXT_SECONDARY } else { TEXT_MUTED },
                desc_wrap_w,
            );
            painter.galley(
                Pos2::new(item_rect.min.x + 74.0, item_rect.min.y + 25.0),
                desc_galley,
                if item_hovered { TEXT_SECONDARY } else { TEXT_MUTED },
            );

            // Right action indicator
            if item_hovered {
                painter.text(
                    Pos2::new(item_rect.max.x - 14.0, item_rect.center().y),
                    egui::Align2::RIGHT_CENTER,
                    "Open →",
                    egui::FontId::proportional(11.0),
                    ACCENT_AMBER,
                );
            }

            if item_hovered && response.clicked() {
                actions.push(CanvasAction::LoadTemplate(template.name.to_string()));
                if template.name == "Blank Canvas" {
                    self.dismiss_splash = true;
                }
            }
        }

        // Footer Tip
        let footer_pos = Pos2::new(card_rect.center().x, card_rect.max.y - 10.0);
        painter.text(
            footer_pos,
            egui::Align2::CENTER_BOTTOM,
            "Drag & drop textures from Explorer directly onto the canvas  •  Press Tab for Quick Search",
            egui::FontId::proportional(10.5),
            TEXT_MUTED,
        );
    }
}

/// Draws clean dot grid matching React Flow / modern DCC standards.
fn draw_background_grid(painter: &Painter, rect: Rect, pan: Vec2, zoom: f32) {
    painter.rect_filled(rect, 0.0, BG_CANVAS);

    let step = (24.0 * zoom).max(12.0);

    let offset_x = (pan.x % step + step) % step;
    let offset_y = (pan.y % step + step) % step;

    let start_x = rect.min.x + offset_x;
    let start_y = rect.min.y + offset_y;

    let mut x = start_x;
    while x <= rect.max.x {
        let world_x = (x - rect.min.x - pan.x) / zoom;
        let is_major_x = (world_x / 120.0).round() * 120.0;
        let near_major_x = (world_x - is_major_x).abs() < 2.0;

        let mut y = start_y;
        while y <= rect.max.y {
            let world_y = (y - rect.min.y - pan.y) / zoom;
            let is_major_y = (world_y / 120.0).round() * 120.0;
            let near_major_y = (world_y - is_major_y).abs() < 2.0;

            let (dot_color, radius) = if near_major_x && near_major_y {
                (GRID_DOT_MAJOR, (1.6 * zoom).clamp(1.2, 2.2))
            } else {
                (GRID_DOT, (1.0 * zoom).clamp(0.7, 1.4))
            };

            painter.circle_filled(Pos2::new(x, y), radius, dot_color);
            y += step;
        }
        x += step;
    }

    // Origin Axes crosshair (very subtle)
    let origin_screen = rect.min + pan;
    if rect.x_range().contains(origin_screen.x) {
        painter.line_segment(
            [Pos2::new(origin_screen.x, rect.min.y), Pos2::new(origin_screen.x, rect.max.y)],
            Stroke::new(1.0_f32, GRID_AXIS),
        );
    }
    if rect.y_range().contains(origin_screen.y) {
        painter.line_segment(
            [Pos2::new(rect.min.x, origin_screen.y), Pos2::new(rect.max.x, origin_screen.y)],
            Stroke::new(1.0_f32, GRID_AXIS),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canvas_coordinate_roundtrip() {
        let mut canvas = CanvasState::new();
        canvas.pan = Vec2::new(150.0, 75.0);
        canvas.zoom = 1.25;

        let canvas_rect = Rect::from_min_size(Pos2::new(50.0, 50.0), Vec2::new(800.0, 600.0));
        let original_world = Pos2::new(240.0, 180.0);

        let screen_pt = canvas.canvas_to_screen(original_world, canvas_rect);
        let back_world = canvas.screen_to_canvas(screen_pt, canvas_rect);

        assert!((original_world.x - back_world.x).abs() < 0.001);
        assert!((original_world.y - back_world.y).abs() < 0.001);
    }

    #[test]
    fn test_unreal_action_variants() {
        let p1 = PinId::output(NodeId(1), "output");
        let act_sever = CanvasAction::DisconnectPin(p1);
        let act_spawn = CanvasAction::SpawnNodeAt {
            type_name: "ConstantColor".to_string(),
            pos: [200.0, 300.0],
        };
        let act_focus = CanvasAction::FrameFocus;
        let act_layout = CanvasAction::AutoLayout;
        let act_template = CanvasAction::LoadTemplate("Pack Texture".to_string());
        let act_split = CanvasAction::SplitWireWithReroute {
            edge: Edge {
                from: PinId::output(NodeId(1), "output"),
                to: PinId::input(NodeId(2), "input"),
            },
            pos: [150.0, 150.0],
        };
        let act_multi_sel = CanvasAction::SelectNodes(vec![NodeId(1), NodeId(2)]);

        assert_ne!(act_sever, act_focus);
        assert_ne!(act_spawn, act_focus);
        assert_ne!(act_layout, act_focus);
        assert_ne!(act_template, act_focus);
        assert_ne!(act_split, act_focus);
        assert_ne!(act_multi_sel, act_focus);
    }

    #[test]
    fn test_canvas_find_node_at_screen_and_world_pos() {
        let mut canvas = CanvasState::new();
        let mut graph = Graph::new();
        let n1_id = NodeId(1);
        let n1 = Node::new(n1_id, "TextureInput", "Albedo", [100.0, 100.0]);
        graph.add_node(n1);

        // Test canvas coordinate query
        let hit = canvas.find_node_at_canvas_pos(Pos2::new(150.0, 150.0), &graph);
        assert_eq!(hit, Some(n1_id));

        let miss = canvas.find_node_at_canvas_pos(Pos2::new(500.0, 500.0), &graph);
        assert_eq!(miss, None);

        // Test screen coordinate cache query
        canvas.rendered_node_rects.push((n1_id, Rect::from_min_size(Pos2::new(200.0, 200.0), Vec2::new(260.0, 180.0))));
        assert_eq!(canvas.find_node_at_screen_pos(Pos2::new(250.0, 250.0)), Some(n1_id));
        assert_eq!(canvas.find_node_at_screen_pos(Pos2::new(50.0, 50.0)), None);
    }
}
