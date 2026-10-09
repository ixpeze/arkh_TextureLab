@echo off
setlocal
title ARKH TextureLab - Environment Setup (Pure Rust)

echo ===============================================================================
echo                ARKH TextureLab - Pure Rust Environment Setup
echo ===============================================================================
echo.

:: 1. Check Rust compiler (rustc)
echo [*] Checking Rust toolchain (rustc)...
where rustc >nul 2>&1
if %errorlevel% neq 0 goto :rust_missing

for /f "tokens=*" %%v in ('rustc --version 2^>nul') do set "RUSTC_VER=%%v"
echo     Found %RUSTC_VER%

:: 2. Check Cargo package manager
echo [*] Checking Cargo package manager...
where cargo >nul 2>&1
if %errorlevel% neq 0 goto :cargo_missing

for /f "tokens=*" %%v in ('cargo --version 2^>nul') do set "CARGO_VER=%%v"
echo     Found %CARGO_VER%
echo.

:: 3. Run cargo test baseline verification
echo [*] Running test suite verification (cargo test)...
echo     Please wait while crates are compiled and verified...
echo.
cd /d "%~dp0"
call cargo test
if %errorlevel% neq 0 goto :test_failed

echo.
echo ===============================================================================
echo                ARKH TextureLab Setup Completed Successfully!
echo ===============================================================================
echo.
echo 100%% Pure Rust Desktop environment is verified and ready.
echo You can launch ARKH TextureLab using:
echo    run_desktop_dev.bat   (Fast Development Mode: cargo run)
echo    run_desktop.bat       (Optimized Release Executable)
echo.

set /p "LAUNCH_NOW=Would you like to launch ARKH TextureLab in Dev Mode now? (Y/N, default Y): "
if /i "%LAUNCH_NOW%"=="N" goto :skip_launch

echo.
echo [*] Launching ARKH TextureLab Desktop (Dev Mode)...
call run_desktop_dev.bat
exit /b 0

:skip_launch
echo Exiting setup. Run run_desktop_dev.bat or run_desktop.bat when ready.
pause
exit /b 0

:rust_missing
echo.
echo ===============================================================================
echo [ERROR] Rust compiler (rustc) is not found in your system PATH!
echo ===============================================================================
echo ARKH TextureLab is a 100%% Pure Rust application requiring the Rust 2021 toolchain.
echo Please install Rust via rustup:
echo    https://rustup.rs/
echo.
echo Make sure "C++ Build Tools" (MSVC) are also selected during installation.
echo After installation, reopen this terminal and rerun setup.bat.
echo ===============================================================================
echo.
pause
exit /b 1

:cargo_missing
echo.
echo ===============================================================================
echo [ERROR] Cargo is not found in your system PATH!
echo ===============================================================================
echo Cargo is installed automatically with Rust. Please verify your rustup installation.
echo ===============================================================================
echo.
pause
exit /b 1

:test_failed
echo.
echo ===============================================================================
echo [ERROR] Test suite verification failed!
echo ===============================================================================
echo Please review the compiler or test failure log above.
echo ===============================================================================
echo.
pause
exit /b 1
