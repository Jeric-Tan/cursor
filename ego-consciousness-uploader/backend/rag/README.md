# Lightweight RAG Pipeline

A minimal, dependency-light RAG (Retrieval-Augmented Generation) system for querying scraped session data.

## Features

- Zero external dependencies except OpenAI
- In-memory vector store with disk persistence
- Cosine similarity search
- Simple and intuitive API
- Fast indexing and retrieval

## Architecture

```
rag/
├── embeddings.js      # Embedding generation and similarity
├── vector-store.js    # In-memory vector storage
├── query.js           # RAG query and answer generation
├── index.js           # Main orchestrator
└── example.js         # Usage examples
```

## Quick Start

```javascript
import { quickQuery } from './rag/index.js';

// One-off query
const result = await quickQuery(
  'mock-session-1760779568852',
  'What are the main interests of this person?'
);

console.log(result.answer);
console.log(result.sources); // Retrieved documents with scores
```

## Advanced Usage

### Initialize once, query multiple times

```javascript
import { initRAG } from './rag/index.js';

const rag = await initRAG('mock-session-1760779568852');

// Query multiple times
const result1 = await rag.query('What companies did they work with?');
const result2 = await rag.query('What are their skills?');
```

### Custom options

```javascript
const result = await rag.query('Your question', {
  topK: 10,              // Number of documents to retrieve
  systemPrompt: '...',   // Custom system prompt for LLM
});
```

## How It Works

1. **Indexing**: Scraped content is embedded using OpenAI's `text-embedding-3-small` model
2. **Storage**: Embeddings are stored in-memory with JSON persistence per session at `data/vector-stores/<sessionId>.json`
3. **Retrieval**: Questions are embedded and matched against stored vectors using cosine similarity
4. **Generation**: Top-K documents are passed to GPT-4o-mini as context to generate answers

## API Reference

### `quickQuery(sessionId, question, options)`

Quick one-off query without managing initialization.

- `sessionId`: Session ID to query
- `question`: Question to ask
- `options`: Query options (topK, systemPrompt)

### `initRAG(sessionId)`

Initialize RAG pipeline for a session. Returns an object with:

- `query(question, options)`: Query function
- `vectorStore`: Vector store instance
- `sessionData`: Original session data

### `indexSession(sessionId, vectorStore)`

Manually index a session into a vector store.

## Performance

- First run: Indexes all documents (embeddings API calls)
- Subsequent runs: Loads from cache (instant)
- Query time: ~1-2 seconds (embedding + search + generation)

## Dependencies

- `openai`: For embeddings and chat completions
- Node.js built-ins: `fs`, `path`

## Environment Variables

```bash
OPENAI_API_KEY=your-api-key-here
```
