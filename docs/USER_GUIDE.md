# ARKH TextureLab — User Guide

Welcome to **ARKH TextureLab**, the 100% pure Rust native desktop workstation for interactive PBR texture channel packing, unpacking, normalization, and precision image authoring.

---

## 🚀 Getting Started

### Installation & Launch
ARKH TextureLab requires no installers, no runtime prerequisites, and no background services:

1. Download or copy `texturelab.exe` from the `release/` folder or build it with `cargo build --release`.
2. Double-click `texturelab.exe` to launch immediately (< 80ms cold start).
3. The application runs natively on Windows 10/11 using hardware-accelerated desktop graphics.

---

## 🎨 The Workstation Layout

TextureLab utilizes the **"Graphite Blueprint"** Obsidian workstation layout with dynamic docking (`egui_dock`):

### 1. Node Canvas (Center Workspace)
- **Infinite Pan & Zoom:** Middle-click or right-click drag to pan; mouse wheel to zoom.
- **Cubic Bezier Wiring:** Click and drag from any output pin socket to an input pin socket to connect wires.
- **Semantic Wire Colors:**
  - 🔴 **Red:** Single-channel Red / Scalar
  - 🟢 **Green:** Single-channel Green
  - 🔵 **Blue:** Single-channel Blue
  - ⚪ **White / Amber:** Multi-channel RGBA / Active Wire
  - ⚪ **Gray:** Alpha channel
- **Zoom LOD Levels:**
  - **Full LOD:** Complete parameters, labels, and sockets.
  - **Compact LOD (< 0.7 zoom):** Simplified header with essential socket labels.
  - **Block LOD (< 0.4 zoom):** High-density geometric blocks for massive multi-node graph overview.

### 2. Dedicated 2D Viewport
- **Channel Isolation:** Toggle between:
  - `RGB` — Full color view
  - `RGBA Checker` — Transparency checkerboard background
  - `R (Grayscale)` — Pure red channel luminance
  - `G (Grayscale)` — Pure green channel luminance
  - `B (Grayscale)` — Pure blue channel luminance
  - `A (Grayscale)` — Pure alpha channel luminance
- **GPU UV Tiling Test:** Toggle `1x`, `2x`, or `4x` repeat tiling to immediately detect texture seams.
- **Precision Pixel Probe:** Hover the mouse anywhere over the viewport to read out instant coordinate `(X, Y)`, byte `[0..255]`, normalized float `[0.00..1.00]`, and Hex values.
- **1:1 Native Pixel View:** Click `1:1` to zoom to exact source pixels; click `Reset` to re-center.

### 3. Properties Inspector
- Inspect and mutate parameters of the currently selected node (sliders, color swatches, gamma remapping, slot names).
- All changes trigger reactive topological DAG re-evaluation with intermediate cache updates.

### 4. Library & Floating Quick Spawn Palette (`Tab`)
- Press `Tab` anywhere to summon the instant fuzzy search palette.
- Type any node name or shortcut (e.g., `split`, `rnm`, `levels`, `M`) and press `Enter` to spawn at cursor.
- Docked **Library Panel** categorizes all 12 node families with 1-click addition.

### 5. Status Bar Telemetry
- Bottom status bar reports live evaluation time in milliseconds (`Eval: X.XX ms`), cache hits/misses, active graph resolution, and node/edge count.

---

## 🧙‍♂️ Lexical Normalizer & Pack Wizard

The **Pack Wizard** automates texture channel packing by scanning texture filenames and automatically constructing complete DAG pipelines:

1. Classifies naming conventions from 60+ industry standards:
   - `_AO`, `_Occlusion`, `_AmbientOcclusion` $\rightarrow$ Ambient Occlusion
   - `_Roughness`, `_Rough` $\rightarrow$ Roughness
   - `_Glossiness`, `_Gloss` $\rightarrow$ Automatically flagged for Invert node insertion
   - `_Metallic`, `_Metal`, `_Metalness` $\rightarrow$ Metallic
   - `_Normal`, `_NRM` $\rightarrow$ Normal map
   - `_Height`, `_Displacement`, `_Disp` $\rightarrow$ Height map
2. **Normal Map Convention Auto-Detection:** Distinguishes DirectX (-Y) vs OpenGL (+Y) naming and automatically inserts green-channel flip nodes when necessary.
3. Generates pre-wired pipelines for:
   - **Unreal Engine 5 ORM** (`R: AO`, `G: Roughness`, `B: Metallic`)
   - **Unity MaskMap** (`R: Metallic`, `G: AO`, `B: DetailMask`, `A: Smoothness`)
   - **Custom Multi-Channel Packs**

---

## 📦 Complete Node Catalog

TextureLab provides 12 canonical PBR node families:

### 1. Ingestion & Output
- **Texture Input (`TextureInput`):** Solid procedural color or external texture buffer. Supports sRGB $\leftrightarrow$ Linear color space conversion.
- **Texture Output (`TextureOutput`):** Target slot definition (BaseColor, Normal, ORM, Height) and format (`PNG`, `TGA`) for preflight export.

### 2. Constants
- **Constant Scalar (`ConstantScalar` / Hotkey `1`):** Single-channel float (`0.0 .. 1.0`).
- **Constant Color (`ConstantColor` / Hotkey `3`):** Full 4-channel RGBA color picker.

### 3. Channel Multiplexing
- **Channel Combine / Pack (`ChannelCombine` / Hotkey `C` or `P`):** Combines discrete R, G, B, A inputs into an RGBA texture.
- **Channel Split / Unpack (`ChannelSplit` / Hotkey `S`):** Unpacks an RGBA input into separate R, G, B, A outputs.
- **Channel Mixer / Swizzle (`ChannelMixer`):** Arbitrary 4x4 matrix swizzling with per-row channel inversions and constant overrides.

### 4. Color & Adjust
- **Invert (`Invert` / Hotkey `I`):** Computes `1.0 - input`. Converts Glossiness $\leftrightarrow$ Roughness.
- **Levels (`Levels` / Hotkey `L`):** Black point, white point, gamma curve, and contrast adjustments.
- **Brightness / Contrast (`BrightnessContrast`):** Linear brightness shift and contrast scaling.

### 5. Normal Operations
- **Normal Flip Green (`NormalFlipGreen` / Hotkey `N`):** Inverts tangent space green channel for DirectX $\leftrightarrow$ OpenGL.
- **Normal Normalize (`NormalNormalize`):** Renormalizes normal map vectors to unit length $(X^2 + Y^2 + Z^2 = 1)$.
- **Normal Strength (`NormalStrength`):** Scales normal map depth and tangent deviation.

### 6. Blending & Math
- **Layer Blend (`LayerBlend` / Hotkey `B`):** Multi-mode Lerp blending with mask and opacity controls.
- **Normal Blend RNM (`NormalBlendRNM` / Pro):** Reoriented Normal Mapping combining base and detail normals without flattening slope.
- **Math (`Math` / Hotkey `M` / Pro):** 13 scalar and vector arithmetic operations (`Add`, `Subtract`, `Multiply`, `Divide`, `Power`, `Min`, `Max`, `Clamp`, `Abs`, `Step`, `Smoothstep`, `Modulo`).

### 7. Transform
- **Resize (`Resize`):** Power-of-Two (POT) dimension rounding, Lanczos3, and Bilinear resampling.

---

## 🎹 Keyboard Shortcuts Quick Reference

| Key / Shortcut | Action |
|---|---|
| `Tab` | Open Quick Search Palette |
| `F` | Frame All Nodes / Focus View |
| `S` | Spawn Channel Splitter (Unpack) |
| `C` / `P` | Spawn Channel Combiner (Pack) |
| `M` | Spawn Math Node *(Pro)* |
| `B` | Spawn Layer Blend Node |
| `N` | Spawn Normal Flip Green Node |
| `L` | Spawn Levels Node |
| `I` | Spawn Invert Node |
| `1` | Spawn Constant Scalar |
| `3` | Spawn Constant Color |
| `Delete` / `Backspace` | Delete Selected Node or Edge |
| `Ctrl + Z` | Undo Transaction |
| `Ctrl + Y` | Redo Transaction |
| `Ctrl + A` | Select All Nodes |
| `Ctrl + S` | Save Project (`.tlab`) |
| `Ctrl + E` | Open Export Preflight Drawer |

---

## 🏷️ Export Preflight Drawer (`Ctrl+E`)

The direct disk exporter writes evaluated textures directly to disk:
- **Game Engine Presets:** Unreal Engine 5 (`T_{asset}_{slot}`), Unity MaskMap, Substance Painter, Blender Principled, CryEngine.
- **Dynamic Token Expansion:** `{project}`, `{asset}`, `{slot}`, `{res}`, `{colorspace}`, `{format}`.
- **Preflight Path Validation:** Sanitizes Windows reserved device names (`CON`, `PRN`, `AUX`, etc.) and detects case-insensitive collisions before writing.
- **Atomic Disk Writes:** Writes to temporary files and atomically renames to prevent partial or empty files.
