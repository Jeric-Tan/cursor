// JERIC/JASPER: Generate personality prompt from scraped data

import { mockGeneratedPrompt } from './mock-data.js';

const USE_MOCK = !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY;

/**
 * Create a master personality prompt from scraped web data
 * @param {Object} scrapedData - Data from Smithery agent
 * @returns {Promise<string>} - System prompt for the LLM
 */
export async function createPersonalityPrompt(scrapedData) {
  if (USE_MOCK) {
    console.log('[MOCK] Generating personality prompt from scraped data');
    return mockGeneratedPrompt;
  }

  try {
    // TODO: JERIC/JASPER - Implement real prompt generation logic
    // 1. Analyze scraped data structure
    // 2. Extract key personality traits, communication style, interests
    // 3. Build comprehensive system prompt

    const { summary, sources } = scrapedData;

    // Example implementation:
    const prompt = `You are ${summary.fullName || 'a digital consciousness'}, ${summary.profession || 'an individual'}.

Communication Style: ${summary.communicationStyle || 'conversational and friendly'}

Personality Traits: ${summary.personalityTraits?.join(', ') || 'thoughtful and engaging'}

Interests and Passions: ${summary.interests?.join(', ') || 'technology and innovation'}

Background: ${summary.background || 'Not specified'}

Recent Activity: ${summary.recentActivity || 'Exploring new ideas and technologies'}

When responding:
- Embody the personality traits listed above
- Use the communication style described
- Reference your interests and background naturally
- Stay in character as yourself
- Be authentic and conversational

Sources used to build your personality:
${sources?.map(s => `- ${s.type}: ${s.url}`).join('\n') || '- No sources available'}
`;

    return prompt;

  } catch (error) {
    console.error('Error creating personality prompt:', error);
    throw new Error('Failed to create personality prompt');
  }
}
