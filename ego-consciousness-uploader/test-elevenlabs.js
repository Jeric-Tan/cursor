// Test ElevenLabs API call
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

console.log('API Key:', ELEVENLABS_API_KEY ? 'Set' : 'Not set');
console.log('API URL:', ELEVENLABS_API_URL);

// Test with a simple audio file if it exists
const testAudioPath = path.join(__dirname, 'data', 'audio');
if (fs.existsSync(testAudioPath)) {
  const sessions = fs.readdirSync(testAudioPath);
  if (sessions.length > 0) {
    const latestSession = sessions[sessions.length - 1];
    const audioFiles = fs.readdirSync(path.join(testAudioPath, latestSession))
      .filter(file => file.endsWith('.webm'));
    
    if (audioFiles.length > 0) {
      console.log(`Found ${audioFiles.length} audio files in session: ${latestSession}`);
      console.log('Audio files:', audioFiles);
      
      // Test the API call
      testElevenLabsAPI(path.join(testAudioPath, latestSession, audioFiles[0]));
    }
  }
}

async function testElevenLabsAPI(audioFilePath) {
  try {
    console.log(`\nTesting ElevenLabs API with: ${audioFilePath}`);
    
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    
    // Add voice name and description
    formData.append('name', 'Test Voice');
    formData.append('description', 'Test voice cloning');
    
    // Add audio file - try different methods
    const audioData = fs.readFileSync(audioFilePath);
    
    // Method 1: Simple append
    formData.append('files', audioData, 'test.webm');
    
    // Method 2: With options (commented out for now)
    // formData.append('files', audioData, {
    //   filename: 'test.webm',
    //   contentType: 'audio/webm'
    // });
    
    console.log(`Audio file size: ${audioData.length} bytes`);
    
    // Try different endpoints
    const endpoints = ['/voices', '/voices/add'];
    
    for (const endpoint of endpoints) {
      console.log(`\nTrying endpoint: ${ELEVENLABS_API_URL}${endpoint}`);
      
      const response = await fetch(`${ELEVENLABS_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          ...formData.getHeaders()
        },
        body: formData
      });
      
      console.log(`Response status: ${response.status}`);
      const responseText = await response.text();
      console.log(`Response: ${responseText}`);
      
      if (response.ok) {
        console.log('✅ SUCCESS!');
        break;
      } else {
        console.log('❌ Failed');
      }
    }
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}
