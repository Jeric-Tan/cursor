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
        self.process_every_n_frames = 3  # Process every 3rd frame for smooth real-time performance
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
            # Standard resolution works great with MediaPipe's optimized detector
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
        Detect emotions in a frame using SSD for face detection and DeepFace for emotion analysis.
        SSD (Single Shot Detector) is optimized for real-time performance with excellent accuracy.
        
        Args:
            frame: OpenCV frame (BGR format)
            
        Returns:
            List of detected emotions with face locations
        """
        try:
            logger.debug("Starting face and emotion detection with SSD + DeepFace...")
            
            # Preprocess frame for better emotion detection
            # Convert to RGB (DeepFace expects RGB)
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Apply histogram equalization to normalize lighting
            # This helps detect subtle emotion differences
            frame_yuv = cv2.cvtColor(frame, cv2.COLOR_BGR2YUV)
            frame_yuv[:,:,0] = cv2.equalizeHist(frame_yuv[:,:,0])
            frame_enhanced = cv2.cvtColor(frame_yuv, cv2.COLOR_YUV2RGB)
            
            # Use DeepFace with SSD detector - specifically designed for real-time detection
            # enforce_detection=False allows graceful handling when no face is detected
            analysis = DeepFace.analyze(
                frame_enhanced,
                actions=['emotion'],
                enforce_detection=False,  # Gracefully handle when no face detected
                detector_backend='ssd',  # Single Shot Detector - fast & accurate
                silent=True,
                align=True  # Align faces for better emotion recognition
            )
            
            # Handle both single face and multiple faces
            if not isinstance(analysis, list):
                analysis = [analysis]
            
            logger.info(f"SSD detected {len(analysis)} face(s)")
            
            emotions = []
            for face_data in analysis:
                try:
                    # Extract emotion data
                    emotion_dict = face_data.get('emotion', {})
                    dominant_emotion = face_data.get('dominant_emotion', 'neutral')
                    region = face_data.get('region', {})
                    
                    # Get face coordinates
                    x = region.get('x', 0)
                    y = region.get('y', 0)
                    w = region.get('w', 0)
                    h = region.get('h', 0)
                    
                    # Skip if region is suspiciously large (>70% of frame)
                    # Stricter threshold since we're using enforce_detection=True
                    frame_height, frame_width = frame.shape[:2]
                    region_area = w * h
                    frame_area = frame_width * frame_height
                    if region_area > 0.7 * frame_area:
                        logger.warning(f"Skipping: face region too large ({w}x{h} vs {frame_width}x{frame_height})")
                        continue
                    
                    # Skip if region is too small (less nuanced emotion detection)
                    if w < 50 or h < 50:
                        logger.warning(f"Skipping: face region too small ({w}x{h})")
                        continue
                    
                    # Convert numpy types to native Python types for JSON serialization
                    emotion_dict_serializable = {k: float(v) if v is not None else 0.0 
                                                for k, v in emotion_dict.items()}
                    
                    region_serializable = {
                        'x': int(x),
                        'y': int(y),
                        'w': int(w),
                        'h': int(h)
                    }
                    
                    emotion_data = {
                        'dominant_emotion': str(dominant_emotion),
                        'emotion': emotion_dict_serializable,
                        'region': region_serializable,
                        'timestamp': float(time.time())
                    }
                    emotions.append(emotion_data)
                    
                except Exception as e:
                    logger.warning(f"Error processing face: {e}")
                    continue
            
            logger.info(f"Successfully processed {len(emotions)} emotion(s)")
            return emotions
            
        except Exception as e:
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
        
        logger.info(f"Drawing annotations for {len(emotions)} face(s)")
        
        for emotion in emotions:
            try:
                # Get face region coordinates
                region = emotion.get('region', {})
                x = region.get('x', 0)
                y = region.get('y', 0)
                w = region.get('w', 0)
                h = region.get('h', 0)
                
                logger.info(f"Drawing green box: x={x}, y={y}, w={w}, h={h}")
                
                # Draw green rectangle around face
                cv2.rectangle(
                    annotated_frame,
                    (x, y),
                    (x + w, y + h),
                    (0, 255, 0),  # Green color (BGR format)
                    3  # Thickness
                )
                
                # Get dominant emotion and confidence
                dominant = emotion.get('dominant_emotion', 'neutral')
                emotion_scores = emotion.get('emotion', {})
                confidence = emotion_scores.get(dominant, 0)
                
                # Draw emotion label above face (with background for better visibility)
                label = f"{dominant}: {confidence:.1f}%"
                
                # Get label size for background
                (label_width, label_height), baseline = cv2.getTextSize(
                    label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2
                )
                
                # Draw background rectangle for label
                cv2.rectangle(
                    annotated_frame,
                    (x, y - label_height - 10),
                    (x + label_width, y),
                    (0, 255, 0),  # Green background
                    -1  # Filled
                )
                
                # Draw label text
                cv2.putText(
                    annotated_frame,
                    label,
                    (x, y - 5),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,  # Font scale
                    (0, 0, 0),  # Black text for contrast
                    2  # Thickness
                )
                
            except Exception as e:
                logger.error(f"Error drawing annotation for face: {e}", exc_info=True)
        
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
            # Encode frame as JPEG with good quality for clear video
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
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

