@echo off
REM Setup virtual environment for Python dependencies

echo 🐍 Setting up Python virtual environment for emotion recognition...

REM Create virtual environment
python -m venv venv

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Upgrade pip
python -m pip install --upgrade pip

REM Install dependencies
pip install -r requirements.txt

echo ✅ Virtual environment setup complete!
echo.
echo To activate the virtual environment manually:
echo venv\Scripts\activate.bat
echo.
echo To deactivate:
echo deactivate
