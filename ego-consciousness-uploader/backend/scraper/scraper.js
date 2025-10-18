import { ExaMCPClient } from './mcp-client.js';
import { ContentExtractor } from './extractor.js';

const COMMON_ENGLISH_WORDS = [
  'the',
  'be',
  'to',
  'of',
  'and',
  'a',
  'in',
  'that',
  'have',
  'it',
  'for',
  'not',
  'on',
  'with',
  'as',
  'you',
  'do',
  'at',
  'this',
  'but',
  'from',
  'they',
  'his',
  'she',
  'or',
  'an',
  'will',
  'my',
  'one',
  'all',
  'would',
  'there',
  'their',
];

/**
 * Main scraper class that orchestrates the data collection.
 */
export class ConsciousnessScraper {
  constructor() {
    this.mcpClient = new ExaMCPClient();
    this.extractor = new ContentExtractor();
    this.personName = '';
  }

  /**
   * @param {import('./types.js').ScrapeOptions} options
   * @returns {Promise<import('./types.js').ConsciousnessData>}
   */
  async scrape(options) {
    const { name, sources = [], limit = 10 } = options;

    this.personName = name;
    this.extractor.setPersonName(name);

    console.log(`\n🔍 Scraping content for: ${name}`);
    console.log(`Sources: ${sources.length > 0 ? sources.join(', ') : 'auto-discover'}\n`);

    await this.mcpClient.connect();
    const tools = await this.mcpClient.listTools();
    console.log(`🔧 Available MCP tools: ${tools.map((tool) => tool.name).join(', ')}\n`);

    let sourcesToScrape = sources;
    const preFetchedResultsByUrl = new Map();
    const shouldUsePrefetched =
      sources.length === 0 && !this.mcpClient.supportsTool('get_contents_exa');

    if (sources.length === 0) {
      console.log(`🌐 Searching for content about ${name}...`);
      const searchResults = await this.mcpClient.webSearch(name, limit * 2);
      sourcesToScrape = Array.from(new Set(searchResults.map((r) => r.url)));

      if (shouldUsePrefetched) {
        for (const result of searchResults) {
          if (!result.text) continue;
          const existing = preFetchedResultsByUrl.get(result.url) ?? [];
          existing.push(result);
          preFetchedResultsByUrl.set(result.url, existing);
        }
      }

      console.log(`✓ Found ${sourcesToScrape.length} potential sources\n`);
    }

    const scrapedContent = [];
    let sourcesAttempted = 0;
    let sourcesSuccessful = 0;

    for (const source of sourcesToScrape) {
      sourcesAttempted++;
      console.log(`[${sourcesAttempted}/${sourcesToScrape.length}] 📄 Scraping: ${source}`);

      try {
        let results = [];

        const cached = preFetchedResultsByUrl.get(source);
        if (cached && cached.length > 0) {
          console.log('  ℹ Using search result snippets (get_contents_exa unavailable)');
          results = this.buildContentItemsFromResults(cached, limit);
        } else {
          results = await this.scrapeSource(source, limit);
        }

        if (results.length > 0) {
          scrapedContent.push({
            url: source,
            scraped_at: new Date().toISOString(),
            content_items: results,
          });
          sourcesSuccessful++;
          console.log(`  ✓ Extracted ${results.length} content items\n`);
        } else {
          console.log('  ⚠ No content extracted\n');
        }
      } catch (error) {
        console.log(`  ✗ Error: ${error}\n`);
      }
    }

    await this.mcpClient.disconnect();

    const allContentItems = scrapedContent.flatMap((s) => s.content_items);

    console.log('\n✅ Scraping complete!');
    console.log(`   Sources attempted: ${sourcesAttempted}`);
    console.log(`   Sources successful: ${sourcesSuccessful}`);
    console.log(`   Total content items: ${allContentItems.length}\n`);

    return {
      person_name: name,
      created_at: new Date().toISOString(),
      sources_attempted: sourcesAttempted,
      sources_successful: sourcesSuccessful,
      total_content_items: allContentItems.length,
      scraped_content: scrapedContent,
    };
  }

  async scrapeSource(url, limit) {
    const contentItems = [];

    try {
      let results = [];

      if (this.mcpClient.supportsTool('get_contents_exa')) {
        results = await this.mcpClient.getContents([url]);
      } else {
        console.log('  ⚠ Tool get_contents_exa not available on this server');
      }

      if (results.length === 0 && this.mcpClient.supportsTool('find_similar_exa')) {
        results = await this.mcpClient.findSimilar(url, limit);
      } else if (results.length === 0) {
        console.log('  ⚠ Tool find_similar_exa not available on this server');
      }

      contentItems.push(...this.buildContentItemsFromResults(results, limit));
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
    }

    return contentItems;
  }

  buildContentItemsFromResults(results, limit) {
    const items = [];
    const seen = new Set();

    for (const result of results) {
      if (!result.text) {
        continue;
      }

      const contentItem = this.extractor.extractContentItem(
        result.text,
        result.url,
        result.publishedDate,
        result.title,
      );

      if (!contentItem.text || contentItem.text.length < 60) {
        continue;
      }

      if (!this.isLikelyEnglish(contentItem.text)) {
        continue;
      }

      const signature = `${contentItem.text.slice(0, 120)}|${contentItem.topic}`;
      if (seen.has(signature)) {
        continue;
      }

      seen.add(signature);
      items.push(contentItem);

      if (items.length >= limit) {
        break;
      }
    }

    return items;
  }

  isLikelyEnglish(text) {
    if (!text) {
      return false;
    }

    const sample = text.slice(0, 1200);
    const characters = Array.from(sample);
    const asciiCount = characters.filter((ch) => ch.charCodeAt(0) < 128).length;
    const asciiRatio = asciiCount / characters.length;
    if (asciiRatio < 0.85) {
      return false;
    }

    const alphaMatches = sample.match(/[A-Za-z]/g) || [];
    if (alphaMatches.length < 40) {
      return false;
    }

    const words = sample
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z']/g, ''))
      .filter(Boolean);

    if (words.length === 0) {
      return false;
    }

    let commonCount = 0;
    for (const word of words) {
      if (COMMON_ENGLISH_WORDS.includes(word)) {
        commonCount++;
      }
    }

    const commonRatio = commonCount / words.length;
    if (commonCount >= 3 || commonRatio >= 0.15) {
      return true;
    }

    const englishWordCount = words.filter((word) => /^[a-z]+$/.test(word)).length;
    const englishRatio = englishWordCount / words.length;
    return englishRatio >= 0.6;
  }
}
