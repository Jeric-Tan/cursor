// Voice clone service - handles voice clone creation and retrieval
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const appState = require('../config/state');

class VoiceCloneService {
  /**
   * Create a voice clone from session audio
   */
  async createVoiceClone(sessionId) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, '..', '..', 'elevenlabs', 'create_clone.py');
      const pythonProcess = spawn('python', [pythonScript, sessionId]);
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log(data.toString());
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error(data.toString());
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          reject(new Error(errorOutput || 'Voice clone creation failed'));
        }
      });
    });
  }

  /**
   * Get all active voice clones from database
   */
  async getVoiceClones() {
    return new Promise((resolve, reject) => {
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = path.join(__dirname, '..', '..', 'elevenlabs', 'voice_clones.db');
      
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          return reject(err);
        }
      });
      
      db.all('SELECT * FROM voice_clones WHERE status = ?', ['active'], (err, rows) => {
        db.close();
        
        if (err) {
          return reject(err);
        }
        
        const clones = rows.map(row => ({
          id: row.voice_id,
          name: row.user_name,
          voice_id: row.voice_id,
          created_at: row.created_at
        }));
        
        resolve(clones);
      });
    });
  }

  /**
   * Replace user audio with test audio if test mode is enabled
   */
  replaceWithTestAudio(audioFiles) {
    if (!appState.isTestMode()) {
      console.log('✅ REAL MODE: Using actual user recordings for voice cloning');
      return;
    }

    console.log('🧪 TEST MODE ENABLED: Replacing user audio with kzf_recording.mp3...');
    console.log(`   Audio files to replace: ${audioFiles.length}`);
    
    const testAudioPath = path.join(__dirname, '..', 'test', 'kzf_recording.mp3');
    console.log(`   Test audio path: ${testAudioPath}`);
    console.log(`   Test audio exists: ${fs.existsSync(testAudioPath)}`);
    
    if (!fs.existsSync(testAudioPath)) {
      console.log('⚠️ Test audio file not found, using original user audio');
      console.log(`   Looked for: ${testAudioPath}`);
      return;
    }

    // Copy test audio to replace user recordings
    for (let i = 0; i < audioFiles.length; i++) {
      const userAudioPath = audioFiles[i].path;
      const backupPath = userAudioPath + '.backup';
      
      // Backup original user audio
      fs.copyFileSync(userAudioPath, backupPath);
      console.log(`   📁 Backed up: ${backupPath}`);
      
      // Replace with test audio
      fs.copyFileSync(testAudioPath, userAudioPath);
      console.log(`   🔄 Replaced: ${userAudioPath}`);
    }
    
    console.log('✅ All user audio replaced with kzf_recording.mp3');
  }

  /**
   * Retrain voice with new conversation data
   */
  async retrainVoice(voiceId) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, '..', '..', 'elevenlabs', 'retrain_voice.py');
      const pythonProcess = spawn('python', [pythonScript, voiceId]);
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log(data.toString());
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error(data.toString());
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0 && output) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (e) {
            reject(new Error('Failed to parse retraining output'));
          }
        } else {
          reject(new Error(errorOutput || 'Voice retraining failed'));
        }
      });
    });
  }
}

module.exports = new VoiceCloneService();

