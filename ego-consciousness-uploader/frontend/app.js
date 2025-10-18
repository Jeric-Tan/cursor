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
  messages: []
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

    switchStage(STAGES.CHAT);
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
