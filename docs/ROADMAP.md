# ARKH TextureLab — Product Roadmap (Pure Rust Architecture)

> **Professional PBR Texture Processing & Channel Packing Workstation**  
> *100% Pure Rust • Native Windows Desktop Application • Zero Electron • Zero WebViews • Zero Node.js*

This document outlines the product roadmap, phase structure, and architectural milestones for ARKH TextureLab's complete refactoring to a high-performance native desktop application written in Pure Rust.

---

## 🏆 Architecture Comparison: Pure Rust vs Legacy Electron

| Metric / Capability | Legacy Electron / Web App | **ARKH TextureLab (Pure Rust)** |
|---|---|---|
| **Binary Size** | ~220 MB (Chromium + Node runtime) | **~5.4 MB (Standalone Native Windows EXE)** |
| **Startup Latency** | 3.5 – 5.5 seconds | **< 80 milliseconds** |
| **Idle Memory (RAM)** | 350 – 500 MB | **~45 MB** |
| **4K Channel Pack Latency** | 450 – 1,200 ms | **< 50 ms (Multithreaded Rayon SIMD)** |
| **Viewport 4K Tiling** | Memory explosion risk (~1.2 GB) | **60 FPS GPU UV Repeat (Zero CPU Allocation)** |
| **Pixel Data Integrity** | Premultiplied alpha corruption (F-01) | **100% Byte-Exact Preservation (F-01 Solved)** |
| **DCC Workflow & Hotkeys** | Mouse-heavy, browser hotkey conflicts | **Professional DCC Standard (`Tab`, `F`, `S`, `B`, `M`, `N`, `L`, `I`)** |

---

## 🧭 Ordered Refactoring Phases

Drive implementation one phase per session using the instructions in the [Owner Playbook](roadmap/OWNER_PLAYBOOK.md).

| Phase | Milestone Name | Key Deliverables & Focus | Status |
|---|---|---|---|
| [**Phase 0**](roadmap/PHASE_0_WORKSPACE_AND_TOOLCHAIN.md) | **Workspace & Toolchain Baseline** | Cargo 2021 crate, dependencies (`eframe`, `egui`, `egui_dock`, `image`, `rayon`), release profile, 1-click launchers (`setup.bat`, `run_desktop.bat`). | Completed / Verified |
| [**Phase 1**](roadmap/PHASE_1_CORE_ENGINE_AND_CODECS.md) | **Core Buffer Pipeline & Codecs** | Multi-precision `TextureBuffer` (R8, RGBA8, 16-bit), Rayon parallel processing, byte-exact PNG & Truevision TGA 2.0 encoders, zero alpha loss. | Planned / Verified |
| [**Phase 2**](roadmap/PHASE_2_DAG_AND_TOPOLOGICAL_COMPILER.md) | **DAG & Topological Compiler** | Reactive DAG engine, Kahn's topological sort, cycle detection, dirty-state caching, Serde `.tlab` serialization, 100-step undo/redo. | Planned / Verified |
| [**Phase 3**](roadmap/PHASE_3_NODE_CATALOG_AND_MATH.md) | **PBR Node Catalog & Math** | All 12 canonical node families: Pack, Unpack, Mixer, Levels, Invert, Normal Flip Green, Normal Blend RNM, 13 Math ops, POT Resize. | Planned / Verified |
| [**Phase 4**](roadmap/PHASE_4_NORMALIZER_AND_PACK_WIZARD.md) | **Normalizer & Pack Wizard** | 60+ lexical naming dictionaries, DirectX $\leftrightarrow$ OpenGL auto-detection, PBR role classification, 1-click Pack Wizard auto-wiring. | Planned / Verified |
| [**Phase 5**](roadmap/PHASE_5_NATIVE_DCC_WORKSTATION_GUI.md) | **Native DCC Workstation GUI** | `eframe` / `egui_dock` Obsidian tactical layout, Bezier node canvas, semantic wire colors, DCC hotkeys, 2D Viewport with GPU tiling and pixel probe. | Planned / Verified |
| [**Phase 6**](roadmap/PHASE_6_DIRECT_DISK_EXPORTER.md) | **Direct Disk Exporter** | Token expansion (`{asset}_{slot}_{res}`), engine presets (UE5, Unity, Substance, Blender), preflight sanitization, atomic disk writes. | Planned / Verified |
| [**Phase 7**](roadmap/PHASE_7_EDITIONS_HARDENING_AND_RELEASE.md) | **Editions, Hardening & Release** | Lite vs Pro capability matrix, 5.4 MB standalone executable, soak/stress testing, SHA-256 verification, and release packaging. | Planned / Release |

---

## 🛠️ How to Drive Development

1. Review [docs/roadmap/OWNER_PLAYBOOK.md](roadmap/OWNER_PLAYBOOK.md) for master prompt copy-paste templates and ground rules.
2. Run each phase in a fresh, isolated chat session.
3. Validate each task with concrete compiler verification commands (`cargo check`, `cargo test`, `cargo build --release`).
