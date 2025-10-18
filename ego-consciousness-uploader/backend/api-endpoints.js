// JAKE/ZHENGFENG: API route handlers

import fs from 'fs';
import {
  createProfile,
  getProfile,
  updateProfile,
  uploadAudio,
  saveMessage,
  getConversationHistory,
} from "./supabase.js";
import { cloneVoice, textToSpeech } from "./elevenlabs.js";
import { generateResponse } from "./llm.js";
import { createPersonalityPrompt } from "./prompt-generator.js";
import { simulateSmitheryWebhook } from "./mock-data.js";
import { ConsciousnessScraper, validateConfig } from "./scraper/index.js";
import { saveScrapedSnapshot } from "./storage/scraped-store.js";
import { initRAG } from "./rag/index.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENABLE_MCP_SCRAPER = process.env.ENABLE_MCP_SCRAPER !== "false";
let hasLoggedScraperConfig = false;

// Avatar generation status tracking
const avatarStatus = new Map(); // sessionId -> { status: 'pending'|'processing'|'complete'|'failed', gifPaths: {} }

async function applyScrapedData(
  sessionId,
  scrapedData,
  label = "Smithery",
  context = {}
) {
  const masterPrompt = await createPersonalityPrompt(scrapedData);
  const payload = {
    sessionId,
    label,
    storedAt: new Date().toISOString(),
    masterPrompt,
    scrapedData,
    ...context,
  };

  try {
    await updateProfile(sessionId, {
      scraped_data_json: scrapedData,
      master_prompt: masterPrompt,
      is_ego_ready: true,
    });
  } catch (error) {
    console.warn(`[${label}] Skipping Supabase profile update: ${error}`);
  }

  const filePath = await saveScrapedSnapshot(sessionId, payload);
  console.log(`[${label}] Scraped data stored at ${filePath}`);
}

async function triggerScraper(sessionId, fullName) {
  if (!hasLoggedScraperConfig) {
    validateConfig();
    hasLoggedScraperConfig = true;
  }

  const scraper = new ConsciousnessScraper();
  const scrapedData = await scraper.scrape({ name: fullName, limit: 30 });
  await applyScrapedData(sessionId, scrapedData, "SCRAPER", { fullName });
}

async function triggerAvatarGeneration(sessionId) {
  try {
    console.log(`[AVATAR] Starting avatar generation for session ${sessionId}`);
    
    // Set status to processing
    avatarStatus.set(sessionId, {
      status: 'processing',
      gifPaths: {}
    });
    
    // Get the path to the avatar runner
    const avatarRunnerPath = path.join(__dirname, 'avatar_generation', 'avatar_runner.py');
    
    // Spawn the Python process using virtual environment
    const venvPython = path.join(__dirname, '..', 'venv', 'bin', 'python3');
    const pythonProcess = spawn(venvPython, [avatarRunnerPath, sessionId], {
      cwd: path.join(__dirname, 'avatar_generation'),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      try {
        // Extract JSON from the output (it's at the end after all the logging)
        const lines = output.split('\n');
        let jsonLine = null;
        
        // Find the last line that looks like JSON (starts with { and ends with })
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith('{') && line.endsWith('}')) {
            jsonLine = line;
            break;
          }
        }
        
        if (!jsonLine) {
          throw new Error('No JSON found in output');
        }
        
        console.log(`[AVATAR] Extracted JSON:`, jsonLine);
        const result = JSON.parse(jsonLine);
        
        if (result.success) {
          console.log(`[AVATAR] Avatar generation completed for session ${sessionId}`);
          console.log(`[AVATAR] GIF paths received:`, result.gifs);
          avatarStatus.set(sessionId, {
            status: 'complete',
            gifPaths: result.gifs || {}
          });
        } else {
          console.error(`[AVATAR] Avatar generation failed for session ${sessionId}:`, result.error);
          avatarStatus.set(sessionId, {
            status: 'failed',
            gifPaths: {},
            error: result.error
          });
        }
      } catch (parseError) {
        console.error(`[AVATAR] Failed to parse avatar generation result:`, parseError);
        console.error(`[AVATAR] Output:`, output);
        console.error(`[AVATAR] Error:`, errorOutput);
        avatarStatus.set(sessionId, {
          status: 'failed',
          gifPaths: {},
          error: 'Failed to parse generation result'
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error(`[AVATAR] Failed to start avatar generation process:`, error);
      avatarStatus.set(sessionId, {
        status: 'failed',
        gifPaths: {},
        error: error.message
      });
    });
    
  } catch (error) {
    console.error(`[AVATAR] Error triggering avatar generation:`, error);
    avatarStatus.set(sessionId, {
      status: 'failed',
      gifPaths: {},
      error: error.message
    });
  }
}

// POST /api/start
export async function handleStart(req, res) {
  try {
    const { fullName } = req.body;

    if (!fullName || fullName.trim().length === 0) {
      return res.status(400).json({ error: "Name is required" });
    }

    // Create profile in database
    const profile = await createProfile(fullName);

    if (ENABLE_MCP_SCRAPER) {
      console.log("[SCRAPER] Starting real MCP-based scrape...");
      triggerScraper(profile.id, fullName).catch((error) => {
        console.error(
          "[SCRAPER] Error running scraper, falling back to mock:",
          error
        );
        simulateSmitheryWebhook(profile.id, (sessionId, scrapedData) =>
          applyScrapedData(sessionId, scrapedData, "MOCK", { fullName }).catch(
            (mockError) => {
              console.error(
                "[MOCK] Error applying simulated webhook:",
                mockError
              );
            }
          )
        );
      });
    } else {
      console.log("[MOCK] Simulating Smithery scraping (scraper disabled)...");
      simulateSmitheryWebhook(profile.id, (sessionId, scrapedData) =>
        applyScrapedData(sessionId, scrapedData, "MOCK", { fullName }).catch(
          (mockError) => {
            console.error("[MOCK] Error in simulated webhook:", mockError);
          }
        )
      );
    }

    res.json({
      sessionId: profile.id,
      status: "initialized",
    });
  } catch (error) {
    console.error("Error in handleStart:", error);
    res.status(500).json({ error: "Failed to start session" });
  }
}

// POST /api/upload-pictures
export async function handleUploadPictures(req, res) {
  try {
    const { sessionId } = req.body;
    const photos = req.files?.photos;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    if (!photos) {
      return res.status(400).json({ error: "Photos are required" });
    }

    // Create directory for this session's photos
    const dataDir = path.join(__dirname, '..', 'data', 'photos', sessionId);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Handle single photo or array of photos
    const photoArray = Array.isArray(photos) ? photos : [photos];

    const savedPaths = [];
    for (let i = 0; i < photoArray.length; i++) {
      const photo = photoArray[i];
      const photoPath = path.join(dataDir, `photo-${i + 1}.jpg`);

      // Save photo to disk
      fs.writeFileSync(photoPath, photo.data);
      savedPaths.push(photoPath);

      console.log(`Saved photo ${i + 1} to ${photoPath}`);
    }

    res.json({
      success: true,
      photoCount: photoArray.length,
      paths: savedPaths
    });
  } catch (error) {
    console.error("Error in handleUploadPictures:", error);
    res.status(500).json({ error: "Failed to upload pictures" });
  }
}

// POST /api/upload-voice
export async function handleUploadVoice(req, res) {
  try {
    const { sessionId } = req.body;
    const audioFiles = req.files?.audioFiles;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    if (!audioFiles) {
      return res.status(400).json({ error: "Audio files are required" });
    }

    // Create directory for this session's audio
    const dataDir = path.join(__dirname, '..', 'data', 'audio', sessionId);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Handle single audio file or array of audio files
    const audioArray = Array.isArray(audioFiles) ? audioFiles : [audioFiles];

    const savedPaths = [];
    const questions = [];

    for (let i = 0; i < audioArray.length; i++) {
      const audioFile = audioArray[i];

      // Determine file extension from mime type
      const extension = audioFile.mimetype.includes('mpeg') ? 'mp3' :
                       audioFile.mimetype.includes('wav') ? 'wav' : 'webm';

      const audioPath = path.join(dataDir, `answer-${i + 1}.${extension}`);

      // Save audio to disk
      fs.writeFileSync(audioPath, audioFile.data);
      savedPaths.push(audioPath);

      // Get the corresponding question
      const questionKey = `question-${i + 1}`;
      const question = req.body[questionKey] || `Question ${i + 1}`;
      questions.push(question);

      console.log(`Saved answer ${i + 1} to ${audioPath}`);
      console.log(`Question: ${question}`);
    }

    // Save questions to a metadata file
    const metadataPath = path.join(dataDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify({
      sessionId,
      timestamp: new Date().toISOString(),
      audioFiles: savedPaths.map((path, i) => ({
        path,
        question: questions[i],
        filename: `answer-${i + 1}`
      }))
    }, null, 2));

    console.log(`Saved metadata to ${metadataPath}`);

    // Try to upload to Supabase/ElevenLabs if configured
    let voiceId = null;
    try {
      // For ElevenLabs, we could concatenate or use the first file
      // For now, let's use the first audio file as the voice sample
      const firstAudioUrl = await uploadAudio(sessionId, audioArray[0].data);
      voiceId = await cloneVoice(firstAudioUrl, sessionId);

      await updateProfile(sessionId, {
        voice_sample_url: firstAudioUrl,
        elevenlabs_voice_id: voiceId,
      });
    } catch (uploadError) {
      console.warn("Supabase/ElevenLabs upload skipped:", uploadError.message);
    }

    // Trigger avatar generation asynchronously
    triggerAvatarGeneration(sessionId).catch(error => {
      console.error(`[AVATAR] Error in avatar generation trigger:`, error);
    });

    res.json({
      success: true,
      voiceId,
      audioCount: audioArray.length,
      localPaths: savedPaths,
      metadataPath
    });
  } catch (error) {
    console.error("Error in handleUploadVoice:", error);
    res.status(500).json({ error: "Failed to upload voice" });
  }
}

// GET /api/status
export async function handleGetStatus(req, res) {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    const profile = await getProfile(sessionId);

    res.json({
      isEgoReady: profile.is_ego_ready,
      status: profile.is_ego_ready ? "ready" : "processing",
    });
  } catch (error) {
    console.error("Error in handleGetStatus:", error);
    res.status(500).json({ error: "Failed to get status" });
  }
}

// POST /api/chat
export async function handleChat(req, res) {
  try {
    const { sessionId, message, useRAG = true } = req.body;

    if (!sessionId || !message) {
      return res
        .status(400)
        .json({ error: "Session ID and message are required" });
    }

    // Get profile and conversation history
    const profile = await getProfile(sessionId);
    const history = await getConversationHistory(sessionId);

    // Save user message
    await saveMessage(sessionId, "user", message);

    let textResponse;
    let sources = null;

    if (useRAG && profile.is_ego_ready) {
      // Use RAG for context-aware responses
      try {
        const rag = await initRAG(sessionId);

        // Convert conversation history to the format RAG expects
        const conversationHistory = history.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

        const result = await rag.query(message, {
          topK: 5,
          conversationHistory,
        });
        textResponse = result.answer;
        sources = result.sources;
      } catch (ragError) {
        console.warn("RAG query failed, falling back to standard LLM:", ragError);
        const systemPrompt = profile.master_prompt || "You are a helpful AI assistant.";
        textResponse = await generateResponse(systemPrompt, history, message);
      }
    } else {
      // Fallback to standard LLM
      const systemPrompt = profile.master_prompt || "You are a helpful AI assistant.";
      textResponse = await generateResponse(systemPrompt, history, message);
    }

    // Generate audio using ElevenLabs (Jeric/Jasper's code)
    const audioUrl = await textToSpeech(
      textResponse,
      profile.elevenlabs_voice_id
    );

    // Save assistant message
    await saveMessage(sessionId, "assistant", textResponse, audioUrl);

    res.json({
      textResponse,
      audioUrl,
      sources, // Include sources for RAG responses
    });
  } catch (error) {
    console.error("Error in handleChat:", error);
    res.status(500).json({ error: "Failed to process chat message" });
  }
}

// GET /api/avatar-status
export async function handleGetAvatarStatus(req, res) {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    // Check if we have a cached status
    let status = avatarStatus.get(sessionId);
    
    // If no cached status or status is pending, check the file system
    if (!status || status.status === 'pending') {
      const gifsDir = path.join(__dirname, '..', 'data', 'avatars', sessionId, 'gifs');
      
      if (fs.existsSync(gifsDir)) {
        const gifFiles = fs.readdirSync(gifsDir).filter(file => file.endsWith('.gif'));
        
        if (gifFiles.length > 0) {
          // Build gifPaths object from existing files
          const gifPaths = {};
          gifFiles.forEach(file => {
            const emotion = file.replace('_animation.gif', '');
            gifPaths[emotion] = `/api/avatars/${sessionId}/${file}`;
          });
          
          status = {
            status: 'complete',
            gifPaths: gifPaths
          };
          
          // Cache the status
          avatarStatus.set(sessionId, status);
          console.log(`[AVATAR] Found existing GIFs for session ${sessionId}:`, gifPaths);
        } else {
          status = {
            status: 'pending',
            gifPaths: {}
          };
        }
      } else {
        status = {
          status: 'pending',
          gifPaths: {}
        };
      }
    }

    res.json(status);
  } catch (error) {
    console.error("Error in handleGetAvatarStatus:", error);
    res.status(500).json({ error: "Failed to get avatar status" });
  }
}

// POST /api/set-avatar-status (temporary endpoint for testing)
export async function handleSetAvatarStatus(req, res) {
  try {
    const { sessionId, status, gifPaths } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID required" });
    }
    
    avatarStatus.set(sessionId, {
      status: status || 'complete',
      gifPaths: gifPaths || {
        neutral: '/api/avatars/mock-session-1760796792066/neutral_animation.gif',
        sad: '/api/avatars/mock-session-1760796792066/sad_animation.gif',
        angry: '/api/avatars/mock-session-1760796792066/angry_animation.gif'
      }
    });
    
    res.json({ success: true, message: 'Avatar status updated' });
    
  } catch (error) {
    console.error("Error in handleSetAvatarStatus:", error);
    res.status(500).json({ error: "Failed to set avatar status" });
  }
}

// GET /api/latest-session (get latest session with avatars)
export async function handleGetLatestSession(req, res) {
  try {
    
    // Look for the most recent session with avatars
    const avatarsDir = path.join(__dirname, '..', 'data', 'avatars');
    
    if (!fs.existsSync(avatarsDir)) {
      return res.json({ sessionId: null, message: 'No avatars directory found' });
    }
    
    const sessions = fs.readdirSync(avatarsDir)
      .filter(session => {
        const sessionPath = path.join(avatarsDir, session);
        const gifsPath = path.join(sessionPath, 'gifs');
        return fs.existsSync(gifsPath) && fs.readdirSync(gifsPath).length > 0;
      })
      .sort()
      .reverse(); // Most recent first
    
    if (sessions.length === 0) {
      return res.json({ sessionId: null, message: 'No sessions with avatars found' });
    }
    
    const latestSession = sessions[0];
    res.json({ 
      sessionId: latestSession,
      message: 'Latest session with avatars found'
    });
    
  } catch (error) {
    console.error("Error in handleGetLatestSession:", error);
    res.status(500).json({ error: "Failed to get latest session" });
  }
}

// GET /api/scan-sessions (get all sessions with avatars)
export async function handleScanSessions(req, res) {
  try {
    
    // Look for all sessions with avatars
    const avatarsDir = path.join(__dirname, '..', 'data', 'avatars');
    
    if (!fs.existsSync(avatarsDir)) {
      return res.json({ sessions: [], message: 'No avatars directory found' });
    }
    
    const sessions = fs.readdirSync(avatarsDir)
      .filter(session => {
        const sessionPath = path.join(avatarsDir, session);
        const gifsPath = path.join(sessionPath, 'gifs');
        return fs.existsSync(gifsPath) && fs.readdirSync(gifsPath).length > 0;
      })
      .sort()
      .reverse(); // Most recent first
    
    res.json({ 
      sessions: sessions,
      message: `Found ${sessions.length} sessions with avatars`
    });
    
  } catch (error) {
    console.error("Error in handleScanSessions:", error);
    res.status(500).json({ error: "Failed to scan sessions" });
  }
}

// GET /api/avatars/:sessionId/:filename (serve avatar files)
export async function handleGetAvatar(req, res) {
  try {
    const { sessionId, filename } = req.params;
    
    if (!sessionId || !filename) {
      return res.status(400).json({ error: "Session ID and filename required" });
    }
    
    // Construct file path
    const filePath = path.join(__dirname, '..', 'data', 'avatars', sessionId, 'gifs', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Avatar file not found" });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Send file
    res.sendFile(filePath);
    
  } catch (error) {
    console.error("Error in handleGetAvatar:", error);
    res.status(500).json({ error: "Failed to serve avatar file" });
  }
}

// POST /api/webhook (for Smithery callback)
export async function handleWebhook(req, res) {
  try {
    const { sessionId, scrapedData } = req.body;

    if (!sessionId || !scrapedData) {
      return res.status(400).json({ error: "Invalid webhook data" });
    }

    await applyScrapedData(sessionId, scrapedData, "WEBHOOK");

    res.json({ received: true });
  } catch (error) {
    console.error("Error in handleWebhook:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
}
