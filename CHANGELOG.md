# Changelog

All notable changes to **ARKH TextureLab** are documented in this file.
The project adheres to [Semantic Versioning](https://semver.org/) and follows [Conventional Commits](https://www.conventionalcommits.org/).

---

## [1.0.0] - 2026-10-06

### Major Release — Hardening, QA & First Production Release

This marks the official v1.0.0 production release of ARKH TextureLab, transitioning the product from an experimental prototype into a high-performance, workstation-grade PBR texture channel multiplexing workstation.

#### 🚀 Features & Enhancements

- **WebGL2 Demand-Driven GPU Engine (Phase 4)**
  - Replaced CPU evaluation with an asynchronous WebGL2 shader pipeline featuring a 1.5 GiB LRU VRAM pool.
  - Added topological compilation with frame-budgeted scheduling, 120ms idle refinement, and working-resolution governor (Auto/512/1K/2K/Full).
  - High-performance GPU readbacks using asynchronous Pixel Buffer Objects (PBOs).
  - All 8 shader families verified against golden CPU oracle fixtures within float tolerance (`npm run test:gpu`).

- **Byte-Exact PNG & TGA Codecs (Phase 4)**
  - Implemented pure-JS PNG and TGA decoders/encoders, eliminating browser Canvas2D premultiplied alpha data destruction (resolves audit F-01).
  - Full support for 16-bit PNG export with `EXT_color_buffer_float` validation.

- **Graphite Blueprint Workstation UI (Phase 5)**
  - Modern tactical dark theme (`#0a0b10`) with tokenized design system (`tokens.css`).
  - 15/15 WCAG AA contrast compliance verified via axe-core.
  - 3-tier node zoom LOD (<0.6 compact mode, <0.35 block mode) with 12px lettered sockets ('R', 'G', 'B', 'A', 'C', 'S').
  - Resizable 3-column workstation layout (persisted across sessions) with auto-collapse under 1280px.
  - Integrated 2D Inspector with A/B wipe slider, tiling repeat test, RGBA channel isolation, and crosshair pixel probe.
  - Docked telemetry status bar reporting live GPU renderer, VRAM usage, and document dirty status.

- **Pack & Unpack Wizard (Phase 5)**
  - Auto-detects texture naming patterns from dropped folders or files (`_AO`, `_Roughness`, `_Metallic`, `_Height`, `_Normal`, `_ORM`, `_RMA`).
  - Generates complete, pre-wired packing or unpacking pipelines in under 3 clicks.

- **12 Modular Node Families (Phase 1)**
  - Modularized definitions into single-file schemas in `src/nodes/defs/`: `TextureInput`, `ChannelCombiner`, `ChannelSplitter`, `Invert`, `Levels`, `NormalFlip`, `NormalBlend`, `MathOp`, `Grayscale`, `ColorConstant`, `ScalarConstant`, `ExportOutput`.
  - Live transfer curves on Levels nodes and vector previews on NormalFlip nodes.

- **Robust State Management & File System (Phase 3)**
  - Unified Zustand store with 100-step Immer undo/redo history and slider scrub transaction coalescing.
  - Schema-versioned `.tlab` project files with Zod validation and backwards migration.
  - Atomic file writing with `.tmp` staging, fsync, `.bak` backups, and Windows EBUSY retry loops.
  - Background autosave (30-second interval) with crash recovery prompts.
  - Asset manager with fast 64KB FNV-1a hashing and file deduplication.

- **Native Electron Desktop Shell (Phase 2 & Phase 6)**
  - Sandboxed Electron shell with `contextIsolation`, strict CSP, and custom `app://` protocol.
  - Windows single-instance lock and native window state persistence (size, position, maximized).
  - Error boundaries with "Copy Diagnostics" (anonymized system telemetry, WebGL2 caps, recent log ring buffer).
  - Fault tolerance: automatic recovery from corrupt settings/recents, disk full errors, and GPU context crashes.
  - Packaged as per-user Windows NSIS installer and standalone portable executable.

#### 🐛 Fixes & Audit Resolutions

- Resolved Canvas2D premultiplied alpha data destruction (F-01).
- Fixed export resolution mismatches and aspect ratio distortions (F-02).
- Replaced incorrect documentation and non-functional CPU workers (F-03).
- Added missing normal map DirectX/OpenGL invert toggles and blend nodes (F-04).
- Added multi-output support and channel selector validation (F-05).
- Enforced strict 400-line source file ceilings across the codebase (F-06).
- Code-split modals and deferred GPU shader compilation, reducing initial JS bundle to 267 kB (F-18).
- Shipped third-party licenses in installer and About dialog (F-33).

---

## [0.2.0] - 2026-10-05

- Early development release introducing Electron packaging and initial Zustand state migration.
