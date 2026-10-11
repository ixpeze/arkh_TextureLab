//! Infinite Node Canvas with Cubic Bezier Wires & LOD Zoom (React/xyflow DCC Style).
//!
//! Provides smooth 60+ FPS pan/zoom, React Flow dot grid, semantic Bezier wire rendering
//! with animated data flow, socket hit-testing & hover glow, 3-level LOD cards with
//! 2.5px category accent bars, and marquee box selection.

use egui::{
    epaint::CubicBezierShape, Color32, Key, Painter, Pos2, Rect, Sense, Stroke,
    StrokeKind, Ui, Vec2,
};
use crate::graph::model::{Edge, Graph, Node, NodeId, PinId};
use crate::nodes::NodeCategory;
use crate::ui::theme::{
    category_color, pin_wire_color, ACCENT_AMBER, ACCENT_GLOW,
    BG_CANVAS, BG_CARD, BG_CARD_SELECTED, BG_HEADER, BORDER_DARK, GRID_AXIS, GRID_DOT,
    GRID_DOT_MAJOR, HAIRLINE_ROW_GRAY, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY,
};

/// Level-of-Detail (LOD) render mode based on canvas zoom factor.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NodeLod {
    /// Full parameter and socket cards (zoom > 0.6).
    Full,
    /// Compact card with socket dots and title bar (0.35 <= zoom <= 0.6).
    Compact,
    /// Solid category colored block (zoom < 0.35).
    Block,
}

impl NodeLod {
    pub fn from_zoom(zoom: f32) -> Self {
        if zoom > 0.6 {
            Self::Full
        } else if zoom >= 0.35 {
            Self::Compact
        } else {
            Self::Block
        }
    }
}

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
    NodeMoved { node_id: NodeId, new_pos: [f32; 2] },
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
    box_select_start: Option<Pos2>,
    box_select_current: Option<Pos2>,
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
            box_select_start: None,
            box_select_current: None,
        }
    }
}

/// Dynamically calculates node card width based on title, custom label, and socket name metrics.
pub fn calculate_node_width(node: &Node) -> f32 {
    let title_len = node.node_type.len();
    let label_len = if !node.label.is_empty() && node.label != node.node_type {
        node.label.len()
    } else {
        0
    };
    let max_in_len = node.inputs.iter().map(|p| p.name.len()).max().unwrap_or(0);
    let max_out_len = node.outputs.iter().map(|p| p.name.len()).max().unwrap_or(0);

    let content_len = (title_len.max(label_len)).max(max_in_len + max_out_len);
    (180.0 + (content_len as f32 * 3.5)).clamp(200.0, 280.0)
}

impl CanvasState {
    pub fn new() -> Self {
        Self::default()
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
        let painter = ui.painter_at(rect);

        // Continuous repaint for smooth wire flow animations when wires are active
        let anim_phase = (ui.input(|i| i.time) * 1.5) as f32;
        if self.selected_node.is_some() || self.wire_drag.is_some() {
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
                let screen_pos = self.canvas_to_screen(Pos2::new(node.position[0], node.position[1]), rect);
                let width = calculate_node_width(node) * self.zoom;
                let header_height = 28.0 * self.zoom;
                let socket_row_height = 22.0 * self.zoom;
                let socket_start_y = screen_pos.y + header_height + 12.0 * self.zoom;

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

        for node in graph.nodes.values_mut() {
            let is_selected = self.selected_node == Some(node.id);
            let is_viewport_locked = self.locked_viewport_node == Some(node.id);
            let screen_pos = self.canvas_to_screen(Pos2::new(node.position[0], node.position[1]), rect);

            let (node_rect, pin_coords) = render_node_card(
                &painter,
                node,
                screen_pos,
                self.zoom,
                lod,
                is_selected,
                is_viewport_locked,
                hovered_pin.as_ref(),
            );

            // Register pin screen coordinates
            for (pin_id, coord) in pin_coords {
                pin_positions.insert(pin_id, coord);
            }

            // Hit test node body
            if let Some(ptr) = response.interact_pointer_pos() {
                if node_rect.contains(ptr) && response.clicked() {
                    clicked_node = Some(node.id);
                }
            }

            // Dragging node (header bar always drags node; body drags node when not over a socket row)
            if response.drag_started() {
                if let Some(ptr) = response.interact_pointer_pos() {
                    let in_header = ptr.y <= screen_pos.y + 28.0 * self.zoom;
                    if node_rect.contains(ptr) && (in_header || hovered_pin.is_none()) {
                        self.dragging_node = Some(node.id);
                        self.drag_started_pos = Some(node.position);
                        clicked_node = Some(node.id);
                    }
                }
            }

            if self.dragging_node == Some(node.id) {
                if response.dragged_by(egui::PointerButton::Primary) && !ui.input(|i| i.key_down(Key::Space)) {
                    let delta = response.drag_delta() / self.zoom;
                    node.position[0] += delta.x;
                    node.position[1] += delta.y;
                }
            }
        }

        // Drag release
        if response.drag_stopped() {
            if let Some(node_id) = self.dragging_node.take() {
                if let Some(node) = graph.get_node(node_id) {
                    actions.push(CanvasAction::NodeMoved {
                        node_id,
                        new_pos: node.position,
                    });
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

/// Calculates the minimum Euclidean distance from a screen point to a cubic Bezier wire.
pub fn distance_to_bezier_wire(pt: Pos2, p0: Pos2, p3: Pos2, zoom: f32) -> f32 {
    let dx = (p3.x - p0.x).abs().max(40.0 * zoom);
    let p1 = p0 + Vec2::new(dx * 0.45, 0.0);
    let p2 = p3 - Vec2::new(dx * 0.45, 0.0);

    let mut min_dist_sq = f32::MAX;
    let steps = 16;
    for i in 0..=steps {
        let t = i as f32 / steps as f32;
        let one_minus_t = 1.0 - t;
        let p = p0 * (one_minus_t * one_minus_t * one_minus_t)
            + p1.to_vec2() * (3.0 * one_minus_t * one_minus_t * t)
            + p2.to_vec2() * (3.0 * one_minus_t * t * t)
            + p3.to_vec2() * (t * t * t);
        let dist_sq = (pt - p).length_sq();
        if dist_sq < min_dist_sq {
            min_dist_sq = dist_sq;
        }
    }
    min_dist_sq.sqrt()
}

/// Renders a smooth cubic Bezier curve wire between socket centers (backward-compatible).
pub fn draw_cubic_bezier_wire(
    painter: &Painter,
    p0: Pos2,
    p3: Pos2,
    color: Color32,
    zoom: f32,
    is_active: bool,
) {
    draw_cubic_bezier_wire_animated(painter, p0, p3, color, zoom, is_active, 0.0);
}

/// Renders a smooth cubic Bezier wire with amber highlight, outer glow, and traveling data pulse.
pub fn draw_cubic_bezier_wire_animated(
    painter: &Painter,
    p0: Pos2,
    p3: Pos2,
    color: Color32,
    zoom: f32,
    is_active: bool,
    anim_phase: f32,
) {
    let dx = (p3.x - p0.x).abs().max(40.0 * zoom);
    let p1 = p0 + Vec2::new(dx * 0.45, 0.0);
    let p2 = p3 - Vec2::new(dx * 0.45, 0.0);

    let (stroke_width, wire_color) = if is_active {
        (2.6 * zoom.clamp(0.7, 1.3), ACCENT_AMBER)
    } else {
        (1.8 * zoom.clamp(0.6, 1.1), color)
    };

    // Ambient golden glow for active wire
    if is_active {
        let glow_stroke = Stroke::new(6.0 * zoom, Color32::from_rgba_premultiplied(255, 176, 46, 35));
        let glow_shape = CubicBezierShape::from_points_stroke(
            [p0, p1, p2, p3],
            false,
            Color32::TRANSPARENT,
            glow_stroke,
        );
        painter.add(glow_shape);
    }

    // Main anti-aliased wire
    let wire_stroke = Stroke::new(stroke_width, wire_color);
    let shape = CubicBezierShape::from_points_stroke(
        [p0, p1, p2, p3],
        false,
        Color32::TRANSPARENT,
        wire_stroke,
    );
    painter.add(shape);

    // Directional animated pulse (marching dot along bezier curve)
    if is_active {
        let t = (anim_phase % 1.0).clamp(0.0, 1.0);
        let u = 1.0 - t;
        let pt = p0 * (u * u * u)
            + p1.to_vec2() * (3.0 * u * u * t)
            + p2.to_vec2() * (3.0 * u * t * t)
            + p3.to_vec2() * (t * t * t);
        painter.circle_filled(pt, 3.5 * zoom, Color32::WHITE);
        painter.circle_stroke(pt, 5.0 * zoom, Stroke::new(1.0_f32, ACCENT_AMBER));
    }
}

/// Renders a single node card according to active LOD level (React/xyflow NodeCard architecture).
fn render_node_card(
    painter: &Painter,
    node: &Node,
    screen_pos: Pos2,
    zoom: f32,
    lod: NodeLod,
    is_selected: bool,
    is_viewport_locked: bool,
    hovered_pin_id: Option<&PinId>,
) -> (Rect, Vec<(PinId, Pos2)>) {
    let cat = infer_category(&node.node_type);
    let cat_col = category_color(cat);

    let mut pin_positions = Vec::new();

    match lod {
        NodeLod::Full => {
            // LOD Full: Complete parameters, category accent bar, socket names & glowing pins
            let width = calculate_node_width(node) * zoom;
            let header_height = 28.0 * zoom;
            let socket_row_height = 22.0 * zoom;
            let max_sockets = node.inputs.len().max(node.outputs.len()).max(1);
            let body_height = (max_sockets as f32 * socket_row_height) + 16.0 * zoom;
            let total_height = header_height + body_height;

            let rect = Rect::from_min_size(screen_pos, Vec2::new(width, total_height));
            let corner_r = 6.0 * zoom;

            // 1. Ambient Drop Shadow (Crisp Workstation Depth)
            let shadow_rect = Rect::from_min_size(screen_pos + Vec2::new(0.0, 4.0 * zoom), Vec2::new(width, total_height));
            painter.rect_filled(shadow_rect, corner_r + 2.0 * zoom, Color32::from_black_alpha(80));

            // 2. Selection Glow
            if is_selected {
                let glow_rect = rect.expand(3.0 * zoom);
                painter.rect_stroke(glow_rect, corner_r + 2.0 * zoom, Stroke::new(2.0 * zoom, ACCENT_GLOW), StrokeKind::Outside);
            }

            // 3. Precision High-Contrast Charcoal Card Base
            let bg_col = if is_selected { BG_CARD_SELECTED } else { BG_CARD };
            painter.rect_filled(rect, corner_r, bg_col);

            // 4. Raised Card Header Surface
            let r_top = egui::CornerRadius {
                nw: (corner_r as u8).min(255),
                ne: (corner_r as u8).min(255),
                sw: 0,
                se: 0,
            };
            let header_rect = Rect::from_min_size(screen_pos, Vec2::new(width, header_height));
            painter.rect_filled(header_rect, r_top, BG_HEADER);

            // 5. 3.5px Prominent Top Category Accent Bar
            let cat_bar_h = (3.5 * zoom).max(2.5);
            let cat_bar_rect = Rect::from_min_size(screen_pos, Vec2::new(width, cat_bar_h));
            painter.rect_filled(cat_bar_rect, r_top, cat_col);

            // Header Bottom Separator Line
            painter.line_segment(
                [header_rect.left_bottom(), header_rect.right_bottom()],
                Stroke::new(1.0_f32, BORDER_DARK),
            );

            // Header Category Dot Indicator
            let cat_dot_center = Pos2::new(screen_pos.x + 12.0 * zoom, header_rect.center().y + 1.0 * zoom);
            painter.circle_filled(cat_dot_center, 3.5 * zoom, cat_col);

            // Header Title
            let title_pos = Pos2::new(screen_pos.x + 22.0 * zoom, header_rect.center().y + 1.0 * zoom);
            painter.text(
                title_pos,
                egui::Align2::LEFT_CENTER,
                &node.node_type,
                egui::FontId::proportional((12.0 * zoom).max(9.5)),
                TEXT_PRIMARY,
            );

            // Header Category Badge (Tactile Pill Chip)
            let badge_text = match cat {
                NodeCategory::Io => "IO",
                NodeCategory::Constants => "CONST",
                NodeCategory::ChannelOps => "PACK",
                NodeCategory::ColorAdjust => "ADJUST",
                NodeCategory::NormalOps => "NRM",
                NodeCategory::BlendOps => "BLEND",
                NodeCategory::Math => "MATH",
                NodeCategory::Transform => "XFORM",
            };
            let badge_center_y = header_rect.center().y + 1.0 * zoom;
            let badge_w = 42.0 * zoom;
            let badge_h = 16.0 * zoom;
            let badge_rect = Rect::from_center_size(
                Pos2::new(screen_pos.x + width - (badge_w * 0.5 + 8.0 * zoom), badge_center_y),
                Vec2::new(badge_w, badge_h),
            );
            painter.rect_filled(
                badge_rect,
                3.0 * zoom,
                Color32::from_rgba_premultiplied(cat_col.r() / 4, cat_col.g() / 4, cat_col.b() / 4, 180),
            );
            painter.rect_stroke(badge_rect, 3.0 * zoom, Stroke::new(1.0 * zoom, cat_col), StrokeKind::Inside);
            painter.text(
                badge_rect.center(),
                egui::Align2::CENTER_CENTER,
                badge_text,
                egui::FontId::proportional((9.0 * zoom).max(7.5)),
                Color32::WHITE,
            );

            // Header Viewport Lock Pin Badge
            if is_viewport_locked {
                let lock_badge_center = Pos2::new(badge_rect.left() - 12.0 * zoom, badge_center_y);
                painter.circle_filled(lock_badge_center, 5.5 * zoom, Color32::from_rgba_premultiplied(255, 176, 46, 50));
                painter.circle_stroke(lock_badge_center, 5.5 * zoom, Stroke::new(1.0 * zoom, ACCENT_AMBER));
                painter.circle_filled(lock_badge_center, 2.0 * zoom, ACCENT_AMBER);
            }

            // 6. Perimeter Border Stroke
            let border_stroke = if is_selected {
                Stroke::new(2.0 * zoom.max(1.5), ACCENT_AMBER)
            } else {
                Stroke::new(1.0_f32, BORDER_DARK)
            };
            painter.rect_stroke(rect, corner_r, border_stroke, StrokeKind::Inside);

            // 6. Thin Horizontal Hairline Dividers Between Socket Rows
            let socket_start_y = screen_pos.y + header_height + 12.0 * zoom;
            let row_half_h = socket_row_height * 0.5;

            for row_idx in 0..max_sockets {
                let pin_y = socket_start_y + row_idx as f32 * socket_row_height;

                // Thin horizontal hairline (light) between distinct socket rows
                if row_idx + 1 < max_sockets {
                    let divider_y = pin_y + row_half_h;
                    painter.line_segment(
                        [
                            Pos2::new(screen_pos.x + 8.0 * zoom, divider_y),
                            Pos2::new(screen_pos.x + width - 8.0 * zoom, divider_y),
                        ],
                        Stroke::new(1.0_f32, HAIRLINE_ROW_GRAY),
                    );
                }
            }

            // 7. Inputs (Left sockets anchored on the card border)
            for (idx, pin) in node.inputs.iter().enumerate() {
                let pin_y = socket_start_y + idx as f32 * socket_row_height;
                let pin_x = screen_pos.x;
                let pin_pos = Pos2::new(pin_x, pin_y);
                pin_positions.push((pin.clone(), pin_pos));

                let is_hovered = hovered_pin_id == Some(pin);
                let pin_col = pin_wire_color(&pin.name);
                let pin_r = if is_hovered { (7.5 * zoom).clamp(6.0, 11.0) } else { (5.0 * zoom).clamp(4.0, 7.0) };

                // Glowing outer halo when hovered across horizontal section
                if is_hovered {
                    painter.circle_filled(
                        pin_pos,
                        pin_r + 4.0 * zoom,
                        Color32::from_rgba_premultiplied(pin_col.r(), pin_col.g(), pin_col.b(), 65),
                    );
                }

                // Socket background bevel
                painter.circle_filled(pin_pos, pin_r + 1.5 * zoom, BG_CARD);
                // Socket colored core
                painter.circle_filled(pin_pos, pin_r, pin_col);
                // Socket outer border ring
                let ring_col = if is_hovered { Color32::WHITE } else { BORDER_DARK };
                let ring_stroke = if is_hovered { 2.0_f32 } else { 1.2_f32 };
                painter.circle_stroke(pin_pos, pin_r, Stroke::new(ring_stroke, ring_col));

                // Pulsing white center core dot when hovered
                if is_hovered {
                    painter.circle_filled(pin_pos, 2.5 * zoom, Color32::WHITE);
                }

                // Input label text
                painter.text(
                    pin_pos + Vec2::new(pin_r + 6.0 * zoom, 0.0),
                    egui::Align2::LEFT_CENTER,
                    &pin.name,
                    egui::FontId::proportional((10.5 * zoom).max(8.5)),
                    if is_hovered { TEXT_PRIMARY } else { TEXT_SECONDARY },
                );
            }

            // Outputs (Right sockets anchored on the card border)
            for (idx, pin) in node.outputs.iter().enumerate() {
                let pin_y = socket_start_y + idx as f32 * socket_row_height;
                let pin_x = screen_pos.x + width;
                let pin_pos = Pos2::new(pin_x, pin_y);
                pin_positions.push((pin.clone(), pin_pos));

                let is_hovered = hovered_pin_id == Some(pin);
                let pin_col = pin_wire_color(&pin.name);
                let pin_r = if is_hovered { (7.5 * zoom).clamp(6.0, 11.0) } else { (5.0 * zoom).clamp(4.0, 7.0) };

                // Glowing outer halo when hovered across horizontal section
                if is_hovered {
                    painter.circle_filled(
                        pin_pos,
                        pin_r + 4.0 * zoom,
                        Color32::from_rgba_premultiplied(pin_col.r(), pin_col.g(), pin_col.b(), 65),
                    );
                }

                // Socket background bevel
                painter.circle_filled(pin_pos, pin_r + 1.5 * zoom, BG_CARD);
                // Socket colored core
                painter.circle_filled(pin_pos, pin_r, pin_col);
                // Socket outer border ring
                let ring_col = if is_hovered { Color32::WHITE } else { BORDER_DARK };
                let ring_stroke = if is_hovered { 2.0_f32 } else { 1.2_f32 };
                painter.circle_stroke(pin_pos, pin_r, Stroke::new(ring_stroke, ring_col));

                // Pulsing white center core dot when hovered
                if is_hovered {
                    painter.circle_filled(pin_pos, 2.5 * zoom, Color32::WHITE);
                }

                // Output label text
                painter.text(
                    pin_pos - Vec2::new(pin_r + 6.0 * zoom, 0.0),
                    egui::Align2::RIGHT_CENTER,
                    &pin.name,
                    egui::FontId::proportional((10.5 * zoom).max(8.5)),
                    if is_hovered { TEXT_PRIMARY } else { TEXT_SECONDARY },
                );
            }

            // 7. Bottom Label
            if !node.label.is_empty() && node.label != node.node_type {
                painter.text(
                    Pos2::new(screen_pos.x + 10.0 * zoom, rect.max.y - 7.0 * zoom),
                    egui::Align2::LEFT_BOTTOM,
                    &node.label,
                    egui::FontId::proportional((10.0 * zoom).max(8.0)),
                    TEXT_MUTED,
                );
            }

            (rect, pin_positions)
        }

        NodeLod::Compact => {
            // LOD Compact: Scaled down card with category bar, title, and pin dots
            let width = (calculate_node_width(node) * 0.75 * zoom).max(130.0 * zoom);
            let height = 48.0 * zoom;
            let rect = Rect::from_min_size(screen_pos, Vec2::new(width, height));
            let corner_r = 4.0 * zoom;

            // Ambient Drop Shadow
            let shadow_rect = Rect::from_min_size(screen_pos + Vec2::new(0.0, 3.0 * zoom), Vec2::new(width, height));
            painter.rect_filled(shadow_rect, corner_r + 1.0 * zoom, Color32::from_black_alpha(70));

            let bg_col = if is_selected { BG_CARD_SELECTED } else { BG_CARD };
            painter.rect_filled(rect, corner_r, bg_col);

            // 3.0px Category Bar with rounded top corners
            let r_top = egui::CornerRadius {
                nw: (corner_r as u8).min(255),
                ne: (corner_r as u8).min(255),
                sw: 0,
                se: 0,
            };
            let bar_rect = Rect::from_min_size(screen_pos, Vec2::new(width, (3.0 * zoom).max(2.0)));
            painter.rect_filled(bar_rect, r_top, cat_col);

            // Perimeter Border
            painter.rect_stroke(
                rect,
                corner_r,
                if is_selected {
                    Stroke::new(1.8_f32, ACCENT_AMBER)
                } else {
                    Stroke::new(1.0_f32, BORDER_DARK)
                },
                StrokeKind::Inside,
            );

            // Centered Title
            painter.text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                &node.node_type,
                egui::FontId::proportional((11.0 * zoom).max(8.5)),
                TEXT_PRIMARY,
            );

            // Input Pin Dots
            let in_count = node.inputs.len();
            for (i, pin) in node.inputs.iter().enumerate() {
                let frac = (i + 1) as f32 / (in_count + 1) as f32;
                let pin_pos = Pos2::new(screen_pos.x, screen_pos.y + height * frac);
                pin_positions.push((pin.clone(), pin_pos));

                let is_hovered = hovered_pin_id == Some(pin);
                let pin_r = if is_hovered { 5.5 * zoom } else { 3.5 * zoom };
                if is_hovered {
                    painter.circle_filled(pin_pos, pin_r + 2.5 * zoom, Color32::from_rgba_premultiplied(255, 176, 46, 70));
                }
                painter.circle_filled(pin_pos, pin_r, pin_wire_color(&pin.name));
                if is_hovered {
                    painter.circle_stroke(pin_pos, pin_r, Stroke::new(1.5_f32, Color32::WHITE));
                }
            }

            // Output Pin Dots
            let out_count = node.outputs.len();
            for (i, pin) in node.outputs.iter().enumerate() {
                let frac = (i + 1) as f32 / (out_count + 1) as f32;
                let pin_pos = Pos2::new(screen_pos.x + width, screen_pos.y + height * frac);
                pin_positions.push((pin.clone(), pin_pos));

                let is_hovered = hovered_pin_id == Some(pin);
                let pin_r = if is_hovered { 5.5 * zoom } else { 3.5 * zoom };
                if is_hovered {
                    painter.circle_filled(pin_pos, pin_r + 2.5 * zoom, Color32::from_rgba_premultiplied(255, 176, 46, 70));
                }
                painter.circle_filled(pin_pos, pin_r, pin_wire_color(&pin.name));
                if is_hovered {
                    painter.circle_stroke(pin_pos, pin_r, Stroke::new(1.5_f32, Color32::WHITE));
                }
            }

            (rect, pin_positions)
        }

        NodeLod::Block => {
            // LOD Block: Solid category colored mini card for extreme zoom
            let width = 75.0 * zoom;
            let height = 32.0 * zoom;
            let rect = Rect::from_min_size(screen_pos, Vec2::new(width, height));

            painter.rect_filled(rect, 3.0 * zoom, cat_col);
            if is_selected {
                painter.rect_stroke(rect, 3.0 * zoom, Stroke::new(1.8_f32, ACCENT_AMBER), StrokeKind::Inside);
            }

            let in_pos = Pos2::new(screen_pos.x, screen_pos.y + height * 0.5);
            for pin in &node.inputs {
                pin_positions.push((pin.clone(), in_pos));
            }

            let out_pos = Pos2::new(screen_pos.x + width, screen_pos.y + height * 0.5);
            for pin in &node.outputs {
                pin_positions.push((pin.clone(), out_pos));
            }

            (rect, pin_positions)
        }
    }
}

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
    fn test_node_lod_determination() {
        assert_eq!(NodeLod::from_zoom(1.0), NodeLod::Full);
        assert_eq!(NodeLod::from_zoom(0.7), NodeLod::Full);
        assert_eq!(NodeLod::from_zoom(0.6), NodeLod::Compact);
        assert_eq!(NodeLod::from_zoom(0.4), NodeLod::Compact);
        assert_eq!(NodeLod::from_zoom(0.35), NodeLod::Compact);
        assert_eq!(NodeLod::from_zoom(0.34), NodeLod::Block);
        assert_eq!(NodeLod::from_zoom(0.15), NodeLod::Block);
    }

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
    fn test_semantic_wire_colors() {
        assert_eq!(pin_wire_color("R"), Color32::from_rgb(239, 68, 68));
        assert_eq!(pin_wire_color("G"), Color32::from_rgb(34, 197, 94));
        assert_eq!(pin_wire_color("B"), Color32::from_rgb(59, 130, 246));
        assert_eq!(pin_wire_color("A"), Color32::from_rgb(148, 163, 184));
        assert_eq!(pin_wire_color("RGBA"), Color32::from_rgb(248, 250, 252));
    }

    #[test]
    fn test_distance_to_bezier_wire() {
        let p0 = Pos2::new(100.0, 100.0);
        let p3 = Pos2::new(300.0, 100.0);
        let zoom = 1.0;

        // Exactly on start
        let dist_start = distance_to_bezier_wire(p0, p0, p3, zoom);
        assert!(dist_start < 1.0);

        // Exactly on end
        let dist_end = distance_to_bezier_wire(p3, p0, p3, zoom);
        assert!(dist_end < 1.0);

        // Far away from curve
        let dist_far = distance_to_bezier_wire(Pos2::new(200.0, 500.0), p0, p3, zoom);
        assert!(dist_far > 300.0);
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

    #[test]
    fn test_calculate_node_width() {
        // Standard compact node
        let mut node_compact = Node::new(NodeId(1), "Add", "Add", [0.0, 0.0]);
        node_compact.add_input("A");
        node_compact.add_input("B");
        node_compact.add_output("Out");
        let w_compact = calculate_node_width(&node_compact);
        assert!(w_compact >= 200.0 && w_compact <= 280.0);

        // Node with lengthy custom label
        let mut node_long = Node::new(NodeId(2), "TextureInput", "TextureInput", [0.0, 0.0]);
        node_long.add_output("RGBA");
        node_long.label = "T_Cobblestone_Wall_Very_Long_Identifier_BaseColor".to_string();
        let w_long = calculate_node_width(&node_long);
        assert!(w_long > w_compact);
        assert_eq!(w_long, 280.0, "Clamped to maximum node width 280.0");
    }

    #[test]
    fn test_node_card_horizontal_hairline_dividers() {
        let mut node = Node::new(NodeId(1), "Multiply", "Multiply", [100.0, 100.0]);
        node.add_input("A");
        node.add_input("B");
        node.add_output("Out");

        let zoom = 1.0;
        let screen_pos = Pos2::new(100.0, 100.0);
        let header_height = 28.0 * zoom;
        let socket_row_height = 22.0 * zoom;
        let socket_start_y = screen_pos.y + header_height + 12.0 * zoom;
        let row_half_h = socket_row_height * 0.5;
        let max_sockets = node.inputs.len().max(node.outputs.len());
        assert_eq!(max_sockets, 2);

        // Row 0
        let pin0_y = socket_start_y;
        let row0_top = pin0_y - row_half_h;
        let row0_bottom = pin0_y + row_half_h;
        assert_eq!(row0_top, screen_pos.y + 29.0);
        assert_eq!(row0_bottom, screen_pos.y + 51.0);

        // Row 1
        let pin1_y = socket_start_y + socket_row_height;
        let row1_top = pin1_y - row_half_h;
        let row1_bottom = pin1_y + row_half_h;
        assert_eq!(row1_top, row0_bottom); // Rows seamlessly meet at divider line
        assert_eq!(row1_bottom, screen_pos.y + 73.0);
    }
}


