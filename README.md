# ARKH TextureLab — Interactive PBR Pack <=> Unpack Workstation

ARKH TextureLab is a high-performance workstation for interactive PBR texture channel multiplexing and unmultiplexing (`pack <=> unpack`), featuring dictionary-driven naming normalization, token-based export naming, live 2D pixel inspection, and an asynchronous WebGL2 GPU evaluation engine.

---

## 📦 Downloads (Windows Desktop)

You can run ARKH TextureLab as a native Windows desktop application with zero Node.js or terminal prerequisites:

| Download Type | Filename | Description |
|---|---|---|
| **Installer** | [`release/TextureLab-Setup-1.0.0.exe`](release/TextureLab-Setup-1.0.0.exe) | Clean per-user Windows NSIS installer (no admin rights needed, creates shortcuts). |
| **Portable** | [`release/TextureLab-1.0.0-portable.exe`](release/TextureLab-1.0.0-portable.exe) | Standalone portable executable. Runs from any directory or USB drive. |
| **Checksums** | [`release/SHA256SUMS.txt`](release/SHA256SUMS.txt) | SHA-256 cryptographic hashes to verify download integrity. |

---

## 🛡️ Windows SmartScreen Note ("Unknown Publisher")

Because ARKH TextureLab is distributed as free, open-source software without an expensive annual enterprise code-signing certificate (per project decision D-10), Windows Defender SmartScreen may display a warning on first launch:

```
Windows protected your PC
Microsoft Defender SmartScreen prevented an unrecognized app from starting.
```

### How to Run:
1. Click **"More info"** on the SmartScreen dialog.
2. Click **"Run anyway"**.

*(Optional: To verify that your executable is authentic and has not been altered, compare its SHA-256 hash against the published hashes in [`release/SHA256SUMS.txt`](release/SHA256SUMS.txt).)*

---

## 🖥️ System Requirements

- **Operating System:** Windows 10 (22H2 or newer) / Windows 11 (64-bit).
- **GPU (Hardware Floor):** Dedicated GPU with WebGL2 support (NVIDIA GeForce RTX 3050 / GTX 1660 or AMD Radeon RX 5600 equivalent or better recommended). Systems with integrated graphics run in best-effort mode.
- **Memory (RAM):** 8 GB minimum (16 GB recommended for multi-4K projects).
- **Storage:** 500 MB available disk space.

---

## ⚡ Core Features & Architecture

### 1. WebGL2 Demand-Driven GPU Engine
- **Asynchronous GPU Pipeline:** Evaluations run on the GPU via optimized GLSL fragment shaders, completely offloading the main UI thread.
- **VRAM Texture Pool:** Managed 1.5 GiB LRU texture pool for responsive memory reclamation during heavy 4K texture operations.
- **Topological Compilation & Scheduler:** Frame-budgeted scheduler with generation cancellation and 120ms idle refinement to ensure 60 FPS viewport navigation during intense slider scrubbing.
- **Fast GPU Readback:** Asynchronous Pixel Buffer Objects (PBOs) for zero-stutter readbacks.

### 2. Byte-Exact PNG & TGA Codecs
- **Pure-JS Codecs:** Eliminates browser Canvas2D premultiplied alpha data destruction (resolves audit F-01). Channel values in packed textures (e.g. RGB in textures with zero alpha) are preserved byte-for-byte.
- **16-Bit Export:** Full support for true 16-bit PNG export for heightmaps and displacement.

### 3. "Graphite Blueprint" Workstation UI
- **Docked 3-Column Layout:** Obsidian `#0a0b10` tactical workstation theme with tokenized design system (`tokens.css`) passing 15/15 WCAG AA contrast tests.
- **Zoom Level of Detail (LOD):** Node cards transition between full detail, compact mode (<0.6 zoom), and simplified block mode (<0.35 zoom) with 12px lettered sockets ('R', 'G', 'B', 'A', 'C', 'S').
- **Non-Obtrusive Wires:** Crisp 1.5px orthogonal wires without glow filters or drop shadows; amber highlighting on selection.
- **Status Bar Telemetry:** Real-time indicator showing active GPU renderer, VRAM usage, document modification state, and zoom.

### 4. Pack & Unpack Wizard (<3 Clicks)
- Drag and drop any texture folder onto the canvas or open the Wizard (`Ctrl+W`).
- Autonomously recognizes industry naming conventions (`_AO`, `_Roughness`, `_Metallic`, `_Normal`, `_ORM`, `_RMA`).
- Generates pre-wired packing or unpacking pipelines in under 3 clicks.

### 5. Precision 2D Inspector Panel
- **A/B Wipe Slider:** Live split-screen comparison slider between different nodes or channels.
- **Tiling Repeat Test:** 2x2 and 3x3 repetition preview for instant texture seam verification.
- **Channel Isolation:** Instant isolation of `[RGBA]`, `[R]`, `[G]`, `[B]`, and `[A]` in true monochrome space.
- **Crosshair Pixel Probe:** Precision crosshair readout reporting coordinates `(X, Y)` and pixel values in both `0..255` integer and `0.00..1.00` normalized float space.

### 6. Atomic File Persistence & Fault Tolerance
- **Atomic `.tlab` Saves:** Staged `.tmp` writes with `fsync`, `.bak` backup preservation, and Windows `EBUSY` retry loops.
- **Crash Recovery & Autosave:** 30-second autosave loop with automatic restore prompts after abnormal termination.
- **Top-Level Error Boundaries:** Root and per-node React error boundaries with "Copy Diagnostics" (anonymized system telemetry, WebGL2 caps, and recent logs).

---

## 🚀 Development & Web Setup

### Prerequisites
- **Node.js:** v20+ LTS (v22+ recommended).
- **PowerShell / Terminal:** Windows PowerShell 5.1+ or PowerShell 7+.

### Quick Launchers (Root Directory)

- **`run_desktop_dev.bat`** — Launches Electron shell in development mode with hot module reloading.
- **`run_web.bat`** — Launches the browser workstation at `http://localhost:5173`.
- **`setup.bat`** — Verifies Node.js environment, installs packages, and runs test suites.

### Terminal Commands

```powershell
# Navigate to the app directory
cd app

# Install dependencies
npm install

# Run Vite development server
npm run dev

# Run Vitest test suite (208+ unit & golden tests)
npm test

# Run Oxlint linter
npm run lint

# Build production bundle
npm run build

# Run Playwright Electron smoke tests
npm run test:e2e

# Run performance benchmarks against architecture budgets
npm run perf

# Build desktop installer and portable executable
npm run dist
```

---

## 📚 Documentation & Reference

- [**User Guide**](docs/USER_GUIDE.md) — Node catalog, Pack & Unpack Wizard walkthrough, export tokens, and shortcuts.
- [**Developer & Maintenance Guide**](docs/MAINTENANCE.md) — Architecture, how to add a node in one file, release procedure, and test suites.
- [**Product Roadmap**](docs/ROADMAP.md) — Completed v1.0 milestones and upcoming v1.1 scope (auto-update, EXR/TIFF, 3D viewport).
- [**Known Issues**](docs/KNOWN_ISSUES.md) — Accepted gaps, SmartScreen details, and software GL fallback.
- [**Third-Party Licenses**](THIRD_PARTY_LICENSES.txt) — Open-source software licenses and attributions.

---

## 📄 License

ARKH TextureLab is proprietary software developed by ARKH LAB. Bundled third-party dependencies are licensed under their respective open-source licenses (MIT, ISC, OFL) as documented in `THIRD_PARTY_LICENSES.txt`.
