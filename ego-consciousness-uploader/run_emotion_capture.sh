#!/bin/bash

# Emotion Capture Script
# Runs the guided emotion capture calibration sequence

echo "🎭 Emotion Capture Calibration"
echo "================================"
echo ""

# Get the script directory and navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/.."

cd "$PROJECT_ROOT"

# Activate virtual environment
if [ -f "venv/bin/activate" ]; then
    echo "✓ Activating virtual environment..."
    source venv/bin/activate
else
    echo "⚠️  Warning: Virtual environment not found"
    echo "   Please run scripts/setup_venv.sh first"
    exit 1
fi

# Check if required packages are installed
if ! python -c "import cv2" 2>/dev/null; then
    echo "⚠️  opencv-python not found. Installing dependencies..."
    pip install -r requirements.txt
fi

if ! python -c "import deepface" 2>/dev/null; then
    echo "⚠️  deepface not found. Installing dependencies..."
    pip install -r requirements.txt
fi

# Run the emotion capture
echo ""
echo "Starting emotion capture sequence..."
echo "Press 'q' to quit at any time"
echo ""

python backend/emotion_recognizer.py capture

echo ""
echo "Done!"

