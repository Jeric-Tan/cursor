"""
Real-time Emotion Recognition using DeepFace and OpenCV
"""

import asyncio
import cv2
import json
import base64
import numpy as np
from deepface import DeepFace
import logging
import time
from typing import Dict, List, Optional

# Optional websockets import for real-time detection
try:
    import websockets
    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False
    websockets = None

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
            # Start WebSocket server with port reuse
            logger.info(f"Starting WebSocket server on {self.host}:{self.port}")
            
            # Create server with reuse port option
            start_server = websockets.serve(
                self.handle_client, 
                self.host, 
                self.port,
                reuse_port=True  # Allow port reuse
            )
            
            server = await start_server
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


class EmotionCapturer:
    """
    Guided emotion capture module for user calibration.
    Captures high-quality face images for specific emotions with stability checking.
    """
    
    def __init__(self, output_dir: str = '.', stability_frames: int = 15):
        """
        Initialize the emotion capturer.
        
        Args:
            output_dir: Directory to save captured images
            stability_frames: Number of consecutive frames needed to confirm emotion (default: 15)
        """
        self.output_dir = output_dir
        self.stability_frames = stability_frames
        self.camera = None
        
        # Target emotions for calibration sequence
        self.target_emotions = ['neutral', 'happy', 'sad', 'angry']
        
        # Tracking variables
        self.current_emotion_index = 0
        self.consecutive_detections = 0
        self.last_detected_emotion = None
        self.captured_images = {}
        
        logger.info(f"EmotionCapturer initialized with {stability_frames} frame stability check")
    
    def initialize_camera(self) -> bool:
        """
        Initialize the webcam for capture.
        
        Returns:
            True if camera initialized successfully, False otherwise
        """
        try:
            self.camera = cv2.VideoCapture(0)
            if not self.camera.isOpened():
                logger.error("Failed to open camera")
                return False
            
            # Set camera properties for high-quality capture
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.camera.set(cv2.CAP_PROP_FPS, 30)
            
            logger.info("Camera initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error initializing camera: {e}")
            return False
    
    def release_camera(self):
        """Release the webcam and close all windows."""
        if self.camera:
            self.camera.release()
        cv2.destroyAllWindows()
        logger.info("Camera released and windows closed")
    
    def detect_emotion_in_frame(self, frame: np.ndarray) -> Optional[Dict]:
        """
        Detect the dominant emotion in a single frame.
        
        Args:
            frame: OpenCV frame (BGR format)
            
        Returns:
            Dictionary with emotion data and face region, or None if no face detected
        """
        try:
            # Convert to RGB for DeepFace
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Apply histogram equalization for better detection
            frame_yuv = cv2.cvtColor(frame, cv2.COLOR_BGR2YUV)
            frame_yuv[:,:,0] = cv2.equalizeHist(frame_yuv[:,:,0])
            frame_enhanced = cv2.cvtColor(frame_yuv, cv2.COLOR_YUV2RGB)
            
            # Use DeepFace with SSD detector
            analysis = DeepFace.analyze(
                frame_enhanced,
                actions=['emotion'],
                enforce_detection=False,
                detector_backend='ssd',
                silent=True,
                align=True
            )
            
            # Handle both single and multiple faces (take first face if multiple)
            if not isinstance(analysis, list):
                analysis = [analysis]
            
            if len(analysis) == 0:
                return None
            
            face_data = analysis[0]  # Take first detected face
            
            # Extract emotion data
            emotion_dict = face_data.get('emotion', {})
            dominant_emotion = face_data.get('dominant_emotion', 'neutral')
            region = face_data.get('region', {})
            
            # Get face coordinates
            x = region.get('x', 0)
            y = region.get('y', 0)
            w = region.get('w', 0)
            h = region.get('h', 0)
            
            # Validate region size
            if w < 50 or h < 50:
                logger.warning(f"Face region too small: {w}x{h}")
                return None
            
            return {
                'dominant_emotion': dominant_emotion,
                'emotion_scores': emotion_dict,
                'region': {'x': x, 'y': y, 'w': w, 'h': h}
            }
            
        except Exception as e:
            logger.debug(f"Detection error: {e}")
            return None
    
    def draw_instructions(self, frame: np.ndarray, target_emotion: str, 
                         stability_progress: int, is_captured: bool = False) -> np.ndarray:
        """
        Draw user instructions and progress on the frame.
        
        Args:
            frame: OpenCV frame to draw on
            target_emotion: Current target emotion
            stability_progress: Number of consecutive frames detected
            is_captured: Whether the emotion was just captured
            
        Returns:
            Annotated frame
        """
        annotated = frame.copy()
        height, width = annotated.shape[:2]
        
        # Create semi-transparent overlay for text background
        overlay = annotated.copy()
        
        if is_captured:
            # Success message
            instruction = f"Great! {target_emotion.upper()} captured!"
            next_idx = self.current_emotion_index + 1
            if next_idx < len(self.target_emotions):
                next_emotion = self.target_emotions[next_idx]
                instruction += f" Next: {next_emotion.upper()}"
            else:
                instruction += " All done!"
            
            color = (0, 255, 0)  # Green
        else:
            # Instruction message
            instruction = f"Please show a {target_emotion.upper()} expression."
            sub_instruction = "Look directly at the camera..."
            color = (255, 255, 255)  # White
        
        # Draw instruction text background
        cv2.rectangle(overlay, (0, 0), (width, 120), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.7, annotated, 0.3, 0, annotated)
        
        # Draw main instruction
        cv2.putText(
            annotated,
            instruction,
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            color,
            2
        )
        
        # Draw sub-instruction (if not captured)
        if not is_captured:
            cv2.putText(
                annotated,
                sub_instruction,
                (20, 75),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (200, 200, 200),
                1
            )
        
        # Draw stability progress bar
        progress_text = f"Stability: {stability_progress}/{self.stability_frames}"
        cv2.putText(
            annotated,
            progress_text,
            (20, 105),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 0),
            1
        )
        
        # Draw progress bar
        bar_width = int((stability_progress / self.stability_frames) * (width - 40))
        cv2.rectangle(annotated, (20, 110), (20 + bar_width, 115), (0, 255, 0), -1)
        cv2.rectangle(annotated, (20, 110), (width - 20, 115), (255, 255, 255), 1)
        
        # Draw progress summary at bottom
        progress = f"Progress: {len(self.captured_images)}/{len(self.target_emotions)}"
        cv2.rectangle(overlay, (0, height - 40), (width, height), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.7, annotated, 0.3, 0, annotated)
        cv2.putText(
            annotated,
            progress,
            (20, height - 15),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            1
        )
        
        return annotated
    
    def draw_face_box(self, frame: np.ndarray, region: Dict, 
                     is_target: bool = False) -> np.ndarray:
        """
        Draw bounding box around detected face.
        
        Args:
            frame: OpenCV frame
            region: Face region dictionary with x, y, w, h
            is_target: Whether this is the target emotion (green) or not (yellow)
            
        Returns:
            Frame with bounding box
        """
        x = region['x']
        y = region['y']
        w = region['w']
        h = region['h']
        
        # Choose color based on whether it's the target emotion
        color = (0, 255, 0) if is_target else (0, 255, 255)  # Green or Yellow
        
        # Draw rectangle
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
        
        return frame
    
    def save_face_image(self, frame: np.ndarray, region: Dict, emotion: str) -> str:
        """
        Save the face ROI as a PNG image.
        
        Args:
            frame: Full frame containing the face
            region: Face region dictionary with x, y, w, h
            emotion: Emotion label for filename
            
        Returns:
            File path of saved image
        """
        try:
            # Extract face ROI
            x = region['x']
            y = region['y']
            w = region['w']
            h = region['h']
            
            # Add padding around face for better context (10% on each side)
            padding = int(max(w, h) * 0.1)
            x_padded = max(0, x - padding)
            y_padded = max(0, y - padding)
            w_padded = min(frame.shape[1] - x_padded, w + 2 * padding)
            h_padded = min(frame.shape[0] - y_padded, h + 2 * padding)
            
            face_roi = frame[y_padded:y_padded + h_padded, x_padded:x_padded + w_padded]
            
            # Generate filename
            filename = f"capture_{emotion}.png"
            filepath = f"{self.output_dir}/{filename}"
            
            # Save as high-quality PNG
            cv2.imwrite(filepath, face_roi, [cv2.IMWRITE_PNG_COMPRESSION, 3])
            
            logger.info(f"Saved {emotion} face image to {filepath}")
            return filepath
            
        except Exception as e:
            logger.error(f"Error saving face image: {e}")
            return None
    
    def run_capture_sequence(self) -> Dict[str, str]:
        """
        Run the guided emotion capture sequence.
        
        Returns:
            Dictionary mapping emotion names to saved file paths
            Example: {'neutral': 'capture_neutral.png', 'happy': 'capture_happy.png', ...}
        """
        logger.info("Starting emotion capture sequence")
        
        # Initialize camera
        if not self.initialize_camera():
            logger.error("Failed to initialize camera")
            return {}
        
        try:
            capture_cooldown = 0  # Frames to wait after capture before continuing
            
            while self.current_emotion_index < len(self.target_emotions):
                # Read frame
                ret, frame = self.camera.read()
                if not ret:
                    logger.error("Failed to read frame")
                    continue
                
                target_emotion = self.target_emotions[self.current_emotion_index]
                
                # Handle cooldown after capture
                if capture_cooldown > 0:
                    capture_cooldown -= 1
                    annotated = self.draw_instructions(frame, target_emotion, 0, is_captured=True)
                    cv2.imshow('Emotion Capture', annotated)
                    
                    if capture_cooldown == 0:
                        # Move to next emotion
                        self.current_emotion_index += 1
                        self.consecutive_detections = 0
                        self.last_detected_emotion = None
                    
                    # Wait for key press
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        logger.info("User quit the sequence")
                        break
                    
                    continue
                
                # Detect emotion in current frame
                emotion_data = self.detect_emotion_in_frame(frame)
                
                if emotion_data:
                    detected_emotion = emotion_data['dominant_emotion']
                    region = emotion_data['region']
                    
                    # Check if detected emotion matches target
                    if detected_emotion == target_emotion:
                        self.consecutive_detections += 1
                        is_target = True
                    else:
                        # Reset if different emotion detected
                        self.consecutive_detections = 0
                        is_target = False
                    
                    self.last_detected_emotion = detected_emotion
                    
                    # Draw face box
                    frame = self.draw_face_box(frame, region, is_target)
                    
                    # Check if we've reached stability threshold
                    if self.consecutive_detections >= self.stability_frames:
                        # Capture the face!
                        filepath = self.save_face_image(frame, region, target_emotion)
                        if filepath:
                            self.captured_images[target_emotion] = filepath
                            logger.info(f"✓ Captured {target_emotion} emotion")
                            
                            # Set cooldown (show success message for ~2 seconds)
                            capture_cooldown = 60
                            
                            # Draw capture confirmation
                            annotated = self.draw_instructions(
                                frame, target_emotion, 
                                self.consecutive_detections, 
                                is_captured=True
                            )
                        else:
                            # Reset if save failed
                            self.consecutive_detections = 0
                    else:
                        # Still stabilizing
                        annotated = self.draw_instructions(
                            frame, target_emotion, 
                            self.consecutive_detections
                        )
                else:
                    # No face detected, reset
                    self.consecutive_detections = 0
                    annotated = self.draw_instructions(frame, target_emotion, 0)
                
                # Display frame
                cv2.imshow('Emotion Capture', annotated)
                
                # Check for quit key
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    logger.info("User quit the sequence")
                    break
            
            logger.info("Capture sequence completed")
            return self.captured_images
            
        except Exception as e:
            logger.error(f"Error during capture sequence: {e}", exc_info=True)
            return self.captured_images
            
        finally:
            self.release_camera()


if __name__ == "__main__":
    # Check if we're running in capture mode
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'capture':
        # Run emotion capture mode
        print("🎭 Emotion Capture Calibration")
        print("=" * 50)
        print("This will guide you through capturing your facial expressions")
        print("for different emotions: neutral, happy, sad, and angry.")
        print("\nInstructions:")
        print("- Look directly at the camera")
        print("- Hold each expression steady for a few seconds")
        print("- Press 'q' to quit at any time")
        print("=" * 50)
        print()
        
        # Create capturer instance
        capturer = EmotionCapturer(output_dir='.', stability_frames=15)
        
        # Run the capture sequence
        captured_files = capturer.run_capture_sequence()
        
        # Display results
        print("\n" + "=" * 50)
        print("Capture Complete!")
        print("=" * 50)
        if captured_files:
            print("\nCaptured images:")
            for emotion, filepath in captured_files.items():
                print(f"  {emotion}: {filepath}")
        else:
            print("\nNo images were captured.")
        print()
    else:
        # Run normal real-time emotion recognition mode
        if not WEBSOCKETS_AVAILABLE:
            print("❌ Error: websockets module not available")
            print("Please install it with: pip install websockets")
            print("\nAlternatively, run emotion capture mode:")
            print("python backend/emotion_recognizer.py capture")
            sys.exit(1)
        
        try:
            asyncio.run(main())
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")

