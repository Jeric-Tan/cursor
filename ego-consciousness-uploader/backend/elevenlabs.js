// JERIC/JASPER: ElevenLabs voice cloning and text-to-speech

import { mockElevenLabs } from './mock-data.js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Initialize ElevenLabs client
const elevenlabs = ELEVENLABS_API_KEY ? new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY }) : null;
const USE_MOCK = !ELEVENLABS_API_KEY;

if (USE_MOCK) {
  console.log('⚠️  Running in DEMO MODE - Using mock ElevenLabs (no real voice cloning)');
}

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

/**
 * Combine multiple audio files into one MP3 file
 * @param {Array<Buffer>} audioBuffers - Array of audio data buffers
 * @param {string} outputPath - Path for the combined MP3 file
 * @returns {Promise<string>} - Path to the combined MP3 file
 */
async function combineAudioFilesToMP3(audioBuffers, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`🎵 Combining ${audioBuffers.length} audio files into: ${outputPath}`);
    
    const tempDir = path.join(__dirname, '..', 'data', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create individual temp files for each audio buffer
    const tempFiles = [];
    const fileListPath = path.join(tempDir, `filelist_${Date.now()}.txt`);
    
    try {
      // Write each audio buffer to a temp file
      audioBuffers.forEach((buffer, index) => {
        const tempPath = path.join(tempDir, `temp_${Date.now()}_${index}.webm`);
        fs.writeFileSync(tempPath, buffer);
        tempFiles.push(tempPath);
      });
      
      // Create file list for ffmpeg concat
      const fileListContent = tempFiles.map(file => `file '${file.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(fileListPath, fileListContent);
      
      // Use ffmpeg to combine files
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'concat',
        '-safe', '0',
        '-i', fileListPath,
        '-acodec', 'mp3',
        '-ab', '128k',
        '-y', // Overwrite output file
        outputPath
      ]);
      
      ffmpeg.on('close', (code) => {
        // Clean up temp files
        tempFiles.forEach(file => {
          try {
            fs.unlinkSync(file);
          } catch (e) {
            console.warn('Could not delete temp file:', file);
          }
        });
        
        try {
          fs.unlinkSync(fileListPath);
        } catch (e) {
          console.warn('Could not delete file list:', fileListPath);
        }
        
        if (code === 0) {
          console.log(`✓ Successfully combined audio files into: ${outputPath}`);
          resolve(outputPath);
        } else {
          reject(new Error(`ffmpeg failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.warn(`ffmpeg not available, trying alternative approach: ${error.message}`);
        
        // Clean up temp files
        tempFiles.forEach(file => {
          try {
            fs.unlinkSync(file);
          } catch (e) {
            console.warn('Could not delete temp file:', file);
          }
        });
        
        try {
          fs.unlinkSync(fileListPath);
        } catch (e) {
          console.warn('Could not delete file list:', fileListPath);
        }
        
        // Fallback: just concatenate the buffers and save as MP3
        try {
          const combinedBuffer = Buffer.concat(audioBuffers);
          fs.writeFileSync(outputPath, combinedBuffer);
          console.log(`✓ Combined audio files using buffer concatenation: ${outputPath}`);
          resolve(outputPath);
        } catch (fallbackError) {
          reject(new Error(`Failed to combine files: ${fallbackError.message}`));
        }
      });
      
    } catch (error) {
      reject(new Error(`Failed to prepare files for combination: ${error.message}`));
    }
  });
}

/**
 * Clone a voice from audio files
 * @param {Array<{path: string, data: Buffer}>} audioFiles - Array of audio files
 * @param {string} name - Name for the cloned voice
 * @returns {Promise<string>} - Voice ID
 */
export async function cloneVoiceFromFiles(audioFiles, name) {
  if (USE_MOCK) return mockElevenLabs.cloneVoice('mock-url', name);

  if (!elevenlabs) {
    console.error('ElevenLabs client not initialized');
    return null;
  }

  try {
    console.log(`🎵 Cloning voice: ${name} with ${audioFiles.length} audio samples`);

    // Create temp files for each audio buffer
    const tempDir = path.join(__dirname, '..', 'data', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const fileStreams = audioFiles.map((file, index) => {
      // Create temp file for each buffer
      const tempPath = path.join(tempDir, `temp_${Date.now()}_${index}.webm`);
      fs.writeFileSync(tempPath, file.data);
      console.log(`📁 Created temp file ${index + 1}: ${tempPath} (${file.data.length} bytes)`);
      
      return fs.createReadStream(tempPath);
    });
    
    console.log(`🎤 Creating voice with ${fileStreams.length} individual files...`);
    console.log(`🎤 Voice name: ${name}`);
    console.log(`🎤 Audio file sizes: ${audioFiles.map(f => f.data.length).join(', ')} bytes`);
    
    // Use IVC with better description
    const voice = await elevenlabs.voices.ivc.create({
      name: name,
      files: fileStreams,
      description: `Natural conversational voice cloned from ${audioFiles.length} samples. Captures personality, tone, and emotional range for authentic human-like speech.`
    });
    
    console.log(`✅ Voice cloned successfully!`);
    console.log(`✅ Voice ID: ${voice.voiceId}`);
    console.log(`✅ Voice Name: ${voice.name || name}`);
    console.log(`⚠️  IMPORTANT: This voice ID must be saved to the user profile!`);
    
    return voice.voiceId;

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

  if (!elevenlabs) {
    console.error('ElevenLabs client not initialized');
    throw new Error('ElevenLabs client not available');
  }

  // If no voice ID, use default ElevenLabs voice
  if (!voiceId) {
    console.warn('⚠️  No cloned voice ID available, using default ElevenLabs voice');
    console.warn('⚠️  THIS MEANS VOICE CLONING FAILED OR VOICE ID WAS NOT SAVED!');
    // Use a default ElevenLabs voice ID (Adam voice)
    voiceId = 'pNInz6obpgDQGcFmaJgB';
  }

  try {
    console.log(`🎤 Generating speech for voice: ${voiceId}`);
    console.log(`🎤 Is this a cloned voice? ${voiceId !== 'pNInz6obpgDQGcFmaJgB' ? 'YES (cloned)' : 'NO (default voice)'}`);
    
    // Use ElevenLabs SDK for text-to-speech with enhanced settings
    console.log(`🎛️  Voice Settings: stability=0.30, similarity_boost=0.90 (expressive + accurate)`);
    
    const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
      text: text,
      model_id: 'eleven_turbo_v2_5', // Use latest turbo model for better quality
      voice_settings: {
        stability: 0.30,           // Lower = more dynamic/expressive (0-1)
        similarity_boost: 0.90,    // Higher = closer to cloned voice (0-1)
        style: 0.40,               // Exaggeration of voice style (0-1)
        use_speaker_boost: true    // Boost similarity to speaker
      }
    });

    // Convert ReadableStream to Buffer
    const chunks = [];
    const reader = audioStream.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    
    const audioBuffer = Buffer.concat(chunks);
    
    // Save to local storage
    const audioDir = path.join(__dirname, '..', 'data', 'generated-audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    const filename = `tts-${Date.now()}.mp3`;
    const filepath = path.join(audioDir, filename);
    fs.writeFileSync(filepath, audioBuffer);
    
    console.log(`✅ Generated speech saved: ${filename}`);
    
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
