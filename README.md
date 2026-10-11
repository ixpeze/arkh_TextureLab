# ARKH TextureLab

> PBR Texture Authoring and Channel Packing Workstation.

ARKH TextureLab is a professional, high-velocity workstation designed for technical artists, game developers, and 3D visualization professionals. It streamlines PBR texture authoring, channel multiplexing (pack/unpack), lexical naming normalization, Reoriented Normal Mapping (RNM), and direct disk export in a single native portable executable.

---

## Highlights

* **100% Pure Rust Engine**: Built with `eframe`, `egui`, `egui_dock`, and `rayon` with zero browser overhead or memory leaks. Sub-80ms cold startup and ~12 MB self-contained binary footprint.
* **Topological DAG Evaluator**: Reactive node graph execution with Kahn's topological sort, cycle detection, dirty-state propagation, and 100-step undo/redo.
* **Unreal Engine Navigation Standards**:
  * Right-click drag: smooth canvas panning.
  * Right-click tap (< 5px): instant quick search spawn palette.
  * `Alt + Left Click` on socket pin: severs all connections on that pin.
  * `Alt + Left Click` on wire: severs the targeted Bezier edge.
  * `Hold Key + Left Click` quick-spawn: `T` (TextureInput), `1` (ConstantScalar), `3` (ConstantColor), `M` (Multiply), `A` (Add), `L` (LayerBlend), `O` (Invert).
  * `F` key: frames canvas camera on active selection or entire graph.
* **Drag-and-Drop Ingestion**:
  * Drag images directly from **Windows Explorer** onto the canvas: automatically runs lexical PBR role classification (60+ conventions) and instantiates bound `TextureInput` samplers.
  * Drag nodes from the **Node Library** left panel onto the canvas with glowing placement ghost preview.
* **Comprehensive Codecs**: Byte-exact un-premultiplied PNG and Truevision TGA 2.0 with custom footer compliance, plus WebP, JPEG, and BMP.
* **PBR Lexical Normalizer**: Automatic map categorization and slot assignment supporting 60+ industry conventions (Megascans, Poly Haven, Substance, Quixel).
* **Industry Presets**: One-click channel packing presets for Unreal Engine (ORM), Unity HDRP (MaskMap), Blender Principled, and custom token pipelines.

---

## Quickstart

### Automated Windows Scripts
* [`setup.bat`](setup.bat): Automated toolchain verification, test suite run, and portable `.exe` build.
* [`run_desktop.bat`](run_desktop.bat): Launches the standalone portable workstation executable.

### Native Rust Engine Commands
```powershell
# Run native app in debug mode
cargo run

# Run native app in optimized release mode
cargo run --release

# Run unit and integration test suite (150+ tests)
cargo test

# Build production portable executable
cargo build --release
```

---

## Workstation Hotkeys

| Shortcut | Target | Action |
|---|---|---|
| `Tab` / Right Click Tap | Quick Search | Fuzzy search palette to spawn any node |
| `F` | Frame View | Centers camera on active node selection |
| `Alt + Click` | Wire / Socket Cut | Severs wire or breaks all connections on pin |
| `Hold T + Click` | Quick Spawn | Spawns `TextureInput` node at cursor |
| `Hold 1 + Click` | Quick Spawn | Spawns `ConstantScalar` node at cursor |
| `Hold 3 + Click` | Quick Spawn | Spawns `ConstantColor` node at cursor |
| `Hold M + Click` | Quick Spawn | Spawns `Multiply` math operator at cursor |
| `Hold A + Click` | Quick Spawn | Spawns `Add` math operator at cursor |
| `Hold L + Click` | Quick Spawn | Spawns `LayerBlend` lerp node at cursor |
| `Hold O + Click` | Quick Spawn | Spawns `Invert` (OneMinus) node at cursor |
| `S` | Channel Splitter | Spawns channel splitter |
| `C` / `P` | Channel Combiner | Spawns channel combiner |
| `N` | Normal Flip Green | Toggles DirectX (-Y) $\leftrightarrow$ OpenGL (+Y) tangent space |
| `Ctrl + Z` | Undo | Reverts last transaction (100-step buffer) |
| `Ctrl + Y` | Redo | Re-applies undone transaction |
| `Ctrl + S` | Save | Serializes active graph to `.tlab` format |
| `Ctrl + E` | Export | Opens preflight batch export validation drawer |

---

## Documentation

* [System Architecture](docs/ARCHITECTURE.md) — Subsystem breakdown, DAG compiler, and data flow.
* [Developer Setup & Contributing](docs/DEV_SETUP.md) — Comprehensive build instructions and test commands.
* [Strategic Roadmap](docs/ROADMAP.md) — Milestone planning, 3D viewport, and feature pipeline.
* [Specifications](docs/specs/) — Upcoming architectural specifications and design proposals.

---

## License & Attribution

Developed by ARKH LAB. Bundled third-party dependencies are licensed under their respective open-source licenses as documented in [`THIRD_PARTY_LICENSES.txt`](THIRD_PARTY_LICENSES.txt).
