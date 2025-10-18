/**
 * Emotion Capture WebSocket Client
 * Connects to the Python emotion recognition service for AI-guided photo capture
 */

class EmotionCaptureClient {
  constructor() {
    this.websocket = null;
    this.isConnected = false;
    this.targetEmotion = null;
    this.stabilityCount = 0;
    this.requiredStability = 15; // Same as Python service
    this.onEmotionDetected = null;
    this.onStabilityReached = null;
    this.onConnectionChange = null;
  }

  connect(retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    
    return new Promise((resolve, reject) => {
      try {
        console.log(`🔗 Attempting to connect to emotion recognition service (attempt ${retryCount + 1}/${maxRetries + 1})...`);
        this.websocket = new WebSocket('ws://localhost:8765');
        
        this.websocket.onopen = () => {
          console.log('✅ Connected to emotion recognition service');
          this.isConnected = true;
          if (this.onConnectionChange) {
            this.onConnectionChange(true);
          }
          resolve();
        };

        this.websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.websocket.onclose = () => {
          console.log('🔌 Disconnected from emotion recognition service');
          this.isConnected = false;
          if (this.onConnectionChange) {
            this.onConnectionChange(false);
          }
        };

        this.websocket.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          
          // Retry logic
          if (retryCount < maxRetries) {
            console.log(`🔄 Retrying connection in ${retryDelay/1000} seconds...`);
            setTimeout(() => {
              this.connect(retryCount + 1).then(resolve).catch(reject);
            }, retryDelay);
          } else {
            console.error('❌ Max retries reached, giving up');
            reject(error);
          }
        };

      } catch (error) {
        console.error('❌ Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
      this.isConnected = false;
    }
  }

  handleMessage(data) {
    if (data.type === 'emotion_frame') {
      const emotions = data.emotions || [];
      
      if (emotions.length > 0) {
        const emotion = emotions[0]; // Take first detected face
        const detectedEmotion = emotion.dominant_emotion;
        
        // Check if this matches our target emotion
        if (this.targetEmotion && detectedEmotion === this.targetEmotion) {
          this.stabilityCount++;
          
          if (this.onEmotionDetected) {
            this.onEmotionDetected({
              emotion: detectedEmotion,
              confidence: emotion.emotion[detectedEmotion] || 0,
              stability: this.stabilityCount,
              required: this.requiredStability,
              region: emotion.region
            });
          }
          
          // Check if we've reached stability
          if (this.stabilityCount >= this.requiredStability) {
            if (this.onStabilityReached) {
              this.onStabilityReached({
                emotion: detectedEmotion,
                confidence: emotion.emotion[detectedEmotion] || 0,
                region: emotion.region
              });
            }
            this.stabilityCount = 0; // Reset for next emotion
          }
        } else {
          // Different emotion detected, reset stability
          this.stabilityCount = 0;
        }
      } else {
        // No face detected, reset stability
        this.stabilityCount = 0;
      }
    }
  }

  setTargetEmotion(emotion) {
    this.targetEmotion = emotion;
    this.stabilityCount = 0;
    console.log(`Target emotion set to: ${emotion}`);
  }

  resetStability() {
    this.stabilityCount = 0;
  }
}

// Export for use in other modules
window.EmotionCaptureClient = EmotionCaptureClient;
