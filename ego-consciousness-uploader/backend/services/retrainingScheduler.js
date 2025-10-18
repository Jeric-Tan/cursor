// Automatic voice retraining scheduler
const voiceCloneService = require('./voiceCloneService');
const appState = require('../config/state');

class RetrainingScheduler {
  constructor() {
    this.checkInterval = 6 * 60 * 60 * 1000; // Check every 6 hours
    this.minConversationsForRetrain = 1; // Learn from EVERY conversation
    this.timer = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('Retraining scheduler already running');
      return;
    }

    console.log('Starting automatic voice retraining scheduler');
    this.isRunning = true;
    
    // Run initial check after 1 minute
    setTimeout(() => this.checkAndRetrain(), 60000);
    
    // Then run periodic checks
    this.timer = setInterval(() => this.checkAndRetrain(), this.checkInterval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('🛑 Stopped automatic voice retraining scheduler');
  }

  async checkAndRetrain() {
    console.log('🔍 Checking for voices that need retraining...');
    
    try {
      const clones = await voiceCloneService.getVoiceClones();
      
      for (const clone of clones) {
        const voiceId = clone.voice_id;
        const conversationCount = appState.getConversationCount(voiceId);
        
        console.log(`📊 Voice ${clone.name}: ${conversationCount} conversations`);
        
        if (conversationCount >= this.minConversationsForRetrain) {
          console.log(`🔄 Voice ${clone.name} has ${conversationCount} conversations, triggering retrain...`);
          
          try {
            const result = await voiceCloneService.retrainVoice(voiceId);
            
            if (result.success) {
              console.log(`✅ Successfully retrained voice ${clone.name}`);
              console.log(`   Old ID: ${result.old_voice_id}`);
              console.log(`   New ID: ${result.new_voice_id}`);
            } else {
              console.log(`⚠️ Failed to retrain voice ${clone.name}: ${result.error}`);
            }
          } catch (error) {
            console.error(`❌ Error retraining voice ${clone.name}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in retraining check:', error);
    }
  }

  // Manual trigger for testing
  async triggerManualCheck() {
    console.log('🔧 Manual retraining check triggered');
    await this.checkAndRetrain();
  }
}

// Export singleton instance
module.exports = new RetrainingScheduler();

