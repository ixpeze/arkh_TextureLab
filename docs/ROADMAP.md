# ARKH TextureLab — Product Roadmap

This document outlines the product direction and upcoming releases for ARKH TextureLab.

---

## 🏆 Current Release: v1.0.0 (Production Hardened)

**Status:** Completed (October 2026)

All foundational milestones (Phases 0 through 6) have been completed and verified:
- **Phase 0:** Hygiene, repository asset diet (-99%), and CPU golden fixtures.
- **Phase 1:** Graph correctness, modular NodeRegistry (12 node families), and 400-line ceiling enforcement.
- **Phase 2:** Sandboxed Electron desktop shell with native menus, window state, and installer packaging.
- **Phase 3:** Zustand state management, 100-step Immer undo/redo, `.tlab` serialization, and atomic saves.
- **Phase 4:** WebGL2 demand-driven GPU evaluation engine with byte-exact PNG/TGA I/O (F-01 solved).
- **Phase 5:** "Graphite Blueprint" professional workstation UI, LOD nodes, docked panels, Pack & Unpack Wizard, and 2D Inspector.
- **Phase 6:** Production hardening, error boundaries, diagnostics, fault injection recovery, and soak testing.

---

## 🚀 Next Milestone: v1.1.0 (Workflow Expansion & Formats)

**Target Timeline:** Q4 2026 / Q1 2027

### 1. Extended Image Codec Support (D-08)
- **OpenEXR (`.exr`):** Native 16-bit and 32-bit floating point import and export for high dynamic range heightmaps and displacement.
- **Tagged Image File Format (`.tiff`):** Uncompressed and LZW-compressed 8-bit/16-bit TIFF textures.

### 2. Native In-App Auto-Updater (D-09)
- Integration with GitHub Releases API via `electron-updater`.
- Background update checks with non-intrusive notification badge in the Status Bar.
- One-click update and restart.

### 3. Quick Command Palette (`Ctrl+K` / `Ctrl+P`)
- Searchable fuzzy-filter command overlay for rapid node creation, canvas actions, and preset loading without touching the mouse.
- Direct parameter jumps and hotkey cheat sheet integration.

### 4. Interactive 3D PBR Viewport
- Dockable WebGL/Three.js 3D viewport panel alongside the 2D Inspector.
- Real-time PBR standard material shader visualizing current packed Albedo, Roughness, Metallic, Normal, and Ambient Occlusion maps.
- Geometry presets: Shader Ball, Cube, Cylinder, Plane, and Custom OBJ/FBX drop-in.
- Studio HDRI environment lighting with rotational controls.

---

## 🔮 Future Horizons (v1.2+)

- **Procedural Noise & Pattern Generators:** Voronoi, Perlin, Simplex, Brick, and Weave generation nodes evaluated directly via GLSL shaders.
- **Batch Processing CLI:** Headless CLI mode for processing multiple texture folders using a saved `.tlab` pipeline graph.
- **Custom Shader Node (GLSL):** Node type allowing technical artists to write custom fragment shader code directly in an integrated Monaco editor.
- **Cross-Platform Installers:** Native builds for Linux (AppImage) and macOS (DMG/Universal).
