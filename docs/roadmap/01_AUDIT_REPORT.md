# 01 — Audit Report

**Scope:** whole repo at commit `41d6122`. **Baseline measured:** `npm test` 17/17 pass; `oxlint` 0 issues; `npm run build` OK; JS bundle 674 KB (193 KB gzip); `dist/` **208.6 MB**.
**Severity:** CRITICAL = wrong output / unusable on target PC. HIGH = major defect or product blocker. MED = quality. LOW = polish.
Paths are relative to `web-xyflow/` unless stated. Line numbers are as of the audit commit.

---

## A. Findings

### A1. Correctness (wrong or lost data)

| ID | Sev | Finding | Evidence | Fix in |
|---|---|---|---|---|
| F-01 | CRITICAL | **Packed-channel corruption risk.** All pixel I/O goes through Canvas2D (`drawImage`/`getImageData`/`putImageData`/`toBlob`). Canvas stores pixels *premultiplied by alpha*. In ORMH the **alpha channel carries Height**, so wherever Height is low, R/G/B (AO/Roughness/Metallic) are quantized on import and on export. This is spec-documented canvas behavior; Phase 0 adds a round-trip test that proves it in Chromium. | `engine/pixelEngine.ts:255-258` (import), `:365-371`, `engine/exportEngine.ts:620-623,649-658` (export) | P4 (exact decode/encode), P0 (proof test) |
| F-02 | HIGH | **Stale graph evaluation.** Re-evaluation is triggered by a hand-written string key that lists only some node fields. Fields edited via `onUpdateNodeData` but **missing from the key**: Math `op/valA/valB/param1/param2/min/max/exp/alpha`, NormalFlip `strength`, Resize `targetWidth/targetHeight/potMode`, Upscale `scale`, Seam `repeats/showBorders`, Compare `wipeProgress/diffGain`, Levels `channel`, Mixer `routes/scalarSlots`, Normalize `flipGreen`. Changing them may not refresh previews/export. | `App.tsx:233-243` vs `engine/graphEvaluator.ts:216-232,255-263,271,297-298,283-285,238,167-172,316`, writers e.g. `components/nodes/MathNode.tsx:81` | P1 |
| F-04 | HIGH | **16-bit option is fake.** `bitDepth` ('8b'/'16b') is stored and shown in UI but every buffer is `Uint8ClampedArray` and every encoder is 8-bit canvas/TGA. Users believe they export 16-bit. | `types/export.ts:57,104`, `components/FloatingDetailsPanel.tsx:771`, `engine/pixelEngine.ts:9` | P1 hide, P4 implement |
| F-05 | HIGH | **Non-square export distorts.** Resolution override resizes to `targetRes x targetRes`. A 4096x2048 map exported at "2K" becomes 2048x2048 (squashed). | `engine/exportEngine.ts:605-607,612-615`; `components/ExportModal.tsx:371-381` | P1 |
| F-06 | MED | **Resolution mismatch is undefined.** Constants are hard-coded 512x512; mixing with 4K inputs has no documented policy. | `engine/graphEvaluator.ts:103,108` | P1 (policy), P4 (uniform constants) |
| F-09 | HIGH | **Hotkeys fire with modifiers.** `S`, `O`, `N`, `I`, `L`, `B`, `T`, `M`, `W`, `F` spawn nodes / autowire / fit-view even with Ctrl held. Ctrl+S would spawn a Splitter; Ctrl+O an Output; Ctrl+W autowires; Ctrl+F fits view. Blocks adding Save/Open/Find. Also `contentEditable` isn't guarded (only INPUT/SELECT/TEXTAREA). | `App.tsx:900-902,954,1019-1039` | P1 |
| F-10 | MED | **Impure state updaters.** `setEdges` and `setStatusMessage` are called *inside* `setNodes(updater)`; updaters must be pure (double-invoked in StrictMode). Duplicate drops internal edges between duplicated nodes. | `App.tsx:975-989,1006-1013` | P1 |
| F-11 | MED | **Color-managed decode.** Images decoded via `<img>`/canvas may be color-converted by the browser (ICC/gAMA), altering data textures. | `engine/pixelEngine.ts:252-258` | P4 |

### A2. Performance (blocks "no lag on any PC")

| ID | Sev | Finding | Evidence | Fix in |
|---|---|---|---|---|
| F-07 | CRITICAL | **Build/app weight.** `public/sample_textures` (217 MB) is copied into every build: `dist/` = 208.6 MB while JS is 0.67 MB. An `.exe` built today would be >200 MB and unpack 200 MB per launch. | `public/sample_textures/*`, measured `dist/` listing | P0 |
| F-08 | CRITICAL | **4K benchmark auto-loads at startup** (7 maps decoded on the main thread). 4096x4096x4 B = **64 MiB per texture**; four inputs + combiner + output coerce = >= 384 MiB before the user does anything *(arithmetic from buffer sizes)*. | `App.tsx:405-438`, `engine/pixelEngine.ts:250-276` | P0 |
| F-12 | CRITICAL | **Entire graph re-evaluated synchronously on the UI thread for every slider tick**, all nodes, no cross-run cache, even nodes with no path to an output. | `App.tsx:253-256`, `engine/graphEvaluator.ts:67-402` (`for (const node of nodes) evaluateNode`) | P4 |
| F-13 | CRITICAL | **PNG-encode of a full 4K buffer inside evaluation.** `coerceUE5()` calls `PixelEngine.toDataUrl` (canvas `toDataURL('image/png')`, a synchronous encode) on full-resolution output for every scalar/RGB coercion. | `engine/graphEvaluator.ts:440,450,466`, `engine/pixelEngine.ts:365-371` | P4 |
| F-03 | HIGH | **README claims are untrue.** "Web Worker offloads 4K combine/levels/invert/normalFlip" and "interactive 512px proxies during slider drags": the evaluator never calls the worker (only `UpscaleNode` does: `components/nodes/UpscaleNode.tsx:42`), and the only consumer of `.proxy` is the inspector canvas (`FloatingDetailsPanel.tsx:101`). | README §Core Features 1; grep `Async(` and `.proxy` | P1 (docs), P4 (real) |
| F-14 | MED | **Duplicated math.** `pixelWorker.ts` (680 lines) re-implements `pixelEngine.ts` ops; two copies drift. | both files | P4 (delete worker) |
| F-15 | MED | Inspector allocates full-size buffers per refresh (`getIsolatedChannel`, `createImageData`) and computes histogram over every pixel on the main thread. | `FloatingDetailsPanel.tsx:94-130`, `pixelEngine.ts:376-393` | P4 |
| F-16 | MED | Undo snapshots deep-clone via `JSON.parse(JSON.stringify())`, including base64 `previewUrl` strings stored in node data; up to 40 snapshots. | `App.tsx:329-368`, `TextureInputNode.tsx:60-69` | P3 |
| F-17 | MED | Per-edge CSS animation + `drop-shadow` filter on selected edges + glow `box-shadow` per node: paint cost scales with node count. | `components/edges/AnimatedEdge.tsx`, `index.css:86-90`, `NodeCard.tsx:41-43` | P5 |
| F-18 | LOW | Single 674 KB JS chunk, no code splitting; Vite warns >500 KB. | build output | P6 |

### A3. Architecture & maintainability

| ID | Sev | Finding | Evidence | Fix in |
|---|---|---|---|---|
| F-19 | HIGH | **God files.** `App.tsx` 1450 lines (state, undo, hotkeys, spawn, layout, auto-wire, toolbar), `ExportModal.tsx` 1659, `FloatingDetailsPanel.tsx` 922, `pixelEngine.ts` 1316, `graphEvaluator.ts` 668 (one long `if/else` over node type strings). | `wc` listing | P1 |
| F-20 | HIGH | **No single source of truth for a node.** Adding one node touches: component file, `nodeTypes` map, evaluator branch, telemetry branch, library list, spawn palette, hotkey switch, default-data switch. | `App.tsx:276-318,600-740`, `graphEvaluator.ts`, `FloatingNodeLibrary.tsx`, `SpawnPalette.tsx` | P1 |
| F-21 | MED | **Type safety bypassed.** All 36 node registrations cast `as any`; node `data` is untyped; widespread `(x as any)`. oxlint is configured but doesn't flag it. | `App.tsx:276-318`, `graphEvaluator.ts:136,167` | P1 |
| F-22 | MED | **UI logic inside engine.** `GraphEvaluator` also hosts port telemetry and output-role auto-detection. | `graphEvaluator.ts:475-724` | P1 |
| F-23 | MED | **Node UI state duplicated.** `TextureInputNode` keeps `colorSpace`, `preview`, `tileU/V` in local `useState` *and* in node data. | `TextureInputNode.tsx:36-41` | P1/P3 |
| F-24 | LOW | Test coverage = 1 file (17 tests) on pure functions; no UI, no GPU, no export-flow, no store tests. | `src/__tests__/` | all |

### A4. Product gaps

| ID | Sev | Finding | Fix in |
|---|---|---|---|
| F-25 | CRITICAL | **No project save/load.** Graph lives only in memory; source images are bound by node id. Closing the window loses everything. | P3 |
| F-26 | HIGH | Browser-only APIs: `showDirectoryPicker` (Chromium only), `<a download>` ZIP fallback; no native dialogs, menus, file association, drag-from-Explorer path. | P2 |
| F-27 | HIGH | No Copy/Paste of nodes; `C` key used for comment box. | P3 |
| F-28 | MED | Node text 7-9 px; header icon buttons 15x15 px (WCAG 2.2 target-size minimum is 24x24). | P5 |
| F-29 | MED | Floating panels overlay the canvas; details panel overlaps wires; no docked layout. | P5 |
| F-30 | LOW | Default graph shows a pre-built concrete example instead of an empty state/onboarding. | P5 |

### A5. Repo hygiene

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| F-31 | HIGH | `.git` = **363 MB**. Big PNGs tracked twice (`sample_textures/` and `web-xyflow/public/sample_textures/`), only one file is on LFS. | `git ls-files` + size listing |
| F-32 | LOW | Duplicate font folders (`assets/fonts`, `web-xyflow/public/fonts`), Vite-template leftovers (`src/assets/hero.png`, `react.svg`, `vite.svg`, `public/icons.svg`) — verify each is unused with grep before deleting. | listing |
| F-33 | LOW | `package.json` name `web-xyflow`, version `0.0.0`; `web-xyflow/README.md` is template boilerplate. | file |

---

## B. Clutter to remove or demote

| Item | Action | Reason |
|---|---|---|
| Auto-loaded 4K benchmark at startup | Remove; keep as explicit "Open Sample" | F-08 |
| Glow shadows on nodes/edges | Remove; hairline + 2 px amber selection outline | F-17, design |
| Animated "marching ants" on every wire | Static wires; animate only selected/hovered/recomputing wire | F-17 |
| Floating Details panel | Replace with docked Inspector (tabs: Preview / Histogram / Properties) | F-29 |
| `ChannelPack`/`ChannelCombiner`, `ChannelUnpack`/`ChannelSplitter`, `ChannelMixer`/`ChannelSwizzle`, `Color`/`ConstantColor` duplicate aliases | One implementation per concept in the registry; keep aliases only for loading old data | F-20 |
| Batch nodes (LoadFolder/ForEach/BatchExport) | Hidden "Labs" category | D-05 |
| Compare node, Seam Check node | Become viewer tools | D-05 |
| 7-9 px micro text | Min 11 px | F-28 |
| Vite template assets, duplicate fonts | Delete after grep verification | F-32 |
| `pixelWorker.ts` + CPU engine in prod bundle | CPU engine moves to test-only `reference/`; worker deleted | F-14 |

## C. Features to add (prioritised with YAGNI)

| Tier | Feature | Phase |
|---|---|---|
| **Must (v1.0)** | Project Save/Save As/Open/New/Recent, dirty indicator | P3 |
| Must | Autosave + crash recovery | P3 |
| Must | Copy / Paste / Duplicate-with-wires | P3 |
| Must | Byte-exact decode/encode, true 16-bit PNG export | P4 |
| Must | Pack Wizard: drop a folder or N files -> auto-detected nodes + ORM/ORMH output wired | P5 |
| Must | Adaptive working resolution + background refine | P4 |
| Must | Empty state + onboarding hint, "Open Sample" | P5 |
| Should (v1.1) | Command palette Ctrl+K (extends Tab palette) | P5 stretch |
| Should | Auto-layout / align tools, snap-to-grid | P5 stretch |
| Should | Auto-update (D-08), EXR/TIFF (D-09) — both deferred to v1.1 by owner | later |
| Could (v2) | Lit 3D material preview (plane/sphere) using the same GPU context | later |
| Could | Drag exported file from app to Explorer | later |
| **Non-goal** | Telemetry, accounts, light theme, i18n, AI upscale | — |

## D. What is already good (keep)

- Clear separation of `engine/` vs `components/`; lexical filename normalizer; token naming engine; zero-dependency ZIP writer with CRC32; DAG validation on connect; established PBR socket color semantics; Geist font bundled; `React.memo`/context memoization work from commit `8f9ee57`.
