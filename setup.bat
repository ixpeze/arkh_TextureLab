@echo off
setlocal
title ARKH TextureLab - Environment Setup [Pure Rust Engine]

echo ===============================================================================
echo          ARKH TextureLab - Pure Rust Desktop Workstation Setup
echo ===============================================================================
echo.

:: 1. Check Cargo & Rust installation
echo [*] Checking Rust toolchain installation...
where cargo >nul 2>&1
if %errorlevel% neq 0 goto :rust_missing

for /f "tokens=*" %%v in ('rustc --version 2^>nul') do set "RUST_VER=%%v"
for /f "tokens=*" %%v in ('cargo --version 2^>nul') do set "CARGO_VER=%%v"
echo     Found %RUST_VER%
echo     Found %CARGO_VER%
echo.

cd /d "%~dp0"

:: 2. Verify complete test suite
echo [*] Running full test suite (cargo test)...
cargo test
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Cargo test suite failed!
    exit /b %errorlevel%
)
echo     All tests passed cleanly!
echo.

:: 3. Build optimized release binary
echo [*] Building optimized release binary (cargo build --release)...
cargo build --release
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Cargo release build failed!
    exit /b %errorlevel%
)

:: 4. Ensure release directory and copy production executable
if not exist "%~dp0release" mkdir "%~dp0release"
copy /y "%~dp0target\release\texturelab.exe" "%~dp0release\TextureLab.exe" >nul
echo     Generated canonical binary: release\TextureLab.exe
echo.

echo ===============================================================================
echo         ARKH TextureLab Pure Rust Setup Completed Successfully!
echo ===============================================================================
echo.
echo Launch workstation using: run_desktop.bat
exit /b 0

:rust_missing
echo.
echo [ERROR] Rust / Cargo is not installed or not in your PATH.
echo Please install Rust from https://rustup.rs/ and run this setup script again.
exit /b 1
