#!/bin/bash
# Simple script to start emotion recognition with venv

cd "$(dirname "$0")"
source venv/bin/activate
python3 start_emotion_recognition.py

