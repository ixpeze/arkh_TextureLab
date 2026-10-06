@echo off
setlocal
title ARKH TextureLab - First Time Installer

echo ===============================================================================
echo                ARKH TextureLab - First Time Environment Installer
echo ===============================================================================
echo.

:: 1. Check Node.js installation
echo [*] Checking Node.js installation...
where node >nul 2>&1
if %errorlevel% neq 0 goto :node_missing

for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
echo     Found Node.js %NODE_VER%

:: 2. Check npm installation
echo [*] Checking npm installation...
where npm >nul 2>&1
if %errorlevel% neq 0 goto :npm_missing

for /f "tokens=*" %%v in ('npm -v 2^>nul') do set "NPM_VER=%%v"
echo     Found npm v%NPM_VER%
echo.

:: 3. Navigate to app directory
cd /d "%~dp0app"
if %errorlevel% neq 0 goto :dir_missing

:: 4. Install dependencies
echo [*] Installing dependencies via npm install...
echo     Please wait while npm installs packages...
echo.
call npm install
if %errorlevel% neq 0 goto :install_failed

echo.
echo [*] Verifying test suite...
call npm test
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Test suite reported warnings or errors. You may still proceed.
    echo.
)

echo.
echo ===============================================================================
echo                ARKH TextureLab Setup Completed Successfully!
echo ===============================================================================
echo.
echo You can now launch ARKH TextureLab anytime by running:
echo    run_desktop_dev.bat   (Desktop App)
echo    run_web.bat           (Web Browser)
echo.
set /p "LAUNCH_NOW=Would you like to launch ARKH TextureLab now? (Y/N, default Y): "
if /i "%LAUNCH_NOW%"=="N" goto :skip_launch

echo.
echo [*] Launching ARKH TextureLab in your default browser...
cd /d "%~dp0"
call run_web.bat
exit /b 0

:skip_launch
echo Exiting setup. Run run_web.bat when you are ready.
pause
exit /b 0

:node_missing
echo.
echo ===============================================================================
echo [ERROR] Node.js is not found in your system PATH!
echo ===============================================================================
echo Node.js LTS is required to run ARKH TextureLab.
echo Please download and install Node.js from:
echo    https://nodejs.org/
echo.
echo After installing Node.js, close and reopen your terminal or rerun setup.bat.
echo ===============================================================================
echo.
pause
exit /b 1

:npm_missing
echo.
echo ===============================================================================
echo [ERROR] npm is not found in your system PATH!
echo ===============================================================================
echo npm comes bundled with Node.js. Please verify your Node.js installation.
echo ===============================================================================
echo.
pause
exit /b 1

:dir_missing
echo.
echo [ERROR] Could not find the 'app' directory at: "%~dp0app"
pause
exit /b 1

:install_failed
echo.
echo ===============================================================================
echo [ERROR] npm install failed!
echo ===============================================================================
echo Check your internet connection or proxy settings, or try running:
echo    cd app
echo    npm install --verbose
echo ===============================================================================
echo.
pause
exit /b 1
