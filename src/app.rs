//! Main application state and eframe lifecycle implementation.

/// Root application state for ARKH TextureLab.
pub struct TextureLabApp {
    title: String,
    version: &'static str,
}

impl TextureLabApp {
    /// Creates a new instance of TextureLabApp.
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        Self {
            title: "TextureLAB — PBR Texture Workstation".to_string(),
            version: env!("CARGO_PKG_VERSION"),
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
        Self {
            title: "TextureLAB — PBR Texture Workstation".to_string(),
            version: env!("CARGO_PKG_VERSION"),
        }
    }
}

impl eframe::App for TextureLabApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("TextureLAB — PBR Texture Workstation (Pure Rust)");
            ui.label(format!("Version: {}", self.version));
            ui.label("Phase 0 Baseline Initialized. Pure Rust toolchain active.");
        });
    }
}
