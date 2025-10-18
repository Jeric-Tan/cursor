# Quick Fix for "Error Sending Voice Message"

## Immediate Checks (Do these first!)

### 1. ✅ Is the backend running?
Open a terminal:
```bash
cd ego-consciousness-uploader/backend
npm start
```

You should see:
```
🚀 Backend server running on http://localhost:3001
```

---

### 2. ✅ Do you have API keys configured?
Check if `ego-consciousness-uploader/backend/.env` exists with:
```env
ELEVENLABS_API_KEY=sk_...your_key...
OPENAI_API_KEY=sk-...your_key...
```

If missing, create this file with your keys.

---

### 3. ✅ Do you have a voice clone?
You need to complete the interview first:
1. Go to the interview page
2. Record answers to questions
3. Wait for voice clone creation
4. Then try voice chat

---

### 4. ✅ Check browser console for specific error
Press `F12` → Console tab

Look for the error message. Common ones:

#### "Failed to fetch"
→ Backend is not running (see step 1)

#### "Voice ID and audio file are required"
→ No voice clone selected. Create one first (see step 3)

#### "Could not access microphone"
→ Grant microphone permission in browser settings

#### Network error / CORS error
→ Backend might be on wrong port. Check it's on port 3001

---

## Most Likely Issue: Missing Voice Clone

**Problem**: You're trying to chat, but haven't created a voice clone yet.

**Solution**:
1. Go to: `http://localhost:3000` (interview page)
2. Click "Start Interview"
3. Record your voice answering the question
4. Submit the interview
5. Wait for clone creation (~30 seconds)
6. Then return to voice chat

---

## Still Not Working? Get Detailed Error Info

### In Browser Console (F12):
```javascript
// Test if backend is reachable
fetch('http://localhost:3001/health')
  .then(r => r.json())
  .then(d => console.log('✅ Backend OK:', d))
  .catch(e => console.error('❌ Backend Error:', e));

// Test if voice clones exist
fetch('http://localhost:3001/api/voice-clones')
  .then(r => r.json())
  .then(d => console.log('Voice Clones:', d))
  .catch(e => console.error('Error:', e));
```

### In Backend Terminal:
Look for error messages like:
- `ERROR: Transcription failed`
- `ERROR: OpenAI API failed`
- `ERROR: Speech generation failed`
- `python not found`

---

## Emergency Debug Mode

### 1. Enable detailed logging in VoiceChat.js

Add this right before `sendVoiceMessage`:
```javascript
console.log('=== DEBUG INFO ===');
console.log('Selected Clone:', selectedClone);
console.log('Audio Blob:', audioBlob);
console.log('Audio Blob Size:', audioBlob.size, 'bytes');
console.log('API URL:', `${VOICE_CHAT_API}/api/voice-chat`);
console.log('==================');
```

### 2. Check what the server receives

In `backend/controllers/voiceController.js`, line 43, add:
```javascript
console.log('📥 Received request:');
console.log('  - Voice ID:', voiceId);
console.log('  - Audio File:', audioFile ? audioFile.filename : 'MISSING');
console.log('  - File Size:', audioFile ? audioFile.size : 0);
```

---

## Quick Test Script

Run this to verify everything is set up:
```bash
cd ego-consciousness-uploader/backend
node test-voice-endpoint.js
```

This will tell you exactly what's wrong.

---

## Need More Help?

Copy and paste the following info:

1. **Browser Console Error** (F12 → Console):
   ```
   [paste the red error message here]
   ```

2. **Backend Terminal Output**:
   ```
   [paste the last 20 lines from backend terminal]
   ```

3. **Response from this command**:
   ```bash
   curl http://localhost:3001/api/voice-clones
   ```

