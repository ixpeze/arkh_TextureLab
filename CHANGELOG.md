# Changelog

All notable changes to **ARKH TextureLab** are documented in this file.
The project adheres to [Semantic Versioning](https://semver.org/) and follows [Conventional Commits](https://www.conventionalcommits.org/).

---

## [1.0.0] - 2026-10-10

### 🚀 Major Milestone — 100% Pure Rust Native Desktop Workstation

Complete re-architecture and ground-up refactoring of ARKH TextureLab into a pure, native Windows desktop application.
Eliminates Chromium, Electron, WebViews, and Node.js runtime overhead, compiling directly to an optimized standalone 5.2 MB native executable.

#### ⚡ Performance & Resource Breakthroughs
- **Binary Size:** Slashed from ~220 MB (Electron) to **5.2 MB** native Windows executable (`release/texturelab.exe`).
- **Cold Startup:** Accelerated from 3.5 – 5.5s down to **< 80 ms** instantaneous launch.
- **Memory Footprint:** Reduced idle RAM consumption from 350 – 500 MB down to **~45 MB**.
- **Execution Throughput:** Parallel multi-core SIMD processing via Rayon delivering sub-50ms 4K channel swizzling and packing.

#### 🛠️ Core Engine & Processing Architecture
- **Multi-Precision Buffer Pipeline (`src/core/`):**
  - High-performance `TextureBuffer` supporting R8, RGBA8, R16, RGBA16, and F32 HDR.
  - Multi-threaded Rayon iteration across all color and buffer transformations.
  - Byte-exact sRGB $\leftrightarrow$ Linear lookup table (LUT) color space conversions.
- **Topological DAG Engine (`src/graph/`):**
  - Reactive directed acyclic graph compiler utilizing Kahn's topological sort with instantaneous circular dependency detection.
  - Fine-grained dirty-node dependency propagation and memoized intermediate buffer caching.
  - 100-step transactional undo/redo history stack (`HistoryStack`) with atomic `.tlab` Serde JSON project serialization.
- **Lossless Codecs & TGA 2.0 (`src/export/`):**
  - Pure native PNG codec preserving raw color data at zero alpha (resolving audit F-01 Canvas2D data corruption permanently).
  - Truevision TGA 2.0 compliant encoder with official 26-byte `TRUEVISION-XFILE.\0` footer.
  - Direct Disk Exporter with Windows reserved device name sanitization (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) and atomic file replacement.

#### 🎨 Professional DCC Workstation GUI (`src/ui/`, `src/app.rs`)
- **Obsidian Graphite Blueprint Aesthetics:**
  - Tactical dark `#0a0b10` design system passing 15/15 WCAG AA contrast compliance standards.
  - Multi-panel docking workspace powered by `egui_dock` (Node Canvas, 2D Viewport, Properties Inspector, Library, Status Bar).
- **Interactive Node Canvas:**
  - Infinite pan/zoom canvas with cubic Bezier wire routing and semantic wire coloring (R=Red, G=Green, B=Blue, A=Gray, RGBA=White/Amber).
  - 3-tier zoom LOD (Full details, Compact sockets <0.7 zoom, Geometric blocks <0.4 zoom).
- **Dedicated 2D Viewport Inspector:**
  - Real-time channel isolation (`RGB`, `RGBA Checker`, `R`, `G`, `B`, `A` luminance).
  - GPU UV repeat tiling (`1x`, `2x`, `4x`) for instantaneous texture seam verification.
  - Precision pixel probe readout under cursor (`X, Y`, byte `0..255`, float `0.00..1.00`, Hex).
- **High-Throughput DCC Hotkeys:**
  - `Tab` floating quick-search palette with fuzzy query matching.
  - Fast node spawning chords: `F` (Frame All), `S` (Split), `C`/`P` (Combine), `M` (Math), `B` (Blend), `N` (Normal Flip), `L` (Levels), `I` (Invert), `1` (Scalar), `3` (Color).

#### 💎 Edition Capability Matrix
- Implemented `Edition` enum (`TextureLAB Lite` vs `TextureLAB Pro`).
- **Lite:** Unrestricted Channel Pack/Unpack, Lexical Normalizer & Wizard, PNG/TGA export, Basic Viewport, Engine presets.
- **Pro:** Reoriented Normal Mapping (RNM), 13-Op Math & Vector nodes, 16-Bit TIFF/EXR codecs, A/B Split Comparison & Histogram.
- Instant edition switching directly from top menu bar with clear feedback.

---

## [0.2.0] - 2026-10-05

- Prototype development release using hybrid Electron and web architecture (deprecated and replaced by Pure Rust v1.0.0).
