"""
Avatar Generator Module
Generates digital avatars and emotional variations using Google Gemini API
"""

import os
import base64
import logging
import time
from typing import Optional, Dict
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


class AvatarGenerator:
    """
    Generates digital avatars and emotional variations using Google Gemini API.
    """
    
    def __init__(self, api_key: str):
        """
        Initialize the Avatar Generator.
        
        Args:
            api_key: Google Gemini API key
        """
        self.api_key = api_key
        self.client = genai.Client(api_key=api_key)
        self.model_name = "gemini-2.5-flash-image"
        
        logger.info("AvatarGenerator initialized with Gemini API")
    
    def _encode_image_to_base64(self, image_path: str) -> str:
        """
        Encode an image file to base64 string.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Base64 encoded string of the image
        """
        try:
            with open(image_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                return encoded_string
        except Exception as e:
            logger.error(f"Error encoding image {image_path}: {e}")
            raise
    
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
    
    def _make_api_request(self, prompt: str, image_path: Optional[str] = None) -> Optional[bytes]:
        """
        Make a request to the Gemini API using the Google GenAI client.
        
        Args:
            prompt: Text prompt for the API
            image_path: Optional path to the input image
            
        Returns:
            Image data bytes if successful, None otherwise
        """
        try:
            # Prepare the content parts
            content_parts = [prompt]
            
            # Add image if provided
            if image_path:
                # Load image using PIL
                image = Image.open(image_path)
                content_parts.append(image)
            
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
    
    def generate_base_portrait(self, neutral_face_path: str) -> Optional[str]:
        """
        Generate a clean, photorealistic base portrait from a neutral face capture.
        
        Args:
            neutral_face_path: Path to the captured neutral face image (e.g., capture_neutral.png)
            
        Returns:
            Path to the generated base portrait (avatar_base_neutral.png) or None if failed
        """
        try:
            logger.info("Generating base portrait...")
            
            # Check if input file exists
            if not os.path.exists(neutral_face_path):
                logger.error(f"Input file not found: {neutral_face_path}")
                return None
            
            # Craft the prompt for base portrait generation
            prompt = ("FOLLOW CLOSELY TO WHAT IS GIVEN IN THEE PROVIDED IMAGE. Create a new image: Generate a clean, photorealistic, high-resolution, forward-facing digital portrait "
                     "based on the person in this image. The background should be a simple, neutral grey "
                     "studio background. The expression must be perfectly neutral. The style should be "
                     "a high-fidelity digital human with professional lighting and clear facial features. "
                     "Please generate a new image file.")
            
            # Make API request
            result_bytes = self._make_api_request(prompt, neutral_face_path)
            
            if result_bytes:
                # Save the result
                output_path = "avatar_base_neutral.png"
                if self._save_image_from_bytes(result_bytes, output_path):
                    logger.info(f"✓ Base portrait generated: {output_path}")
                    return output_path
                else:
                    logger.error("Failed to save base portrait")
                    return None
            else:
                logger.error("Failed to generate base portrait")
                return None
                
        except Exception as e:
            logger.error(f"Error generating base portrait: {e}")
            return None
    
    def generate_expression_variant(self, base_portrait_path: str, emotion_capture_path: str, 
                                  emotion_name: str) -> Optional[str]:
        """
        Generate an emotional variant of the base portrait.
        
        Args:
            base_portrait_path: Path to the base portrait (avatar_base_neutral.png)
            emotion_capture_path: Path to the captured emotion image (e.g., capture_happy.png)
            emotion_name: Name of the emotion (e.g., "happy")
            
        Returns:
            Path to the generated emotional variant (e.g., avatar_happy.png) or None if failed
        """
        try:
            logger.info(f"Generating {emotion_name} expression...")
            
            # Check if input files exist
            if not os.path.exists(base_portrait_path):
                logger.error(f"Base portrait not found: {base_portrait_path}")
                return None
            if not os.path.exists(emotion_capture_path):
                logger.error(f"Emotion capture not found: {emotion_capture_path}")
                return None
            
            # Load both images using PIL
            base_image = Image.open(base_portrait_path)
            emotion_image = Image.open(emotion_capture_path)
            
            # Craft the prompt for expression variation
            prompt = (f"Create a new image: Using the first image as the base character model, modify its facial expression "
                     f"to match the {emotion_name} emotion shown in the second image. It is critical to "
                     f"maintain the identity, art style, and lighting of the base character. Only change "
                     f"the facial expression to convey {emotion_name} emotion while keeping everything "
                     f"else identical. Please generate a new image file.")
            
            # Prepare content parts for multi-image request
            content_parts = [prompt, base_image, emotion_image]
            
            # Make API request with both images
            try:
                logger.info("Making multi-image API request to Gemini...")
                
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=content_parts,
                )
                
                # Extract the generated image
                for part in response.candidates[0].content.parts:
                    if part.inline_data is not None:
                        # Save the result
                        output_path = f"avatar_{emotion_name}.png"
                        if self._save_image_from_bytes(part.inline_data.data, output_path):
                            logger.info(f"✓ {emotion_name} expression generated: {output_path}")
                            return output_path
                        else:
                            logger.error(f"Failed to save {emotion_name} expression")
                            return None
                    elif part.text is not None:
                        logger.info(f"Text response: {part.text}")
                
                logger.error("No image data found in API response")
                return None
                    
            except Exception as e:
                logger.error(f"Error making multi-image API request: {e}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating {emotion_name} expression: {e}")
            return None
    


def main():
    """
    Example usage of the AvatarGenerator class.
    """
    # Get API key from environment variables
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    
    if not GEMINI_API_KEY:
        print("❌ Error: GEMINI_API_KEY not found in environment variables")
        print("Please add your API key to the .env file in the current directory:")
        print("GEMINI_API_KEY=your_api_key_here")
        print("\nGet your API key from: https://makersuite.google.com/app/apikey")
        return
    
    # Initialize the generator
    generator = AvatarGenerator(GEMINI_API_KEY)
    
    # Example usage
    print("🎨 Avatar Generator Example")
    print("=" * 50)
    
    # Check if we have captured emotion images
    captured_files = {
        'neutral': 'capture_neutral.png',
        'happy': 'capture_happy.png',
        'sad': 'capture_sad.png',
        'angry': 'capture_angry.png'
    }
    
    # Check which files exist
    available_emotions = []
    for emotion, filename in captured_files.items():
        if os.path.exists(filename):
            available_emotions.append(emotion)
            print(f"✓ Found {emotion} capture: {filename}")
        else:
            print(f"✗ Missing {emotion} capture: {filename}")
    
    if not available_emotions:
        print("\n❌ No captured emotion images found!")
        print("Please run the emotion capture first:")
        print("python backend/emotion_recognizer.py capture")
        return
    
    # Generate base portrait
    if 'neutral' in available_emotions:
        print(f"\n🎭 Generating base portrait from {captured_files['neutral']}...")
        base_portrait = generator.generate_base_portrait(captured_files['neutral'])
        
        if base_portrait:
            print(f"✓ Base portrait created: {base_portrait}")
            
            # Generate emotional variants
            generated_avatars = {'neutral': base_portrait}
            for emotion in available_emotions:
                if emotion != 'neutral':
                    print(f"\n😊 Generating {emotion} expression...")
                    variant = generator.generate_expression_variant(
                        base_portrait, 
                        captured_files[emotion], 
                        emotion
                    )
                    if variant:
                        print(f"✓ {emotion} variant created: {variant}")
                        generated_avatars[emotion] = variant
                    else:
                        print(f"✗ Failed to create {emotion} variant")
            
            # Generate stop-motion variations
            print(f"\n🎬 Generating stop-motion variations...")
            from avatar_puppeteer import AvatarPuppeteer
            puppeteer = AvatarPuppeteer(GEMINI_API_KEY)
            variations = puppeteer.generate_all_emotion_variations(
                generated_avatars, 
                num_variations=2,
                output_dir="stop_motion"
            )
            
            # Generate GIFs from variations
            if variations:
                print(f"\n🎬 Generating animated GIFs...")
                gifs = puppeteer.generate_gifs_from_variations(
                    variations,
                    output_dir="gifs",
                    duration=500,
                    loop=0,
                    max_size=(512, 512)
                )
            
            # Summary
            print(f"\n🎉 Complete pipeline finished!")
            print(f"   Generated {len(generated_avatars)} base avatars")
            if variations:
                total_frames = sum(len(frames) for frames in variations.values())
                print(f"   Generated {total_frames} stop-motion frames")
                print(f"   Check the 'stop_motion' folder for your animation frames.")
            else:
                print(f"   Stop-motion generation failed")
            
            if 'gifs' in locals() and gifs:
                print(f"   Generated {len(gifs)} animated GIFs")
                print(f"   Check the 'gifs' folder for your animations.")
            else:
                print(f"   GIF generation failed")
            
            print(f"   Check the current directory for your avatar files.")
        else:
            print("✗ Failed to create base portrait")
    else:
        print("\n❌ Neutral emotion capture required for base portrait generation")


if __name__ == "__main__":
    main()
