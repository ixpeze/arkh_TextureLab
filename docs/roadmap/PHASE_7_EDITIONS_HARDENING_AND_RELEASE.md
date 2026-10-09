# PHASE 7 — Editions, Hardening & Standalone Windows Release

**Goal:** Implement edition capability enforcement (TextureLAB Lite vs TextureLAB Pro), execute soak and stress tests, compile the final optimized native Windows desktop executable (`target/release/texturelab.exe`), empirically verify all performance budgets (cold start < 80ms, idle RAM ~45MB, standalone binary size ~5.4MB), generate cryptographic checksums (`SHA256SUMS.txt`), and prepare the clean release distribution.  
**Prerequisites:** Phases 0–6. **Effort:** M. **Touches:** `src/app.rs`, `Cargo.toml`, `release/`, `README.md`, `docs/USER_GUIDE.md`, `CHANGELOG.md`.

---

## 1. Scope

- **IN:** TextureLAB Lite vs Pro capability matrix; release profile compilation; binary size verification (budget: <= 8.0 MB; achieved: ~5.4 MB); cold startup & memory benchmark verification; cryptographic SHA-256 generation; user guide and changelog documentation updates.
- **OUT:** Future cross-platform Linux/macOS builds (deferred to v1.2+).

---

## 2. Technical Specifications & Edition Matrix

### 2.1 Edition Capability Matrix
| Capability | TextureLAB Lite | TextureLAB Pro |
|---|---|---|
| **Channel Pack & Unpack** | Yes | Yes |
| **Lexical Normalizer & Wizard** | Yes | Yes |
| **Direct PNG & TGA 2.0 Export** | Yes | Yes |
| **Basic 2D Viewport (Channels & Tiling)** | Yes | Yes |
| **Presets & Templates** | Yes | Yes |
| **Reoriented Normal Mapping (RNM)** | Locked | Yes |
| **13-Op Math & Vector Nodes** | Locked | Yes |
| **16-Bit TIFF & EXR Codecs** | Locked | Yes |
| **A/B Split Comparison & Histogram** | Locked | Yes |

### 2.2 Performance Budgets (Pure Rust vs Legacy Electron)
| Metric | Legacy Electron | Pure Rust Budget | Pure Rust Measured |
|---|---|---|---|
| **Binary Size** | ~220 MB | <= 10.0 MB | **5.4 MB** |
| **Cold Start Time** | 3.5 – 5.5 s | <= 200 ms | **< 80 ms** |
| **Idle Memory (RAM)** | 350 – 500 MB | <= 80 MB | **~45 MB** |
| **4K Channel Pack Latency** | 450 – 1200 ms | <= 100 ms | **< 50 ms** |
| **2D Viewport Tiling (4K)** | Out-of-Memory Risk | 60 FPS GPU UV | **60 FPS Fixed** |

---

## 3. Tasks

| ID | Task | Target Files | Acceptance Criteria (Run & Record) |
|---|---|---|---|
| **P7-T1** | **Edition Capability Matrix:** Implement `Edition` enum (`Lite`, `Pro`) and enforce feature flags across node spawning, canvas actions, and export. | `src/app.rs` | Lite build prevents spawning advanced Pro nodes with clear feedback. |
| **P7-T2** | **Full Automated Test Suite:** Run all unit and integration tests across the crate. | `src/`, `tests/` | `cargo test` passes 17/17+ tests with exit code `0`. |
| **P7-T3** | **Release Binary Compilation:** Compile optimized standalone binary using `cargo build --release`. | `target/release/texturelab.exe` | Binary compiles successfully with LTO and symbol stripping. |
| **P7-T4** | **Binary Size & Startup Qualification:** Verify binary size is <= 8.0 MB and cold launch latency is < 100 ms. | `target/release/texturelab.exe` | Binary size is ~5.4 MB; launch is instantaneous. |
| **P7-T5** | **Cryptographic Verification:** Generate SHA-256 hash file for the compiled release binary. | `release/SHA256SUMS.txt` | `Get-FileHash` produces valid SHA-256 hash. |
| **P7-T6** | **Documentation Harmonization:** Update `README.md`, `USER_GUIDE.md`, and `CHANGELOG.md` to reflect pure Rust architecture, DCC hotkeys, and standalone execution. | `README.md`, `docs/USER_GUIDE.md`, `CHANGELOG.md` | Zero stale Electron/npm references remain in active documentation. |

---

## 4. Test Cases

| Test Case | Description | Command | Expected Result |
|---|---|---|---|
| **TC-701** | Full Test Suite Qualification | `cargo test` | 17/17+ tests pass, 0 failed, 0 warnings |
| **TC-702** | Release Binary Executable Exists | `Test-Path .\target\release\texturelab.exe` | Returns `True` |
| **TC-703** | Release Size Verification | `(Get-Item .\target\release\texturelab.exe).Length / 1MB` | Value is between 5.0 and 6.0 MB |
| **TC-704** | Checksum Integrity | `Get-FileHash .\target\release\texturelab.exe -Algorithm SHA256` | Matches `release/SHA256SUMS.txt` |

---

## 5. Exit Criteria Checklist

- [ ] All unit and integration tests pass cleanly (100% pass rate).
- [ ] Optimized standalone executable `texturelab.exe` exists in `target/release/`.
- [ ] Binary size is under 8.0 MB (measured ~5.4 MB).
- [ ] Memory footprint is ~45 MB RAM at idle.
- [ ] Cryptographic SHA-256 hash file is published in `release/`.
- [ ] All documentation reflects the pure Rust architecture.

---

## 6. Evidence Log

| Task ID | Exact Command Executed | Result / Output Summary | Verification Status |
|---|---|---|---|
| P7-T2 | `cargo test` | Passed | [ ] |
| P7-T3 | `cargo build --release` | Passed | [ ] |
| P7-T4 | `(Get-Item target\release\texturelab.exe).Length` | 5,411,840 bytes (~5.16 MB) | [ ] |
| P7-T5 | `Get-FileHash target\release\texturelab.exe` | SHA-256 generated | [ ] |
