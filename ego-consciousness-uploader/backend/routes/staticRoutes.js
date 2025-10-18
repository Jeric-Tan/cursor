// Static file routes
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Serve audio files
router.get('/audio/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '..', 'uploads', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Audio file not found' });
  }
});

// Serve test audio file for sample voice
router.get('/test-audio', (req, res) => {
  try {
    const testAudioPath = path.join(__dirname, '..', '..', 'elevenlabs', 'audio', 'test_audio_1.mp3');
    
    if (fs.existsSync(testAudioPath)) {
      res.sendFile(testAudioPath);
    } else {
      res.status(404).json({ error: 'Test audio file not found' });
    }
  } catch (error) {
    console.error('Error serving test audio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve sample audio for questions (placeholder)
router.get('/sample-audio/:questionIndex', (req, res) => {
  const questionIndex = parseInt(req.params.questionIndex);
  
  res.json({
    audioUrl: '/audio/sample_question.mp3',
    questionIndex
  });
});

module.exports = router;

