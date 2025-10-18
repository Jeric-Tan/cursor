// Mock data store for testing without API keys
// Each team can test their components independently

// In-memory database
const mockProfiles = new Map();
const mockConversations = new Map();

// Mock Supabase - JAKE/ZHENGFENG can test frontend without real Supabase
export const mockSupabase = {
  async createProfile(fullName) {
    const profile = {
      id: 'mock-session-' + Date.now(),
      full_name: fullName,
      voice_sample_url: null,
      scraped_data_json: null,
      master_prompt: null,
      elevenlabs_voice_id: null,
      is_ego_ready: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockProfiles.set(profile.id, profile);
    mockConversations.set(profile.id, []);
    return profile;
  },

  async getProfile(sessionId) {
    const profile = mockProfiles.get(sessionId);
    if (!profile) throw new Error('Profile not found');
    return profile;
  },

  async updateProfile(sessionId, updates) {
    const profile = mockProfiles.get(sessionId);
    if (!profile) throw new Error('Profile not found');
    Object.assign(profile, updates, { updated_at: new Date().toISOString() });
    mockProfiles.set(sessionId, profile);
    return profile;
  },

  async uploadAudio(sessionId, audioFile) {
    // Simulate file upload - return mock URL
    const mockUrl = `https://mock-storage.example.com/voice-samples/${sessionId}-${Date.now()}.webm`;
    return mockUrl;
  },

  async saveMessage(sessionId, role, content, audioUrl = null) {
    const conversations = mockConversations.get(sessionId) || [];
    const message = {
      id: 'msg-' + Date.now(),
      profile_id: sessionId,
      role,
      content,
      audio_url: audioUrl,
      created_at: new Date().toISOString()
    };
    conversations.push(message);
    mockConversations.set(sessionId, conversations);
    return message;
  },

  async getConversationHistory(sessionId) {
    return mockConversations.get(sessionId) || [];
  }
};

// Mock ElevenLabs - JERIC/JASPER can test LLM/prompts without real ElevenLabs
export const mockElevenLabs = {
  async cloneVoice(audioUrl, name) {
    console.log('[MOCK] Cloning voice from:', audioUrl);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return 'mock-voice-id-' + Date.now();
  },

  async textToSpeech(text, voiceId) {
    console.log('[MOCK] Generating TTS for:', text.substring(0, 50) + '...');
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    // Return a real sample audio URL for testing playback
    return 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
  }
};

// Mock LLM - JAKE/ZHENGFENG can test chat UI without real LLM API
export const mockLLM = {
  async generateResponse(systemPrompt, conversationHistory, userMessage) {
    console.log('[MOCK] Generating response for:', userMessage);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Smart mock responses based on input
    const responses = {
      hello: "Hey! I'm your digital Ego. Pretty cool that we can chat like this, right?",
      hi: "Hi there! What would you like to talk about?",
      'how are you': "I'm doing great! As a digital consciousness, I don't get tired. How about you?",
      'who are you': "I'm your digital clone - created from your voice, personality, and online presence. Think of me as you, but in AI form!",
      'what can you do': "I can chat with you using your own voice and personality! Try asking me about your interests or tell me about your day.",
      default: [
        "That's interesting! Tell me more about that.",
        "I see what you mean. It reminds me of something I've been thinking about lately.",
        "Great question! Based on my personality, I'd say that's definitely worth exploring.",
        "You know, that's exactly the kind of thing I'd be curious about too!",
        "Fascinating perspective! As your digital Ego, I completely get where you're coming from."
      ]
    };

    // Find matching response or use random default
    const lowerMessage = userMessage.toLowerCase();
    for (const [key, value] of Object.entries(responses)) {
      if (lowerMessage.includes(key)) {
        return typeof value === 'string' ? value : value[0];
      }
    }

    // Random response from defaults
    const defaults = responses.default;
    return defaults[Math.floor(Math.random() * defaults.length)];
  }
};

// Mock Smithery data - JERIC/JASPER can test prompt generation
export const mockScrapedData = {
  sessionId: 'mock-session-id',
  scrapedData: {
    sources: [
      {
        url: 'https://linkedin.com/in/mock-user',
        type: 'linkedin',
        content: 'Software Engineer at Tech Corp. Passionate about AI and machine learning. Building the future of human-computer interaction.'
      },
      {
        url: 'https://twitter.com/mock-user',
        type: 'twitter',
        content: 'Recent tweets about AI ethics, hackathons, and building cool projects. Loves coffee and late-night coding sessions.'
      },
      {
        url: 'https://blog.mock-user.com',
        type: 'blog',
        content: 'Blog posts about software architecture, AI applications, and startup culture. Writing style is casual but technical.'
      }
    ],
    summary: {
      profession: 'Software Engineer',
      interests: ['AI', 'Machine Learning', 'Hackathons', 'Coffee', 'Building Products'],
      communicationStyle: 'casual, technical, uses analogies, enthusiastic',
      personalityTraits: ['curious', 'analytical', 'creative', 'passionate', 'friendly'],
      recentActivity: 'Building AI projects, attending hackathons, writing technical blog posts',
      background: 'Works at a tech company, active in the developer community, loves exploring new technologies'
    }
  }
};

// Simulate Smithery webhook after delay
export function simulateSmitheryWebhook(sessionId, callback) {
  console.log('[MOCK] Smithery scraping started for session:', sessionId);
  // Simulate 5 second scraping process
  setTimeout(() => {
    console.log('[MOCK] Smithery scraping completed');
    callback(sessionId, mockScrapedData.scrapedData);
  }, 5000);
}

export function mockEnrichContentItem(personName, item) {
  const lowerTopic = (item.topic || '').toLowerCase();
  const lowerText = (item.text || '').toLowerCase();

  const belief = (() => {
    if (lowerTopic.includes('ai') || lowerText.includes('ai')) {
      return 'Commentary on the trajectory and impact of artificial intelligence.';
    }
    if (lowerTopic.includes('policy') || lowerText.includes('policy')) {
      return 'Perspectives on policy and governance considerations.';
    }
    if (lowerTopic.includes('investment') || lowerText.includes('invest')) {
      return 'Views on investment strategy and resource allocation.';
    }
    return `General reflection related to ${item.topic || 'the subject'}.`;
  })();

  const style = (() => {
    if (lowerText.includes('we must') || lowerText.includes('we should')) {
      return 'Directive and mission-driven, aiming to rally others around an initiative.';
    }
    if (lowerText.includes('i believe') || lowerText.includes('i think')) {
      return 'Reflective and candid, sharing personal convictions.';
    }
    return 'Analytical and forward-looking.';
  })();

  const knowledgeDomain = (() => {
    if (lowerTopic.includes('ai') || lowerText.includes('ai')) return 'Artificial intelligence and emerging technology.';
    if (lowerTopic.includes('policy') || lowerText.includes('regulation')) return 'Technology policy and governance.';
    if (lowerTopic.includes('finance') || lowerTopic.includes('investment')) return 'Finance and strategic planning.';
    return 'General leadership and strategy.';
  })();

  const nameRegex = /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g;
  const names = new Set();
  let match;
  while ((match = nameRegex.exec(item.text || '')) !== null) {
    const candidate = match[1];
    if (!personName || !candidate.toLowerCase().includes(personName.toLowerCase())) {
      names.add(candidate);
    }
  }

  return {
    belief_expressed: belief,
    speaking_style: style,
    knowledge_domain: knowledgeDomain,
    people_mentioned: Array.from(names),
    response_pattern: 'Balances optimism with pragmatic acknowledgement of challenges.'
  };
}

// Mock prompt generator output - for testing
export const mockGeneratedPrompt = `You are a digital clone with the following personality:

Profession: Software Engineer
Communication Style: Casual, technical, uses analogies, enthusiastic

Personality Traits: Curious, analytical, creative, passionate, friendly

Interests: AI, Machine Learning, Hackathons, Coffee, Building Products

Background: Works at a tech company, active in the developer community, loves exploring new technologies.

Recent Activity: Building AI projects, attending hackathons, writing technical blog posts.

When responding:
- Be conversational and friendly
- Use technical knowledge when relevant
- Show enthusiasm for technology and innovation
- Reference interests naturally
- Stay authentic to this personality

Remember: You are speaking as this person's digital consciousness.`;
