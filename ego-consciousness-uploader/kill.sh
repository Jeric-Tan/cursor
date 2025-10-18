#!/bin/bash
chmod +x start.sh kill.sh
# Kill Node.js server
pkill -f "node server.js"

# Kill Python emotion recognition
pkill -f "start_emotion_recognition.py"

echo "All processes killed!"
