// JERIC/JASPER: ElevenLabs voice cloning and text-to-speech

import { mockElevenLabs } from './mock-data.js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const USE_MOCK = !ELEVENLABS_API_KEY;

if (USE_MOCK) {
  console.log('⚠️  Running in DEMO MODE - Using mock ElevenLabs (no real voice cloning)');
}

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

/**
 * Clone a voice from audio files
 * @param {Array<{path: string, data: Buffer}>} audioFiles - Array of audio files
 * @param {string} name - Name for the cloned voice
 * @returns {Promise<string>} - Voice ID
 */
export async function cloneVoiceFromFiles(audioFiles, name) {
  if (USE_MOCK) return mockElevenLabs.cloneVoice('mock-url', name);

  try {
    console.log(`🎵 Cloning voice: ${name} with ${audioFiles.length} audio samples`);

    const FormData = (await import('form-data')).default;
    const formData = new FormData();

    // Add voice name and description
    formData.append('name', name);
    formData.append('description', `Voice cloned from ${audioFiles.length} audio samples`);

    // Add all audio files - try WebM format (browser's native format)
    audioFiles.forEach((file, index) => {
      const filename = file.filename || `audio-${index + 1}.webm`;
      formData.append('files', file.data, {
        filename: filename,
        contentType: 'audio/webm'
      });
      console.log(`📁 Added ${filename} (${file.data.length} bytes)`);
    });

    const response = await fetch(`${ELEVENLABS_API_URL}/voices/add`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs API Response: ${errorText}`);
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log(`✓ Voice cloned successfully: ${data.voice_id}`);
    return data.voice_id;

  } catch (error) {
    console.error('Error cloning voice:', error);
    console.warn('⚠️  Voice cloning failed, continuing without cloned voice');
    return null; // Return null instead of throwing error
  }
}

/**
 * Clone a voice from an audio URL (legacy function for compatibility)
 * @param {string} audioUrl - URL of the voice sample
 * @param {string} name - Name for the cloned voice
 * @returns {Promise<string>} - Voice ID
 */
export async function cloneVoice(audioUrl, name) {
  if (USE_MOCK) return mockElevenLabs.cloneVoice(audioUrl, name);
  throw new Error('Use cloneVoiceFromFiles instead');
}

/**
 * Convert text to speech using a cloned voice
 * @param {string} text - Text to convert
 * @param {string} voiceId - ElevenLabs voice ID
 * @returns {Promise<string>} - URL of the generated audio
 */
export async function textToSpeech(text, voiceId) {
  if (USE_MOCK) return mockElevenLabs.textToSpeech(text, voiceId);

  // If no voice ID, use default ElevenLabs voice
  if (!voiceId) {
    console.warn('⚠️  No cloned voice ID available, using default ElevenLabs voice');
    // Use a default ElevenLabs voice ID (Adam voice)
    voiceId = 'pNInz6obpgDQGcFmaJgB';
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs TTS error: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    // Save to local storage for now
    const audioDir = path.join(__dirname, '..', 'data', 'generated-audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    const filename = `tts-${Date.now()}.mp3`;
    const filepath = path.join(audioDir, filename);
    fs.writeFileSync(filepath, Buffer.from(audioBuffer));
    
    // Return relative URL
    return `/generated-audio/${filename}`;

  } catch (error) {
    console.error('Error in text-to-speech:', error);
    throw new Error('Failed to generate speech');
  }
}

/**
 * Transcribe audio file using OpenAI Whisper
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<string>} - Transcribed text
 */
export async function transcribeAudio(audioPath) {
  if (!openai) {
    console.warn('⚠️  OpenAI API key not set, skipping transcription');
    return '';
  }

  try {
    const audioFile = fs.createReadStream(audioPath);
    const transcript = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',  // Force English transcription
      response_format: 'text'
    });

    return transcript;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw new Error('Failed to transcribe audio');
  }
}

/**
 * Transcribe all audio files in a session
 * @param {string} sessionId - Session ID
 * @param {Array<{path: string, question: string, filename: string}>} audioFiles - Audio file info
 * @returns {Promise<Array<{question: string, transcription: string}>>}
 */
export async function transcribeSession(sessionId, audioFiles) {
  if (!openai) {
    console.warn('⚠️  OpenAI API key not set, skipping transcription');
    return audioFiles.map(f => ({ question: f.question, transcription: '' }));
  }

  console.log(`🎙️  Transcribing ${audioFiles.length} audio files for session: ${sessionId}`);
  
  const transcriptions = [];
  
  for (const file of audioFiles) {
    try {
      console.log(`  Transcribing: ${file.filename}`);
      const text = await transcribeAudio(file.path);
      transcriptions.push({
        question: file.question,
        transcription: text
      });
      console.log(`  ✓ Transcribed: ${file.filename}`);
    } catch (error) {
      console.error(`  ✗ Failed to transcribe ${file.filename}:`, error.message);
      transcriptions.push({
        question: file.question,
        transcription: ''
      });
    }
  }

  // Save transcriptions to file
  const transcriptionsDir = path.join(__dirname, '..', 'data', 'transcriptions', sessionId);
  if (!fs.existsSync(transcriptionsDir)) {
    fs.mkdirSync(transcriptionsDir, { recursive: true });
  }

  const transcriptionsPath = path.join(transcriptionsDir, 'transcriptions.json');
  fs.writeFileSync(transcriptionsPath, JSON.stringify(transcriptions, null, 2));
  console.log(`✓ Transcriptions saved to: ${transcriptionsPath}`);

  return transcriptions;
}
