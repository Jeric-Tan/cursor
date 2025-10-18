// Interview controller - handles interview session logic
const appState = require('../config/state');
const { INTERVIEW_QUESTIONS } = require('../config/constants');
const voiceCloneService = require('../services/voiceCloneService');

class InterviewController {
  /**
   * Start a new interview session
   */
  startInterview(req, res) {
    try {
      const sessionId = `session_${Date.now()}`;
      const session = appState.createSession(sessionId);
      
      console.log(`📝 Started interview session: ${sessionId}`);
      
      res.json({
        sessionId: session.sessionId,
        questions: INTERVIEW_QUESTIONS,
        currentQuestion: 0
      });
    } catch (error) {
      console.error('Error starting interview:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Upload audio for a question
   */
  uploadAudio(req, res) {
    try {
      const { sessionId, questionIndex } = req.body;
      const audioFile = req.file;
      
      if (!sessionId || questionIndex === undefined || !audioFile) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const session = appState.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Add audio file to session
      appState.addAudioToSession(sessionId, {
        questionIndex: parseInt(questionIndex),
        path: audioFile.path,
        filename: audioFile.filename
      });
      
      console.log(`🎤 Audio uploaded for session ${sessionId}, question ${questionIndex}`);
      
      res.json({
        success: true,
        sessionId,
        questionIndex: parseInt(questionIndex),
        audioPath: audioFile.path
      });
    } catch (error) {
      console.error('Error uploading audio:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Complete interview and create voice clone
   */
  async completeInterview(req, res) {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      const session = appState.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      if (session.audioFiles.length !== INTERVIEW_QUESTIONS.length) {
        return res.status(400).json({ error: 'The question must be answered' });
      }
      
      // Replace with test audio if test mode is enabled
      voiceCloneService.replaceWithTestAudio(session.audioFiles);
      
      // Trigger voice clone creation
      console.log(`🎯 Creating voice clone for session: ${sessionId}`);
      
      try {
        await voiceCloneService.createVoiceClone(sessionId);
        
        res.json({
          success: true,
          message: 'Voice clone created successfully',
          sessionId
        });
      } catch (error) {
        console.error('Voice clone creation error:', error);
        res.status(500).json({ error: 'Voice clone creation failed' });
      }
    } catch (error) {
      console.error('Error completing interview:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get session info
   */
  getSession(req, res) {
    try {
      const { sessionId } = req.params;
      const session = appState.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      res.json({
        sessionId: session.sessionId,
        audioFilesCount: session.audioFiles.length,
        totalQuestions: INTERVIEW_QUESTIONS.length,
        completed: session.audioFiles.length === INTERVIEW_QUESTIONS.length
      });
    } catch (error) {
      console.error('Error getting session:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new InterviewController();

