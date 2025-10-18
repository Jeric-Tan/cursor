"""
Voice-to-Voice Chat Handler
Transcribes user audio, generates AI response, converts to speech
"""

import os
import sys
import json
import sqlite3
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
import openai

load_dotenv()

class VoiceToVoiceChat:
    def __init__(self):
        self.elevenlabs = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.db_path = os.path.join(os.path.dirname(__file__), "voice_clones.db")
        
    def transcribe_audio(self, audio_path):
        """Transcribe user's voice message using OpenAI Whisper"""
        try:
            import requests
            
            headers = {
                "Authorization": f"Bearer {self.openai_api_key}"
            }
            
            with open(audio_path, 'rb') as audio_file:
                files = {
                    'file': (os.path.basename(audio_path), audio_file, 'audio/mpeg'),
                    'model': (None, 'whisper-1'),
                    'language': (None, 'en')  # Force English
                }
                
                response = requests.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers=headers,
                    files=files,
                    timeout=60
                )
            
            if response.status_code == 200:
                transcription = response.json()["text"]
                print(f"Transcribed: {transcription}", file=sys.stderr)
                
                # Check if transcription is too short or unclear
                if len(transcription.strip()) < 3:
                    print("WARNING: Transcription too short, likely unclear speech", file=sys.stderr)
                    return "UNCLEAR_SPEECH"
                
                # Check for common unclear speech patterns
                unclear_patterns = ["[inaudible]", "[unclear]", "...", "uh", "um", "hmm"]
                if any(pattern in transcription.lower() for pattern in unclear_patterns):
                    print("WARNING: Transcription contains unclear speech indicators", file=sys.stderr)
                    return "UNCLEAR_SPEECH"
                
                return transcription
            else:
                print(f"ERROR: Transcription failed: {response.text}")
                return None
                
        except Exception as e:
            print(f"ERROR transcribing audio: {e}")
            return None
    
    def get_clone_context(self, voice_id):
        """Get personality prompt and interview context from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT personality_prompt, interview_transcription 
                FROM voice_clones 
                WHERE voice_id = ?
            """, (voice_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                return {
                    'personality_prompt': result[0],
                    'interview_context': result[1] if len(result) > 1 else None
                }
            return None
            
        except Exception as e:
            print(f"ERROR fetching clone context: {e}")
            return None
    
    def generate_ai_response(self, user_message, personality_prompt, conversation_history=None):
        """Generate AI response using OpenAI"""
        try:
            import requests
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.openai_api_key}"
            }
            
            messages = [{"role": "system", "content": personality_prompt}]
            
            # Conversation history is now pre-filtered and optimized
            if conversation_history:
                messages.extend(conversation_history)
            
            messages.append({"role": "user", "content": user_message})
            
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
                timeout=60
            )
            
            if response.status_code == 200:
                ai_response = response.json()["choices"][0]["message"]["content"]
                print(f"AI Response: {ai_response}", file=sys.stderr)
                return ai_response
            else:
                print(f"ERROR: OpenAI API failed: {response.text}")
                return None
                
        except Exception as e:
            print(f"ERROR generating AI response: {e}")
            return None
    
    def generate_clarification_response(self, personality_prompt):
        """Generate a helpful response asking user to repeat themselves"""
        try:
            import requests
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.openai_api_key}"
            }
            
            clarification_prompt = f"""{personality_prompt}

IMPORTANT: The user's speech was unclear or too quiet. You need to politely ask them to repeat themselves.

Generate a SHORT, friendly response (1-2 sentences) asking them to speak more clearly or repeat what they said. Be natural and conversational.

Examples of good responses:
- "Sorry, I didn't catch that. Could you say that again?"
- "I didn't quite hear you clearly. Can you repeat that?"
- "Could you speak a bit louder? I missed what you said."

Keep it natural and in your own voice/personality."""

            data = {
                "model": "gpt-4",
                "messages": [
                    {"role": "user", "content": clarification_prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 50
            }
            
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                clarification_response = response.json()["choices"][0]["message"]["content"]
                print(f"Generated clarification response: {clarification_response}", file=sys.stderr)
                return clarification_response
            else:
                print(f"ERROR: OpenAI API failed for clarification: {response.text}")
                return "Sorry, I didn't catch that. Could you repeat what you said?"
                
        except Exception as e:
            print(f"ERROR generating clarification response: {e}")
            return "Sorry, I didn't catch that. Could you repeat what you said?"

    def generate_speech(self, voice_id, text, output_path):
        """Generate speech using ElevenLabs"""
        try:
            print(f"Generating speech for voice {voice_id}...", file=sys.stderr)
            
            audio_stream = self.elevenlabs.text_to_speech.convert(
                text=text,
                voice_id=voice_id,
                model_id="eleven_multilingual_v2"
            )
            
            # Write audio to file
            with open(output_path, 'wb') as f:
                for chunk in audio_stream:
                    f.write(chunk)
            
            print(f"Speech saved to {output_path}", file=sys.stderr)
            
            # Also save to permanent storage for learning/retraining
            self.save_permanent_audio(voice_id, output_path)
            
            return True
            
        except Exception as e:
            print(f"ERROR generating speech: {e}", file=sys.stderr)
            return False
    
    def save_permanent_audio(self, voice_id, temp_audio_path):
        """Save generated audio permanently for learning"""
        try:
            import shutil
            
            # Create permanent storage directory
            permanent_dir = os.path.join(
                os.path.dirname(__file__), 
                '..', 
                'backend', 
                'uploads', 
                'clone_responses', 
                voice_id
            )
            os.makedirs(permanent_dir, exist_ok=True)
            
            # Copy to permanent location
            filename = os.path.basename(temp_audio_path)
            permanent_path = os.path.join(permanent_dir, filename)
            shutil.copy2(temp_audio_path, permanent_path)
            
            print(f"💾 Saved permanent audio: {permanent_path}", file=sys.stderr)
            
        except Exception as e:
            print(f"WARNING: Failed to save permanent audio: {e}", file=sys.stderr)

def main():
    if len(sys.argv) < 4:
        print("Usage: python voice_to_voice.py <audio_file> <voice_id> <history_json>")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    voice_id = sys.argv[2]
    history_json = sys.argv[3] if len(sys.argv) > 3 else "[]"
    
    try:
        conversation_history = json.loads(history_json)
    except:
        conversation_history = []
    
    chat = VoiceToVoiceChat()
    
    # Step 1: Transcribe user's voice
    user_transcription = chat.transcribe_audio(audio_file)
    if not user_transcription:
        print(json.dumps({"success": False, "error": "Transcription failed"}))
        sys.exit(1)
    
    # Handle unclear speech
    if user_transcription == "UNCLEAR_SPEECH":
        print("Handling unclear speech...", file=sys.stderr)
        
        # Get clone context for personality
        context = chat.get_clone_context(voice_id)
        if not context:
            print(json.dumps({"success": False, "error": "Clone not found"}))
            sys.exit(1)
        
        personality_prompt = context['personality_prompt']
        
        # Generate clarification response
        clarification_response = chat.generate_clarification_response(personality_prompt)
        
        # Generate speech for clarification
        output_dir = os.path.join(os.path.dirname(__file__), '..', 'backend', 'public', 'generated')
        os.makedirs(output_dir, exist_ok=True)
        
        import time
        timestamp = int(time.time() * 1000)
        output_filename = f"response_{voice_id[:8]}_{timestamp}.mp3"
        output_path = os.path.join(output_dir, output_filename)
        
        if chat.generate_speech(voice_id, clarification_response, output_path):
            result = {
                "success": True,
                "user_transcription": "[Unclear speech]",
                "ai_response": clarification_response,
                "audioUrl": f"/generated/{output_filename}",
                "clarification": True
            }
            print(json.dumps(result))
            sys.exit(0)
        else:
            print(json.dumps({"success": False, "error": "Failed to generate clarification speech"}))
            sys.exit(1)
    
    # Step 2: Get clone context
    context = chat.get_clone_context(voice_id)
    if not context:
        print(json.dumps({"success": False, "error": "Clone not found"}))
        sys.exit(1)
    
    personality_prompt = context['personality_prompt']
    interview_context = context['interview_context']
    
    # Enhance prompt with interview context
    if interview_context:
        enhanced_prompt = f"""{personality_prompt}

REFERENCE - Your Own Words from the Interview:
{interview_context}

CRITICAL REMINDER:
- You ARE this person, not an AI assistant
- You have real feelings, experiences, and opinions
- NEVER say "As an AI" or "I don't have feelings/preferences"
- Keep responses SHORT (2-3 sentences) unless asked for more detail
- Answer naturally as yourself based on your background
- Stay in character at all times"""
        personality_prompt = enhanced_prompt
    
    # Step 3: Generate AI response
    ai_response = chat.generate_ai_response(user_transcription, personality_prompt, conversation_history)
    if not ai_response:
        print(json.dumps({"success": False, "error": "AI response generation failed"}))
        sys.exit(1)
    
    # Step 4: Generate speech
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'backend', 'public', 'generated')
    os.makedirs(output_dir, exist_ok=True)
    
    import time
    timestamp = int(time.time() * 1000)
    output_filename = f"response_{voice_id[:8]}_{timestamp}.mp3"
    output_path = os.path.join(output_dir, output_filename)
    
    if not chat.generate_speech(voice_id, ai_response, output_path):
        print(json.dumps({"success": False, "error": "Speech generation failed"}))
        sys.exit(1)
    
    # Return result
    result = {
        "success": True,
        "user_transcription": user_transcription,
        "ai_response": ai_response,
        "audioUrl": f"/generated/{output_filename}"
    }
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()

