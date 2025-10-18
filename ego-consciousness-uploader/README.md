# Ego: Consciousness Uploader

Create a digital clone of yourself that talks, thinks, and sounds like you.

**NEW: 🎭 Real-time Emotion Recognition** - Now with AI-powered facial emotion detection!

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
# Optional: Use Anthropic instead of OpenAI for scraping enrichment
# ANTHROPIC_API_KEY=your-anthropic-key

# Optional scraper tuning
# OPENAI_SCRAPER_MODEL=gpt-4o-mini
# ANTHROPIC_SCRAPER_MODEL=claude-3-5-sonnet-20241022
# SCRAPER_ENRICH_MAX_CHARS=1600
# ENABLE_SCRAPER_ENRICHMENT=true
```

**Note:** You can add keys incrementally! Each service falls back to mock mode if its key is missing:
- No Supabase keys → Uses in-memory database
- No ElevenLabs key → Uses mock voice
- No LLM keys → Uses smart mock responses

#### 3. Configure Smithery / Exa Scraper (Optional but recommended)

To enable the real MCP-powered scraper that pulls a person's public footprint:

```bash
# Optional overrides
ENABLE_MCP_SCRAPER=true
SMITHERY_SERVER_URL=https://server.smithery.ai/exa/mcp

# Provide OAuth tokens from Smithery if you have them.
OAUTH_ACCESS_TOKEN=your-smithery-access-token
OAUTH_REFRESH_TOKEN=your-smithery-refresh-token
```

- Leave `ENABLE_MCP_SCRAPER` unset (or set to `true`) to run the real scraper.
- Set `ENABLE_MCP_SCRAPER=false` to force demo mode if you just want the simulated Smithery webhook.
- If no tokens are provided, the scraper automatically launches Smithery's OAuth flow in your browser the first time it runs and caches the tokens in `.smithery/`.
- When OpenAI or Anthropic keys are present the scraper will enrich each snippet with persona metadata (beliefs, tone, domains, named people). Without keys the enrichment falls back to lightweight heuristics.

#### 4. Setup Supabase (Optional for Production)

1. Go to your Supabase Dashboard
2. Open SQL Editor
3. Run the contents of `backend/supabase-setup.sql`
4. Go to Storage and create two buckets:
   - `voice-samples` (public)
   - `chat-audio` (public)

#### 5. Run the App

```bash
npm run dev
```

Open `http://localhost:3001` in your browser.

---

## 🎭 Emotion Recognition (New Feature!)

### Emotion Capture Calibration (NEW!)

Capture high-quality face images for user calibration:

```bash
# Option 1: Using the test script (recommended)
python test_emotion_capture.py

# Option 2: Using the shell script
./scripts/run_emotion_capture.sh

# Option 3: Direct module invocation
python backend/emotion_recognizer.py capture
```

**What it does:**
- 📸 Guides you through capturing 4 distinct emotions: neutral, happy, sad, angry
- ✅ Uses stability checking (15 consecutive frames) for clear expressions
- 💾 Saves high-quality PNG images of your face for each emotion
- 🎯 Color-coded visual feedback (green = correct emotion detected)
- 📊 Real-time progress tracking with progress bar

See `EMOTION_CAPTURE_GUIDE.md` for complete documentation.

---

### Real-Time Emotion Detection

Test the emotion recognition system standalone:

```bash
# 1. Run the Python backend
./test_emotion_only.sh

# 2. Open the test page in your browser
cd frontend
python3 -m http.server 8081
# Open: http://localhost:8081/test-emotion.html
```

### Full Integration

The emotion recognition is integrated into the full app flow:

```bash
# Start both Node.js frontend and Python emotion backend
./start_all.sh  # Mac/Linux
# or
start_all.bat   # Windows
```

The emotion recognition stage appears after voice recording, before chat.

### Features
- ✅ Real-time facial emotion detection using DeepFace AI
- ✅ 7 emotions: angry, disgust, fear, happy, sad, surprise, neutral
- ✅ Live camera feed with face detection bounding boxes
- ✅ Dynamic confidence scores
- ✅ WebSocket real-time streaming
- ✅ **NEW**: Guided emotion capture calibration module

### Documentation
- **Emotion Capture**: See `EMOTION_CAPTURE_GUIDE.md` 🆕
- **Complete Guide**: See `REAL_EMOTION_DETECTION_GUIDE.md`
- **Setup Verification**: Run `python3 verify_setup.py`
- **Before/After Comparison**: See `BEFORE_VS_AFTER.md`

### Requirements
```bash
# Install Python dependencies (in virtual environment)
source venv/bin/activate
pip install -r requirements.txt
```

---

## 🎭 Avatar Generation & Video Creation (NEW!)

### Avatar Generation Pipeline

Generate digital avatars and emotional video variations using AI:

```bash
# Install Python dependencies
pip install -r requirements.txt

# Generate avatars and videos
python backend/avatar_generator.py
```

**What it does:**
- 🎨 Creates photorealistic base portraits from neutral face captures
- 😊 Generates emotional variants (happy, sad, angry) using AI
- 🎬 Creates animated videos from avatars using FAL.AI Veo 2
- 📁 Saves all outputs to organized directories

### Required API Keys

Add these to your `.env` file:

```bash
# Google Gemini API for avatar generation
GEMINI_API_KEY=your_gemini_api_key_here

# FAL.AI API for video generation (Veo 2)
FAL_KEY=your_fal_api_key_here
```

**Get your API keys:**
- Gemini: https://makersuite.google.com/app/apikey
- FAL.AI: https://fal.ai/

### Features
- ✅ High-quality avatar generation from face captures
- ✅ Emotional expression variations
- ✅ Video generation with FAL.AI Veo 2
- ✅ Portrait format (9:16) optimized for mobile
- ✅ 5-second video duration
- ✅ Automatic file organization

### Usage Examples

```python
from backend.avatar_generator import AvatarGenerator

# Initialize with API keys
generator = AvatarGenerator(
    api_key="your_gemini_key",
    fal_api_key="your_fal_key"
)

# Generate base portrait
base_portrait = generator.generate_base_portrait("capture_neutral.png")

# Generate emotional variants
happy_avatar = generator.generate_expression_variant(
    base_portrait, "capture_happy.png", "happy"
)

# Generate video
video_path = generator.generate_video_from_avatar(
    happy_avatar, "happy", "generated_videos"
)
```

---

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
- `backend/avatar_generator.py` - Avatar generation & video creation with FAL.AI

**Tasks:**
1. Implement ElevenLabs voice cloning API
2. Implement ElevenLabs TTS API
3. Implement OpenAI/Anthropic LLM integration
4. Build personality prompt from scraped data
5. Test voice quality and response accuracy
6. **NEW**: Avatar generation and video creation using FAL.AI Veo 2

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
