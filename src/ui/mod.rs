//! Workstation UI layout, canvas, docking, and theme (Phase 5).

pub mod canvas;
pub mod inspector;
pub mod library;
pub mod theme;
pub mod viewport;

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
}

impl Tab {
    pub fn title(&self) -> &'static str {
        match self {
            Self::NodeCanvas => "☵ Node Canvas",
            Self::Viewport2D => "🖼 2D Viewport",
            Self::Inspector => "⚙ Properties Inspector",
            Self::Library => "📚 Node Library",
            Self::ExportDrawer => "📤 Export Preflight",
        }
    }
}

/// Constructs the default professional workstation dock layout.
pub fn default_dock_layout() -> DockState<Tab> {
    let mut dock_state = DockState::new(vec![Tab::NodeCanvas]);

    // Split Left: Library
    let [center, _left] = dock_state.main_surface_mut().split_left(
        NodeIndex::root(),
        0.20,
        vec![Tab::Library],
    );

    // Split Right: Viewport2D (top right)
    let [_center_view, right] = dock_state.main_surface_mut().split_right(
        center,
        0.35,
        vec![Tab::Viewport2D],
    );

    // Split Bottom Right: Inspector
    let [_top_right, _bottom_right] = dock_state.main_surface_mut().split_below(
        right,
        0.50,
        vec![Tab::Inspector],
    );

    // Split Bottom Center: Export Drawer
    let [_center_top, _bottom] = dock_state.main_surface_mut().split_below(
        center,
        0.25,
        vec![Tab::ExportDrawer],
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
        assert!(tabs.contains(&Tab::ExportDrawer));
    }
}
