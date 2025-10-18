@echo off
REM Ego Consciousness Uploader - Complete Startup Script for Windows
REM This script starts both the Node.js frontend and Python emotion recognition backend

echo 🎭 Starting Ego Consciousness Uploader with Emotion Recognition
echo ================================================================

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the ego-consciousness-uploader directory
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo ⚠️  Virtual environment not found. Creating...
    call setup_venv.bat
    if errorlevel 1 (
        echo ❌ Failed to create virtual environment
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo 🔍 Activating Python virtual environment...
call venv\Scripts\activate.bat

echo 🔍 Checking Python dependencies...
python -c "import cv2, deepface, numpy, websockets" 2>nul
if errorlevel 1 (
    echo ⚠️  Python dependencies not found. Installing...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ❌ Failed to install Python dependencies
        pause
        exit /b 1
    )
)

echo 🔍 Checking Node.js dependencies...
if not exist "node_modules" (
    echo ⚠️  Node.js dependencies not found. Installing...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install Node.js dependencies
        pause
        exit /b 1
    )
)

echo.
echo 🚀 Starting services...

REM Start Python emotion recognition backend in background
echo 🐍 Starting Python emotion recognition service...
start /b python start_emotion_recognition.py

REM Wait a moment for Python service to start
timeout /t 3 /nobreak >nul

REM Start Node.js frontend
echo 🌐 Starting Node.js frontend server...
npm run dev

echo.
echo ✅ Services started successfully!
echo.
echo 📱 Frontend: http://localhost:3000
echo 🔗 Emotion Recognition: WebSocket on localhost:8765
echo.
echo Press any key to stop all services
echo ================================================================
pause
