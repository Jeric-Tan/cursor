#!/bin/bash

# Test script for emotion recognition only
echo "🎭 Starting Emotion Recognition Test"
echo "===================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "⚠️  Virtual environment not found. Creating..."
    ./setup_venv.sh
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create virtual environment"
        exit 1
    fi
fi

# Activate virtual environment
echo "🔍 Activating Python virtual environment..."
source venv/bin/activate

# Check if Python dependencies are installed
echo "🔍 Checking Python dependencies..."
if ! python -c "import cv2, deepface, numpy, websockets" 2>/dev/null; then
    echo "⚠️  Python dependencies not found. Installing..."
    pip install opencv-python deepface numpy websockets tf-keras
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Python dependencies"
        exit 1
    fi
fi

echo ""
echo "🚀 Starting Python emotion recognition backend..."
echo "📱 Open test-emotion.html in your browser to test the frontend"
echo ""
echo "Press Ctrl+C to stop the service"
echo "===================================="

# Start Python emotion recognition backend (REAL DETECTION)
python start_emotion_recognition.py
