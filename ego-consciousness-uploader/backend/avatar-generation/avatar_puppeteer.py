"""
Avatar Puppeteer Module
Generates stop-motion variations of avatar images for animation
"""

import os
import logging
import time
import random
from typing import Optional, Dict, List
from PIL import Image
import io
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables from .env file
load_dotenv()

logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s:%(name)s:%(message)s'
)
logger = logging.getLogger(__name__)


class AvatarPuppeteer:
    """
    Generates stop-motion variations of avatar images for animation.
    Creates subtle changes like mouth movements, eye blinks, and micro-expressions.
    """
    
    def __init__(self, api_key: str):
        """
        Initialize the Avatar Puppeteer.
        
        Args:
            api_key: Google Gemini API key
        """
        self.api_key = api_key
        self.client = genai.Client(api_key=api_key)
        self.model_name = "gemini-2.5-flash-image"
        
        logger.info("AvatarPuppeteer initialized with Gemini API")
    
    def _save_image_from_bytes(self, image_bytes: bytes, output_path: str) -> bool:
        """
        Save image bytes to a file.
        
        Args:
            image_bytes: Image data bytes
            output_path: Path where to save the image
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Open with PIL to ensure proper format
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if necessary (for PNG compatibility)
            if image.mode in ('RGBA', 'LA', 'P'):
                # Create white background for transparent images
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Save as high-quality PNG
            image.save(output_path, 'PNG', quality=95, optimize=True)
            logger.info(f"Image saved to {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving image to {output_path}: {e}")
            return False
    
    def _make_api_request(self, prompt: str, image_path: str) -> Optional[bytes]:
        """
        Make a request to the Gemini API using the Google GenAI client.
        
        Args:
            prompt: Text prompt for the API
            image_path: Path to the input image
            
        Returns:
            Image data bytes if successful, None otherwise
        """
        try:
            # Load image using PIL
            image = Image.open(image_path)
            
            # Prepare the content parts
            content_parts = [prompt, image]
            
            logger.info("Making API request to Gemini...")
            
            # Make the API request using the Google GenAI client
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=content_parts,
            )
            
            # Extract the generated image
            for part in response.candidates[0].content.parts:
                if part.inline_data is not None:
                    logger.info("✓ Image generated successfully")
                    return part.inline_data.data
                elif part.text is not None:
                    logger.info(f"Text response: {part.text}")
            
            logger.error("No image data found in API response")
            return None
                
        except Exception as e:
            logger.error(f"Error making API request: {e}")
            return None
    
    def _get_variation_prompts(self, emotion: str) -> List[str]:
        """
        Get a list of variation prompts for a specific emotion.
        
        Args:
            emotion: The base emotion (neutral, happy, sad, angry)
            
        Returns:
            List of prompts for generating variations
        """
        # Base prompts for different types of variations
        base_variations = {
            'neutral': [
                "Create a new image: Make the exact same person with a very subtle change - the mouth is gently closed with the lips touching, as if pronouncing the sound 'Mmm'. Keep everything else identical including expression, lighting, and pose.",
                "Create a new image: Make the exact same person with a very subtle change - the jaw is relaxed and the mouth is slightly open, as if saying a soft 'ah' sound. Keep everything else identical including expression, lighting, and pose.",
                "Create a new image: Make the exact same person with a very subtle change - the mouth is open and the lips are rounded, as if pronouncing an 'Ooh' sound. Keep everything else identical including expression, lighting, and pose.",
                # "Create a new image: Make the exact same person with a very subtle change - the lips are slightly pulled back to show a hint of the upper teeth, as if pronouncing the sound 'Ee'. Keep everything else identical including expression, lighting, and pose.",
            ],

            'happy': [
                "Create a new image: Make the exact same person with a very subtle change - the mouth is gently closed with the lips touching, as if pronouncing the sound 'Mmm'. Keep everything else identical including expression, lighting, and pose.",
                "Create a new image: Make the exact same person with a very subtle change - the jaw is relaxed and the mouth is slightly open, as if saying a soft 'ah' sound. Keep everything else identical including expression, lighting, and pose.",
                "Create a new image: Make the exact same person with a very subtle change - the mouth is open and the lips are rounded, as if pronouncing an 'Ooh' sound. Keep everything else identical including expression, lighting, and pose.",
                # "Create a new image: Make the exact same person with a very subtle change - the lips are slightly pulled back to show a hint of the upper teeth, as if pronouncing the sound 'Ee'. Keep everything else identical including expression, lighting, and pose.",
            ],
            'sad': [
                "Create a new image: Make the exact same person with a very subtle change - the mouth is gently closed with the lips touching, as if pronouncing the sound 'Mmm'. Keep everything else identical including expression, lighting, and pose.",
                "Create a new image: Make the exact same person with a very subtle change - the jaw is relaxed and the mouth is slightly open, as if saying a soft 'ah' sound. Keep everything else identical including expression, lighting, and pose.",
                "Create a new image: Make the exact same person with a very subtle change - the mouth is open and the lips are rounded, as if pronouncing an 'Ooh' sound. Keep everything else identical including expression, lighting, and pose.",
                # "Create a new image: Make the exact same person with a very subtle change - the lips are slightly pulled back to show a hint of the upper teeth, as if pronouncing the sound 'Ee'. Keep everything else identical including expression, lighting, and pose.",
            ],
            'angry': [
                "Create a new image: Make the exact same person with a very subtle change - the mouth is gently closed with the lips touching, as if pronouncing the sound 'Mmm'. Keep everything else identical including expression, lighting, and pose.",
                "Create a new image: Make the exact same person with a very subtle change - the jaw is relaxed and the mouth is slightly open, as if saying a soft 'ah' sound. Keep everything else identical including expression, lighting, and pose.",
                "Create a new image: Make the exact same person with a very subtle change - the mouth is open and the lips are rounded, as if pronouncing an 'Ooh' sound. Keep everything else identical including expression, lighting, and pose.",
                # "Create a new image: Make the exact same person with a very subtle change - the lips are slightly pulled back to show a hint of the upper teeth, as if pronouncing the sound 'Ee'. Keep everything else identical including expression, lighting, and pose.",
            ],
        }
        
        return base_variations.get(emotion, base_variations['neutral'])
    
    def generate_stop_motion_variations(self, avatar_path: str, emotion: str, 
                                      num_variations: int = 4, 
                                      output_dir: str = "stop_motion") -> List[str]:
        """
        Generate stop-motion variations of an avatar image.
        
        Args:
            avatar_path: Path to the base avatar image
            emotion: The emotion of the avatar (neutral, happy, sad, angry)
            num_variations: Number of variations to generate (default: 4)
            output_dir: Directory to save the variations
            
        Returns:
            List of paths to generated variation images
        """
        try:
            logger.info(f"Generating {num_variations} stop-motion variations for {emotion} avatar...")
            
            # Check if input file exists
            if not os.path.exists(avatar_path):
                logger.error(f"Avatar image not found: {avatar_path}")
                return []
            
            # Create output directory
            emotion_dir = Path(output_dir) / emotion
            emotion_dir.mkdir(parents=True, exist_ok=True)
            
            # Get variation prompts
            variation_prompts = self._get_variation_prompts(emotion)
            
            # Generate variations
            generated_files = []
            successful_generations = 0
            
            for i in range(num_variations):
                # Select a random prompt (with replacement if we need more variations than prompts)
                prompt = "Prioritise changing the mouth shape based on my following prompt: " +variation_prompts[i % len(variation_prompts)]
                
                # Add variation number to make it unique
                prompt = f"{prompt} This is variation {i+1} of {num_variations}."
                
                logger.info(f"Generating variation {i+1}/{num_variations}...")
                
                # Make API request
                result_bytes = self._make_api_request(prompt, avatar_path)
                
                if result_bytes:
                    # Save the result
                    output_path = emotion_dir / f"{emotion}_variation_{i+1:02d}.png"
                    if self._save_image_from_bytes(result_bytes, str(output_path)):
                        generated_files.append(str(output_path))
                        successful_generations += 1
                        logger.info(f"✓ Variation {i+1} generated: {output_path}")
                    else:
                        logger.error(f"Failed to save variation {i+1}")
                else:
                    logger.error(f"Failed to generate variation {i+1}")
                
                # Add a small delay to avoid rate limiting
                time.sleep(1)
            
            logger.info(f"✓ Generated {successful_generations}/{num_variations} variations for {emotion}")
            return generated_files
            
        except Exception as e:
            logger.error(f"Error generating stop-motion variations: {e}")
            return []
    
    def generate_all_emotion_variations(self, avatar_files: Dict[str, str], 
                                      num_variations: int = 10,
                                      output_dir: str = "stop_motion") -> Dict[str, List[str]]:
        """
        Generate stop-motion variations for all emotion avatars.
        
        Args:
            avatar_files: Dictionary mapping emotion names to avatar file paths
            num_variations: Number of variations to generate per emotion
            output_dir: Directory to save the variations
            
        Returns:
            Dictionary mapping emotion names to lists of generated variation file paths
        """
        logger.info("🎬 Starting stop-motion variation generation for all emotions...")
        print("\n" + "=" * 60)
        print("🎬 STOP-MOTION VARIATION GENERATION")
        print("=" * 60)
        
        all_variations = {}
        total_successful = 0
        total_attempted = len(avatar_files) * num_variations
        
        for emotion, avatar_path in avatar_files.items():
            if not os.path.exists(avatar_path):
                logger.warning(f"Skipping {emotion} - avatar file not found: {avatar_path}")
                continue
            
            print(f"\n🎭 Generating {num_variations} variations for {emotion}...")
            variations = self.generate_stop_motion_variations(
                avatar_path, emotion, num_variations, output_dir
            )
            
            if variations:
                all_variations[emotion] = variations
                total_successful += len(variations)
                print(f"✓ {emotion}: {len(variations)}/{num_variations} variations generated")
            else:
                print(f"✗ Failed to generate variations for {emotion}")
        
        # Summary
        print(f"\n📊 Stop-Motion Generation Summary:")
        print(f"   ✅ Successful: {total_successful}/{total_attempted}")
        print(f"   📁 Output directory: {output_dir}/")
        
        if total_successful > 0:
            print(f"\n🎉 Stop-motion variations generated successfully!")
            print(f"   Check the '{output_dir}' folder for your animation frames.")
            for emotion, variations in all_variations.items():
                print(f"   {emotion}: {len(variations)} frames")
        else:
            print(f"\n⚠️  No variations were generated. Check the error messages above.")
        
        return all_variations
    
    def generate_gifs_from_variations(self, variations: Dict[str, List[str]], 
                                    output_dir: str = "gifs",
                                    duration: int = 500, loop: int = 0,
                                    max_size: tuple = (512, 512)) -> Dict[str, str]:
        """
        Generate GIFs from stop-motion variations.
        
        Args:
            variations: Dictionary mapping emotion names to lists of variation file paths
            output_dir: Directory to save the GIFs
            duration: Duration of each frame in milliseconds
            loop: Number of loops (0 = infinite)
            max_size: Maximum size for each frame (width, height)
            
        Returns:
            Dictionary mapping emotion names to generated GIF file paths
        """
        from gif_generator import GIFGenerator
        
        gif_generator = GIFGenerator()
        generated_gifs = {}
        
        logger.info("🎬 Creating GIFs from variations...")
        
        for emotion, variation_paths in variations.items():
            if not variation_paths:
                continue
            
            gif_path = os.path.join(output_dir, f"{emotion}_animation.gif")
            
            success = gif_generator.create_gif_from_images(
                variation_paths, gif_path, duration, loop, max_size
            )
            
            if success:
                generated_gifs[emotion] = gif_path
                logger.info(f"✓ {emotion} GIF created: {gif_path}")
            else:
                logger.error(f"✗ Failed to create {emotion} GIF")
        
        return generated_gifs


def main():
    """
    Example usage of the AvatarPuppeteer class.
    """
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
    
    # Example usage
    print("🎭 Avatar Puppeteer Example")
    print("=" * 50)
    
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
    
    # Generate stop-motion variations
    print(f"\n🎬 Generating stop-motion variations...")
    variations = puppeteer.generate_all_emotion_variations(
        available_avatars, 
        num_variations=10,
        output_dir="stop_motion"
    )
    
    if variations:
        print(f"\n🎉 Stop-motion generation completed!")
        total_frames = sum(len(frames) for frames in variations.values())
        print(f"   Generated {total_frames} animation frames")
        print(f"   Check the 'stop_motion' folder for your animation frames.")
    else:
        print(f"\n⚠️  Stop-motion generation failed")


if __name__ == "__main__":
    main()
