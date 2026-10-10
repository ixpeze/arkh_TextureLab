//! Dedicated 2D Viewport Inspector (Phase 5).
//!
//! Provides channel isolation (RGB, RGBA Checker, R, G, B, A),
//! GPU repeat tiling (1x, 2x, 4x), viewport zoom/pan,
//! and real-time pixel probe readout under cursor.

use egui::{
    Color32, ColorImage, Rect, Sense, Stroke, StrokeKind, TextureHandle, TextureOptions, Ui, Vec2,
};
use crate::core::buffer::TextureBuffer;

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

/// Viewport persistent state.
pub struct ViewportState {
    pub isolation: ChannelIsolation,
    pub tiling: TilingMode,
    pub zoom: f32,
    pub pan: Vec2,
    pub active_probe: Option<PixelProbe>,
    texture_handle: Option<TextureHandle>,
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
            texture_handle: None,
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

    /// Renders the 2D Viewport GUI.
    pub fn show(&mut self, ui: &mut Ui, current_buffer: Option<&TextureBuffer>, title: &str) {
        ui.vertical(|ui| {
            // Viewport Toolbar
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new(title).strong().color(crate::ui::theme::TEXT_PRIMARY));
                ui.separator();

                // Channel Isolation selectors
                ui.label(egui::RichText::new("Channel:").color(crate::ui::theme::TEXT_SECONDARY));
                for &mode in ChannelIsolation::all() {
                    let is_active = self.isolation == mode;
                    if ui.selectable_label(is_active, mode.label()).clicked() {
                        self.isolation = mode;
                    }
                }

                ui.separator();

                // Repeat Tiling
                ui.label(egui::RichText::new("Tiling:").color(crate::ui::theme::TEXT_SECONDARY));
                for &tile in &[TilingMode::OneX, TilingMode::TwoX, TilingMode::FourX] {
                    let is_active = self.tiling == tile;
                    if ui.selectable_label(is_active, tile.label()).clicked() {
                        self.tiling = tile;
                    }
                }

                ui.separator();

                // Zoom Controls
                if ui.button("1:1").clicked() {
                    self.zoom = 1.0;
                }
                if ui.button("Reset").clicked() {
                    self.reset_view();
                }
                ui.label(format!("{:.0}%", self.zoom * 100.0));
            });

            ui.separator();

            // Main Viewport Canvas Area
            let available_size = ui.available_size() - Vec2::new(0.0, 24.0); // leave space for probe HUD
            let (rect, response) = ui.allocate_exact_size(available_size, Sense::click_and_drag());

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

            if let Some(buf) = current_buffer {
                // Ensure texture is uploaded and current
                let needs_reupload = self.texture_handle.is_none()
                    || self.last_buffer_dims != (buf.width, buf.height)
                    || self.last_isolation != self.isolation;

                if needs_reupload {
                    let color_img = buffer_to_color_image(buf, self.isolation);
                    let handle = ui.ctx().load_texture(
                        "viewport_active_preview",
                        color_img,
                        TextureOptions::NEAREST,
                    );
                    self.texture_handle = Some(handle);
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

                            // Subtle tile border if tiled
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
                            // Find normalized relative position inside the first tile
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
                // Empty state
                painter.text(
                    rect.center(),
                    egui::Align2::CENTER_CENTER,
                    "No node selected or no buffer evaluated",
                    egui::FontId::proportional(14.0),
                    crate::ui::theme::TEXT_MUTED,
                );
                self.active_probe = None;
            }

            // Bottom HUD Status Readout: Instant Pixel Probe
            ui.horizontal(|ui| {
                if let Some(probe) = &self.active_probe {
                    ui.label(
                        egui::RichText::new(probe.formatted_hud())
                            .monospace()
                            .size(12.0)
                            .color(crate::ui::theme::TEXT_PRIMARY),
                    );
                } else if let Some(buf) = current_buffer {
                    ui.label(
                        egui::RichText::new(format!(
                            "Resolution: {}x{} | Hover over viewport to inspect pixel RGBA values",
                            buf.width, buf.height
                        ))
                        .size(12.0)
                        .color(crate::ui::theme::TEXT_SECONDARY),
                    );
                } else {
                    ui.label(
                        egui::RichText::new("2D Viewport Idle")
                            .size(12.0)
                            .color(crate::ui::theme::TEXT_MUTED),
                    );
                }
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
}
