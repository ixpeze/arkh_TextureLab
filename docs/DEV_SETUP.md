# Developer Setup & Contribution Guide

This guide covers everything required to set up, build, test, and package ARKH TextureLab locally.

---

## 1. Prerequisites

ARKH TextureLab is a 100% pure Rust desktop application. Ensure you have the Rust toolchain installed:

| Tool | Minimum Version | Purpose |
|---|---|---|
| **Rust & Cargo** | 1.80+ | Workstation compiler and package manager |
| **Git** | 2.40+ | Version control |

Install Rust via [rustup](https://rustup.rs/):
```powershell
winget install Rustlang.Rustup
```

---

## 2. Quickstart Scripts (Windows)

The repository provides automated batch scripts in the root directory:

* [`setup.bat`](setup.bat): Validates environment, executes all tests, and packages the portable `.exe`.
* [`run_desktop.bat`](run_desktop.bat): Launches the portable workstation or runs `cargo run --release`.

---

## 3. Native Rust Workstation (`src/`)

### Build & Run
```powershell
# Run workstation in debug mode
cargo run

# Run workstation in optimized release mode
cargo run --release
```

### Testing & Verification
```powershell
# Run complete test suite (unit + integration tests)
cargo test

# Fast syntax and type checking
cargo check
```

### Packaging Portable Executable
```powershell
# Build optimized release binary
cargo build --release

# Copy to release directory
Copy-Item target\release\texturelab.exe release\TextureLab.exe
```

---

## 4. Directory Structure Reference

```
arkh_TextureLab/
├── assets/            # Fonts, UI icons, and brand graphics
├── docs/              # System architecture, specs, and roadmaps
├── release/           # Generated standalone portable executable
├── samples/           # Sample textures for PBR testing
├── src/
│   ├── core/          # Image buffers, color models, colorspace LUTs
│   ├── export/        # Channel packing, codecs (PNG/TGA), token engine
│   ├── graph/         # DAG model, Kahn topological sort, evaluator cache, history
│   ├── nodes/         # 20+ processing nodes (I/O, Split, Combine, RNM, Math)
│   ├── normalizer/    # 60+ industry dictionary conventions, auto-pack wizard
│   ├── ui/            # egui/egui_dock workstation UI, canvas, viewport, inspector
│   ├── app.rs         # Main application lifecycle & docking management
│   ├── main.rs        # Native binary entry point
│   └── lib.rs         # Workstation library root
├── tests/             # End-to-end integration test suites
├── Cargo.toml         # Rust crate manifest and dependency definitions
├── run_desktop.bat    # 1-click desktop launcher
└── setup.bat          # 1-click environment setup & build script
```
