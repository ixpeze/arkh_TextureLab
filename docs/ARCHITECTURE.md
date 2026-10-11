# Architecture & System Design

ARKH TextureLab is a 100% pure Rust PBR texture authoring, channel packing, and node-based image processing desktop workstation.

---

## 1. System Overview

```
+---------------------------------------------------------------------------------+
|                        ARKH TextureLab — 100% Pure Rust                         |
+---------------------------------------------------------------------------------+
|  * Framework: eframe 0.31 + egui 0.31 + egui_dock 0.16                          |
|  * Compute: Rayon 1.10 multi-threaded SIMD parallel image processing            |
|  * Graph Engine: Topological DAG evaluator with dirty-subgraph invalidation      |
|  * I/O & Codecs: Lossless 8-bit & 16-bit PNG, TGA 2.0, WebP, JPEG, BMP          |
|  * PBR Lexical Engine: 60+ industry naming conventions & auto-role classifier   |
|  * Packaging: Single standalone portable executable (~12 MB, zero dependencies) |
+---------------------------------------------------------------------------------+
```

---

## 2. Core Architecture (`src/`)

The application is written entirely in pure Rust (2021 edition), with zero Electron, zero WebViews, and zero Node.js dependencies.

### Subsystem Breakdown

1. **`src/core/` (Foundational Primitives)**
   * **Image Buffers (`TextureBuffer`)**: Multi-channel (RGBA) 8-bit, 16-bit, and 32-bit float uncompressed representations with thread-safe `SharedTextureBuffer` (`Arc<TextureBuffer>`).
   * **Color Models (`colorspace`)**: Fast LUT-accelerated sRGB <-> Linear photometric conversions.
   * **Channel Manipulation**: Zero-copy swizzling, splitting, and packing routines.

2. **`src/graph/` (DAG & Topological Evaluator)**
   * **Directed Acyclic Graph (`Graph`)**: Strongly-typed node graph model with pin IDs, parameters, and edges.
   * **Topological Sorter (`GraphCompiler`)**: Kahn's algorithm implementation determining optimal evaluation order with cycle detection.
   * **Dirty Tracking & Invalidation**: Granular subgraph invalidation; evaluates only nodes downstream of modified inputs.
   * **Evaluator Cache (`GraphEvaluator`)**: Output buffer caching with cache-hit tracking and sub-millisecond incremental execution.
   * **Transactional History (`HistoryStack`)**: 100-step capacity undo/redo history stack recording full graph snapshots.

3. **`src/normalizer/` (PBR Lexical Analysis & Auto-Pack Wizard)**
   * **Dictionary Engine (`dicts`)**: Recognition of 60+ industry naming conventions (Megascans, Poly Haven, Substance, Quixel, Unreal, Unity).
   * **Lexical Normalizer (`rules`)**: Strips vendor prefixes, detects resolutions (1K-16K), infers PBR roles, and identifies DirectX (-Y) vs OpenGL (+Y) normal map conventions.
   * **Pack Wizard (`wizard`)**: One-click DAG construction for standard industry packing presets (UE5 ORM, Unity MaskMap, Blender Principled).

4. **`src/nodes/` (Processing Catalog & 20+ Node Types)**
   * **I/O Nodes**: `TextureInput` (file or procedural color), `TextureOutput` (disk targets with slot assignment).
   * **Channel Manipulation**: `ChannelSplit`, `ChannelCombine`, `ChannelMixer`.
   * **Color & Normal Adjustments**: `Invert`, `Levels`, `NormalFlipGreen`, `NormalNormalize`, `NormalStrength`.
   * **Blend & Math Operations**: `LayerBlend` (with mask), `NormalBlendRNM` (Reoriented Normal Mapping), 13-operation `Math` node.
   * **Transforms**: Resolution resizing with bilinear and nearest filtering, power-of-two (POT) rounding.

5. **`src/export/` (Channel Packing & Preset Exporter)**
   * **Standard Presets**:
     * **Unreal Engine**: `ORM` (Occlusion = Red, Roughness = Green, Metallic = Blue).
     * **Unity HDRP**: `MaskMap` (Metallic = Red, AO = Green, Detail Mask = Blue, Smoothness = Alpha).
     * **Blender Principled**: Separate BaseColor, Roughness, Metallic, Normal (OpenGL).
   * **Token Engine**: Dynamic path formatting via tokens (`{asset}_{slot}_{resolution}.{ext}`).
   * **Direct Disk Exporter**: Preflight checks, reserved name sanitation, and atomic disk writes.

6. **`src/ui/` (Obsidian Graphite Blueprint Workstation UI)**
   * Built on [`egui`](https://crates.io/crates/egui) and [`egui_dock`](https://crates.io/crates/egui_dock).
   * **Docking Workspace**: Tabbed layout supporting Canvas, Inspector, Library, 2D Viewport, and Export Preflight Drawer.
   * **Infinite Node Canvas (`canvas.rs`)**:
     * Smooth 60+ FPS pan/zoom with React Flow dot grid.
     * Animated cubic Bezier wires with directional data-flow pulse.
     * 3-level LOD cards (Full, Compact, Block) adapting to zoom level.
     * Full-width horizontal socket row hit-zones with subtle, light horizontal hairline dividers separating distinct rows in nodes and the library panel.
     * **Unreal Engine Navigation Standards**:
       * Secondary button drag: smooth canvas panning.
       * Secondary button tap (< 5px): quick search spawn palette.
       * `Alt + Left Click` on pin: severs all wire connections to that pin.
       * `Alt + Left Click` on wire: severs the targeted Bezier edge.
       * `Hold Key + Left Click` quick-spawn:
         * `T` + Click: `TextureInput`
         * `1` + Click: `ConstantScalar`
         * `3` + Click: `ConstantColor`
         * `M` + Click: `Multiply`
         * `A` + Click: `Add`
         * `L` + Click: `LayerBlend`
         * `O` + Click: `Invert`
       * `F` key: frames canvas camera on graph contents or selection.
     * **Drag and Drop**:
       * Drag from Node Library onto canvas with ghost card preview and release spawn.
       * Drag image files from Windows Explorer directly into canvas with automatic lexical role classification and texture sampler instantiation.
   * **2D Viewport (`viewport.rs`)**: Channel isolation (R, G, B, A, RGB), pixel probe with RGBA readout, UV tiling (1x, 2x, 4x), and A/B split comparison.
   * **Inspector (`inspector.rs`)**: Categorized property controls with real-time reactive graph mutation.

---

## 3. Performance Guarantees

* **Zero Memory Leaks**: Rust ownership model guarantees deterministic memory deallocation during large batch operations.
* **Multi-threaded CPU Processing**: Image processing runs parallelized across all CPU cores via Rayon.
* **Instant Startup**: Workstation launches in under 80 milliseconds (compared to 1500+ ms for Electron).
* **Portable Distribution**: Ships as a single self-contained executable (~12 MB) with zero installer or runtime prerequisites.
