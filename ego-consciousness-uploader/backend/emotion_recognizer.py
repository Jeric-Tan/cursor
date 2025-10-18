"""
Real-time Emotion Recognition using DeepFace and OpenCV
"""

import asyncio
import websockets
import cv2
import json
import base64
import numpy as np
from deepface import DeepFace
import logging
import time
from typing import Dict, List, Optional

logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s:%(name)s:%(message)s'
)
logger = logging.getLogger(__name__)


class EmotionRecognizer:
    """Real-time emotion recognition using webcam and DeepFace."""
    
    def __init__(self, host='localhost', port=8765):
        """
        Initialize the emotion recognizer.
        
        Args:
            host: WebSocket server host
            port: WebSocket server port
        """
        self.host = host
        self.port = port
        self.camera = None
        self.is_running = False
        self.frame_count = 0
        self.process_every_n_frames = 5  # Process every 5th frame for performance
        self.last_emotions = []
        
    def initialize_camera(self) -> bool:
        """
        Initialize the webcam.
        
        Returns:
            True if camera initialized successfully, False otherwise
        """
        try:
            self.camera = cv2.VideoCapture(0)
            if not self.camera.isOpened():
                logger.error("Failed to open camera")
                return False
            
            # Set camera properties for better performance
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.camera.set(cv2.CAP_PROP_FPS, 30)
            
            logger.info("Camera initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error initializing camera: {e}")
            return False
    
    def release_camera(self):
        """Release the webcam."""
        if self.camera:
            self.camera.release()
            logger.info("Camera released")
    
    def detect_emotions(self, frame: np.ndarray) -> List[Dict]:
        """
        Detect emotions in a frame using DeepFace.
        
        Args:
            frame: OpenCV frame (BGR format)
            
        Returns:
            List of detected emotions with face locations
        """
        try:
            logger.debug("Starting emotion detection...")
            
            # Analyze the frame using DeepFace
            # DeepFace.analyze returns emotion analysis
            analysis = DeepFace.analyze(
                frame,
                actions=['emotion'],
                enforce_detection=False,  # Don't fail if no face detected
                detector_backend='opencv',  # Use opencv for speed
                silent=True  # Suppress DeepFace logs
            )
            
            logger.debug(f"DeepFace analysis completed: {type(analysis)}")
            
            # Handle both single face and multiple faces
            if not isinstance(analysis, list):
                analysis = [analysis]
            
            logger.info(f"DeepFace detected {len(analysis)} face(s)")
            
            emotions = []
            for face in analysis:
                # Extract emotion data
                emotion_dict = face.get('emotion', {})
                dominant_emotion = face.get('dominant_emotion', 'neutral')
                
                # Get face region
                region = face.get('region', {})
                
                # Convert numpy types to native Python types for JSON serialization
                emotion_dict_serializable = {k: float(v) if v is not None else 0.0 
                                            for k, v in emotion_dict.items()}
                region_serializable = {k: (int(v) if isinstance(v, (int, np.integer)) else float(v)) if v is not None else 0
                                      for k, v in region.items()}
                
                emotion_data = {
                    'dominant_emotion': str(dominant_emotion),
                    'emotion': emotion_dict_serializable,
                    'region': region_serializable,
                    'timestamp': float(time.time())
                }
                emotions.append(emotion_data)
            
            logger.info(f"Successfully processed {len(emotions)} emotion(s)")
            return emotions
            
        except ValueError as e:
            # Usually means no face detected
            logger.warning(f"No face detected: {e}")
            return []
        except Exception as e:
            # If no face detected or other error, return empty list
            logger.error(f"Emotion detection error: {e}", exc_info=True)
            return []
    
    def draw_emotions_on_frame(self, frame: np.ndarray, emotions: List[Dict]) -> np.ndarray:
        """
        Draw emotion labels and bounding boxes on frame.
        
        Args:
            frame: OpenCV frame
            emotions: List of detected emotions
            
        Returns:
            Annotated frame
        """
        annotated_frame = frame.copy()
        
        for emotion in emotions:
            try:
                # Get face region coordinates
                region = emotion.get('region', {})
                x = region.get('x', 0)
                y = region.get('y', 0)
                w = region.get('w', 0)
                h = region.get('h', 0)
                
                # Draw rectangle around face
                cv2.rectangle(
                    annotated_frame,
                    (x, y),
                    (x + w, y + h),
                    (0, 255, 0),  # Green color
                    2  # Thickness
                )
                
                # Get dominant emotion and confidence
                dominant = emotion.get('dominant_emotion', 'neutral')
                emotion_scores = emotion.get('emotion', {})
                confidence = emotion_scores.get(dominant, 0)
                
                # Draw emotion label above face
                label = f"{dominant}: {confidence:.1f}%"
                cv2.putText(
                    annotated_frame,
                    label,
                    (x, y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,  # Font scale
                    (0, 255, 0),  # Green color
                    2  # Thickness
                )
                
            except Exception as e:
                logger.debug(f"Error drawing emotion: {e}")
        
        return annotated_frame
    
    def frame_to_base64(self, frame: np.ndarray) -> str:
        """
        Convert OpenCV frame to base64 string.
        
        Args:
            frame: OpenCV frame
            
        Returns:
            Base64 encoded JPEG string
        """
        try:
            # Encode frame as JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            # Convert to base64
            base64_str = base64.b64encode(buffer).decode('utf-8')
            return base64_str
        except Exception as e:
            logger.error(f"Error encoding frame: {e}")
            return ""
    
    async def handle_client(self, websocket):
        """
        Handle WebSocket client connection.
        
        Args:
            websocket: WebSocket connection
        """
        logger.info("Client connected!")
        
        try:
            # Send welcome message
            welcome = {
                'type': 'connection',
                'message': 'Connected to emotion recognition service',
                'status': 'ready'
            }
            await websocket.send(json.dumps(welcome))
            
            # Keep sending frames while connected
            while self.is_running:
                try:
                    # Read frame from camera
                    ret, frame = self.camera.read()
                    if not ret:
                        logger.error("Failed to read frame from camera")
                        await asyncio.sleep(0.1)
                        continue
                    
                    self.frame_count += 1
                    
                    # Process emotions every N frames for performance
                    if self.frame_count % self.process_every_n_frames == 0:
                        # Detect emotions
                        emotions = self.detect_emotions(frame)
                        self.last_emotions = emotions
                        
                        # Draw emotions on frame
                        annotated_frame = self.draw_emotions_on_frame(frame, emotions)
                        
                        # Convert frame to base64
                        frame_base64 = self.frame_to_base64(annotated_frame)
                        
                        # Prepare data to send
                        data = {
                            'type': 'emotion_frame',
                            'frame': frame_base64,
                            'emotions': emotions,
                            'timestamp': time.time()
                        }
                        
                        # Send to client
                        await websocket.send(json.dumps(data))
                        if emotions:
                            logger.info(f"✓ Sent emotion data: {len(emotions)} face(s), dominant: {emotions[0]['dominant_emotion']}")
                        else:
                            logger.info("✗ Sent frame: No faces detected")
                    
                    # Small delay to control frame rate
                    await asyncio.sleep(0.033)  # ~30 FPS
                    
                except websockets.exceptions.ConnectionClosed:
                    logger.info("Client disconnected")
                    break
                except Exception as e:
                    logger.error(f"Error processing frame: {e}")
                    await asyncio.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Error in client handler: {e}")
        finally:
            logger.info("Client handler finished")
    
    async def run_realtime_detection(self):
        """
        Run the real-time emotion detection WebSocket server.
        """
        # Initialize camera
        if not self.initialize_camera():
            logger.error("Failed to initialize camera. Exiting.")
            return
        
        self.is_running = True
        
        try:
            # Start WebSocket server
            logger.info(f"Starting WebSocket server on {self.host}:{self.port}")
            
            async with websockets.serve(self.handle_client, self.host, self.port):
                logger.info("WebSocket server started!")
                logger.info("Waiting for client connections...")
                
                # Run forever
                await asyncio.Future()
                
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        except Exception as e:
            logger.error(f"Server error: {e}")
        finally:
            self.is_running = False
            self.release_camera()
            logger.info("Server stopped")


async def main():
    """Main function to run the emotion recognizer."""
    logger.info("🎭 Starting Real-Time Emotion Recognition")
    logger.info("=" * 50)
    
    try:
        recognizer = EmotionRecognizer(host='localhost', port=8765)
        await recognizer.run_realtime_detection()
    except Exception as e:
        logger.error(f"Fatal error: {e}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")

