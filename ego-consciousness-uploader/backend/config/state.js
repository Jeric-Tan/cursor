// Application state management
const fs = require('fs');
const path = require('path');

class AppState {
  constructor() {
    this.interviewSessions = new Map();
    this.conversationSessions = new Map();
    this.useTestAudio = require('./constants').USE_TEST_AUDIO;
    this.conversationStorageDir = path.join(__dirname, '..', 'uploads', 'conversations');
    this.ensureStorageDirectory();
  }

  ensureStorageDirectory() {
    if (!fs.existsSync(this.conversationStorageDir)) {
      fs.mkdirSync(this.conversationStorageDir, { recursive: true });
    }
  }

  // Interview session methods
  createSession(sessionId) {
    this.interviewSessions.set(sessionId, {
      sessionId,
      audioFiles: [],
      currentQuestion: 0,
      createdAt: new Date()
    });
    return this.interviewSessions.get(sessionId);
  }

  getSession(sessionId) {
    return this.interviewSessions.get(sessionId);
  }

  addAudioToSession(sessionId, audioFile) {
    const session = this.getSession(sessionId);
    if (session) {
      session.audioFiles.push(audioFile);
    }
    return session;
  }

  // Conversation history methods
  getConversationHistory(conversationKey) {
    if (!this.conversationSessions.has(conversationKey)) {
      this.conversationSessions.set(conversationKey, {
        recentMessages: [],
        summary: null,
        totalExchanges: 0
      });
    }
    return this.conversationSessions.get(conversationKey);
  }

  addToConversationHistory(conversationKey, userMessage, aiResponse) {
    const session = this.getConversationHistory(conversationKey);
    session.recentMessages.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: aiResponse }
    );
    session.totalExchanges++;
    
    // Keep only last 6 messages (3 exchanges) for efficiency
    if (session.recentMessages.length > 6) {
      session.recentMessages = session.recentMessages.slice(-6);
    }

    // Store conversation to disk for retraining
    this.saveConversationToDisk(conversationKey, userMessage, aiResponse);
  }

  saveConversationToDisk(conversationKey, userMessage, aiResponse) {
    try {
      const filename = path.join(this.conversationStorageDir, `${conversationKey}.jsonl`);
      const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        user: userMessage,
        assistant: aiResponse
      }) + '\n';
      
      fs.appendFileSync(filename, entry);
      console.log(`💾 Conversation saved for voice ${conversationKey}`);
    } catch (error) {
      console.error(`Failed to save conversation: ${error.message}`);
    }
  }

  getStoredConversations(voiceId) {
    try {
      const filename = path.join(this.conversationStorageDir, `${voiceId}.jsonl`);
      if (!fs.existsSync(filename)) {
        return [];
      }
      
      const content = fs.readFileSync(filename, 'utf-8');
      return content.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    } catch (error) {
      console.error(`Failed to read stored conversations: ${error.message}`);
      return [];
    }
  }

  getConversationCount(voiceId) {
    const conversations = this.getStoredConversations(voiceId);
    return conversations.length;
  }

  // Get formatted history for API calls (optimized)
  getFormattedHistory(conversationKey) {
    const session = this.getConversationHistory(conversationKey);
    const messages = [];
    
    // Add summary if available (for older context)
    if (session.summary) {
      messages.push({ role: "system", content: `Previous conversation summary: ${session.summary}` });
    }
    
    // Add recent messages
    messages.push(...session.recentMessages);
    
    return messages;
  }

  // Test mode methods
  isTestMode() {
    return this.useTestAudio;
  }

  setTestMode(enabled) {
    this.useTestAudio = enabled;
  }
}

// Export singleton instance
module.exports = new AppState();

