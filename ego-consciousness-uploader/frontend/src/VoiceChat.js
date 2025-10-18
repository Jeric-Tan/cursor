import React, { useState, useEffect, useRef } from 'react';
import './VoiceChat.css';

const VOICE_CHAT_API = 'http://localhost:3001';

function VoiceChat() {
  const [voiceClones, setVoiceClones] = useState([]);
  const [selectedClone, setSelectedClone] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    loadVoiceClones();
  }, []);

  const loadVoiceClones = async () => {
    try {
      const response = await fetch(`${VOICE_CHAT_API}/api/voice-clones`);
      const data = await response.json();
      setVoiceClones(data.clones);
      
      if (data.clones.length > 0) {
        setSelectedClone(data.clones[0]);
      }
    } catch (error) {
      console.error('Error loading voice clones:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await sendVoiceMessage(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendVoiceMessage = async (audioBlob) => {
    if (!selectedClone || isGenerating) return;

    console.log('🎤 Sending voice message...');
    console.log('  Audio size:', audioBlob.size, 'bytes');
    console.log('  Voice ID:', selectedClone.voice_id);

    setIsGenerating(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-message.wav');
      formData.append('voiceId', selectedClone.voice_id);

      console.log('  Sending to:', `${VOICE_CHAT_API}/api/voice-chat`);

      const response = await fetch(`${VOICE_CHAT_API}/api/voice-chat`, {
        method: 'POST',
        body: formData,
      });

      console.log('  Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('  Server error:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('  Response data:', data);
      
      if (data.success) {
        console.log('✅ Voice message processed successfully');
        
        // Add user transcription to chat (only if not a clarification request)
        if (!data.clarification) {
          setChatHistory(prev => [...prev, {
            role: 'user',
            content: data.user_transcription,
            timestamp: new Date()
          }]);
        }
        
        // Add AI response to chat
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: data.ai_response,
          audioUrl: `${VOICE_CHAT_API}${data.audioUrl}`,
          timestamp: new Date(),
          isClarification: data.clarification || false
        }]);
        
        // Play the audio automatically
        if (data.audioUrl) {
          const audio = new Audio(`${VOICE_CHAT_API}${data.audioUrl}`);
          audio.play().catch(err => {
            console.error('Audio playback error:', err);
          });
        }
      } else {
        const errorMsg = data.error || 'Unknown error processing voice message';
        console.error('❌ Server returned error:', errorMsg);
        alert(`Failed to process voice message: ${errorMsg}`);
      }
    } catch (error) {
      console.error('❌ Error sending voice message:', error);
      
      // More helpful error messages
      let errorMessage = 'Error sending voice message. ';
      if (error.message.includes('Failed to fetch')) {
        errorMessage += 'Backend server may not be running. Check if http://localhost:3001 is accessible.';
      } else if (error.message.includes('NetworkError')) {
        errorMessage += 'Network error. Check your internet connection and CORS settings.';
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRecordButtonClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div id="chat-stage">
      <h2>Chat with Your Ego</h2>
      
      {!selectedClone ? (
        <div className="loading">
          <p>Loading voice clone...</p>
        </div>
      ) : (
        <>
          <div id="chat-messages" className="glass-surface">
            {chatHistory.length === 0 ? (
              <p className="empty-chat">Start a conversation with your voice clone!</p>
            ) : (
              chatHistory.map((msg, index) => (
                <div key={index} className={`message ${msg.role} ${msg.isClarification ? 'clarification' : ''}`}>
                  <div className="message-content">
                    <strong>{msg.role === 'user' ? 'You' : 'Your Clone'}:</strong>
                    {msg.isClarification && <span className="clarification-badge">🔊 Asking for clarification</span>}
                    <p>{msg.content}</p>
                    {msg.audioUrl && (
                      <audio controls src={msg.audioUrl} style={{ width: '100%', marginTop: '8px' }} />
                    )}
                  </div>
                </div>
              ))
            )}
            {isGenerating && (
              <div className="message assistant generating">
                <div className="message-content">
                  <strong>Your Clone:</strong>
                  <p>Thinking...</p>
                </div>
              </div>
            )}
          </div>
          
          <div id="chat-input-container">
            <div className="voice-input-info">
              {isRecording && <span className="recording-indicator">🔴 Recording...</span>}
              {isGenerating && <span className="generating-indicator">⏳ Processing...</span>}
              {!isRecording && !isGenerating && <span className="ready-indicator">🎤 Click to speak</span>}
            </div>
            <button
              id="record-btn"
              className={isRecording ? 'recording' : ''}
              onClick={handleRecordButtonClick}
              disabled={isGenerating}
            >
              {isRecording ? '⏹️ Stop Recording' : '🎤 Record Voice'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default VoiceChat;
