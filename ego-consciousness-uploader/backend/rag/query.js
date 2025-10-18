import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { embed } from './embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate an answer using RAG
 * @param {string} question - User's question
 * @param {Array} relevantDocs - Retrieved documents from vector store
 * @param {string} systemPrompt - System prompt for the LLM
 * @param {Array} conversationHistory - Previous conversation messages
 * @returns {Promise<string>} - Generated answer
 */
export async function generateAnswer(question, relevantDocs, systemPrompt = null, conversationHistory = []) {
  // Build context from relevant documents
  const context = relevantDocs
    .map((doc, i) => `[${i + 1}] ${doc.text}`)
    .join('\n\n');

  const messages = [
    {
      role: 'system',
      content: systemPrompt || 'You are a helpful assistant. Use the provided context to answer questions accurately.',
    },
  ];

  // Add conversation history (last 5 messages for context)
  const recentHistory = conversationHistory.slice(-5);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add current question with context
  messages.push({
    role: 'user',
    content: `Context from your background:\n${context}\n\nQuestion: ${question}\n\nAnswer naturally based on the context and our conversation:`,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

/**
 * Perform RAG query: embed question, search, and generate answer
 * @param {string} question - User's question
 * @param {VectorStore} vectorStore - Vector store instance
 * @param {Object} options - Options for retrieval and generation
 * @returns {Promise<Object>} - Answer and retrieved documents
 */
export async function ragQuery(question, vectorStore, options = {}) {
  const {
    topK = 5,
    systemPrompt = null,
    conversationHistory = [],
  } = options;

  // Embed the question
  const queryEmbedding = await embed(question);

  // Search for relevant documents
  const relevantDocs = vectorStore.search(queryEmbedding, topK);

  // Generate answer with conversation history
  const answer = await generateAnswer(question, relevantDocs, systemPrompt, conversationHistory);

  return {
    answer,
    sources: relevantDocs.map(doc => ({
      text: doc.text,
      metadata: doc.metadata,
      score: doc.score,
    })),
  };
}
