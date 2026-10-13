# Technical Design Specification: Workstation UI/UX Polish, Layout Persistence & Multi-Monitor Viewport

**Date:** 2026-10-11  
**Status:** Approved (Post Grill-Me Understanding Lock)  
**Target:** Pure Rust Desktop Engine (`eframe` 0.31, `egui` 0.31, `egui_dock` 0.16)

---

## 1. Overview & Problem Statement

This specification defines the architectural and user-experience upgrades for TextureLAB:
1. Elevating visual design across canvas nodes and library panels with harmonious 5% opacity pastel color-coding.
2. Refining tactile canvas interaction with critically damped exponential smooth pan lag matching the zoom experience.
3. Enabling explicit Save/Load layout persistence to/from JSON files, with a redesigned default layout prioritizing canvas workspace.
4. Transforming the 2D Viewport into a live reactive inspector with node locking, strictly graphic minimalist controls (zero emojis, zero wordy labels), and 100% pure Rust native OS multi-monitor undocking.
5. Completely purging marketing filler and AI-slop texts across the workstation interface.

---

## 2. Requirements Traceability Matrix

| Requirement | Description | Target Module | Implementation Strategy |
|---|---|---|---|
| **REQ-1** | Precision DCC dark styling on nodes and library | `ui/theme.rs`, `ui/canvas.rs`, `ui/library.rs` | Solid dark charcoal card body (`#1B1A1E`), 2.5px top category accent bar, transparent idle library rows with `#24242A` hover and 2px left accent strip. Pastel body glazes completely purged. |
| **REQ-2** | Remove `+ Add` button from library panel | `ui/library.rs` | Eliminate button; entire row acts as interactive click-to-spawn and drag-and-drop source. |
| **REQ-3** | Subtle smooth pan lag like zoom | `ui/canvas.rs` | Exponential decay LERP (`target_pan` vs `current_pan` with `1.0 - (-18.0 * dt).exp()`) with continuous repaint until resting. |
| **REQ-4** | Hover effects in Node Library panel | `ui/library.rs` | 1px left accent bar, background tint brightening to 16% on hover, pointing hand cursor. |
| **REQ-5** | Save and load layout; default layout redesign | `ui/mod.rs`, `app.rs`, `Cargo.toml` | Enable `egui_dock/serde`, add `View -> Save Layout...`, `View -> Load Layout...`, `View -> Reset to Default Layout`. Default: Canvas 65%, Library 18%, Viewport & Inspector right stacked 50%/50%, Export hidden. |
| **REQ-6** | Live 2D Viewport on selection, Lock node, minimal graphic toolbar, undock to monitor | `ui/viewport.rs`, `app.rs` | Viewport tracks selection; Lock icon pins `NodeId` with canvas pin badge; geometric vector icon toolbar; pure Rust `eframe::show_viewport_immediate` secondary OS window. |
| **REQ-7** | Purge marketing & AI-slop texts | `main.rs`, `app.rs`, `lib.rs`, `ui/mod.rs` | Window title `TextureLAB`, tab titles without emojis or subtitles, minimal About box, concise status bar indicators. |

---

## 3. Architecture & Component Boundaries

### 3.1 Pastel Theme Tokens & Vector Icons (`src/ui/theme.rs`)
- `category_pastel_color(cat: NodeCategory) -> Color32`: Computes a desaturated, high-value pastel tint for each category.
- `category_pastel_tint_5(cat: NodeCategory) -> Color32`: 5% opacity background fill (`alpha = 13`).
- `category_pastel_tint_16(cat: NodeCategory) -> Color32`: 16% opacity hover fill (`alpha = 41`).
- Zero-emoji geometric vector painters:
  - Lock / Unlock icon painter.
  - Undock / Pop-out icon painter.
  - Channel glyphs (RGB, R, G, B, A, Checkerboard quad).
  - Tiling glyphs (1x, 2x, 4x).
  - Zoom 1:1 and Fit glyphs.

### 3.2 Canvas Smooth Pan & Locked Node Badge (`src/ui/canvas.rs`)
- **State Additions**:
  ```rust
  pub struct CanvasState {
      pub pan: Vec2,
      pub target_pan: Vec2,
      pub zoom: f32,
      pub selected_node: Option<NodeId>,
      pub locked_viewport_node: Option<NodeId>,
      // ...
  }
  ```
- **Critically Damped LERP**:
  ```rust
  let dt = ui.input(|i| i.stable_dt).clamp(0.001, 0.1);
  let pan_diff = self.target_pan - self.pan;
  if pan_diff.length_sq() > 0.04 {
      let t = 1.0 - (-20.0 * dt).exp();
      self.pan += pan_diff * t;
      ui.ctx().request_repaint();
  } else {
      self.pan = self.target_pan;
  }
  ```
- **Node Card Background**: Render a rounded horizontal band filled with `category_pastel_tint_5(cat)` behind the node body.
- **Lock Badge**: If `locked_viewport_node == Some(node.id)`, render a subtle 12px circular pin/lock badge in the card top-right corner.

### 3.3 Node Library Polish (`src/ui/library.rs`)
- Remove the `+ Add` button column completely.
- Each item row is rendered as an interactive horizontal card:
  - Left border: 1.5px vertical category accent strip.
  - Background: 5% pastel category tint default, brightening to 16% on hover.
  - Cursor: `egui::CursorIcon::PointingHand`.
  - Click: Emits `SpawnNodeAt` at canvas center.
  - Drag: Initiates standard `egui::DragAndDrop` payload for canvas drop.

### 3.4 Layout Management & Serialization (`src/ui/mod.rs` & `src/app.rs`)
- In `Cargo.toml`:
  ```toml
  egui_dock = { version = "0.16", features = ["serde"] }
  ```
- `default_dock_layout()`:
  - Root split left: `Tab::Library` (0.18 width).
  - Center: `Tab::NodeCanvas` (primary focal area, ~0.65 of remainder).
  - Right: Split vertically:
    - Top: `Tab::Viewport2D` (0.50 height).
    - Bottom: `Tab::Inspector` (0.50 height).
  - `Tab::ExportDrawer` is omitted from the active layout tree (opened on demand via `Ctrl+E` or `View -> Export Preflight`).
- Menu options:
  - `View -> Save Layout...`: Uses `rfd::FileDialog::save_file()` to write `serde_json::to_string_pretty(&dock_state)`.
  - `View -> Load Layout...`: Uses `rfd::FileDialog::pick_file()` to parse JSON into `DockState<Tab>`.
  - `View -> Reset to Default Layout`: Restores `default_dock_layout()`.

### 3.5 2D Viewport & Native Multi-Monitor Undocking (`src/ui/viewport.rs` & `src/app.rs`)
- **State Additions**:
  ```rust
  pub struct ViewportState {
      pub isolation: ChannelIsolation,
      pub tiling: TilingMode,
      pub zoom: f32,
      pub pan: Vec2,
      pub locked_node: Option<NodeId>,
      pub is_undocked: bool,
      // ...
  }
  ```
- **Live Reactivity**:
  In `AppTabViewer::ui(Tab::Viewport2D)`:
  - Target node ID: `viewport_state.locked_node.or(canvas_state.selected_node)`.
  - Automatically retrieves and displays the evaluated output buffer of the target node.
- **Graphic Minimal Toolbar**:
  - Pure geometric icon buttons: Lock toggle, Pop-out monitor, Channel switches (RGB, Checker, R, G, B, A), Tiling (1x, 2x, 4x), 1:1, and Fit. Zero verbose labels.
- **Pure Rust Native OS Secondary Window**:
  - When `is_undocked == true`:
    ```rust
    ctx.show_viewport_immediate(
        egui::ViewportId::from_hash_of("viewport_2d_secondary_window"),
        egui::ViewportBuilder::default()
            .with_title("2D Viewport — TextureLAB")
            .with_inner_size([800.0, 600.0])
            .with_min_inner_size([400.0, 300.0]),
        |ctx, class| {
            // Render ViewportState::show with Dock Back button
        }
    );
    ```
  - When popped out, `Tab::Viewport2D` displays a clean placeholder in the dock area ("2D Viewport popped out to separate monitor [Dock Back]") or is unlinked until docked back.

### 3.6 Slop Text Purge
- `src/main.rs`: Window title `.with_title("TextureLAB")`.
- `src/app.rs`:
  - Header right label: Simple edition tag `[Pro]`.
  - Edition menu: Clean selectable radio items without bullet-point marketing pitches.
  - About dialog: Clean `TextureLAB v1.0.0 Pro` card with build info; all "100% Native", "Zero Electron", "Rayon SIMD" bullet points removed.
  - Status bar: Minimal, scannable technical indicators (`Nodes: X | Edges: Y | Eval: Z ms | Res: WxH`).
- `src/ui/mod.rs`: Tab titles stripped of emoji icons (`Node Canvas`, `2D Viewport`, `Inspector`, `Library`, `Export`).

---

## 4. Decision Log

- **Decision 1: Pure Rust Native OS Multi-Viewport (`ctx.show_viewport_immediate`)**
  - *Alternatives Evaluated*: In-app floating `egui::Window` vs multi-viewport.
  - *Rationale*: Allows genuine multi-monitor workflows (moving the viewport to a second physical screen) in 100% pure Rust with zero third-party wrapper dependencies.
  - *Trade-offs Accepted*: Requires handling window close event to automatically restore docked state.

- **Decision 2: Critically Damped Exponential LERP for Canvas Pan**
  - *Alternatives Evaluated*: Raw per-frame drag delta vs inertia throw vs critically damped LERP.
  - *Rationale*: Critically damped decay eliminates mouse jitter and matches smooth zoom physics without loose rubber-banding.
  - *Trade-offs Accepted*: Continuous repaint requested while pan difference exceeds 0.2px threshold.

- **Decision 3: Explicit Layout JSON Save/Load via Menu**
  - *Alternatives Evaluated*: Auto-save layout on exit vs explicit file dialogs.
  - *Rationale*: Follows explicit user instruction to avoid unwanted layout overwrites and gives users full control over custom preset files.
  - *Trade-offs Accepted*: Layout resets to default on cold launch unless loaded from file or default is preserved.

- **Decision 4: Substance Designer Precision Dark Theme & Pastel Glaze Purge**
  - *Alternatives Evaluated*: 5% pastel full-card body tint vs Unreal Engine header block vs Substance Designer precision dark cards.
  - *Rationale*: Full-card pastel body tint degraded dark theme contrast, produced a milky/washed-out haze on dark cards, and impaired socket pin legibility. Replaced with solid charcoal card bodies (`#1B1A1E`), 2.5px crisp top category accent bar, tactical slate canvas background (`#121214`), high-contrast dot grid (`#282830` / `#40404C`), and transparent idle list rows with `#24242A` hover.
  - *Trade-offs Accepted*: Category identification relies on top/left accent geometry rather than whole-card color tinting.

---

## 5. Testing & Verification Strategy

1. **Unit Tests**:
   - Verify layout serialization and deserialization roundtrip.
   - Verify pastel color token calculations and alpha clamps.
   - Verify viewport lock and live selection resolution logic.
2. **Integration Verification**:
   - `cargo test`: All tests passing cleanly.
   - `cargo build --release`: Verify release compilation with zero warnings and exit code 0.
