/**
 * Scraping helper utilities
 * Provides common functions for web scraping
 */

/**
 * Generate a random user agent string to avoid detection
 * @returns {string} Random user agent string
 */
function randomUserAgent() {
  const userAgents = [
    // Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36',
    // Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0',
    // Edge on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36 Edg/92.0.902.84',
    // Chrome on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
    // Safari on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15',
    // Chrome on Linux
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36'
  ];
  
  const randomIndex = Math.floor(Math.random() * userAgents.length);
  return userAgents[randomIndex];
}

/**
 * Add a random delay between requests to avoid rate limiting
 * @param {number} minMs - Minimum delay in milliseconds
 * @param {number} maxMs - Maximum delay in milliseconds
 * @returns {Promise<void>} Promise that resolves after the delay
 */
function randomDelay(minMs = 1000, maxMs = 3000) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Extract text content from an HTML element using cheerio
 * @param {Object} $ - Cheerio instance
 * @param {Object} element - Cheerio element
 * @param {string} selector - CSS selector
 * @param {boolean} trim - Whether to trim the text
 * @returns {string} Extracted text or empty string if not found
 */
function extractText($, element, selector, trim = true) {
  try {
    const text = $(element).find(selector).text();
    return trim ? text.trim() : text;
  } catch (error) {
    return '';
  }
}

/**
 * Parse a number from a string, handling various formats
 * @param {string} text - Text to parse
 * @param {boolean} allowNegative - Whether to allow negative numbers
 * @returns {number|null} Parsed number or null if invalid
 */
function parseNumber(text, allowNegative = true) {
  if (!text || typeof text !== 'string') return null;
  
  // Remove all non-numeric characters except decimal point and minus sign
  const cleanText = text.replace(/[^0-9.-]/g, '');
  
  // Handle negative numbers if not allowed
  if (!allowNegative && cleanText.includes('-')) {
    return null;
  }
  
  const number = parseFloat(cleanText);
  return isNaN(number) ? null : number;
}

module.exports = {
  randomUserAgent,
  randomDelay,
  extractText,
  parseNumber
};
