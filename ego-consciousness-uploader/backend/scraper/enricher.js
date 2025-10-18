import { mockEnrichContentItem } from '../mock-data.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const USE_MOCK_ENRICHER = !OPENAI_API_KEY && !ANTHROPIC_API_KEY;

const ENABLE_ENRICHMENT = process.env.ENABLE_SCRAPER_ENRICHMENT !== 'false';

const OPENAI_MODEL = process.env.OPENAI_SCRAPER_MODEL || 'gpt-4o-mini';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_SCRAPER_MODEL || 'claude-3-5-sonnet-20241022';

const MAX_SNIPPET_LENGTH = parseInt(process.env.SCRAPER_ENRICH_MAX_CHARS || '1600', 10);

export async function enrichScrapedContent(personName, scrapedContent) {
  if (!ENABLE_ENRICHMENT) {
    return;
  }

  if (!Array.isArray(scrapedContent) || scrapedContent.length === 0) {
    return;
  }

  for (const source of scrapedContent) {
    if (!Array.isArray(source.content_items)) continue;

    for (const item of source.content_items) {
      try {
        const enrichment = await generateEnrichment(personName, item);
        if (enrichment) {
          Object.assign(item, normalizeEnrichment(enrichment));
        }
      } catch (error) {
        console.warn('[SCRAPER] Failed to enrich snippet:', error);
      }
    }
  }
}

async function generateEnrichment(personName, item) {
  if (!item || !item.text || item.text.trim().length === 0) {
    return null;
  }

  if (USE_MOCK_ENRICHER) {
    return mockEnrichContentItem(personName, item);
  }

  const prompt = buildPrompt(personName, item);

  if (OPENAI_API_KEY) {
    return callOpenAI(prompt);
  }

  if (ANTHROPIC_API_KEY) {
    return callAnthropic(prompt);
  }

  return mockEnrichContentItem(personName, item);
}

function buildPrompt(personName, item) {
  const snippet = (item.text || '').slice(0, MAX_SNIPPET_LENGTH);
  const safeDate = item.date || 'unknown';

  return `You are profiling public statements to build a realistic behavioral model of ${personName}.
Analyze the following excerpt and respond with a JSON object that captures the speaker's belief, tone, domains of knowledge, people they reference, and how they tend to reply.

Person: ${personName}
Context: ${item.context || 'unknown'}
Topic: ${item.topic || 'unknown'}
Sentiment: ${item.sentiment || 'unknown'}
Date: ${safeDate}

Statement:
"""
${snippet}
"""

Return JSON with exactly these keys:
- belief_expressed (string or null)
- speaking_style (string or null)
- knowledge_domain (string or null)
- people_mentioned (array of strings, may be empty)
- response_pattern (string or null)

Only emit JSON – no extra commentary.`;
}

function normalizeEnrichment(enrichment) {
  if (!enrichment || typeof enrichment !== 'object') {
    return {};
  }

  const {
    belief_expressed = null,
    speaking_style = null,
    knowledge_domain = null,
    people_mentioned = [],
    response_pattern = null,
  } = enrichment;

  return {
    belief_expressed: typeof belief_expressed === 'string' ? belief_expressed : null,
    speaking_style: typeof speaking_style === 'string' ? speaking_style : null,
    knowledge_domain: typeof knowledge_domain === 'string' ? knowledge_domain : null,
    people_mentioned: Array.isArray(people_mentioned)
      ? people_mentioned.filter((p) => typeof p === 'string' && p.trim().length > 0)
      : [],
    response_pattern: typeof response_pattern === 'string' ? response_pattern : null,
  };
}

async function callOpenAI(prompt) {
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You generate structured JSON profiles capturing beliefs and speaking style from short quotes. Always reply with JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response?.choices?.[0]?.message?.content;
    return parseJson(content);
  } catch (error) {
    console.warn('[SCRAPER] OpenAI enrichment failed:', error);
    throw error;
  }
}

async function callAnthropic(prompt) {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      temperature: 0.2,
      system: 'You generate structured JSON profiles capturing beliefs and speaking style from short quotes. Always reply with JSON only.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const text = (response?.content || [])
      .map((part) => ('text' in part ? part.text : ''))
      .join('');

    return parseJson(text);
  } catch (error) {
    console.warn('[SCRAPER] Anthropic enrichment failed:', error);
    throw error;
  }
}

function parseJson(value) {
  if (!value) {
    throw new Error('Empty response from LLM');
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    // Attempt to salvage JSON if wrapped in code fences
    const match = /\{[\s\S]*\}/.exec(value);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw error;
  }
}
