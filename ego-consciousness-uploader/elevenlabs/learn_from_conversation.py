"""
Learn from Conversation - Update personality after each interaction
Analyzes conversation and updates the AI's personality/knowledge
"""

import os
import sys
import json
import sqlite3
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

class ConversationLearner:
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.db_path = os.path.join(os.path.dirname(__file__), "voice_clones.db")
    
    def get_current_personality(self, voice_id):
        """Get current personality prompt from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT personality_prompt, interview_transcription
                FROM voice_clones 
                WHERE voice_id = ? AND status = 'active'
            """, (voice_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                return {
                    'personality_prompt': result[0],
                    'interview_transcription': result[1]
                }
            return None
            
        except Exception as e:
            print(f"ERROR fetching personality: {e}", file=sys.stderr)
            return None
    
    def analyze_conversation(self, user_message, ai_response, current_personality):
        """Analyze conversation and generate learning insights"""
        try:
            import requests
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.openai_api_key}"
            }
            
            analysis_prompt = f"""Analyze this conversation and extract any NEW information learned about the user or context that should be remembered.

Current Personality/Knowledge:
{current_personality}

Latest Conversation:
User: {user_message}
AI: {ai_response}

Task: Extract ONLY new, meaningful information that should be added to the AI's knowledge base.
- User preferences, interests, or facts about them
- Important context that should be remembered
- Corrections or clarifications
- Do NOT repeat existing information
- Keep it concise (1-3 sentences max)

If there's nothing new to learn, respond with: "NO_NEW_LEARNING"

New learning:"""

            data = {
                "model": "gpt-4",
                "messages": [
                    {"role": "user", "content": analysis_prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 150
            }
            
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                learning = response.json()["choices"][0]["message"]["content"].strip()
                print(f"📚 Learning extracted: {learning}", file=sys.stderr)
                return learning if learning != "NO_NEW_LEARNING" else None
            else:
                print(f"ERROR: OpenAI API failed: {response.status_code}", file=sys.stderr)
                return None
                
        except Exception as e:
            print(f"ERROR analyzing conversation: {e}", file=sys.stderr)
            return None
    
    def update_personality(self, voice_id, new_learning):
        """Update personality prompt with new learning"""
        try:
            current = self.get_current_personality(voice_id)
            if not current:
                print("ERROR: Voice not found", file=sys.stderr)
                return False
            
            # Append new learning to personality prompt
            updated_prompt = f"""{current['personality_prompt']}

LEARNED FROM CONVERSATIONS (Updated {datetime.now().strftime('%Y-%m-%d %H:%M')}):
{new_learning}"""
            
            # Update database
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE voice_clones 
                SET personality_prompt = ?
                WHERE voice_id = ? AND status = 'active'
            """, (updated_prompt, voice_id))
            
            conn.commit()
            conn.close()
            
            print(f"✅ Personality updated for voice {voice_id}", file=sys.stderr)
            return True
            
        except Exception as e:
            print(f"ERROR updating personality: {e}", file=sys.stderr)
            return False
    
    def learn_from_conversation(self, voice_id, user_message, ai_response):
        """Main learning function - analyze and update"""
        print(f"🧠 Learning from conversation for voice {voice_id}...", file=sys.stderr)
        
        # Get current personality
        current = self.get_current_personality(voice_id)
        if not current:
            return {"success": False, "error": "Voice not found"}
        
        # Analyze conversation for new learning
        new_learning = self.analyze_conversation(
            user_message, 
            ai_response, 
            current['personality_prompt']
        )
        
        if not new_learning:
            print("ℹ️ No new learning from this conversation", file=sys.stderr)
            return {"success": True, "learned": False, "message": "No new information"}
        
        # Update personality with new learning
        success = self.update_personality(voice_id, new_learning)
        
        if success:
            return {
                "success": True, 
                "learned": True, 
                "learning": new_learning
            }
        else:
            return {"success": False, "error": "Failed to update personality"}

def main():
    if len(sys.argv) < 4:
        print("Usage: python learn_from_conversation.py <voice_id> <user_message> <ai_response>")
        sys.exit(1)
    
    voice_id = sys.argv[1]
    user_message = sys.argv[2]
    ai_response = sys.argv[3]
    
    learner = ConversationLearner()
    result = learner.learn_from_conversation(voice_id, user_message, ai_response)
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()

