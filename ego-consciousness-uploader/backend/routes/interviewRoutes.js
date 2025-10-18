// Interview routes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const interviewController = require('../controllers/interviewController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Routes
router.post('/start-interview', interviewController.startInterview.bind(interviewController));
router.post('/upload-audio', upload.single('audio'), interviewController.uploadAudio.bind(interviewController));
router.post('/complete-interview', interviewController.completeInterview.bind(interviewController));
router.get('/session/:sessionId', interviewController.getSession.bind(interviewController));

module.exports = router;

