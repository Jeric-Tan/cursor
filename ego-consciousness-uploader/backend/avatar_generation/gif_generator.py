"""
GIF Generator Module
Creates animated GIFs from stop-motion avatar variations
"""

import os
import logging
from typing import List, Optional, Dict
from PIL import Image, ImageSequence
from pathlib import Path
import glob

logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s:%(name)s:%(message)s'
)
logger = logging.getLogger(__name__)


class GIFGenerator:
    """
    Generates animated GIFs from stop-motion avatar variations.
    """
    
    def __init__(self):
        """
        Initialize the GIF Generator.
        """
        logger.info("GIFGenerator initialized")
    
    def _resize_image(self, image: Image.Image, max_size: tuple = (512, 512)) -> Image.Image:
        """
        Resize image while maintaining aspect ratio.
        
        Args:
            image: PIL Image object
            max_size: Maximum size tuple (width, height)
            
        Returns:
            Resized PIL Image object
        """
        # Calculate new size maintaining aspect ratio
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        return image
    
    def _optimize_for_gif(self, image: Image.Image) -> Image.Image:
        """
        Optimize image for GIF format.
        
        Args:
            image: PIL Image object
            
        Returns:
            Optimized PIL Image object
        """
        # Convert to RGB if necessary
        if image.mode in ('RGBA', 'LA', 'P'):
            # Create white background for transparent images
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Quantize to reduce colors for better GIF compression
        image = image.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
        return image.convert('P', palette=Image.ADAPTIVE, colors=256)
    
    def create_gif_from_images(self, image_paths: List[str], output_path: str, 
                             duration: int = 500, loop: int = 0, 
                             max_size: tuple = (512, 512)) -> bool:
        """
        Create a GIF from a list of image paths.
        
        Args:
            image_paths: List of paths to image files
            output_path: Path where to save the GIF
            duration: Duration of each frame in milliseconds
            loop: Number of loops (0 = infinite)
            max_size: Maximum size for each frame (width, height)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not image_paths:
                logger.error("No image paths provided")
                return False
            
            # Load and process images
            frames = []
            for image_path in image_paths:
                if not os.path.exists(image_path):
                    logger.warning(f"Image not found: {image_path}")
                    continue
                
                try:
                    image = Image.open(image_path)
                    # Resize if needed
                    if max_size:
                        image = self._resize_image(image, max_size)
                    # Optimize for GIF
                    image = self._optimize_for_gif(image)
                    frames.append(image)
                    logger.debug(f"Loaded frame: {image_path}")
                except Exception as e:
                    logger.error(f"Error loading image {image_path}: {e}")
                    continue
            
            if not frames:
                logger.error("No valid frames loaded")
                return False
            
            # Create output directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Save as GIF
            frames[0].save(
                output_path,
                save_all=True,
                append_images=frames[1:],
                duration=duration,
                loop=loop,
                optimize=True,
                quality=85
            )
            
            logger.info(f"✓ GIF created: {output_path}")
            logger.info(f"  Frames: {len(frames)}")
            logger.info(f"  Duration per frame: {duration}ms")
            logger.info(f"  File size: {os.path.getsize(output_path) / 1024:.1f} KB")
            
            return True
            
        except Exception as e:
            logger.error(f"Error creating GIF: {e}")
            return False
    
    def create_gif_from_directory(self, directory_path: str, output_path: str,
                                pattern: str = "*_variation_*.png", 
                                duration: int = 500, loop: int = 0,
                                max_size: tuple = (512, 512)) -> bool:
        """
        Create a GIF from all variation images in a directory.
        
        Args:
            directory_path: Path to directory containing variation images
            output_path: Path where to save the GIF
            pattern: Glob pattern to match variation files
            duration: Duration of each frame in milliseconds
            loop: Number of loops (0 = infinite)
            max_size: Maximum size for each frame (width, height)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Find all variation images
            search_pattern = os.path.join(directory_path, pattern)
            image_paths = sorted(glob.glob(search_pattern))
            
            if not image_paths:
                logger.error(f"No variation images found in {directory_path} with pattern {pattern}")
                return False
            
            logger.info(f"Found {len(image_paths)} variation images in {directory_path}")
            
            return self.create_gif_from_images(
                image_paths, output_path, duration, loop, max_size
            )
            
        except Exception as e:
            logger.error(f"Error creating GIF from directory: {e}")
            return False
    
    def create_gifs_for_all_emotions(self, stop_motion_dir: str = "stop_motion",
                                   output_dir: str = "gifs",
                                   duration: int = 500, loop: int = 0,
                                   max_size: tuple = (512, 512)) -> Dict[str, str]:
        """
        Create GIFs for all emotions in the stop_motion directory.
        
        Args:
            stop_motion_dir: Directory containing stop-motion variations
            output_dir: Directory to save the GIFs
            duration: Duration of each frame in milliseconds
            loop: Number of loops (0 = infinite)
            max_size: Maximum size for each frame (width, height)
            
        Returns:
            Dictionary mapping emotion names to generated GIF file paths
        """
        logger.info("🎬 Creating GIFs for all emotions...")
        print("\n" + "=" * 60)
        print("🎬 GIF GENERATION")
        print("=" * 60)
        
        generated_gifs = {}
        successful_generations = 0
        total_emotions = 0
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Find all emotion directories
        stop_motion_path = Path(stop_motion_dir)
        if not stop_motion_path.exists():
            logger.error(f"Stop motion directory not found: {stop_motion_dir}")
            return generated_gifs
        
        emotion_dirs = [d for d in stop_motion_path.iterdir() if d.is_dir()]
        total_emotions = len(emotion_dirs)
        
        for emotion_dir in emotion_dirs:
            emotion = emotion_dir.name
            print(f"\n🎭 Creating GIF for {emotion}...")
            
            # Create GIF for this emotion
            gif_path = os.path.join(output_dir, f"{emotion}_animation.gif")
            
            success = self.create_gif_from_directory(
                str(emotion_dir),
                gif_path,
                duration=duration,
                loop=loop,
                max_size=max_size
            )
            
            if success:
                generated_gifs[emotion] = gif_path
                successful_generations += 1
                print(f"✓ {emotion} GIF created: {gif_path}")
            else:
                print(f"✗ Failed to create {emotion} GIF")
        
        # Summary
        print(f"\n📊 GIF Generation Summary:")
        print(f"   ✅ Successful: {successful_generations}/{total_emotions}")
        print(f"   📁 Output directory: {output_dir}/")
        
        if successful_generations > 0:
            print(f"\n🎉 GIFs generated successfully!")
            print(f"   Check the '{output_dir}' folder for your animated GIFs.")
            for emotion, gif_path in generated_gifs.items():
                file_size = os.path.getsize(gif_path) / 1024
                print(f"   {emotion}: {gif_path} ({file_size:.1f} KB)")
        else:
            print(f"\n⚠️  No GIFs were generated. Check the error messages above.")
        
        return generated_gifs
    
    def create_talking_gif(self, image_paths: List[str], output_path: str,
                          duration: int = 300, loop: int = 0,
                          max_size: tuple = (512, 512)) -> bool:
        """
        Create a talking GIF with faster frame transitions for speech-like animation.
        
        Args:
            image_paths: List of paths to image files
            output_path: Path where to save the GIF
            duration: Duration of each frame in milliseconds (shorter for talking)
            loop: Number of loops (0 = infinite)
            max_size: Maximum size for each frame (width, height)
            
        Returns:
            True if successful, False otherwise
        """
        logger.info("🗣️ Creating talking GIF...")
        return self.create_gif_from_images(
            image_paths, output_path, duration, loop, max_size
        )
    
    def create_blinking_gif(self, base_image_path: str, output_path: str,
                           duration: int = 1000, loop: int = 0,
                           max_size: tuple = (512, 512)) -> bool:
        """
        Create a blinking GIF by duplicating the base image with slight variations.
        
        Args:
            base_image_path: Path to the base avatar image
            output_path: Path where to save the GIF
            duration: Duration of each frame in milliseconds
            loop: Number of loops (0 = infinite)
            max_size: Maximum size for each frame (width, height)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not os.path.exists(base_image_path):
                logger.error(f"Base image not found: {base_image_path}")
                return False
            
            # Load base image
            base_image = Image.open(base_image_path)
            if max_size:
                base_image = self._resize_image(base_image, max_size)
            base_image = self._optimize_for_gif(base_image)
            
            # Create frames: open eyes, slightly closed, closed, slightly closed, open eyes
            frames = []
            
            # Frame 1: Open eyes (original)
            frames.append(base_image)
            
            # Frame 2: Slightly closed
            closed_image = base_image.copy()
            # This is a simple approach - in a real implementation, you'd want to
            # use image processing to actually close the eyes
            frames.append(closed_image)
            
            # Frame 3: More closed
            frames.append(closed_image)
            
            # Frame 4: Slightly closed
            frames.append(closed_image)
            
            # Frame 5: Open eyes (original)
            frames.append(base_image)
            
            # Create output directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Save as GIF
            frames[0].save(
                output_path,
                save_all=True,
                append_images=frames[1:],
                duration=duration,
                loop=loop,
                optimize=True,
                quality=85
            )
            
            logger.info(f"✓ Blinking GIF created: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating blinking GIF: {e}")
            return False


def main():
    """
    Example usage of the GIFGenerator class.
    """
    print("🎬 GIF Generator Example")
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
    
    # Ask user for options
    try:
        duration = input("\nFrame duration in milliseconds (default: 500): ").strip()
        if not duration:
            duration = 500
        else:
            duration = int(duration)
    except ValueError:
        print("Invalid input, using default of 500ms")
        duration = 500
    
    try:
        max_size_input = input("\nMax frame size (width,height) (default: 512,512): ").strip()
        if not max_size_input:
            max_size = (512, 512)
        else:
            width, height = map(int, max_size_input.split(','))
            max_size = (width, height)
    except ValueError:
        print("Invalid input, using default of 512x512")
        max_size = (512, 512)
    
    # Create GIFs for all emotions
    print(f"\n🎬 Creating GIFs...")
    gifs = gif_generator.create_gifs_for_all_emotions(
        stop_motion_dir=stop_motion_dir,
        output_dir="gifs",
        duration=duration,
        loop=0,  # Infinite loop
        max_size=max_size
    )
    
    if gifs:
        print(f"\n🎉 GIF generation completed!")
        print(f"   Generated {len(gifs)} animated GIFs")
        print(f"   Check the 'gifs' folder for your animations.")
    else:
        print(f"\n⚠️  GIF generation failed")


if __name__ == "__main__":
    main()
