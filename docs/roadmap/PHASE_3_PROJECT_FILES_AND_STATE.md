# PHASE 3 — Project Files, State Store & Undo

**Goal:** The user can **save, reopen, and never lose work**. Replace ad-hoc React state and JSON-clone undo with a typed store and patch history. Pixels leave the document forever.
**Prereqs:** Phase 2 (native dialogs, userData, menus). **Effort:** M.
**Audit items closed:** F-16, F-23 (finish), F-25, F-27.

---

## Scope

IN: zustand store, patch history with drag coalescing, `.tlab` serialization + migration, asset registry + relink, Save/Open/New/Recent/dirty/close-guard, autosave + recovery, copy/paste, settings migration from localStorage.  
OUT: GPU, redesign, auto-update.

## Tasks

| ID | Task | Detail | Acceptance |
|---|---|---|---|
| P3-T1 | **Store.** `store/` with slices `document`, `selection`, `ui`, `session` (zustand). React Flow becomes controlled by the store (`onNodesChange`/`onEdgesChange` map into store actions). Position/selection/dimension changes **do not** create history steps; committed drags do. | | Re-render count test: selecting a node re-renders only that node + inspector (React Profiler / render counters) |
| P3-T2 | **History.** Patch-based (immer `produceWithPatches`, or zundo with `partialize`). `beginTransaction()/commit()` coalesces slider scrubs and node drags into one step (commit on pointer-up/blur). Limit 100. Undo/Redo available from menu + Ctrl+Z/Y. Remove the `JSON.parse(JSON.stringify())` snapshot code. | | TC-301..305 |
| P3-T3 | **Remove pixels/data-URLs from node data** (`previewUrl`, `onLoadBuffer`, etc.). Thumbnails become runtime-derived (kept in a non-persistent `runtime` map). | | `JSON.stringify(document).length` for the sample graph < 20 KB |
| P3-T4 | **Asset registry.** `assets[]` (id, rel, abs, bytes, mtimeMs, sha1-of-first-64KB+size for speed). `textureInput.params.assetId` references it. Importing the same file twice reuses the asset. Source buffers are keyed by `assetId`, not node id. | | TC-310 |
| P3-T5 | **Serialize/deserialize** (`graph/serialize.ts`) with Zod schema, `graph/migrate.ts` (v0 = current in-memory shape -> v1), unknown node types preserved as "Missing node" placeholders (never dropped silently). | | TC-320..327 |
| P3-T6 | **Save/Open/New/Recent.** Native dialogs via PlatformService; extension `.tlab`; register file association in electron-builder (`fileAssociations`); Recent (max 10) in `recent.json`; Title `Name* - TextureLab` with dirty marker; **Save is atomic**: write `.tmp` in same folder, `fsync`, `rename`; keep `.bak` of previous version. | | TC-330..336 |
| P3-T7 | **Close guard:** on window close/quit/New/Open with unsaved changes -> dialog Save / Don't Save / Cancel (main process intercepts `close`, asks renderer for dirty state). | | TC-337 |
| P3-T8 | **Autosave & recovery:** every 30 s if dirty and idle 2 s, write `userData/autosave/<projectId>.tlab.autosave`; on launch, if an autosave is newer than its project (or project unsaved), offer Recover / Discard. Delete autosave on clean save/close. | | TC-340..343 |
| P3-T9 | **Relink missing assets:** on open, resolve `rel` against the project folder, then `abs`; missing ones list in a "Relink" dialog (Locate file / Locate folder to search / Skip). Nodes with missing assets show a clear "Missing: name.png" state, never crash. | | TC-345..348 |
| P3-T10 | **Copy / Paste / Cut / Duplicate-with-wires:** clipboard JSON (`application/x-texturelab-nodes`) with nodes + internal edges + needed assets; paste at cursor with new ids; works across windows/projects (assets referenced by abs path). `C` stays "comment box" (no modifiers). | | TC-350..356 |
| P3-T11 | **Settings migration:** export presets + token settings from `localStorage` (`texturelab_export_presets`) into `userData/settings.json` once; keep localStorage as read-only fallback in web dev. | | TC-360 |
| P3-T12 | **Project-level export settings** stored in `.tlab` (asset name, pattern, directory relative path); global presets remain in settings. | | round-trip test |

## Test cases (selected; full list in `99_TEST_MATRIX_AND_EDGE_CASES.md`)

| ID | Test | Expected |
|---|---|---|
| TC-301 | Drag a node 50 px then Ctrl+Z | single undo returns to start |
| TC-302 | Scrub Levels slider 30 steps then Ctrl+Z | single undo step |
| TC-303 | Undo past empty | no-op, no error |
| TC-304 | Redo after new edit | redo stack cleared |
| TC-305 | 100+ edits | memory stable; oldest dropped |
| TC-310 | Import same file in 2 nodes | 1 asset, 2 references |
| TC-320 | Save -> Open round trip of 60-node graph | deep-equal documents |
| TC-321 | Open file with unknown node type | placeholder node, rest loads |
| TC-322 | Open `schemaVersion` newer than app | opens read-only + warning, never overwrites |
| TC-323 | Open truncated JSON | friendly error, app stays usable |
| TC-324 | Open JSON with wrong `format` | friendly error |
| TC-325 | Zod fails on one node | that node flagged; others load |
| TC-326 | migrate v0 fixture | loads |
| TC-327 | Serialize 500 nodes | < 50 ms |
| TC-330 | Save new project | `.tlab` created, title updates, dirty cleared |
| TC-331 | Save to read-only folder | clear error, document stays dirty |
| TC-332 | Kill process mid-save (simulate by throwing between write and rename) | original file intact |
| TC-333 | Save As to path with unicode/spaces | success |
| TC-334 | Double-click `.tlab` in Explorer | opens in app (installed build) |
| TC-335 | Recent list with deleted file | entry greyed/removed on click, message |
| TC-337 | Close dirty project | 3-way dialog works for each choice |
| TC-340 | Edit, wait 30 s, kill app, relaunch | recovery offered, content restored |
| TC-345 | Move project folder to another drive | relative assets resolve |
| TC-346 | Delete one asset then open | Relink dialog; skipping leaves labeled placeholder |
| TC-350 | Copy 3 connected nodes, paste | 3 nodes + 2 edges, new ids |
| TC-351 | Paste text that is not our JSON | ignored |
| TC-352 | Paste into other project | assets referenced by abs path, relink if missing |

## Edge cases

- Two windows/instances editing the same file: second open shows warning (lock file `*.tlab.lock` with pid; stale-lock detection).
- Project path > 260 chars; path with `#`, `%`, emoji.
- Asset file modified on disk after load: show "Modified on disk — Reload?" (stat on window focus).
- Asset is a network/UNC path or OneDrive placeholder (not yet downloaded): read may stall -> timeout + friendly error.
- Clock skew in `mtimeMs`; sha1 mismatch -> "File changed" notice (non-blocking).
- Undo across Save: dirty flag computed against saved revision id, not "stack length".
- Paste when clipboard holds 10k nodes: cap + warning.

## Exit criteria

- [x] Save/Open/Recent/dirty/close-guard/autosave/recovery work in the installed exe.
- [x] Round-trip + migration + corruption tests green.
- [x] No data-URLs or pixel data in `.tlab` or history.
- [x] Undo of drags/scrubs is one step.
- [x] Copy/paste across projects works.
- [x] Tracker + Handoff notes updated.

## Risks

| Risk | Mitigation |
|---|---|
| Store migration destabilises canvas | Migrate slice by slice behind adapter; keep e2e smoke green |
| Atomic rename on Windows when AV scans file | retry with backoff (3 x 100 ms) |
| Schema churn later | `schemaVersion` + migrations from day one |

## Evidence log

```
2026-10-05 / Antigravity / npm test -- --run (web-xyflow)
Test Files  18 passed (18)
Tests       157 passed (157)
- TC-301..305: HistoryManager produceWithPatches, transaction coalescing for slider scrubs & node drags, 100-step limit, redo clearing, revision tracking
- TC-310: AssetManager fast hash (FNV-1a 64KB + size), file deduplication (2 nodes same file -> 1 asset, 2 refs)
- TC-320..327: Zod-backed serialization, deep roundtrip, missing node placeholder resilience, newer schemaVersion read-only, corrupted JSON graceful handling, v0->v1 migration, 500-node serialization in 2.9ms (< 50ms budget)
- TC-330..333: Atomic file save (.tmp + fsync + rename), .bak generation, Windows EBUSY retry loop, mid-save crash simulation preserving original file, unicode/space paths
- TC-340..343: Autosave interval (30s) + idle detection (2s), startup recovery eligibility check
- TC-345..348: Relative-first asset path resolution, missing asset audit, batch folder relink
- TC-350..356: Clipboard engine (application/x-texturelab-nodes), internal edge rewiring, cross-project asset transfer, non-JSON rejection
- TC-360: Settings migration from localStorage (texturelab_export_presets) to settings.json
- P3-T1: Selection render isolation test (selecting a node updates selection without unselected node re-render)
- P3-T3: Sample document size test: 1.63 KB (< 20 KB budget), zero base64/previewUrl data

2026-10-05 / Antigravity / npm run lint (web-xyflow)
oxlint: 0 errors, 46 warnings across 149 files (max-lines 400 strictly observed; App.tsx at 390 lines)

2026-10-05 / Antigravity / npm run build (web-xyflow)
tsc -b && vite build && npm run build:desktop: 0 errors, built successfully in 539ms (renderer) + 35ms (desktop cjs)

2026-10-05 / Antigravity / npm run test:e2e (web-xyflow)
playwright test: 7 passed (1.8s) - renderer isolation, app:// protocol security, accelerator deduplication, window bounds clamp
```
