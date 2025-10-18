import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { cosineSimilarity } from './embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STORE_PATH = join(__dirname, '..', '..', 'data', 'vector-store.json');

/**
 * Simple in-memory vector store with persistence
 */
export class VectorStore {
  constructor() {
    this.documents = [];
  }

  /**
   * Add a document with its embedding
   * @param {Object} doc - Document object with text, metadata, and embedding
   */
  add(doc) {
    this.documents.push({
      id: doc.id || `doc_${Date.now()}_${Math.random()}`,
      text: doc.text,
      metadata: doc.metadata || {},
      embedding: doc.embedding,
    });
  }

  /**
   * Search for similar documents
   * @param {number[]} queryEmbedding - Query vector
   * @param {number} topK - Number of results to return
   * @returns {Array} - Top K similar documents with scores
   */
  search(queryEmbedding, topK = 5) {
    const results = this.documents
      .map(doc => ({
        ...doc,
        score: cosineSimilarity(queryEmbedding, doc.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }

  /**
   * Save vector store to disk
   */
  async save() {
    await fs.mkdir(dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(this.documents, null, 2), 'utf-8');
  }

  /**
   * Load vector store from disk
   */
  async load() {
    try {
      const data = await fs.readFile(STORE_PATH, 'utf-8');
      this.documents = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.documents = [];
    }
  }

  /**
   * Clear all documents
   */
  clear() {
    this.documents = [];
  }

  /**
   * Get total document count
   */
  size() {
    return this.documents.length;
  }
}
