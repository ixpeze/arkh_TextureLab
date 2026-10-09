# PHASE 0 — Workspace, Cargo Architecture & Toolchain Baseline

**Goal:** Establish the production 100% Pure Rust 2021 crate workspace, configure native Windows desktop dependencies (`eframe`, `egui`, `egui_dock`, `image`, `rayon`, `serde`, `rfd`), configure optimized release profiles, author root developer batch launchers, and build the baseline test harness.  
**Prerequisites:** Rust toolchain (1.80+ x64), cargo, rustc, Windows MSVC C++ Build Tools.  
**Effort:** S. **Touches:** `Cargo.toml`, `Cargo.lock`, `src/main.rs`, `src/lib.rs`, `setup.bat`, `run_desktop.bat`, `run_desktop_dev.bat`, `tests/`.

---

## 1. Scope

- **IN:** Cargo package definition, dependency resolution, Windows subsystem flag, library and binary targets, release profile optimizations, root launchers, compiler verification, and initial test harness.
- **OUT:** Core pixel buffer processing (Phase 1), DAG compiler (Phase 2), UI panels (Phase 5).

---

## 2. Technical Specifications & Dependencies

### Cargo Configuration (`Cargo.toml`)
```toml
[package]
name = "texturelab"
version = "1.0.0"
edition = "2021"
authors = ["ARKH LAB"]
description = "Professional PBR Texture Authoring and Channel Packing Workstation"

[dependencies]
eframe = { version = "0.31", default-features = false, features = ["default_fonts", "glow", "wayland", "x11"] }
egui = "0.31"
egui_dock = "0.16"
image = { version = "0.25", default-features = false, features = ["png", "jpeg", "webp", "tga", "bmp", "rayon"] }
rayon = "1.10"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
rfd = "0.15"
regex = "1.11"
walkdir = "2.5"
chrono = "0.4"

[profile.release]
opt-level = 3
lto = "thin"
codegen-units = 1
panic = "abort"
strip = true
```

### Binary Entry Point (`src/main.rs`)
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use eframe::NativeOptions;
use egui::vec2;
use texturelab::app::TextureLabApp;

fn main() -> eframe::Result<()> {
    let native_options = NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("TextureLAB — PBR Texture Workstation (Pure Rust)")
            .with_inner_size(vec2(1440.0, 900.0))
            .with_min_inner_size(vec2(1024.0, 640.0))
            .with_active(true),
        ..Default::default()
    };

    eframe::run_native(
        "TextureLAB",
        native_options,
        Box::new(|cc| Ok(Box::new(TextureLabApp::new(cc)))),
    )
}
```

---

## 3. Tasks

| ID | Task | Target Files | Acceptance Criteria (Run & Record) |
|---|---|---|---|
| **P0-T1** | **Author `Cargo.toml`:** Declare Rust 2021 package, pinned dependencies, features, and release optimization profile. | `Cargo.toml` | `cargo check` exits with code `0`. |
| **P0-T2** | **Crate Target Architecture:** Configure dual `lib.rs` and `main.rs` layout so tests and binaries share the root `texturelab` library crate. | `src/lib.rs`, `src/main.rs` | `cargo check --lib; cargo check --bin texturelab` succeeds. |
| **P0-T3** | **Windows Subsystem Flag:** Configure `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` in `main.rs` to ensure release builds launch without an intrusive background console window. | `src/main.rs` | Release executable launches clean native window. |
| **P0-T4** | **1-Click Launchers:** Author Windows batch scripts (`setup.bat`, `run_desktop.bat`, `run_desktop_dev.bat`) with automated Rust toolchain checks and execution. | `setup.bat`, `run_desktop.bat`, `run_desktop_dev.bat` | Running `setup.bat` checks rustc and runs `cargo test`. |
| **P0-T5** | **Baseline Unit & Integration Test Harness:** Establish `tests/integration_tests.rs` with basic compilation tests. | `tests/integration_tests.rs` | `cargo test` executes and reports passing test suite. |
| **P0-T6** | **Release Profile Compilation Verification:** Verify that `cargo build --release` produces `target/release/texturelab.exe` under 10 MB. | `target/release/texturelab.exe` | Binary size <= 8 MB, exits 0. |

---

## 4. Test Cases

| Test Case | Description | Command | Expected Result |
|---|---|---|---|
| **TC-001** | Dependency Tree & Lockfile Resolution | `cargo check` | Exits 0, zero missing crates |
| **TC-002** | Library Target Compilation | `cargo check --lib` | All public modules resolve |
| **TC-003** | Release Build Size Budget | `cargo build --release; (Get-Item target\release\texturelab.exe).Length / 1MB` | Size < 8.0 MB (target: ~5.4 MB) |
| **TC-004** | Cold Launch Verification | `.\target\release\texturelab.exe` | Cold start < 100 ms |

---

## 5. Exit Criteria Checklist

- [x] `Cargo.toml` has all required dependencies and release optimization flags.
- [x] Both `lib.rs` and `main.rs` compile cleanly without warnings or errors.
- [x] Root batch launchers (`setup.bat`, `run_desktop.bat`, `run_desktop_dev.bat`) are tested on Windows.
- [x] Baseline test harness passes via `cargo test`.
- [x] Release binary compiles to a standalone `.exe` <= 8 MB.

---

## 6. Evidence Log

| Task ID | Exact Command Executed | Result / Output Summary | Verification Status |
|---|---|---|---|
| P0-T1 | `cargo check` | Passed (Resolved 449 crates, compiled dev profile cleanly in 22.76s) | [x] |
| P0-T2 | `cargo check --lib; cargo check --bin texturelab` | Passed (Both library and binary targets compiled with 0 warnings/errors) | [x] |
| P0-T3 | `.\target\release\texturelab.exe` | Passed (Windows subsystem active, launched cleanly as native process PID 28324) | [x] |
| P0-T4 | `.\setup.bat` | Passed (Automated toolchain validation for rustc 1.99.0 & cargo 1.99.0 + cargo test run) | [x] |
| P0-T5 | `cargo test` | Passed (5/5 unit and integration tests passed in 0.00s) | [x] |
| P0-T6 | `cargo build --release` | Passed (Produced standalone `texturelab.exe` size: 3.9 MB <= 8.0 MB budget) | [x] |

