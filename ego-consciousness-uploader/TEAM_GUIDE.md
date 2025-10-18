# Team Assignment Guide

## Jake & ZhengFeng - Frontend, MCPs, Supabase

### Your Files:
```
frontend/
├── index.html                    ← Main HTML file
├── app.js                        ← Main app logic & state
├── api.js                        ← API calls to backend
└── styles.css                    ← All styling

backend/
├── supabase.js                   ← Supabase client & database operations
└── api-endpoints.js              ← API route handlers
```

### What to build:
1. **Frontend (index.html + app.js)**
   - Name input screen
   - Voice recording interface (use browser MediaRecorder API)
   - Loading states
   - Chat interface with text input

2. **Supabase (supabase.js)**
   - Create tables: `profiles`, `conversations`
   - Storage buckets: `voice-samples`, `chat-audio`
   - Functions: saveProfile(), getProfile(), uploadAudio(), saveMessage()

3. **API (api-endpoints.js)**
   - POST /start - Create new profile
   - POST /upload-voice - Store voice sample
   - POST /chat - Handle chat messages
   - POST /webhook - Receive Smithery data

---

## Jeric & Jasper - Voice Cloning, ElevenLabs, Deepfakes

### Your Files:
```
backend/
├── elevenlabs.js                 ← ElevenLabs voice cloning & TTS
├── llm.js                        ← LLM response generation
└── prompt-generator.js           ← Create personality prompts
```

### What to build:
1. **ElevenLabs (elevenlabs.js)**
   - `cloneVoice(audioUrl, name)` - Create voice clone from audio
   - `textToSpeech(text, voiceId)` - Generate speech audio
   - Return audio URLs

2. **LLM (llm.js)**
   - `generateResponse(systemPrompt, history, userMessage)` - Get AI response
   - Use OpenAI or Anthropic API

3. **Prompt Generator (prompt-generator.js)**
   - `createPersonalityPrompt(scrapedData)` - Turn web data into personality prompt
   - Analyze communication style, interests, background

---

## Shared File (Everyone Uses):
```
shared/constants.js               ← API endpoints, stages, questions
```

## Integration Points:

### Flow:
1. User enters name → Jake/ZhengFeng save to Supabase
2. User records voice → Jake/ZhengFeng upload to Supabase Storage
3. Voice file URL → Jeric/Jasper clone voice with ElevenLabs
4. Smithery scrapes web → Jeric/Jasper generate personality prompt
5. User chats → Jeric/Jasper generate response → ElevenLabs speaks it
6. Jake/ZhengFeng display text + play audio

### Who calls who:
- `api-endpoints.js` calls → `supabase.js`, `elevenlabs.js`, `llm.js`, `prompt-generator.js`
- `app.js` calls → `api.js` (which hits the endpoints)

---

## Environment Variables Needed:

**Jake/ZhengFeng:**
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_KEY

**Jeric/Jasper:**
- ELEVENLABS_API_KEY
- OPENAI_API_KEY (or ANTHROPIC_API_KEY)
- SMITHERY_API_KEY

Create `.env` file with all these.
