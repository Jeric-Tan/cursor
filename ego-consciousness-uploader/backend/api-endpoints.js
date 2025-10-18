// JAKE/ZHENGFENG: API route handlers

import {
  createProfile,
  getProfile,
  updateProfile,
  uploadAudio,
  saveMessage,
  getConversationHistory,
} from "./supabase.js";
import { cloneVoice, cloneVoiceFromFiles, textToSpeech, transcribeSession } from "./elevenlabs.js";
import { generateResponse } from "./llm.js";
import { createPersonalityPrompt } from "./prompt-generator.js";
import { simulateSmitheryWebhook } from "./mock-data.js";
import { ConsciousnessScraper, validateConfig } from "./scraper/index.js";
import { saveScrapedSnapshot } from "./storage/scraped-store.js";
import { initRAG } from "./rag/index.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENABLE_MCP_SCRAPER = process.env.ENABLE_MCP_SCRAPER !== "false";
let hasLoggedScraperConfig = false;

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

      // Determine file extension from mime type - use WebM (browser's native format)
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

    // Process audio in background (don't await to return response quickly)
    processAudioInBackground(sessionId, audioArray, savedPaths, questions);

    // Try to upload to Supabase if configured
    let voiceId = null;
    try {
      const firstAudioUrl = await uploadAudio(sessionId, audioArray[0].data);
      await updateProfile(sessionId, {
        voice_sample_url: firstAudioUrl,
      });
    } catch (uploadError) {
      console.warn("Supabase upload skipped:", uploadError.message);
    }

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

/**
 * Process audio in background (transcription + voice cloning)
 */
async function processAudioInBackground(sessionId, audioArray, savedPaths, questions) {
  try {
    console.log(`[Background] Processing session: ${sessionId}`);
    
    // Transcribe all audio files
    const audioFilesInfo = savedPaths.map((audioPath, i) => ({
      path: audioPath,
      question: questions[i],
      filename: `answer-${i + 1}`
    }));

    console.log(`[Background] Starting transcription...`);
    await transcribeSession(sessionId, audioFilesInfo);
    console.log(`[Background] Transcription complete`);

    console.log(`[Background] Starting voice cloning...`);

    // Clone voice using all audio files
    const audioFilesForCloning = audioArray.map((audioFile, i) => ({
      data: audioFile.data,
      filename: `answer-${i + 1}.webm`  // Use WebM format (browser's native format)
    }));

    const voiceId = await cloneVoiceFromFiles(audioFilesForCloning, `Clone_${sessionId}`);
    
    if (voiceId) {
      console.log(`[Background] Voice cloning complete: ${voiceId}`);
      
      // Save voice info
      const voicesDir = path.join(__dirname, '..', 'data', 'voices');
      if (!fs.existsSync(voicesDir)) {
        fs.mkdirSync(voicesDir, { recursive: true });
      }

      const voiceInfoPath = path.join(voicesDir, `${sessionId}_voice.json`);
      fs.writeFileSync(voiceInfoPath, JSON.stringify({
        voice_id: voiceId,
        voice_name: `Clone_${sessionId}`,
        session_id: sessionId,
        timestamp: new Date().toISOString()
      }, null, 2));

      // Update profile with voice ID
      try {
        await updateProfile(sessionId, {
          elevenlabs_voice_id: voiceId,
        });
      } catch (error) {
        console.warn("Could not update profile with voice ID:", error.message);
      }
    } else {
      console.log(`[Background] Voice cloning failed, continuing without cloned voice`);
    }

    console.log(`✓ Audio processing completed for session: ${sessionId}`);
  } catch (error) {
    console.error(`✗ Error processing audio for session ${sessionId}:`, error);
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

// POST /api/voice-question (speech-to-speech chat)
export async function handleVoiceQuestion(req, res) {
  try {
    const { sessionId } = req.body;
    const audioFile = req.files?.audio;

    if (!sessionId || !audioFile) {
      return res.status(400).json({ error: "Session ID and audio are required" });
    }

    const timestamp = Date.now();

    // Save user question to data/conversation/user_question/
    const userQuestionDir = path.join(__dirname, '..', 'data', 'conversation', 'user_question', sessionId);
    if (!fs.existsSync(userQuestionDir)) {
      fs.mkdirSync(userQuestionDir, { recursive: true });
    }

    const questionFilename = `question-${timestamp}.mp3`;
    const questionPath = path.join(userQuestionDir, questionFilename);
    fs.writeFileSync(questionPath, audioFile.data);

    console.log(`💬 Saved user question audio: ${questionPath}`);

    // Transcribe the question using Whisper
    const { transcribeAudio } = await import('./elevenlabs.js');
    const transcribedQuestion = await transcribeAudio(questionPath);

    if (!transcribedQuestion) {
      return res.status(400).json({ error: "Failed to transcribe question" });
    }

    console.log(`📝 Transcribed: "${transcribedQuestion}"`);

    // Save transcription as JSON
    const transcriptionPath = path.join(userQuestionDir, `question-${timestamp}.json`);
    fs.writeFileSync(transcriptionPath, JSON.stringify({ question: transcribedQuestion }, null, 2));

    // Get profile and conversation history
    const profile = await getProfile(sessionId);
    const history = await getConversationHistory(sessionId);

    // Save user message
    await saveMessage(sessionId, "user", transcribedQuestion);

    let textResponse;
    let sources = null;

    // Use RAG for context-aware responses
    if (profile.is_ego_ready) {
      try {
        const rag = await initRAG(sessionId);
        const conversationHistory = history.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

        const result = await rag.query(transcribedQuestion, {
          topK: 5,
          conversationHistory,
        });
        textResponse = result.answer;
        sources = result.sources;
      } catch (ragError) {
        console.warn("RAG query failed, falling back to standard LLM:", ragError);
        const systemPrompt = profile.master_prompt || "You are a helpful AI assistant.";
        textResponse = await generateResponse(systemPrompt, history, transcribedQuestion);
      }
    } else {
      const systemPrompt = profile.master_prompt || "You are a helpful AI assistant.";
      textResponse = await generateResponse(systemPrompt, history, transcribedQuestion);
    }

    // Generate audio response using ElevenLabs
    const audioUrl = await textToSpeech(
      textResponse,
      profile.elevenlabs_voice_id
    );

    // Save AI reply to data/conversation/reply/
    const replyDir = path.join(__dirname, '..', 'data', 'conversation', 'reply', sessionId);
    if (!fs.existsSync(replyDir)) {
      fs.mkdirSync(replyDir, { recursive: true });
    }

    const replyFilename = `reply-${timestamp}.mp3`;
    const replyPath = path.join(replyDir, replyFilename);
    
    // Copy generated audio to reply folder
    if (audioUrl) {
      const generatedAudioPath = path.join(__dirname, '..', 'data', audioUrl.replace('/generated-audio/', 'generated-audio/'));
      if (fs.existsSync(generatedAudioPath)) {
        fs.copyFileSync(generatedAudioPath, replyPath);
      }
    }

    // Save reply transcription as JSON
    const replyTranscriptionPath = path.join(replyDir, `reply-${timestamp}.json`);
    fs.writeFileSync(replyTranscriptionPath, JSON.stringify({ reply: textResponse }, null, 2));

    console.log(`🤖 Saved AI reply: ${replyPath}`);

    // Save assistant message
    await saveMessage(sessionId, "assistant", textResponse, audioUrl);

    res.json({
      transcribedQuestion,
      textResponse,
      audioUrl,
      sources,
    });

  } catch (error) {
    console.error("Error in handleVoiceQuestion:", error);
    res.status(500).json({ error: "Failed to process voice question" });
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
