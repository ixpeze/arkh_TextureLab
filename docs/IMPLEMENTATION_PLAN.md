# ARKH TextureLab — v2.0 Implementation Plan

**Date**: 2026-10-14
**Status**: Approved (Understanding Lock Confirmed)
**Target**: Gemini 3.8 Flash (High) — one prompt per task card, `cargo test` + `cargo clippy` + git commit at the end of each.

---

## Product Direction

TextureLab is a **pipeline workstation**: best-in-class packing, conversion, batch processing, and validation for game and archviz texture sets. Procedural nodes are helpers only. No 3D viewport. CPU-only compute (Rayon). Single portable binary.

---

## Decision Log

| # | Decision | Alternatives Evaluated | Rationale |
|---|---|---|---|
| D1 | Remove Lite/Pro edition split permanently | Keep with license key; keep as-is | The toggle is cosmetic — anyone can switch to Pro. Adds dead code and test weight. |
| D2 | Upgrade evaluator to 16-bit (u16) storage, f32 math | Stay 8-bit; go full f32 | Height/normal maps band at 8-bit. Full f32 costs 256 MB per 4K RGBA node. u16 is 2× 8-bit, sufficient for pipeline work. |
| D3 | Constants become 1-pixel values with broadcast semantics | Keep full-res buffers | A ConstantScalar at 4K wastes 64 MB. Broadcasting eliminates this. |
| D4 | Ship two binaries from one codebase: `texturelab` (GUI) + `texturelab-cli` | GUI only; defer CLI | Studios need headless packing in build scripts. The engine already decouples from UI. |
| D5 | Hotkeys match Unreal Material Editor + user-remappable | Keep current mapping; no remap | User confirmed Unreal standard. Remap via `settings.json` covers personal preference. |
| D6 | CPU only (Rayon). GPU compute is a non-goal. | Optional wgpu; full GPU | Keeps build simple, Flash-model vibe coding reliable, and the binary portable. |
| D7 | Archive old specs, don't delete | Delete all | Preserves decision history for reference. |
| D8 | EXR import squeezes HDR to 0–1, stores original range for re-export | Clamp; full HDR pipeline | Full HDR needs float textures everywhere. Squeeze-and-tag is practical for a pipeline tool. |
| D9 | Old `.tlab` files must keep loading. Bump `format_version` to 2. | Break compat | Users have existing projects. |
| D10 | Small prompt cards for Flash agents | Medium chunks; mega-prompts | Flash drifts on long tasks. One task = one session, named files, checklist, test gate. |

---

## Feature Catalog (20 Features)

| ID | Feature | Category | Wave |
|---|---|---|---|
| F1 | Batch Processor (multi-set queue) | Pipeline | 1 |
| F2 | Headless CLI (`texturelab-cli`) | Pipeline | 1 |
| F3 | Folder Watcher (hot-reload auto-pack) | Pipeline | 2 |
| F4 | Export Preset Designer (custom channel routing) | Export | 1 |
| F5 | Texture Set Validator (completeness, resolution, naming) | QA | 1 |
| F6 | EXR + 16-bit TIFF import/export | Codecs | 1 |
| F7 | Height ↔ Normal conversion nodes | Nodes | 2 |
| F8 | Spec/Gloss → Metal/Rough converter node | Nodes | 1 |
| F9 | Seamless tile maker (edge-blend mirror) | Nodes | 2 |
| F10 | Curvature + AO bake helpers (from height/normal) | Nodes | 2 |
| F11 | DDS export + mip generation + VRAM budget display | Codecs | 2 |
| F12 | Filter pack (blur, sharpen, edge detect) | Nodes | 2 |
| F13 | UDIM tile set support | Pipeline | 2 |
| F14 | Subgraphs / macro nodes | Graph | 2 |
| F15 | Template gallery (starter graph library) | UX | 1 |
| F16 | Copy/Paste/Duplicate + Comment boxes + Reroute nodes | UX | 1 |
| F17 | Bypass / Solo mode per node | Graph | 2 |
| F18 | Histogram + channel statistics panel | QA | 2 |
| F19 | Recent files + autosave + crash recovery | UX | 2 |
| F20 | Preferences dialog + hotkey remap + settings.json | UX | 1 |

---

## Phase Map

### Phase 0 — Foundation Fixes (Pre-Wave)
Clean up code health issues found during analysis before adding features.

| Task | Files | What |
|---|---|---|
| P0-T1 | `src/app.rs` | ✅ Done — Removed `Edition` enum, all `is_node_allowed` / `is_format_allowed` / edition menu / edition tests. |
| P0-T2 | `.github/workflows/ci.yml` | ✅ Already done — rebuilt for Rust. |
| P0-T3 | `src/*.rs` | Fix all 45 clippy warnings. |
| P0-T4 | `src/app.rs` → extract `src/app/menu.rs`, `src/app/drop.rs`, `src/app/state.rs` | ✅ Done — Split 1,600-line monolith into focused sub-modules. |
| P0-T5 | `src/ui/canvas.rs` → extract `src/ui/canvas/wires.rs`, `src/ui/canvas/cards.rs`, `src/ui/canvas/search.rs` | ✅ Done — Split 1,700-line monolith into focused sub-modules. |
| P0-T6 | `docs/`, `README.md`, `ARCHITECTURE.md` | ✅ Already done — rewritten. |
| P0-T7 | `tests/integration_tests.rs` | ✅ Done — Removed edition-gated test assertions. |
| **Gate** | `cargo test` + `cargo clippy -- -D warnings` + `cargo build --release` | All green, zero warnings. |

### Phase 1 — 16-Bit Pipeline & Constant Broadcast (Engine)
| Task | Files | What |
|---|---|---|
| P1-T1 | `src/core/buffer.rs` | Add `TextureBufferUnified` enum wrapping U8/U16/F32 variants. Implement `as_u16()` / `from_u16()` / `broadcast_pixel()` on `TextureBuffer`. |
| P1-T2 | `src/graph/evaluator.rs` | Change cache type to `SharedTextureBuffer` with 16-bit storage. Nodes that produce constant outputs emit 1×1 buffers. Downstream nodes broadcast-read single-pixel inputs. |
| P1-T3 | `src/nodes/constants.rs` | `ConstantScalar` and `ConstantColor` emit 1×1 `TextureBuffer`. |
| P1-T4 | `src/nodes/mod.rs`, `src/nodes/*.rs` | Each node's execute function handles mixed-resolution inputs: if an input is 1×1, sample pixel 0,0 for every output pixel. |
| P1-T5 | `src/export/codecs.rs` | EXR read/write (add `exr` crate). 16-bit TIFF read/write (already have `image` features). |
| P1-T6 | `src/graph/evaluator.rs` | Add cache byte budget (default 2 GB). LRU eviction of oldest evaluated node outputs. |
| P1-T7 | `src/graph/model.rs` | Bump `format_version` to 2. Add migration: if loading v1, convert in place. |
| P1-T8 | `tests/` | 16-bit round-trip, broadcast semantics, EXR encode/decode, TIFF encode/decode, cache eviction tests. |
| **Gate** | `cargo test` + `cargo clippy -- -D warnings` + `cargo build --release` | |

### Phase 2 — UX Essentials (F16, F20, F15)
| Task | Files | What |
|---|---|---|
| P2-T1 | `src/graph/model.rs` | Add `Graph::clone_subgraph(node_ids)`, `Graph::paste_subgraph(nodes, edges, offset)`. |
| P2-T2 | `src/ui/canvas.rs`, `src/hotkeys/mod.rs` | Ctrl+C / Ctrl+V / Ctrl+D: copy/paste/duplicate selected nodes with offset. |
| P2-T3 | `src/graph/model.rs`, `src/nodes/mod.rs` | Add `Comment` node type (no inputs/outputs, just a text box and a rect that encloses children). |
| P2-T4 | `src/nodes/mod.rs`, `src/ui/canvas.rs` | Add `Reroute` node type (single input, single output, rendered as a small dot). |
| P2-T5 | `src/hotkeys/mod.rs`, new `src/settings.rs` | Parse `settings.json` for key remaps. Hotkey resolution checks user overrides first. |
| P2-T6 | `src/ui/`, new `src/ui/preferences.rs` | Preferences dialog: default resolution, export directory, hotkey table editor, theme accent colour. |
| P2-T7 | new `src/templates/` or embedded | Ship 5 starter `.tlab` templates: Empty, UE5 ORM Pack, Unity MaskMap, Blender Principled, Normal Convert. File → New from Template. |
| P2-T8 | `tests/` | Copy/paste round-trip, reroute evaluation, settings load/save, template load tests. |
| **Gate** | `cargo test` + `cargo clippy -- -D warnings` + `cargo build --release` | |

### Phase 3 — Pipeline Features (F1, F2, F4, F5, F8)
| Task | Files | What |
|---|---|---|
| P3-T1 | `src/nodes/mod.rs`, new `src/nodes/convert.rs` | `SpecGlossToMetalRough` node: converts Specular+Glossiness textures to Metallic+Roughness using energy-conservation approximation. Uses existing glossiness alias dictionary. |
| P3-T2 | new `src/export/preset_designer.rs` | User-definable export presets: name, per-channel source routing (node output + channel selector), output format, bit depth, token pattern. Serialised to `presets.json`. |
| P3-T3 | `src/ui/inspector.rs` or new `src/ui/validator.rs` | Texture Set Validator panel: checks completeness (missing maps), resolution consistency, POT compliance, naming convention adherence. Displays pass/warn/fail badges. |
| P3-T4 | new `src/batch/mod.rs`, `src/batch/processor.rs` | Batch Processor: queue multiple texture sets (folders), apply a graph template + export preset to each, run sequentially with progress reporting. |
| P3-T5 | new `src/bin/cli.rs`, `Cargo.toml` `[[bin]]` | `texturelab-cli`: `--graph path.tlab --input dir/ --output dir/ --preset UE5_ORM`. Reuses engine crate. |
| P3-T6 | `tests/` | Spec/Gloss conversion accuracy, preset serialisation, validator edge cases, batch queue, CLI smoke test. |
| **Gate** | `cargo test` + `cargo clippy -- -D warnings` + `cargo build --release` | Both binaries. |

### Phase 4 — Wave 2 Features (picked by priority)
Ordered sub-phases, each one prompt card:

| Sub | Feature | Key Files |
|---|---|---|
| P4-A | F19 Recent files + autosave | `src/settings.rs`, `src/app.rs` |
| P4-B | F17 Bypass / Solo | `src/graph/evaluator.rs`, `src/ui/canvas.rs` |
| P4-C | F18 Histogram + stats | new `src/ui/histogram.rs` |
| P4-D | F7 Height → Normal | new `src/nodes/height_to_normal.rs` |
| P4-E | F12 Filter pack (blur, sharpen, edge detect) | new `src/nodes/filters.rs` |
| P4-F | F9 Seamless tile maker | new `src/nodes/seamless.rs` |
| P4-G | F10 Curvature + AO from height | new `src/nodes/curvature.rs` |
| P4-H | F3 Folder Watcher | new `src/batch/watcher.rs` |
| P4-I | F11 DDS + mips + VRAM | `src/export/codecs.rs`, new `src/export/dds.rs` |
| P4-J | F13 UDIM | `src/export/tokens.rs`, `src/normalizer/rules.rs` |
| P4-K | F14 Subgraphs | `src/graph/model.rs`, `src/graph/evaluator.rs` |
| **Gate** | `cargo test` + `cargo clippy -- -D warnings` + `cargo build --release` after each sub-phase. | |

---

## Progress Checklist

Copy this into each prompt so the agent can tick items:

```
## Progress
- [ ] Task complete
- [ ] `cargo test` — all pass
- [ ] `cargo clippy -- -D warnings` — zero warnings
- [ ] Git commit with descriptive message
- [ ] (Phase gate only) `cargo build --release` — exit code 0
```

---

## Agent Prompt Templates

> **Instructions for use**: Copy the prompt for the task you want to execute. Paste it into a new Gemini 3.8 Flash (High) chat with this repository open. The agent will read the referenced files, make the changes, and verify.

---

### PROMPT: P0-T1 — Remove Edition System

```
## Task: Remove the Lite/Pro Edition System

**Context**: ARKH TextureLab has a `Edition` enum (Pro/Lite) in `src/app.rs` that gates
nodes and formats behind a "Pro" label. However, users can freely toggle it from the menu,
so it provides no real protection. It adds ~200 lines of dead code and test weight.

**What to do**:
1. Open `src/app.rs`.
2. Delete the `Edition` enum, its `impl` block, and all methods (`is_node_allowed`,
   `is_format_allowed`, `allows_ab_split`, `allows_histogram`, `name`, `is_pro`).
3. Remove the `edition` field from `TextureLabApp` and `AppTabViewer`.
4. Remove all `edition` references: the `with_edition()` builder, `set_edition()`,
   the edition menu in the menu bar, the `[Pro]` header label, and all
   `if !self.edition.is_node_allowed(...)` / `if !self.edition.is_format_allowed(...)`
   guards — make those paths unconditionally allowed.
5. Open `tests/integration_tests.rs` — delete any `test_edition_*` tests.
6. In `src/app.rs` tests section, delete `test_edition_capability_matrix_rules`.
7. Update the About dialog to say just `TextureLab v1.0.0`.

**Verification**:
- `cargo test` — all pass
- `cargo clippy -- -D warnings` — check for new warnings
- `git add -A && git commit -m "refactor: remove Edition system (Lite/Pro dead code)"`

## Progress
- [x] Task complete
- [x] `cargo test` — all pass
- [x] `cargo clippy` — checked
- [x] Git commit
```

---

### PROMPT: P0-T3 — Fix All Clippy Warnings

```
## Task: Fix All Clippy Warnings

**Context**: `cargo clippy` currently reports ~45 warnings across the codebase. Categories:
- `chunks_exact_mut` with constant chunk size → use `array_chunks_mut` or silence
- `impl` can be derived (Default, Display, etc.)
- `map_or` can be simplified
- Redundant closures
- Immediately-dereferenced references
- Collapsible `if` statements
- Loop variable only used to index
- Functions with too many arguments (8/7 and 12/7)
- Missing `Default` impl for `ColorSpaceLut`

**What to do**:
1. Run `cargo clippy --all-targets 2>&1` and collect all warnings.
2. Fix each one. For "too many arguments" warnings, group related params into a struct.
   For "can be derived", add `#[derive(Default)]`. For `chunks_exact_mut`, evaluate
   whether `array_chunks_mut` is available on stable Rust or add `#[allow]` with comment.
3. Run `cargo clippy -- -D warnings` to verify zero warnings remain.

**Verification**:
- `cargo test` — all pass
- `cargo clippy -- -D warnings` — ZERO warnings
- `git add -A && git commit -m "fix: resolve all clippy warnings"`

## Progress
- [ ] Task complete
- [ ] `cargo test` — all pass
- [ ] `cargo clippy -- -D warnings` — zero warnings
- [ ] Git commit
```

---

### PROMPT: P0-T4 — Split app.rs Into Sub-Modules

```
## Task: Split app.rs Into Sub-Modules

**Context**: `src/app.rs` is ~1,600 lines handling application state, menu bar, file
drop handling, evaluator polling, and starter graph construction. It should be split
into focused modules.

**What to do**:
1. Create `src/app/` directory with `mod.rs`, `menu.rs`, `drop.rs`, `state.rs`.
2. Move `TextureLabApp` struct definition + `new()` + `with_edition()` (now removed)
   + field declarations into `state.rs`.
3. Move the menu bar rendering (the large `ui.menu_bar` block inside `update()`)
   into `menu.rs` as a method `render_menu_bar(&mut self, ui, ctx)`.
4. Move the `dropped_files` handling block into `drop.rs` as
   `handle_dropped_files(&mut self, ctx)`.
5. Move `build_starter_graph()` into `state.rs`.
6. Keep `impl eframe::App for TextureLabApp` in `mod.rs`, calling the extracted methods.
7. Re-export everything needed from `mod.rs`.

**Verification**:
- `cargo test` — all pass
- `cargo clippy -- -D warnings` — zero warnings
- `git add -A && git commit -m "refactor: split app.rs into app/ sub-modules"`

## Progress
- [x] Task complete
- [x] `cargo test` — all pass
- [x] `cargo clippy` — checked
- [x] Git commit
```

---

### PROMPT: P0-T5 — Split canvas.rs Into Sub-Modules

```
## Task: Split canvas.rs Into Sub-Modules

**Context**: `src/ui/canvas.rs` is ~1,700 lines handling wire rendering, node card
painting, search palette, and input event processing. Split it for maintainability.

**What to do**:
1. Create `src/ui/canvas/` directory with `mod.rs`, `wires.rs`, `cards.rs`, `search.rs`.
2. Move Bezier wire drawing functions into `wires.rs`.
3. Move node card rendering (header, body, sockets, LOD) into `cards.rs`.
4. Move the quick-search spawn palette UI into `search.rs`.
5. Keep `CanvasState` struct, event handling, and the main `show()` method in `mod.rs`,
   calling into the extracted modules.

**Verification**:
- `cargo test` — all pass
- `cargo clippy -- -D warnings` — zero warnings
- `git add -A && git commit -m "refactor: split canvas.rs into canvas/ sub-modules"`

## Progress
- [x] Task complete
- [x] `cargo test` — all pass
- [x] `cargo clippy` — checked
- [x] Git commit
```

---

### PROMPT: P1-T1 + P1-T2 + P1-T3 — 16-Bit Pipeline Core

```
## Task: Upgrade Evaluator to 16-Bit Pipeline with Constant Broadcast

**Context**: The graph evaluator processes everything at 8-bit (`TextureBuffer` backed by
`RgbaImage` which is `Vec<u8>`). Height maps and normals band visibly. Constants generate
full-resolution buffers wasting memory.

**What to do**:

### Part A: Buffer Upgrade (`src/core/buffer.rs`)
1. Add method `TextureBuffer::to_u16() -> TextureBuffer16` that upscales 0–255 to 0–65535.
2. Add method `TextureBuffer16::to_u8() -> TextureBuffer` that downscales.
3. Add method `TextureBuffer::is_broadcast() -> bool` returning `self.width == 1 && self.height == 1`.
4. Add method `TextureBuffer::broadcast_pixel() -> [u8; 4]` returning pixel (0,0).

### Part B: Constant Nodes (`src/nodes/constants.rs`)
1. `execute_constant_scalar` emits a 1×1 `TextureBuffer` with the scalar value replicated
   across R,G,B,A. Ignore the `resolution` parameter.
2. `execute_constant_color` emits a 1×1 `TextureBuffer`. Ignore resolution.

### Part C: Evaluator Broadcast (`src/graph/evaluator.rs`)
1. When gathering inputs for a node, if an input buffer is 1×1 (`is_broadcast()`), do NOT
   resize it. Pass it as-is. Each node's execute function must handle broadcast inputs.
2. In `resolve_node_dimensions()`, skip 1×1 broadcast buffers when inheriting resolution
   from upstream.

### Part D: Node Execute Functions (`src/nodes/*.rs`)
1. In each node's pixel loop, when reading from an input buffer: if `input.is_broadcast()`,
   use `input.broadcast_pixel()` for every output pixel instead of indexing by (x, y).
2. Add a helper function `fn sample_pixel(buf: &TextureBuffer, x: u32, y: u32) -> [u8; 4]`
   that returns `broadcast_pixel()` if 1×1, else `get_pixel(x, y)`.

### Part E: Cache Budget (`src/graph/evaluator.rs`)
1. Add `max_cache_bytes: usize` field (default 2 GB = 2_147_483_648).
2. Track `current_cache_bytes`. After inserting a new cache entry, if over budget, evict
   the oldest entries (by insertion order) until under budget.

**Verification**:
- `cargo test` — all pass (existing tests must not break)
- Add tests: constant_scalar outputs 1x1, broadcast sampling works at 4K,
  cache eviction triggers at low budget.
- `cargo clippy -- -D warnings`
- `git commit -m "feat(engine): 16-bit pipeline, constant broadcast, cache budget"`

## Progress
- [ ] Task complete
- [ ] `cargo test` — all pass
- [ ] `cargo clippy` — checked
- [ ] Git commit
```

---

### PROMPT: P1-T5 — EXR and 16-Bit TIFF Codecs

```
## Task: Add EXR and 16-Bit TIFF Import/Export

**Context**: TextureLab currently supports PNG (8/16-bit), TGA, WebP, JPEG, BMP. Game and
archviz pipelines commonly use EXR (for height, displacement, HDR lighting) and 16-bit TIFF.

**What to do**:

### Part A: Dependencies (`Cargo.toml`)
1. Add `exr = "1.7"` to `[dependencies]`.
2. Add `"tiff"` to the `image` crate's feature list.

### Part B: EXR Codec (`src/export/codecs.rs`)
1. `pub fn load_exr<P: AsRef<Path>>(path: P) -> Result<TextureBuffer, CodecError>`:
   - Read with `exr` crate. Convert f32 RGBA to u8 (clamp 0–1, multiply by 255).
   - Store original min/max range in a companion struct or return metadata.
2. `pub fn save_exr<P: AsRef<Path>>(buffer: &TextureBuffer, path: P) -> Result<(), CodecError>`:
   - Convert u8 RGBA to f32 (divide by 255). Write with `exr` crate.
3. Register `.exr` in the file filter lists in `src/app.rs` (Open Project, dropped files).

### Part C: TIFF Codec (`src/export/codecs.rs`)
1. `pub fn load_tiff<P: AsRef<Path>>(path: P) -> Result<TextureBuffer, CodecError>`:
   - Use `image::ImageReader` with guessed format. Convert to RGBA8.
2. `pub fn save_tiff_16<P: AsRef<Path>>(buffer: &TextureBuffer16, path: P) -> Result<(), CodecError>`:
   - Use `image::codecs::tiff::TiffEncoder` with 16-bit samples.

### Part D: Export Writer
1. In `src/export/writer.rs`, add EXR and TIFF to the format dispatch.

**Verification**:
- Add round-trip tests: create buffer → save EXR → load EXR → compare pixels (within ±1).
- Same for TIFF 16-bit.
- `cargo test` + `cargo clippy -- -D warnings`
- `git commit -m "feat(codecs): add EXR and 16-bit TIFF import/export"`

## Progress
- [ ] Task complete
- [ ] `cargo test` — all pass
- [ ] `cargo clippy` — checked
- [ ] Git commit
```

---

### PROMPT: P2-T1 + P2-T2 — Copy/Paste/Duplicate

```
## Task: Implement Node Copy, Paste, and Duplicate

**Context**: TextureLab has no clipboard. Users cannot copy, paste, or duplicate nodes.
This is basic graph editor functionality.

**What to do**:

### Part A: Graph Model (`src/graph/model.rs`)
1. Add `Graph::clone_subgraph(node_ids: &[NodeId]) -> (Vec<Node>, Vec<Edge>)`:
   - Deep-clone the selected nodes. Collect all edges where both endpoints are in the set.
2. Add `Graph::paste_subgraph(nodes: Vec<Node>, edges: Vec<Edge>, offset: [f32; 2]) -> Vec<NodeId>`:
   - Assign fresh `NodeId`s (incrementing from `self.next_node_id`).
   - Remap all `PinId.node_id` references in nodes and edges.
   - Offset all positions by `offset`.
   - Insert into graph. Return the new node IDs.

### Part B: Canvas & Hotkeys
1. In `src/hotkeys/mod.rs`, add `HotkeyAction::Copy`, `HotkeyAction::Paste`,
   `HotkeyAction::Duplicate` bound to `Ctrl+C`, `Ctrl+V`, `Ctrl+D`.
2. In `src/ui/canvas/` (or `canvas.rs`), store a clipboard: `Option<(Vec<Node>, Vec<Edge>)>`.
3. Copy: clone selected nodes into clipboard.
4. Paste: paste clipboard at mouse position with [50, 50] offset. Record undo.
5. Duplicate: copy + immediate paste at [30, 30] offset. Record undo.

**Verification**:
- Test: create 3 connected nodes, copy, paste, verify new IDs, verify edges remap,
  verify positions offset.
- `cargo test` + `cargo clippy -- -D warnings`
- `git commit -m "feat(graph): copy/paste/duplicate nodes (Ctrl+C/V/D)"`

## Progress
- [ ] Task complete
- [ ] `cargo test` — all pass
- [ ] `cargo clippy` — checked
- [ ] Git commit
```

---

### PROMPT: P2-T3 + P2-T4 — Comment Boxes and Reroute Nodes

```
## Task: Add Comment Boxes and Reroute Nodes

**Context**: Comment boxes let users annotate sections of the graph. Reroute nodes are
tiny passthrough dots that clean up wire routing.

**What to do**:

### Part A: Comment Node
1. In `src/nodes/mod.rs`, add `NodeCategory::Utility` and `NodeDescriptor` for `Comment`:
   - `type_name: "Comment"`, no inputs, no outputs.
   - `params`: `text` (String), `width` (Float), `height` (Float), `color` (Color).
2. In the node executor (`PbrNodeExecutor::execute`), `Comment` returns empty outputs.
3. In `src/ui/canvas/` (cards rendering): if `node_type == "Comment"`, render as a
   semi-transparent rounded rectangle with the text label. It should sit behind other nodes
   (draw first in the paint order).
4. Comments should be resizable via drag handles on corners/edges.

### Part B: Reroute Node
1. Add `NodeDescriptor` for `Reroute`: one input `"input"`, one output `"output"`,
   category `Utility`.
2. Executor: passthrough — output = input (or blank if no input).
3. Canvas rendering: render as a small 12px circle (dot) with the wire colour.
   No header, no body, no label — just the dot and its connection points.

### Part C: Hotkeys
1. Bind `Key::Slash` or double-click on empty canvas → spawn Comment at cursor.

**Verification**:
- Test: Comment node exists in catalog, creates with correct params.
- Test: Reroute passthrough evaluation (connect TextureInput → Reroute → SaveImage,
  verify output equals input).
- `cargo test` + `cargo clippy -- -D warnings`
- `git commit -m "feat(nodes): add Comment boxes and Reroute passthrough nodes"`

## Progress
- [ ] Task complete
- [ ] `cargo test` — all pass
- [ ] `cargo clippy` — checked
- [ ] Git commit
```

---

### PROMPT: P2-T5 + P2-T6 — Preferences and Hotkey Remap

```
## Task: Implement Preferences Dialog and Hotkey Remap

**Context**: All settings are currently hardcoded. Users need to customise default
resolution, export directory, hotkey bindings, and theme accent colour.

**What to do**:

### Part A: Settings File (`src/settings.rs`)
1. Create `AppSettings` struct with fields:
   - `default_resolution: (u32, u32)` (default 2048×2048)
   - `export_directory: Option<String>`
   - `accent_color: [f32; 3]` (default amber)
   - `hotkey_overrides: HashMap<String, String>` (action name → key string)
   - `recent_files: Vec<String>` (max 10)
   - `autosave_interval_secs: u64` (default 300)
2. Load from `settings.json` next to the executable on startup. Save on change.
3. If file missing or corrupt, use defaults silently.

### Part B: Hotkey Remap (`src/hotkeys/mod.rs`)
1. `resolve_hotkey()` checks `settings.hotkey_overrides` first. If the action has an
   override, use that key. Otherwise fall through to the default table.
2. Expose `fn default_hotkey_table() -> Vec<(HotkeyAction, &'static str)>` for the
   preferences UI to display.

### Part C: Preferences UI (`src/ui/preferences.rs`)
1. Modal dialog opened from Edit → Preferences.
2. Sections: General (resolution, export dir), Hotkeys (two-column table with
   "Reset to Default" per row), Appearance (accent colour picker).
3. "Save" writes `settings.json`. "Cancel" discards.

**Verification**:
- Test: settings round-trip (save → load → compare).
- Test: hotkey override resolution.
- `cargo test` + `cargo clippy -- -D warnings`
- `git commit -m "feat(settings): preferences dialog and hotkey remap via settings.json"`

## Progress
- [ ] Task complete
- [ ] `cargo test` — all pass
- [ ] `cargo clippy` — checked
- [ ] Git commit
```

---

### PROMPT: P2-T7 — Template Gallery

```
## Task: Add Starter Template Gallery

**Context**: New users see an empty canvas. A template gallery gives them pre-built
graphs to start from.

**What to do**:
1. Create `src/templates.rs` with `pub fn builtin_templates() -> Vec<TemplateEntry>`.
2. Each `TemplateEntry` has `name: &str`, `description: &str`, `graph_json: &str`
   (embedded via `include_str!`).
3. Create 5 template `.tlab` JSON files in `assets/templates/`:
   - `empty.tlab` — blank graph.
   - `ue5_orm_pack.tlab` — TextureInputs (AO, Roughness, Metallic) → ChannelCombine → SaveImage.
   - `unity_maskmap.tlab` — TextureInputs → ChannelCombine with Unity MaskMap routing.
   - `blender_principled.tlab` — TextureInputs → separate SaveImage per map.
   - `normal_convert.tlab` — TextureInput → NormalFlipGreen → SaveImage.
4. In `src/app/menu.rs` (or `app.rs`): File → New from Template → submenu listing templates.
   Selecting one replaces the current graph (with undo snapshot).
5. Also show a "Start" splash when the graph is empty: a centered card with template buttons.

**Verification**:
- Each template loads without error.
- `cargo test` + `cargo clippy -- -D warnings`
- `git commit -m "feat(templates): add 5 built-in starter graph templates"`

## Progress
- [ ] Task complete
- [ ] `cargo test` — all pass
- [ ] `cargo clippy` — checked
- [ ] Git commit
```

---

### PROMPT: P3-T1 — Spec/Gloss to Metal/Rough Converter

```
## Task: Add Spec/Gloss → Metal/Rough Converter Node

**Context**: Many legacy assets use Specular/Glossiness workflow. TextureLab needs to
convert them to Metallic/Roughness for modern PBR pipelines.

**What to do**:
1. Create `src/nodes/convert.rs`.
2. Add `SpecGlossToMetalRough` node:
   - Inputs: `diffuse`, `specular`, `glossiness`.
   - Outputs: `base_color`, `metallic`, `roughness`.
3. Conversion algorithm (standard approximation):
   - `metallic` = max(specular.r, specular.g, specular.b) > 0.5 threshold ? 1.0 : 0.0
     (or use the continuous approximation from Substance).
   - `roughness` = 1.0 - glossiness (per-pixel).
   - `base_color` = lerp(diffuse, specular, metallic).
4. Register in `NODE_CATALOG` under category `ChannelOps` (or new `Convert` category).
5. Register in `PbrNodeExecutor::execute` match arm.
6. Add to the node library and search palette.

**Verification**:
- Test: solid white specular + 0 glossiness → roughness = 1.0, metallic = 1.0.
- Test: black specular → metallic = 0.0.
- `cargo test` + `cargo clippy -- -D warnings`
- `git commit -m "feat(nodes): add Spec/Gloss to Metal/Rough converter"`

## Progress
- [ ] Task complete
- [ ] `cargo test` — all pass
- [ ] `cargo clippy` — checked
- [ ] Git commit
```

---

### PROMPT: P3-T2 — Export Preset Designer

```
## Task: Implement User-Definable Export Preset Designer

**Context**: TextureLab ships with fixed presets (UE5 ORM, Unity MaskMap, Blender).
Users need to create custom presets with arbitrary channel routing.

**What to do**:
1. Create `src/export/preset_designer.rs`.
2. `UserPreset` struct: `name`, `description`, `channels: [ChannelSource; 4]` (R, G, B, A),
   `output_format` (PNG/TGA/EXR/TIFF), `bit_depth` (8/16), `token_pattern` (String).
3. `ChannelSource` struct: `node_output: String` (e.g. "Roughness"), `channel: char` (R/G/B/A).
4. `pub fn load_presets() -> Vec<UserPreset>` reads `presets.json` next to exe.
5. `pub fn save_presets(presets: &[UserPreset])` writes `presets.json`.
6. UI: accessible from Export panel as "Edit Presets..." button. Opens a modal with:
   - Preset list (add/remove/rename).
   - Per-channel dropdown: pick source map + channel.
   - Output format + bit depth selectors.
   - Token pattern editor with preview.

**Verification**:
- Test: create preset, save, reload, verify channel routing intact.
- `cargo test` + `cargo clippy -- -D warnings`
- `git commit -m "feat(export): user-definable export preset designer"`

## Progress
- [ ] Task complete
- [ ] `cargo test` — all pass
- [ ] `cargo clippy` — checked
- [ ] Git commit
```

---

### PROMPT: P3-T3 — Texture Set Validator

```
## Task: Implement Texture Set Validator Panel

**Context**: Before export, artists need to verify their texture set is complete and
consistent. Missing maps, mismatched resolutions, and non-POT sizes cause downstream issues.

**What to do**:
1. Create `src/ui/validator.rs` (or add to inspector).
2. `TextureSetReport` struct with:
   - `missing_maps: Vec<String>` — expected but not connected (e.g. "Normal" missing).
   - `resolution_mismatches: Vec<(String, (u32,u32))>` — maps at different resolutions.
   - `non_pot_maps: Vec<(String, (u32,u32))>` — non-power-of-two dimensions.
   - `naming_warnings: Vec<String>` — files not matching any known PBR convention.
3. `fn validate_texture_set(graph: &Graph, evaluator: &GraphEvaluator) -> TextureSetReport`.
4. UI: panel accessible from View menu or a toolbar button. Displays a checklist with
   green check / yellow warning / red error icons per item.
5. "Fix" suggestions: e.g. "Add Resize node to enforce 2048×2048" (button auto-inserts).

**Verification**:
- Test: graph with mismatched resolutions → report detects it.
- Test: complete UE5 ORM set → all green.
- `cargo test` + `cargo clippy -- -D warnings`
- `git commit -m "feat(validator): texture set completeness and consistency checker"`

## Progress
- [ ] Task complete
- [ ] `cargo test` — all pass
- [ ] `cargo clippy` — checked
- [ ] Git commit
```

---

### PROMPT: P3-T4 — Batch Processor

```
## Task: Implement Batch Texture Set Processor

**Context**: Studios process hundreds of texture sets. Users need to queue multiple
folders, apply a graph template + export preset, and batch-export.

**What to do**:
1. Create `src/batch/mod.rs` and `src/batch/processor.rs`.
2. `BatchJob` struct: `input_dir: PathBuf`, `output_dir: PathBuf`,
   `template: ProjectFile`, `preset_name: String`, `status: BatchStatus`.
3. `BatchProcessor`:
   - Queue of `BatchJob`s.
   - `fn process_next(&mut self) -> Result<BatchReport>`: loads template graph, scans
     input_dir for texture files, runs lexical normaliser to assign roles, binds
     TextureInput nodes, evaluates graph, exports using preset.
   - Reports progress (current/total, current set name).
4. UI: "Batch" tab in the dock. Drag folders or use "Add Folder" button. Select template
   and preset. "Run All" button. Progress bar + log.
5. Use `rayon` thread pool — but process sets sequentially (one at a time) to avoid
   memory explosion.

**Verification**:
- Test: batch process 2 sets from `samples/1k/`, verify output files created.
- `cargo test` + `cargo clippy -- -D warnings`
- `git commit -m "feat(batch): batch texture set processor with queue UI"`

## Progress
- [ ] Task complete
- [ ] `cargo test` — all pass
- [ ] `cargo clippy` — checked
- [ ] Git commit
```

---

### PROMPT: P3-T5 — Headless CLI

```
## Task: Build texturelab-cli Binary

**Context**: The engine is decoupled from the UI. A CLI tool lets studios integrate
TextureLab into build scripts and CI/CD pipelines.

**What to do**:

### Part A: Cargo Configuration (`Cargo.toml`)
1. Add a `[[bin]]` section:
   ```toml
   [[bin]]
   name = "texturelab-cli"
   path = "src/bin/cli.rs"
   ```
2. The default `[[bin]]` for the GUI remains `src/main.rs`.

### Part B: CLI Entry Point (`src/bin/cli.rs`)
1. Parse args (use `std::env::args` or add `clap` as optional dependency):
   - `--graph path.tlab` — graph file to execute.
   - `--input dir/` — directory of input textures.
   - `--output dir/` — export directory.
   - `--preset UE5_ORM` — preset name (built-in or from presets.json).
   - `--resolution WxH` — override default resolution (e.g. `2048x2048`).
   - `--format PNG|TGA|EXR` — override output format.
2. Load graph, scan input dir with normaliser, bind textures, evaluate, export.
3. Print progress to stdout. Exit code 0 on success, 1 on error.

### Part C: Shared Engine
1. The CLI imports `texturelab` as a library crate (already set up via `src/lib.rs`).
   No UI code is pulled in.

**Verification**:
- `cargo build --release` produces both `texturelab.exe` and `texturelab-cli.exe`.
- Smoke test: `texturelab-cli --graph assets/templates/ue5_orm_pack.tlab --input samples/1k/ --output target/cli-test/`
- `cargo test` + `cargo clippy -- -D warnings`
- `git commit -m "feat(cli): add texturelab-cli headless binary"`

## Progress
- [ ] Task complete
- [ ] `cargo test` — all pass
- [ ] `cargo clippy` — checked
- [ ] Git commit
- [ ] `cargo build --release` — two binaries
```

---

### PROMPT: Phase Gate — Release Build

Use this after completing all tasks in a phase:

```
## Task: Phase Gate — Verify and Build Release

**What to do**:
1. Run `cargo test` — all must pass.
2. Run `cargo clippy -- -D warnings` — zero warnings.
3. Run `cargo build --release` — exit code 0.
4. Verify binary sizes: `ls -la target/release/texturelab.exe target/release/texturelab-cli.exe`
   (cli only if Phase 3+).
5. Copy to release: `Copy-Item target\release\texturelab.exe release\TextureLab.exe -Force`
6. `git add -A && git commit -m "release: Phase N complete — <summary>"`

## Progress
- [ ] `cargo test` — all pass
- [ ] `cargo clippy -- -D warnings` — zero warnings
- [ ] `cargo build --release` — exit code 0
- [ ] Binary copied to release/
- [ ] Git commit
```

---

## Execution Order Summary

```
P0-T1  Remove Edition          ─┐
P0-T3  Fix Clippy               │  Phase 0: Foundation
P0-T4  Split app.rs             │  (no features, just cleanup)
P0-T5  Split canvas.rs          │
P0-T7  Fix edition tests       ─┘
       ── Phase Gate ──

P1-T1  Buffer upgrade          ─┐
P1-T2  Evaluator broadcast      │
P1-T3  Constant 1×1             │  Phase 1: 16-Bit Engine
P1-T4  Node broadcast reads     │
P1-T5  EXR + TIFF codecs        │
P1-T6  Cache budget             │
P1-T7  Format version bump      │
P1-T8  Tests                   ─┘
       ── Phase Gate ──

P2-T1  Copy/Paste model        ─┐
P2-T2  Copy/Paste UI            │
P2-T3  Comment boxes            │  Phase 2: UX Essentials
P2-T4  Reroute nodes            │
P2-T5  Settings + remap         │
P2-T6  Preferences dialog       │
P2-T7  Template gallery         │
P2-T8  Tests                   ─┘
       ── Phase Gate ──

P3-T1  Spec/Gloss converter   ─┐
P3-T2  Preset designer          │  Phase 3: Pipeline
P3-T3  Validator                 │
P3-T4  Batch processor          │
P3-T5  Headless CLI              │
P3-T6  Tests                   ─┘
       ── Phase Gate ──

P4-A..K  Wave 2 features        Phase 4: (one prompt per sub-phase)
       ── Phase Gate after each ──
```
