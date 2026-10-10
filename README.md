# ARKH TextureLab — Professional PBR Texture Workstation (Pure Rust)

> **100% Native Windows Desktop Application • Zero Electron • Zero WebViews • Zero Node.js**  
> *Stack: Rust 2021 • eframe / egui 0.31 • egui_dock 0.16 • Rayon 1.10 • image 0.25 • Standalone 5.2 MB Windows `.exe`*

ARKH TextureLab is a professional, high-velocity workstation for PBR texture authoring, channel multiplexing (`pack <=> unpack`), lexical naming normalization, Reoriented Normal Mapping (RNM), and direct disk export.

Built from the ground up in 100% native Rust, TextureLab replaces bloated multi-hundred-megabyte web runtimes with an ultra-lean, instantaneous native workstation that starts in under 80 milliseconds and idles at only ~45 MB RAM.

---

## 📦 Download & Release Binary

Run ARKH TextureLab immediately without any runtime prerequisites, installers, or background services:

| Deliverable | Location | Size | Description |
|---|---|---|---|
| **Standalone Executable** | [`release/texturelab.exe`](release/texturelab.exe) | **~5.2 MB** | Single, self-contained native Windows executable. Double-click to run. |
| **Release Checksums** | [`release/SHA256SUMS.txt`](release/SHA256SUMS.txt) | 88 B | Cryptographic SHA-256 hash verifying binary integrity. |

*(To verify integrity in PowerShell: `Get-FileHash .\release\texturelab.exe -Algorithm SHA256`)*

---

## ⚡ Performance Budgets: Pure Rust vs Legacy Electron

| Metric / Capability | Legacy Electron (v0.2) | Pure Rust Budget | **TextureLab Native (Measured)** |
|---|---|---|---|
| **Binary / Distribution Size** | ~220 MB | <= 10.0 MB | **5.2 MB standalone `.exe`** |
| **Cold Startup Latency** | 3.5 – 5.5 s | <= 200 ms | **< 80 ms (Instant)** |
| **Idle Memory (RAM)** | 350 – 500 MB | <= 80 MB | **~45 MB** |
| **4K Channel Pack Latency** | 450 – 1200 ms | <= 100 ms | **< 50 ms (Rayon Multithreaded)** |
| **2D Viewport UV Tiling (4K)** | Out-of-Memory Risk | 60 FPS GPU UV | **60 FPS Fixed** |
| **Alpha Data Loss (Audit F-01)** | Canvas2D Premultiplication Bug | Zero Loss | **Byte-Exact Lossless (0-alpha safe)** |
| **Disk Exporter** | Renderer IPC File Blobs | Direct Disk | **Atomic Parallel Multi-Core Disk Write** |

---

## 🎹 Professional DCC Keyboard Shortcuts

Designed for high-throughput technical artists and game developers:

| Key / Shortcut | Action / Target | Description |
|---|---|---|
| `Tab` | **Quick Node Search Palette** | Instant popup to fuzzy-search and spawn any node |
| `F` | **Frame Selected / Frame All** | Smoothly centers canvas camera on active nodes |
| `S` | **Spawn Channel Splitter (Unpack)** | Unpacks packed RGBA maps into R, G, B, A outputs |
| `C` / `P` | **Spawn Channel Combiner (Pack)** | Packs discrete R, G, B, A inputs into RGBA |
| `M` | **Spawn Math Node** *(Pro)* | Scalar and vector arithmetic (13 operations) |
| `B` | **Spawn Layer Blend** | Lerp blending with mask and opacity |
| `N` | **Spawn Normal Flip Green** | DirectX (-Y) $\leftrightarrow$ OpenGL (+Y) tangent space toggle |
| `L` | **Spawn Levels** | Remap black/white points, contrast, and gamma |
| `I` | **Spawn Invert** | Invert channels (Roughness $\leftrightarrow$ Glossiness) |
| `1` | **Spawn Constant Scalar** | Single-channel float slider (`0.0 .. 1.0`) |
| `3` | **Spawn Constant Color** | RGBA color swatch picker |
| `Delete` / `Backspace` | **Delete Selection** | Removes selected nodes or wires from graph |
| `Ctrl + Z` | **Undo Transaction** | 100-step transactional history revert |
| `Ctrl + Y` | **Redo Transaction** | Re-applies undone transaction |
| `Ctrl + A` | **Select All** | Selects all nodes in active project graph |
| `Ctrl + S` | **Save Project (.tlab)** | Atomic Serde JSON project serialization |
| `Ctrl + E` | **Export Preflight Drawer** | Opens batch export validation panel |

---

## 💎 Edition Capability Matrix

TextureLab provides two feature tiers out of the box:

| Capability | TextureLAB Lite | TextureLAB Pro |
|---|---|---|
| **Channel Pack & Unpack** | ✅ Yes | ✅ Yes |
| **Lexical Normalizer & Wizard** | ✅ Yes | ✅ Yes |
| **Direct PNG & TGA 2.0 Export** | ✅ Yes | ✅ Yes |
| **Basic 2D Viewport (Channels & Tiling)** | ✅ Yes | ✅ Yes |
| **Built-in Game Engine Presets (UE5, Unity, Blender)** | ✅ Yes | ✅ Yes |
| **Reoriented Normal Mapping (RNM)** | 🔒 Locked | ✅ Yes |
| **13-Op Math & Vector Nodes** | 🔒 Locked | ✅ Yes |
| **16-Bit TIFF & EXR Codecs** | 🔒 Locked | ✅ Yes |
| **A/B Split Comparison & Histogram** | 🔒 Locked | ✅ Yes |

*(You can toggle the active edition anytime directly from the top menu bar under `Edition`.)*

---

## 🛠️ Core Engine Architecture

1. **Topological DAG Engine & Reactive Compiler (`src/graph/`)**
   - Kahn's topological sort algorithm with automatic circular dependency cycle detection.
   - Fine-grained dirty-node tracking and memoized intermediate buffer caching.
   - 100-step transactional undo/redo history with non-destructive state reconstruction.
2. **Rayon SIMD Multi-Core Buffer Pipeline (`src/core/`)**
   - Multi-precision `TextureBuffer` supporting R8, RGBA8, R16, RGBA16, and F32 HDR.
   - Parallel pixel processing offloading all math to available CPU cores via Rayon.
   - Byte-exact sRGB $\leftrightarrow$ Linear LUT conversions.
3. **Lossless Image Codecs & TGA 2.0 (`src/export/`)**
   - Pure native PNG codec preserving un-premultiplied color values even at zero alpha.
   - Truevision TGA 2.0 compliant encoder complete with official 26-byte `TRUEVISION-XFILE.\0` footer.
4. **Lexical Normalizer & One-Click Pack Wizard (`src/normalizer/`)**
   - Dictionary recognizing 60+ industry naming conventions (Megascans, Poly Haven, Substance, Quixel, Unreal, Unity).
   - Automated detection of DirectX vs OpenGL normal maps with green channel auto-inversion.
   - Automated glossiness-to-roughness inversion.
5. **Direct Disk Exporter (`src/export/`)**
   - Parallel multi-threaded disk writer with Windows reserved device name protection (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`).
   - Tokenized path resolution (`{project}`, `{asset}`, `{slot}`, `{res}`, `{colorspace}`, `{format}`).
   - Atomic disk writes via temporary staging and safe renaming.

---

## 🚀 Building & Running from Source

### Prerequisites
- **Operating System:** Windows 10 / 11 (x64)
- **Rust Toolchain:** Rust 2021 (1.80+ x64) — `cargo --version; rustc --version`
- **MSVC Build Tools:** Visual Studio C++ Build Tools or `link.exe`

### Commands (PowerShell)

```powershell
# Run desktop application in development mode
cargo run

# Run full automated test suite (131+ unit & integration tests)
cargo test

# Compile optimized standalone release executable
cargo build --release

# Inspect release binary size
(Get-Item .\target\release\texturelab.exe).Length / 1MB
```

### Batch Launchers
- **`run_desktop.bat`** — Runs the release build.
- **`run_desktop_dev.bat`** — Runs cargo in development mode.
- **`setup.bat`** — Verifies local Rust toolchain and dependencies.

---

## 📄 License & Attribution

ARKH TextureLab is developed by ARKH LAB. Bundled third-party dependencies are licensed under their respective open-source licenses (MIT, Apache 2.0) as documented in `THIRD_PARTY_LICENSES.txt`.
