# Demo Mode Guide

## How Demo Mode Works

The app automatically detects missing API keys and switches to mock/demo mode. This lets each team work independently without waiting for others' API keys.

## What Gets Mocked

### Jake & ZhengFeng can test WITHOUT:
- ❌ Supabase credentials
- ❌ Real database
- ❌ Cloud storage

**Mock provides:**
- ✅ In-memory database
- ✅ Fake session IDs
- ✅ Mock file upload URLs
- ✅ Conversation history storage

### Jeric & Jasper can test WITHOUT:
- ❌ ElevenLabs API key
- ❌ OpenAI/Anthropic API key
- ❌ Smithery credentials

**Mock provides:**
- ✅ Fake voice cloning (returns mock voice ID)
- ✅ Sample audio playback URL
- ✅ Smart AI responses (context-aware)
- ✅ Simulated web scraping data

## Testing Individual Components

### Frontend Team (Jake/ZhengFeng)
```bash
# Just run without any .env file
npm install
npm run dev
```

Test these flows:
1. Name input → Creates mock session
2. Voice recording → Uploads to mock storage
3. Loading states → Simulated 5-second delay
4. Chat UI → Receives mock responses
5. Audio playback → Plays sample audio

### Backend/AI Team (Jeric/Jasper)

**Test LLM only:**
```bash
# .env with only LLM key
OPENAI_API_KEY=your-key
# Everything else mocked
```

**Test ElevenLabs only:**
```bash
# .env with only ElevenLabs key
ELEVENLABS_API_KEY=your-key
# Everything else mocked
```

**Test prompt generation:**
```bash
# No keys needed - uses mock scraped data
npm run dev
# Check console for generated prompts
```

## Mock Data Examples

### Mock Scraped Data
Located in `backend/mock-data.js`:
- LinkedIn profile
- Twitter activity
- Blog posts
- Personality summary

### Mock AI Responses
Smart responses based on keywords:
- "hello" → Friendly greeting
- "who are you" → Explains digital Ego
- Other messages → Random engaging responses

### Mock Audio
Uses free sample audio from SoundHelix for TTS playback testing.

## Console Output

When running in demo mode, you'll see:
```
⚠️  Running in DEMO MODE - Using mock Supabase (no real database)
⚠️  Running in DEMO MODE - Using mock ElevenLabs (no real voice cloning)
⚠️  Running in DEMO MODE - Using mock LLM (no real AI)
[MOCK] Simulating Smithery scraping...
[MOCK] Cloning voice from: https://...
[MOCK] Generating TTS for: ...
```

## Adding Real Services

Simply add API keys to `.env` - services automatically switch from mock to real:

```bash
# Add Supabase first
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
# Now Supabase is real, others still mocked

# Add ElevenLabs next
ELEVENLABS_API_KEY=...
# Now voice is real, LLM still mocked

# Add OpenAI last
OPENAI_API_KEY=...
# Everything is real!
```

## Debugging

Check which services are mocked:
1. Look for `⚠️  DEMO MODE` messages on startup
2. Check console logs for `[MOCK]` prefixes
3. Verify `.env` file has required keys

## Integration Testing

When both teams are ready:
1. Jake/ZhengFeng adds their Supabase keys
2. Jeric/Jasper adds their API keys
3. Test full flow end-to-end
4. Remove mock imports if everything works

Mock code is clearly marked with `if (USE_MOCK)` - easy to find and remove later!
