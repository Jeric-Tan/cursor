// JAKE/ZHENGFENG: API client for backend communication

import { API_ENDPOINTS } from '../shared/constants.js';

const API_BASE_URL = 'http://localhost:3001'; // TODO: Update for production

export const api = {
  async startSession(fullName) {
    // TODO: POST to /api/start
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.START}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName })
    });

    if (!response.ok) {
      throw new Error('Failed to start session');
    }

    const data = await response.json();
    return data;
  },

  async uploadPictures(sessionId, photoBlobs) {
    const formData = new FormData();
    formData.append('sessionId', sessionId);

    // Append each photo
    photoBlobs.forEach((blob, index) => {
      formData.append('photos', blob, `photo-${index + 1}.jpg`);
    });

    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.UPLOAD_PICTURES}`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload pictures');
    }

    return await response.json();
  },

  async uploadVoice(sessionId, audioBlob) {
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('audio', audioBlob, 'voice-sample.mp3');

    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.UPLOAD_VOICE}`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload voice');
    }

    return await response.json();
  },

  async sendMessage(sessionId, message, useRAG = true) {
    // POST to /api/chat with RAG support
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CHAT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message, useRAG })
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return await response.json();
  },

  async sendVoiceQuestion(sessionId, audioBlob) {
    // POST to /api/voice-question with audio
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('audio', audioBlob, `question-${Date.now()}.mp3`);

    const response = await fetch(`${API_BASE_URL}/api/voice-question`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to send voice question');
    }

    return await response.json();
  },

  async getSessionStatus(sessionId) {
    // TODO: GET /api/status
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.STATUS}?sessionId=${sessionId}`);

    if (!response.ok) {
      throw new Error('Failed to get session status');
    }

    return await response.json();
  }
};
