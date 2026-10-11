@echo off
setlocal
title ARKH TextureLab Desktop [100% Pure Rust Workstation]

echo ===============================================================================
echo                ARKH TextureLab - Desktop Workstation (Pure Rust)
echo ===============================================================================
echo.

cd /d "%~dp0"

:: 1. If target\release built, attempt sync to canonical release
if exist "%~dp0target\release\texturelab.exe" (
    if not exist "%~dp0release" mkdir "%~dp0release"
    copy /y "%~dp0target\release\texturelab.exe" "%~dp0release\TextureLab.exe" >nul 2>&1
)

:: 2. Launch canonical release executable if available
if exist "%~dp0release\TextureLab.exe" (
    echo [*] Launching ARKH TextureLab: release\TextureLab.exe
    start "" "%~dp0release\TextureLab.exe" %*
    exit /b 0
)

:: 3. Fallback to target\release executable
if exist "%~dp0target\release\texturelab.exe" (
    echo [*] Launching ARKH TextureLab: target\release\texturelab.exe
    start "" "%~dp0target\release\texturelab.exe" %*
    exit /b 0
)

:: 3. Otherwise build release binary with cargo, sync to release\, and launch
echo [*] Release binary not found. Building release binary (cargo build --release)...
cargo build --release
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    exit /b %errorlevel%
)
if not exist "%~dp0release" mkdir "%~dp0release"
copy /y "%~dp0target\release\texturelab.exe" "%~dp0release\TextureLab.exe" >nul
echo [*] Launching ARKH TextureLab: release\TextureLab.exe
start "" "%~dp0release\TextureLab.exe" %*
exit /b 0
