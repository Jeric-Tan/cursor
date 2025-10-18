# Debugging Voice Chat Errors

## Common Issues and Solutions

### 1. **Backend Server Not Running**
**Symptom**: "Failed to fetch" or "Network error"

**Solution**:
```bash
cd ego-consciousness-uploader/backend
npm start
```
Server should be running on `http://localhost:3001`

---

### 2. **Missing Environment Variables**
**Symptom**: Backend receives request but fails processing

**Check**: `ego-consciousness-uploader/backend/.env` should contain:
```env
ELEVENLABS_API_KEY=your_elevenlabs_key_here
OPENAI_API_KEY=your_openai_key_here
PORT=3001
```

**Fix**: Create `.env` file if missing and add your API keys.

---

### 3. **Python Not Installed or Wrong Version**
**Symptom**: Backend logs show "python not found" or spawn errors

**Check**:
```bash
python --version
# Should be Python 3.7+
```

**Fix**: Install Python 3 and ensure it's in PATH.

---

### 4. **Missing Python Dependencies**
**Symptom**: Python script fails with ImportError

**Fix**:
```bash
cd ego-consciousness-uploader/elevenlabs
pip install -r requirements.txt
```

Required packages:
- elevenlabs
- openai
- python-dotenv
- requests

---

### 5. **CORS Issues**
**Symptom**: Browser console shows CORS error

**Check**: `backend/server.js` should have:
```javascript
app.use(cors());
```

This should already be configured.

---

### 6. **Voice Clone Not Found**
**Symptom**: "Clone not found" error

**Solution**: Create a voice clone first:
1. Complete the interview process
2. Wait for voice clone creation
3. Verify clone exists in database

---

### 7. **Microphone Permissions**
**Symptom**: "Could not access microphone"

**Fix**: 
- Allow microphone access in browser
- Check browser settings → Privacy → Microphone
- Try refreshing the page after granting permission

---

## Quick Debug Steps

### Step 1: Check Browser Console
Open DevTools (F12) → Console tab

Look for errors like:
```
Error sending voice message: [error details]
```

### Step 2: Check Backend Logs
In the terminal where backend is running, look for:
```
🎤 Voice chat request: voice=...
ERROR: [error details]
```

### Step 3: Test Backend Directly
Using curl or Postman:
```bash
curl http://localhost:3001/api/voice-clones
```

Should return list of voice clones.

### Step 4: Check Network Tab
In DevTools → Network tab:
- Look for the `/api/voice-chat` request
- Check the status code (should be 200)
- Check response body for error details

---

## Specific Error Messages

### "Voice ID and audio file are required"
**Cause**: Audio blob not being sent correctly

**Fix**: Check that `selectedClone` exists:
```javascript
console.log('Selected Clone:', selectedClone);
```

### "Failed to parse Python output"
**Cause**: Python script crashed or returned invalid JSON

**Fix**: Run Python script manually to see error:
```bash
cd ego-consciousness-uploader/elevenlabs
python voice_to_voice.py test.wav your-voice-id "[]"
```

### "Failed to process voice message"
**Cause**: Generic backend error

**Fix**: Check backend terminal for detailed error logs

---

## Testing the Voice System

### Test 1: Check Voice Clones
```javascript
// In browser console
fetch('http://localhost:3001/api/voice-clones')
  .then(r => r.json())
  .then(d => console.log('Clones:', d));
```

### Test 2: Test Recording
```javascript
// In browser console
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(() => console.log('✅ Microphone access granted'))
  .catch(e => console.error('❌ Microphone error:', e));
```

### Test 3: Check Backend Health
```javascript
fetch('http://localhost:3001/health')
  .then(r => r.json())
  .then(d => console.log('Backend Status:', d));
```

---

## Advanced Debugging

### Enable Detailed Logging

1. **Backend**: Add more console logs in `chatService.js`:
```javascript
console.log('Audio path:', audioPath);
console.log('Voice ID:', voiceId);
console.log('History:', history);
console.log('Python process started...');
```

2. **Frontend**: Add logs before sending:
```javascript
console.log('Audio Blob:', audioBlob);
console.log('Audio Blob size:', audioBlob.size);
console.log('Voice ID:', selectedClone.voice_id);
```

### Check File Uploads Directory
```bash
ls ego-consciousness-uploader/backend/uploads/voice_messages/
```

Should show uploaded audio files with timestamps.

### Manual Python Test
```bash
cd ego-consciousness-uploader/elevenlabs
python
>>> from voice_to_voice import VoiceToVoiceChat
>>> chat = VoiceToVoiceChat()
>>> print(chat.elevenlabs)  # Should show ElevenLabs client
>>> print(chat.openai_api_key)  # Should show your API key
```

---

## Contact Support

If none of these solutions work, provide:
1. Browser console error (full message)
2. Backend terminal output (full log)
3. Python version (`python --version`)
4. Node version (`node --version`)
5. OS (Windows/Mac/Linux)

