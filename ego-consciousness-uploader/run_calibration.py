#!/usr/bin/env python3
"""
Main Orchestrator Script for Ego Calibration and Avatar Synthesis Pipeline

This script coordinates the emotion capture and avatar generation process:
1. Captures user's facial expressions for different emotions
2. Generates a base portrait from the neutral expression
3. Creates emotional variants of the avatar
4. Optionally generates videos for each emotion

Usage:
    python run_calibration.py

Requirements:
    - GEMINI_API_KEY environment variable set
    - FAL_KEY environment variable set (optional, for video generation)
    - Webcam access for emotion capture
"""

import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

# Import our custom modules
from emotion_recognizer import EmotionCapturer
from avatar_generator import AvatarGenerator

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s:%(name)s:%(message)s'
)
logger = logging.getLogger(__name__)


def check_requirements():
    """
    Check if all required API keys and dependencies are available.
    
    Returns:
        bool: True if all requirements are met, False otherwise
    """
    logger.info("Checking requirements...")
    
    # Check for Gemini API key
    gemini_key = os.getenv('GEMINI_API_KEY')
    if not gemini_key:
        logger.error("❌ GEMINI_API_KEY not found in environment variables")
        logger.error("Please add your API key to the .env file:")
        logger.error("GEMINI_API_KEY=your_api_key_here")
        logger.error("\nGet your API key from: https://makersuite.google.com/app/apikey")
        return False
    
    # Check for FAL API key (optional)
    fal_key = os.getenv('FAL_KEY')
    if not fal_key:
        logger.warning("⚠️  FAL_KEY not found in environment variables")
        logger.warning("Video generation will not work without FAL.AI API key.")
        logger.warning("Please add your FAL.AI API key to the .env file:")
        logger.warning("FAL_KEY=your_fal_api_key_here")
        logger.warning("\nGet your API key from: https://fal.ai/")
    else:
        logger.info("✓ FAL.AI API key found - video generation enabled")
    
    logger.info("✓ Gemini API key found")
    return True


def run_emotion_capture():
    """
    Run the emotion capture sequence.
    
    Returns:
        dict: Dictionary mapping emotion names to captured image file paths
    """
    logger.info("🎭 Starting emotion capture sequence...")
    print("\n" + "=" * 60)
    print("🎭 EMOTION CAPTURE CALIBRATION")
    print("=" * 60)
    print("This will guide you through capturing your facial expressions")
    print("for different emotions: neutral, happy, sad, and angry.")
    print("\nInstructions:")
    print("- Look directly at the camera")
    print("- Hold each expression steady for a few seconds")
    print("- Press 'q' to quit at any time")
    print("=" * 60)
    print()
    
    # Initialize the emotion capturer
    capturer = EmotionCapturer(output_dir='.', stability_frames=15)
    
    # Run the capture sequence
    captured_files = capturer.run_capture_sequence()
    
    # Display results
    print("\n" + "=" * 60)
    print("📸 CAPTURE RESULTS")
    print("=" * 60)
    if captured_files:
        print("✓ Successfully captured images:")
        for emotion, filepath in captured_files.items():
            print(f"  {emotion}: {filepath}")
        return captured_files
    else:
        print("❌ No images were captured.")
        return {}


def run_avatar_generation(captured_files):
    """
    Generate avatars from captured emotion images.
    
    Args:
        captured_files: Dictionary mapping emotion names to captured image paths
        
    Returns:
        dict: Dictionary mapping emotion names to generated avatar file paths
    """
    logger.info("🎨 Starting avatar generation...")
    print("\n" + "=" * 60)
    print("🎨 AVATAR GENERATION")
    print("=" * 60)
    
    # Get API keys
    gemini_key = os.getenv('GEMINI_API_KEY')
    fal_key = os.getenv('FAL_KEY')
    
    # Initialize the avatar generator
    generator = AvatarGenerator(gemini_key, fal_key)
    
    generated_avatars = {}
    
    # Check if we have the required neutral image
    if 'neutral' not in captured_files:
        logger.error("❌ Neutral emotion capture required for base portrait generation")
        return generated_avatars
    
    # Generate base portrait from neutral expression
    print(f"🎭 Generating base portrait from {captured_files['neutral']}...")
    base_portrait = generator.generate_base_portrait(captured_files['neutral'])
    
    if base_portrait:
        print(f"✓ Base portrait created: {base_portrait}")
        generated_avatars['neutral'] = base_portrait
        
        # Generate emotional variants
        for emotion, capture_path in captured_files.items():
            if emotion != 'neutral':
                print(f"\n😊 Generating {emotion} expression...")
                variant = generator.generate_expression_variant(
                    base_portrait, 
                    capture_path, 
                    emotion
                )
                if variant:
                    print(f"✓ {emotion} variant created: {variant}")
                    generated_avatars[emotion] = variant
                else:
                    print(f"✗ Failed to create {emotion} variant")
    else:
        print("✗ Failed to create base portrait")
    
    return generated_avatars


def run_video_generation(avatar_files):
    """
    Generate videos from avatar images (optional).
    
    Args:
        avatar_files: Dictionary mapping emotion names to avatar file paths
        
    Returns:
        dict: Dictionary mapping emotion names to generated video file paths
    """
    # Check if FAL.AI is available
    if not os.getenv('FAL_KEY'):
        logger.warning("⚠️  Skipping video generation - FAL_KEY not available")
        return {}
    
    logger.info("🎬 Starting video generation...")
    print("\n" + "=" * 60)
    print("🎬 VIDEO GENERATION")
    print("=" * 60)
    
    # Get API keys
    gemini_key = os.getenv('GEMINI_API_KEY')
    fal_key = os.getenv('FAL_KEY')
    
    # Initialize the avatar generator
    generator = AvatarGenerator(gemini_key, fal_key)
    
    # Generate videos for all avatars
    generated_videos = generator.generate_all_emotion_videos(avatar_files)
    
    return generated_videos


def main():
    """
    Main orchestrator function that runs the complete calibration pipeline.
    """
    print("🚀 EGO CONSCIOUSNESS CALIBRATION PIPELINE")
    print("=" * 60)
    print("This script will guide you through the complete process of")
    print("calibrating your digital ego avatar with emotional expressions.")
    print("=" * 60)
    
    # Check requirements
    if not check_requirements():
        logger.error("❌ Requirements not met. Please fix the issues above and try again.")
        return
    
    print("\n✅ All requirements met! Starting calibration process...")
    
    try:
        # Step 1: Emotion Capture
        print("\n" + "=" * 60)
        print("STEP 1: EMOTION CAPTURE")
        print("=" * 60)
        print("Starting Ego Calibration Process. Please look at the camera.")
        
        captured_files = run_emotion_capture()
        
        if not captured_files:
            logger.error("❌ Emotion capture failed. Cannot proceed with avatar generation.")
            return
        
        # Step 2: Avatar Generation
        print("\n" + "=" * 60)
        print("STEP 2: AVATAR GENERATION")
        print("=" * 60)
        
        generated_avatars = run_avatar_generation(captured_files)
        
        if not generated_avatars:
            logger.error("❌ Avatar generation failed.")
            return
        
        # Step 3: Video Generation (Optional)
        print("\n" + "=" * 60)
        print("STEP 3: VIDEO GENERATION (OPTIONAL)")
        print("=" * 60)
        
        generated_videos = run_video_generation(generated_avatars)
        
        # Final Summary
        print("\n" + "=" * 60)
        print("🎉 CALIBRATION COMPLETE!")
        print("=" * 60)
        print("Your Ego avatar has been generated successfully!")
        print()
        
        print("📊 SUMMARY:")
        print(f"   📸 Captured emotions: {len(captured_files)}")
        print(f"   🎨 Generated avatars: {len(generated_avatars)}")
        print(f"   🎬 Generated videos: {len(generated_videos)}")
        print()
        
        if generated_avatars:
            print("🎭 Generated Avatar Files:")
            for emotion, filepath in generated_avatars.items():
                print(f"   {emotion}: {filepath}")
            print()
        
        if generated_videos:
            print("🎬 Generated Video Files:")
            for emotion, filepath in generated_videos.items():
                print(f"   {emotion}: {filepath}")
            print()
        
        print("🎉 Calibration complete! Your Ego avatar has been generated.")
        print("You can now use these avatars in your applications!")
        
    except KeyboardInterrupt:
        logger.info("\n👋 Calibration interrupted by user")
    except Exception as e:
        logger.error(f"❌ Unexpected error during calibration: {e}")
        logger.error("Please check the error messages above and try again.")


if __name__ == "__main__":
    main()
