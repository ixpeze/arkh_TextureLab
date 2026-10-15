# ARKH TextureLAB — Quick Reference Operator Cheat Sheet

> **Product:** ARKH TextureLAB (v1.0.0) | **Scope:** 1-2 Page Desktop Operator Reference  
> **Companion Document:** [Master Reference](TextureLab_Master_Reference.md) · [HTML Manual](TextureLab_Master_Reference.html)

---

## 1. Canvas Navigation & Mouse Controls

| Mouse Action | Function | Behavior & Scope |
|---|---|---|
| **Right-Click Drag** | Pan Camera | Infinite canvas translation across coordinate grid. |
| **Mouse Wheel** | Zoom In / Out | Scales canvas centered on cursor (`0.1x` to `3.0x`). |
| **Right-Click Tap** / **`Tab`** | Spawn Palette | Spawns contextual fuzzy search box at mouse position. |
| **Left-Click + Drag Wire** | Connect Wires | Drag between any Output and Input socket (two-way). |
| **Wire Release on Canvas** | Auto-Wire Node | Opens palette; picks node and auto-connects wire. |
| **`Alt` + Left-Click** | Sever Wire / Pin | Cuts wire connection instantly under cursor. |
| **Double-Click Wire** | Insert Reroute | Inserts an inline `Reroute` pin to organize wiring. |
| **Left-Click + Drag Canvas** | Box Select | CAD-style marquee rectangle selecting intersecting nodes. |
| **Windows Explorer Drag** | Ingest Textures | Drag images into canvas $\to$ auto-creates `TextureInput` nodes. |

---

## 2. Hold-Key + Left-Click Quick-Spawn Chords

Hold the key down and **Left-Click** on empty canvas space to spawn nodes instantly:

```
┌──────────┬────────────────────────┬─────────────────────────────────────────┐
│ Chord    │ Spawns Node            │ Default Parameters & Use Case           │
├──────────┼────────────────────────┼─────────────────────────────────────────┤
│ 1 + Click│ ConstantScalar         │ Value: 0.5 (Roughness / AO default)     │
│ 3 + Click│ ConstantColor          │ RGBA: (128, 128, 255) (Normal neutral)  │
│ M + Click│ Math                   │ Multiply (Intensity / scalar scaling)   │
│ B + Click│ LayerBlend             │ Lerp with mask (Decal & detail blending)│
│ S + Click│ ChannelSplit           │ Unpacks RGBA into discrete R, G, B, A   │
│ C + Click│ ChannelCombine         │ Packs up to 4 channels into 1 RGBA map  │
│ P + Click│ ChannelCombine         │ Alternate chord for Channel Packing     │
│ N + Click│ NormalFlipGreen        │ Inverts Green (DirectX <-> OpenGL flip) │
│ L + Click│ Levels                 │ Histogram min/max and gamma correction  │
│ I + Click│ Invert                 │ Inverts buffer (Roughness <-> Gloss)    │
│ / + Click│ Comment                │ Resizable grouping and annotation box   │
└──────────┴────────────────────────┴─────────────────────────────────────────┘
```

---

## 3. Keyboard Shortcuts & Workflow Actions

| Shortcut | Action | Scope / Guard |
|---|---|---|
| **`F`** | Frame Selection (or Frame All) | Centers camera on active selection. |
| **`Delete`** | Delete Selected Nodes | Strictly guarded: typing in text inputs never deletes nodes. |
| **`Ctrl + F`** | Auto-Layout Graph | Reorganizes all nodes into compact non-overlapping columns. |
| **`Ctrl + Z`** | Undo | 100-step transactional history buffer. |
| **`Ctrl + Y`** | Redo | Restores previously undone transaction. |
| **`Ctrl + A`** | Select All | Highlights all nodes in active project. |
| **`Ctrl + C`** | Copy Nodes | Copies selected nodes and parameters to clipboard. |
| **`Ctrl + V`** | Paste Nodes | Pastes clipboard nodes centered at mouse cursor. |
| **`Ctrl + D`** | Duplicate Nodes | Duplicates selection with a `+30px, +30px` offset. |
| **`Ctrl + S`** | Save Project | Saves `.tlab` JSON project file. |
| **`Ctrl + E`** | Export Textures Drawer | Opens preflight review and export targets table. |
| **`Escape`** | Dismiss / Cancel | Closes search palette or cancels active wire dragging. |

---

## 4. Standard PBR Channel Packing Recipes

### Recipe 1: Unreal Engine 5 ORM Standard
- **Slot Name**: `ORM` | **Naming Pattern**: `T_{asset}_ORM.tga` | **Color Space**: Linear
  - **Red (`R`)**: Ambient Occlusion (AO)
  - **Green (`G`)**: Roughness
  - **Blue (`B`)**: Metallic
  - **Alpha (`A`)**: Solid White ($1.0$) or Height / Displacement

### Recipe 2: Unity URP / HDRP MaskMap
- **Slot Name**: `MaskMap` | **Naming Pattern**: `{asset}_MaskMap.png` | **Color Space**: Linear
  - **Red (`R`)**: Metallic
  - **Green (`G`)**: Ambient Occlusion (AO)
  - **Blue (`B`)**: Detail Mask (or Thickness)
  - **Alpha (`A`)**: Smoothness ($1.0 - \text{Roughness}$ or raw Glossiness)

### Recipe 3: Blender Principled BSDF / glTF 2.0
- **Base Color**: `{asset}_BaseColor.png` (sRGB)
- **Normal**: `{asset}_Normal.png` (OpenGL $+Y$, Linear)
- **Roughness**: `{asset}_Roughness.png` (Grayscale Linear)
- **Metallic**: `{asset}_Metallic.png` (Grayscale Linear)

---

## 5. Headless CLI Quick Reference (`texturelab-cli`)

```powershell
# Syntax
texturelab-cli.exe --graph <GRAPH_OR_TEMPLATE> --input <DIR> [OPTIONS]

# 1. Pack directory using built-in Pack template and UE5 preset
texturelab-cli.exe --graph "Pack Texture" --input "C:\Assets\Rock" --preset ue5

# 2. Execute custom project graph with 2K resolution override
texturelab-cli.exe --graph "C:\Projects\Packer.tlab" --input "C:\Assets\Hero" --resolution 2048x2048 --format TGA

# 3. Headless automation in quiet mode (ideal for CI/CD runners)
texturelab-cli.exe --graph "Pack Texture" --input "./textures/raw" --output "./textures/engine" --quiet
```

---

## 6. Preflight Validation Quality Gates

Before exporting or committing assets, ensure your graph satisfies all 4 gates:

1. **[Completeness]**: Are all required slots (`BaseColor`, `Normal`, `ORM`/`MaskMap`) connected to a `SaveImage` node?
2. **[Uniformity]**: Do all texture inputs evaluate to identical pixel dimensions (e.g. all 4096×4096)? *Fix: Click "Auto-Fix Resolution Mismatches" to insert `Resize` nodes.*
3. **[Power of Two (POT)]**: Are all map dimensions binary multiples of two ($512, 1024, 2048, 4096$)? *Non-POT textures cause GPU streaming and mipmap failures.*
4. **[Normal Space]**: Does the target engine match normal green orientation?
   - Unreal Engine / CryEngine / 3ds Max: **DirectX ($-Y$)**.
   - Unity / Blender / Maya / Godot: **OpenGL ($+Y$)**. *Fix: Insert `NormalFlipGreen`.*
