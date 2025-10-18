#!/bin/bash
# Clean up port 8765 before starting emotion recognition

echo "🧹 Cleaning up port 8765..."

# Kill any processes on port 8765
lsof -ti:8765 | xargs kill -9 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Port 8765 cleaned up"
else
    echo "ℹ️  No processes found on port 8765"
fi

echo "🚀 Starting emotion recognition service..."
source venv/bin/activate
python3 start_emotion_recognition.py
