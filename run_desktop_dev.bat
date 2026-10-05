@echo off
setlocal
title ARKH TextureLab Desktop [Development]

echo ===============================================================================
echo                ARKH TextureLab - Desktop Shell (Dev Mode)
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

:: 4. Check if node_modules exists
if not exist "%~dp0web-xyflow\node_modules" goto :install_deps
goto :start_desktop

:install_deps
echo [*] Dependencies not found. Running npm install...
cd /d "%~dp0web-xyflow"
call npm install
if %errorlevel% neq 0 goto :install_failed
cd /d "%~dp0"

:start_desktop
cd /d "%~dp0web-xyflow"
echo [*] Starting ARKH TextureLab Desktop development environment...
call npm run dev:desktop

if %errorlevel% neq 0 goto :desktop_stopped
exit /b 0

:node_missing
echo.
echo [ERROR] Node.js is not found in your system PATH!
echo Please install Node.js LTS from https://nodejs.org/
pause
exit /b 1

:npm_missing
echo.
echo [ERROR] npm is not found in your system PATH!
pause
exit /b 1

:install_failed
echo.
echo [ERROR] npm install failed.
pause
exit /b 1

:desktop_stopped
echo.
echo [INFO] ARKH TextureLab Desktop closed.
pause
exit /b 0
