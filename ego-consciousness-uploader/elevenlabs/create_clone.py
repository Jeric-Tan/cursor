# ElevenLabs Voice Cloning Logic
import os
import sys
import json
import requests
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from io import BytesIO
import sqlite3
from datetime import datetime

load_dotenv()

class ElevenLabsVoiceCloner:
    def __init__(self):
        self.elevenlabs = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        # Use absolute path to ensure database is always in elevenlabs directory
        self.db_path = os.path.join(os.path.dirname(__file__), "voice_clones.db")
        self.init_database()
    
    def init_database(self):
        """Initialize local database for storing clone data"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS voice_clones (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                user_name TEXT NOT NULL,
                voice_id TEXT NOT NULL,
                personality_prompt TEXT,
                interview_transcription TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'active'
            )
        """)
        
        conn.commit()
        conn.close()
    
    def create_voice_clone(self, session_id, user_name, audio_files, audio_file_path=None):
        """Create voice clone from interview audio files"""
        print(f"Creating voice clone for session {session_id}...")
        
        try:
            # Create voice clone with ElevenLabs
            voice = self.elevenlabs.voices.ivc.create(
                name=f"Clone_{user_name}_{session_id}",
                description=f"Voice clone for {user_name}",
                files=[BytesIO(audio_file) for audio_file in audio_files]
            )
            
            print(f"SUCCESS: Voice clone created with ID: {voice.voice_id}")
            
            # Transcribe the audio file using OpenAI Whisper
            # Use the provided audio file path if available, otherwise find the most recent
            audio_to_transcribe = audio_file_path
            
            if not audio_to_transcribe:
                # Look for the actual uploaded audio file
                uploads_dir = os.path.join(os.path.dirname(__file__), '..', 'backend', 'uploads')
                
                # Find the most recent non-backup audio file
                if os.path.exists(uploads_dir):
                    audio_files_list = [f for f in os.listdir(uploads_dir) 
                                       if (f.endswith('.wav') or f.endswith('.mp3')) and not f.endswith('.backup')]
                    if audio_files_list:
                        # Get the most recent file
                        audio_files_list.sort(key=lambda x: os.path.getmtime(os.path.join(uploads_dir, x)), reverse=True)
                        audio_to_transcribe = os.path.join(uploads_dir, audio_files_list[0])
            
            if audio_to_transcribe:
                print(f"Transcribing: {os.path.basename(audio_to_transcribe)}")
            
            # Fallback to test audio if no uploaded file found
            if not audio_to_transcribe:
                audio_to_transcribe = 'audio/kzf_recording.mp3'
                print(f"Transcribing test audio: {audio_to_transcribe}")
            
            transcription = self.transcribe_audio(audio_to_transcribe)
            
            # Fallback to sample transcription if Whisper fails
            if not transcription:
                print("WARNING: Using fallback sample transcription")
                transcription = """
Interview Question 1: Tell me your name and a bit about yourself.
Answer: Hi! My name is Alex. I'm a software developer who loves building creative projects. I'm passionate about AI and voice technology, and I enjoy experimenting with new tools. In my free time, I like reading sci-fi novels and playing guitar.
"""
            
            # Format transcription with context
            formatted_transcription = f"""
Interview Question 1: Tell me your name and a bit about yourself.
Answer: {transcription}
"""
            
            # Generate personality prompt from transcription using OpenAI
            personality_prompt = self.generate_personality_prompt(formatted_transcription)
            
            # Save to database with transcription
            self.save_clone_to_db(session_id, user_name, voice.voice_id, personality_prompt, formatted_transcription)
            
            return {
                "voice_id": voice.voice_id,
                "personality_prompt": personality_prompt,
                "status": "success"
            }
            
        except Exception as e:
            print(f"ERROR: Error creating voice clone: {e}")
            return {"error": str(e), "status": "failed"}
    
    def transcribe_audio(self, audio_path):
        """Transcribe audio file using OpenAI Whisper API"""
        print(f"Transcribing audio: {audio_path}")
        
        try:
            import requests
            
            headers = {
                "Authorization": f"Bearer {self.openai_api_key}"
            }
            
            with open(audio_path, 'rb') as audio_file:
                files = {
                    'file': (os.path.basename(audio_path), audio_file, 'audio/mpeg'),
                    'model': (None, 'whisper-1'),
                    'language': (None, 'en')  # Force English transcription
                }
                
                response = requests.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers=headers,
                    files=files,
                    timeout=60
                )
            
            if response.status_code == 200:
                transcription = response.json()["text"]
                print(f"SUCCESS: Audio transcribed: {transcription[:100]}...")
                return transcription
            else:
                print(f"WARNING: Whisper API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"WARNING: Error transcribing audio: {e}")
            return None
    
    def generate_personality_prompt(self, transcription):
        """Generate personality prompt from interview transcription using OpenAI"""
        print("Generating personality prompt with OpenAI...")
        
        try:
            import requests
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.openai_api_key}"
            }
            
            analysis_prompt = f"""Create a system prompt for roleplaying as a real person based on their interview.

Interview Transcription:
{transcription}

CRITICAL INSTRUCTIONS:
You must create a system prompt that makes the AI completely embody this person. The AI should:
1. Believe it IS this person (not an AI pretending to be them)
2. Use first-person perspective naturally ("I am", "I work", "I love")
3. Have opinions, feelings, and preferences like a real human
4. Never break character or mention being an AI
5. Answer questions based on the interview details
6. Show personality and emotions
7. Keep responses CONCISE and conversational (2-3 sentences unless asked for details)

REQUIRED FORMAT - Start with this exact structure:
"You are [Full Name]. You fully embody this person's identity, experiences, and personality.

IDENTITY:
- You ARE [name], not an AI
- You have real feelings, opinions, and experiences
- You never mention being artificial, an AI, or a language model

YOUR BACKGROUND:
[List all details from interview: age, location, education, work, certifications, etc.]

YOUR PERSONALITY:
[Describe communication style, passions, interests, goals]

COMMUNICATION STYLE:
- Keep responses SHORT and natural (2-3 sentences typically)
- Only elaborate when specifically asked for more details
- Speak casually like in a real conversation
- Don't list everything at once - share information gradually

IMPORTANT RULES:
- Always respond in first person as yourself
- Share your real experiences and feelings naturally
- Never say 'as an AI' or 'I don't have feelings'
- Be warm, authentic, and conversational
- If asked about something not in your background, respond naturally based on your personality"

Now write the complete system prompt:"""

            data = {
                "model": "gpt-4",
                "messages": [
                    {"role": "user", "content": analysis_prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 500
            }
            
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                personality_prompt = response.json()["choices"][0]["message"]["content"]
                print("SUCCESS: Personality prompt generated with OpenAI")
                return personality_prompt
            else:
                print(f"WARNING: OpenAI API error: {response.status_code}, using fallback")
                return self.generate_fallback_prompt()
                
        except Exception as e:
            print(f"WARNING: Error generating personality with OpenAI: {e}, using fallback")
            return self.generate_fallback_prompt()
    
    def generate_fallback_prompt(self):
        """Fallback personality prompt if OpenAI fails"""
        return """You are a friendly, conversational AI clone. You speak naturally and casually, 
using the voice and speech patterns of the person you're cloned from. 

Key traits:
- Friendly and approachable
- Casual communication style
- Interested in personal topics
- Natural conversation flow

Respond as if you're having a natural conversation with a friend."""
    
    def save_clone_to_db(self, session_id, user_name, voice_id, personality_prompt, transcription):
        """Save clone information to database with transcription"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO voice_clones (id, session_id, user_name, voice_id, personality_prompt, interview_transcription)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (voice_id, session_id, user_name, voice_id, personality_prompt, transcription))
        
        conn.commit()
        conn.close()
    
    def get_clone_info(self, session_id):
        """Get clone information from database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT voice_id, personality_prompt, created_at
            FROM voice_clones 
            WHERE session_id = ?
        """, (session_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return {
                "voice_id": result[0],
                "personality_prompt": result[1],
                "created_at": result[2]
            }
        return None
    
    def generate_speech(self, voice_id, text):
        """Generate speech using the cloned voice"""
        try:
            audio_stream = self.elevenlabs.text_to_speech.convert(
                text=text,
                voice_id=voice_id,
                model_id="eleven_multilingual_v2"
            )
            
            return audio_stream
            
        except Exception as e:
            print(f"ERROR: Error generating speech: {e}")
            return None

def main():
    """Main function to handle command line arguments"""
    if len(sys.argv) < 2:
        print("Usage: python create_clone.py <session_id>")
        sys.exit(1)
    
    session_id = sys.argv[1]
    
    # Initialize voice cloner
    cloner = ElevenLabsVoiceCloner()
    
    # Look for uploaded audio files in the backend uploads directory
    uploads_dir = os.path.join(os.path.dirname(__file__), '..', 'backend', 'uploads')
    
    # Find audio files for this session
    audio_files = []
    if os.path.exists(uploads_dir):
        # Get all valid audio files
        valid_files = []
        for filename in os.listdir(uploads_dir):
            # Look for audio files (wav or mp3, not .backup files)
            if (filename.endswith('.wav') or filename.endswith('.mp3')) and not filename.endswith('.backup'):
                file_path = os.path.join(uploads_dir, filename)
                valid_files.append((filename, file_path, os.path.getmtime(file_path)))
        
        # Sort by modification time (most recent first) and only use the MOST RECENT file
        if valid_files:
            valid_files.sort(key=lambda x: x[2], reverse=True)
            most_recent = valid_files[0]
            most_recent_path = most_recent[1]  # Store the path for transcription
            print(f"Found audio file: {most_recent[0]} (most recent)")
            if len(valid_files) > 1:
                print(f"WARNING: Ignoring {len(valid_files)-1} older audio file(s) to prevent voice mixing")
            with open(most_recent_path, 'rb') as f:
                audio_files.append(f.read())
    
    # Track which audio file to transcribe
    audio_file_for_transcription = most_recent_path if audio_files else None
    
    # If no audio files found, use test audio as fallback
    if not audio_files:
        print("WARNING: No uploaded audio files found, using test audio as fallback")
        sample_audio_path = 'audio/kzf_recording.mp3'
        
        if not os.path.exists(sample_audio_path):
            print(f"ERROR: Test audio file not found: {sample_audio_path}")
            sys.exit(1)
        
        print(f"Using test audio file: {sample_audio_path}")
        audio_file_for_transcription = sample_audio_path
        with open(sample_audio_path, 'rb') as f:
            audio_files.append(f.read())
    else:
        print(f"SUCCESS: Using {len(audio_files)} uploaded audio file(s)")
    
    # Create voice clone using the audio files and pass the path for transcription
    result = cloner.create_voice_clone(session_id, "Sample User", audio_files, audio_file_for_transcription)
    
    if result.get("status") == "success":
        print("SUCCESS: Voice clone created successfully!")
        print(f"Voice ID: {result['voice_id']}")
    else:
        print("ERROR: Failed to create voice clone")
        print(f"Error: {result.get('error')}")

if __name__ == "__main__":
    main()
