//! Dedicated 2D Viewport Inspector (Phase 5).
//!
//! Provides channel isolation (RGB, RGBA Checker, R, G, B, A),
//! GPU repeat tiling (1x, 2x, 4x), viewport zoom/pan,
//! and real-time pixel probe readout under cursor.

use egui::{
    Color32, ColorImage, Rect, Sense, Stroke, StrokeKind, TextureHandle, TextureOptions, Ui, Vec2,
};
use crate::core::buffer::{SharedTextureBuffer, TextureBuffer};
use crate::graph::evaluator::GraphEvaluator;
use crate::graph::model::{Graph, Node, NodeId, PinId};

/// Available channel isolation modes for 2D Viewport inspection.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum ChannelIsolation {
    #[default]
    Rgb,
    RgbaChecker,
    Red,
    Green,
    Blue,
    Alpha,
}

impl ChannelIsolation {
    pub fn label(&self) -> &'static str {
        match self {
            Self::Rgb => "RGB",
            Self::RgbaChecker => "RGBA Checker",
            Self::Red => "R (Grayscale)",
            Self::Green => "G (Grayscale)",
            Self::Blue => "B (Grayscale)",
            Self::Alpha => "A (Grayscale)",
        }
    }

    pub fn all() -> &'static [ChannelIsolation] {
        &[
            ChannelIsolation::Rgb,
            ChannelIsolation::RgbaChecker,
            ChannelIsolation::Red,
            ChannelIsolation::Green,
            ChannelIsolation::Blue,
            ChannelIsolation::Alpha,
        ]
    }
}

/// UV repeat tiling multipliers for seamless pattern inspection.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum TilingMode {
    #[default]
    OneX,
    TwoX,
    FourX,
}

impl TilingMode {
    pub fn factor(&self) -> u32 {
        match self {
            Self::OneX => 1,
            Self::TwoX => 2,
            Self::FourX => 4,
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            Self::OneX => "1x",
            Self::TwoX => "2x",
            Self::FourX => "4x",
        }
    }
}

/// Sampled pixel information under cursor.
#[derive(Clone, Debug, PartialEq)]
pub struct PixelProbe {
    pub x: u32,
    pub y: u32,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
    pub rf: f32,
    pub gf: f32,
    pub bf: f32,
    pub af: f32,
    pub hex: String,
}

impl PixelProbe {
    pub fn sample(buffer: &TextureBuffer, x: u32, y: u32) -> Self {
        let x_clamped = x.min(buffer.width.saturating_sub(1));
        let y_clamped = y.min(buffer.height.saturating_sub(1));
        let [r, g, b, a] = buffer.get_pixel(x_clamped, y_clamped);
        let rf = r as f32 / 255.0;
        let gf = g as f32 / 255.0;
        let bf = b as f32 / 255.0;
        let af = a as f32 / 255.0;
        let hex = format!("#{:02X}{:02X}{:02X}", r, g, b);

        Self {
            x: x_clamped,
            y: y_clamped,
            r,
            g,
            b,
            a,
            rf,
            gf,
            bf,
            af,
            hex,
        }
    }

    pub fn formatted_hud(&self) -> String {
        format!(
            "X: {}, Y: {} | R: {} ({:.3})  G: {} ({:.3})  B: {} ({:.3})  A: {} ({:.3}) | Hex: {}",
            self.x, self.y, self.r, self.rf, self.g, self.gf, self.b, self.bf, self.a, self.af, self.hex
        )
    }
}

/// Converts a `TextureBuffer` to an `egui::ColorImage` applying channel isolation.
pub fn buffer_to_color_image(buffer: &TextureBuffer, isolation: ChannelIsolation) -> ColorImage {
    let width = buffer.width as usize;
    let height = buffer.height as usize;
    let mut pixels = Vec::with_capacity(width * height);
    let raw = buffer.as_slice();

    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) * 4;
            let r = raw[idx];
            let g = raw[idx + 1];
            let b = raw[idx + 2];
            let a = raw[idx + 3];

            let color = match isolation {
                ChannelIsolation::Rgb => Color32::from_rgba_premultiplied(r, g, b, 255),
                ChannelIsolation::RgbaChecker => {
                    // Checkerboard background (16x16 px blocks)
                    let check = ((x / 16) + (y / 16)) % 2 == 0;
                    let bg = if check { 180u8 } else { 120u8 };
                    let alpha = a as u16;
                    let inv_alpha = 255 - alpha;
                    let br = ((r as u16 * alpha + bg as u16 * inv_alpha) / 255) as u8;
                    let bg_c = ((g as u16 * alpha + bg as u16 * inv_alpha) / 255) as u8;
                    let bb = ((b as u16 * alpha + bg as u16 * inv_alpha) / 255) as u8;
                    Color32::from_rgb(br, bg_c, bb)
                }
                ChannelIsolation::Red => Color32::from_rgb(r, r, r),
                ChannelIsolation::Green => Color32::from_rgb(g, g, g),
                ChannelIsolation::Blue => Color32::from_rgb(b, b, b),
                ChannelIsolation::Alpha => Color32::from_rgb(a, a, a),
            };
            pixels.push(color);
        }
    }

    ColorImage {
        size: [width, height],
        pixels,
    }
}

/// Resolved evaluation and socket context for 2D Viewport inspection.
#[derive(Clone, Debug)]
pub struct ViewportPreviewData {
    pub node_id: Option<NodeId>,
    pub node_label: String,
    pub available_sockets: Vec<String>,
    pub active_socket: String,
    pub buffer: Option<SharedTextureBuffer>,
    pub is_pinned: bool,
    pub is_fallback: bool,
}

/// Resolves which node and output socket buffer should be rendered in the 2D Viewport.
///
/// Priority:
/// 1. Pinned node (if set and present in graph).
/// 2. Active selected node on canvas (if set).
/// 3. Automatic fallback: Primary terminal TextureOutput node (or rightmost output node)
///    so artists always see their final material when no node is selected.
pub fn resolve_viewport_preview(
    graph: &Graph,
    evaluator: &GraphEvaluator,
    locked_node: Option<NodeId>,
    selected_node: Option<NodeId>,
    selected_socket_pref: Option<&str>,
) -> ViewportPreviewData {
    let mut is_pinned = false;

    // 1. Locked node takes precedence if it exists in graph
    let target_node_opt = if let Some(locked_id) = locked_node {
        if let Some(node) = graph.get_node(locked_id) {
            is_pinned = true;
            Some(node)
        } else {
            None
        }
    } else {
        None
    };

    let is_fallback = target_node_opt.is_none() && selected_node.is_none();

    let target_node = target_node_opt
        .or_else(|| selected_node.and_then(|id| graph.get_node(id)))
        .or_else(|| {
            // Fallback when nothing is selected:
            // Find rightmost TextureOutput node, or rightmost node with outputs
            let mut best_output_node: Option<&Node> = None;
            let mut max_x = f32::MIN;

            for node in graph.nodes.values() {
                if node.node_type == "TextureOutput" {
                    if best_output_node.is_none()
                        || best_output_node.unwrap().node_type != "TextureOutput"
                        || node.position[0] > max_x
                    {
                        best_output_node = Some(node);
                        max_x = node.position[0];
                    }
                } else if best_output_node.is_none() && !node.outputs.is_empty() {
                    if node.position[0] > max_x {
                        best_output_node = Some(node);
                        max_x = node.position[0];
                    }
                }
            }
            best_output_node
        });

    if let Some(node) = target_node {
        let available_sockets: Vec<String> = node.outputs.iter().map(|p| p.name.clone()).collect();

        let active_socket = if let Some(pref) = selected_socket_pref {
            if available_sockets.iter().any(|s| s == pref) {
                pref.to_string()
            } else {
                pick_default_socket(&available_sockets)
            }
        } else {
            pick_default_socket(&available_sockets)
        };

        let pin = PinId::output(node.id, &active_socket);
        let mut buffer = evaluator.get_output(&pin);

        // Fallback to any available output socket buffer if the chosen one is not evaluated
        if buffer.is_none() {
            for s in &available_sockets {
                let p = PinId::output(node.id, s);
                if let Some(b) = evaluator.get_output(&p) {
                    buffer = Some(b);
                    break;
                }
            }
        }

        let node_label = node.label.clone();

        ViewportPreviewData {
            node_id: Some(node.id),
            node_label,
            available_sockets,
            active_socket,
            buffer,
            is_pinned,
            is_fallback,
        }
    } else {
        ViewportPreviewData {
            node_id: None,
            node_label: "No Active Texture".to_string(),
            available_sockets: Vec::new(),
            active_socket: String::new(),
            buffer: None,
            is_pinned: false,
            is_fallback: false,
        }
    }
}

fn pick_default_socket(sockets: &[String]) -> String {
    if sockets.iter().any(|s| s == "output") {
        "output".to_string()
    } else if sockets.iter().any(|s| s == "RGBA") {
        "RGBA".to_string()
    } else if let Some(first) = sockets.first() {
        first.clone()
    } else {
        "output".to_string()
    }
}

// =========================================================================
// CAD/DCC Precision Vector Icon Helpers (Strict Zero-Emoji Compliance)
// =========================================================================

fn draw_pin_icon(painter: &egui::Painter, rect: Rect, is_pinned: bool, is_hovered: bool) {
    let c = rect.center();
    let stroke_color = if is_pinned {
        crate::ui::theme::ACCENT_AMBER
    } else if is_hovered {
        crate::ui::theme::TEXT_PRIMARY
    } else {
        crate::ui::theme::TEXT_MUTED
    };
    let stroke = Stroke::new(1.2_f32, stroke_color);

    // Top cap bar
    painter.line_segment([c + Vec2::new(-3.5, -5.5), c + Vec2::new(3.5, -5.5)], stroke);

    // Pin head barrel
    let head_rect = Rect::from_center_size(c + Vec2::new(0.0, -2.0), Vec2::new(5.0, 5.0));
    let fill = if is_pinned {
        crate::ui::theme::ACCENT_AMBER
    } else {
        Color32::TRANSPARENT
    };
    painter.rect(head_rect, 1.0, fill, stroke, StrokeKind::Inside);

    // Needle tip pointing downwards
    painter.line_segment([c + Vec2::new(0.0, 1.0), c + Vec2::new(0.0, 5.5)], stroke);
}

fn draw_popout_icon(painter: &egui::Painter, rect: Rect, is_undocked: bool, is_hovered: bool) {
    let c = rect.center();
    let stroke_color = if is_undocked {
        crate::ui::theme::ACCENT_AMBER
    } else if is_hovered {
        crate::ui::theme::TEXT_PRIMARY
    } else {
        crate::ui::theme::TEXT_SECONDARY
    };
    let stroke = Stroke::new(1.2_f32, stroke_color);

    let left = c.x - 4.5;
    let right = c.x + 2.0;
    let top = c.y - 2.0;
    let bottom = c.y + 4.5;

    // Window frame (with open gap at top-right for arrow)
    painter.line_segment([egui::pos2(right - 2.0, top), egui::pos2(left, top)], stroke);
    painter.line_segment([egui::pos2(left, top), egui::pos2(left, bottom)], stroke);
    painter.line_segment([egui::pos2(left, bottom), egui::pos2(right, bottom)], stroke);
    painter.line_segment([egui::pos2(right, bottom), egui::pos2(right, top + 2.0)], stroke);

    // Arrow pointing up-right
    let arrow_start = egui::pos2(c.x - 0.5, c.y + 0.5);
    let arrow_end = egui::pos2(c.x + 4.5, c.y - 4.5);
    painter.line_segment([arrow_start, arrow_end], stroke);
    painter.line_segment([egui::pos2(c.x + 2.0, c.y - 4.5), arrow_end], stroke);
    painter.line_segment([egui::pos2(c.x + 4.5, c.y - 2.0), arrow_end], stroke);
}

fn draw_fit_icon(painter: &egui::Painter, rect: Rect, is_hovered: bool) {
    let c = rect.center();
    let color = if is_hovered {
        crate::ui::theme::TEXT_PRIMARY
    } else {
        crate::ui::theme::TEXT_SECONDARY
    };
    let stroke = Stroke::new(1.2_f32, color);
    let half = 4.5;
    let arm = 2.5;

    let tl = c + Vec2::new(-half, -half);
    let tr = c + Vec2::new(half, -half);
    let bl = c + Vec2::new(-half, half);
    let br = c + Vec2::new(half, half);

    // Top-Left corner bracket
    painter.line_segment([tl, tl + Vec2::new(arm, 0.0)], stroke);
    painter.line_segment([tl, tl + Vec2::new(0.0, arm)], stroke);

    // Top-Right corner bracket
    painter.line_segment([tr, tr - Vec2::new(arm, 0.0)], stroke);
    painter.line_segment([tr, tr + Vec2::new(0.0, arm)], stroke);

    // Bottom-Left corner bracket
    painter.line_segment([bl, bl + Vec2::new(arm, 0.0)], stroke);
    painter.line_segment([bl, bl - Vec2::new(0.0, arm)], stroke);

    // Bottom-Right corner bracket
    painter.line_segment([br, br - Vec2::new(arm, 0.0)], stroke);
    painter.line_segment([br, br - Vec2::new(0.0, arm)], stroke);
}

fn draw_checker_icon(painter: &egui::Painter, rect: Rect, is_active: bool) {
    let c = rect.center();
    let half = 5.0;
    let b_rect = Rect::from_center_size(c, Vec2::new(half * 2.0, half * 2.0));
    let dark = Color32::from_rgb(60, 60, 60);
    let light = if is_active {
        crate::ui::theme::ACCENT_AMBER
    } else {
        Color32::from_rgb(160, 160, 160)
    };

    let sz = half;
    painter.rect_filled(Rect::from_min_size(b_rect.min, Vec2::new(sz, sz)), 0.0, light);
    painter.rect_filled(Rect::from_min_size(egui::pos2(b_rect.min.x + sz, b_rect.min.y), Vec2::new(sz, sz)), 0.0, dark);
    painter.rect_filled(Rect::from_min_size(egui::pos2(b_rect.min.x, b_rect.min.y + sz), Vec2::new(sz, sz)), 0.0, dark);
    painter.rect_filled(Rect::from_min_size(egui::pos2(b_rect.min.x + sz, b_rect.min.y + sz), Vec2::new(sz, sz)), 0.0, light);

    let border_color = if is_active {
        crate::ui::theme::ACCENT_AMBER
    } else {
        crate::ui::theme::BORDER_DARK
    };
    painter.rect_stroke(b_rect, 0.0, Stroke::new(1.0_f32, border_color), StrokeKind::Inside);
}

fn icon_button(
    ui: &mut Ui,
    size: Vec2,
    tooltip: &str,
    draw_icon: impl FnOnce(&egui::Painter, Rect, bool, bool),
) -> egui::Response {
    let (rect, response) = ui.allocate_exact_size(size, Sense::click());
    let is_hovered = response.hovered();
    let is_active = response.is_pointer_button_down_on();
    if is_hovered {
        ui.painter().rect_filled(
            rect,
            3.0,
            Color32::from_rgba_unmultiplied(255, 255, 255, 18),
        );
    }
    draw_icon(ui.painter(), rect, is_hovered, is_active);
    response.on_hover_text(tooltip)
}

/// Viewport persistent state.
pub struct ViewportState {
    pub isolation: ChannelIsolation,
    pub tiling: TilingMode,
    pub zoom: f32,
    pub pan: Vec2,
    pub active_probe: Option<PixelProbe>,
    pub locked_node: Option<NodeId>,
    pub is_undocked: bool,
    pub selected_socket: Option<String>,
    texture_handle: Option<TextureHandle>,
    last_buffer_ptr: usize,
    last_raw_ptr: usize,
    last_node_id: Option<NodeId>,
    last_socket: String,
    last_buffer_dims: (u32, u32),
    last_isolation: ChannelIsolation,
}

impl Default for ViewportState {
    fn default() -> Self {
        Self {
            isolation: ChannelIsolation::Rgb,
            tiling: TilingMode::OneX,
            zoom: 1.0,
            pan: Vec2::ZERO,
            active_probe: None,
            locked_node: None,
            is_undocked: false,
            selected_socket: None,
            texture_handle: None,
            last_buffer_ptr: 0,
            last_raw_ptr: 0,
            last_node_id: None,
            last_socket: String::new(),
            last_buffer_dims: (0, 0),
            last_isolation: ChannelIsolation::Rgb,
        }
    }
}

impl ViewportState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn reset_view(&mut self) {
        self.zoom = 1.0;
        self.pan = Vec2::ZERO;
    }

    /// Fits texture proportionally inside the available viewport area.
    pub fn fit_view(&mut self, buf_dims: (u32, u32), viewport_size: Vec2) {
        if buf_dims.0 > 0 && buf_dims.1 > 0 {
            let margin = 24.0;
            let scale_x = (viewport_size.x - margin) / buf_dims.0 as f32;
            let scale_y = (viewport_size.y - margin) / buf_dims.1 as f32;
            self.zoom = scale_x.min(scale_y).clamp(0.05, 10.0);
            self.pan = Vec2::ZERO;
        }
    }

    /// Renders the 2D Viewport GUI with clean CAD icon top/bottom toolbars and live GPU preview.
    pub fn show(
        &mut self,
        ui: &mut Ui,
        preview_data: &ViewportPreviewData,
    ) {
        ui.vertical(|ui| {
            // ==========================================
            // TOP BAR: Node Identity & Navigation (26px)
            // ==========================================
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing = Vec2::new(6.0, 0.0);

                // Pin / Lock Toggle Button (Vector Pushpin)
                let is_pinned = preview_data.is_pinned;
                let pin_tooltip = if is_pinned {
                    "Viewport is locked to this node. Click to unpin and follow active selection."
                } else {
                    "Pin 2D Viewport to this node so it stays visible while editing other nodes."
                };
                let pin_btn = icon_button(ui, Vec2::new(20.0, 20.0), pin_tooltip, |painter, r, h, _| {
                    draw_pin_icon(painter, r, is_pinned, h);
                });
                if pin_btn.clicked() {
                    if is_pinned {
                        self.locked_node = None;
                    } else if let Some(target_id) = preview_data.node_id {
                        self.locked_node = Some(target_id);
                    }
                }

                // Undock / Pop-out Window Button (Vector Popout)
                let popout_tooltip = if self.is_undocked {
                    "Dock viewport back into main workspace"
                } else {
                    "Pop out viewport to separate floating monitor window"
                };
                let is_undocked = self.is_undocked;
                let undock_btn = icon_button(ui, Vec2::new(20.0, 20.0), popout_tooltip, |painter, r, h, _| {
                    draw_popout_icon(painter, r, is_undocked, h);
                });
                if undock_btn.clicked() {
                    self.is_undocked = !self.is_undocked;
                }

                ui.separator();

                // Clean Node Title (No duplicate redundant text)
                ui.label(
                    egui::RichText::new(&preview_data.node_label)
                        .size(11.5)
                        .strong()
                        .color(if is_pinned {
                            crate::ui::theme::ACCENT_AMBER
                        } else {
                            crate::ui::theme::TEXT_PRIMARY
                        }),
                );

                // Multiple Output Socket Selector Pills (Only shown if node has 2+ outputs)
                if preview_data.available_sockets.len() > 1 {
                    ui.separator();
                    for sock in &preview_data.available_sockets {
                        let is_active = preview_data.active_socket == sock.as_str();
                        let text = egui::RichText::new(sock).size(10.5).color(
                            if is_active {
                                crate::ui::theme::ACCENT_AMBER
                            } else {
                                crate::ui::theme::TEXT_MUTED
                            },
                        );
                        if ui
                            .selectable_label(is_active, text)
                            .on_hover_text(format!("Inspect output socket '{}'", sock))
                            .clicked()
                        {
                            self.selected_socket = Some(sock.clone());
                        }
                    }
                }

                // Navigation Controls (Right Aligned)
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    // Zoom readout
                    ui.label(
                        egui::RichText::new(format!("{:.0}%", self.zoom * 100.0))
                            .monospace()
                            .size(11.0)
                            .color(crate::ui::theme::TEXT_MUTED),
                    );

                    // Fit view icon button
                    let fit_btn = icon_button(
                        ui,
                        Vec2::new(20.0, 20.0),
                        "Fit texture in viewport",
                        |painter, r, h, _| {
                            draw_fit_icon(painter, r, h);
                        },
                    );
                    if fit_btn.clicked() {
                        if let Some(buf) = preview_data.buffer.as_deref() {
                            let avail = ui.available_size();
                            self.fit_view((buf.width, buf.height), avail);
                        } else {
                            self.reset_view();
                        }
                    }

                    // 1:1 Pixel scale button
                    let scale_btn = ui.add(
                        egui::Button::new(
                            egui::RichText::new("1:1")
                                .size(10.0)
                                .color(crate::ui::theme::TEXT_SECONDARY),
                        )
                        .frame(true)
                        .min_size(Vec2::new(22.0, 18.0)),
                    );
                    if scale_btn.on_hover_text("Reset to 1:1 pixel scale").clicked() {
                        self.zoom = 1.0;
                        self.pan = Vec2::ZERO;
                    }
                });
            });

            ui.separator();

            // ==========================================
            // MAIN CANVAS (Interactive Pan, Zoom, Tiling)
            // ==========================================
            let canvas_size = (ui.available_size() - Vec2::new(0.0, 28.0)).max(Vec2::new(50.0, 50.0));
            let (rect, response) = ui.allocate_exact_size(canvas_size, Sense::click_and_drag());

            // Handle pan via drag
            if response.dragged_by(egui::PointerButton::Primary)
                || response.dragged_by(egui::PointerButton::Middle)
            {
                self.pan += response.drag_delta();
            }

            // Handle zoom via scroll wheel
            let scroll = ui.input(|i| i.smooth_scroll_delta.y);
            if response.hovered() && scroll.abs() > 0.0 {
                let zoom_factor = (scroll * 0.002).exp();
                self.zoom = (self.zoom * zoom_factor).clamp(0.05, 20.0);
            }

            let painter = ui.painter_at(rect);
            painter.rect_filled(rect, 0.0, crate::ui::theme::BG_CANVAS);

            if let Some(buf) = preview_data.buffer.as_deref() {
                let buf_ptr = (buf as *const TextureBuffer) as usize;
                let raw_ptr = buf.image.as_raw().as_ptr() as usize;

                let needs_reupload = self.texture_handle.is_none()
                    || self.last_buffer_ptr != buf_ptr
                    || self.last_raw_ptr != raw_ptr
                    || self.last_node_id != preview_data.node_id
                    || self.last_socket != preview_data.active_socket
                    || self.last_buffer_dims != (buf.width, buf.height)
                    || self.last_isolation != self.isolation;

                if needs_reupload {
                    let color_img = buffer_to_color_image(buf, self.isolation);
                    if let Some(handle) = &mut self.texture_handle {
                        if self.last_buffer_dims == (buf.width, buf.height) {
                            handle.set(color_img, TextureOptions::NEAREST);
                        } else {
                            *handle = ui.ctx().load_texture(
                                "viewport_active_preview",
                                color_img,
                                TextureOptions::NEAREST,
                            );
                        }
                    } else {
                        let handle = ui.ctx().load_texture(
                            "viewport_active_preview",
                            color_img,
                            TextureOptions::NEAREST,
                        );
                        self.texture_handle = Some(handle);
                    }

                    if self.last_buffer_dims != (0, 0) && self.last_buffer_dims != (buf.width, buf.height) {
                        let avail = ui.available_size();
                        self.fit_view((buf.width, buf.height), avail);
                    }

                    self.last_buffer_ptr = buf_ptr;
                    self.last_raw_ptr = raw_ptr;
                    self.last_node_id = preview_data.node_id;
                    self.last_socket = preview_data.active_socket.clone();
                    self.last_buffer_dims = (buf.width, buf.height);
                    self.last_isolation = self.isolation;
                }

                if let Some(tex) = &self.texture_handle {
                    let center = rect.center() + self.pan;
                    let tile_count = self.tiling.factor();
                    let base_w = buf.width as f32 * self.zoom;
                    let base_h = buf.height as f32 * self.zoom;
                    let total_w = base_w * tile_count as f32;
                    let total_h = base_h * tile_count as f32;

                    let top_left = center - Vec2::new(total_w * 0.5, total_h * 0.5);

                    // Draw tiled quads
                    for ty in 0..tile_count {
                        for tx in 0..tile_count {
                            let tile_rect = Rect::from_min_size(
                                top_left + Vec2::new(tx as f32 * base_w, ty as f32 * base_h),
                                Vec2::new(base_w, base_h),
                            );

                            painter.image(
                                tex.id(),
                                tile_rect,
                                Rect::from_min_max(egui::pos2(0.0, 0.0), egui::pos2(1.0, 1.0)),
                                Color32::WHITE,
                            );

                            if tile_count > 1 {
                                painter.rect_stroke(
                                    tile_rect,
                                    0.0,
                                    Stroke::new(1.0_f32, Color32::from_rgba_unmultiplied(255, 255, 255, 30)),
                                    StrokeKind::Inside,
                                );
                            }
                        }
                    }

                    // Outer border
                    let full_bounds = Rect::from_min_size(top_left, Vec2::new(total_w, total_h));
                    painter.rect_stroke(
                        full_bounds,
                        0.0,
                        Stroke::new(1.0_f32, crate::ui::theme::BORDER_SUBTLE),
                        StrokeKind::Inside,
                    );

                    // Cursor Pixel Probe calculation
                    if let Some(pointer_pos) = response.hover_pos() {
                        if full_bounds.contains(pointer_pos) {
                            let rel_x = (pointer_pos.x - top_left.x) % base_w;
                            let rel_y = (pointer_pos.y - top_left.y) % base_h;
                            let norm_u = (rel_x / base_w).clamp(0.0, 1.0);
                            let norm_v = (rel_y / base_h).clamp(0.0, 1.0);

                            let px = (norm_u * (buf.width as f32 - 1.0)).round() as u32;
                            let py = (norm_v * (buf.height as f32 - 1.0)).round() as u32;

                            self.active_probe = Some(PixelProbe::sample(buf, px, py));
                        } else {
                            self.active_probe = None;
                        }
                    } else {
                        self.active_probe = None;
                    }
                }
            } else {
                painter.text(
                    rect.center(),
                    egui::Align2::CENTER_CENTER,
                    "No active texture",
                    egui::FontId::proportional(13.0),
                    crate::ui::theme::TEXT_MUTED,
                );
                self.active_probe = None;
            }

            ui.separator();

            // ==========================================
            // BOTTOM BAR: Inspection & Telemetry (24px)
            // ==========================================
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing = Vec2::new(6.0, 0.0);

                // Channel Isolation Segmented Pills
                // 1. RGB
                let is_rgb = self.isolation == ChannelIsolation::Rgb;
                let rgb_txt = egui::RichText::new("RGB").size(10.5).color(
                    if is_rgb { crate::ui::theme::ACCENT_AMBER } else { crate::ui::theme::TEXT_SECONDARY }
                );
                if ui.selectable_label(is_rgb, rgb_txt).on_hover_text("RGB Color").clicked() {
                    self.isolation = ChannelIsolation::Rgb;
                }

                // 2. Checkerboard Alpha icon pill
                let is_chk = self.isolation == ChannelIsolation::RgbaChecker;
                let (chk_rect, chk_resp) = ui.allocate_exact_size(Vec2::new(20.0, 18.0), Sense::click());
                if chk_resp.hovered() || is_chk {
                    ui.painter().rect_filled(
                        chk_rect,
                        2.0,
                        if is_chk { Color32::from_rgba_unmultiplied(245, 158, 11, 35) } else { Color32::from_rgba_unmultiplied(255, 255, 255, 15) }
                    );
                }
                draw_checker_icon(ui.painter(), chk_rect, is_chk);
                if chk_resp.on_hover_text("RGBA Checkerboard Alpha").clicked() {
                    self.isolation = ChannelIsolation::RgbaChecker;
                }

                // 3. R, G, B, A
                for &(mode, label, tip) in &[
                    (ChannelIsolation::Red, "R", "Red Channel Grayscale"),
                    (ChannelIsolation::Green, "G", "Green Channel Grayscale"),
                    (ChannelIsolation::Blue, "B", "Blue Channel Grayscale"),
                    (ChannelIsolation::Alpha, "A", "Alpha Channel Grayscale"),
                ] {
                    let is_active = self.isolation == mode;
                    let text = egui::RichText::new(label).size(10.5).color(
                        if is_active { crate::ui::theme::ACCENT_AMBER } else { crate::ui::theme::TEXT_SECONDARY }
                    );
                    if ui.selectable_label(is_active, text).on_hover_text(tip).clicked() {
                        self.isolation = mode;
                    }
                }

                ui.separator();

                // UV Tiling Toggles
                for &(tile, code) in &[
                    (TilingMode::OneX, "1x"),
                    (TilingMode::TwoX, "2x"),
                    (TilingMode::FourX, "4x"),
                ] {
                    let is_active = self.tiling == tile;
                    let text = egui::RichText::new(code).size(10.5).color(
                        if is_active {
                            crate::ui::theme::ACCENT_AMBER
                        } else {
                            crate::ui::theme::TEXT_MUTED
                        }
                    );
                    if ui.selectable_label(is_active, text).on_hover_text(format!("{} UV Repeat Tiling", code)).clicked() {
                        self.tiling = tile;
                    }
                }

                // Telemetry / Swatch (Right Aligned)
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if let Some(probe) = &self.active_probe {
                        // Coordinates
                        ui.label(
                            egui::RichText::new(format!("({}, {})", probe.x, probe.y))
                                .size(10.5)
                                .color(crate::ui::theme::TEXT_MUTED),
                        ).on_hover_text(probe.formatted_hud());

                        // Hex text
                        ui.label(
                            egui::RichText::new(&probe.hex)
                                .monospace()
                                .size(11.0)
                                .strong()
                                .color(crate::ui::theme::ACCENT_AMBER),
                        ).on_hover_text(probe.formatted_hud());

                        // 12x12 Rounded color swatch chip
                        let (swatch_rect, swatch_resp) = ui.allocate_exact_size(Vec2::new(12.0, 12.0), Sense::hover());
                        ui.painter().rect_filled(
                            swatch_rect,
                            2.0,
                            Color32::from_rgb(probe.r, probe.g, probe.b),
                        );
                        ui.painter().rect_stroke(
                            swatch_rect,
                            2.0,
                            Stroke::new(1.0_f32, Color32::from_rgb(50, 50, 50)),
                            StrokeKind::Inside,
                        );
                        swatch_resp.on_hover_text(probe.formatted_hud());
                    } else if let Some(buf) = preview_data.buffer.as_deref() {
                        ui.label(
                            egui::RichText::new(format!("{} × {} px", buf.width, buf.height))
                                .size(11.0)
                                .color(crate::ui::theme::TEXT_SECONDARY),
                        );
                    }
                });
            });
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pixel_probe_sample_and_hud_format() {
        let mut buf = TextureBuffer::new(2, 2);
        buf.set_pixel(1, 1, [255, 128, 0, 255]);

        let probe = PixelProbe::sample(&buf, 1, 1);
        assert_eq!(probe.x, 1);
        assert_eq!(probe.y, 1);
        assert_eq!(probe.r, 255);
        assert_eq!(probe.g, 128);
        assert_eq!(probe.b, 0);
        assert_eq!(probe.a, 255);
        assert!((probe.rf - 1.0).abs() < 0.001);
        assert!((probe.gf - 0.502).abs() < 0.01);
        assert_eq!(probe.hex, "#FF8000");

        let hud = probe.formatted_hud();
        assert!(hud.contains("R: 255 (1.000)"));
        assert!(hud.contains("G: 128 (0.502)"));
        assert!(hud.contains("#FF8000"));
    }

    #[test]
    fn test_channel_isolation_grayscale_modes() {
        // TC-504: Selecting 'R' displays red channel as luminance grayscale
        let mut buf = TextureBuffer::new(1, 1);
        buf.set_pixel(0, 0, [200, 100, 50, 255]);

        // Red isolation
        let red_img = buffer_to_color_image(&buf, ChannelIsolation::Red);
        let px_r = red_img.pixels[0];
        assert_eq!(px_r.r(), 200);
        assert_eq!(px_r.g(), 200);
        assert_eq!(px_r.b(), 200);

        // Green isolation
        let green_img = buffer_to_color_image(&buf, ChannelIsolation::Green);
        let px_g = green_img.pixels[0];
        assert_eq!(px_g.r(), 100);
        assert_eq!(px_g.g(), 100);
        assert_eq!(px_g.b(), 100);

        // Blue isolation
        let blue_img = buffer_to_color_image(&buf, ChannelIsolation::Blue);
        let px_b = blue_img.pixels[0];
        assert_eq!(px_b.r(), 50);
        assert_eq!(px_b.g(), 50);
        assert_eq!(px_b.b(), 50);

        // Alpha isolation
        let mut buf_a = TextureBuffer::new(1, 1);
        buf_a.set_pixel(0, 0, [200, 100, 50, 128]);
        let alpha_img = buffer_to_color_image(&buf_a, ChannelIsolation::Alpha);
        let px_a = alpha_img.pixels[0];
        assert_eq!(px_a.r(), 128);
        assert_eq!(px_a.g(), 128);
        assert_eq!(px_a.b(), 128);
    }

    #[test]
    fn test_tiling_mode_factors() {
        assert_eq!(TilingMode::OneX.factor(), 1);
        assert_eq!(TilingMode::TwoX.factor(), 2);
        assert_eq!(TilingMode::FourX.factor(), 4);
    }

    #[test]
    fn test_viewport_fit_and_locking() {
        let mut state = ViewportState::new();
        assert_eq!(state.locked_node, None);
        assert!(!state.is_undocked);

        // Lock to node
        state.locked_node = Some(NodeId(42));
        assert_eq!(state.locked_node, Some(NodeId(42)));

        // Fit view calculation
        state.fit_view((512, 512), Vec2::new(280.0, 280.0));
        assert!(state.zoom > 0.0);
        assert_eq!(state.pan, Vec2::ZERO);

        // Undock toggle
        state.is_undocked = true;
        assert!(state.is_undocked);
    }

    #[test]
    fn test_resolve_viewport_preview_selected_and_fallback() {
        let mut graph = Graph::new();
        let mut n1 = Node::new(NodeId(1), "ConstantColor", "Albedo", [0.0, 0.0]);
        n1.add_output("output");
        n1.add_output("RGBA");
        graph.add_node(n1);

        let mut n2 = Node::new(NodeId(2), "TextureOutput", "Final Output", [400.0, 0.0]);
        n2.add_input("input");
        n2.add_output("output");
        graph.add_node(n2);

        let mut evaluator = GraphEvaluator::new((64, 64));
        let _ = evaluator.evaluate(&graph);

        // 1. When node 1 is selected, viewport resolves node 1
        let prev1 = resolve_viewport_preview(&graph, &evaluator, None, Some(NodeId(1)), None);
        assert_eq!(prev1.node_id, Some(NodeId(1)));
        assert_eq!(prev1.node_label, "Albedo");
        assert_eq!(prev1.active_socket, "output");
        assert!(!prev1.is_pinned);
        assert!(!prev1.is_fallback);

        // 2. When socket preference "RGBA" is provided, active_socket switches
        let prev_rgba = resolve_viewport_preview(&graph, &evaluator, None, Some(NodeId(1)), Some("RGBA"));
        assert_eq!(prev_rgba.active_socket, "RGBA");

        // 3. When NO node is selected, viewport automatically falls back to final TextureOutput
        let prev_fallback = resolve_viewport_preview(&graph, &evaluator, None, None, None);
        assert_eq!(prev_fallback.node_id, Some(NodeId(2)));
        assert!(prev_fallback.node_label.contains("Final Output"));
        assert!(prev_fallback.is_fallback);

        // 4. When a node is pinned (locked), it overrides the active selection
        let prev_pinned = resolve_viewport_preview(&graph, &evaluator, Some(NodeId(2)), Some(NodeId(1)), None);
        assert_eq!(prev_pinned.node_id, Some(NodeId(2)));
        assert!(prev_pinned.is_pinned);
    }
}
