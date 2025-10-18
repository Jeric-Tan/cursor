"""
Avatar Service Module
Generates avatars for a specific session using the existing avatar generation pipeline
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional
# Import the existing avatar generation modules
from avatar_generator import AvatarGenerator
from avatar_puppeteer import AvatarPuppeteer
from gif_generator import GIFGenerator

# Load environment variables if dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not available, continue without it

logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s:%(name)s:%(message)s'
)
logger = logging.getLogger(__name__)


class AvatarService:
    """
    Service class for generating avatars for a specific session.
    """
    
    def __init__(self):
        """Initialize the avatar service with API keys."""
        self.gemini_api_key = os.getenv('GEMINI_API_KEY')
        if not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        # Initialize generators
        self.avatar_generator = AvatarGenerator(self.gemini_api_key)
        self.avatar_puppeteer = AvatarPuppeteer(self.gemini_api_key)
        self.gif_generator = GIFGenerator()
        
        logger.info("AvatarService initialized successfully")
    
    def generate_avatars_for_session(self, session_id: str, photo_dir: str) -> Dict:
        """
        Generate avatars for a specific session.
        
        Args:
            session_id: The session ID
            photo_dir: Path to directory containing the 4 emotion photos
            
        Returns:
            Dictionary with generation results and file paths
        """
        try:
            logger.info(f"Starting avatar generation for session: {session_id}")
            
            # Define expected photo files
            emotion_photos = {
                'neutral': os.path.join(photo_dir, 'photo-1.jpg'),
                'happy': os.path.join(photo_dir, 'photo-2.jpg'),
                'sad': os.path.join(photo_dir, 'photo-3.jpg'),
                'angry': os.path.join(photo_dir, 'photo-4.jpg')
            }
            
            # Check if all photos exist
            missing_photos = []
            for emotion, photo_path in emotion_photos.items():
                if not os.path.exists(photo_path):
                    missing_photos.append(photo_path)
            
            if missing_photos:
                error_msg = f"Missing photos: {missing_photos}"
                logger.error(error_msg)
                return {
                    'success': False,
                    'error': error_msg,
                    'session_id': session_id
                }
            
            # Create output directories
            base_output_dir = Path('../../data/avatars') / session_id
            portraits_dir = base_output_dir / 'portraits'
            stop_motion_dir = base_output_dir / 'stop_motion'
            gifs_dir = base_output_dir / 'gifs'
            
            for dir_path in [portraits_dir, stop_motion_dir, gifs_dir]:
                dir_path.mkdir(parents=True, exist_ok=True)
            
            # Use absolute paths to avoid issues with working directory changes
            try:
                # Step 1: Generate base portrait from neutral photo
                logger.info("Generating base portrait...")
                base_portrait_path = self.avatar_generator.generate_base_portrait(
                    os.path.abspath(emotion_photos['neutral'])
                )
                
                if not base_portrait_path or not os.path.exists(base_portrait_path):
                    raise Exception("Failed to generate base portrait")
                
                # Move base portrait to portraits directory
                final_base_path = portraits_dir / 'avatar_base_neutral.png'
                os.rename(base_portrait_path, str(final_base_path))
                base_portrait_path = str(final_base_path)
                
                logger.info(f"✓ Base portrait generated: {base_portrait_path}")
                
                # Step 2: Generate emotional variants
                generated_avatars = {'neutral': base_portrait_path}
                emotion_variants = ['happy', 'sad', 'angry']
                
                for emotion in emotion_variants:
                    logger.info(f"Generating {emotion} expression...")
                    variant_path = self.avatar_generator.generate_expression_variant(
                        base_portrait_path,
                        emotion_photos[emotion],
                        emotion
                    )
                    
                    if variant_path and os.path.exists(variant_path):
                        # Move to portraits directory
                        final_variant_path = portraits_dir / f'avatar_{emotion}.png'
                        os.rename(variant_path, str(final_variant_path))
                        generated_avatars[emotion] = str(final_variant_path)
                        logger.info(f"✓ {emotion} variant generated: {final_variant_path}")
                    else:
                        logger.warning(f"Failed to generate {emotion} variant")
                
                # Step 3: Generate stop-motion variations
                logger.info("Generating stop-motion variations...")
                variations = self.avatar_puppeteer.generate_all_emotion_variations(
                    generated_avatars,
                    num_variations=2,  # 2 mouth movement variations per emotion
                    output_dir=str(stop_motion_dir)
                )
                
                # Step 4: Generate GIFs from variations
                logger.info("Generating animated GIFs...")
                gifs = self.avatar_puppeteer.generate_gifs_from_variations(
                    variations,
                    output_dir=str(gifs_dir),
                    duration=500,  # 500ms per frame
                    loop=0,  # Infinite loop
                    max_size=(512, 512)
                )
                
                # Prepare result with frontend-accessible URLs
                result = {
                    'success': True,
                    'session_id': session_id,
                    'portraits': {
                        emotion: str(portraits_dir / f'avatar_{emotion}.png')
                        for emotion in ['neutral', 'happy', 'sad', 'angry']
                        if emotion in generated_avatars
                    },
                    'gifs': {
                        emotion: f'/api/avatars/{session_id}/{emotion}_animation.gif'
                        for emotion in ['neutral', 'happy', 'sad', 'angry']
                        if emotion in gifs
                    },
                    'stop_motion': {
                        emotion: [str(Path(v).relative_to(base_output_dir)) for v in paths]
                        for emotion, paths in variations.items()
                    }
                }
                
                logger.info(f"✓ Avatar generation completed for session {session_id}")
                return result
                
            finally:
                # Cleanup if needed
                pass
                
        except Exception as e:
            logger.error(f"Error generating avatars for session {session_id}: {e}")
            return {
                'success': False,
                'error': str(e),
                'session_id': session_id
            }
    
    def get_avatar_status(self, session_id: str) -> Dict:
        """
        Check the status of avatar generation for a session.
        
        Args:
            session_id: The session ID
            
        Returns:
            Dictionary with status information
        """
        try:
            base_output_dir = Path('data/avatars') / session_id
            gifs_dir = base_output_dir / 'gifs'
            
            if not base_output_dir.exists():
                return {
                    'status': 'pending',
                    'session_id': session_id,
                    'gif_paths': {}
                }
            
            # Check if GIFs exist
            gif_files = list(gifs_dir.glob('*.gif'))
            if gif_files:
                gif_paths = {
                    emotion: f'/api/avatars/{session_id}/{gif_file.name}'
                    for gif_file in gif_files
                    for emotion in ['neutral', 'happy', 'sad', 'angry']
                    if emotion in gif_file.name
                }
                
                return {
                    'status': 'complete',
                    'session_id': session_id,
                    'gif_paths': gif_paths
                }
            else:
                return {
                    'status': 'processing',
                    'session_id': session_id,
                    'gif_paths': {}
                }
                
        except Exception as e:
            logger.error(f"Error checking avatar status for session {session_id}: {e}")
            return {
                'status': 'failed',
                'session_id': session_id,
                'error': str(e),
                'gif_paths': {}
            }


def main():
    """Test the avatar service."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python avatar_service.py <session_id>")
        sys.exit(1)
    
    session_id = sys.argv[1]
    photo_dir = f"data/photos/{session_id}"
    
    if not os.path.exists(photo_dir):
        print(f"Photo directory not found: {photo_dir}")
        sys.exit(1)
    
    service = AvatarService()
    result = service.generate_avatars_for_session(session_id, photo_dir)
    
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
