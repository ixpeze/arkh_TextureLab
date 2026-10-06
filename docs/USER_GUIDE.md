# ARKH TextureLab — User Guide

Welcome to **ARKH TextureLab**, a high-performance workstation for interactive PBR texture channel packing, unpacking, and adjustments.

---

## 🚀 Getting Started

### Installation & Launch

1. Download the latest installer (`TextureLab-Setup-1.0.0.exe`) or portable executable (`TextureLab-1.0.0-portable.exe`) from the releases folder or GitHub.
2. Run the executable. TextureLab installs to your user profile without requiring administrator privileges.

### 🛡️ Windows SmartScreen Note ("Unknown Publisher")

Because ARKH TextureLab is distributed as free, open-source, local-first software without an expensive annual enterprise signing certificate (per project decision D-10), Windows Defender SmartScreen may display a warning on first launch:

```
Windows protected your PC
Microsoft Defender SmartScreen prevented an unrecognized app from starting.
```

**How to open:**
1. Click **"More info"** on the prompt.
2. Click **"Run anyway"**.

*(Optional: You can cryptographically verify that your download has not been tampered with by checking its SHA-256 hash against `release/SHA256SUMS.txt`.)*

---

## 🎨 The Workstation Layout

TextureLab features the **Graphite Blueprint** DCC workstation layout:

- **Left Panel (Library & Project Assets):** Search and drag nodes onto the canvas, browse project texture assets, or trigger the Pack & Unpack Wizard. Press `Ctrl+B` to toggle.
- **Center Canvas (Node Graph):** Interactive node graph powered by XYFlow. Connect nodes, create UE5-style comment boxes, and organize your pipeline. Supports 3-tier zoom LOD (switches to compact mode when zoomed out).
- **Right Panel (2D Inspector & Properties):** Inspect active texture nodes with 1:1 pixel accuracy, split-screen A/B comparisons, tiling seam tests, and channel isolation. Press `Ctrl+Alt+B` to toggle.
- **Bottom Status Bar:** Live system telemetry showing active GPU renderer, VRAM usage, document modification status, and zoom level.

---

## 🧙‍♂️ Pack & Unpack Wizard (<3 Clicks)

The **Pack & Unpack Wizard** automates repetitive node wiring by scanning texture folder names and building complete packing pipelines automatically.

### How to use:
1. Click the **"Wizard"** button in the top toolbar (or press `Ctrl+W`).
2. Drag and drop a folder containing your texture maps (or select individual files).
3. The wizard uses lexical matching to automatically classify your maps:
   - `_AO`, `_AmbientOcclusion`, `_Occlusion` → Ambient Occlusion
   - `_Roughness`, `_Rough`, `_Gloss` → Roughness
   - `_Metallic`, `_Metal`, `_Metalness` → Metallic
   - `_Height`, `_Displacement`, `_Disp` → Height / Displacement
   - `_Normal`, `_Norm`, `_NRM` → Normal Map
4. Select your target preset:
   - **Unreal Engine ORM (R: AO, G: Roughness, B: Metallic)**
   - **Unreal Engine ORMH (R: AO, G: Roughness, B: Metallic, A: Height)**
   - **Unity HDRP Mask (R: Metallic, G: AO, B: Detail Mask, A: Smoothness)**
   - **Unpack Mode (Deconstruct an existing packed texture into discrete channels)**
5. Click **"Generate Pipeline"**. The complete node network is instantly constructed and wired on your canvas.

---

## 📦 Complete Node Catalog

TextureLab provides 12 specialized node families:

### Ingestion & Constants
- **Texture Input (`TextureInput`):** Loads an external texture file (`.png`, `.tga`, `.jpg`, `.webp`). Supports switching color space between **sRGB** (for Albedo / Base Color) and **Linear** (for Normal, Roughness, Metallic, AO).
- **Color Constant (`ColorConstant`):** Generates a solid RGBA color swatch. Useful for default base colors or mask tints.
- **Scalar Constant (`ScalarConstant`):** Generates a single-channel floating-point value between `0.0` and `1.0`. Ideal for flat roughness or metallic values.

### Packing & Multiplexing
- **Channel Combiner (`ChannelCombiner`):** The primary packing hub. Multiplexes up to 4 input channels into a single RGBA texture. For each output channel (R, G, B, A), you can select which input node and which specific channel (Red, Green, Blue, Alpha, or Luminance) to route.
- **Channel Splitter (`ChannelSplitter`):** Takes a packed multi-channel texture and splits it into discrete single-channel outputs (`R`, `G`, `B`, `A`) for individual filtering or rerouting.

### Adjustments & Conversions
- **Levels (`Levels`):** Precision tonal range adjustment. Adjust Black Point, Midtone Gamma, and White Point with a real-time transfer curve display.
- **Invert (`Invert`):** Calculates `1.0 - Value`. Ideal for converting Glossiness maps into Roughness maps, or inverting height/mask textures.
- **Normal Flip (`NormalFlip`):** Inverts the Green channel (`Y`) to instantly convert tangent space normal maps between **DirectX (-Y)** and **OpenGL (+Y)** conventions.
- **Normal Blend (`NormalBlend`):** Combines a base normal map with a detail normal map using Reoriented Normal Mapping (RNM) to preserve surface curvature.
- **Math Operation (`MathOp`):** Performs mathematical blending between two textures: Add, Subtract, Multiply, Min, Max, and Power.
- **Grayscale (`Grayscale`):** Converts color textures to single-channel scalar data using Rec. 709 Luminance weighting, Average, or Desaturation.

### Export
- **Export Output (`ExportOutput`):** Designates a node for project export. Define slot name, resolution override (e.g., 2048x2048, 4096x4096), bit depth (8-bit or 16-bit), and format (`.png` or `.tga`).

---

## 🔬 2D Inspector & Quality Inspection Tools

The Inspector panel on the right provides analytical viewing tools:

- **Split View (A/B Wipe):** Drag the vertical divider bar across the preview to compare the current node against an upstream or reference node in real time.
- **Tiling Repeat Test:** Switch from `1x1` to `2x2` or `3x3` tiling repeat to instantly verify that your textures are seamless without visible edge seams.
- **Channel Isolation:** Click `[RGBA]`, `[R]`, `[G]`, `[B]`, or `[A]` to isolate individual channels in true monochrome space.
- **Crosshair Pixel Probe:** Hover anywhere over the texture to inspect exact coordinates `(X, Y)`, RGB values `[0..255]`, and normalized float values `[0.00..1.00]`.
- **View Modes:** Toggle between `Fit` (scales to inspector frame) and `1:1 Native` (actual unscaled pixel size with panning).

---

## 🏷️ Export Hub & Token Engine

Click **"Export All"** or press `Ctrl+E` to open the Export Hub.

### File Naming Tokens
Configure export filenames using dynamic tokens:
- `{prefix}`: User-defined project prefix (e.g. `T_`).
- `{asset}`: Primary asset name (e.g. `ConcreteWall`).
- `{slot}`: Node output slot name (e.g. `ORM`, `Albedo`, `Normal`).
- `{res}`: Output resolution (e.g. `2048`, `4096`).
- `{ext}`: Output file extension (`png` or `tga`).
- `{date}` / `{time}`: Current timestamp.

### Casing Formats
Choose from multiple standard naming conventions:
- `UPPER_SNAKE`: `T_CONCRETE_WALL_ORM.PNG`
- `snake_case`: `t_concrete_wall_orm.png`
- `PascalCase`: `T_ConcreteWall_ORM.png`
- `camelCase`: `t_concreteWall_orm.png`

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Action |
|---|---|
| `Ctrl+Z` | Undo last action |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+S` | Save project (`.tlab`) |
| `Ctrl+Shift+S` | Save project as... |
| `Ctrl+O` | Open project file |
| `Ctrl+E` | Open Export Hub |
| `Ctrl+W` | Open Pack & Unpack Wizard |
| `Ctrl+B` | Toggle Left Panel (Library/Assets) |
| `Ctrl+Alt+B` | Toggle Right Panel (Inspector) |
| `C` | Wrap selected nodes in a Comment Box |
| `D` | Toggle Bypass/Mute on selected node |
| `Delete` / `Backspace` | Delete selected nodes or edges |
| `Space` + Drag / MMB Drag | Pan canvas |
| Mouse Wheel | Zoom canvas (0.2x to 3.0x) |
| `F` | Frame selected nodes or entire graph |
| `F12` | Toggle Developer Tools (Dev builds) |

---

## 🛠️ Diagnostics & Support

If you encounter unexpected behavior:
1. Open **Help → About TextureLab** to view version, GPU acceleration status, and system info.
2. In the event of an unhandled UI error, click **"Copy Diagnostics"** in the recovery overlay to copy anonymized system information, WebGL2 capabilities, and the last 200 log lines to your clipboard.
3. Desktop logs are saved to:
   - Windows: `%APPDATA%\TextureLab\logs\app.log`
