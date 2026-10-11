#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use eframe::NativeOptions;
use egui::vec2;
use texturelab::app::TextureLabApp;

fn main() -> eframe::Result<()> {
    let native_options = NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("TextureLAB")
            .with_inner_size(vec2(1440.0, 900.0))
            .with_min_inner_size(vec2(1024.0, 640.0))
            .with_active(true),
        ..Default::default()
    };

    eframe::run_native(
        "TextureLAB",
        native_options,
        Box::new(|cc| Ok(Box::new(TextureLabApp::new(cc)))),
    )
}
