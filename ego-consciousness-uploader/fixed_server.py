#!/usr/bin/env python3
"""
Fixed WebSocket server - correct function signature.
"""

import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def handle_client(websocket):
    """Handle WebSocket client connections - FIXED: removed path parameter."""
    logger.info("Client connected!")
    
    try:
        # Send welcome message
        welcome = {
            'type': 'connection',
            'message': 'Connected to emotion recognition service',
            'status': 'ready'
        }
        await websocket.send(json.dumps(welcome))
        logger.info("Sent welcome message")
        
        # Send test emotion data
        test_emotion = {
            'type': 'emotion_frame',
            'frame': '',  # Empty for now
            'emotions': [{
                'dominant_emotion': 'happy',
                'emotion': {'happy': 0.8, 'sad': 0.1, 'angry': 0.1}
            }],
            'timestamp': 0
        }
        
        await websocket.send(json.dumps(test_emotion))
        logger.info("Sent test emotion data")
        
        # Keep connection alive
        await websocket.wait_closed()
        
    except websockets.exceptions.ConnectionClosed:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Error: {e}")
    finally:
        logger.info("Client disconnected")

async def main():
    """Start WebSocket server."""
    logger.info("Starting WebSocket server on localhost:8765")
    
    # FIXED: Use the correct WebSocket server setup
    start_server = websockets.serve(handle_client, "localhost", 8765)
    
    async with start_server:
        logger.info("WebSocket server started!")
        logger.info("Open test-emotion.html in your browser")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    print("🎭 Fixed WebSocket Server")
    print("=" * 40)
    print("🔗 WebSocket server on localhost:8765")
    print("🌐 Open test-emotion.html in your browser")
    print("Press Ctrl+C to stop")
    print("-" * 40)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
