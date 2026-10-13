# Technical Specification: Unreal Engine Navigation, Drag-and-Drop & Workstation UX Overhaul

**Date**: 2026-10-10  
**Status**: Approved (Understanding Lock Confirmed)  
**Author**: ARKH LAB / Antigravity

---

## 1. Executive Summary

This specification outlines the complete UX modernization of ARKH TextureLab to match the interaction fidelity of the Unreal Engine 5 Material Editor. The upgrade delivers:
1. **Unreal Navigation & Gestures**: Right-click drag pan with click-vs-drag discrimination, right-click tap context spawn menu, Alt+Click wire breaking, and Hold-Key + Left-Click quick node spawning.
2. **Node Library Drag & Drop**: Smooth native drag-and-drop from the left Library Panel directly onto the canvas.
3. **Windows Explorer Ingestion**: Instant drag-and-drop ingestion of texture files (`.png`, `.tga`, `.jpg`, `.jpeg`, `.webp`), auto-spawning pre-populated `Texture Input` nodes with immediate thumbnail rendering, resolution inference, and PBR role tagging.
4. **Workstation UX Ergonomics**: Visual clarity improvements across nodes, sockets, toolbar groupings, and empty canvas onboarding.

---

## 2. Architectural Comparison of Approaches

### Approach A (Selected): Native Event-Driven ReactFlow Extension + Dedicated Unreal Interaction Controller
* **Architecture**: Decoupled custom React hooks (`useUnrealCanvasNavigation`, `useCanvasDrop`, `useTextureDrop`) integrated with ReactFlow's pane and window event listeners.
* **Complexity**: Low-Medium (zero external library bloat, 100% testable via vitest).
* **Rationale**: ReactFlow v12 natively handles viewport transformations (`screenToFlowPosition`). Extending it via event listeners on the wrapper and pane ensures 60 FPS performance, zero state desync, and full cross-platform compatibility (Browser + Electron).

### Approach B (Evaluated & Rejected): Global State Machine Overlay
* **Architecture**: A Zustand-managed interaction finite state machine (`IDLE`, `PANNING`, `MARQUEE_SELECTING`, `HOLD_KEY_SPAWNING`).
* **Why Rejected**: ReactFlow manages internal pan/zoom matrices. Synchronizing pointer events between Zustand and ReactFlow introduces redundant re-renders and potential pointer capture lag.

---

## 3. Subsystem Breakdown

### 3.1 Unreal Engine Navigation & Mouse Controls
* **Right-Click Drag Pan vs. Tap Menu**:
  * On `pointerdown` (button 2): Record start coordinates `(startX, startY)` and timestamp.
  * On `pointermove` (button 2): If displacement exceeds 5px, mark interaction as `isPanning = true`. ReactFlow native `panOnDrag={[1, 2]}` handles smooth panning.
  * On `pointerup` (button 2): If `isPanning === false` and elapsed time < 500ms, open the quick spawn menu (`SpawnPalette`) at the pointer position.
  * Suppress default browser context menu on canvas.
* **Alt + Left-Click Wire / Pin Disconnect**:
  * Edge click listener: if `event.altKey === true`, delete the targeted edge and push an undo snapshot.
  * Pin/handle click: if `event.altKey === true`, remove all edges connected to the targeted node/handle.
* **Hold-Key + Left-Click Quick Spawn**:
  * Keyboard listener tracks active hold keys: `T`, `1`, `3`, `M`, `A`, `L`, `O`.
  * When canvas pane receives `pointerdown` (button 0 / left click) while a valid hold key is active:
    * `T` + Click $\rightarrow$ `textureInput`
    * `1` + Click $\rightarrow$ `constantScalar`
    * `3` + Click $\rightarrow$ `constantColor`
    * `M` + Click $\rightarrow$ `math` (Multiply)
    * `A` + Click $\rightarrow$ `math` (Add)
    * `L` + Click $\rightarrow$ `blend` (Lerp)
    * `O` + Click $\rightarrow$ `invert` (OneMinus)
    * Calculates canvas coordinates via `screenToFlowPosition` and centers node at cursor.
* **Hotkeys**:
  * `C`: Wrap current selection in a Comment Box (or spawn at cursor).
  * `F` / `Home`: Center/fit view on selected node(s).

### 3.2 Left Panel (Node Library) Drag & Drop
* Remove `nodrag` class from draggable `.tl-library-item` elements in `LibraryPanel.tsx`.
* Standardize `onDragStart`:
  * `e.dataTransfer.setData('application/reactflow-node', def.type)`
  * `e.dataTransfer.setData('text/plain', def.type)`
* Canvas drop handler:
  * Reads node type, calls `screenToFlowPosition`, and creates node via `createSpawnedNode`.
  * Dispatches `addNode` to ensure undo/redo registration.

### 3.3 Windows Explorer Texture Drag & Drop
* Intercepts `dragover` and `drop` with `e.dataTransfer.files`.
* Filters supported extensions: `.png`, `.tga`, `.jpg`, `.jpeg`, `.webp`.
* For each valid file:
  * Generates instant preview: `URL.createObjectURL(file)`.
  * Runs `LexicalNormalizer.normalizeFilename(file.name)` for asset name, role (`BaseColor`, `Normal`, `Roughness`, `Metallic`, `AO`), and color space (`sRGB` vs `Linear`).
  * Asynchronously decodes raw pixels via `decodeImage` into `TextureBuffer` for the GPU pipeline.
  * Spawns `Texture Input` (`type: 'textureInput'`) with populated data.
  * Stacks multiple dropped textures vertically with 210px pitch.

---

## 4. Decision Log

* **Decision**: Retain canonical node type `textureInput` and label `Texture Input`.
  * *Rationale*: User explicitly requested to keep existing node name to maintain project compatibility and continuity.
* **Decision**: Implement Hold-Key + Left-Click spawn alongside existing single-key spawn shortcuts.
  * *Rationale*: Matches Unreal Engine Material Editor workflow exactly while maintaining backward-compatible hotkey ergonomics.
* **Decision**: Mandatory executable build post-implementation.
  * *Rationale*: Enforced workspace rule to guarantee zero packaging regressions.

---

## 5. Implementation Phases & Verification Gates

1. **Phase 1: Library & Windows Explorer Drag-and-Drop**:
   * Fix library item drag attributes and canvas drop listeners.
   * Add instant `previewUrl` generation and buffer attachment to dropped textures.
2. **Phase 2: Unreal Engine Navigation & Hotkeys Suite**:
   * Implement right-click drag-vs-tap discrimination.
   * Implement Alt+Click wire disconnect.
   * Implement Hold-Key + Click quick spawn.
3. **Phase 3: Workstation UX Polish**:
   * Enhance node card headers, socket hitboxes, toolbar groupings, and empty canvas guide.
4. **Phase 4: Automated Verification & Executable Desktop Build**:
   * Run full test suite (`npm test`).
   * Execute desktop build (`npm run build`).
