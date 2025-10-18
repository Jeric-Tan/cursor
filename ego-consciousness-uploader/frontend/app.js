// JAKE/ZHENGFENG: Main application logic

import { STAGES, INTERVIEW_QUESTIONS } from '../shared/constants.js';
import { api } from './api.js';

// Application state
const state = {
  currentStage: STAGES.NAME_INPUT,
  sessionId: null,
  userName: null,
  currentQuestionIndex: 0,
  capturedPhotos: [],
  recordedAudio: null,
  messages: [],
  cameraStream: null,
  currentPhotoCount: 0,
  audioChunks: []
};

// MediaRecorder for voice recording
let mediaRecorder = null;
let audioChunks = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, setting up event listeners...');
  setupEventListeners();
});

function setupEventListeners() {
  console.log('Setting up event listeners...');

  // Name input stage
  const startBtn = document.getElementById('start-btn');
  const nameInput = document.getElementById('name-input');

  // Camera capture stage
  const capturePhotoBtn = document.getElementById('capture-photo-btn');
  const recordBtn = document.getElementById('record-btn');
  const stopBtn = document.getElementById('stop-btn');

  // Chat stage
  const sendBtn = document.getElementById('send-btn');
  const chatInput = document.getElementById('chat-input');

  console.log('Found buttons:', {
    startBtn, capturePhotoBtn, recordBtn, stopBtn, sendBtn
  });

  if (startBtn) {
    startBtn.addEventListener('click', handleNameSubmit);
    console.log('Start button listener added');
  }

  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleNameSubmit();
      }
    });
    console.log('Name input Enter-to-start enabled');
  }

  if (capturePhotoBtn) {
    capturePhotoBtn.addEventListener('click', capturePhoto);
    console.log('Capture photo button listener added');
  }

  if (recordBtn) {
    recordBtn.addEventListener('click', startRecording);
    console.log('Record button listener added');
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', stopRecording);
    console.log('Stop button listener added');
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
    console.log('Send button listener added');
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    console.log('Chat input Enter-to-send enabled');
  }
}

// Stage 1: Name Input
async function handleNameSubmit() {
  console.log('handleNameSubmit called!');
  const nameInput = document.getElementById('name-input');
  const name = nameInput.value.trim();

  console.log('Name input value:', name);

  if (!name) {
    alert('Please enter your name');
    return;
  }

  try {
    const response = await api.startSession(name);
    state.sessionId = response.sessionId;
    state.userName = name;

    switchStage(STAGES.CAMERA_CAPTURE);
    await startCamera();
  } catch (error) {
    alert('Error starting session: ' + error.message);
  }
}

// Stage 2: Camera Capture
async function startCamera() {
  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }
    });

    const videoElement = document.getElementById('camera-feed');
    videoElement.srcObject = state.cameraStream;

    console.log('Camera started successfully');
  } catch (error) {
    alert('Error accessing camera: ' + error.message);
  }
}

const PHOTO_INSTRUCTIONS = [
  "Picture 1 of 4: Look at the camera with a neutral expression",
  "Picture 2 of 4: Smile naturally",
  "Picture 3 of 4: Look slightly to the left",
  "Picture 4 of 4: Look slightly to the right"
];

async function capturePhoto() {
  const video = document.getElementById('camera-feed');
  const canvas = document.getElementById('camera-canvas');
  const ctx = canvas.getContext('2d');

  // Set canvas size to match video
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Draw current video frame to canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Convert canvas to blob
  canvas.toBlob(async (blob) => {
    state.capturedPhotos.push(blob);
    state.currentPhotoCount++;

    // Update UI to show photo was captured
    const photoSlot = document.getElementById(`photo-slot-${state.currentPhotoCount}`);
    photoSlot.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
    photoSlot.style.backgroundSize = 'cover';
    photoSlot.textContent = '';

    if (state.currentPhotoCount < 4) {
      // Update instruction for next photo
      document.getElementById('photo-instruction').textContent =
        PHOTO_INSTRUCTIONS[state.currentPhotoCount];
    } else {
      // All photos captured, upload and move to voice recording
      await uploadPhotos();

      // Stop camera
      stopCamera();

      // Hide camera section, show voice section
      document.getElementById('camera-container').style.display = 'none';
      document.getElementById('camera-instructions').style.display = 'none';
      document.getElementById('camera-controls').style.display = 'none';
      document.getElementById('voice-section').style.display = 'block';

      // Display first question
      displayQuestion();
    }
  }, 'image/jpeg', 0.95);
}

function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
  }
}

async function uploadPhotos() {
  try {
    console.log('Uploading photos...');
    await api.uploadPictures(state.sessionId, state.capturedPhotos);
    console.log('Photos uploaded successfully');
  } catch (error) {
    console.error('Error uploading photos:', error);
    alert('Error uploading photos: ' + error.message);
  }
}

// Voice Recording
let recordingStartTime = 0;
let timerInterval = null;

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Use audio/mpeg if supported, otherwise fall back to webm
    const mimeType = MediaRecorder.isTypeSupported('audio/mpeg')
      ? 'audio/mpeg'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(stream, { mimeType });
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { mimeType });
      state.audioChunks.push({
        question: INTERVIEW_QUESTIONS[state.currentQuestionIndex],
        audio: audioBlob
      });

      // Move to next question
      state.currentQuestionIndex++;

      if (state.currentQuestionIndex < INTERVIEW_QUESTIONS.length) {
        displayQuestion();
        document.getElementById('recording-status').textContent =
          `Question ${state.currentQuestionIndex} of ${INTERVIEW_QUESTIONS.length} answered!`;
      } else {
        // All questions answered
        document.getElementById('recording-status').textContent =
          'All questions answered! Processing...';

        // Combine all audio chunks and upload
        await combineAndUploadAudio();
      }
    };

    mediaRecorder.start();
    document.getElementById('record-btn').disabled = true;
    document.getElementById('stop-btn').disabled = false;

    // Start timer
    recordingStartTime = Date.now();
    timerInterval = setInterval(updateTimer, 100);

  } catch (error) {
    alert('Error accessing microphone: ' + error.message);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());

    document.getElementById('record-btn').disabled = false;
    document.getElementById('stop-btn').disabled = true;

    // Stop timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    document.getElementById('timer').textContent = '0:00';
  }
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  document.getElementById('timer').textContent =
    `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function displayQuestion() {
  const questionDisplay = document.getElementById('question-display');
  questionDisplay.innerHTML = `
    <p><strong>Question ${state.currentQuestionIndex + 1} of ${INTERVIEW_QUESTIONS.length}:</strong></p>
    <p>${INTERVIEW_QUESTIONS[state.currentQuestionIndex]}</p>
  `;
}

async function combineAndUploadAudio() {
  try {
    // Concatenate the per-answer recordings using Web Audio and export as WAV
    const blobs = state.audioChunks.map(item => item.audio);
    const combinedBlob = await concatenateAudioBlobsToWav(blobs);
    await uploadVoice(combinedBlob);
  } catch (error) {
    alert('Error combining audio: ' + error.message);
  }
}

async function uploadVoice(audioBlob) {
  try {
    switchStage(STAGES.PROCESSING);
    updateLoadingMessage('Uploading voice sample...');

    await api.uploadVoice(state.sessionId, audioBlob);

    updateLoadingMessage('Cloning your voice...');
    updateLoadingMessage('Scraping the web for your digital footprint...');
    updateLoadingMessage('Generating your Ego...');

    await pollForCompletion();

    switchStage(STAGES.CHAT);
  } catch (error) {
    alert('Error uploading voice: ' + error.message);
  }
}

// Use Web Audio API to concatenate multiple blobs into a single WAV
async function concatenateAudioBlobsToWav(blobs) {
  const AudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const TempAudioContext = window.AudioContext || window.webkitAudioContext;
  const tempCtx = new TempAudioContext();

  // Decode all blobs
  const decoded = [];
  for (const blob of blobs) {
    const arrayBuf = await blob.arrayBuffer();
    const audioBuf = await tempCtx.decodeAudioData(arrayBuf);
    decoded.push(audioBuf);
  }

  // Close temp context to free resources
  if (tempCtx && tempCtx.close) {
    try { await tempCtx.close(); } catch (_) {}
  }

  // Determine channels and sample rate; use the first buffer as reference
  const channels = Math.max(...decoded.map(b => b.numberOfChannels));
  const sampleRate = decoded[0]?.sampleRate || 44100;

  // Total duration in seconds
  const totalDuration = decoded.reduce((acc, b) => acc + b.duration, 0);
  const offline = new AudioContextClass(channels, Math.ceil(totalDuration * sampleRate), sampleRate);

  // Schedule buffers back-to-back
  let offset = 0;
  for (const buf of decoded) {
    const src = offline.createBufferSource();
    src.buffer = buf;
    src.connect(offline.destination);
    src.start(offset);
    offset += buf.duration;
  }

  const rendered = await offline.startRendering();
  return audioBufferToWavBlob(rendered);
}

function audioBufferToWavBlob(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numOfChan * 2 + 44; // 16-bit PCM
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);

  // RIFF/WAVE header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + buffer.length * numOfChan * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);               // PCM chunk size
  view.setUint16(20, 1, true);                // format = PCM
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChan * 2, true); // byte rate
  view.setUint16(32, numOfChan * 2, true);    // block align
  view.setUint16(34, 16, true);               // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, buffer.length * numOfChan * 2, true);

  // Interleave channels
  const channels = [];
  for (let i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  const sampleCount = buffer.length;
  for (let i = 0; i < sampleCount; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      // Clamp and convert to 16-bit
      let s = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Stage 3: Processing - Poll until Ego is ready
async function pollForCompletion() {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        const status = await api.getSessionStatus(state.sessionId);
        if (status.isEgoReady) {
          clearInterval(interval);
          resolve();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000); // Poll every 3 seconds
  });
}

// Stage 4: Chat
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();

  if (!message) return;

  // Add user message to UI
  addMessageToChat('user', message);
  input.value = '';

  try {
    // Send to backend with RAG enabled
    const response = await api.sendMessage(state.sessionId, message, true);

    // Add Ego response to UI
    addMessageToChat('ego', response.textResponse, response.sources);

    // Play audio response
    if (response.audioUrl) {
      playAudio(response.audioUrl);
    }

  } catch (error) {
    alert('Error sending message: ' + error.message);
  }
}

function addMessageToChat(role, content, sources = null) {
  const messagesContainer = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  // Add message content
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = content;
  messageDiv.appendChild(contentDiv);

  // Add sources if available (RAG responses)
  if (sources && sources.length > 0) {
    const sourcesDiv = document.createElement('div');
    sourcesDiv.className = 'message-sources';
    sourcesDiv.innerHTML = '<details><summary>📚 Sources</summary><ul>' +
      sources.slice(0, 3).map((source, i) =>
        `<li>
          <strong>${source.metadata.topic || 'Context'}</strong> (${Math.round(source.score * 100)}% match)<br>
          <small>${source.metadata.url || ''}</small>
        </li>`
      ).join('') +
      '</ul></details>';
    messageDiv.appendChild(sourcesDiv);
  }

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function playAudio(audioUrl) {
  const audioPlayer = document.getElementById('audio-player');
  audioPlayer.src = audioUrl;
  audioPlayer.play();
}

// Utility functions
function switchStage(newStage) {
  // Hide all stages
  document.querySelectorAll('.stage').forEach(stage => {
    stage.classList.add('hidden');
    stage.classList.remove('active');
  });

  // Show new stage
  const stageElement = document.getElementById(`${newStage}-stage`);
  stageElement.classList.remove('hidden');
  stageElement.classList.add('active');

  state.currentStage = newStage;
}

function updateLoadingMessage(message) {
  const loadingMessage = document.getElementById('loading-message');
  if (loadingMessage) {
    loadingMessage.textContent = message;
  }
}
