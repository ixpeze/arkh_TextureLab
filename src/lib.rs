//! ARKH TextureLab — Professional PBR Texture Authoring and Channel Packing Workstation.
//!
//! 100% Pure Rust • Native Desktop Engine • Zero Electron • Zero WebViews.

pub mod app;
pub mod core;
pub mod export;
pub mod graph;
pub mod nodes;
pub mod normalizer;
pub mod ui;

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
