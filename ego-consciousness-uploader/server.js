// JAKE/ZHENGFENG: Express server setup

import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import {
  handleStart,
  handleUploadPictures,
  handleUploadVoice,
  handleGetStatus,
  handleChat,
  handleVoiceQuestion,
  handleWebhook
} from './backend/api-endpoints.js';

// Load environment variables
dotenv.config();

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Clean up data folders on startup
function cleanupDataFolders() {
  const foldersToClean = [
    path.join(__dirname, 'data', 'audio'),
    path.join(__dirname, 'data', 'photos'),
    path.join(__dirname, 'data', 'voices'),
    path.join(__dirname, 'data', 'transcriptions'),
    path.join(__dirname, 'data', 'generated-audio'),
    path.join(__dirname, 'data', 'conversation'),
    path.join(__dirname, 'data', 'scraped'),
    path.join(__dirname, 'data', 'vector-stores')
  ];

  console.log('🧹 Cleaning up data folders...');
  
  foldersToClean.forEach(folderPath => {
    try {
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
        console.log(`  ✓ Cleared: ${path.basename(folderPath)}/`);
      }
      fs.mkdirSync(folderPath, { recursive: true });
    } catch (error) {
      console.error(`  ✗ Error cleaning ${path.basename(folderPath)}:`, error.message);
    }
  });
  
  // Delete master vector store file
  const vectorStoreFile = path.join(__dirname, 'data', 'vector-store.json');
  try {
    if (fs.existsSync(vectorStoreFile)) {
      fs.unlinkSync(vectorStoreFile);
      console.log('  ✓ Cleared: vector-store.json');
    }
  } catch (error) {
    console.error('  ✗ Error cleaning vector-store.json:', error.message);
  }
  
  console.log('✓ All data reset\n');
}

// Run cleanup on startup
cleanupDataFolders();

// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

// Serve frontend static files with proper MIME types
app.use(express.static(path.join(__dirname, 'frontend'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Serve shared directory for module imports
app.use('/shared', express.static(path.join(__dirname, 'shared'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// API Routes
app.post('/api/start', handleStart);
app.post('/api/upload-pictures', handleUploadPictures);
app.post('/api/upload-voice', handleUploadVoice);
app.get('/api/status', handleGetStatus);
app.post('/api/chat', handleChat);
app.post('/api/voice-question', handleVoiceQuestion);
app.post('/api/webhook', handleWebhook);

// Serve index.html for all other routes (SPA) - but exclude API routes and static files
app.get('*', (req, res, next) => {
  // Skip if it's an API route
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Skip if it's a static file (js, css, etc.)
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    return next();
  }
  
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
