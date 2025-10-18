// JAKE/ZHENGFENG: API route handlers

import { createProfile, getProfile, updateProfile, uploadAudio, saveMessage, getConversationHistory } from './supabase.js';
import { cloneVoice, textToSpeech } from './elevenlabs.js';
import { generateResponse } from './llm.js';
import { createPersonalityPrompt } from './prompt-generator.js';
import { simulateSmitheryWebhook } from './mock-data.js';

// POST /api/start
export async function handleStart(req, res) {
  try {
    const { fullName } = req.body;

    if (!fullName || fullName.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Create profile in database
    const profile = await createProfile(fullName);

    // TODO: JERIC/JASPER - Trigger real Smithery agent when ready
    // For demo mode, simulate webhook after 5 seconds
    const USE_MOCK = !process.env.SMITHERY_API_KEY;
    if (USE_MOCK) {
      console.log('[MOCK] Simulating Smithery scraping...');
      simulateSmitheryWebhook(profile.id, async (sessionId, scrapedData) => {
        try {
          const masterPrompt = await createPersonalityPrompt(scrapedData);
          await updateProfile(sessionId, {
            scraped_data_json: scrapedData,
            master_prompt: masterPrompt,
            is_ego_ready: true
          });
          console.log('[MOCK] Smithery webhook processed, Ego is ready!');
        } catch (error) {
          console.error('[MOCK] Error in simulated webhook:', error);
        }
      });
    }

    res.json({
      sessionId: profile.id,
      status: 'initialized'
    });
  } catch (error) {
    console.error('Error in handleStart:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
}

// POST /api/upload-voice
export async function handleUploadVoice(req, res) {
  try {
    const { sessionId } = req.body;
    const audioFile = req.files?.audio;

    if (!sessionId || !audioFile) {
      return res.status(400).json({ error: 'Session ID and audio file are required' });
    }

    // Upload audio to Supabase Storage
    const audioUrl = await uploadAudio(sessionId, audioFile.data);

    // Clone voice with ElevenLabs (Jeric/Jasper's code)
    const voiceId = await cloneVoice(audioUrl, sessionId);

    // Update profile with voice ID
    await updateProfile(sessionId, {
      voice_sample_url: audioUrl,
      elevenlabs_voice_id: voiceId
    });

    res.json({
      success: true,
      voiceId
    });
  } catch (error) {
    console.error('Error in handleUploadVoice:', error);
    res.status(500).json({ error: 'Failed to upload voice' });
  }
}

// GET /api/status
export async function handleGetStatus(req, res) {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const profile = await getProfile(sessionId);

    res.json({
      isEgoReady: profile.is_ego_ready,
      status: profile.is_ego_ready ? 'ready' : 'processing'
    });
  } catch (error) {
    console.error('Error in handleGetStatus:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
}

// POST /api/chat
export async function handleChat(req, res) {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }

    // Get profile and conversation history
    const profile = await getProfile(sessionId);
    const history = await getConversationHistory(sessionId);

    // Save user message
    await saveMessage(sessionId, 'user', message);

    // Generate response using LLM (Jeric/Jasper's code)
    const systemPrompt = profile.master_prompt || 'You are a helpful AI assistant.';
    const textResponse = await generateResponse(systemPrompt, history, message);

    // Generate audio using ElevenLabs (Jeric/Jasper's code)
    const audioUrl = await textToSpeech(textResponse, profile.elevenlabs_voice_id);

    // Save assistant message
    await saveMessage(sessionId, 'assistant', textResponse, audioUrl);

    res.json({
      textResponse,
      audioUrl
    });
  } catch (error) {
    console.error('Error in handleChat:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
}

// POST /api/webhook (for Smithery callback)
export async function handleWebhook(req, res) {
  try {
    const { sessionId, scrapedData } = req.body;

    if (!sessionId || !scrapedData) {
      return res.status(400).json({ error: 'Invalid webhook data' });
    }

    // Generate personality prompt from scraped data (Jeric/Jasper's code)
    const masterPrompt = await createPersonalityPrompt(scrapedData);

    // Update profile
    await updateProfile(sessionId, {
      scraped_data_json: scrapedData,
      master_prompt: masterPrompt,
      is_ego_ready: true
    });

    res.json({ received: true });
  } catch (error) {
    console.error('Error in handleWebhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
}
