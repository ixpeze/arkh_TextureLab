# OWNER PLAYBOOK — Driving Pure Rust Refactoring (for the Product Owner)

> **Pure Rust Desktop Refactoring Guide**  
> *Target: 100% Native Windows Desktop Application • Zero Electron • Zero WebViews • Zero Node.js*  
> *Stack: Rust 2021 • eframe / egui 0.31 • egui_dock 0.16 • Rayon 1.10 • image 0.25 • Standalone 5.4 MB Windows `.exe`*

You do not need to write Rust code yourself. Your role as Product Owner is to:
**Start one agent per phase, give it the phase prompt, run the 1-minute Owner Check, and verify empirical evidence before approving the next phase.**

---

## 0. Ground Rules for Pure Rust Agent Execution

1. **One Phase = One New Chat/Session:** Never mix phases in a single chat. Context decay causes agents to lose compiler discipline.
2. **Always Use the Master Prompt:** It forces agents to read the phase specification, adhere to Rust idioms, and run verification tests first.
3. **No Unchecked Claims (YES.md Standard):** Never accept an agent saying *"it works"* or *"it should build"*. Require compiler output: `cargo check`, `cargo test`, or `cargo build --release` with exit code `0`.
4. **Use `/goal` for Big Phases (Phases 1, 2, 5):** This instructs the agent to persist until all exit criteria and tests are demonstrably passing.
5. **Pure Rust Discipline:** Strict zero-web policy. No Chromium, no Electron, no HTML/CSS, no npm scripts, no Node.js runtime. Everything compiles to native machine code.
6. **Professional DCC Standards:** Workstation layout, dark obsidian aesthetics, high-throughput keyboard shortcuts (`Tab`, `F`, `1`, `3`, `M`, `B`, `S`, `N`, `L`, `I`), and immediate-mode UI responsiveness.
7. **Commit Safety:** Every phase ends with clean, conventional git commits (`feat(...)`, `test(...)`, `perf(...)`).

---

## 1. Master Prompt Template (Copy & Paste to Agent)

When starting Phase `N`, copy this prompt into a fresh agent session (replace `N` with the phase number, e.g. `0`, `1`, `2`...):

```markdown
/goal
Read docs/roadmap/OWNER_PLAYBOOK.md and docs/roadmap/PHASE_N_*.md (the specification for Phase N).
Execute ONLY Phase N for the 100% Pure Rust desktop refactoring of ARKH TextureLab.
Follow all Rust idioms: strict memory safety, zero Electron/Node dependencies, Rayon parallelization, and Kahn DAG compilation.
Prove each task by executing the exact terminal commands listed in its Acceptance column (cargo check, cargo test, cargo build --release).
Paste the concrete compiler outputs and test logs into the phase file's "Evidence Log".
Do not start the next phase. At the conclusion:
1. Verify all Exit Criteria checkboxes are ticked with empirical test proof.
2. Ensure `cargo test` passes with zero warnings or errors.
3. Commit with Conventional Commits (e.g. `feat(phase-N): ...`).
4. Provide a 5-line plain-language summary plus any UX decisions for me to review.
Environment: Windows 11 / 10 x64, PowerShell, Rust 2021 toolchain (rustc, cargo).
```

---

## 2. One-Time System Preparation (Before Phase 0) — 5 Minutes

| Requirement | Purpose | Verification Command (PowerShell) |
|---|---|---|
| **Rust Toolchain (1.80+ x64)** | Compiler, package manager & standard library | `cargo --version; rustc --version` |
| **MSVC C++ Build Tools** | Windows native linking (`x86_64-pc-windows-msvc`) | `link.exe /?` or Visual Studio Build Tools |
| **Git for Windows** | Version control & atomic commits | `git --version` |
| **Hardware GPU** | OpenGL / DirectX hardware acceleration | DirectX 11/12 or OpenGL 4.3+ compatible GPU |

---

## 3. Phase-by-Phase Roadmap & Owner Checks

### Phase 0 — Workspace, Cargo Architecture & Toolchain Baseline
- **Goal:** Set up the Rust 2021 crate, configure production dependencies (`eframe`, `egui`, `egui_dock`, `image`, `rayon`, `serde`, `rfd`), configure release profile (`opt-level = 3`, `lto = "thin"`, `panic = "abort"`, `strip = true`), and author root launchers.
- **You Say:** Master prompt with `N=0`.
- **Expected Deliverables:** `Cargo.toml`, `Cargo.lock`, `src/main.rs`, `src/lib.rs`, `setup.bat`, `run_desktop_dev.bat`, `run_desktop.bat`, baseline compilation tests.
- **Owner Check (30 seconds):**
  1. Run in terminal: `cargo check` (must exit 0 with clean dependency tree).
  2. Run `cargo test` (must compile and pass baseline harness).

### Phase 1 — Multi-Precision Core Buffer Pipeline & Image Codecs
- **Goal:** Implement the multi-precision `TextureBuffer` (R8, RGBA8, R16, RGBA16, F32 HDR), Rayon SIMD-friendly parallel image manipulation, byte-exact PNG codec, Truevision TGA 2.0 encoder (with valid 26-byte `TRUEVISION-XFILE.\0` footer), and sRGB $\leftrightarrow$ Linear color conversions.
- **You Say:** Master prompt with `N=1` (use `/goal`).
- **Expected Deliverables:** `src/core/buffer.rs`, `src/export/tga.rs`, `src/export/codecs.rs`, zero alpha data corruption (F-01 solved permanently), sub-50ms 4K channel swizzling.
- **Owner Check (1 minute):**
  1. Run: `cargo test --test integration_tests test_direct_disk_exporter_preflight_and_write`
  2. Verify that TGA files written have exact byte sizes (18-byte header + pixels + 26-byte footer).

### Phase 2 — Topological DAG Engine & Reactive Compiler
- **Goal:** Build the reactive directed acyclic graph engine (`Graph`, `Node`, `Pin`, `Edge`), cycle detection, Kahn's topological sort, dirty-node dependency graph tracking, memoized cache evaluation (`GraphEvaluator`), Serde JSON `.tlab` project serialization, and a 100-step transactional undo/redo stack.
- **You Say:** Master prompt with `N=2` (use `/goal`).
- **Expected Deliverables:** `src/graph/compiler.rs`, `src/graph/evaluator.rs`, `src/graph/model.rs`, `src/graph/history.rs`.
- **Owner Check (1 minute):**
  1. Run: `cargo test graph::compiler::tests`
  2. Run: `cargo test test_graph_serialization_roundtrip`
  3. Verify topological sorting resolves valid node orders and instantly detects circular dependency loops.

### Phase 3 — PBR Node Catalog & Processing Math
- **Goal:** Port and implement all 12 canonical PBR node families in pure Rust with CPU/Rayon parallel execution:
  - **I/O:** `TextureInput`, `TextureOutput`
  - **Constants:** `ConstantScalar` (0.0..1.0), `ConstantColor` (RGBA)
  - **Channel Ops:** `ChannelCombine` (Pack R,G,B,A), `ChannelSplit` (Unpack RGBA), `ChannelMixer` (4-row swizzle + constants)
  - **Color & Adjust:** `Invert`, `Levels` (min/max/gamma/contrast), `Brightness/Contrast`
  - **Normal Ops:** `NormalFlipGreen` (DirectX $\leftrightarrow$ OpenGL), `NormalNormalize`, `NormalStrength`
  - **Blend Ops:** `LayerBlend` (Lerp with mask & opacity), `NormalBlendRNM` (Reoriented Normal Mapping)
  - **Math:** Add, Subtract, Multiply, Divide, Power, Min, Max, Clamp, Abs, Step, Smoothstep (13 operations)
  - **Transform:** `Resize` (Power-of-Two / POT enforcement, Lanczos3 & Bilinear resampling)
- **You Say:** Master prompt with `N=3`.
- **Expected Deliverables:** `src/nodes/mod.rs`, `src/nodes/channel.rs`, `src/nodes/adjust.rs`, `src/nodes/blend.rs`, `src/nodes/math.rs`, `src/nodes/transform.rs`.
- **Owner Check (1 minute):**
  1. Run: `cargo test nodes::` (all node unit tests pass).
  2. Verify Reoriented Normal Mapping math test matches reference normal blending vectors.

### Phase 4 — PBR Lexical Normalizer & One-Click Pack Wizard
- **Goal:** Implement the lexical dictionary recognizing 60+ industry naming conventions (Megascans, Poly Haven, Substance, Quixel, Unreal, Unity). Auto-detect PBR roles (`Albedo`, `Normal`, `Roughness`, `Metallic`, `AO`, `Height`, `Glossiness`). Build the Pack Wizard that analyzes texture files, detects DirectX vs OpenGL, auto-inverts Glossiness $\rightarrow$ Roughness, and generates a ready-to-evaluate DAG graph.
- **You Say:** Master prompt with `N=4`.
- **Expected Deliverables:** `src/normalizer/dicts.rs`, `src/normalizer/rules.rs`, `src/normalizer/wizard.rs`.
- **Owner Check (1 minute):**
  1. Run: `cargo test normalizer::`
  2. Run: `cargo test test_sample_textures_lexical_analysis`
  3. Run: `cargo test test_pack_wizard_glossiness_auto_inversion`
  4. Verify sample textures (`anthracite smooth cast concrete...`) are classified correctly with 100% accuracy.

### Phase 5 — Native DCC Workstation GUI (`eframe`, `egui`, `egui_dock`)
- **Goal:** Build the professional workstation desktop application:
  - **Layout:** "Graphite Blueprint" Obsidian `#0a0b10` tactical theme with `egui_dock` multi-panel docking (Node Canvas, 2D Viewport, Properties Inspector, Library, Status Bar).
  - **Node Canvas:** Infinite pan/zoom, cubic Bezier wire rendering, semantic wire coloring (R=Red, G=Green, B=Blue, A=Gray, RGBA=White), LOD zoom cards (full, compact, block).
  - **DCC Hotkeys:** `Tab` node search palette, `F` frame focus, `1`=Scalar, `3`=Color, `M`=Math, `B`=Blend, `S`=Split, `N`=Normal, `L`=Levels, `I`=Invert, `Ctrl+Z`/`Ctrl+Y`.
  - **Dedicated 2D Viewport:** Channel isolation (`RGB`, `RGBA Checker`, `R`, `G`, `B`, `A`), GPU UV repeat tiling (`1x`, `2x`, `4x`), 1:1 pixel view, real-time pixel probe under cursor (RGB float + byte values).
- **You Say:** Master prompt with `N=5` (use `/goal`).
- **Expected Deliverables:** `src/app.rs`, `src/ui/mod.rs`, `src/ui/canvas.rs`, `src/ui/viewport.rs`, `src/ui/inspector.rs`, `src/ui/library.rs`, `src/ui/theme.rs`.
- **Owner Check (2 minutes):**
  1. Run: `run_desktop_dev.bat` or `cargo run`
  2. Confirm the app window opens in `< 100ms`.
  3. Press `Tab` and spawn a node; connect pins with Bezier wires; press `S`, `B`, `M` to verify hotkeys.
  4. Select a node and observe the 2D Viewport isolate individual channels (`R`, `G`, `B`, `A`).

### Phase 6 — Direct Disk Exporter & Preflight Validation Pipeline
- **Goal:** Implement the parallel multi-threaded direct disk exporter. Support tokenized naming (`{project}`, `{asset}`, `{slot}`, `{res}`, `{colorspace}`, `{format}`), built-in engine presets (Unreal Engine 5 `T_{asset}_{slot}`, Unity MaskMap, Substance, Blender), preflight path collision detection, Windows reserved name sanitization (`CON`, `PRN`, `AUX`, etc.), and atomic disk writes (zero corrupted or empty files).
- **You Say:** Master prompt with `N=6`.
- **Expected Deliverables:** `src/export/mod.rs`, `src/export/writer.rs`, `src/export/tokens.rs`, `src/export/presets.rs`.
- **Owner Check (1 minute):**
  1. Run: `cargo test export::`
  2. Run: `cargo test test_direct_disk_exporter_preflight_and_write`
  3. Verify written files exist directly in target directories with complete non-zero byte payloads.

### Phase 7 — Editions (Lite vs Pro), Hardening, Performance & Standalone Release
- **Goal:** Implement edition feature toggles (TextureLAB Lite vs TextureLAB Pro), execute soak/stress tests, compile the final optimized release binary (`cargo build --release`), verify performance budgets (cold start < 80ms, idle RAM ~45MB, binary size ~5.4MB), generate cryptographic checksums (`SHA256SUMS.txt`), and package release distribution.
- **You Say:** Master prompt with `N=7`.
- **Expected Deliverables:** `target/release/texturelab.exe` (~5.4 MB standalone executable), `release/SHA256SUMS.txt`, clean documentation.
- **Owner Check (2 minutes):**
  1. Run: `cargo test` (all 17+ unit and integration tests pass).
  2. Double-click `target/release/texturelab.exe` on your desktop — app opens instantly without any runtime prerequisites or background Node processes.
  3. Check Windows Task Manager: Memory footprint is ~45 MB RAM (vs 450+ MB for legacy Electron).

---

## 4. Professional DCC Keyboard Shortcuts Cheat Sheet

| Key / Chord | Action / Spawn Target | Notes |
|---|---|---|
| `Tab` | **Quick Node Search Palette** | Fuzzy search all available nodes |
| `F` | **Frame Selected / Frame All** | Smoothly centers canvas camera on nodes |
| `S` | **Spawn Channel Splitter (Unpack)** | Unpacks RGBA into R, G, B, A |
| `C` / `P` | **Spawn Channel Combiner (Pack)** | Packs R, G, B, A into RGBA |
| `M` | **Spawn Math Node** | Scalar and vector arithmetic |
| `B` | **Spawn Blend Node** | Layer Lerp mixing with mask |
| `N` | **Spawn Normal Flip Green** | DirectX $\leftrightarrow$ OpenGL toggle |
| `L` | **Spawn Levels Node** | Remap black/white points and gamma |
| `I` | **Spawn Invert Node** | Invert channels (Roughness $\leftrightarrow$ Gloss) |
| `1` | **Spawn Constant Scalar** | Float slider 0.0 .. 1.0 |
| `3` | **Spawn Constant Color** | RGBA color picker |
| `Delete` / `Backspace` | **Delete Selected Nodes/Edges** | Removes selection from graph |
| `Ctrl + Z` | **Undo Transaction** | Reverts last node, param, or wire change |
| `Ctrl + Y` / `Ctrl + Shift + Z` | **Redo Transaction** | Re-applies undone change |
| `Ctrl + A` | **Select All Nodes** | Selects all nodes in active graph |
| `Ctrl + S` | **Save Project (.tlab)** | Atomic serialization to disk |
| `Ctrl + E` | **Export Textures Dialog** | Opens preflight export panel |

---

## 5. Troubleshooting & Agent Course Correction

| Situation | Command or Instruction to Send to Agent |
|---|---|
| **Compilation Error / Borrow Checker** | *"Run `cargo check` and show the exact rustc compiler diagnostic. Fix lifetime/borrowing issues without adding unneeded clones where references suffice."* |
| **Test Discrepancy** | *"Run `cargo test -- --nocapture <test_name>` to see standard output and panic backtrace. Compare expected vs actual byte values."* |
| **Agent Paused Halfway** | *"Continue Phase N. Re-read `docs/roadmap/PHASE_N_*.md` and resume at the first unticked task."* |
| **Release Build Too Large** | *"Check `Cargo.toml` `[profile.release]`: ensure `opt-level = 3`, `lto = 'thin'`, `codegen-units = 1`, `panic = 'abort'`, and `strip = true` are active."* |
| **GUI Layout Bug** | *"Inspect the `egui_dock` layout tree. Ensure panel min sizes are clamped and dock tabs persist valid IDs."* |
