@echo off
setlocal
title ARKH TextureLab Desktop [Development]

echo ===============================================================================
echo                ARKH TextureLab - Desktop Shell (Pure Rust Dev)
echo ===============================================================================
echo.

:: 1. Navigate to repository root directory
cd /d "%~dp0"

:: 2. Check Cargo
where cargo >nul 2>&1
if %errorlevel% neq 0 goto :cargo_missing

:: 3. Launch via cargo run
echo [*] Starting ARKH TextureLab Desktop in Development Mode (cargo run)...
call cargo run

if %errorlevel% neq 0 goto :app_crashed
echo.
echo [INFO] ARKH TextureLab closed normally.
exit /b 0

:cargo_missing
echo.
echo [ERROR] Cargo is not found in your system PATH!
echo Please run setup.bat to verify your Rust environment.
pause
exit /b 1

:app_crashed
echo.
echo [ERROR] ARKH TextureLab encountered an error during execution.
pause
exit /b 1
