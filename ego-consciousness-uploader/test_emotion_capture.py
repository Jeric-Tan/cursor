#!/usr/bin/env python3
"""
Standalone test script for EmotionCapturer class.
Demonstrates how to use the emotion capture module.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from emotion_recognizer import EmotionCapturer
except ImportError as e:
    print(f"Error importing EmotionCapturer: {e}")
    print("\nTroubleshooting:")
    print("1. Make sure you're in the project directory")
    print("2. Activate the virtual environment: source venv/bin/activate")
    print("3. Install dependencies: pip install -r requirements.txt")
    print("4. Try running: python test_emotion_capture.py")
    sys.exit(1)


def main():
    """Run the emotion capture test."""
    print("🎭 Emotion Capture Calibration Test")
    print("=" * 60)
    print("This will guide you through capturing your facial expressions")
    print("for different emotions: neutral, happy, sad, and angry.")
    print("\n📋 Instructions:")
    print("  • Look directly at the camera")
    print("  • Hold each expression steady until the progress bar fills")
    print("  • The bounding box will turn GREEN when correct emotion is detected")
    print("  • Press 'q' to quit at any time")
    print("\n💡 Tips:")
    print("  • Find good lighting - face the light source")
    print("  • Stay centered in the camera frame")
    print("  • Make clear, deliberate expressions")
    print("=" * 60)
    print()
    
    try:
        input("Press ENTER to start...")
    except EOFError:
        print("Running in non-interactive mode, starting immediately...")
    print()
    
    # Create capturer instance
    # You can customize the output directory and stability frames:
    # - output_dir: where to save the images (default: current directory)
    # - stability_frames: how many consecutive frames needed (default: 15)
    capturer = EmotionCapturer(output_dir='.', stability_frames=15)
    
    # Run the capture sequence
    print("Starting capture sequence...\n")
    captured_files = capturer.run_capture_sequence()
    
    # Display results
    print("\n" + "=" * 60)
    print("🎉 Capture Complete!")
    print("=" * 60)
    
    if captured_files:
        print("\n✓ Successfully captured images:")
        for emotion, filepath in captured_files.items():
            file_size = os.path.getsize(filepath) / 1024  # KB
            print(f"  • {emotion.upper():8s}: {filepath} ({file_size:.1f} KB)")
        
        print(f"\n📁 Total files captured: {len(captured_files)}/4")
        
        if len(captured_files) == 4:
            print("\n🌟 Perfect! All emotions captured successfully!")
        else:
            missing = set(['neutral', 'happy', 'sad', 'angry']) - set(captured_files.keys())
            print(f"\n⚠️  Missing emotions: {', '.join(missing)}")
            print("   You can run the script again to capture missing emotions.")
    else:
        print("\n❌ No images were captured.")
        print("   Please try again and make sure your camera is working.")
    
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        print("👋 Goodbye!")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

