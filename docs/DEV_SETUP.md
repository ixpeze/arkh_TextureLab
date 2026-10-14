# Developer Setup & Contribution Guide

---

## 1. Prerequisites

| Tool | Minimum Version | Purpose |
| --- | --- | --- |
| **Rust & Cargo** | 1.80+ | Compiler and package manager |
| **Git** | 2.40+ | Version control |

Install Rust via [rustup](https://rustup.rs/):

```powershell
winget install Rustlang.Rustup
```

---

## 2. Quickstart Scripts (Windows)

* [`setup.bat`](../setup.bat) — Validates environment, runs tests, builds portable `.exe`.
* [`run_desktop.bat`](../run_desktop.bat) — Launches the workstation.

---

## 3. Build & Run

```powershell
cargo run              # Debug mode
cargo run --release    # Optimised release
cargo test             # 173 unit + integration tests
cargo clippy           # Lint check
cargo build --release  # Portable binary → target/release/texturelab.exe
```

---

## 4. Directory Structure

```
arkh_TextureLab/
├── assets/
│   ├── fonts/           # Geist font family
│   └── templates/       # Built-in starter .tlab templates (Phase 2+)
├── docs/
│   ├── archive/         # Completed v1.0 design specs
│   ├── design/          # Visual design guides (nodes, sidebar, viewport)
│   ├── specs/           # Active design specifications
│   ├── ARCHITECTURE.md  # System architecture & module map
│   ├── DEV_SETUP.md     # This file
│   └── IMPLEMENTATION_PLAN.md  # Phased feature plan & agent prompts
├── release/             # Portable executable output
├── samples/             # Sample PBR texture sets for testing
├── src/
│   ├── core/            # TextureBuffer, colorspace LUTs
│   ├── export/          # Codecs (PNG/TGA/EXR), presets, token engine, writer
│   ├── graph/           # DAG model, compiler, evaluator, history, layout
│   ├── hotkeys/         # Keyboard shortcut table
│   ├── nodes/           # 19 processing nodes across 8 categories
│   ├── normalizer/      # PBR lexical rules, auto-pack wizard
│   ├── ui/              # egui workstation: canvas, inspector, library, viewport
│   ├── app.rs           # Application lifecycle & docking
│   ├── main.rs          # Native binary entry point
│   └── lib.rs           # Library crate root
├── tests/               # Integration test suites
├── Cargo.toml           # Crate manifest
├── run_desktop.bat      # 1-click launcher
└── setup.bat            # 1-click setup & build
```

---

## 5. Testing

All tests are headless and run in CI:

```powershell
# Full suite
cargo test

# Single test by name
cargo test test_starter_graph

# With output
cargo test -- --nocapture
```

---

## 6. CI

GitHub Actions workflow at [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

1. Clippy lint (`-D warnings`)
2. Full test suite
3. Release build

Runs on `push` and `pull_request` to `main`.
