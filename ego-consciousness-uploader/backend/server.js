// Express.js Backend for AI Clone MVP - Refactored
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import configuration
const { PORT } = require('./config/constants');
const appState = require('./config/state');

// Import routes
const interviewRoutes = require('./routes/interviewRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const staticRoutes = require('./routes/staticRoutes');

// Import services
const retrainingScheduler = require('./services/retrainingScheduler');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve generated audio files
app.use('/generated', express.static(path.join(__dirname, 'public', 'generated')));

// API Routes
app.use('/api', interviewRoutes);
app.use('/api', voiceRoutes);
app.use('/api', staticRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    testMode: appState.isTestMode(),
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📝 Make sure to set up your .env file with API keys`);
  console.log(`\n🧪 Test Mode: ${appState.isTestMode() ? '✅ ENABLED' : '❌ DISABLED'}`);
  if (appState.isTestMode()) {
    console.log(`   → Using kzf_recording.mp3 for voice cloning`);
    console.log(`   → Toggle: POST /api/test-mode with {"enabled": false}`);
  } else {
    console.log(`   → Using real user recordings`);
    console.log(`   → Toggle: POST /api/test-mode with {"enabled": true}`);
  }
  
  console.log(`\n🔄 Starting automatic voice retraining scheduler...`);
  console.log(`   → Checks every 6 hours for voices needing retraining`);
  console.log(`   → Minimum 20 conversations required for retrain`);
  retrainingScheduler.start();
  
  console.log('');
});

