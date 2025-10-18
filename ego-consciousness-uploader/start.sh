#!/bin/bash
chmod +x start.sh kill.sh
# Start Node.js server in background


# Start Python emotion recognition in background
source venv/bin/activate && python3 start_emotion_recognition.py &

echo "Both processes started!"
echo "Node.js server: http://localhost:3001"
echo "Emotion recognition: Running on port 8080"

npm run dev 