/**
 * @typedef {Object} ContentItem
 * @property {string} text
 * @property {string} context
 * @property {string} topic
 * @property {string} sentiment
 * @property {string|null} date
 */

/**
 * @typedef {Object} ScrapedSource
 * @property {string} url
 * @property {string} scraped_at
 * @property {ContentItem[]} content_items
 */

/**
 * @typedef {Object} ConsciousnessData
 * @property {string} person_name
 * @property {string} created_at
 * @property {number} sources_attempted
 * @property {number} sources_successful
 * @property {number} total_content_items
 * @property {ScrapedSource[]} scraped_content
 */

/**
 * @typedef {Object} ScrapeOptions
 * @property {string} name
 * @property {string[]=} sources
 * @property {number=} limit
 */

/**
 * @typedef {Object} ExaSearchResult
 * @property {string} url
 * @property {string=} title
 * @property {string=} text
 * @property {string=} publishedDate
 * @property {string=} author
 * @property {number=} score
 */

export {};
