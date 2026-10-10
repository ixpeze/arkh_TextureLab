# PHASE 6 — Direct Disk Exporter & Preflight Pipeline

**Goal:** Author the parallel multithreaded direct disk exporter in pure Rust: tokenized path expansion (`{asset}_{slot}_{res}`), industry presets (UE5, Unity, Substance, Blender), preflight path collision detection, Windows reserved name sanitization (`CON`, `PRN`, `AUX`, `NUL`), and atomic disk writes. Eliminates all intermediate ZIP files and browser sandbox failures.  
**Prerequisites:** Phases 1–3. **Effort:** M. **Touches:** `src/export/mod.rs`, `src/export/writer.rs`, `src/export/tokens.rs`, `src/export/presets.rs`, `tests/`.

---

## 1. Scope

- **IN:** Token expansion engine; industry export presets; preflight validator (path collisions, Windows reserved filename sanitization, read-only target validation); atomic multithreaded disk writer (`rayon`); comprehensive export execution report; direct-to-disk write tests.
- **OUT:** In-app GUI export dialog wiring (completed in Phase 5), release packaging (Phase 7).

---

## 2. Technical Architecture & Preflight Contracts

### 2.1 Token Resolution System (`src/export/tokens.rs`)
Supported tokens:
- `{project}`: Current project name (default: "TextureLab")
- `{asset}`: Clean asset name (e.g. "AnthraciteConcrete")
- `{slot}`: Target map slot (e.g. "ORM", "Normal", "Albedo")
- `{res}`: Output resolution (e.g. "4K", "2048")
- `{colorspace}`: Target color space ("sRGB" or "Linear")
- `{format}`: File format extension ("png", "tga", "jpg", "exr")
- `{udim}`: UDIM tile identifier (e.g. "1001")

### 2.2 Built-In Industry Presets (`src/export/presets.rs`)
| Preset ID | Name | Pattern | Notes |
|---|---|---|---|
| `ue5` | Unreal Engine 5 | `T_{asset}_{slot}` | Epic Games standard: `T_` prefix |
| `unity` | Unity URP / HDRP | `{asset}_{slot}` | Unity MaskMap / Standard standard |
| `substance` | Substance Painter | `{asset}_{slot}_{res}` | Classic asset, slot, and resolution format |
| `blender` | Blender Principled | `{asset}_{slot}` | Clean glTF 2.0 / Blender PBR naming |
| `cryengine` | CryEngine | `T_{asset}_{slot}` | CryEngine texture standard |

### 2.3 Atomic Disk Writing & Safety (`src/export/writer.rs`)
```rust
#[derive(Clone, Debug, Default)]
pub struct ExportReport {
    pub files_written: Vec<PathBuf>,
    pub bytes_written: u64,
    pub elapsed_ms: u128,
    pub errors: Vec<String>,
}

pub struct ExportWriter;

impl ExportWriter {
    pub fn execute_export(items: &[ExportItem]) -> ExportReport {
        // Parallel atomic writing using Rayon
        // Writes to temporary file, then renames to avoid partial corruption
    }
}
```

---

## 3. Tasks

| ID | Task | Target Files | Acceptance Criteria (Run & Record) |
|---|---|---|---|
| **P6-T1** | **Token Resolver:** Implement `TokenResolver` supporting `{project}`, `{asset}`, `{slot}`, `{res}`, `{colorspace}`, `{format}`. | `src/export/tokens.rs` | Token test expands `T_{asset}_{slot}` to `T_Concrete_ORM.png`. |
| **P6-T2** | **Industry Presets:** Implement default presets for Unreal Engine 5, Unity, Substance, and Blender. | `src/export/presets.rs` | Presets load and resolve valid paths. |
| **P6-T3** | **Preflight Collision & Sanitization:** Detect case-insensitive collisions and sanitize Windows reserved filenames (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`). | `src/export/writer.rs` | Preflight detects conflicting filenames before writing. |
| **P6-T4** | **Atomic Disk Writer:** Multithreaded parallel export using temporary file writes and atomic renames. | `src/export/writer.rs` | Written files are 100% complete with non-zero byte payloads. |
| **P6-T5** | **Export Report Generation:** Return accurate `ExportReport` tracking files written, total bytes, elapsed time, and error list. | `src/export/writer.rs` | Report records exact file count and byte totals. |
| **P6-T6** | **Integration Test Suite:** Integration test writing actual PNG and TGA files to temp directory and verifying byte sizes. | `tests/integration_tests.rs` | Integration test passes with zero errors. |

---

## 4. Test Cases

| Test Case | Description | Command | Expected Result |
|---|---|---|---|
| **TC-601** | Token String Expansion | `cargo test export::tokens::tests::test_token_resolution` | All tokens expand cleanly |
| **TC-602** | Windows Reserved Names Check | `cargo test test_windows_reserved_names` | `aux.png` or `con.tga` sanitized or rejected |
| **TC-603** | Direct Disk Preflight & Write | `cargo test test_direct_disk_exporter_preflight_and_write` | Files exist on disk; report shows 2 files, 0 errors |
| **TC-604** | Parallel Export Throughput | `cargo test --release test_batch_export_speed` | 4x 4K textures written in < 300 ms |

---

## 5. Exit Criteria Checklist

- [x] Path tokens expand correctly for all industry standards (`{project}`, `{asset}`, `{slot}`, `{res}`, `{colorspace}`, `{format}`, `{udim}`).
- [x] Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) and path traversals are safely prevented.
- [x] Atomic file writing guarantees zero corrupt or partial files on disk via temp writes and atomic rename.
- [x] No temporary ZIP archives or browser sandboxes remain.
- [x] All export unit and integration tests pass cleanly via `cargo test` (90 unit tests, 37 integration tests, 0 failures, 0 warnings).

---

## 6. Evidence Log

| Task ID | Exact Command Executed | Result / Output Summary | Verification Status |
|---|---|---|---|
| P6-T1 | `cargo test export::tokens` | `test export::tokens::tests::test_token_resolution ... ok`<br>`test export::tokens::tests::test_token_sanitization ... ok` (2 passed; 0 failed) | [x] |
| P6-T2 | `cargo test export::presets` | `test export::presets::tests::test_builtin_presets_catalog ... ok`<br>`test export::presets::tests::test_preset_path_resolution ... ok`<br>`test export::presets::tests::test_default_format_fallback ... ok` (3 passed; 0 failed) | [x] |
| P6-T3 | `cargo test test_windows_reserved_names` | `test export::writer::tests::test_windows_reserved_names ... ok`<br>`test test_windows_reserved_names ... ok` (Passed) | [x] |
| P6-T4 | `cargo test export::writer` | `test export::writer::tests::test_atomic_export_tga_and_png ... ok`<br>`test export::writer::tests::test_case_insensitive_collision_detection ... ok`<br>`test export::writer::tests::test_reserved_name_preflight_rejection ... ok`<br>`test export::writer::tests::test_windows_reserved_names ... ok` (4 passed; 0 failed) | [x] |
| P6-T5 | `cargo test test_direct_disk_exporter_preflight_and_write` | `test test_direct_disk_exporter_preflight_and_write ... ok` (Report: 2 files written, 0 errors, non-zero payload, bit-exact pixel verification with A=0 preserved) | [x] |
| P6-T6 | `cargo test --release test_batch_export_speed` | `test test_batch_export_speed ... ok` (4x 4K parallel textures written in 0.20s, well below < 300ms budget) | [x] |
| All | `cargo test` | 90 unit tests + 37 integration tests = 127 passed; 0 failed; 0 warnings | [x] |
