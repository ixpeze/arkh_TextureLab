@echo off
setlocal
title ARKH TextureLab [React 19 + xyflow]

echo ===============================================================================
echo                ARKH TextureLab - Tactical PBR Workstation
echo ===============================================================================
echo.

:: 1. Navigate to repository root directory
cd /d "%~dp0"

:: 2. Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 goto :node_missing

:: 3. Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 goto :npm_missing

:: 4. Check if node_modules exists; if not, automatically run npm install
if not exist "%~dp0web-xyflow\node_modules" goto :install_deps
goto :start_server

:install_deps
echo [*] First-time setup detected: Installing web dependencies...
echo     Please wait while npm installs packages...
echo.
cd /d "%~dp0web-xyflow"
call npm install
if %errorlevel% neq 0 goto :install_failed
echo.
echo [*] Dependencies successfully installed!
echo.
cd /d "%~dp0"

:start_server
cd /d "%~dp0web-xyflow"
echo [*] Starting ARKH TextureLab local server...
echo [*] Workstation address: http://localhost:5173
echo [*] Opening in your default browser...
echo.

call npm run dev -- --open

if %errorlevel% neq 0 goto :server_stopped
exit /b 0

:node_missing
echo.
echo ===============================================================================
echo [ERROR] Node.js is not found in your system PATH!
echo ===============================================================================
echo Node.js LTS is required to run ARKH TextureLab.
echo Please install Node.js from:
echo    https://nodejs.org/
echo.
echo If you just installed Node.js, please restart your command prompt or PC.
echo ===============================================================================
echo.
pause
exit /b 1

:npm_missing
echo.
echo [ERROR] npm is not found in your system PATH!
echo Please verify your Node.js installation.
echo.
pause
exit /b 1

:install_failed
echo.
echo ===============================================================================
echo [ERROR] Automatic dependency installation failed!
echo Please run setup.bat to inspect full diagnostics.
echo ===============================================================================
echo.
pause
exit /b 1

:server_stopped
echo.
echo [ERROR] ARKH TextureLab server stopped unexpectedly.
echo.
pause
exit /b 1
