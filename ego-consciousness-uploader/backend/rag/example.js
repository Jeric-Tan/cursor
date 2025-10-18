import { initRAG, quickQuery } from './index.js';

/**
 * Example 1: Quick query (one-off)
 */
async function exampleQuickQuery() {
  console.log('=== Quick Query Example ===');

  const result = await quickQuery(
    'mock-session-1760779568852',
    'What are the main interests and expertise of this person?'
  );

  console.log('Answer:', result.answer);
  console.log('\nTop sources:');
  result.sources.slice(0, 3).forEach((source, i) => {
    console.log(`\n[${i + 1}] (score: ${source.score.toFixed(3)})`);
    console.log('Text:', source.text.substring(0, 100) + '...');
    console.log('URL:', source.metadata.url);
  });
}

/**
 * Example 2: Initialize once, query multiple times
 */
async function exampleMultipleQueries() {
  console.log('\n\n=== Multiple Queries Example ===');

  const rag = await initRAG('mock-session-1760779568852');

  const questions = [
    'What companies has this person worked with?',
    'What are their technical skills?',
    'Tell me about their entrepreneurial activities',
  ];

  for (const question of questions) {
    console.log(`\nQ: ${question}`);
    const result = await rag.query(question, { topK: 3 });
    console.log(`A: ${result.answer}\n`);
  }
}

/**
 * Example 3: Custom system prompt
 */
async function exampleCustomPrompt() {
  console.log('\n\n=== Custom Prompt Example ===');

  const result = await quickQuery(
    'mock-session-1760779568852',
    'Summarize this person in 3 bullet points',
    {
      systemPrompt: 'You are a professional career advisor. Provide concise, actionable insights.',
      topK: 10,
    }
  );

  console.log('Answer:', result.answer);
}

// Run examples
async function main() {
  try {
    await exampleQuickQuery();
    await exampleMultipleQueries();
    await exampleCustomPrompt();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
