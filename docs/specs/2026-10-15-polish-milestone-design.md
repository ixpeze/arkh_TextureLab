# Polish Milestone Technical Design Specification

- **Date**: 2026-10-15
- **Status**: Approved
- **Scope**: Node Library compactness, Blank Canvas defaults, Two-Way wire drag & drop, Cursor-context search box, Wire-drop auto-wiring, Backspace hotkey fix, and Export Textures redesign.

---

## 1. Objectives & Scope

This milestone polishes core workstation usability and interaction fluidity across seven key areas:
1. **Compact Node Library**: Reduce item height, font sizes, margins, and gaps, adding subtle alternating row horizontal banding.
2. **Blank Canvas Default**: Fresh app launch and `File → New Project` start on a clean blank graph displaying the Start Splash quick-actions card.
3. **Two-Way Wire Drag & Drop**: Enable wire initiation from either Output or Input pins, preserving full socket row horizontal band hit detection and correct Bezier curve orientation.
4. **Context-Aware Hot-Search Box**: Right-click on blank canvas spawns the search box directly at the cursor position (clamped to window rect); clicking outside, right-clicking, or pressing `Escape` dismisses it.
5. **Wire Drop Auto-Wire**: Releasing a dragged wire onto empty canvas opens the search palette at the release position; picking a node spawns it and automatically connects the origin pin to the most compatible slot.
6. **Backspace Accidental Deletion Elimination**: Remove `Key::Backspace` from node deletion; restrict deletion to `Key::Delete` with strict guards preventing deletion while text inputs or dialogs are focused.
7. **Export Textures Redesign**: Rename "Export Preflight" to "Export Textures" across menu, drawer, and tabs, and upgrade the drawer UI with modern cards, preset pills, directory status, validation badge, and an actionable targets table.

---

## 2. Architecture & Detailed Module Design

### 2.1 Compact Node Library (`src/ui/library.rs`)
- **Category Header**: Height reduced from `31.0` to `25.0` px; font size `11.5` px; padding `8.0` px.
- **Node Item**: Height reduced from `29.0` to `23.0` px; font size `11.0` px; margin `8.0` px.
- **Shortcut Keycap Badge**: Reduced to `18x14` px; font size `9.0` px.
- **Line Gap**: Spacing between node rows set to `1.5` px.
- **Horizontal Banding**: Alternating row backgrounds:
  - Even rows: `#20202A` (or `BG_CARD`)
  - Odd rows: `#242432`
  - Hover: `#2F2F40` with `BORDER_HOVER`

### 2.2 Blank Canvas Defaults (`src/app/state.rs`, `src/app/menu.rs`)
- `TextureLabApp::default()`:
  - `graph: Graph::new()`
  - `canvas_state.dismiss_splash = false`
- `File → New Project`:
  - `self.graph = Graph::new()`
  - `self.evaluator.invalidate_all()`
  - `self.history.clear()`
  - `self.project_metadata = ProjectMetadata::default()`
  - `self.project_file_path = None`
  - `self.canvas_state.dismiss_splash = false`
- `File → New from Template`: Preserved for full starter setups.

### 2.3 Two-Way Wire Drag & Drop (`src/ui/canvas/mod.rs`)
- In `src/ui/canvas/mod.rs`, relax wire drag initiation to allow both `pin_id.is_input` and `!pin_id.is_input`.
- Target socket compatibility validation:
  - Target must have opposite polarity: `target.is_input != drag.from_pin.is_input`.
  - Target must not belong to the same node: `target.node_id != drag.from_pin.node_id`.
- Connection creation:
  - If `from_pin.is_input == false`: `ConnectPins { from: drag.from_pin, to: target_pin }`
  - If `from_pin.is_input == true`: `ConnectPins { from: target_pin, to: drag.from_pin }`
- Bezier wire rendering:
  - If dragged from output: `p0` = output pin, `p3` = cursor / target.
  - If dragged from input: `p0` = cursor / target, `p3` = input pin.

### 2.4 Hot-Search Box Popup & Dismissal (`src/ui/canvas/search.rs`, `src/ui/canvas/mod.rs`)
- `SearchPaletteState`:
  - Add `pub screen_pos: Option<Pos2>`.
  - Add `pub source_pin: Option<PinId>`.
  - Add `pub open_at_screen(screen_pos: Pos2, canvas_pos: [f32; 2], source_pin: Option<PinId>)`.
- Positioning: Clamps `screen_pos` to screen bounds minus modal size `(360.0, 380.0)`.
- Canvas dismissal:
  - If search palette is open and user clicks or right-clicks on canvas outside the modal bounds, call `self.search_palette.close()`.
  - Pressing `Key::Escape` closes the palette.

### 2.5 Wire Drop Auto-Wire (`src/ui/canvas/mod.rs`, `src/app/mod.rs`, `src/app/state.rs`)
- On `response.drag_stopped()` with active wire drag and `hovered_pin.is_none()`:
  - Emits `CanvasAction::OpenSearchPaletteWithSource { screen_pos: ptr, canvas_pos: [pos.x, pos.y], source_pin: drag.from_pin }`.
- When search palette confirms node selection:
  - Spawns the node at `canvas_pos`.
  - Calls `auto_connect_compatible_pins(&mut self.graph, source_pin, new_node_id)`.
- **Slot Matching Priority**:
  1. Exact socket name match (e.g. `R` $\to$ `R`, `RGBA` $\to$ `RGBA`, `Normal` $\to$ `Normal`).
  2. Common color/channel compatibility (`RGB` $\to$ `RGBA`, `A` $\to$ `Alpha`).
  3. First compatible socket (`inputs[0]` if source is output, or `outputs[0]` if source is input).

### 2.6 Backspace Accidental Deletion Elimination (`src/hotkeys/mod.rs`, `src/ui/canvas/mod.rs`)
- In `src/hotkeys/mod.rs`:
  - Delete `Key::Backspace` mapping for `DeleteSelected`.
  - Only `Key::Delete` maps to `HotkeyAction::DeleteSelected`.
- In `src/ui/canvas/mod.rs`:
  - Remove `Key::Backspace` from canvas key listener.
  - Guard `Key::Delete` with:
    `!ui.ctx().wants_keyboard_input() && !ui.memory(|m| m.focused().is_some())`.

### 2.7 Export Textures Redesign (`src/app/mod.rs`, `src/app/menu.rs`, `src/ui/mod.rs`)
- Rename string constants:
  - Menu: `"Export Textures (Ctrl+E)"`
  - Tab title: `"Export Textures"`
  - Header: `"Export Textures Pipeline"`
  - Status messages: `"Opened Export Textures Drawer (Ctrl+E)"`
- Modern layout:
  - **Configuration Card**: Preset selector pills, Asset Name, Destination folder with browse button.
  - **Preflight Summary Card**: Visual health pill badge from validator.
  - **Export Targets Table**: Striped card table with node name, slot pill, format, dimensions, resolved filename, and readiness indicator (`[Ready]` in emerald, `[Unlinked]` in muted).
  - **Action Footer**: Prominent button `"Export Textures to Disk"` with count and live stats.

---

## 3. Verification & Safety Plan
1. `cargo test`: Ensure all unit and integration tests pass without failures.
2. `cargo clippy -- -D warnings`: Verify zero warnings.
3. Test suite coverage for:
   - Search palette `open_at_screen` and `source_pin` caching.
   - Hotkey resolution verifying `Backspace` does not delete selected nodes.
   - Blank graph startup state and `File → New Project`.
4. Manual verification of two-way drag, wire drop auto-wire, and Export Textures drawer.
