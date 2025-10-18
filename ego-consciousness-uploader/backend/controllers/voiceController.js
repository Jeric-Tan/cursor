// Voice controller - handles voice clone and chat operations
const voiceCloneService = require('../services/voiceCloneService');
const chatService = require('../services/chatService');
const appState = require('../config/state');

class VoiceController {
  /**
   * Get all voice clones
   */
  async getVoiceClones(req, res) {
    try {
      const clones = await voiceCloneService.getVoiceClones();
      res.json({ clones });
    } catch (error) {
      console.error('Error fetching voice clones:', error);
      res.status(500).json({ error: 'Failed to fetch voice clones' });
    }
  }

  /**
   * Chat with voice clone (text input)
   */
  async chatWithVoice(req, res) {
    try {
      const { voiceId, message, sessionId } = req.body;
      
      if (!voiceId || !message) {
        return res.status(400).json({ error: 'Voice ID and message are required' });
      }
      
      const result = await chatService.generateChatResponse(voiceId, message, sessionId);
      res.json(result);
    } catch (error) {
      console.error('Error in chat endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Voice-to-Voice chat (voice input)
   */
  async voiceToVoiceChat(req, res) {
    try {
      const { voiceId, sessionId } = req.body;
      const audioFile = req.file;
      
      if (!voiceId || !audioFile) {
        return res.status(400).json({ error: 'Voice ID and audio file are required' });
      }
      
      const result = await chatService.voiceToVoiceChat(voiceId, audioFile.path, sessionId);
      res.json(result);
    } catch (error) {
      console.error('Error in voice chat endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get test mode status
   */
  getTestMode(req, res) {
    const useTestAudio = appState.isTestMode();
    res.json({ 
      useTestAudio,
      message: useTestAudio 
        ? 'Test mode ON - Using kzf_recording.mp3 for voice cloning' 
        : 'Test mode OFF - Using real user recordings'
    });
  }

  /**
   * Toggle test mode
   */
  setTestMode(req, res) {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    
    appState.setTestMode(enabled);
    console.log(`🔄 Test mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
    
    res.json({ 
      useTestAudio: enabled,
      message: enabled 
        ? '✅ Test mode enabled - Will use kzf_recording.mp3' 
        : '✅ Test mode disabled - Will use real recordings'
    });
  }

  /**
   * Get conversation statistics for a voice
   */
  getConversationStats(req, res) {
    const { voiceId } = req.params;
    
    if (!voiceId) {
      return res.status(400).json({ error: 'Voice ID is required' });
    }
    
    const count = appState.getConversationCount(voiceId);
    const conversations = appState.getStoredConversations(voiceId);
    
    res.json({
      voiceId,
      totalConversations: count,
      recentConversations: conversations.slice(-10)
    });
  }

  /**
   * Manually trigger voice retraining
   */
  async retrainVoice(req, res) {
    try {
      const { voiceId } = req.body;
      
      if (!voiceId) {
        return res.status(400).json({ error: 'Voice ID is required' });
      }
      
      const result = await voiceCloneService.retrainVoice(voiceId);
      res.json(result);
    } catch (error) {
      console.error('Error retraining voice:', error);
      res.status(500).json({ error: 'Failed to retrain voice' });
    }
  }
}

module.exports = new VoiceController();

