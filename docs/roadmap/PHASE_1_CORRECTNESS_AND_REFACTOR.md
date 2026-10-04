# PHASE 1 — Correctness & Refactor

**Goal:** Fix real bugs with tests first, then reshape the code (node registry, split God-files, typed data) so every later phase is cheap. Behavior stays the same apart from the bug fixes. This phase still uses the existing CPU engine.
**Prereqs:** Phase 0 exit criteria. **Effort:** L.
**Audit items closed:** F-02, F-04 (UI part), F-05, F-06 (policy), F-09, F-10, F-19, F-20, F-21, F-22, F-23, F-24 (partly), F-03 (docs part).

---

## Scope

IN: bug fixes, node registry, file splitting, typing, docs honesty, hotkey system.  
OUT: GPU, Electron, project files, visual redesign (leave current look; only structural changes).

## Part A — Bug fixes (TEST FIRST: write failing test, commit, then fix)

| ID | Task | Detail | Acceptance |
|---|---|---|---|
| P1-A1 | **Stale-key fix (F-02).** Extract `graph/hash.ts`: `nodeContentHash(node)` = stable stringify of `data` **minus UI-only keys** (`previewUrl`, `title`, `isPinned`, `roleColor`, `res`, `onLoadBuffer`, any function) + edge list sorted. Replace `graphStructureKey` (`App.tsx:233-243`) with it. | Tests (TC-101..108): changing each of Math `valA`, `op`, Resize `targetWidth`, Upscale `scale`, Seam `repeats`, NormalFlip `strength`, Levels `channel`, Mixer `routes` MUST change the hash; changing `position`/`selected`/`previewUrl` MUST NOT. |
| P1-A2 | **Hotkey system (F-09).** New `features/hotkeys/hotkeys.ts`: declarative table `{ id, chord, scope, handler }`, one `keydown` listener. Rules: single-letter spawn hotkeys fire only with **no ctrl/meta/alt**; ignore when target is INPUT/SELECT/TEXTAREA/`contentEditable`/inside a modal; **reserved chords** (Ctrl+S/O/N/W/Shift+S/P/Q/R/F/K/C/V/X/Z/Y/A/D/E) never spawn nodes. | TC-110..115 unit tests on the pure dispatcher (simulate KeyboardEvent-like objects). |
| P1-A3 | **Pure updates (F-10).** Create `store`-less helper actions in `app/graphActions.ts`: `deleteNodes(ids)`, `duplicateNodes(ids)` operate on `{nodes, edges}` together and return both; no `setX` inside updaters. Duplicate must **keep edges whose both ends are duplicated** and remap ids with a collision-safe generator (`crypto.randomUUID`). | TC-120..123 |
| P1-A4 | **Export aspect (F-05).** `encodeImageBlob(buffer, format, target)` -> `target: {mode:'inherit'} \| {mode:'longEdge', px} \| {mode:'stretch', w, h}`; default `longEdge` preserves aspect; TGA path identical. Update `ExportModal.tsx:371-381` call. | TC-125..127: 4096x2048 @2048 -> 2048x1024; 1000x1000 @512 -> 512x512; `inherit` unchanged. |
| P1-A5 | **Honest 16-bit (F-04).** Remove/disable the 16b choice in UI (`FloatingDetailsPanel.tsx:771`, `ExportModal`, `BatchExportNode`) with tooltip "Coming in v1.0 final". Keep type `TextureBitDepth` but force `'8b'` at export. | TC-128: exported metadata never says 16b. |
| P1-A6 | **Resolution policy (F-06)** per `02_TARGET_ARCHITECTURE.md` §6.7, implemented in CPU engine: output res = largest connected input; smaller resampled bilinear; constants adopt the other input's res (if alone: 1x1 -> expanded lazily to 512). | TC-130..134 + golden fixtures regenerated *only for these cases* (document the diff in the commit). |
| P1-A7 | **Docs honesty (F-03).** Rewrite README "Core Features 1" to what exists today; remove worker/proxy claims (they return in Phase 4 for real). Add banner "Pre-1.0 rewrite in progress — see docs/roadmap". | README diff reviewed |

## Part B — Structural refactor

| ID | Task | Detail | Acceptance |
|---|---|---|---|
| P1-B1 | **Node registry.** Create `nodes/registry.ts` + `nodes/defs/*.ts` per `02_TARGET_ARCHITECTURE.md` §3. Migrate in this order (one commit each): constants -> textureInput -> channelCombiner -> channelSplitter -> textureOutput -> levels -> invert/normalFlip/normalize -> math x13 (factory) -> blend/normalBlend -> mixer -> resize/upscale -> utility/labs (loadFolder/forEach/batchExport/compare/seamCheck/comment). | After each: `npm test` green; app loads; node still spawns via Tab palette and hotkey. |
| P1-B2 | Evaluator dispatch table. Replace the `if/else` chain in `graphEvaluator.ts:96-385` with `registry.get(type).cpuRef(...)`. Aliases (`channelPack`->`channelCombiner`, `channelUnpack`->`channelSplitter`, `color`->`constantColor`, `channelSwizzle`->`channelMixer`) handled by `legacyAliases` only. | golden suite unchanged (P0-T8) |
| P1-B3 | Move UI logic out of engine (F-22): `getNodePortTelemetry`, `autoDetectOutputRole` -> `graph/introspect.ts`, registry-driven. | tests moved + green |
| P1-B4 | Typed node data (F-21): `NodeParams<T>` inferred from each def's schema; `nodeTypes` generated from registry (no `as any`). | `no-explicit-any` count = **0** in `src/engine`, `src/nodes`, `src/graph`; <= 30 repo-wide |
| P1-B5 | Split `App.tsx` (1450 lines): `app/App.tsx` (shell), `app/Toolbar.tsx`, `app/Canvas.tsx`, `app/useGraphActions.ts`, `app/useUndoRedo.ts` (still snapshot-based; replaced in P3), `app/spawn.ts`, `app/autoWire.ts`. | no file > 400 lines |
| P1-B6 | Split `ExportModal.tsx` (1659) into `features/export/{PresetBar,TokenField,PreflightTable,DestinationPicker,ProgressFooter,ExportModal}.tsx` + `useExportState.ts`. | each <= 400 lines; Export flow smoke test passes |
| P1-B7 | Split `FloatingDetailsPanel.tsx` (922) into `features/inspector/{InspectorPanel,ViewportTab,HistogramTab,PropertiesTab}.tsx`. | each <= 400 lines |
| P1-B8 | Local-state duplication (F-23): `TextureInputNode` reads `colorSpace/tile/preview` from node data only. | grep shows no `useState(d.` mirrors |
| P1-B9 | Enable lint `max-lines` as **error** for `src/`, remove template leftovers. | `npm run lint` clean |

## Test cases

| ID | Area | Test | Expected |
|---|---|---|---|
| TC-101..108 | Hash | param-change matrix (see A1) | changes -> new hash; UI-only -> same hash |
| TC-110 | Hotkeys | `S` plain | spawns Splitter |
| TC-111 | Hotkeys | `Ctrl+S` | does NOT spawn; reserved |
| TC-112 | Hotkeys | typing `s` in a text input | nothing |
| TC-113 | Hotkeys | typing in contentEditable | nothing |
| TC-114 | Hotkeys | modal open + `T` | nothing |
| TC-115 | Hotkeys | `Ctrl+W` | no autowire |
| TC-120 | Duplicate | 2 connected nodes duplicated | 2 new nodes + 1 new edge between copies |
| TC-121 | Duplicate | 1 of 2 connected nodes duplicated | no dangling edge |
| TC-122 | Delete | node with 3 edges | node + 3 edges removed, undo restores all |
| TC-123 | Ids | duplicate 1000 times quickly | all ids unique |
| TC-125..127 | Export | aspect cases above | exact output dims |
| TC-130 | Policy | 4K tex + const scalar | 4K output |
| TC-131 | Policy | 4K + 1K into combiner | 4K, smaller resampled |
| TC-132 | Policy | only constants | 512x512 |
| TC-133 | Policy | non-square 2048x1024 + 1024x1024 | 2048x1024 |
| TC-134 | Policy | 1x1 texture input | broadcast, no crash |
| TC-140 | Registry | every registered type has defaults, ports, label, category, cpuRef or gpu spec | test iterates registry |
| TC-141 | Registry | legacy alias load | `channelPack` resolves to `channelCombiner` |
| TC-142 | Registry | duplicate hotkeys | none |

## Edge cases

- Hash of NaN / `undefined` / `-0`: canonicalize (`NaN`->`"NaN"`, `-0`->`0`).
- Hash must ignore key order (sort keys).
- Cyclic graph in hash/compile: must not infinite-loop (existing `visiting` guard retained).
- Node `data` containing huge strings (data-URLs) excluded from hash for speed.
- Hotkey with non-US layouts: use `event.code` for letter keys when `event.key` is non-latin; test with `KeyboardEvent` `code:'KeyS', key:'ы'`.
- Duplicate with comment boxes (parent/child groups) keeps relative layout.

## Exit criteria

- [x] All Part A tasks done with failing-test-first commits visible in `git log`.
- [x] Registry drives palette, spawn, hotkeys, evaluator, telemetry. Adding a dummy node requires **only** one new file (prove by adding `nodes/defs/_example.ts` in a test, then removing).
- [x] No source file > 400 lines; no `any` in core folders.
- [x] Golden suite + all new tests green; lint 0; build green.
- [x] README is truthful.
- [x] Tracker + Handoff notes updated.

## Risks

| Risk | Mitigation |
|---|---|
| Registry migration regresses node behavior | Golden suite runs after every node migration commit |
| Hotkey table changes muscle memory | Keep all existing single-letter hotkeys; only add modifier guards |
| Large diff | One node family per commit; never mix refactor + behavior change in one commit |

## Evidence log

```
2026-10-04 | Antigravity | P1-A1 (F-02) failing test commit | git commit e104e96: test(hash): add unit tests for graphContentHash (TC-100..103)
2026-10-04 | Antigravity | P1-A1 (F-02) passing fix commit  | git commit bc7bbd8: fix(graph): extract graphContentHash to fix stale-key hashing bug (F-02)
2026-10-04 | Antigravity | P1-A2 (F-09) failing test commit | git commit e2d9d63: test(hotkeys): add unit tests for hotkey normalization and resolution (TC-110..115)
2026-10-04 | Antigravity | P1-A2 (F-09) passing fix commit  | git commit 7f9195b: fix(hotkeys): extract centralized hotkey dispatch module (F-09)
2026-10-04 | Antigravity | P1-A3 (F-10) failing test commit | git commit a999672: test(graph): add unit tests for pure duplicate and delete graph actions (TC-120..123)
2026-10-04 | Antigravity | P1-A3 (F-10) passing fix commit  | git commit 9bea62c: fix(graph): extract pure duplicate and delete graph actions with relative offset (F-10)
2026-10-04 | Antigravity | P1-A4 (F-05) failing test commit | git commit 2cd0d2d: test(export): add unit tests for export resolution aspect preservation (TC-125..127)
2026-10-04 | Antigravity | P1-A4 (F-05) passing fix commit  | git commit 87b7c9d: fix(export): preserve aspect ratio on master resolution downscale (F-05)
2026-10-04 | Antigravity | P1-A5 (F-04) failing test commit | git commit f0f1678: test(export): add unit test for honest 8-bit export enforcement (F-04)
2026-10-04 | Antigravity | P1-A5 (F-04) passing fix commit  | git commit 2dc21a9: fix(export): enforce honest 8-bit export metadata and disable 16b UI (F-04)
2026-10-04 | Antigravity | P1-A6 (F-06) failing test commit | git commit e5694b9: test(policy): add unit tests for graph resolution policy (TC-130..134)
2026-10-04 | Antigravity | P1-A6 (F-06) passing fix commit  | git commit 68d079c: fix(policy): implement resolution propagation policy in pixelEngine and graphEvaluator (F-06)
2026-10-04 | Antigravity | P1-A7 (F-03) docs honesty commit | git commit ae2aff8: docs(readme): add pre-1.0 honest status banner and clarify format capabilities (F-03)
2026-10-04 | Antigravity | P1-B1 (12 node families)        | 12 commits: refactor(nodes): migrate Input, Channel, Math, Adjust, Blend, Output, Utility, Labs families to registry
2026-10-04 | Antigravity | P1-B2 (Evaluator dispatch)      | git commit 66edc4b: refactor(evaluator): dispatch node evaluation through nodeRegistry (P1-B2)
2026-10-04 | Antigravity | P1-B3 (Introspect UI out of eng)| git commit 081c622: refactor(graph): move UI introspection logic out of engine to graph/introspect (P1-B3)
2026-10-04 | Antigravity | P1-B4 (Typed node data, F-21)   | git commit 2e1d706: refactor(types): eliminate no-explicit-any in engine, nodes, and graph core (P1-B4)
2026-10-04 | Antigravity | P1-B8 (Local-state dup, F-23)   | git commit 49b5d4a: fix(ui): eliminate local-state duplication in TextureInputNode (P1-B8)
2026-10-04 | Antigravity | P1-B5 (Split App.tsx)           | git commit b65b35d: refactor(app): modularize App.tsx into submodules under 400 lines (P1-B5)
2026-10-04 | Antigravity | P1-B6 (Split ExportModal.tsx)   | git commit bdfe9ed: refactor(export): split ExportModal into features/export submodules under 400 lines (P1-B6)
2026-10-04 | Antigravity | P1-B7 (Split FloatingDetails)   | git commit 9b8e15b: refactor(inspector): split FloatingDetailsPanel into features/inspector under 400 lines (P1-B7)
2026-10-04 | Antigravity | P1-B9 (UI splits < 400 lines)   | git commit 6406d16: refactor(ui): split ChannelMixerNode and FloatingNodeLibrary under 400 lines (P1-B9)
2026-10-04 | Antigravity | P1-B9 (Node system < 400 lines) | git commit b5e540f: refactor(ui): modularize NodeControls and NodeSocket under 400 lines (P1-B9)
2026-10-04 | Antigravity | P1-B9 (Engine splits < 400 lines)| git commit 8263dac: refactor(engine): split exportEngine and normalizer, enforce max-lines 400 as error (P1-B9)
2026-10-04 | Antigravity | Exit Criterion 2 Proof         | npx vitest run src/__tests__/unit/registryDummyNode.test.ts -> 1 passed (proved single-file registration via src/nodes/defs/_example.ts, cleaned up)
2026-10-04 | Antigravity | Final Verification Suite        | npm test (117 passed) && npm run lint (0 errors) && npm run build (built cleanly in 805ms) -> ALL GREEN
```

