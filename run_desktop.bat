@echo off
setlocal
title ARKH TextureLab Desktop [100% Pure Rust Workstation]

echo ===============================================================================
echo                ARKH TextureLab - Desktop Workstation (Pure Rust)
echo ===============================================================================
echo.

cd /d "%~dp0"

:: 1. If target\release\texturelab.exe does not exist, build it
if not exist "%~dp0target\release\texturelab.exe" (
    echo [*] Release binary not found. Building release binary (cargo build --release)...
    cargo build --release
    if %errorlevel% neq 0 (
        echo [ERROR] Build failed!
        exit /b %errorlevel%
    )
)

:: 2. Silently sync to network share in background (fails silently if offline)
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "if (Test-Path '\\192.168.11.11\FastShare\Arman\Apps\TextureLab') { Copy-Item -Path '%~dp0target\release\texturelab.exe' -Destination '\\192.168.11.11\FastShare\Arman\Apps\TextureLab\texturelab.exe' -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: 3. Launch canonical release executable
echo [*] Launching ARKH TextureLab: target\release\texturelab.exe
start "" "%~dp0target\release\texturelab.exe" %*
exit /b 0
