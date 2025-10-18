// JAKE/ZHENGFENG: API route handlers

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

// POST /api/upload-voice
export async function handleUploadVoice(req, res) {
  try {
    const { sessionId } = req.body;
    const audioFile = req.files?.audio;

    if (!sessionId || !audioFile) {
      return res
        .status(400)
        .json({ error: "Session ID and audio file are required" });
    }

    // Upload audio to Supabase Storage
    const audioUrl = await uploadAudio(sessionId, audioFile.data);

    // Clone voice with ElevenLabs (Jeric/Jasper's code)
    const voiceId = await cloneVoice(audioUrl, sessionId);

    // Update profile with voice ID
    await updateProfile(sessionId, {
      voice_sample_url: audioUrl,
      elevenlabs_voice_id: voiceId,
    });

    res.json({
      success: true,
      voiceId,
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
