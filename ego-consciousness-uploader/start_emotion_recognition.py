#!/usr/bin/env python3
"""
Startup script for the emotion recognition service.
This script starts the Python emotion recognition backend.
"""

import asyncio
import sys
import os
import subprocess
import signal
import time

# Add the backend directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.emotion_recognizer import EmotionRecognizer

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully."""
    print('\nShutting down emotion recognition service...')
    sys.exit(0)

def check_dependencies():
    """Check if required dependencies are installed."""
    try:
        import cv2
        import deepface
        import numpy
        import websockets
        print("✓ All dependencies are installed")
        return True
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        print("Please install dependencies with: pip install -r requirements.txt")
        return False

async def main():
    """Main function to start the emotion recognition service."""
    print("🎭 Starting Ego Emotion Recognition Service")
    print("=" * 50)
    
    # Check dependencies
    if not check_dependencies():
        return
    
    # Set up signal handler for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        # Create and run emotion recognizer
        recognizer = EmotionRecognizer()
        print("📹 Initializing camera...")
        print("🔗 Starting WebSocket server on localhost:8765")
        print("🎯 Emotion recognition is now active!")
        print("\nPress Ctrl+C to stop the service")
        print("-" * 50)
        
        await recognizer.run_realtime_detection()
        
    except KeyboardInterrupt:
        print("\n🛑 Service stopped by user")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        print("🧹 Cleaning up...")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
