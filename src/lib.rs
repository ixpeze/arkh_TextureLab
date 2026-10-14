//! TextureLab — PBR Texture Authoring and Channel Packing.

pub mod app;
pub mod core;
pub mod export;
pub mod graph;
pub mod hotkeys;
pub mod nodes;
pub mod normalizer;
pub mod settings;
pub mod templates;
pub mod ui;

pub use settings::AppSettings;

/// Returns the compile-time crate version.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_string() {
        assert_eq!(version(), "1.0.0");
    }

    #[test]
    fn test_app_defaults() {
        let app = app::TextureLabApp::default();
        assert_eq!(app.version(), "1.0.0");
        assert!(app.title().contains("TextureLAB"));
    }
}
