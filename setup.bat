@echo off
cd /d "%~dp0"
echo ============================================
echo   Prompt Builder - First-time Setup
echo ============================================
echo.

REM 1) Create virtual environment
if not exist venv (
  echo [1/3] Creating virtual environment...
  python -m venv venv
  if errorlevel 1 (
    echo.
    echo [ERROR] Python not found. Install Python 3.10+ and run again.
    pause
    exit /b 1
  )
) else (
  echo [1/3] Virtual environment already exists. Skipping.
)

REM 2) Install dependencies
echo [2/3] Installing dependencies...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul
pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo [ERROR] Failed to install dependencies.
  pause
  exit /b 1
)

REM 3) Prepare .env
echo [3/3] Checking environment file...
if not exist .env (
  copy .env.example .env >nul
  echo   Created .env - open it in Notepad and enter your LiteLLM key.
) else (
  echo   .env already exists.
)

echo.
echo Done! Now double-click run.bat to start.
echo (After launch, use "Test Connection" in Settings to verify key/models.)
pause
