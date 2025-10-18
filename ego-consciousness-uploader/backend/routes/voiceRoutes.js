// Voice routes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const voiceController = require('../controllers/voiceController');

// Configure multer for voice message uploads
const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'voice_messages');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-voice-message.wav');
  }
});

const voiceUpload = multer({ storage: voiceStorage });

// Routes
router.get('/voice-clones', voiceController.getVoiceClones.bind(voiceController));
router.post('/chat-with-voice', voiceController.chatWithVoice.bind(voiceController));
router.post('/voice-chat', voiceUpload.single('audio'), voiceController.voiceToVoiceChat.bind(voiceController));
router.get('/test-mode', voiceController.getTestMode.bind(voiceController));
router.post('/test-mode', voiceController.setTestMode.bind(voiceController));
router.get('/conversation-stats/:voiceId', voiceController.getConversationStats.bind(voiceController));
router.post('/retrain-voice', voiceController.retrainVoice.bind(voiceController));

module.exports = router;

