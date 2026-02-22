@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

:: ────────────────────────────────────────────────────────────
::  Vision Node Installer for Windows
::  Downloads, configures, and launches a Vision Chain storage node
:: ────────────────────────────────────────────────────────────

set VERSION=1.0.0
set INSTALL_DIR=%USERPROFILE%\.vision-node
set MIN_NODE_VERSION=20
set REPO_URL=https://github.com/jays-visionAI/visionchain.git

echo.
echo   =========================================
echo   =                                       =
echo   =   V I S I O N   N O D E   v%VERSION%     =
echo   =   Windows Installer                   =
echo   =                                       =
echo   =========================================
echo.

:: ── Check Node.js ──
echo [1/5] Checking prerequisites...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   ERROR: Node.js is not installed.
    echo.
    echo   Download Node.js v%MIN_NODE_VERSION%+ from:
    echo     https://nodejs.org/
    echo.
    echo   After installing, restart this installer.
    pause
    exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_VER_RAW=%%a
set NODE_VER=%NODE_VER_RAW:v=%

echo   Node.js v%NODE_VER% detected

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo   ERROR: git is not installed.
    echo.
    echo   Download git from:
    echo     https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)
echo   git detected

:: ── Download ──
echo.
echo [2/5] Downloading Vision Node...

if exist "%INSTALL_DIR%\repo\.git" (
    echo   Updating existing installation...
    cd /d "%INSTALL_DIR%\repo"
    git pull --quiet origin main 2>nul
) else (
    if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
    git clone --depth 1 %REPO_URL% "%INSTALL_DIR%\repo" 2>nul
)

:: ── Install Dependencies ──
echo.
echo [3/5] Installing dependencies...
cd /d "%INSTALL_DIR%\repo\vision-node"
call npm ci --silent 2>nul || call npm install --silent 2>nul

:: ── Build ──
echo.
echo [4/5] Building...
call npm run build --silent 2>nul

:: ── Create launcher ──
echo.
echo [5/5] Setting up...

:: Create vision-node.cmd launcher
(
echo @echo off
echo cd /d "%INSTALL_DIR%\repo\vision-node"
echo node dist\index.js %%*
) > "%INSTALL_DIR%\vision-node.cmd"

:: Add to user PATH if not already there
echo %PATH% | find /i "%INSTALL_DIR%" >nul
if %errorlevel% neq 0 (
    setx PATH "%PATH%;%INSTALL_DIR%" >nul 2>&1
    echo   Added to user PATH. Restart your terminal to use 'vision-node' command.
) else (
    echo   Already in PATH.
)

:: ── Done ──
echo.
echo   Installation complete!
echo.
echo   Quick Start:
echo.
echo     1. Open a NEW terminal (cmd or PowerShell)
echo.
echo     2. Initialize your node:
echo        vision-node init --email your@email.com --class standard
echo.
echo     3. Start the node:
echo        vision-node start
echo.
echo     4. Open the dashboard:
echo        http://localhost:9090
echo.
echo   Node Classes:
echo     lite      100MB - 1GB   (minimal participation)
echo     standard  1GB - 100GB   (default)
echo     full      100GB - 1TB   (full archival)
echo.
echo   Options:
echo     --storage 10GB    Set storage allocation
echo     --staging         Use staging network
echo.

pause
