# Voice Clone Chat Interface
import os
import sys
import sqlite3
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
import pygame
import tempfile

load_dotenv()

class VoiceCloneChat:
    def __init__(self):
        self.elevenlabs = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.db_path = os.path.join(os.path.dirname(__file__), "voice_clones.db")
        self.conversation_history = []
        self.init_pygame()
    
    def init_pygame(self):
        """Initialize pygame for audio playback"""
        try:
            pygame.mixer.init()
            print("SUCCESS: Audio system initialized")
        except Exception as e:
            print(f"ERROR: Audio initialization failed: {e}")
    
    def get_voice_clones(self):
        """Get all voice clones from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("SELECT * FROM voice_clones")
            clones = cursor.fetchall()
            
            conn.close()
            return clones
        except Exception as e:
            print(f"ERROR: Database error: {e}")
            return []
    
    def list_voice_clones(self):
        """List available voice clones"""
        clones = self.get_voice_clones()
        
        if not clones:
            print("ERROR: No voice clones found!")
            print("Run the interview process first to create a voice clone.")
            return None
        
        print("Available Voice Clones:")
        print("-" * 50)
        
        for i, clone in enumerate(clones):
            # Current schema: id, session_id, user_name, voice_id, personality_prompt, interview_transcription, created_at, status
            if len(clone) == 8:
                # Current schema with interview_transcription
                clone_id, session_id, user_name, voice_id, personality_prompt, interview_transcription, created_at, status = clone
            elif len(clone) == 7:
                # Old schema without interview_transcription
                clone_id, session_id, user_name, voice_id, personality_prompt, created_at, status = clone
                interview_transcription = None
            else:
                print(f"WARNING: Unexpected schema with {len(clone)} columns")
                continue
            
            print(f"{i+1}. {user_name}")
            print(f"   Voice ID: {voice_id}")
            print(f"   Created: {created_at}")
            if interview_transcription:
                # Show first 50 characters of interview
                preview = interview_transcription[:50].replace('\n', ' ')
                print(f"   Interview: {preview}...")
            print(f"   Status: {status}")
            print()
        
        return clones
    
    def generate_ai_response(self, user_message, personality_prompt):
        """Generate AI response using OpenAI"""
        try:
            import requests
            
            # Build conversation context
            messages = [
                {"role": "system", "content": personality_prompt}
            ]
            
            # Add conversation history (last 5 messages)
            for msg in self.conversation_history[-5:]:
                messages.append(msg)
            
            # Add current user message
            messages.append({"role": "user", "content": user_message})
            
            # Call OpenAI API
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.openai_api_key}"
            }
            
            data = {
                "model": "gpt-4",
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 150
            }
            
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                ai_response = response.json()["choices"][0]["message"]["content"]
                
                # Update conversation history
                self.conversation_history.append({"role": "user", "content": user_message})
                self.conversation_history.append({"role": "assistant", "content": ai_response})
                
                return ai_response
            else:
                print(f"ERROR: OpenAI API error: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"ERROR: Error generating AI response: {e}")
            return None
    
    def chat_with_voice(self, voice_id, user_message, personality_prompt):
        """Generate AI response and speak it using the cloned voice"""
        try:
            # Generate AI response
            print(f"💭 Thinking...")
            ai_response = self.generate_ai_response(user_message, personality_prompt)
            
            if not ai_response:
                print("ERROR: Failed to generate AI response")
                return False
            
            print(f"🤖 AI: {ai_response}")
            print(f" Generating speech...")
            
            # Generate audio using ElevenLabs
            audio_stream = self.elevenlabs.text_to_speech.convert(
                text=ai_response,
                voice_id=voice_id,
                model_id="eleven_multilingual_v2"
            )
            
            # Save to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as temp_file:
                for chunk in audio_stream:
                    temp_file.write(chunk)
                temp_file_path = temp_file.name
            
            # Play the audio
            self.play_audio(temp_file_path)
            
            # Wait a bit before cleanup to ensure file is released
            import time
            time.sleep(0.5)
            
            # Clean up (ignore errors if file is still in use)
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass  # File will be cleaned up by system later
            
            return True
            
        except Exception as e:
            print(f"ERROR: Error in chat: {e}")
            return False
    
    def play_audio(self, file_path):
        """Play audio file"""
        try:
            pygame.mixer.music.load(file_path)
            pygame.mixer.music.play()
            
            # Wait for playback to finish
            while pygame.mixer.music.get_busy():
                pygame.time.wait(100)
                
            print("SUCCESS: Audio playback completed")
            
        except Exception as e:
            print(f"ERROR: Audio playback error: {e}")
    
    def interactive_chat(self):
        """Interactive chat with voice clone"""
        clones = self.list_voice_clones()
        
        if not clones:
            return
        
        # Select voice clone
        while True:
            try:
                choice = input("Select voice clone (number) or 'q' to quit: ").strip()
                
                if choice.lower() == 'q':
                    print(" Goodbye!")
                    return
                
                choice_idx = int(choice) - 1
                if 0 <= choice_idx < len(clones):
                    selected_clone = clones[choice_idx]
                    voice_id = selected_clone[3]  # voice_id is at index 3
                    user_name = selected_clone[2]  # user_name is at index 2
                    personality_prompt = selected_clone[4]  # personality_prompt is at index 4
                    break
                else:
                    print("ERROR: Invalid choice. Please try again.")
            except ValueError:
                print("ERROR: Please enter a valid number.")
        
        print(f"\n Chatting with {user_name}'s voice clone!")
        print("Type your messages and press Enter to hear them spoken.")
        print("Type 'quit' to exit.\n")
        
        # Chat loop
        while True:
            try:
                message = input("You: ").strip()
                
                if message.lower() in ['quit', 'exit', 'q']:
                    print(" Goodbye!")
                    break
                
                if not message:
                    continue
                
                # Generate AI response and play speech
                success = self.chat_with_voice(voice_id, message, personality_prompt)
                
                if not success:
                    print("ERROR: Failed to generate response. Please try again.")
                
            except KeyboardInterrupt:
                print("\n Goodbye!")
                break
            except Exception as e:
                print(f"ERROR: Error: {e}")

def main():
    print("Voice Clone Chat Interface")
    print("=" * 40)
    
    # Check if API key is set
    if not os.getenv("ELEVENLABS_API_KEY"):
        print("ERROR: ELEVENLABS_API_KEY not found in environment!")
        print("Please create a .env file with your ElevenLabs API key.")
        return
    
    # Initialize chat interface
    chat = VoiceCloneChat()
    
    # Start interactive chat
    chat.interactive_chat()

if __name__ == "__main__":
    main()
