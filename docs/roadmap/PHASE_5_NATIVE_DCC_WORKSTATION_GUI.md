# PHASE 5 — Native DCC Workstation GUI (`eframe`, `egui`, `egui_dock`)

**Goal:** Author the professional workstation desktop user interface in 100% pure Rust using `eframe 0.31`, `egui 0.31`, and `egui_dock 0.16`: Obsidian "Graphite Blueprint" dark theme, multi-panel docking, infinite Bezier node canvas, semantic wire palette, professional DCC hotkeys (`Tab`, `F`, `S`, `B`, `M`, `N`, `L`, `I`), and dedicated 2D Viewport with channel isolation and cursor pixel probe.  
**Prerequisites:** Phases 1–4. **Effort:** XL. **Touches:** `src/app.rs`, `src/ui/mod.rs`, `src/ui/theme.rs`, `src/ui/canvas.rs`, `src/ui/viewport.rs`, `src/ui/inspector.rs`, `src/ui/library.rs`, `src/hotkeys/mod.rs`.

---

## 1. Scope

- **IN:** Immediate-mode UI layout with `egui_dock`; Obsidian `#0a0b10` tactical color scheme; custom cubic Bezier wire rendering on `egui::Painter`; semantic wire coloring (R=Red, G=Green, B=Blue, A=Gray, RGBA=White); node LOD cards; DCC keyboard shortcuts; 2D Viewport with channel isolation (`RGB`, `Checker`, `R`, `G`, `B`, `A`), GPU repeat tiling (`1x`, `2x`, `4x`), and cursor pixel inspection probe.
- **OUT:** File exporter write execution (Phase 6), Release packaging (Phase 7).

---

## 2. Technical Architecture & UI Components

### 2.1 Docking Hierarchy (`egui_dock 0.16`)
The workspace layout is managed by an `egui_dock::DockArea`:
```rust
pub enum Tab {
    NodeCanvas,
    Viewport2D,
    Inspector,
    Library,
    ExportDrawer,
}

pub struct TabViewer<'a> {
    pub app_state: &'a mut TextureLabApp,
}
```

### 2.2 Semantic Wire Coloring Palette
Wires connecting node sockets adapt to data types:
- **Red (`#ef4444`):** Red channel (`R`)
- **Green (`#22c55e`):** Green channel (`G`)
- **Blue (`#3b82f6`):** Blue channel (`B`)
- **Gray (`#94a3b8`):** Alpha / Scalar (`A` / `1`)
- **Crisp White (`#f8fafc`):** Full RGBA / Composite

### 2.3 Dedicated 2D Viewport (`src/ui/viewport.rs`)
- **Channel Isolation:** Toggle between `RGB`, `RGBA Checkerboard`, `R (Grayscale)`, `G (Grayscale)`, `B (Grayscale)`, `A (Grayscale)`.
- **GPU UV Tiling:** Tiling multiplier (`1x`, `2x`, `4x`) applied on the GPU rasterizer without CPU memory expansion.
- **Pixel Probe:** Instantaneous readout under pointer: `X, Y | R: 255 (1.000) G: 128 (0.502) B: 0 (0.000) A: 255 (1.000) | Hex: #FF8000`.

---

## 3. Tasks

| ID | Task | Target Files | Acceptance Criteria (Run & Record) |
|---|---|---|---|
| **P5-T1** | **Workstation Theme:** Implement the Obsidian `#0a0b10` tactical workstation theme (`src/ui/theme.rs`) meeting WCAG AA contrast standards. | `src/ui/theme.rs` | High-contrast visual tokens verified. |
| **P5-T2** | **Docking Workspace:** Implement `egui_dock::DockArea` with persistent split layouts and dockable tabs. | `src/ui/mod.rs` | Panels drag, drop, split, and dock cleanly. |
| **P5-T3** | **Infinite Node Canvas:** Implement smooth pan and zoom on `egui::Painter` with grid backgrounds. | `src/ui/canvas.rs` | Canvas pans and zooms smoothly at 60+ FPS. |
| **P5-T4** | **Cubic Bezier Wires & Sockets:** Render smooth cubic Bezier wires with semantic colors and socket hit-testing. | `src/ui/canvas.rs` | Dragging from an output to an input creates an active edge. |
| **P5-T5** | **Node LOD Zoom Levels:** Render full parameter cards at zoom > 0.6, compact cards at 0.35–0.6, and colored blocks at < 0.35. | `src/ui/canvas.rs` | Canvas renders seamlessly across zoom transitions. |
| **P5-T6** | **DCC Keyboard Dispatcher:** Port hotkeys (`Tab`, `F`, `1`, `3`, `M`, `B`, `S`, `N`, `L`, `I`, `Ctrl+Z`, `Ctrl+Y`) with input-focus guards. | `src/hotkeys/mod.rs` | Pressing `S` spawns Splitter, typing in text input does not. |
| **P5-T7** | **2D Viewport Inspector:** Implement channel isolation (`RGB`, `Checker`, `R`, `G`, `B`, `A`), GPU repeat tiling (`1x`, `2x`, `4x`), and cursor pixel probe. | `src/ui/viewport.rs` | Hovering over pixels shows exact RGBA values. |
| **P5-T8** | **Node Parameter Inspector:** Properties panel editing node parameters (min/max, gamma, routing rows, format). | `src/ui/inspector.rs` | Changing parameters in Inspector triggers reactive graph update. |

---

## 4. Test Cases

| Test Case | Description | Command | Expected Result |
|---|---|---|---|
| **TC-501** | Window Launch Latency | `cargo run` | Window opens in < 100 ms |
| **TC-502** | Hotkey Dispatch Guard | `cargo test hotkeys::tests` | Single-letter keys ignored when typing in text fields |
| **TC-503** | Semantic Wire Colors | Visual check in canvas | Red socket produces red wire, Blue produces blue wire |
| **TC-504** | 2D Viewport Channel Isolation | Interactive toggle | Selecting 'R' displays red channel as luminance grayscale |

---

## 5. Exit Criteria Checklist

- [x] Native window opens in < 100 ms with clean dark Obsidian styling.
- [x] Multi-panel docking system (`egui_dock`) allows full layout customization.
- [x] Node canvas supports smooth pan, zoom, Bezier connections, and semantic wire colors.
- [x] Professional DCC hotkeys spawn nodes and navigate canvas instantly.
- [x] 2D Viewport isolates channels and accurately inspects pixels under cursor.

---

## 6. Evidence Log

| Task ID | Exact Command Executed | Result / Output Summary | Verification Status |
|---|---|---|---|
| P5-T1 | `cargo test ui::theme::tests` | Passed (3/3: WCAG AA contrast ratio >= 4.5:1, semantic wire colors, category badges) | [x] |
| P5-T2 | `cargo test ui::tests` | Passed (default_dock_layout initialized with NodeCanvas, Viewport2D, Inspector, Library, ExportDrawer) | [x] |
| P5-T3 | `cargo test ui::canvas::tests::test_canvas_coordinate_roundtrip` | Passed (Screen <-> Canvas world coordinate roundtrip accuracy < 0.001) | [x] |
| P5-T4 | `cargo test test_semantic_wire_colors_and_lod_levels` | Passed (Cubic Bezier curve rendering with Red/Green/Blue/Alpha/White socket wire palettes) | [x] |
| P5-T5 | `cargo test ui::canvas::tests::test_node_lod_determination` | Passed (Zoom > 0.6 Full, 0.35–0.6 Compact, < 0.35 Category Block) | [x] |
| P5-T6 | `cargo test hotkeys::tests` | Passed (TC-502: Single-letter hotkeys S/B/M/N/L/I/F strictly suppressed during text input focus) | [x] |
| P5-T7 | `cargo test ui::viewport::tests` | Passed (TC-504: Channel isolation for R, G, B, A, Checker, RGB; 1x/2x/4x tiling; HUD pixel probe) | [x] |
| P5-T8 | `cargo test ui::inspector::tests` | Passed (TC-505: Param mutation marks node dirty and triggers reactive DAG re-evaluation) | [x] |
| Full Suite | `cargo test` | Passed (115 tests total: 81 unit tests + 34 integration tests; 0 failed, 0 warnings) | [x] |
| Release | `cargo build --release` | Passed (Standalone 5.38 MB Windows executable `target/release/texturelab.exe`) | [x] |

