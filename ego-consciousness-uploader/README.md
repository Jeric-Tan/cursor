# Ego: Consciousness Uploader

Create a digital clone of yourself that talks, thinks, and sounds like you.

## Quick Start

### Option 1: Demo Mode (No API Keys Required!)

Perfect for testing UI and getting started:

```bash
cd ego-consciousness-uploader
npm install
npm run dev
```

Open `http://localhost:3001` - Everything works with mock data!

**What works in demo mode:**
- ✅ Full UI flow (name → voice → chat)
- ✅ Voice recording (saved to mock storage)
- ✅ Chat with mock AI responses
- ✅ Audio playback (sample audio)
- ✅ All state transitions

**Demo mode activates automatically** when API keys are missing.

---

### Option 2: Full Production Mode

For real voice cloning and AI:

#### 1. Install Dependencies

```bash
cd ego-consciousness-uploader
npm install
```

#### 2. Configure API Keys

Copy `.env.example` to `.env` and add your keys:

```bash
# Jake/ZhengFeng - Get from Supabase Dashboard
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Jeric/Jasper - Get from respective platforms
ELEVENLABS_API_KEY=your-elevenlabs-key
OPENAI_API_KEY=your-openai-key
```

**Note:** You can add keys incrementally! Each service falls back to mock mode if its key is missing:
- No Supabase keys → Uses in-memory database
- No ElevenLabs key → Uses mock voice
- No LLM keys → Uses smart mock responses

#### 3. Setup Supabase (Optional for Production)

1. Go to your Supabase Dashboard
2. Open SQL Editor
3. Run the contents of `backend/supabase-setup.sql`
4. Go to Storage and create two buckets:
   - `voice-samples` (public)
   - `chat-audio` (public)

#### 4. Run the App

```bash
npm run dev
```

Open `http://localhost:3001` in your browser.

## Team Responsibilities

### Jake & ZhengFeng - Frontend & Supabase

**Your files:**
- `frontend/index.html` - UI structure
- `frontend/app.js` - Main app logic
- `frontend/api.js` - API calls
- `frontend/styles.css` - Styling
- `backend/supabase.js` - Database operations
- `backend/api-endpoints.js` - Route handlers

**Tasks:**
1. Complete the frontend UI (already scaffolded)
2. Test voice recording with MediaRecorder API
3. Implement Supabase storage upload
4. Handle stage transitions and loading states
5. Test full frontend flow

### Jeric & Jasper - Voice AI & LLM

**Your files:**
- `backend/elevenlabs.js` - Voice cloning & TTS
- `backend/llm.js` - AI response generation
- `backend/prompt-generator.js` - Personality prompt creation

**Tasks:**
1. Implement ElevenLabs voice cloning API
2. Implement ElevenLabs TTS API
3. Implement OpenAI/Anthropic LLM integration
4. Build personality prompt from scraped data
5. Test voice quality and response accuracy

## How It Works

1. **Name Input** → User enters their name
2. **Voice Recording** → User records voice samples
3. **Processing** → System:
   - Clones voice with ElevenLabs
   - Scrapes web for user's digital footprint
   - Generates personality prompt
4. **Chat** → User talks with their digital Ego

## Architecture

```
Frontend (Vanilla JS)
    ↓
Express API (api-endpoints.js)
    ↓
Services:
  - Supabase (database, storage)
  - ElevenLabs (voice cloning, TTS)
  - OpenAI/Anthropic (LLM)
  - Smithery (web scraping)
```

## Testing

### Test Frontend Only
1. Open browser console
2. Test name input validation
3. Test microphone permissions
4. Test recording start/stop

### Test Backend Only
Use Postman or curl:

```bash
# Test start session
curl -X POST http://localhost:3001/api/start \
  -H "Content-Type: application/json" \
  -d '{"fullName":"John Doe"}'

# Test status
curl http://localhost:3001/api/status?sessionId=YOUR_SESSION_ID
```

## Troubleshooting

**Issue:** Microphone not working
- Check browser permissions
- Use HTTPS or localhost only

**Issue:** Supabase connection fails
- Verify .env variables are correct
- Check Supabase project is not paused

**Issue:** ElevenLabs API errors
- Verify API key is valid
- Check quota/credits

**Issue:** CORS errors
- Ensure server.js has cors() enabled
- Check API_BASE_URL in frontend/api.js

## Deployment

### Frontend + Backend (Vercel)
```bash
vercel deploy
```

Add environment variables in Vercel dashboard.

### Frontend Only (Netlify)
Deploy `frontend/` folder to Netlify.

### Backend Only (Railway/Render)
Deploy with start command: `node server.js`

## License

MIT - Built for Hackathon
