// JAKE/ZHENGFENG: Main application logic

import { STAGES, INTERVIEW_QUESTIONS } from '../shared/constants.js';
import { api } from './api.js';

// Application state
const state = {
  currentStage: STAGES.NAME_INPUT,
  sessionId: null,
  userName: null,
  currentQuestionIndex: 0,
  recordedAudio: null,
  messages: [],
  // Emotion recognition state
  cameraStream: null,
  websocket: null,
  isEmotionDetectionActive: false,
  currentEmotion: null,
  emotionConfidence: 0
};

// MediaRecorder for voice recording
let mediaRecorder = null;
let audioChunks = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
});

function setupEventListeners() {
  // TODO: Add event listeners for all buttons
  document.getElementById('start-btn').addEventListener('click', handleNameSubmit);
  document.getElementById('record-btn').addEventListener('click', startRecording);
  document.getElementById('stop-btn').addEventListener('click', stopRecording);
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  
  // Emotion recognition event listeners
  document.getElementById('start-camera-btn').addEventListener('click', startEmotionDetection);
  document.getElementById('stop-camera-btn').addEventListener('click', stopEmotionDetection);
  document.getElementById('continue-to-chat-btn').addEventListener('click', continueToChat);
}

// Stage 1: Name Input
async function handleNameSubmit() {
  const nameInput = document.getElementById('name-input');
  const name = nameInput.value.trim();

  if (!name) {
    alert('Please enter your name');
    return;
  }

  try {
    // TODO: Call API to start session
    const response = await api.startSession(name);
    state.sessionId = response.sessionId;
    state.userName = name;

    switchStage(STAGES.VOICE_RECORDING);
    displayQuestion();
  } catch (error) {
    alert('Error starting session: ' + error.message);
  }
}

// Stage 2: Voice Recording
async function startRecording() {
  try {
    // TODO: Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      state.recordedAudio = audioBlob;

      // Upload voice and move to processing
      await uploadVoice(audioBlob);
    };

    mediaRecorder.start();
    document.getElementById('record-btn').disabled = true;
    document.getElementById('stop-btn').disabled = false;

    // TODO: Start timer display

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
  }
}

function displayQuestion() {
  const questionDisplay = document.getElementById('question-display');
  questionDisplay.textContent = INTERVIEW_QUESTIONS[state.currentQuestionIndex];
}

async function uploadVoice(audioBlob) {
  try {
    switchStage(STAGES.PROCESSING);
    updateLoadingMessage('Uploading voice sample...');

    // TODO: Upload to backend
    await api.uploadVoice(state.sessionId, audioBlob);

    updateLoadingMessage('Cloning your voice...');
    updateLoadingMessage('Scraping the web for your digital footprint...');
    updateLoadingMessage('Generating your Ego...');

    // TODO: Poll for completion
    await pollForCompletion();

    switchStage(STAGES.EMOTION_RECOGNITION);
  } catch (error) {
    alert('Error uploading voice: ' + error.message);
  }
}

// Stage 3: Processing - Poll until Ego is ready
async function pollForCompletion() {
  // TODO: Poll /api/status until isEgoReady is true
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
    // TODO: Send to backend
    const response = await api.sendMessage(state.sessionId, message);

    // Add Ego response to UI
    addMessageToChat('ego', response.textResponse);

    // Play audio response
    if (response.audioUrl) {
      playAudio(response.audioUrl);
    }

  } catch (error) {
    alert('Error sending message: ' + error.message);
  }
}

function addMessageToChat(role, content) {
  const messagesContainer = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  messageDiv.textContent = content;
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

// Emotion Recognition Functions
async function startEmotionDetection() {
  try {
    // Request camera access
    state.cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: 640, 
        height: 480,
        facingMode: 'user'
      } 
    });
    
    // Set up video element
    const video = document.getElementById('camera-feed');
    video.srcObject = state.cameraStream;
    
    // Connect to WebSocket for emotion data
    await connectToEmotionWebSocket();
    
    // Update UI
    document.getElementById('start-camera-btn').disabled = true;
    document.getElementById('stop-camera-btn').disabled = false;
    document.getElementById('continue-to-chat-btn').disabled = false;
    
    state.isEmotionDetectionActive = true;
    
  } catch (error) {
    alert('Error accessing camera: ' + error.message);
    console.error('Camera access error:', error);
  }
}

async function connectToEmotionWebSocket() {
  try {
    // Connect to Python backend WebSocket
    state.websocket = new WebSocket('ws://localhost:8765');
    
    state.websocket.onopen = () => {
      console.log('Connected to emotion recognition service');
    };
    
    state.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'emotion_frame') {
          updateEmotionDisplay(data);
        }
      } catch (error) {
        console.error('Error parsing emotion data:', error);
      }
    };
    
    state.websocket.onclose = () => {
      console.log('Disconnected from emotion recognition service');
    };
    
    state.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
  } catch (error) {
    console.error('Error connecting to emotion service:', error);
  }
}

function updateEmotionDisplay(data) {
  if (data.emotions && data.emotions.length > 0) {
    const emotion = data.emotions[0];
    const dominantEmotion = emotion.dominant_emotion;
    const confidence = Math.round(emotion.emotion[dominantEmotion] * 100);
    
    // Update emotion display
    document.getElementById('current-emotion').textContent = dominantEmotion;
    document.getElementById('emotion-confidence').textContent = `Confidence: ${confidence}%`;
    
    // Update state
    state.currentEmotion = dominantEmotion;
    state.emotionConfidence = confidence;
    
    // Update video with emotion annotations (if frame data is available)
    if (data.frame) {
      displayAnnotatedFrame(data.frame);
    }
  } else {
    document.getElementById('current-emotion').textContent = 'No emotion detected';
    document.getElementById('emotion-confidence').textContent = 'Confidence: 0%';
  }
}

function displayAnnotatedFrame(frameData) {
  const video = document.getElementById('camera-feed');
  const canvas = document.getElementById('emotion-canvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size to match video
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  
  // Create image from base64 data
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = `data:image/jpeg;base64,${frameData}`;
}

function stopEmotionDetection() {
  // Stop camera stream
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
  }
  
  // Close WebSocket connection
  if (state.websocket) {
    state.websocket.close();
    state.websocket = null;
  }
  
  // Update UI
  document.getElementById('start-camera-btn').disabled = false;
  document.getElementById('stop-camera-btn').disabled = true;
  
  state.isEmotionDetectionActive = false;
  
  // Clear video and canvas
  const video = document.getElementById('camera-feed');
  const canvas = document.getElementById('emotion-canvas');
  video.srcObject = null;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function continueToChat() {
  // Stop emotion detection
  stopEmotionDetection();
  
  // Move to chat stage
  switchStage(STAGES.CHAT);
}
