# Emotion Capture Guide 🎭

## Overview

The **EmotionCapturer** module provides a guided calibration sequence that captures high-quality facial images for specific emotions. This is useful for user calibration, training data collection, and emotion recognition personalization.

## Features

✨ **Guided User Interface**: Clear on-screen instructions for each emotion  
🎯 **Stability Checking**: Requires consistent detection over multiple frames to ensure deliberate expressions  
📸 **High-Quality Capture**: Saves face ROI as PNG images with proper padding  
📊 **Progress Tracking**: Real-time progress bar and emotion counter  
🎨 **Visual Feedback**: Color-coded bounding boxes (green for target emotion, yellow for others)  
⏱️ **Automatic Sequencing**: Smoothly transitions between emotions with cooldown periods

## Quick Start

### Option 1: Using the Test Script (Recommended)

```bash
# Run the standalone test script
python test_emotion_capture.py

# Or using the shell script
./scripts/run_emotion_capture.sh
```

### Option 2: Using the Main Module

```bash
# Run with the 'capture' argument
python backend/emotion_recognizer.py capture
```

### Option 3: Programmatic Usage

```python
from backend.emotion_recognizer import EmotionCapturer

# Create capturer instance
capturer = EmotionCapturer(
    output_dir='./captured_faces',  # Where to save images
    stability_frames=15              # Frames needed for stable detection
)

# Run the capture sequence
captured_files = capturer.run_capture_sequence()

# Process results
for emotion, filepath in captured_files.items():
    print(f"Captured {emotion}: {filepath}")
```

## Target Emotions

The capture sequence targets these emotions in order:

1. **Neutral** - Relaxed, no expression
2. **Happy** - Smile, positive expression
3. **Sad** - Downturned mouth, lowered eyebrows
4. **Angry** - Furrowed brows, tense expression

## How It Works

### Stability Detection

The module uses a **15-frame stability check** by default. This means:

- An emotion must be detected consistently for 15 consecutive frames before capture
- This prevents capturing fleeting or unclear expressions
- Ensures high-quality, deliberate expressions
- You can adjust this with the `stability_frames` parameter

### Capture Process

For each emotion:

1. **Display Instructions**: Shows clear guidance on screen
2. **Detect Face**: Uses DeepFace with SSD detector
3. **Check Emotion**: Compares detected emotion to target
4. **Track Stability**: Counts consecutive matching frames
5. **Capture Image**: Saves face ROI when threshold is met
6. **Show Feedback**: Displays success message and next emotion
7. **Cooldown Period**: 2-second pause before next emotion

### Visual Feedback

- **White Text**: Instructions and current target emotion
- **Green Box**: Face detected with correct emotion
- **Yellow Box**: Face detected with different emotion
- **Progress Bar**: Stability check progress (0-15 frames)
- **Bottom Counter**: Overall progress (e.g., "Progress: 2/4")

## Output Files

Images are saved with the following format:

```
capture_neutral.png
capture_happy.png
capture_sad.png
capture_angry.png
```

Each file contains:
- Face region of interest (ROI)
- 10% padding around the face for context
- High-quality PNG format (compression level 3)
- Original resolution from the webcam

## API Reference

### EmotionCapturer Class

#### Constructor

```python
EmotionCapturer(output_dir='.', stability_frames=15)
```

**Parameters:**
- `output_dir` (str): Directory to save captured images (default: current directory)
- `stability_frames` (int): Number of consecutive frames required for stable detection (default: 15)

#### Methods

##### `run_capture_sequence() -> Dict[str, str]`

Runs the guided emotion capture sequence.

**Returns:**
- Dictionary mapping emotion names to saved file paths
- Example: `{'neutral': 'capture_neutral.png', 'happy': 'capture_happy.png', ...}`

**Behavior:**
- Opens webcam and displays OpenCV window
- Guides user through each emotion in sequence
- Saves captured images to `output_dir`
- Automatically closes camera and windows when complete
- Press 'q' to quit at any time

##### `initialize_camera() -> bool`

Initializes the webcam for capture.

**Returns:**
- `True` if camera initialized successfully
- `False` if initialization failed

##### `release_camera()`

Releases the webcam and closes all OpenCV windows.

##### `detect_emotion_in_frame(frame) -> Optional[Dict]`

Detects the dominant emotion in a single frame.

**Parameters:**
- `frame`: OpenCV frame (BGR format)

**Returns:**
- Dictionary with emotion data and face region, or `None` if no face detected
- Format: `{'dominant_emotion': str, 'emotion_scores': dict, 'region': dict}`

##### `save_face_image(frame, region, emotion) -> str`

Saves the face ROI as a PNG image.

**Parameters:**
- `frame`: Full frame containing the face
- `region`: Face region dictionary with x, y, w, h
- `emotion`: Emotion label for filename

**Returns:**
- File path of saved image, or `None` if save failed

## Tips for Best Results

### Lighting
- ✅ Face a window or light source
- ✅ Use even, diffused lighting
- ❌ Avoid backlighting (light behind you)
- ❌ Avoid harsh shadows on your face

### Camera Position
- ✅ Position camera at eye level
- ✅ Center your face in the frame
- ✅ Maintain 2-3 feet distance from camera
- ❌ Avoid extreme angles or distances

### Expressions
- ✅ Make clear, deliberate expressions
- ✅ Hold the expression steady
- ✅ Look directly at the camera
- ❌ Don't make subtle or fleeting expressions

### Environment
- ✅ Use a clean, uncluttered background
- ✅ Stay relatively still during capture
- ❌ Avoid multiple people in frame

## Troubleshooting

### Camera Not Opening
```
ERROR:__main__:Failed to open camera
```
**Solutions:**
- Check camera permissions in system settings
- Ensure no other application is using the camera
- Try unplugging and replugging external cameras
- Restart the application

### No Face Detected
```
Stability: 0/15
```
**Solutions:**
- Move closer to the camera
- Improve lighting conditions
- Ensure face is fully visible and centered
- Remove obstructions (hair, glasses, etc.)

### Wrong Emotion Detected
```
Yellow bounding box instead of green
```
**Solutions:**
- Make a more exaggerated expression
- Hold the expression longer and steadier
- Try different facial muscle movements
- Ensure good lighting on your face

### Images Not Saving
```
ERROR:__main__:Error saving face image
```
**Solutions:**
- Check write permissions in output directory
- Ensure output directory exists
- Check available disk space
- Verify opencv-python is installed correctly

## Technical Details

### Dependencies
- **OpenCV** (cv2): Camera capture and image processing
- **DeepFace**: Facial emotion recognition
- **NumPy**: Array operations
- **SSD Detector**: Fast, accurate face detection

### Performance
- Camera Resolution: 640x480 @ 30 FPS
- Processing: Real-time (~30 FPS)
- Detection Backend: SSD (Single Shot Detector)
- Stability Check: 15 frames (~0.5 seconds at 30 FPS)

### Image Processing Pipeline
1. Frame capture from webcam
2. BGR to RGB conversion
3. Histogram equalization (YUV color space)
4. DeepFace analysis with SSD detector
5. Face region extraction with padding
6. PNG compression and save

## Advanced Usage

### Custom Emotions

You can modify the target emotions by editing the class:

```python
capturer = EmotionCapturer()
capturer.target_emotions = ['neutral', 'happy', 'surprise']
captured_files = capturer.run_capture_sequence()
```

### Adjust Stability Threshold

For faster capture (less stable):
```python
capturer = EmotionCapturer(stability_frames=10)
```

For more stable capture (slower):
```python
capturer = EmotionCapturer(stability_frames=25)
```

### Custom Output Directory

```python
import os

# Create directory if it doesn't exist
output_dir = './calibration_data/user_123'
os.makedirs(output_dir, exist_ok=True)

capturer = EmotionCapturer(output_dir=output_dir)
captured_files = capturer.run_capture_sequence()
```

### Integration Example

```python
from backend.emotion_recognizer import EmotionCapturer
import json

def calibrate_user(user_id: str) -> dict:
    """Calibrate emotion recognition for a specific user."""
    
    # Create user-specific directory
    output_dir = f'./calibration/{user_id}'
    os.makedirs(output_dir, exist_ok=True)
    
    # Run capture
    capturer = EmotionCapturer(output_dir=output_dir, stability_frames=15)
    captured_files = capturer.run_capture_sequence()
    
    # Save metadata
    metadata = {
        'user_id': user_id,
        'captured_emotions': list(captured_files.keys()),
        'file_paths': captured_files,
        'timestamp': time.time()
    }
    
    with open(f'{output_dir}/metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    
    return metadata

# Usage
metadata = calibrate_user('user_12345')
print(f"Calibrated {len(metadata['captured_emotions'])} emotions")
```

## License

This module is part of the ego-consciousness-uploader project.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Ensure all dependencies are installed: `pip install -r requirements.txt`
3. Verify camera permissions in system settings
4. Check project README for additional setup instructions

