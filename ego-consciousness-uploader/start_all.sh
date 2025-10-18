#!/bin/bash

# Ego Consciousness Uploader - Complete Startup Script
# This script starts both the Node.js frontend and Python emotion recognition backend

echo "🎭 Starting Ego Consciousness Uploader with Emotion Recognition"
echo "================================================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the ego-consciousness-uploader directory"
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $NODE_PID $PYTHON_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

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
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Python dependencies"
        exit 1
    fi
fi

# Check if Node.js dependencies are installed
echo "🔍 Checking Node.js dependencies..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  Node.js dependencies not found. Installing..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Node.js dependencies"
        exit 1
    fi
fi

echo ""
echo "🚀 Starting services..."

# Start Python emotion recognition backend in background
echo "🐍 Starting Python emotion recognition service..."
python start_emotion_recognition.py &
PYTHON_PID=$!

# Wait a moment for Python service to start
sleep 3

# Start Node.js frontend
echo "🌐 Starting Node.js frontend server..."
npm run dev &
NODE_PID=$!

echo ""
echo "✅ Services started successfully!"
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔗 Emotion Recognition: WebSocket on localhost:8765"
echo ""
echo "Press Ctrl+C to stop all services"
echo "================================================================"

# Wait for user to stop
wait
