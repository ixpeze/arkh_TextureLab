# ARKH TextureLab

> PBR Texture Pipeline Workstation — pack, convert, validate, and batch-export texture sets.

ARKH TextureLab is a native desktop workstation for technical artists and game developers. It handles PBR channel packing, lexical naming normalisation, format conversion, and batch export through a node-graph interface — all in a single portable executable.

---

## Highlights

* **100 % Pure Rust**: Built with `eframe` 0.31, `egui` 0.31, `egui_dock` 0.16, and `rayon`. Sub-100 ms cold startup, ~6 MB portable binary, zero runtime dependencies.
* **Topological DAG Evaluator**: Reactive node-graph execution via Kahn's topological sort with cycle detection, dirty-subgraph propagation, memoised cache, and 100-step undo/redo.
* **19 Node Types Across 8 Categories**: I/O, Constants, Channel Ops, Colour Adjust, Normal Ops, Blend Ops, Math (13 operations), and Transform.
* **PBR Lexical Normaliser**: 60+ industry naming conventions (Megascans, Poly Haven, Substance, Quixel) with auto-role classification and one-click pack wizard.
* **Industry Export Presets**: Unreal Engine ORM, Unity HDRP MaskMap, Blender Principled, CryEngine, and custom token pipelines.
* **Codecs**: Lossless 8-bit and 16-bit PNG, TGA 2.0 with custom footer, WebP, JPEG, BMP.
* **Canvas Navigation**: Right-click pan, right-click tap spawn palette, Alt+Click wire/pin disconnect, Hold-Key+Click quick spawn, F to frame selection. Drag from Node Library or Windows Explorer with auto PBR role tagging.

---

## Quickstart

### Windows Scripts
* [`setup.bat`](setup.bat) — Toolchain check, test suite, portable `.exe` build.
* [`run_desktop.bat`](run_desktop.bat) — Launch the portable workstation.

### Cargo Commands
```powershell
cargo run              # Debug mode
cargo run --release    # Optimised release mode
cargo test             # 173 unit + integration tests
cargo build --release  # Portable executable → target/release/texturelab.exe
```

---

## Hotkeys

Hotkeys are defined in [`src/hotkeys/mod.rs`](src/hotkeys/mod.rs).

| Shortcut | Action |
|---|---|
| `Tab` / Right-click tap | Open fuzzy search spawn palette |
| `F` | Frame camera on selection |
| `Alt + Click` wire or pin | Sever connection |
| `1 + Click` | Quick-spawn Constant Scalar |
| `3 + Click` | Quick-spawn Constant Color |
| `M + Click` | Quick-spawn Multiply |
| `B + Click` | Quick-spawn Layer Blend |
| `S + Click` | Quick-spawn Channel Splitter |
| `C` / `P + Click` | Quick-spawn Channel Combiner |
| `N + Click` | Quick-spawn Normal Flip Green |
| `L + Click` | Quick-spawn Levels |
| `I + Click` | Quick-spawn Invert |
| `Delete` / `Backspace` | Delete selected nodes |
| `Ctrl + Z` | Undo (100-step buffer) |
| `Ctrl + Y` | Redo |
| `Ctrl + C` | Copy selected nodes to clipboard |
| `Ctrl + V` | Paste clipboard nodes at cursor |
| `Ctrl + D` | Duplicate selected nodes (+30, +30) |
| `Ctrl + A` | Select all nodes in graph |
| `Ctrl + F` | Auto-layout graph nodes |
| `Ctrl + S` | Save project (`.tlab`) |
| `Ctrl + E` | Export preflight drawer |

---

## Documentation

* [System Architecture](docs/ARCHITECTURE.md) — Subsystem breakdown, DAG compiler, data flow.
* [Developer Setup](docs/DEV_SETUP.md) — Build instructions, test commands, directory map.
* [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) — Phased feature plan and agent prompts.
* [Design Guide](docs/design/) — Visual specs for nodes, sidebar, and viewport.
* [Archived Specs](docs/archive/) — Completed design specs from v1.0 development.

---

## License & Attribution

Developed by ARKH LAB. Third-party licences: [`THIRD_PARTY_LICENSES.txt`](THIRD_PARTY_LICENSES.txt).
