import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { embed } from './embeddings.js';
import { VectorStore, storePathForSession } from './vector-store.js';
import { ragQuery } from './query.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCRAPED_ROOT = join(__dirname, '..', '..', 'data', 'scraped');

/**
 * Load and index scraped session data into vector store
 * @param {string} sessionId - Session ID to load
 * @param {VectorStore} vectorStore - Vector store instance
 * @returns {Promise<Object>} - Indexing stats
 */
export async function indexSession(sessionId, vectorStore) {
  const filePath = join(SCRAPED_ROOT, `${sessionId}.json`);
  const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

  let indexed = 0;

  // Index each content item
  for (const source of data.scrapedData.scraped_content) {
    for (const item of source.content_items) {
      // Create a rich text representation
      const text = item.text;
      const metadata = {
        url: source.url,
        topic: item.topic,
        sentiment: item.sentiment,
        date: item.date,
        context: item.context,
        knowledge_domain: item.knowledge_domain,
        people_mentioned: item.people_mentioned,
      };

      // Generate embedding
      const embedding = await embed(text);

      // Add to vector store
      vectorStore.add({
        text,
        metadata,
        embedding,
      });

      indexed++;
    }
  }

  return {
    indexed,
    sessionId: data.sessionId,
    masterPrompt: data.masterPrompt,
  };
}

/**
 * Initialize RAG pipeline for a session
 * @param {string} sessionId - Session ID to initialize
 * @returns {Promise<Object>} - RAG pipeline interface
 */
export async function initRAG(sessionId) {
  // Use a per-session vector store file
  const pathForSession = storePathForSession(sessionId);
  const vectorStore = new VectorStore(pathForSession);

  // Try to load existing vector store
  await vectorStore.load();

  // If empty, index the session
  if (vectorStore.size() === 0) {
    console.log('Indexing session data...');
    const stats = await indexSession(sessionId, vectorStore);
    console.log(`Indexed ${stats.indexed} documents`);

    // Save vector store
    await vectorStore.save();
    console.log('Vector store saved');
  } else {
    console.log(`Loaded ${vectorStore.size()} documents from cache`);
  }

  // Load session for master prompt
  const filePath = join(SCRAPED_ROOT, `${sessionId}.json`);
  const sessionData = JSON.parse(await fs.readFile(filePath, 'utf-8'));

  return {
    query: async (question, options = {}) => {
      return ragQuery(question, vectorStore, {
        ...options,
        systemPrompt: options.systemPrompt || sessionData.masterPrompt,
      });
    },
    vectorStore,
    sessionData,
  };
}

/**
 * Simple RAG query without initialization (for one-off queries)
 * @param {string} sessionId - Session ID
 * @param {string} question - Question to ask
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Answer and sources
 */
export async function quickQuery(sessionId, question, options = {}) {
  const rag = await initRAG(sessionId);
  return rag.query(question, options);
}

export { VectorStore } from './vector-store.js';
export { embed, cosineSimilarity } from './embeddings.js';
export { ragQuery, generateAnswer } from './query.js';
