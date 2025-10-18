#!/usr/bin/env python3
"""
Run GIF Generator
Creates animated GIFs from stop-motion avatar variations
"""

import os
import sys
from pathlib import Path

# Add the current directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from gif_generator import GIFGenerator

def main():
    """
    Run the GIF generator on existing stop-motion variations.
    """
    print("🎬 GIF Generator")
    print("=" * 50)
    
    # Initialize the generator
    gif_generator = GIFGenerator()
    
    # Check if we have stop-motion variations
    stop_motion_dir = "stop_motion"
    if not os.path.exists(stop_motion_dir):
        print(f"❌ Stop motion directory not found: {stop_motion_dir}")
        print("Please run the avatar puppeteer first:")
        print("python run_puppeteer.py")
        return
    
    # Check what emotions are available
    stop_motion_path = Path(stop_motion_dir)
    emotion_dirs = [d for d in stop_motion_path.iterdir() if d.is_dir()]
    
    if not emotion_dirs:
        print(f"❌ No emotion directories found in {stop_motion_dir}")
        print("Please run the avatar puppeteer first:")
        print("python run_puppeteer.py")
        return
    
    print(f"✓ Found {len(emotion_dirs)} emotions: {[d.name for d in emotion_dirs]}")
    
    # Ask user for options
    print(f"\n🎛️  Animation Settings:")
    
    try:
        duration = input("Frame duration in milliseconds (default: 500): ").strip()
        if not duration:
            duration = 500
        else:
            duration = int(duration)
    except ValueError:
        print("Invalid input, using default of 500ms")
        duration = 500
    
    try:
        max_size_input = input("Max frame size (width,height) (default: 512,512): ").strip()
        if not max_size_input:
            max_size = (512, 512)
        else:
            width, height = map(int, max_size_input.split(','))
            max_size = (width, height)
    except ValueError:
        print("Invalid input, using default of 512x512")
        max_size = (512, 512)
    
    # Ask for output directory
    output_dir = input("Output directory (default: gifs): ").strip()
    if not output_dir:
        output_dir = "gifs"
    
    # Create GIFs for all emotions
    print(f"\n🎬 Creating GIFs...")
    print(f"   Frame duration: {duration}ms")
    print(f"   Max size: {max_size[0]}x{max_size[1]}")
    print(f"   Output directory: {output_dir}/")
    
    gifs = gif_generator.create_gifs_for_all_emotions(
        stop_motion_dir=stop_motion_dir,
        output_dir=output_dir,
        duration=duration,
        loop=0,  # Infinite loop
        max_size=max_size
    )
    
    if gifs:
        print(f"\n🎉 GIF generation completed!")
        print(f"   Generated {len(gifs)} animated GIFs")
        print(f"   Check the '{output_dir}' folder for your animations.")
        
        # Show file structure
        print(f"\n📁 Generated GIFs:")
        for emotion, gif_path in gifs.items():
            file_size = os.path.getsize(gif_path) / 1024
            print(f"   {emotion}: {Path(gif_path).name} ({file_size:.1f} KB)")
    else:
        print(f"\n⚠️  GIF generation failed")


if __name__ == "__main__":
    main()
