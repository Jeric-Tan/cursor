// Chat service - handles AI chat responses
const path = require('path');
const { spawn } = require('child_process');
const appState = require('../config/state');

class ChatService {
  /**
   * Generate AI response and speech for a chat message (text input)
   */
  async generateChatResponse(voiceId, message, sessionId = null) {
    const conversationKey = sessionId || voiceId;
    const history = appState.getFormattedHistory(conversationKey);
    
    console.log(`💬 Chat request: voice=${voiceId}, session=${conversationKey}, history=${history.length} messages`);
    
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, '..', '..', 'elevenlabs', 'generate_chat_response.py');
      const historyJson = JSON.stringify(history);
      const pythonProcess = spawn('python', [pythonScript, voiceId, message, historyJson]);
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0 && output) {
          try {
            const result = JSON.parse(output);
            
            // Save to conversation history
            appState.addToConversationHistory(conversationKey, message, result.ai_response);
            
            // Learn from this conversation (async, don't wait)
            this.learnFromConversation(voiceId, message, result.ai_response);
            
            resolve({
              success: true,
              message: result.ai_response,
              audioUrl: result.audio_url || null
            });
          } catch (e) {
            reject(new Error('Failed to parse Python output: ' + e.message));
          }
        } else {
          reject(new Error(errorOutput || 'Failed to generate response'));
        }
      });
    });
  }

  /**
   * Voice-to-Voice chat (voice input)
   */
  async voiceToVoiceChat(voiceId, audioPath, sessionId = null) {
    const conversationKey = sessionId || voiceId;
    const history = appState.getFormattedHistory(conversationKey);
    
    console.log(`🎤 Voice chat request: voice=${voiceId}, session=${conversationKey}, history=${history.length} messages`);
    console.log(`Audio path: ${audioPath}`);
    console.log(`Python script: ${path.join(__dirname, '..', '..', 'elevenlabs', 'voice_to_voice.py')}`);
    
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, '..', '..', 'elevenlabs', 'voice_to_voice.py');
      const historyJson = JSON.stringify(history);
      console.log(`Spawning Python process with args: [${pythonScript}, ${audioPath}, ${voiceId}, ${historyJson}]`);
      const pythonProcess = spawn('python', [pythonScript, audioPath, voiceId, historyJson]);
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code: ${code}`);
        console.log(`Python stdout: ${output}`);
        console.log(`Python stderr: ${errorOutput}`);
        
        if (code === 0 && output) {
          try {
            const result = JSON.parse(output);
            console.log(`Parsed result:`, result);
            
            if (result.success) {
              // Save to conversation history
              appState.addToConversationHistory(conversationKey, result.user_transcription, result.ai_response);
              
              // Learn from this conversation (async, don't wait)
              this.learnFromConversation(voiceId, result.user_transcription, result.ai_response);
              
              resolve({
                success: true,
                user_transcription: result.user_transcription,
                ai_response: result.ai_response,
                audioUrl: result.audioUrl
              });
            } else {
              console.log(`Python script returned success=false:`, result.error);
              reject(new Error(result.error || 'Voice-to-voice chat failed'));
            }
          } catch (e) {
            console.log(`Failed to parse Python output:`, e.message);
            console.log(`Raw output was:`, output);
            reject(new Error('Failed to parse Python output: ' + e.message));
          }
        } else {
          console.log(`Python process failed with code ${code}`);
          console.log(`Output:`, output);
          console.log(`Error:`, errorOutput);
          reject(new Error(errorOutput || 'Failed to process voice message'));
        }
      });
    });
  }

  /**
   * Learn from conversation - update personality after each interaction
   */
  async learnFromConversation(voiceId, userMessage, aiResponse) {
    try {
      console.log(`🧠 Learning from conversation for voice ${voiceId}...`);
      
      const pythonScript = path.join(__dirname, '..', '..', 'elevenlabs', 'learn_from_conversation.py');
      const pythonProcess = spawn('python', [pythonScript, voiceId, userMessage, aiResponse]);
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        // Log learning process
        const msg = data.toString().trim();
        if (msg) console.log(`  ${msg}`);
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0 && output) {
          try {
            const result = JSON.parse(output);
            if (result.success && result.learned) {
              console.log(`✅ Learned: ${result.learning}`);
            } else if (result.success) {
              console.log(`ℹ️ No new learning from this conversation`);
            }
          } catch (e) {
            console.log(`⚠️ Learning process completed with warnings`);
          }
        }
      });
      
    } catch (error) {
      console.error('⚠️ Learning process error (non-critical):', error.message);
    }
  }
}

module.exports = new ChatService();

