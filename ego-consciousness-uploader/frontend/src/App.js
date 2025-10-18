import React, { useState, useRef } from 'react';
import './App.css';
import VoiceChat from './VoiceChat';

const INTERVIEW_QUESTIONS = [
  "Tell me your name and a bit about yourself."
];

function App() {
  const [currentStep, setCurrentStep] = useState('name-input');
  const [userName, setUserName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useTestAudio, setUseTestAudio] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoRef = useRef(null);

  const API_BASE = 'http://localhost:3001';

  // Start interview session
  const startInterview = async () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/start-interview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userName }),
      });

      const data = await response.json();
      setSessionId(data.sessionId);
      setCurrentStep('voice-recording');
    } catch (error) {
      console.error('Error starting interview:', error);
      alert('Error starting interview');
    }
  };

  // Start camera and recording
  const startRecording = async () => {
    try {
      // Get both video and audio
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      // Set video stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStream(stream);
      
      // Create media recorder for audio only
      const audioStream = new MediaStream(stream.getAudioTracks());
      const mediaRecorder = new MediaRecorder(audioStream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setRecordedAudio(audioBlob);
        
        // Stop camera stream
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
        }
        
        // Auto-start processing after audio is saved
        await uploadAndProcess(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing camera/microphone:', error);
      alert('Error accessing camera/microphone. Please allow camera and microphone access.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      
      setIsRecording(false);
      // Processing will be triggered in the onstop handler
    }
  };

  // Upload audio and complete interview
  const uploadAndProcess = async (audioBlob) => {
    setIsProcessing(true);
    setCurrentStep('processing');

    try {
      // Set test mode on backend
      await fetch(`${API_BASE}/api/test-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: useTestAudio }),
      });

      // Upload audio
      const formData = new FormData();
      formData.append('audio', audioBlob, `question_${currentQuestion}.wav`);
      formData.append('sessionId', sessionId);
      formData.append('questionIndex', currentQuestion.toString());

      await fetch(`${API_BASE}/api/upload-audio`, {
        method: 'POST',
        body: formData,
      });

      // Complete interview
      const response = await fetch(`${API_BASE}/api/complete-interview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();
      
      // Simulate processing time
      setTimeout(() => {
        setCurrentStep('chat');
        setIsProcessing(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error completing interview:', error);
      alert('Error completing interview');
      setIsProcessing(false);
    }
  };

  // Play sample audio for question
  const playSampleAudio = () => {
    const audio = new Audio(`${API_BASE}/api/test-audio`);
    audio.play().catch(error => {
      console.error('Error playing sample audio:', error);
    });
  };

  // Handle Enter key in name input
  const handleNameKeyPress = (e) => {
    if (e.key === 'Enter') {
      startInterview();
    }
  };

  // Set background image
  React.useEffect(() => {
    document.body.style.backgroundImage = `url(${process.env.PUBLIC_URL}/background.jpg)`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
    document.body.style.backgroundAttachment = 'fixed';
  }, []);

  return (
    <>
      <h1>Ego</h1>
      <div id="app">
        {/* Stage 1: Name Input */}
        {currentStep === 'name-input' && (
          <div className="stage active">
            <input
              type="text"
              id="name-input"
              placeholder="Your full name."
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyPress={handleNameKeyPress}
            />
            <p className="subtext">upload yourself.</p>
          </div>
        )}

        {/* Stage 2: Video Recording */}
        {currentStep === 'voice-recording' && (
          <div className="stage active">
            <h2>Tell me about yourself</h2>
            
            {/* Camera Feed */}
            <div className="camera-container glass-surface">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline
                style={{
                  width: '100%',
                  maxWidth: '600px',
                  borderRadius: '12px',
                  transform: 'scaleX(-1)', // Mirror the video
                  backgroundColor: '#000',
                  display: 'block'
                }}
              />
              
              {/* Recording indicator overlay */}
              {isRecording && (
                <div className="recording-overlay">
                  <div className="pulse-dot"></div>
                  <span>Recording...</span>
                </div>
              )}
            </div>
            
            {/* Recording Controls */}
            <div className="recording-controls">
              {!isRecording ? (
                <button onClick={startRecording} id="record-btn" className="start-btn">
                  🎤 Start Recording
                </button>
              ) : (
                <button onClick={stopRecording} id="stop-btn" className="stop-btn recording">
                  ⏹️ Stop Recording
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stage 3: Processing */}
        {currentStep === 'processing' && (
          <div className="stage active">
            <h2>Creating Your Ego...</h2>
            <div id="loading-message">Processing your voice clone...</div>
            <div className="spinner"></div>
          </div>
        )}

        {/* Stage 4: Chat */}
        {currentStep === 'chat' && (
          <div className="stage active">
            <VoiceChat />
          </div>
        )}
      </div>
    </>
  );
}

export default App;
