/**
 * Simple content extractor for basic metadata.
 * Performs lightweight parsing to stay fast without requiring an LLM call.
 */
export class ContentExtractor {
  constructor() {
    this.personName = null;
  }

  setPersonName(name) {
    this.personName = name;
  }

  /**
   * Extract basic content item from raw text.
   * @param {string} text
   * @param {string} url
   * @param {string=} publishedDate
   * @param {string=} title
   * @returns {import('./types.js').ContentItem}
   */
  extractContentItem(text, url, publishedDate, title) {
    const cleanedText = this.cleanText(text);
    const baseText = cleanedText.length > 0 ? cleanedText : text.trim();
    const finalText = cleanedText.length > 0 ? cleanedText : text.trim();

    return {
      text: finalText,
      context: this.determineContext(url),
      topic: title || this.extractTopic(baseText),
      sentiment: this.detectSentiment(baseText),
      date: publishedDate || null,
    };
  }

  determineContext(url) {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
      return 'tweet';
    } else if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      return 'video';
    } else if (urlLower.includes('linkedin.com')) {
      return 'LinkedIn post';
    } else if (urlLower.includes('medium.com')) {
      return 'Medium article';
    } else if (urlLower.includes('blog')) {
      return 'blog post';
    } else if (urlLower.includes('/articles/') || urlLower.includes('/posts/')) {
      return 'article';
    } else if (urlLower.includes('podcast')) {
      return 'podcast';
    } else if (urlLower.includes('interview')) {
      return 'interview';
    } else if (urlLower.includes('speech') || urlLower.includes('talk')) {
      return 'speech';
    }

    return 'web content';
  }

  extractTopic(text) {
    const firstSentence = text.split(/[.!?]/)[0]?.trim();

    if (firstSentence && firstSentence.length > 10 && firstSentence.length < 100) {
      return firstSentence;
    }

    return text.substring(0, 50).trim() + '...';
  }

  detectSentiment(text) {
    const textLower = text.toLowerCase();

    const positiveWords = [
      'great', 'amazing', 'excellent', 'love', 'excited', 'happy',
      'success', 'wonderful', 'fantastic', 'brilliant', 'optimistic',
      'promising', 'opportunity', 'growth', 'innovation'
    ];

    const negativeWords = [
      'bad', 'terrible', 'awful', 'hate', 'sad', 'disappointed',
      'failure', 'problem', 'issue', 'concern', 'worried', 'difficult',
      'challenge', 'risk', 'threat'
    ];

    const thoughtfulWords = [
      'consider', 'think', 'believe', 'perhaps', 'might', 'could',
      'reflect', 'analyze', 'question', 'wonder', 'explore'
    ];

    const positiveCount = positiveWords.filter((w) => textLower.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => textLower.includes(w)).length;
    const thoughtfulCount = thoughtfulWords.filter((w) => textLower.includes(w)).length;

    if (thoughtfulCount >= 2) {
      return 'thoughtful';
    } else if (positiveCount > negativeCount && positiveCount >= 2) {
      return 'positive';
    } else if (negativeCount > positiveCount && negativeCount >= 2) {
      return 'negative';
    }

    return 'neutral';
  }

  cleanText(raw) {
    const normalized = raw.replace(/\r\n/g, '\n');
    const withoutMarkdownLinks = normalized.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
    const withoutUrls = withoutMarkdownLinks.replace(/https?:\/\/\S+/g, '');
    const rawParagraphs = withoutUrls
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    const paragraphs = rawParagraphs
      .map((paragraph) => this.cleanParagraph(paragraph))
      .filter((paragraph) => paragraph.length > 0);

    const relevantParagraphs = this.selectRelevantParagraphs(paragraphs);
    const selected = (
      relevantParagraphs.length === 0
        ? paragraphs.slice(0, 3)
        : relevantParagraphs.slice(0, 3)
    )
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    const combined = selected.join('\n\n').trim();

    if (combined.length > 1200) {
      return combined.slice(0, 1200).trimEnd() + '…';
    }

    return combined;
  }

  isContentLine(line) {
    if (!line) {
      return false;
    }

    const lower = line.toLowerCase();
    const navKeywords = [
      'sign in',
      'sign up',
      'subscribe',
      'menu',
      'search',
      'sitemap',
      'navigation',
      'share',
      'follow',
      'newsletter',
      'advertisement',
      'copyright',
      'terms of service',
      'privacy policy',
      'skip to content',
      'top stories',
      'more stories',
      'related topics',
      'log in',
      'trending',
      'weather',
      'breaking news',
    ];

    if (navKeywords.some((keyword) => lower.includes(keyword))) {
      return false;
    }

    if (/^[\-\*\|\[\]#]+$/.test(line)) {
      return false;
    }

    if (line.length <= 4 && !/[A-Za-z]/.test(line)) {
      return false;
    }

    const wordCount = line.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 2 && !/["“”'`]/.test(line)) {
      return false;
    }

    if (!/[a-z]/.test(lower) && wordCount <= 3) {
      return false;
    }

    return true;
  }

  cleanParagraph(paragraph) {
    const lines = paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => this.isContentLine(line));

    return lines.join(' ').replace(/\s{2,}/g, ' ').trim();
  }

  selectRelevantParagraphs(paragraphs) {
    const name = this.personName;
    const nameParts = name ? name.toLowerCase().split(/\s+/).filter(Boolean) : [];

    const hasName = (paragraph) => {
      if (!name) {
        return /altman/i.test(paragraph);
      }

      const lower = paragraph.toLowerCase();
      if (lower.includes(name.toLowerCase())) {
        return true;
      }

      return nameParts.some((part) => part.length > 3 && lower.includes(part));
    };

    const relevant = paragraphs.filter((paragraph) => hasName(paragraph));

    if (relevant.length === 0) {
      const quoteParas = paragraphs.filter((paragraph) => /["“”‘’'`]/.test(paragraph));
      return quoteParas;
    }

    return relevant;
  }
}
