//! Professional DCC Keyboard Dispatcher & Input Guards (Phase 5).
//!
//! Provides workstation hotkey shortcuts (`Tab`, `F`, `1`, `3`, `M`, `B`, `S`, `N`, `L`, `I`, `Ctrl+Z`, `Ctrl+Y`)
//! with strict input-focus guards ensuring text edits are never intercepted.

use egui::{InputState, Key};

/// Canonical actions triggered by DCC keyboard shortcuts.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
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
    /// Delete selected nodes or edges (`Delete` / `Backspace`).
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

/// Evaluates raw key and modifier states with an input-focus guard.
///
/// If `text_input_active` is true (e.g. typing in a parameter textbox or label),
/// single-character hotkeys are strictly suppressed.
pub fn resolve_hotkey(
    key: Key,
    ctrl: bool,
    shift: bool,
    text_input_active: bool,
) -> Option<HotkeyAction> {
    // If user is actively typing in a text field, single-letter hotkeys MUST be suppressed
    if text_input_active {
        return None;
    }

    // Ctrl combinations
    if ctrl {
        if !shift && key == Key::Z {
            return Some(HotkeyAction::Undo);
        }
        if key == Key::Y || (shift && key == Key::Z) {
            return Some(HotkeyAction::Redo);
        }
        if key == Key::A {
            return Some(HotkeyAction::SelectAll);
        }
        if key == Key::S {
            return Some(HotkeyAction::SaveProject);
        }
        if key == Key::E {
            return Some(HotkeyAction::OpenExportDialog);
        }
        if key == Key::F {
            return Some(HotkeyAction::AutoLayout);
        }
        if key == Key::C {
            return Some(HotkeyAction::Copy);
        }
        if key == Key::V {
            return Some(HotkeyAction::Paste);
        }
        if key == Key::D {
            return Some(HotkeyAction::Duplicate);
        }
        return None;
    }

    // Single keys (only when no text field is focused)
    match key {
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
        Key::Delete | Key::Backspace => Some(HotkeyAction::DeleteSelected),
        _ => None,
    }
}

/// Dispatches hotkey actions from egui input state.
///
/// Uses `ctx.wants_keyboard_input()` or explicit text edit focus flag to protect text input.
pub fn dispatch_from_input(input: &InputState, text_input_active: bool) -> Option<HotkeyAction> {
    let ctrl = input.modifiers.command || input.modifiers.ctrl;
    let shift = input.modifiers.shift;

    let is_clicking = input.pointer.primary_down() || input.pointer.primary_pressed();

    for &key in &[
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
    ] {
        if input.key_pressed(key) {
            // When mouse is clicked/held, hold-key canvas quick spawn takes precedence
            if is_clicking && matches!(key, Key::Num1 | Key::Num3 | Key::M | Key::B | Key::L | Key::I | Key::Slash) {
                continue;
            }
            if let Some(action) = resolve_hotkey(key, ctrl, shift, text_input_active) {
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
}
