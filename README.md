# ARKH TextureLab — Interactive PBR Pack <=> Unpack Workstation

ARKH TextureLab is a high-performance web workstation for interactive PBR texture channel multiplexing / unmultiplexing (`pack <=> unpack`), featuring dictionary-driven naming normalization, token-based export naming, live 2D pixel inspection, and Unreal Engine 5 material editor navigation.

---

## 🚀 Quick Start

Launch the local development server:
```powershell
.\run_web.bat
# or
cd web-xyflow
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 🎨 Unified Design Standard & UX Standards

- **Aesthetic**: **Tactical DCC Workstation** (Plasticity CAD + Substance 3D aesthetic: `#090a0f` obsidian canvas with dot grid, `#12151c` matte cards, 1px hairline borders `rgba(255, 255, 255, 0.08)`, subtle hover indicators, and amber/cyan telemetry).
- **Typography**: Bundled modern sans-serif **Geist Sans** (`assets/fonts/`).
- **PBR Semantic Pastel Sockets**:
  - `AO`: `#f87171` (Coral Red)
  - `Roughness`: `#4ade80` (Mint Green)
  - `Metallic`: `#60a5fa` (Sky Blue)
  - `Height / Disp`: `#fbbf24` (Amber)
  - `Scalar`: `#cbd5e1` (Slate)
  - `Packed RGBA`: `#a78bfa` (Pastel Violet)

---

## ⚡ Core Features & Capabilities

### 1. High-Performance Web Worker & Interactive Proxy Engine
- **Asynchronous Worker (`pixelWorker.ts`)**: Offloads heavy 4K CPU pixel calculations (combine, levels LUT, invert, normalFlip, and histogram) off the main thread to prevent UI freezing.
- **Interactive 512px Proxies**: Generates lightweight downsampled proxies during active slider drags (Levels, Curves, etc.) ensuring smooth 60 FPS scrubbing, committing full 4K resolutions on release.
- **Zero-Copy Transfers**: Uses transferable `ArrayBuffer` objects for zero-copy IPC between main thread and worker.

### 2. Interactive Pack <=> Unpack Pipeline
- **Pack (`ChannelCombinerNode`)**: Multiplexes up to 4 distinct channel maps (e.g. AO -> R, Roughness -> G, Metallic -> B, Height -> A) into a single packed RGBA texture.
- **Unpack (`ChannelSplitterNode`)**: Takes a packed texture (e.g. `Wood_ORMH`, `Character_RMA`) and splits it into discrete single-channel streams for rerouting or adjusting.
- **Adjustments with Live Inline Mini-Previews**:
  - `LevelsNode`: Real-time Black Point, Midtone Gamma, and White Point remap with live interactive SVG transfer curve.
  - `InvertNode`: 1 - x inversion (e.g. Glossiness to Roughness) with dynamic inversion gradient chip.
  - `NormalFlipNode`: Green channel invert for DirectX (-Y) <=> OpenGL (+Y) normal maps with directional vector swatch.
  - `NodeCard Mute/Bypass`: Toggle any node with `D` key or card header icon, rendering a tactical diagonal hatch overlay.

### 3. Precision 2D Inspector Panel
- **Real-Time Histogram Waveform**: 256-bin analytical canvas rendering real-time R, G, B, and Luminance waveforms.
- **Channel Isolation**: Instant one-click isolation for `[RGBA]`, `[R]`, `[G]`, `[B]`, `[A]` channels in true grayscale pixel space.
- **Crosshair Pixel Probe**: Hovering reveals exact `(X, Y)` coordinates with both integer `[0..255]` and normalized float `[0.00..1.00]` readouts.
- **1:1 Native Pixel Space**: Toggle between responsive `Fit` and unscaled `1:1 Native` pixel viewports.
- **Industry Packing Presets**: Quick dropdown switching between:
  - `Unreal Engine ORMH` (R: AO, G: Roughness, B: Metallic, A: Height)
  - `UE5 Standard ORM` (R: AO, G: Roughness, B: Metallic)
  - `Unity HDRP Mask` (R: Metallic, G: AO, B: Detail Mask, A: Smoothness)
  - `Godot / Blender PBR` (R: AO, G: Roughness, B: Metallic)

### 4. Drag & Drop Autonomous Ingestion
- Drop ANY texture file directly from Windows File Explorer onto the canvas.
- The `LexicalNormalizer` autonomously matches filename patterns against industry dictionaries (e.g. `ambientocclusion`, `roughness`, `metallic`, `orm`, `rma`).
- Spawns the node at the cursor drop location with preview thumbnails and labeled sockets.

### 5. Token-Based Export Naming (`TokenEngine`)
- Interactive token tags: `{prefix}`, `{asset}`, `{slot}`, `{res}`, `{ext}`.
- Casing transforms: `UPPER_SNAKE`, `snake_case`, `PascalCase`, `camelCase`, and `original`.
- Real browser download: Generates and downloads the merged PNG texture directly.

### 6. Unreal Engine 5 Canvas Navigation & Productivity
- **Undo / Redo (`Ctrl+Z` / `Ctrl+Y`)**: Full history snapshotting of graph nodes and connections.
- **`C` Key Comment Boxes**: Select nodes and press `C` to wrap them in a resizable, color-coded UE5 Comment Box with inline editable title.
- **`D` Key Bypass**: Toggle bypass/mute state on the selected node.
- **RMB / MMB Drag**: Pan canvas smoothly.
- **Mouse Wheel**: Smooth zoom (0.2x – 3.0x).
- **Alt + Click Wire**: Cut connection wires (UE5 standard).
- **Tab / RMB Click**: Searchable node spawn palette.
- **`F` Key**: Focus extents / frame all nodes (`fitView`).
- **Hotkeys**: `T` (Texture Input), `M` (Channel Combiner), `S` (Channel Splitter), `I` (Invert), `L` (Levels), `O` (Texture Output), `C` (Comment Box), `D` (Bypass/Mute).

---

## 🧪 Benchmark Anthracite Concrete 4K

Validated against real 4K PBR concrete textures located at `sample_textures/`:
- Click **"Load Anthracite Concrete (Benchmark)"** in the top bar to auto-load the 4K maps, wire the ORMH combiner, and inspect the live composite buffer.
