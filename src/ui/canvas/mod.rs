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
    pin_wire_color, ACCENT_AMBER, BG_CANVAS, BORDER_DARK, GRID_AXIS, GRID_DOT,
    GRID_DOT_MAJOR, TEXT_PRIMARY, TEXT_SECONDARY,
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
    ConnectPins { from: PinId, to: PinId },
    DisconnectEdge(Edge),
    DisconnectPin(PinId),
    DeleteNode(NodeId),
    DeleteSelected,
    NodeMoved {
        node_id: NodeId,
        old_pos: [f32; 2],
        new_pos: [f32; 2],
    },
    OpenSearchPalette([f32; 2]),
    SpawnNodeAt { type_name: String, pos: [f32; 2] },
    FrameFocus,
    AutoLayout,
}

/// Persistent canvas navigation and interaction state.
pub struct CanvasState {
    pub pan: Vec2,
    pub target_pan: Vec2,
    pub zoom: f32,
    pub selected_node: Option<NodeId>,
    pub locked_viewport_node: Option<NodeId>,
    pub wire_drag: Option<WireDragState>,
    dragging_node: Option<NodeId>,
    drag_started_pos: Option<[f32; 2]>,
    pub resizing_comment: Option<NodeId>,
    box_select_start: Option<Pos2>,
    box_select_current: Option<Pos2>,
    pub last_canvas_rect: Rect,
    pub clipboard: Option<(Vec<Node>, Vec<Edge>)>,
}

impl Default for CanvasState {
    fn default() -> Self {
        Self {
            pan: Vec2::new(100.0, 100.0),
            target_pan: Vec2::new(100.0, 100.0),
            zoom: 1.0,
            selected_node: None,
            locked_viewport_node: None,
            wire_drag: None,
            dragging_node: None,
            drag_started_pos: None,
            resizing_comment: None,
            box_select_start: None,
            box_select_current: None,
            last_canvas_rect: Rect::from_min_size(Pos2::ZERO, Vec2::new(1920.0, 1080.0)),
            clipboard: None,
        }
    }
}

impl CanvasState {
    pub fn new() -> Self {
        Self::default()
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
        let ids: Vec<NodeId> = self.selected_node.into_iter().collect();
        self.copy_nodes(graph, &ids)
    }

    /// Pastes clipboard contents into the graph at the specified offset and selects newly created nodes.
    pub fn paste_clipboard(&mut self, graph: &mut Graph, offset: [f32; 2]) -> Vec<NodeId> {
        if let Some((nodes, edges)) = &self.clipboard {
            let new_ids = graph.paste_subgraph(nodes.clone(), edges.clone(), offset);
            if let Some(&first) = new_ids.first() {
                self.selected_node = Some(first);
            }
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

        // Request continuous repaint only during active drag or interactive gestures to eliminate idle GPU/CPU burn
        if self.wire_drag.is_some() || self.dragging_node.is_some() || self.box_select_start.is_some() {
            ui.ctx().request_repaint();
        }

        // 1. Pan and Zoom Handling
        let is_middle_drag = response.dragged_by(egui::PointerButton::Middle);
        let is_space_drag = ui.input(|i| i.key_down(Key::Space))
            && response.dragged_by(egui::PointerButton::Primary);
        let is_secondary_drag = response.dragged_by(egui::PointerButton::Secondary);

        if is_middle_drag || is_space_drag || (is_secondary_drag && self.dragging_node.is_none()) {
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
            let is_selected = self.selected_node == Some(node.id);
            let is_viewport_locked = self.locked_viewport_node == Some(node.id);
            let screen_pos = self.canvas_to_screen(Pos2::new(node.position[0], node.position[1]), rect);

            let params = NodeCardRenderParams {
                screen_pos,
                zoom: self.zoom,
                lod,
                is_selected,
                is_viewport_locked,
                hovered_pin_id: hovered_pin.as_ref(),
            };
            let (node_rect, _) = render_node_card(&painter, node, &params);
            comment_rects.push((node.id, node_rect));
        }

        // Pass 2: Render regular and reroute nodes on top
        let mut foreground_rects = Vec::new();
        for node in graph.nodes.values_mut() {
            if node.node_type == "Comment" {
                continue;
            }
            let is_selected = self.selected_node == Some(node.id);
            let is_viewport_locked = self.locked_viewport_node == Some(node.id);
            let screen_pos = self.canvas_to_screen(Pos2::new(node.position[0], node.position[1]), rect);

            let params = NodeCardRenderParams {
                screen_pos,
                zoom: self.zoom,
                lod,
                is_selected,
                is_viewport_locked,
                hovered_pin_id: hovered_pin.as_ref(),
            };
            let (node_rect, pin_coords) = render_node_card(&painter, node, &params);

            // Register pin screen coordinates
            for (pin_id, coord) in pin_coords {
                pin_positions.insert(pin_id, coord);
            }
            foreground_rects.push((node.id, node_rect, screen_pos, node.node_type == "Reroute"));
        }

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
                if let Some(node) = graph.get_node_mut(dragged_id) {
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
                if self.box_select_start.is_none() && response.drag_started() && clicked_node.is_none() {
                    self.box_select_start = Some(ptr);
                }
                if self.box_select_start.is_some() {
                    self.box_select_current = Some(ptr);
                }
            }
        }

        if let (Some(start), Some(curr)) = (self.box_select_start, self.box_select_current) {
            let select_rect = Rect::from_two_pos(start, curr);
            painter.rect_filled(
                select_rect,
                2.0,
                Color32::from_rgba_premultiplied(255, 176, 46, 20),
            );
            painter.rect_stroke(
                select_rect,
                2.0,
                Stroke::new(1.0_f32, ACCENT_AMBER),
                StrokeKind::Inside,
            );

            // On mouse release, select nodes that fall inside the box
            if response.drag_stopped() {
                let mut newly_selected = None;
                for (id, node) in &graph.nodes {
                    let screen_pt = self.canvas_to_screen(Pos2::new(node.position[0], node.position[1]), rect);
                    if select_rect.contains(screen_pt) {
                        newly_selected = Some(*id);
                        break;
                    }
                }
                if let Some(id) = newly_selected {
                    self.selected_node = Some(id);
                    actions.push(CanvasAction::SelectNode(Some(id)));
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
        if response.clicked() && !is_alt_down && !is_space_drag {
            if let Some(id) = clicked_node {
                self.selected_node = Some(id);
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
                    actions.push(CanvasAction::SelectNode(None));
                }
            }
        }

        // Double-click on empty canvas spawns Comment at cursor (Part C)
        if response.double_clicked() && hovered_pin.is_none() && clicked_node.is_none() && hovered_wire.is_none() {
            if let Some(mouse_screen) = response.interact_pointer_pos() {
                let canvas_pos = self.screen_to_canvas(mouse_screen, rect);
                actions.push(CanvasAction::SpawnNodeAt {
                    type_name: "Comment".to_string(),
                    pos: [canvas_pos.x, canvas_pos.y],
                });
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

        // 6. Wire Dragging & Connection Creation (Dashed amber preview curve)
        if let Some(ptr) = response.hover_pos() {
            // Start wire drag if clicking an output pin
            if response.drag_started() && !is_alt_down {
                if let Some(pin_id) = hovered_pin.clone() {
                    if !pin_id.is_input {
                        self.wire_drag = Some(WireDragState {
                            from_pin: pin_id,
                            current_screen_pos: ptr,
                        });
                    }
                }
            }

            // Update active wire drag
            if let Some(drag) = &mut self.wire_drag {
                drag.current_screen_pos = ptr;

                if let Some(&p0) = pin_positions.get(&drag.from_pin) {
                    // Draw stylish connection curve to cursor or snapped pin
                    let target_pos = if let Some(target) = &hovered_pin {
                        if target.is_input && target.node_id != drag.from_pin.node_id {
                            pin_positions.get(target).copied().unwrap_or(ptr)
                        } else {
                            ptr
                        }
                    } else {
                        ptr
                    };

                    draw_cubic_bezier_wire_animated(
                        &painter,
                        p0,
                        target_pos,
                        ACCENT_AMBER,
                        self.zoom,
                        true,
                        anim_phase,
                    );

                    // Glowing endpoint ring at cursor
                    painter.circle_filled(target_pos, 5.0 * self.zoom, ACCENT_AMBER);
                    painter.circle_stroke(target_pos, 8.0 * self.zoom, Stroke::new(1.5_f32, Color32::WHITE));
                }
            }

            // Finish wire drag on release
            if response.drag_stopped() {
                if let Some(drag) = self.wire_drag.take() {
                    if let Some(target_pin) = hovered_pin.clone() {
                        if target_pin.is_input && target_pin.node_id != drag.from_pin.node_id {
                            actions.push(CanvasAction::ConnectPins {
                                from: drag.from_pin,
                                to: target_pin,
                            });
                        }
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

        // Right click tap on empty canvas opens quick search palette
        if response.secondary_clicked() && hovered_pin.is_none() && clicked_node.is_none() {
            if let Some(mouse_screen) = response.interact_pointer_pos() {
                let canvas_pos = self.screen_to_canvas(mouse_screen, rect);
                actions.push(CanvasAction::OpenSearchPalette([canvas_pos.x, canvas_pos.y]));
            }
        }

        // Auto-Layout on 'Ctrl + F' (auto-framing feature completely removed)
        if ui.input(|i| i.key_pressed(Key::F)) && !ui.memory(|m| m.focused().is_some()) {
            let is_ctrl = ui.input(|i| i.modifiers.ctrl || i.modifiers.command);
            if is_ctrl {
                actions.push(CanvasAction::AutoLayout);
            }
        }

        // Delete key removes selected node
        if ui.input(|i| i.key_pressed(Key::Delete) || i.key_pressed(Key::Backspace)) {
            if let Some(sel) = self.selected_node {
                actions.push(CanvasAction::DeleteNode(sel));
            }
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

        assert_ne!(act_sever, act_focus);
        assert_ne!(act_spawn, act_focus);
        assert_ne!(act_layout, act_focus);
    }
}
