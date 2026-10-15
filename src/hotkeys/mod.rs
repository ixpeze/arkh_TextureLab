//! Professional DCC Keyboard Dispatcher & Hotkey Remap Engine (Phase 2 & Phase 5).
//!
//! Provides workstation hotkey shortcuts (`Tab`, `F`, `1`, `3`, `M`, `B`, `S`, `N`, `L`, `I`, `Ctrl+Z`, `Ctrl+Y`)
//! with strict input-focus guards, user-customizable overrides from `settings.json`, and default table exposure.

use std::collections::HashMap;
use egui::{InputState, Key};
use serde::{Deserialize, Serialize};

/// Canonical actions triggered by DCC keyboard shortcuts.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HotkeyAction {
    /// Open the floating node search & spawn palette (`Tab`).
    OpenSearchPalette,
    /// Frame canvas focus onto selected nodes or all nodes (`F`).
    FrameAll,
    /// Spawn Constant Scalar node (`1`).
    SpawnConstantScalar,
    /// Spawn Constant Color node (`3`).
    SpawnConstantColor,
    /// Spawn Math node (`M`).
    SpawnMath,
    /// Spawn Layer Blend node (`B`).
    SpawnBlend,
    /// Spawn Channel Splitter (Unpack) node (`S`).
    SpawnSplitter,
    /// Spawn Normal Flip Green node (`N`).
    SpawnNormalFlipGreen,
    /// Spawn Levels adjustment node (`L`).
    SpawnLevels,
    /// Spawn Invert node (`I`).
    SpawnInvert,
    /// Spawn Channel Combiner (Pack) node (`C` or `P`).
    SpawnCombiner,
    /// Undo transaction (`Ctrl + Z`).
    Undo,
    /// Redo transaction (`Ctrl + Y` or `Ctrl + Shift + Z`).
    Redo,
    /// Select all nodes in graph (`Ctrl + A`).
    SelectAll,
    /// Delete selected nodes or edges (`Delete`).
    DeleteSelected,
    /// Save project file (`Ctrl + S`).
    SaveProject,
    /// Open export dialog drawer (`Ctrl + E`).
    OpenExportDialog,
    /// Auto-layout graph nodes into compact non-overlapping arrangement (`Ctrl + F`).
    AutoLayout,
    /// Copy selected nodes to clipboard (`Ctrl + C`).
    Copy,
    /// Paste clipboard contents into graph (`Ctrl + V`).
    Paste,
    /// Duplicate selected nodes (`Ctrl + D`).
    Duplicate,
    /// Spawn Comment box (`/` or `Slash`).
    SpawnComment,
}

impl HotkeyAction {
    /// Canonical internal name for settings serialization and overrides dictionary key.
    pub fn name(&self) -> &'static str {
        match self {
            Self::OpenSearchPalette => "OpenSearchPalette",
            Self::FrameAll => "FrameAll",
            Self::SpawnConstantScalar => "SpawnConstantScalar",
            Self::SpawnConstantColor => "SpawnConstantColor",
            Self::SpawnMath => "SpawnMath",
            Self::SpawnBlend => "SpawnBlend",
            Self::SpawnSplitter => "SpawnSplitter",
            Self::SpawnNormalFlipGreen => "SpawnNormalFlipGreen",
            Self::SpawnLevels => "SpawnLevels",
            Self::SpawnInvert => "SpawnInvert",
            Self::SpawnCombiner => "SpawnCombiner",
            Self::SpawnComment => "SpawnComment",
            Self::Undo => "Undo",
            Self::Redo => "Redo",
            Self::SelectAll => "SelectAll",
            Self::DeleteSelected => "DeleteSelected",
            Self::SaveProject => "SaveProject",
            Self::OpenExportDialog => "OpenExportDialog",
            Self::AutoLayout => "AutoLayout",
            Self::Copy => "Copy",
            Self::Paste => "Paste",
            Self::Duplicate => "Duplicate",
        }
    }

    /// User-friendly label for preferences UI tables and dialogs.
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::OpenSearchPalette => "Open Search Palette",
            Self::FrameAll => "Frame All Nodes",
            Self::SpawnConstantScalar => "Spawn Constant Scalar (1)",
            Self::SpawnConstantColor => "Spawn Constant Color (3)",
            Self::SpawnMath => "Spawn Math Node",
            Self::SpawnBlend => "Spawn Blend Node",
            Self::SpawnSplitter => "Spawn Channel Splitter",
            Self::SpawnNormalFlipGreen => "Spawn Normal Flip Green",
            Self::SpawnLevels => "Spawn Levels Node",
            Self::SpawnInvert => "Spawn Invert Node",
            Self::SpawnCombiner => "Spawn Channel Combiner",
            Self::SpawnComment => "Spawn Comment Box",
            Self::Undo => "Undo",
            Self::Redo => "Redo",
            Self::SelectAll => "Select All",
            Self::DeleteSelected => "Delete Selected",
            Self::SaveProject => "Save Project",
            Self::OpenExportDialog => "Export Textures",
            Self::AutoLayout => "Auto Layout Graph",
            Self::Copy => "Copy Nodes",
            Self::Paste => "Paste Nodes",
            Self::Duplicate => "Duplicate Nodes",
        }
    }

    /// Parses an action from its canonical name or common case variations.
    pub fn from_name(s: &str) -> Option<Self> {
        let trimmed = s.trim();
        let lower = trimmed.to_ascii_lowercase();
        match lower.as_str() {
            "opensearchpalette" | "searchpalette" | "palette" => Some(Self::OpenSearchPalette),
            "frameall" | "frame" => Some(Self::FrameAll),
            "spawnconstantscalar" | "constantscalar" | "scalar" => Some(Self::SpawnConstantScalar),
            "spawnconstantcolor" | "constantcolor" | "color" => Some(Self::SpawnConstantColor),
            "spawnmath" | "math" => Some(Self::SpawnMath),
            "spawnblend" | "blend" | "layerblend" => Some(Self::SpawnBlend),
            "spawnsplitter" | "splitter" | "channelsplit" => Some(Self::SpawnSplitter),
            "spawnnormalflipgreen" | "normalflipgreen" | "flipgreen" => Some(Self::SpawnNormalFlipGreen),
            "spawnlevels" | "levels" => Some(Self::SpawnLevels),
            "spawninvert" | "invert" => Some(Self::SpawnInvert),
            "spawncombiner" | "combiner" | "channelcombine" => Some(Self::SpawnCombiner),
            "spawncomment" | "comment" => Some(Self::SpawnComment),
            "undo" => Some(Self::Undo),
            "redo" => Some(Self::Redo),
            "selectall" => Some(Self::SelectAll),
            "deleteselected" | "delete" => Some(Self::DeleteSelected),
            "saveproject" | "save" => Some(Self::SaveProject),
            "openexportdialog" | "export" | "exportdialog" => Some(Self::OpenExportDialog),
            "autolayout" | "layout" => Some(Self::AutoLayout),
            "copy" => Some(Self::Copy),
            "paste" => Some(Self::Paste),
            "duplicate" => Some(Self::Duplicate),
            _ => None,
        }
    }
}

/// Represents a parsed key chord (e.g. `Ctrl + Shift + Z` or `M`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct KeyChord {
    pub key: Key,
    pub ctrl: bool,
    pub shift: bool,
}

impl KeyChord {
    pub fn new(key: Key, ctrl: bool, shift: bool) -> Self {
        Self { key, ctrl, shift }
    }

    pub fn matches(&self, key: Key, ctrl: bool, shift: bool) -> bool {
        self.key == key && self.ctrl == ctrl && self.shift == shift
    }
}

/// Parses a human-readable key string like `"Ctrl+Z"`, `"Shift+M"`, `"Tab"`, `"1"`, `"/"`.
pub fn parse_key_chord(s: &str) -> Option<KeyChord> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }

    let mut ctrl = false;
    let mut shift = false;
    let mut key_str = s;

    // Repeatedly peel modifiers
    loop {
        let lower = key_str.to_ascii_lowercase();
        if let Some(rest) = lower.strip_prefix("ctrl+").or_else(|| lower.strip_prefix("ctrl + ")) {
            ctrl = true;
            let offset = key_str.len() - rest.len();
            key_str = key_str[offset..].trim_start();
        } else if let Some(rest) = lower.strip_prefix("cmd+").or_else(|| lower.strip_prefix("cmd + ")) {
            ctrl = true;
            let offset = key_str.len() - rest.len();
            key_str = key_str[offset..].trim_start();
        } else if let Some(rest) = lower.strip_prefix("control+").or_else(|| lower.strip_prefix("control + ")) {
            ctrl = true;
            let offset = key_str.len() - rest.len();
            key_str = key_str[offset..].trim_start();
        } else if let Some(rest) = lower.strip_prefix("shift+").or_else(|| lower.strip_prefix("shift + ")) {
            shift = true;
            let offset = key_str.len() - rest.len();
            key_str = key_str[offset..].trim_start();
        } else {
            break;
        }
    }

    let key = parse_single_key(key_str.trim())?;
    Some(KeyChord { key, ctrl, shift })
}

/// Parses a single key token into an `egui::Key`.
pub fn parse_single_key(s: &str) -> Option<Key> {
    let lower = s.to_ascii_lowercase();
    match lower.as_str() {
        "a" => Some(Key::A),
        "b" => Some(Key::B),
        "c" => Some(Key::C),
        "d" => Some(Key::D),
        "e" => Some(Key::E),
        "f" => Some(Key::F),
        "g" => Some(Key::G),
        "h" => Some(Key::H),
        "i" => Some(Key::I),
        "j" => Some(Key::J),
        "k" => Some(Key::K),
        "l" => Some(Key::L),
        "m" => Some(Key::M),
        "n" => Some(Key::N),
        "o" => Some(Key::O),
        "p" => Some(Key::P),
        "q" => Some(Key::Q),
        "r" => Some(Key::R),
        "s" => Some(Key::S),
        "t" => Some(Key::T),
        "u" => Some(Key::U),
        "v" => Some(Key::V),
        "w" => Some(Key::W),
        "x" => Some(Key::X),
        "y" => Some(Key::Y),
        "z" => Some(Key::Z),
        "0" | "num0" => Some(Key::Num0),
        "1" | "num1" => Some(Key::Num1),
        "2" | "num2" => Some(Key::Num2),
        "3" | "num3" => Some(Key::Num3),
        "4" | "num4" => Some(Key::Num4),
        "5" | "num5" => Some(Key::Num5),
        "6" | "num6" => Some(Key::Num6),
        "7" | "num7" => Some(Key::Num7),
        "8" | "num8" => Some(Key::Num8),
        "9" | "num9" => Some(Key::Num9),
        "tab" => Some(Key::Tab),
        "delete" | "del" => Some(Key::Delete),
        "backspace" => Some(Key::Backspace),
        "slash" | "/" => Some(Key::Slash),
        "space" => Some(Key::Space),
        "enter" | "return" => Some(Key::Enter),
        "escape" | "esc" => Some(Key::Escape),
        "f1" => Some(Key::F1),
        "f2" => Some(Key::F2),
        "f3" => Some(Key::F3),
        "f4" => Some(Key::F4),
        "f5" => Some(Key::F5),
        "f6" => Some(Key::F6),
        "f7" => Some(Key::F7),
        "f8" => Some(Key::F8),
        "f9" => Some(Key::F9),
        "f10" => Some(Key::F10),
        "f11" => Some(Key::F11),
        "f12" => Some(Key::F12),
        _ => None,
    }
}

/// Formats a key chord into a standard string representation like `"Ctrl+Z"`.
pub fn format_key_chord(key: Key, ctrl: bool, shift: bool) -> String {
    let mut s = String::new();
    if ctrl {
        s.push_str("Ctrl+");
    }
    if shift {
        s.push_str("Shift+");
    }
    s.push_str(key_display_name(key));
    s
}

/// Converts an `egui::Key` into its canonical display string.
pub fn key_display_name(key: Key) -> &'static str {
    match key {
        Key::Num0 => "0",
        Key::Num1 => "1",
        Key::Num2 => "2",
        Key::Num3 => "3",
        Key::Num4 => "4",
        Key::Num5 => "5",
        Key::Num6 => "6",
        Key::Num7 => "7",
        Key::Num8 => "8",
        Key::Num9 => "9",
        Key::Slash => "/",
        Key::Delete => "Delete",
        Key::Backspace => "Backspace",
        Key::Tab => "Tab",
        Key::Space => "Space",
        Key::Enter => "Enter",
        Key::Escape => "Esc",
        _ => key.name(),
    }
}

/// Returns the complete default hotkey mapping table exposed for preferences UI.
pub fn default_hotkey_table() -> Vec<(HotkeyAction, &'static str)> {
    vec![
        (HotkeyAction::OpenSearchPalette, "Tab"),
        (HotkeyAction::FrameAll, "F"),
        (HotkeyAction::SpawnConstantScalar, "1"),
        (HotkeyAction::SpawnConstantColor, "3"),
        (HotkeyAction::SpawnMath, "M"),
        (HotkeyAction::SpawnBlend, "B"),
        (HotkeyAction::SpawnSplitter, "S"),
        (HotkeyAction::SpawnNormalFlipGreen, "N"),
        (HotkeyAction::SpawnLevels, "L"),
        (HotkeyAction::SpawnInvert, "I"),
        (HotkeyAction::SpawnCombiner, "C"),
        (HotkeyAction::SpawnComment, "/"),
        (HotkeyAction::Undo, "Ctrl+Z"),
        (HotkeyAction::Redo, "Ctrl+Y"),
        (HotkeyAction::SelectAll, "Ctrl+A"),
        (HotkeyAction::DeleteSelected, "Delete"),
        (HotkeyAction::SaveProject, "Ctrl+S"),
        (HotkeyAction::OpenExportDialog, "Ctrl+E"),
        (HotkeyAction::AutoLayout, "Ctrl+F"),
        (HotkeyAction::Copy, "Ctrl+C"),
        (HotkeyAction::Paste, "Ctrl+V"),
        (HotkeyAction::Duplicate, "Ctrl+D"),
    ]
}

/// Evaluates raw key and modifier states with an input-focus guard against default bindings.
pub fn resolve_hotkey(
    key: Key,
    ctrl: bool,
    shift: bool,
    text_input_active: bool,
) -> Option<HotkeyAction> {
    resolve_hotkey_with_overrides(key, ctrl, shift, text_input_active, None)
}

/// Evaluates key and modifier states against `settings.hotkey_overrides` first.
///
/// If the action has an override, use that key. Otherwise falls through to the default table.
pub fn resolve_hotkey_with_overrides(
    key: Key,
    ctrl: bool,
    shift: bool,
    text_input_active: bool,
    overrides: Option<&HashMap<String, String>>,
) -> Option<HotkeyAction> {
    // If user is actively typing in a text field, single-character hotkeys MUST be suppressed
    if text_input_active && !ctrl {
        return None;
    }

    // 1. Check settings.hotkey_overrides first
    if let Some(map) = overrides {
        if !map.is_empty() {
            for (action_name, key_str) in map {
                if let Some(action) = HotkeyAction::from_name(action_name) {
                    if let Some(chord) = parse_key_chord(key_str) {
                        if chord.matches(key, ctrl, shift) {
                            return Some(action);
                        }
                    }
                }
            }
        }
    }

    // Helper: checks if a default action is overridden (if overridden, its default key is suppressed)
    let is_overridden = |action: HotkeyAction| -> bool {
        if let Some(map) = overrides {
            map.contains_key(action.name())
        } else {
            false
        }
    };

    // 2. Fall through to default table
    if ctrl {
        if !shift && key == Key::Z {
            return if is_overridden(HotkeyAction::Undo) { None } else { Some(HotkeyAction::Undo) };
        }
        if key == Key::Y || (shift && key == Key::Z) {
            return if is_overridden(HotkeyAction::Redo) { None } else { Some(HotkeyAction::Redo) };
        }
        if key == Key::A {
            return if is_overridden(HotkeyAction::SelectAll) { None } else { Some(HotkeyAction::SelectAll) };
        }
        if key == Key::S {
            return if is_overridden(HotkeyAction::SaveProject) { None } else { Some(HotkeyAction::SaveProject) };
        }
        if key == Key::E {
            return if is_overridden(HotkeyAction::OpenExportDialog) { None } else { Some(HotkeyAction::OpenExportDialog) };
        }
        if key == Key::F {
            return if is_overridden(HotkeyAction::AutoLayout) { None } else { Some(HotkeyAction::AutoLayout) };
        }
        if key == Key::C {
            return if is_overridden(HotkeyAction::Copy) { None } else { Some(HotkeyAction::Copy) };
        }
        if key == Key::V {
            return if is_overridden(HotkeyAction::Paste) { None } else { Some(HotkeyAction::Paste) };
        }
        if key == Key::D {
            return if is_overridden(HotkeyAction::Duplicate) { None } else { Some(HotkeyAction::Duplicate) };
        }
        return None;
    }

    // Single keys (only when no text field is focused)
    let default_action = match key {
        Key::Tab => Some(HotkeyAction::OpenSearchPalette),
        Key::F => Some(HotkeyAction::FrameAll),
        Key::Num1 => Some(HotkeyAction::SpawnConstantScalar),
        Key::Num3 => Some(HotkeyAction::SpawnConstantColor),
        Key::M => Some(HotkeyAction::SpawnMath),
        Key::B => Some(HotkeyAction::SpawnBlend),
        Key::S => Some(HotkeyAction::SpawnSplitter),
        Key::N => Some(HotkeyAction::SpawnNormalFlipGreen),
        Key::L => Some(HotkeyAction::SpawnLevels),
        Key::I => Some(HotkeyAction::SpawnInvert),
        Key::C | Key::P => Some(HotkeyAction::SpawnCombiner),
        Key::Slash => Some(HotkeyAction::SpawnComment),
        Key::Delete => Some(HotkeyAction::DeleteSelected),
        _ => None,
    };

    if let Some(action) = default_action {
        if !is_overridden(action) {
            return Some(action);
        }
    }

    None
}

/// Convenience wrapper resolving hotkeys against an `AppSettings` instance.
pub fn resolve_hotkey_with_settings(
    key: Key,
    ctrl: bool,
    shift: bool,
    text_input_active: bool,
    settings: &crate::settings::AppSettings,
) -> Option<HotkeyAction> {
    resolve_hotkey_with_overrides(key, ctrl, shift, text_input_active, Some(&settings.hotkey_overrides))
}

/// Dispatches hotkey actions from egui input state using default mappings.
pub fn dispatch_from_input(input: &InputState, text_input_active: bool) -> Option<HotkeyAction> {
    dispatch_from_input_with_overrides(input, text_input_active, None)
}

/// Dispatches hotkey actions from egui input state with optional user overrides.
pub fn dispatch_from_input_with_overrides(
    input: &InputState,
    text_input_active: bool,
    overrides: Option<&HashMap<String, String>>,
) -> Option<HotkeyAction> {
    let ctrl = input.modifiers.command || input.modifiers.ctrl;
    let shift = input.modifiers.shift;
    let is_clicking = input.pointer.primary_down() || input.pointer.primary_pressed();

    // Check all keys pressed this frame from events
    for event in &input.events {
        if let egui::Event::Key { key, pressed: true, repeat: false, modifiers, .. } = event {
            let ev_ctrl = modifiers.command || modifiers.ctrl;
            let ev_shift = modifiers.shift;

            // When mouse is clicked/held, hold-key canvas quick spawn takes precedence
            if is_clicking && matches!(*key, Key::Num1 | Key::Num3 | Key::M | Key::B | Key::L | Key::I | Key::Slash) {
                continue;
            }

            if let Some(action) = resolve_hotkey_with_overrides(*key, ev_ctrl, ev_shift, text_input_active, overrides) {
                return Some(action);
            }
        }
    }

    // Candidate key scan fallback
    let mut candidate_keys = vec![
        Key::Tab,
        Key::F,
        Key::Num1,
        Key::Num3,
        Key::M,
        Key::B,
        Key::S,
        Key::N,
        Key::L,
        Key::I,
        Key::C,
        Key::P,
        Key::Slash,
        Key::Delete,
        Key::Backspace,
        Key::Z,
        Key::Y,
        Key::A,
        Key::E,
        Key::V,
        Key::D,
    ];

    if let Some(map) = overrides {
        for key_str in map.values() {
            if let Some(chord) = parse_key_chord(key_str) {
                if !candidate_keys.contains(&chord.key) {
                    candidate_keys.push(chord.key);
                }
            }
        }
    }

    for key in candidate_keys {
        if input.key_pressed(key) {
            if is_clicking && matches!(key, Key::Num1 | Key::Num3 | Key::M | Key::B | Key::L | Key::I | Key::Slash) {
                continue;
            }
            if let Some(action) = resolve_hotkey_with_overrides(key, ctrl, shift, text_input_active, overrides) {
                return Some(action);
            }
        }
    }

    None
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    fn test_hotkey_dispatch_guard_suppresses_single_letters_when_editing() {
        // TC-502: Single-letter keys ignored when typing in text fields
        let text_input_active = true;

        assert_eq!(resolve_hotkey(Key::S, false, false, text_input_active), None);
        assert_eq!(resolve_hotkey(Key::B, false, false, text_input_active), None);
        assert_eq!(resolve_hotkey(Key::M, false, false, text_input_active), None);
        assert_eq!(resolve_hotkey(Key::N, false, false, text_input_active), None);
        assert_eq!(resolve_hotkey(Key::L, false, false, text_input_active), None);
        assert_eq!(resolve_hotkey(Key::I, false, false, text_input_active), None);
        assert_eq!(resolve_hotkey(Key::F, false, false, text_input_active), None);
        assert_eq!(resolve_hotkey(Key::Tab, false, false, text_input_active), None);
        assert_eq!(resolve_hotkey(Key::Num1, false, false, text_input_active), None);
        assert_eq!(resolve_hotkey(Key::Num3, false, false, text_input_active), None);
        assert_eq!(resolve_hotkey(Key::Slash, false, false, text_input_active), None);
    }

    #[test]
    fn test_hotkey_dispatch_fires_when_not_editing() {
        let text_input_active = false;

        assert_eq!(
            resolve_hotkey(Key::S, false, false, text_input_active),
            Some(HotkeyAction::SpawnSplitter)
        );
        assert_eq!(
            resolve_hotkey(Key::B, false, false, text_input_active),
            Some(HotkeyAction::SpawnBlend)
        );
        assert_eq!(
            resolve_hotkey(Key::M, false, false, text_input_active),
            Some(HotkeyAction::SpawnMath)
        );
        assert_eq!(
            resolve_hotkey(Key::N, false, false, text_input_active),
            Some(HotkeyAction::SpawnNormalFlipGreen)
        );
        assert_eq!(
            resolve_hotkey(Key::L, false, false, text_input_active),
            Some(HotkeyAction::SpawnLevels)
        );
        assert_eq!(
            resolve_hotkey(Key::I, false, false, text_input_active),
            Some(HotkeyAction::SpawnInvert)
        );
        assert_eq!(
            resolve_hotkey(Key::Tab, false, false, text_input_active),
            Some(HotkeyAction::OpenSearchPalette)
        );
        assert_eq!(
            resolve_hotkey(Key::F, false, false, text_input_active),
            Some(HotkeyAction::FrameAll)
        );
        assert_eq!(
            resolve_hotkey(Key::Num1, false, false, text_input_active),
            Some(HotkeyAction::SpawnConstantScalar)
        );
        assert_eq!(
            resolve_hotkey(Key::Num3, false, false, text_input_active),
            Some(HotkeyAction::SpawnConstantColor)
        );
        assert_eq!(
            resolve_hotkey(Key::Slash, false, false, text_input_active),
            Some(HotkeyAction::SpawnComment)
        );
        assert_eq!(
            resolve_hotkey(Key::Delete, false, false, text_input_active),
            Some(HotkeyAction::DeleteSelected)
        );
        assert_eq!(
            resolve_hotkey(Key::Backspace, false, false, text_input_active),
            None
        );
    }

    #[test]
    fn test_ctrl_chords_dispatch() {
        let text_input_active = false;

        assert_eq!(
            resolve_hotkey(Key::Z, true, false, text_input_active),
            Some(HotkeyAction::Undo)
        );
        assert_eq!(
            resolve_hotkey(Key::Y, true, false, text_input_active),
            Some(HotkeyAction::Redo)
        );
        assert_eq!(
            resolve_hotkey(Key::Z, true, true, text_input_active),
            Some(HotkeyAction::Redo)
        );
        assert_eq!(
            resolve_hotkey(Key::A, true, false, text_input_active),
            Some(HotkeyAction::SelectAll)
        );
        assert_eq!(
            resolve_hotkey(Key::S, true, false, text_input_active),
            Some(HotkeyAction::SaveProject)
        );
        assert_eq!(
            resolve_hotkey(Key::E, true, false, text_input_active),
            Some(HotkeyAction::OpenExportDialog)
        );
        assert_eq!(
            resolve_hotkey(Key::F, true, false, text_input_active),
            Some(HotkeyAction::AutoLayout)
        );
        assert_eq!(
            resolve_hotkey(Key::C, true, false, text_input_active),
            Some(HotkeyAction::Copy)
        );
        assert_eq!(
            resolve_hotkey(Key::V, true, false, text_input_active),
            Some(HotkeyAction::Paste)
        );
        assert_eq!(
            resolve_hotkey(Key::D, true, false, text_input_active),
            Some(HotkeyAction::Duplicate)
        );
    }

    #[test]
    fn test_default_hotkey_table_exposure() {
        let table = default_hotkey_table();
        assert!(table.len() >= 20);
        assert!(table.contains(&(HotkeyAction::Undo, "Ctrl+Z")));
        assert!(table.contains(&(HotkeyAction::SpawnMath, "M")));
        assert!(table.contains(&(HotkeyAction::OpenSearchPalette, "Tab")));
    }

    #[test]
    fn test_key_chord_parse_and_format() {
        assert_eq!(
            parse_key_chord("Ctrl+Z"),
            Some(KeyChord::new(Key::Z, true, false))
        );
        assert_eq!(
            parse_key_chord("Ctrl + Shift + Z"),
            Some(KeyChord::new(Key::Z, true, true))
        );
        assert_eq!(
            parse_key_chord("Tab"),
            Some(KeyChord::new(Key::Tab, false, false))
        );
        assert_eq!(
            parse_key_chord("/"),
            Some(KeyChord::new(Key::Slash, false, false))
        );
        assert_eq!(
            parse_key_chord("1"),
            Some(KeyChord::new(Key::Num1, false, false))
        );

        assert_eq!(format_key_chord(Key::Z, true, false), "Ctrl+Z");
        assert_eq!(format_key_chord(Key::Z, true, true), "Ctrl+Shift+Z");
        assert_eq!(format_key_chord(Key::Slash, false, false), "/");
        assert_eq!(format_key_chord(Key::Num1, false, false), "1");
    }

    #[test]
    fn test_hotkey_override_resolution() {
        let mut overrides = HashMap::new();
        // Override SpawnMath from 'M' to 'X'
        overrides.insert("SpawnMath".to_string(), "X".to_string());
        // Override Undo from 'Ctrl+Z' to 'Ctrl+U'
        overrides.insert("Undo".to_string(), "Ctrl+U".to_string());

        // 1. Overridden key 'X' triggers SpawnMath
        assert_eq!(
            resolve_hotkey_with_overrides(Key::X, false, false, false, Some(&overrides)),
            Some(HotkeyAction::SpawnMath)
        );

        // 2. Old default 'M' no longer triggers SpawnMath
        assert_eq!(
            resolve_hotkey_with_overrides(Key::M, false, false, false, Some(&overrides)),
            None
        );

        // 3. Overridden key 'Ctrl+U' triggers Undo
        assert_eq!(
            resolve_hotkey_with_overrides(Key::U, true, false, false, Some(&overrides)),
            Some(HotkeyAction::Undo)
        );

        // 4. Old default 'Ctrl+Z' no longer triggers Undo
        assert_eq!(
            resolve_hotkey_with_overrides(Key::Z, true, false, false, Some(&overrides)),
            None
        );

        // 5. Unmodified actions still work normally via default table
        assert_eq!(
            resolve_hotkey_with_overrides(Key::B, false, false, false, Some(&overrides)),
            Some(HotkeyAction::SpawnBlend)
        );
        assert_eq!(
            resolve_hotkey_with_overrides(Key::A, true, false, false, Some(&overrides)),
            Some(HotkeyAction::SelectAll)
        );

        // 6. Text input guard still applies to overridden single keys
        assert_eq!(
            resolve_hotkey_with_overrides(Key::X, false, false, true, Some(&overrides)),
            None
        );
    }
}
