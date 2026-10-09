@echo off
setlocal
title ARKH TextureLab Desktop [Production]

echo ===============================================================================
echo                ARKH TextureLab - Desktop Shell (Release)
echo ===============================================================================
echo.

cd /d "%~dp0"

:: 1. Check if release binary exists
if exist "target\release\texturelab.exe" (
    echo [*] Launching optimized release binary (target\release\texturelab.exe)...
    start "" "target\release\texturelab.exe" %*
    exit /b 0
)

:: 2. If release binary does not exist, check cargo and build
echo [*] Release binary not found. Building optimized release executable...
where cargo >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Cargo is required to build the release binary.
    pause
    exit /b 1
)

call cargo build --release
if %errorlevel% neq 0 (
    echo [ERROR] Release build failed!
    pause
    exit /b 1
)

echo [*] Launching newly built release binary...
start "" "target\release\texturelab.exe" %*
exit /b 0
