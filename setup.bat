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

:: 4. Verify canonical binary and silently sync to network share
echo     Generated canonical binary: target\release\texturelab.exe
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "if (Test-Path '\\192.168.11.11\FastShare\Arman\Apps\TextureLab') { Copy-Item -Path '%~dp0target\release\texturelab.exe' -Destination '\\192.168.11.11\FastShare\Arman\Apps\TextureLab\texturelab.exe' -Force -ErrorAction SilentlyContinue }" >nul 2>&1
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
