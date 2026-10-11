# Technical Specification: 100% Pure Rust Architecture Migration

**Date**: 2026-10-10  
**Status**: Approved (Understanding Lock Confirmed)  
**Author**: ARKH LAB / Antigravity

---

## 1. Executive Summary

This specification defines the complete migration of ARKH TextureLab into a **100% Pure Native Rust** workstation. The companion TypeScript/React 19 (`app/`) and Electron 44 (`desktop/`) subsystems are completely deprecated and removed. All workstation interfaces, canvas interactions, PBR DAG evaluations, and file ingestion pipelines will run natively in Rust using `eframe`, `egui`, and `egui_dock`.

### Key Benefits
* **Distribution Size**: Reduced from ~120 MB (Electron runtime) to ~12 MB (single portable native `.exe`).
* **Startup Latency**: Reduced from ~1.2s to < 50ms.
* **Memory Footprint**: Reduced from ~350 MB to ~45 MB in idle state.
* **Zero Dependencies**: No Node.js, npm, Electron, Chromium, or web views. Pure native OS execution.

---

## 2. Architectural Comparison

| Dimension | Approach A: eframe + egui_dock (Selected) | Approach B: Slint / Iced (Rejected) |
|---|---|---|
| **Code Reuse** | Reuses 100% of existing `src/ui/` (canvas, inspector, viewport, theme) | Requires rewriting all UI code from scratch |
| **Complexity** | Low-Medium (focused enhancements for UE navigation & OS drop) | Extremely High (complete UI rewrite) |
| **DCC Fidelity** | Proven game-dev standard for node graphs & dockable windows | Limited node-graph ecosystem |
| **Multi-Threading** | Direct zero-copy Rayon memory sharing with UI painter | Additional IPC or actor message layer needed |

---

## 3. Subsystem Implementation Plan

### 3.1 Unreal Engine Navigation & Hotkeys (`src/ui/canvas.rs`)
1. **Right-Click Drag vs. Tap Menu**:
   * On pointer down with secondary button: Record start screen position and timestamp.
   * If pointer displacement exceeds 5.0 pixels: Perform canvas pan.
   * If pointer released with displacement < 5.0 pixels and duration < 500ms: Emit `CanvasAction::OpenSearchPalette`.
2. **Alt + Click Wire / Pin Disconnect**:
   * When clicking an edge with `ui.input(|i| i.modifiers.alt)`: Emit `CanvasAction::DisconnectEdge(edge)`.
   * When clicking a socket pin with `ui.input(|i| i.modifiers.alt)`: Disconnect all edges attached to that pin.
3. **Hold-Key + Left-Click Quick Spawn**:
   * Listen for active hold keys: `Key::T` (TextureInput), `Key::Num1` (ConstantScalar), `Key::Num3` (ConstantColor), `Key::M` (Multiply), `Key::A` (Add), `Key::L` (LayerBlend), `Key::O` (Invert).
   * When primary click occurs on canvas pane while a hold key is active: Calculate world canvas coordinates and spawn node.
4. **Editor Keys**:
   * `Key::C`: Spawn Comment Box enclosing selection (or at mouse).
   * `Key::F`: Frame / center canvas on selection (`frame_focus`).

### 3.2 Native Windows Explorer Drag & Drop (`src/app.rs`)
* Intercept `ctx.input(|i| i.raw.dropped_files.clone())`.
* Filter for valid image formats: `.png`, `.tga`, `.jpg`, `.jpeg`, `.webp`, `.bmp`.
* For each dropped file:
  * Extract path or file bytes.
  * Run `crate::normalizer` lexical rules to infer asset name and PBR role (`Albedo`, `Normal`, `Roughness`, `Metallic`, `AO`, `Height`).
  * Spawn `TextureInput` node at cursor position (vertically stacked if multiple files).
  * Automatically evaluate and generate GPU/CPU texture preview.

### 3.3 Node Library Drag & Drop (`src/ui/library.rs`)
* Support dragging node items from the catalog tree onto the canvas.
* Clicking items in library or search palette continues to spawn at viewport center or mouse.

### 3.4 Cleanup & Deprecation
* Delete `app/` and `desktop/` directories.
* Update `run_desktop.bat` to execute `cargo run --release`.
* Delete `run_web.bat` and `run_desktop_dev.bat`.
* Update `setup.bat` to verify the Rust toolchain only.
* Update documentation: `docs/ARCHITECTURE.md`, `README.md`, `docs/DEV_SETUP.md`.

### 3.5 Portable Executable Build
* Execute `cargo build --release`.
* Copy `target/release/texturelab.exe` to `release/TextureLab.exe`.
* Verify binary launch and zero-regression tests (`cargo test`).

---

## 4. Decision Log

* **Decision**: Eliminate Electron/React shell in favor of 100% Pure Rust.
  * *Rationale*: User explicitly requested pure Rust with no wrapper or shell; existing Rust GUI already implements 90%+ of the functionality natively.
  * *Trade-off*: Web browser deployment is retired in favor of native desktop performance.
* **Decision**: Produce a single portable `.exe` without installers.
  * *Rationale*: User explicitly confirmed portable `.exe` is sufficient.
