# Architecture & System Design

ARKH TextureLab is a 100 % pure Rust PBR texture pipeline workstation.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  ARKH TextureLab — Pure Rust                    │
├─────────────────────────────────────────────────────────────────┤
│  Framework   : eframe 0.31 + egui 0.31 + egui_dock 0.16       │
│  Compute     : Rayon 1.10 multi-threaded parallel pipeline     │
│  Graph Engine: Topological DAG, dirty-subgraph invalidation    │
│  I/O & Codecs: PNG (8/16-bit), TGA 2.0, WebP, JPEG, BMP       │
│  PBR Lexical : 60+ naming conventions, auto-role classifier    │
│  Packaging   : Single portable .exe (~6 MB, zero dependencies) │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Map (`src/`)

### `src/core/` — Foundational Primitives
* **`buffer.rs`** — `TextureBuffer` (RGBA 8-bit backed by `image::RgbaImage`), `TextureBuffer16`, `TextureBufferF32`, `SharedTextureBuffer` (`Arc<TextureBuffer>`). Note: the evaluator currently processes at 8-bit only; 16-bit and float types exist but are used only in codecs.
* **`colorspace.rs`** — LUT-accelerated sRGB ↔ Linear conversions.

### `src/graph/` — DAG & Topological Evaluator
* **`model.rs`** — `Graph`, `Node`, `Edge`, `PinId`, `NodeParam`, `ProjectFile` (`.tlab` serialisation with `format_version`).
* **`compiler.rs`** — `GraphCompiler` with Kahn's algorithm, cycle detection, `downstream_nodes()`.
* **`evaluator.rs`** — `GraphEvaluator` (synchronous, memoised), `AsyncEvaluator` (background worker thread with natural debouncing via generation counters). Resolution inheritance: explicit param → upstream → default.
* **`history.rs`** — `HistoryStack` (100-entry capacity, coalesced slider drag recording).
* **`layout.rs`** — Auto-layout DAG algorithm and `texturelab_layout.json` persistence.

### `src/nodes/` — 19 Node Types in 8 Categories
* **I/O:** `TextureInput` (file + colour fallback + lexical PBR role), `SaveImage`.
* **Constants:** `ConstantScalar`, `ConstantColor` — currently produce full-resolution buffers.
* **Channel Ops:** `ChannelCombine`, `ChannelSplit`, `ChannelMixer`.
* **Colour Adjust:** `Invert`, `Levels`, `BrightnessContrast`.
* **Normal Ops:** `NormalFlipGreen`, `NormalNormalize`, `NormalStrength`.
* **Blend Ops:** `LayerBlend` (lerp + mask), `NormalBlendRNM`.
* **Math:** `Math` (13 operations), `Multiply`, `Add`.
* **Transform:** `Resize` (POT, bilinear/nearest).
* Executor dispatch: `PbrNodeExecutor` in `mod.rs` with alias matching.

### `src/normalizer/` — PBR Lexical Analysis
* **`dicts.rs`** — 60+ alias arrays for BaseColor, Normal, Roughness, Metallic, AO, Height, Glossiness, Displacement, Emissive, Opacity, etc.
* **`rules.rs`** — Filename normaliser: vendor prefix strip, resolution detection (1K–16K), PBR role inference, DirectX vs OpenGL normal detection.
* **`wizard.rs`** — One-click DAG construction from industry presets (UE5 ORM, Unity MaskMap, Blender Principled).

### `src/export/` — Channel Packing & Codecs
* **`codecs.rs`** — PNG 8/16-bit, TGA 2.0, WebP, JPEG, BMP. Thread-safe LRU disk cache for loaded images.
* **`presets.rs`** — Industry packing presets with channel routing tables.
* **`tokens.rs`** — Dynamic export path formatting (`{asset}_{slot}_{resolution}.{ext}`), UDIM placeholder.
* **`writer.rs`** — Preflight validation, reserved name sanitisation, atomic disk write.
* **`tga.rs`** — Byte-level TGA 2.0 reader/writer with custom footer.

### `src/ui/` — Obsidian Graphite Blueprint UI
* **`theme.rs`** — Complete dark theme tokens, category colours, pastel tints, vector icon painters.
* **`canvas.rs`** — Infinite pan/zoom canvas, Bezier wires, LOD node cards, right-click tap/drag discrimination, hold-key quick spawn, explorer drop.
* **`library.rs`** — Categorised node catalogue with search, drag-and-drop source.
* **`inspector.rs`** — Per-node property editor with sliders, colour pickers, dropdowns.
* **`viewport.rs`** — 2D preview with channel isolation, tiling, pixel probe, pin/undock, A/B split.
* **`mod.rs`** — `Tab` enum, `DockState` layout serialisation, default layout builder.

### `src/hotkeys/mod.rs` — Hotkey Table
Single source of truth for all keyboard shortcuts. Resolves modifier state, text-input suppression, and hold-key quick-spawn detection.

### `src/app.rs` — Application Lifecycle
`TextureLabApp` struct: owns `Graph`, `HistoryStack`, `AsyncEvaluator`, `CanvasState`, `ViewportState`, dock state, and status bar. Handles dropped files, menu bar, edition matrix (to be removed), and `eframe::App::update` loop.

---

## 3. Data Flow

```
User action (drop file / tweak param / connect wire)
  → HistoryStack::record()
  → GraphEvaluator::mark_dirty(node_id)
  → AsyncEvaluator::request_evaluation(graph.clone(), dirty_nodes)
  → [Worker thread] GraphCompiler::compile() → topological order
  → [Worker thread] For each dirty node: PbrNodeExecutor::execute()
  → AsyncEvalResponse { cache_snapshot, report }
  → UI thread: apply_cache_update() → viewport/canvas repaint
```

---

## 4. Known Architectural Gaps (v1.0)

| Gap | Impact | Planned Fix |
|---|---|---|
| Engine runs at 8-bit only | Height/normal banding | Upgrade evaluator to 16-bit pipeline |
| Constants produce full-res buffers | Wastes memory | 1-pixel value with broadcast semantics |
| No cache size limit | Unbounded memory on large graphs | LRU eviction or byte budget |
| `app.rs` / `canvas.rs` are 1,600+ lines | Hard to maintain | Extract into focused sub-modules |
| CI builds deleted web app | CI always fails | Rewritten for Rust (done) |
| No copy/paste, comments, reroute | Workflow friction | Wave 1 features |
| No autosave or crash recovery | Data loss risk | Wave 2 feature |
