"""
Retrain Voice Clone with New Conversations
Adds new audio samples from conversations to improve voice quality
"""

import os
import sys
import json
import sqlite3
from datetime import datetime
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from io import BytesIO

load_dotenv()

class VoiceRetrainer:
    def __init__(self):
        self.elevenlabs = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        self.db_path = os.path.join(os.path.dirname(__file__), "voice_clones.db")
        self.uploads_dir = os.path.join(os.path.dirname(__file__), '..', 'backend', 'uploads')
    
    def get_voice_info(self, voice_id):
        """Get voice clone info from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT user_name, personality_prompt, interview_transcription 
                FROM voice_clones 
                WHERE voice_id = ?
            """, (voice_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                return {
                    'user_name': result[0],
                    'personality_prompt': result[1],
                    'interview_transcription': result[2]
                }
            return None
            
        except Exception as e:
            print(f"ERROR fetching voice info: {e}")
            return None
    
    def get_conversation_audio_files(self, voice_id):
        """Get audio files from voice messages directory"""
        voice_messages_dir = os.path.join(self.uploads_dir, 'voice_messages')
        
        if not os.path.exists(voice_messages_dir):
            print(f"No voice messages directory found")
            return []
        
        audio_files = []
        for filename in os.listdir(voice_messages_dir):
            if filename.endswith('.wav') or filename.endswith('.mp3'):
                file_path = os.path.join(voice_messages_dir, filename)
                # Only use recent files (last 24 hours)
                if os.path.getmtime(file_path) > (datetime.now().timestamp() - 86400):
                    audio_files.append(file_path)
        
        return audio_files
    
    def retrain_voice(self, voice_id):
        """Retrain voice with new audio samples"""
        print(f"🔄 Starting voice retraining for {voice_id}...")
        
        # Get voice info
        voice_info = self.get_voice_info(voice_id)
        if not voice_info:
            print(f"ERROR: Voice {voice_id} not found in database")
            return {"success": False, "error": "Voice not found"}
        
        # Get new audio files
        audio_files = self.get_conversation_audio_files(voice_id)
        
        if len(audio_files) < 3:
            print(f"Not enough new audio files for retraining (found {len(audio_files)}, need at least 3)")
            return {
                "success": False, 
                "error": f"Not enough audio samples (need 3+, found {len(audio_files)})"
            }
        
        print(f"Found {len(audio_files)} audio files for retraining")
        
        try:
            # Read audio file bytes
            audio_bytes = []
            for audio_file in audio_files[:10]:  # Max 10 files for retraining
                with open(audio_file, 'rb') as f:
                    audio_bytes.append(f.read())
            
            # Update voice clone with new samples
            # Note: ElevenLabs API may have limits on retraining frequency
            print("Adding new audio samples to voice...")
            
            # For professional voices, we would use add_voice_samples endpoint
            # For instant voices, we recreate with combined samples
            voice = self.elevenlabs.voices.ivc.create(
                name=f"Retrained_{voice_info['user_name']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                description=f"Retrained voice clone for {voice_info['user_name']}",
                files=[BytesIO(audio) for audio in audio_bytes]
            )
            
            # Update database with new voice ID
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Mark old voice as archived
            cursor.execute("""
                UPDATE voice_clones 
                SET status = 'archived'
                WHERE voice_id = ?
            """, (voice_id,))
            
            # Add new retrained voice
            cursor.execute("""
                INSERT INTO voice_clones (id, session_id, user_name, voice_id, personality_prompt, interview_transcription, status)
                VALUES (?, ?, ?, ?, ?, ?, 'active')
            """, (
                voice.voice_id,
                f"retrained_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                voice_info['user_name'],
                voice.voice_id,
                voice_info['personality_prompt'],
                voice_info['interview_transcription']
            ))
            
            conn.commit()
            conn.close()
            
            print(f"✅ Voice retrained successfully! New voice ID: {voice.voice_id}")
            
            return {
                "success": True,
                "old_voice_id": voice_id,
                "new_voice_id": voice.voice_id,
                "samples_used": len(audio_bytes)
            }
            
        except Exception as e:
            print(f"ERROR retraining voice: {e}")
            return {"success": False, "error": str(e)}

def main():
    if len(sys.argv) < 2:
        print("Usage: python retrain_voice.py <voice_id>")
        sys.exit(1)
    
    voice_id = sys.argv[1]
    
    retrainer = VoiceRetrainer()
    result = retrainer.retrain_voice(voice_id)
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()

