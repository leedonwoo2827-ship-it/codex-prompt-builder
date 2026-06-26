@echo off
cd /d "%~dp0"

if not exist venv (
  echo [ERROR] Not set up yet. Double-click setup.bat first.
  pause
  exit /b 1
)

call venv\Scripts\activate.bat
echo Starting Prompt Builder... your browser will open automatically.
echo (Press Ctrl+C in this window to stop)
python app.py
pause
