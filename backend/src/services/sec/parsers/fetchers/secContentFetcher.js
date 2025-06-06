/**
 * SEC Content Fetcher - Handles HTTP requests to SEC EDGAR with compliance and rate limiting
 */

const axios = require('axios');

// SEC rate limiting - maximum 6.6 requests per second to stay under 10/second limit
const RATE_LIMIT_DELAY = 150; // 150ms delay between requests

/**
 * Fetch filing content from SEC EDGAR with rate limiting and compliance
 * @param {string} url - Filing URL (typically an index page)
 * @returns {Promise<string>} - Filing content
 */
async function fetchFilingContent(url) {
  try {
    console.log(`[secContentFetcher] Fetching filing content from: ${url}`);
    
    // Add delay to respect SEC rate limits
    await rateLimitDelay();
    
    // Step 1: Fetch the index page first to find the actual Form 4 document
    const indexContent = await fetchIndexPage(url);
    
    // Step 2: Look for the actual Form 4 XML or HTML document link
    const documentLink = findForm4DocumentLink(indexContent, url);
    
    if (documentLink) {
      console.log(`[secContentFetcher] Found Form 4 document link: ${documentLink}`);
      
      // Add another rate limit delay before fetching the actual document
      await rateLimitDelay();
      
      return await fetchDocumentContent(documentLink);
    } else {
      console.log(`[secContentFetcher] No specific Form 4 document found, using index content`);
      return indexContent;
    }
    
  } catch (error) {
    console.error(`[secContentFetcher] Error fetching filing content: ${error.message}`);
    return `Error fetching content: ${error.message}`;
  }
}

/**
 * Add rate limiting delay to respect SEC guidelines
 * @returns {Promise<void>}
 */
async function rateLimitDelay() {
  return new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
}

/**
 * Fetch the initial index page
 * @param {string} url - Index page URL
 * @returns {Promise<string>} - Index page content
 */
async function fetchIndexPage(url) {
  try {
    const response = await axios.get(url, {
      headers: getSecCompliantHeaders(),
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024, // 50MB limit
      maxBodyLength: 50 * 1024 * 1024
    });
    
    console.log(`[secContentFetcher] Successfully fetched index page, size: ${response.data?.length || 0} chars`);
    return response.data || '';
    
  } catch (error) {
    console.error(`[secContentFetcher] Error fetching index page: ${error.message}`);
    
    // Try with different headers or simplified request
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      console.log(`[secContentFetcher] Retrying with simplified request...`);
      return await fetchWithRetry(url, 1);
    }
    
    throw error;
  }
}

/**
 * Find the actual Form 4 document link from index page
 * @param {string} indexContent - Index page HTML content
 * @param {string} baseUrl - Base URL for resolving relative links
 * @returns {string|null} - Document URL or null
 */
function findForm4DocumentLink(indexContent, baseUrl) {
  try {
    // Look for common Form 4 document patterns
    const form4Patterns = [
      // Direct XML form 4 links
      /href="([^"]*(?:form|doc)(?:4|four)[^"]*\.xml?)"/gi,
      
      // HTML form 4 documents
      /href="([^"]*(?:form|doc)(?:4|four)[^"]*\.html?)"/gi,
      
      // Generic document links that might be Form 4
      /href="([^"]*(?:doc|document)[^"]*(?:4|four)[^"]*)"/gi,
      
      // Primary document links (often the main filing)
      /href="([^"]*primary[^"]*document[^"]*)"/gi,
      
      // Filing detail links
      /href="([^"]*filing[^"]*detail[^"]*)"/gi
    ];
    
    for (const pattern of form4Patterns) {
      const matches = [...indexContent.matchAll(pattern)];
      
      for (const match of matches) {
        if (match[1]) {
          let documentUrl = match[1];
          
          // Convert relative URLs to absolute
          documentUrl = resolveUrl(documentUrl, baseUrl);
          
          // Validate the URL looks like a reasonable document link
          if (isValidDocumentUrl(documentUrl)) {
            console.log(`[secContentFetcher] Found potential Form 4 document: ${documentUrl}`);
            return documentUrl;
          }
        }
      }
    }
    
    // If no specific document found, look for any .xml or .html files
    const genericPatterns = [
      /href="([^"]*\.xml)"/gi,
      /href="([^"]*\.html?)"/gi
    ];
    
    for (const pattern of genericPatterns) {
      const matches = [...indexContent.matchAll(pattern)];
      
      for (const match of matches) {
        if (match[1]) {
          let documentUrl = match[1];
          documentUrl = resolveUrl(documentUrl, baseUrl);
          
          if (isValidDocumentUrl(documentUrl)) {
            console.log(`[secContentFetcher] Found generic document: ${documentUrl}`);
            return documentUrl;
          }
        }
      }
    }
    
    return null;
    
  } catch (error) {
    console.error(`[secContentFetcher] Error finding document link: ${error.message}`);
    return null;
  }
}

/**
 * Fetch the actual document content
 * @param {string} documentUrl - Document URL
 * @returns {Promise<string>} - Document content
 */
async function fetchDocumentContent(documentUrl) {
  try {
    const response = await axios.get(documentUrl, {
      headers: getSecCompliantHeaders(),
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024, // 10MB limit for documents
      maxBodyLength: 10 * 1024 * 1024
    });
    
    const content = response.data || '';
    console.log(`[secContentFetcher] Successfully fetched document content, size: ${content.length} chars`);
    
    // Basic validation that we got actual content
    if (content.length < 100) {
      console.warn(`[secContentFetcher] Document content seems too short (${content.length} chars), might be an error page`);
    }
    
    return content;
    
  } catch (error) {
    console.error(`[secContentFetcher] Error fetching document content: ${error.message}`);
    
    // Try with retry for network issues
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      console.log(`[secContentFetcher] Retrying document fetch...`);
      return await fetchWithRetry(documentUrl, 1);
    }
    
    throw error;
  }
}

/**
 * Get SEC-compliant headers
 * @returns {Object} - Headers object
 */
function getSecCompliantHeaders() {
  return {
    'User-Agent': 'HRVSTR Financial Analysis Platform (educational purposes) contact@example.com',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };
}

/**
 * Resolve relative URL to absolute URL
 * @param {string} url - Potentially relative URL
 * @param {string} baseUrl - Base URL for resolution
 * @returns {string} - Absolute URL
 */
function resolveUrl(url, baseUrl) {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url; // Already absolute
    }
    
    if (url.startsWith('/')) {
      // Relative to domain root
      const baseParsed = new URL(baseUrl);
      return `${baseParsed.protocol}//${baseParsed.host}${url}`;
    }
    
    // Relative to current path
    const baseParsed = new URL(baseUrl);
    const basePath = baseParsed.pathname.endsWith('/') ? baseParsed.pathname : baseParsed.pathname + '/';
    return `${baseParsed.protocol}//${baseParsed.host}${basePath}${url}`;
    
  } catch (error) {
    console.error(`[secContentFetcher] Error resolving URL: ${error.message}`);
    return url; // Return as-is if resolution fails
  }
}

/**
 * Validate if a URL looks like a reasonable document URL
 * @param {string} url - URL to validate
 * @returns {boolean} - True if URL seems valid
 */
function isValidDocumentUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // Must be HTTP/HTTPS
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }
  
  // Should be from SEC domain
  if (!url.includes('sec.gov')) {
    return false;
  }
  
  // Should not be obvious non-document URLs
  const invalidPatterns = [
    /\/search\//,
    /\/browse\//,
    /\/login/,
    /\/logout/,
    /\.css$/,
    /\.js$/,
    /\.png$/,
    /\.jpg$/,
    /\.gif$/
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(url)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Retry fetch with exponential backoff
 * @param {string} url - URL to fetch
 * @param {number} attempt - Current attempt number
 * @param {number} maxAttempts - Maximum number of attempts
 * @returns {Promise<string>} - Content
 */
async function fetchWithRetry(url, attempt = 1, maxAttempts = 3) {
  try {
    // Exponential backoff delay
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
    if (attempt > 1) {
      console.log(`[secContentFetcher] Waiting ${delay}ms before retry attempt ${attempt}...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    const response = await axios.get(url, {
      headers: getSecCompliantHeaders(),
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024
    });
    
    return response.data || '';
    
  } catch (error) {
    console.error(`[secContentFetcher] Retry attempt ${attempt} failed: ${error.message}`);
    
    if (attempt >= maxAttempts) {
      throw new Error(`Failed to fetch after ${maxAttempts} attempts: ${error.message}`);
    }
    
    return await fetchWithRetry(url, attempt + 1, maxAttempts);
  }
}

/**
 * Batch fetch multiple URLs with rate limiting
 * @param {Array<string>} urls - Array of URLs to fetch
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Promise<Array<Object>>} - Array of results with url and content
 */
async function batchFetchContent(urls, progressCallback = null) {
  const results = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    
    try {
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: urls.length,
          url: url
        });
      }
      
      const content = await fetchFilingContent(url);
      results.push({
        url,
        content,
        success: true,
        error: null
      });
      
    } catch (error) {
      console.error(`[secContentFetcher] Failed to fetch ${url}: ${error.message}`);
      results.push({
        url,
        content: '',
        success: false,
        error: error.message
      });
    }
    
    // Rate limit between requests
    if (i < urls.length - 1) {
      await rateLimitDelay();
    }
  }
  
  return results;
}

/**
 * Check if URL is accessible without fetching full content
 * @param {string} url - URL to check
 * @returns {Promise<boolean>} - True if accessible
 */
async function checkUrlAccessibility(url) {
  try {
    const response = await axios.head(url, {
      headers: getSecCompliantHeaders(),
      timeout: 10000
    });
    
    return response.status >= 200 && response.status < 400;
    
  } catch (error) {
    console.log(`[secContentFetcher] URL not accessible: ${url} - ${error.message}`);
    return false;
  }
}

module.exports = {
  fetchFilingContent,
  batchFetchContent,
  checkUrlAccessibility,
  rateLimitDelay
}; 