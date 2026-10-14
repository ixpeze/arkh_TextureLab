//! Workstation UI layout, canvas, docking, and theme (Phase 5).

pub mod canvas;
pub mod inspector;
pub mod library;
pub mod preferences;
pub mod theme;
pub mod validator;
pub mod viewport;

pub use validator::{validate_texture_set, TextureSetReport};

use egui_dock::{DockState, NodeIndex};
use serde::{Deserialize, Serialize};

/// Identifies dockable tabs in the workstation layout.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Tab {
    NodeCanvas,
    Viewport2D,
    Inspector,
    Library,
    ExportDrawer,
    Validator,
}

impl Tab {
    pub fn title(&self) -> &'static str {
        match self {
            Self::NodeCanvas => "Node Canvas",
            Self::Viewport2D => "2D Viewport",
            Self::Inspector => "Properties",
            Self::Library => "Node Library",
            Self::ExportDrawer => "Export",
            Self::Validator => "Validator",
        }
    }
}

const DEFAULT_LAYOUT_JSON: &str = include_str!("../../texturelab_layout.json");

/// Constructs the default professional workstation dock layout.
/// Canvas is the central workspace, Left is Library, Right is Viewport (top) and Inspector (bottom).
/// Export Drawer is hidden by default (opened on-demand via Ctrl+E or View menu).
pub fn default_dock_layout() -> DockState<Tab> {
    // 1. Attempt to load from disk first if present at runtime
    if let Ok(data) = std::fs::read_to_string("texturelab_layout.json") {
        if let Ok(dock) = serde_json::from_str::<DockState<Tab>>(&data) {
            return dock;
        }
    }

    // 2. Fallback to embedded default layout JSON
    if let Ok(dock) = serde_json::from_str::<DockState<Tab>>(DEFAULT_LAYOUT_JSON) {
        return dock;
    }

    // 3. Fallback: programmatic tree
    let mut dock_state = DockState::new(vec![Tab::NodeCanvas]);

    // Split Left: Node Library (~18% of screen)
    let [center, _left] = dock_state.main_surface_mut().split_left(
        NodeIndex::root(),
        0.18,
        vec![Tab::Library],
    );

    // Split Right: Viewport2D (top right, ~32% of remaining width)
    let [_center_view, right] = dock_state.main_surface_mut().split_right(
        center,
        0.32,
        vec![Tab::Viewport2D],
    );

    // Split Bottom Right: Properties Inspector (50% of right column)
    let [_top_right, _bottom_right] = dock_state.main_surface_mut().split_below(
        right,
        0.50,
        vec![Tab::Inspector],
    );

    dock_state
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dock_layout_initialization() {
        let dock = default_dock_layout();
        let tabs: Vec<Tab> = dock.iter_all_tabs().map(|(_, tab)| *tab).collect();
        assert!(tabs.contains(&Tab::NodeCanvas));
        assert!(tabs.contains(&Tab::Viewport2D));
        assert!(tabs.contains(&Tab::Inspector));
        assert!(tabs.contains(&Tab::Library));
        // ExportDrawer and Validator are hidden by default
        assert!(!tabs.contains(&Tab::ExportDrawer));
        assert!(!tabs.contains(&Tab::Validator));
    }
}
