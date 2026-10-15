//! Application settings persistence and configuration management (Phase 2).
//!
//! Provides the `AppSettings` struct, JSON persistence adjacent to the binary,
//! graceful fallback for missing or corrupted files, and user preferences.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

/// Default texture resolution for new graphs and evaluation buffers (2048x2048).
pub const DEFAULT_RESOLUTION: (u32, u32) = (2048, 2048);

/// Default signature amber accent color in RGB `[0.0, 1.0]`.
pub const DEFAULT_ACCENT_COLOR: [f32; 3] = [1.0, 176.0 / 255.0, 46.0 / 255.0];

/// Default background autosave interval in seconds (5 minutes).
pub const DEFAULT_AUTOSAVE_INTERVAL_SECS: u64 = 300;

fn default_res() -> (u32, u32) {
    DEFAULT_RESOLUTION
}

fn default_accent() -> [f32; 3] {
    DEFAULT_ACCENT_COLOR
}

fn default_autosave() -> u64 {
    DEFAULT_AUTOSAVE_INTERVAL_SECS
}

/// Global user preferences and persistent workstation configuration.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct AppSettings {
    /// Default texture resolution `(width, height)` for evaluation buffers.
    #[serde(default = "default_res")]
    pub default_resolution: (u32, u32),

    /// Optional target directory for exported textures.
    #[serde(default)]
    pub export_directory: Option<String>,

    /// Theme accent color in normalized RGB `[r, g, b]`.
    #[serde(default = "default_accent")]
    pub accent_color: [f32; 3],

    /// Hotkey overrides mapping action name (e.g. `"SpawnMath"`) to key chord string (e.g. `"X"`).
    #[serde(default)]
    pub hotkey_overrides: HashMap<String, String>,

    /// List of recently opened or saved `.tlab` project paths (max 10).
    #[serde(default)]
    pub recent_files: Vec<String>,

    /// Periodic autosave interval in seconds.
    #[serde(default = "default_autosave")]
    pub autosave_interval_secs: u64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_resolution: DEFAULT_RESOLUTION,
            export_directory: None,
            accent_color: DEFAULT_ACCENT_COLOR,
            hotkey_overrides: HashMap::new(),
            recent_files: Vec::new(),
            autosave_interval_secs: DEFAULT_AUTOSAVE_INTERVAL_SECS,
        }
    }
}

/// Resolves the candidate path for `settings.json` adjacent to the executable,
/// falling back to the current working directory.
pub fn resolve_settings_path() -> PathBuf {
    // 1. Next to executable if exists
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let next_to_exe = parent.join("settings.json");
            if next_to_exe.exists() {
                return next_to_exe;
            }
        }
    }

    // 2. Fallback to current working directory if exists
    let cwd_path = PathBuf::from("settings.json");
    if cwd_path.exists() {
        return cwd_path;
    }

    // 3. Default save target: next to executable if possible, otherwise cwd
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            return parent.join("settings.json");
        }
    }

    cwd_path
}

impl AppSettings {
    /// Loads settings from default `settings.json` location next to the executable.
    ///
    /// If the file is missing, unreadable, or contains invalid/corrupt JSON,
    /// standard defaults are returned silently without error.
    pub fn load() -> Self {
        Self::load_from_path(&resolve_settings_path())
    }

    /// Loads settings from a specific file path.
    ///
    /// Missing or corrupt files silently fallback to `AppSettings::default()`.
    pub fn load_from_path(path: &Path) -> Self {
        if !path.exists() {
            return Self::default();
        }

        match std::fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Self::default(),
        }
    }

    /// Saves the current settings to the default `settings.json` location.
    pub fn save(&self) -> Result<(), std::io::Error> {
        self.save_to_path(&resolve_settings_path())
    }

    /// Saves settings as formatted JSON to the specified path.
    pub fn save_to_path(&self, path: &Path) -> Result<(), std::io::Error> {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let json = serde_json::to_string_pretty(self)
            .map_err(std::io::Error::other)?;

        std::fs::write(path, json)
    }

    /// Adds a project file path to `recent_files`, deduplicating and capping at 10 items.
    pub fn add_recent_file(&mut self, path: impl Into<String>) {
        let p = path.into();
        self.recent_files.retain(|f| f != &p);
        self.recent_files.insert(0, p);
        if self.recent_files.len() > 10 {
            self.recent_files.truncate(10);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_settings_defaults() {
        let settings = AppSettings::default();
        assert_eq!(settings.default_resolution, (2048, 2048));
        assert_eq!(settings.export_directory, None);
        assert_eq!(settings.accent_color, DEFAULT_ACCENT_COLOR);
        assert!(settings.hotkey_overrides.is_empty());
        assert!(settings.recent_files.is_empty());
        assert_eq!(settings.autosave_interval_secs, 300);
    }

    #[test]
    fn test_settings_roundtrip_json() {
        let mut settings = AppSettings {
            default_resolution: (4096, 4096),
            export_directory: Some("C:/Textures/Exports".to_string()),
            accent_color: [0.2, 0.8, 0.4],
            autosave_interval_secs: 600,
            ..Default::default()
        };
        settings
            .hotkey_overrides
            .insert("SpawnMath".to_string(), "X".to_string());
        settings.add_recent_file("C:/project1.tlab");

        let json = serde_json::to_string_pretty(&settings).expect("Serialization failed");
        let loaded: AppSettings = serde_json::from_str(&json).expect("Deserialization failed");

        assert_eq!(settings, loaded);
    }

    #[test]
    fn test_settings_save_and_load_file() {
        let temp_dir = std::env::temp_dir().join("texturelab_settings_test");
        let temp_file = temp_dir.join("test_settings.json");

        let mut settings = AppSettings {
            default_resolution: (1024, 1024),
            ..Default::default()
        };
        settings
            .hotkey_overrides
            .insert("Undo".to_string(), "Ctrl+U".to_string());

        settings
            .save_to_path(&temp_file)
            .expect("Failed to save settings");

        let loaded = AppSettings::load_from_path(&temp_file);
        assert_eq!(settings, loaded);

        // Cleanup
        let _ = std::fs::remove_file(&temp_file);
        let _ = std::fs::remove_dir(&temp_dir);
    }

    #[test]
    fn test_settings_corrupt_fallback() {
        let temp_dir = std::env::temp_dir().join("texturelab_corrupt_test");
        let temp_file = temp_dir.join("corrupt_settings.json");

        let _ = std::fs::create_dir_all(&temp_dir);
        std::fs::write(&temp_file, "{ this is invalid json !!!")
            .expect("Failed to write corrupt file");

        let loaded = AppSettings::load_from_path(&temp_file);
        assert_eq!(loaded, AppSettings::default());

        let _ = std::fs::remove_file(&temp_file);
        let _ = std::fs::remove_dir(&temp_dir);
    }

    #[test]
    fn test_settings_missing_fallback() {
        let nonexistent = PathBuf::from("nonexistent_dir_999/settings.json");
        let loaded = AppSettings::load_from_path(&nonexistent);
        assert_eq!(loaded, AppSettings::default());
    }

    #[test]
    fn test_settings_recent_files_cap_10() {
        let mut settings = AppSettings::default();
        for i in 0..15 {
            settings.add_recent_file(format!("project_{}.tlab", i));
        }

        assert_eq!(settings.recent_files.len(), 10);
        // Most recent should be at index 0
        assert_eq!(settings.recent_files[0], "project_14.tlab");
        assert_eq!(settings.recent_files[9], "project_5.tlab");

        // Re-adding existing moves it to index 0 without duplicates
        settings.add_recent_file("project_5.tlab");
        assert_eq!(settings.recent_files.len(), 10);
        assert_eq!(settings.recent_files[0], "project_5.tlab");
    }
}
