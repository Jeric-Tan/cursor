# Generate Chat Response - Called by backend API
import os
import sys
import json
import requests
import sqlite3
import tempfile
import time
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

def get_personality_and_context(voice_id):
    """Get personality prompt and interview context from database"""
    try:
        db_path = os.path.join(os.path.dirname(__file__), "voice_clones.db")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT personality_prompt, interview_transcription FROM voice_clones WHERE voice_id = ?", (voice_id,))
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return {
                "personality_prompt": result[0],
                "interview_context": result[1] or ""
            }
        return None
    except Exception as e:
        print(f"Database error: {e}", file=sys.stderr)
        return None

def generate_ai_response(user_message, personality_prompt, conversation_history=None):
    """Generate AI response using OpenAI with conversation history"""
    try:
        openai_api_key = os.getenv("OPENAI_API_KEY")
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {openai_api_key}"
        }
        
        # Build messages with conversation history
        messages = [
            {"role": "system", "content": personality_prompt}
        ]
        
        # Add conversation history (last 5 exchanges to save tokens)
        if conversation_history:
            messages.extend(conversation_history[-10:])  # Last 10 messages (5 exchanges)
        
        # Add current user message
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
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()["choices"][0]["message"]["content"]
        else:
            print(f"OpenAI API error: {response.status_code}", file=sys.stderr)
            return None
            
    except Exception as e:
        print(f"Error generating AI response: {e}", file=sys.stderr)
        return None

def generate_speech(voice_id, text):
    """Generate speech using ElevenLabs"""
    try:
        import shutil
        elevenlabs = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        
        audio_stream = elevenlabs.text_to_speech.convert(
            text=text,
            voice_id=voice_id,
            model_id="eleven_multilingual_v2"
        )
        
        # Save to backend's public directory
        output_dir = os.path.join(os.path.dirname(__file__), "..", "backend", "public", "generated")
        os.makedirs(output_dir, exist_ok=True)
        
        filename = f"response_{voice_id[:8]}_{int(time.time() * 1000)}.mp3"
        output_path = os.path.join(output_dir, filename)
        
        with open(output_path, 'wb') as f:
            for chunk in audio_stream:
                f.write(chunk)
        
        # Also save to permanent storage for learning
        try:
            permanent_dir = os.path.join(os.path.dirname(__file__), "..", "backend", "uploads", "clone_responses", voice_id)
            os.makedirs(permanent_dir, exist_ok=True)
            permanent_path = os.path.join(permanent_dir, filename)
            shutil.copy2(output_path, permanent_path)
            print(f"💾 Saved permanent audio: {permanent_path}", file=sys.stderr)
        except Exception as e:
            print(f"WARNING: Failed to save permanent audio: {e}", file=sys.stderr)
        
        # Return relative URL
        return f"/generated/{filename}"
        
    except Exception as e:
        print(f"Error generating speech: {e}", file=sys.stderr)
        return None

def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_chat_response.py <voice_id> <message> [history_json] [--play]", file=sys.stderr)
        sys.exit(1)
    
    voice_id = sys.argv[1]
    user_message = sys.argv[2]
    
    # Parse conversation history if provided
    conversation_history = None
    if len(sys.argv) > 3 and sys.argv[3] != "--play":
        try:
            conversation_history = json.loads(sys.argv[3])
        except:
            conversation_history = None
    
    play_audio = "--play" in sys.argv
    
    # Get personality prompt and interview context
    clone_data = get_personality_and_context(voice_id)
    if not clone_data:
        result = {
            "error": "Voice clone not found",
            "ai_response": None,
            "audio_url": None
        }
        print(json.dumps(result))
        sys.exit(1)
    
    personality_prompt = clone_data["personality_prompt"]
    interview_context = clone_data["interview_context"]
    
    # Add interview context and strong character enforcement
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
    
    # Generate AI response with conversation history
    ai_response = generate_ai_response(user_message, personality_prompt, conversation_history)
    if not ai_response:
        result = {
            "error": "Failed to generate AI response",
            "ai_response": None,
            "audio_url": None
        }
        print(json.dumps(result))
        sys.exit(1)
    
    # Generate speech
    audio_url = generate_speech(voice_id, ai_response)
    
    # Play audio if requested
    if play_audio and audio_url:
        try:
            import pygame
            
            # Get the full path to the audio file
            audio_file_path = os.path.join(
                os.path.dirname(__file__), 
                "..", 
                "backend", 
                "public", 
                "generated",
                os.path.basename(audio_url.replace('/generated/', ''))
            )
            
            if os.path.exists(audio_file_path):
                print(f"\n🔊 Playing audio response...", file=sys.stderr)
                pygame.mixer.init()
                pygame.mixer.music.load(audio_file_path)
                pygame.mixer.music.play()
                
                # Wait for audio to finish
                while pygame.mixer.music.get_busy():
                    pygame.time.Clock().tick(10)
                
                pygame.mixer.quit()
                print(f"✅ Audio playback complete\n", file=sys.stderr)
            else:
                print(f"⚠️ Audio file not found: {audio_file_path}", file=sys.stderr)
                
        except Exception as e:
            print(f"⚠️ Error playing audio: {e}", file=sys.stderr)
    
    # Return result as JSON
    result = {
        "ai_response": ai_response,
        "audio_url": audio_url
    }
    print(json.dumps(result))
    sys.exit(0)

if __name__ == "__main__":
    main()
