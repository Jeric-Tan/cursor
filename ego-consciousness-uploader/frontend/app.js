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
  console.log('DOM loaded, setting up event listeners...');
  setupEventListeners();
});

function setupEventListeners() {
  console.log('Setting up event listeners...');

  // Name input stage
  const startBtn = document.getElementById('start-btn');
  const nameInput = document.getElementById('name-input');

  // Voice recording stage
  const recordBtn = document.getElementById('record-btn');
  const stopBtn = document.getElementById('stop-btn');

  // Emotion recognition stage
  const startCameraBtn = document.getElementById('start-camera-btn');
  const stopCameraBtn = document.getElementById('stop-camera-btn');
  const continueToChatBtn = document.getElementById('continue-to-chat-btn');

  // Chat stage
  const sendBtn = document.getElementById('send-btn');
  const chatInput = document.getElementById('chat-input');

  console.log('Found buttons:', {
    startBtn, recordBtn, stopBtn, sendBtn,
    startCameraBtn, stopCameraBtn, continueToChatBtn
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

  if (recordBtn) {
    recordBtn.addEventListener('click', startRecording);
    console.log('Record button listener added');
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', stopRecording);
    console.log('Stop button listener added');
  }

  if (startCameraBtn) {
    startCameraBtn.addEventListener('click', startEmotionDetection);
    console.log('Start camera button listener added');
  }

  if (stopCameraBtn) {
    stopCameraBtn.addEventListener('click', stopEmotionDetection);
    console.log('Stop camera button listener added');
  }

  if (continueToChatBtn) {
    continueToChatBtn.addEventListener('click', continueToChat);
    console.log('Continue to chat button listener added');
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

// Emotion Recognition Functions
async function startEmotionDetection() {
  try {
    console.log('🔗 Connecting to emotion recognition service...');
    
    // Connect to WebSocket for emotion data
    // Note: We don't need browser camera access since backend captures directly
    await connectToEmotionWebSocket();
    
    // Update UI
    document.getElementById('start-camera-btn').disabled = true;
    document.getElementById('stop-camera-btn').disabled = false;
    document.getElementById('continue-to-chat-btn').disabled = false;
    
    state.isEmotionDetectionActive = true;
    
    console.log('✅ Connected to emotion recognition service');
    console.log('ℹ️  Backend is capturing video directly from your camera');
    
  } catch (error) {
    alert('Error connecting to emotion service: ' + error.message);
    console.error('Connection error:', error);
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
  // Always try to display the frame if available
  if (data.frame && data.frame.length > 0) {
    displayAnnotatedFrame(data.frame);
  }
  
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
  } else {
    document.getElementById('current-emotion').textContent = 'No emotion detected';
    document.getElementById('emotion-confidence').textContent = 'Confidence: 0%';
  }
}

function displayAnnotatedFrame(frameData) {
  const canvas = document.getElementById('emotion-canvas');
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  
  // Create image from base64 data
  const img = new Image();
  img.onload = () => {
    try {
      // Set canvas size to match the image (only if different)
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      
      // Clear canvas and draw the annotated frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    } catch (error) {
      console.error('Error drawing image:', error);
    }
  };
  
  img.onerror = () => {
    console.error('Failed to load image from base64 data');
  };
  
  img.src = `data:image/jpeg;base64,${frameData}`;
}

function stopEmotionDetection() {
  // Close WebSocket connection
  if (state.websocket) {
    state.websocket.close();
    state.websocket = null;
  }
  
  // Update UI
  document.getElementById('start-camera-btn').disabled = false;
  document.getElementById('stop-camera-btn').disabled = true;
  
  state.isEmotionDetectionActive = false;
  
  // Clear canvas
  const canvas = document.getElementById('emotion-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function continueToChat() {
  // Stop emotion detection
  stopEmotionDetection();
  
  // Move to chat stage
  switchStage(STAGES.CHAT);
}
