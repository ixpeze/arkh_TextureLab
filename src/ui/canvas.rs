//! Infinite Node Canvas with Cubic Bezier Wires & LOD Zoom (Phase 5).
//!
//! Provides smooth 60+ FPS pan/zoom, minor/major tactical grid lines,
//! semantic Bezier wire rendering, socket hit-testing, and 3-level LOD cards.

use egui::{
    epaint::CubicBezierShape, Color32, Key, Painter, Pos2, Rect, Sense, Stroke,
    StrokeKind, Ui, Vec2,
};
use crate::graph::model::{Edge, Graph, Node, NodeId, PinId};
use crate::nodes::NodeCategory;
use crate::ui::theme::{
    category_color, pin_wire_color, BG_CANVAS, BG_CARD, BG_CARD_SELECTED, BORDER_DARK,
    BORDER_HIGHLIGHT, BORDER_SELECTED, GRID_AXIS, GRID_MAJOR, GRID_MINOR, TEXT_MUTED,
    TEXT_PRIMARY, TEXT_SECONDARY,
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
    DeleteNode(NodeId),
    DeleteSelected,
    NodeMoved { node_id: NodeId, new_pos: [f32; 2] },
    OpenSearchPalette([f32; 2]),
}

/// Persistent canvas navigation and interaction state.
pub struct CanvasState {
    pub pan: Vec2,
    pub zoom: f32,
    pub selected_node: Option<NodeId>,
    pub wire_drag: Option<WireDragState>,
    dragging_node: Option<NodeId>,
    drag_started_pos: Option<[f32; 2]>,
}

impl Default for CanvasState {
    fn default() -> Self {
        Self {
            pan: Vec2::new(100.0, 100.0),
            zoom: 1.0,
            selected_node: None,
            wire_drag: None,
            dragging_node: None,
            drag_started_pos: None,
        }
    }
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

    /// Smoothly frames canvas camera to center on all nodes or selected node.
    pub fn frame_focus(&mut self, graph: &Graph, canvas_size: Vec2) {
        if graph.nodes.is_empty() {
            self.pan = canvas_size * 0.5;
            self.zoom = 1.0;
            return;
        }

        let mut min_x = f32::MAX;
        let mut min_y = f32::MAX;
        let mut max_x = f32::MIN;
        let mut max_y = f32::MIN;

        let target_nodes: Vec<&Node> = if let Some(sel_id) = self.selected_node {
            graph.get_node(sel_id).into_iter().collect()
        } else {
            graph.nodes.values().collect()
        };

        if target_nodes.is_empty() {
            return;
        }

        for node in &target_nodes {
            let x = node.position[0];
            let y = node.position[1];
            min_x = min_x.min(x);
            min_y = min_y.min(y);
            max_x = max_x.max(x + 180.0);
            max_y = max_y.max(y + 120.0);
        }

        let content_w = (max_x - min_x).max(100.0);
        let content_h = (max_y - min_y).max(100.0);
        let center_content = Pos2::new((min_x + max_x) * 0.5, (min_y + max_y) * 0.5);

        let margin = 100.0;
        let zoom_x = (canvas_size.x - margin * 2.0) / content_w;
        let zoom_y = (canvas_size.y - margin * 2.0) / content_h;
        self.zoom = zoom_x.min(zoom_y).clamp(0.3, 1.5);

        let center_screen = canvas_size * 0.5;
        self.pan = center_screen - (center_content.to_vec2() * self.zoom);
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

        // 1. Pan and Zoom Handling
        let is_middle_drag = response.dragged_by(egui::PointerButton::Middle);
        let is_space_drag = ui.input(|i| i.key_down(Key::Space))
            && response.dragged_by(egui::PointerButton::Primary);
        let is_secondary_drag = response.dragged_by(egui::PointerButton::Secondary);

        if is_middle_drag || is_space_drag || (is_secondary_drag && self.dragging_node.is_none()) {
            self.pan += response.drag_delta();
        }

        // Mouse scroll zoom towards cursor
        let scroll = ui.input(|i| i.smooth_scroll_delta.y);
        if response.hovered() && scroll.abs() > 0.0 {
            if let Some(mouse_screen) = response.hover_pos() {
                let old_zoom = self.zoom;
                let factor = (scroll * 0.002).exp();
                let new_zoom = (old_zoom * factor).clamp(0.15, 3.0);

                // Invariant canvas coordinate under mouse pointer
                let mouse_canvas = (mouse_screen - rect.min - self.pan) / old_zoom;
                self.pan = mouse_screen - rect.min - mouse_canvas * new_zoom;
                self.zoom = new_zoom;
            }
        }

        // 2. Background Grid
        draw_background_grid(&painter, rect, self.pan, self.zoom);

        let lod = NodeLod::from_zoom(self.zoom);

        // Map socket pin screen positions for wire routing: PinId -> Pos2
        let mut pin_positions: std::collections::HashMap<PinId, Pos2> =
            std::collections::HashMap::new();

        // 3. Render Nodes & Collect Pin Positions
        let mut clicked_node = None;
        let mut hovered_pin = None;

        for node in graph.nodes.values_mut() {
            let is_selected = self.selected_node == Some(node.id);
            let screen_pos = self.canvas_to_screen(Pos2::new(node.position[0], node.position[1]), rect);

            let (node_rect, pin_coords) = render_node_card(
                &painter,
                node,
                screen_pos,
                self.zoom,
                lod,
                is_selected,
            );

            // Register pin screen coordinates
            for (pin_id, coord) in pin_coords {
                pin_positions.insert(pin_id.clone(), coord);

                // Hit test sockets
                if let Some(hover) = response.hover_pos() {
                    let pin_radius = (7.0 * self.zoom).max(6.0);
                    if (hover - coord).length() <= pin_radius + 4.0 {
                        hovered_pin = Some(pin_id);
                    }
                }
            }

            // Hit test node body
            if let Some(ptr) = response.interact_pointer_pos() {
                if node_rect.contains(ptr) && response.clicked() {
                    clicked_node = Some(node.id);
                }
            }

            // Dragging node
            if response.drag_started() {
                if let Some(ptr) = response.interact_pointer_pos() {
                    if node_rect.contains(ptr) && hovered_pin.is_none() {
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

        // Selection update
        if response.clicked() {
            if let Some(id) = clicked_node {
                self.selected_node = Some(id);
                actions.push(CanvasAction::SelectNode(Some(id)));
            } else if hovered_pin.is_none() && !is_space_drag {
                // Clicked on empty canvas background
                self.selected_node = None;
                actions.push(CanvasAction::SelectNode(None));
            }
        }

        // 4. Render Established Wires (Cubic Bezier)
        for edge in &graph.edges {
            if let (Some(&p0), Some(&p3)) = (pin_positions.get(&edge.from), pin_positions.get(&edge.to)) {
                let wire_color = pin_wire_color(&edge.from.name);
                let is_edge_active = self.selected_node == Some(edge.from.node_id)
                    || self.selected_node == Some(edge.to.node_id);

                draw_cubic_bezier_wire(&painter, p0, p3, wire_color, self.zoom, is_edge_active);
            }
        }

        // 5. Wire Dragging & Connection Creation
        if let Some(ptr) = response.hover_pos() {
            // Start wire drag if clicking an output pin
            if response.drag_started() {
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
                    let wire_color = pin_wire_color(&drag.from_pin.name);
                    draw_cubic_bezier_wire(&painter, p0, ptr, wire_color, self.zoom, true);
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

        // Right click on empty canvas to open search palette
        if response.secondary_clicked() && hovered_pin.is_none() && clicked_node.is_none() {
            if let Some(mouse_screen) = response.interact_pointer_pos() {
                let canvas_pos = self.screen_to_canvas(mouse_screen, rect);
                actions.push(CanvasAction::OpenSearchPalette([canvas_pos.x, canvas_pos.y]));
            }
        }

        // Delete key removes selected node
        if ui.input(|i| i.key_pressed(Key::Delete) || i.key_pressed(Key::Backspace)) {
            if let Some(sel) = self.selected_node {
                actions.push(CanvasAction::DeleteNode(sel));
            }
        }

        // Canvas HUD Info (Bottom Left)
        let hud_text = format!(
            "Zoom: {:.0}% | Nodes: {} | Edges: {} | Pan: [{:.0}, {:.0}]",
            self.zoom * 100.0,
            graph.nodes.len(),
            graph.edges.len(),
            self.pan.x,
            self.pan.y
        );
        painter.text(
            rect.left_bottom() + Vec2::new(12.0, -12.0),
            egui::Align2::LEFT_BOTTOM,
            hud_text,
            egui::FontId::monospace(11.0),
            TEXT_MUTED,
        );

        actions
    }
}

/// Draws infinite major/minor tactical grid lines with origin axes.
fn draw_background_grid(painter: &Painter, rect: Rect, pan: Vec2, zoom: f32) {
    painter.rect_filled(rect, 0.0, BG_CANVAS);

    let minor_step = 25.0 * zoom;
    let major_step = 100.0 * zoom;

    if minor_step >= 6.0 {
        // Minor grid
        let start_x = rect.min.x + (pan.x % minor_step);
        let mut x = start_x;
        while x < rect.max.x {
            painter.line_segment(
                [Pos2::new(x, rect.min.y), Pos2::new(x, rect.max.y)],
                Stroke::new(0.5_f32, GRID_MINOR),
            );
            x += minor_step;
        }

        let start_y = rect.min.y + (pan.y % minor_step);
        let mut y = start_y;
        while y < rect.max.y {
            painter.line_segment(
                [Pos2::new(rect.min.x, y), Pos2::new(rect.max.x, y)],
                Stroke::new(0.5_f32, GRID_MINOR),
            );
            y += minor_step;
        }
    }

    if major_step >= 20.0 {
        // Major grid
        let start_x = rect.min.x + (pan.x % major_step);
        let mut x = start_x;
        while x < rect.max.x {
            painter.line_segment(
                [Pos2::new(x, rect.min.y), Pos2::new(x, rect.max.y)],
                Stroke::new(1.0_f32, GRID_MAJOR),
            );
            x += major_step;
        }

        let start_y = rect.min.y + (pan.y % major_step);
        let mut y = start_y;
        while y < rect.max.y {
            painter.line_segment(
                [Pos2::new(rect.min.x, y), Pos2::new(rect.max.x, y)],
                Stroke::new(1.0_f32, GRID_MAJOR),
            );
            y += major_step;
        }
    }

    // Origin Axes
    let origin_screen = rect.min + pan;
    if rect.x_range().contains(origin_screen.x) {
        painter.line_segment(
            [Pos2::new(origin_screen.x, rect.min.y), Pos2::new(origin_screen.x, rect.max.y)],
            Stroke::new(1.5_f32, GRID_AXIS),
        );
    }
    if rect.y_range().contains(origin_screen.y) {
        painter.line_segment(
            [Pos2::new(rect.min.x, origin_screen.y), Pos2::new(rect.max.x, origin_screen.y)],
            Stroke::new(1.5_f32, GRID_AXIS),
        );
    }
}

/// Renders a smooth cubic Bezier curve wire between socket centers.
pub fn draw_cubic_bezier_wire(
    painter: &Painter,
    p0: Pos2,
    p3: Pos2,
    color: Color32,
    zoom: f32,
    is_active: bool,
) {
    let dx = (p3.x - p0.x).abs().max(40.0 * zoom);
    let p1 = p0 + Vec2::new(dx * 0.5, 0.0);
    let p2 = p3 - Vec2::new(dx * 0.5, 0.0);

    let stroke_width = if is_active {
        3.5 * zoom.clamp(0.6, 1.2)
    } else {
        2.2 * zoom.clamp(0.5, 1.0)
    };

    let wire_stroke = Stroke::new(stroke_width, color);
    let shape = CubicBezierShape::from_points_stroke(
        [p0, p1, p2, p3],
        false,
        Color32::TRANSPARENT,
        wire_stroke,
    );
    painter.add(shape);
}

/// Renders a single node card according to active LOD level.
fn render_node_card(
    painter: &Painter,
    node: &Node,
    screen_pos: Pos2,
    zoom: f32,
    lod: NodeLod,
    is_selected: bool,
) -> (Rect, Vec<(PinId, Pos2)>) {
    let cat = infer_category(&node.node_type);
    let cat_col = category_color(cat);

    let mut pin_positions = Vec::new();

    match lod {
        NodeLod::Full => {
            // LOD Full: Complete parameters, socket names & pin dots
            let width = 170.0 * zoom;
            let header_height = 24.0 * zoom;
            let socket_row_height = 20.0 * zoom;
            let max_sockets = node.inputs.len().max(node.outputs.len()).max(1);
            let body_height = (max_sockets as f32 * socket_row_height) + 16.0 * zoom;
            let total_height = header_height + body_height;

            let rect = Rect::from_min_size(screen_pos, Vec2::new(width, total_height));

            // Background & Border
            let bg_col = if is_selected { BG_CARD_SELECTED } else { BG_CARD };
            let border_stroke = if is_selected {
                Stroke::new(1.5_f32 * zoom.max(0.8), BORDER_SELECTED)
            } else {
                Stroke::new(1.0_f32, BORDER_DARK)
            };

            painter.rect_filled(rect, 4.0 * zoom, bg_col);
            painter.rect_stroke(rect, 4.0 * zoom, border_stroke, StrokeKind::Inside);

            // Category Color Bar & Header
            let header_rect = Rect::from_min_size(screen_pos, Vec2::new(width, header_height));
            painter.rect_filled(header_rect, 4.0 * zoom, cat_col);
            painter.text(
                header_rect.center(),
                egui::Align2::CENTER_CENTER,
                &node.node_type,
                egui::FontId::proportional((12.0 * zoom).max(9.0)),
                Color32::WHITE,
            );

            // Inputs (Left sockets)
            let socket_start_y = screen_pos.y + header_height + 12.0 * zoom;
            for (idx, pin) in node.inputs.iter().enumerate() {
                let pin_y = socket_start_y + idx as f32 * socket_row_height;
                let pin_x = screen_pos.x;
                let pin_pos = Pos2::new(pin_x, pin_y);
                pin_positions.push((pin.clone(), pin_pos));

                let pin_col = pin_wire_color(&pin.name);
                let pin_r = (5.0 * zoom).clamp(4.0, 7.0);
                painter.circle_filled(pin_pos, pin_r, pin_col);
                painter.circle_stroke(pin_pos, pin_r, Stroke::new(1.0_f32, BORDER_DARK));

                painter.text(
                    pin_pos + Vec2::new(pin_r + 4.0 * zoom, 0.0),
                    egui::Align2::LEFT_CENTER,
                    &pin.name,
                    egui::FontId::monospace((10.0 * zoom).max(8.0)),
                    TEXT_SECONDARY,
                );
            }

            // Outputs (Right sockets)
            for (idx, pin) in node.outputs.iter().enumerate() {
                let pin_y = socket_start_y + idx as f32 * socket_row_height;
                let pin_x = screen_pos.x + width;
                let pin_pos = Pos2::new(pin_x, pin_y);
                pin_positions.push((pin.clone(), pin_pos));

                let pin_col = pin_wire_color(&pin.name);
                let pin_r = (5.0 * zoom).clamp(4.0, 7.0);
                painter.circle_filled(pin_pos, pin_r, pin_col);
                painter.circle_stroke(pin_pos, pin_r, Stroke::new(1.0_f32, BORDER_DARK));

                painter.text(
                    pin_pos - Vec2::new(pin_r + 4.0 * zoom, 0.0),
                    egui::Align2::RIGHT_CENTER,
                    &pin.name,
                    egui::FontId::monospace((10.0 * zoom).max(8.0)),
                    TEXT_SECONDARY,
                );
            }

            // Bottom Label
            if !node.label.is_empty() && node.label != node.node_type {
                painter.text(
                    Pos2::new(screen_pos.x + 8.0 * zoom, rect.max.y - 6.0 * zoom),
                    egui::Align2::LEFT_BOTTOM,
                    &node.label,
                    egui::FontId::proportional((10.0 * zoom).max(8.0)),
                    TEXT_MUTED,
                );
            }

            (rect, pin_positions)
        }

        NodeLod::Compact => {
            // LOD Compact: Scaled down card with pin dots, labels hidden
            let width = 120.0 * zoom;
            let height = 48.0 * zoom;
            let rect = Rect::from_min_size(screen_pos, Vec2::new(width, height));

            let bg_col = if is_selected { BG_CARD_SELECTED } else { BG_CARD };
            painter.rect_filled(rect, 3.0 * zoom, bg_col);
            painter.rect_stroke(
                rect,
                3.0 * zoom,
                if is_selected {
                    Stroke::new(1.5_f32, BORDER_HIGHLIGHT)
                } else {
                    Stroke::new(1.0_f32, BORDER_DARK)
                },
                StrokeKind::Inside,
            );

            // Category Bar
            let bar_rect = Rect::from_min_size(screen_pos, Vec2::new(width, 6.0 * zoom));
            painter.rect_filled(bar_rect, 2.0 * zoom, cat_col);

            // Centered Title
            painter.text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                &node.node_type,
                egui::FontId::proportional((11.0 * zoom).max(8.0)),
                TEXT_PRIMARY,
            );

            // Input Pin Dots
            let in_count = node.inputs.len();
            for (i, pin) in node.inputs.iter().enumerate() {
                let frac = (i + 1) as f32 / (in_count + 1) as f32;
                let pin_pos = Pos2::new(screen_pos.x, screen_pos.y + height * frac);
                pin_positions.push((pin.clone(), pin_pos));
                painter.circle_filled(pin_pos, 3.5 * zoom, pin_wire_color(&pin.name));
            }

            // Output Pin Dots
            let out_count = node.outputs.len();
            for (i, pin) in node.outputs.iter().enumerate() {
                let frac = (i + 1) as f32 / (out_count + 1) as f32;
                let pin_pos = Pos2::new(screen_pos.x + width, screen_pos.y + height * frac);
                pin_positions.push((pin.clone(), pin_pos));
                painter.circle_filled(pin_pos, 3.5 * zoom, pin_wire_color(&pin.name));
            }

            (rect, pin_positions)
        }

        NodeLod::Block => {
            // LOD Block: Solid colored compact rectangle for extreme bird's-eye view
            let width = 70.0 * zoom;
            let height = 30.0 * zoom;
            let rect = Rect::from_min_size(screen_pos, Vec2::new(width, height));

            painter.rect_filled(rect, 2.0 * zoom, cat_col);
            if is_selected {
                painter.rect_stroke(rect, 2.0 * zoom, Stroke::new(1.5_f32, Color32::WHITE), StrokeKind::Inside);
            }

            // Left center connection anchor for all inputs
            let in_pos = Pos2::new(screen_pos.x, screen_pos.y + height * 0.5);
            for pin in &node.inputs {
                pin_positions.push((pin.clone(), in_pos));
            }

            // Right center connection anchor for all outputs
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
        // TC-503: Semantic wire colors
        assert_eq!(pin_wire_color("R"), Color32::from_rgb(239, 68, 68));
        assert_eq!(pin_wire_color("G"), Color32::from_rgb(34, 197, 94));
        assert_eq!(pin_wire_color("B"), Color32::from_rgb(59, 130, 246));
        assert_eq!(pin_wire_color("A"), Color32::from_rgb(148, 163, 184));
        assert_eq!(pin_wire_color("RGBA"), Color32::from_rgb(248, 250, 252));
    }
}
