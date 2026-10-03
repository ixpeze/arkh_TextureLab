# Technical Specification: Global Export System & Texture Output Node Refactor

**Date:** 2026-10-03  
**Status:** Approved for Implementation  
**Target:** TextureLab (`web-xyflow`)  

---

## 1. Executive Summary

This specification defines the architectural overhaul of TextureLab's texture output and export pipeline:
1. **Texture Output Node Refactoring**: Complete removal of the legacy inline "Export Buffer" button from the canvas node card. Clean HUD telemetry showing slot role, format, bit depth, and live thumbnail preview.
2. **Substance-Style Export Hub Modal**: A centralized, production-grade export window launched from the top DCC toolbar.
3. **Interactive Token Naming Engine**: Draggable/reorderable token chips (`$project`, `$asset`, `$slot`, `$res`, `$format`, `$colorspace`), industry export presets (Unreal Engine 5, Unity HDRP/URP, Blender PBR, Substance Classic), and real-time filename resolution.
4. **Dual-Tier Settings Architecture**: Master global settings (naming, resolution, destination) with granular local overrides (slot identifier, format, bit depth, color space, export toggle) editable in the Inspector panel and inside the Export Hub table.
5. **Direct Disk & ZIP Pipeline**: File System Access API (`window.showDirectoryPicker()`) for zero-prompt direct folder writing on disk, with automatic fallback to packaged ZIP archives and browser downloads.

---

## 2. Architecture & Component Boundaries

```
[ App Header Bar ]
       │
       ▼ (Clicks "Export" Button)
[ ExportModal.tsx (Substance 3D Style) ]
  ├── Preset Selector (UE5, Unity, Blender, Custom)
  ├── Global Master Controls (Asset, Project, Master Res, Folder Picker)
  ├── Interactive Token Bar (Drag/Reorder/Insert/Reset Tokens + Live Preview)
  └── Pre-Flight Output Table (All textureOutput nodes in graph)
        ├── Slot Role inline edit
        ├── Connection status (Thumbnail / Disconnected warning)
        ├── Local format / bit depth / color space overrides
        └── Include/Exclude toggle checkboxes
       │
       ▼ (Clicks "Export Textures")
[ exportEngine.ts ]
  ├── Resolve filenames from token engine
  ├── Evaluate buffers from GraphEvaluator / PixelEngine
  ├── Encode formats (PNG, TGA uncompressed binary, JPG, WebP)
  └── Stream to FileSystemDirectoryHandle OR bundle to ZIP fallback
```

### Component Roles

| File / Component | Responsibility |
|---|---|
| [`src/types/export.ts`](file:///g:/AI/_ARKH_LAB/arkh_TextureLab/web-xyflow/src/types/export.ts) | Canonical types for presets, tokens, global export configuration, and local node overrides. |
| [`src/components/ExportModal.tsx`](file:///g:/AI/_ARKH_LAB/arkh_TextureLab/web-xyflow/src/components/ExportModal.tsx) | Tactical modal dialog with token editor, folder picker, preset manager, and batch table. |
| [`src/components/nodes/TextureOutputNode.tsx`](file:///g:/AI/_ARKH_LAB/arkh_TextureLab/web-xyflow/src/components/nodes/TextureOutputNode.tsx) | Clean canvas card. Removed old export button. Displays live preview, socket, slot pill, and format badge. |
| [`src/components/FloatingDetailsPanel.tsx`](file:///g:/AI/_ARKH_LAB/arkh_TextureLab/web-xyflow/src/components/FloatingDetailsPanel.tsx) | Inspector section for `textureOutput` with slot shortcuts, format override, color space, and bit depth. |
| [`src/engine/exportEngine.ts`](file:///g:/AI/_ARKH_LAB/arkh_TextureLab/web-xyflow/src/engine/exportEngine.ts) | Token resolver, TGA binary encoder, File System Access API streaming, and ZIP package orchestrator. |
| [`src/App.tsx`](file:///g:/AI/_ARKH_LAB/arkh_TextureLab/web-xyflow/src/App.tsx) | Header toolbar "Export Textures" trigger button, modal state management, and graph sync. |

---

## 3. Data Flow & Token Resolution

### Token Schema
Available tokens:
- `$project`: Active project name (default: `TextureLab`)
- `$asset`: Active primary asset name (e.g. `AnthraciteConcrete`)
- `$slot`: Node slot role (e.g. `ORM`, `BaseColor`, `Normal`, `Roughness`, `Metallic`)
- `$res`: Resolution string (e.g. `4K`, `2048`)
- `$format`: File extension in lowercase or uppercase (`png`, `tga`, `jpg`)
- `$colorspace`: Color space tag (`linear`, `srgb`)

### Presets
1. **Unreal Engine 5**: `T_{asset}_{slot}` (e.g. `T_ConcreteWall_ORM.png`)
2. **Unity URP / HDRP**: `{asset}_{slot}` (e.g. `ConcreteWall_MaskMap.png`)
3. **Substance 3D Painter Classic**: `{asset}_{slot}_{res}` (e.g. `ConcreteWall_ORM_4K.png`)
4. **Blender / glTF**: `{asset}_{slot}` (e.g. `ConcreteWall_Normal.png`)
5. **Custom**: User-defined sequence of tokens and custom separators (`_`, `-`, `.`).

---

## 4. Local Settings vs Global Settings Inheritance

| Setting | Global Level | Local Output Node Override |
|---|---|---|
| **Naming Pattern** | Master token sequence | Uses global token sequence with local `$slot` |
| **Resolution** | Master Resolution (`Inherit Graph`, `1K`, `2K`, `4K`, `8K`) | `Inherit (Default)` or lock to specific resolution |
| **Format** | Default Format (`PNG`, `TGA`, `JPG`, `WebP`) | `Inherit (Default)` or override (e.g. Normal as TGA, ORM as PNG) |
| **Bit Depth** | Default Bit Depth (`8-bit`, `16-bit`) | `Inherit (Default)` or override (e.g. Height as 16-bit) |
| **Color Space** | Pipeline default | Per-node: `Linear` (for Normal, ORM, Masks) or `sRGB` (for Albedo) |
| **Export Status** | Batch trigger | Per-node: `Enabled` checkbox to mute/unmute from batch |

---

## 5. Decision Log

- **Decision: Substance-Style Export Modal**
  - *Alternatives Evaluated*: In-canvas node form inputs; right-side inspector tab; bottom drawer.
  - *Rationale*: A dedicated modal provides full visual width for token dragging, preset switching, folder picking, and the pre-flight verification table without cluttering canvas nodes or viewport space.
  - *Trade-offs Accepted*: Requires opening a modal dialog to start batch export (standard in DCC software like Substance Painter, Marmoset, and Unreal).

- **Decision: Hybrid Local Settings (Inspector + Modal Table + Node Badge)**
  - *Alternatives Evaluated*: Node card embedded dropdowns; Inspector-only editing.
  - *Rationale*: Keeps canvas nodes fast and uncluttered while letting artists adjust settings either in the context of graph editing (Inspector) or in batch context (Export Modal table).
  - *Trade-offs Accepted*: Must synchronize node data updates between Inspector and Modal table seamlessly.

- **Decision: File System Access API with ZIP Fallback**
  - *Alternatives Evaluated*: Individual browser downloads; server-side ZIP.
  - *Rationale*: Native `showDirectoryPicker()` writes directly to the user's project textures folder with zero browser download prompts. If not supported or denied, falls back to a clean client-side ZIP file.
  - *Trade-offs Accepted*: Modern Chromium browsers support Directory Picker natively; Firefox/Safari gracefully use the ZIP fallback.

---

## 6. Implementation Verification Gates
1. Canvas node card renders with zero clutter and no "Export Buffer" button.
2. Clicking "Export" in the header opens the Export Modal with all active output nodes loaded.
3. Dragging, reordering, adding, and removing tokens updates the live filename preview instantly.
4. Selecting UE5 / Unity / Substance presets instantly updates the naming tokens.
5. Ingesting or connecting nodes dynamically updates the Ready / Disconnected state in the modal table.
6. Triggering export writes files to the picked directory or prompts for ZIP download with accurate filenames, resolutions, and formats.
