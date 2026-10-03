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

- **Aesthetic**: **Plasticity CAD + Valorant Tactical Dark** (`#1a1d24` canvas with dot grid, `#20242e` matte cards, 1px hairline borders `rgba(255, 255, 255, 0.08)`, subtle hover indicators).
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

### 1. Interactive Pack <=> Unpack Pipeline
- **Pack (`ChannelCombinerNode`)**: Multiplexes up to 4 distinct channel maps (e.g. AO -> R, Roughness -> G, Metallic -> B, Height -> A) into a single packed RGBA texture.
- **Unpack (`ChannelSplitterNode`)**: Takes a packed texture (e.g. `Wood_ORMH`, `Character_RMA`) and splits it into discrete single-channel streams for rerouting or adjusting.
- **Adjustments**:
  - `LevelsNode`: Real-time Black Point, Midtone Gamma, and White Point remap.
  - `InvertNode`: 1 - x inversion (e.g. Glossiness to Roughness).
  - `NormalFlipNode`: Green channel invert for DirectX (-Y) <=> OpenGL (+Y) normal maps.

### 2. Live Client-Side Pixel Engine (`PixelEngine`)
- **Real-Time 2D Viewport**: Live rendering of active buffers on an offscreen/onscreen canvas.
- **Channel Isolation Tabs**: Instant one-click isolation for `[RGBA]`, `[R]`, `[G]`, `[B]`, `[A]` channels in true grayscale pixel space.
- **Hover Pixel Probe**: Hovering anywhere over the 2D viewport reveals exact `(X, Y)` coordinates and integer channel values: `R: [0..255]`, `G: [0..255]`, `B: [0..255]`, `A: [0..255]`.

### 3. Drag & Drop Autonomous Ingestion
- Drop ANY texture file directly from Windows File Explorer onto the canvas.
- The `LexicalNormalizer` autonomously matches filename patterns against industry dictionaries (e.g. `ambientocclusion`, `roughness`, `metallic`, `orm`, `rma`).
- Spawns the node at the cursor drop location with preview thumbnails and labeled sockets.

### 4. Token-Based Export Naming (`TokenEngine`)
- Interactive token tags: `{prefix}`, `{asset}`, `{slot}`, `{res}`, `{ext}`.
- Casing transforms: `UPPER_SNAKE`, `snake_case`, `PascalCase`, `camelCase`, and `original`.
- Real browser download: Generates and downloads the merged PNG texture directly.

### 5. Unreal Engine 5 Canvas Navigation
- **RMB / MMB Drag**: Pan canvas smoothly
- **Mouse Wheel**: Smooth zoom (0.2x – 3.0x)
- **Alt + Click Wire**: Cut connection wires (UE5 standard)
- **Tab / RMB Click**: Searchable node spawn palette
- **`C` Key**: Group selected nodes into a visual Comment Box with inline double-click title editing
- **`F` Key**: Focus extents / frame all nodes (`fitView`)
- **Hotkeys**: `T` (Texture Input), `M` (Channel Combiner), `S` (Channel Splitter), `I` (Invert), `L` (Levels), `O` (Texture Output).

---

## 🧪 Benchmark Anthracite Concrete 4K

Validated against real 4K PBR concrete textures located at `F:\Textures\superellipse\concrete\anthracite smooth cast concrete 4k` (and mirrored in `web-xyflow/public/sample_textures/`):
- Click **"Load Anthracite Concrete (Benchmark)"** in the top bar to auto-load the 4K maps, wire the ORMH combiner, and inspect the live composite buffer.
