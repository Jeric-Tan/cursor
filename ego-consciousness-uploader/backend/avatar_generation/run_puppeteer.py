#!/usr/bin/env python3
"""
Run Avatar Puppeteer
Generates stop-motion variations from existing avatar images
"""

import os
import sys
from pathlib import Path

# Add the current directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from avatar_puppeteer import AvatarPuppeteer

def main():
    """
    Run the avatar puppeteer on existing avatar images.
    """
    print("🎭 Avatar Puppeteer")
    print("=" * 50)
    
    # Get API key from environment variables
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    
    if not GEMINI_API_KEY:
        print("❌ Error: GEMINI_API_KEY not found in environment variables")
        print("Please add your API key to the .env file in the current directory:")
        print("GEMINI_API_KEY=your_api_key_here")
        print("\nGet your API key from: https://makersuite.google.com/app/apikey")
        return
    
    # Initialize the puppeteer
    puppeteer = AvatarPuppeteer(GEMINI_API_KEY)
    
    # Check if we have generated avatar images
    avatar_files = {
        'neutral': 'avatar_base_neutral.png',
        'happy': 'avatar_happy.png',
        'sad': 'avatar_sad.png',
        'angry': 'avatar_angry.png'
    }
    
    # Check which files exist
    available_avatars = {}
    for emotion, filename in avatar_files.items():
        if os.path.exists(filename):
            available_avatars[emotion] = filename
            print(f"✓ Found {emotion} avatar: {filename}")
        else:
            print(f"✗ Missing {emotion} avatar: {filename}")
    
    if not available_avatars:
        print("\n❌ No avatar images found!")
        print("Please run the avatar generator first:")
        print("python avatar_generator.py")
        return
    
    # Ask user for number of variations
    try:
        num_variations = input("\nHow many variations per emotion? (default: 10): ").strip()
        if not num_variations:
            num_variations = 10
        else:
            num_variations = int(num_variations)
    except ValueError:
        print("Invalid input, using default of 10 variations")
        num_variations = 10
    
    # Generate stop-motion variations
    print(f"\n🎬 Generating {num_variations} stop-motion variations per emotion...")
    variations = puppeteer.generate_all_emotion_variations(
        available_avatars, 
        num_variations=num_variations,
        output_dir="stop_motion"
    )
    
    if variations:
        print(f"\n🎉 Stop-motion generation completed!")
        total_frames = sum(len(frames) for frames in variations.values())
        print(f"   Generated {total_frames} animation frames")
        print(f"   Check the 'stop_motion' folder for your animation frames.")
        
        # Show file structure
        print(f"\n📁 Generated files:")
        for emotion, frames in variations.items():
            print(f"   {emotion}/: {len(frames)} frames")
            for frame in frames[:3]:  # Show first 3 files
                print(f"     - {Path(frame).name}")
            if len(frames) > 3:
                print(f"     ... and {len(frames) - 3} more")
    else:
        print(f"\n⚠️  Stop-motion generation failed")


if __name__ == "__main__":
    main()
