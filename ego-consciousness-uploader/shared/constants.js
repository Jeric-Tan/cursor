// Shared constants used by both frontend and backend

export const STAGES = {
  NAME_INPUT: 'name-input',
  VOICE_RECORDING: 'voice-recording',
  PROCESSING: 'processing',
  CHAT: 'chat'
};

export const API_ENDPOINTS = {
  START: '/api/start',
  UPLOAD_VOICE: '/api/upload-voice',
  CHAT: '/api/chat',
  STATUS: '/api/status',
  WEBHOOK: '/api/webhook'
};

export const INTERVIEW_QUESTIONS = [
  "Tell me about yourself and what you do.",
  "What are you most passionate about?",
  "Describe your typical day.",
  "What's something you're currently working on?"
];

export const MAX_RECORDING_TIME = 120; // seconds
export const MAX_NAME_LENGTH = 100;
export const MAX_MESSAGE_LENGTH = 500;
