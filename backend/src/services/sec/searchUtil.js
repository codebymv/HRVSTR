/**
 * SEC EDGAR Full-Text Search API utilities
 * Provides functions for searching SEC filings using the EDGAR Full-Text Search API
 */
const axios = require('axios');
const { secRateLimiter } = require('./utils/rateLimiter');
const cacheUtils = require('../../utils/cache');

/**
 * Search SEC filings using the EDGAR Full-Text Search API
 * 
 * @param {string} query - The search query to submit
 * @param {Object} options - Search options
 * @param {string} [options.category='form-4'] - Filing category to search
 * @param {number} [options.size=10] - Number of results to return
 * @param {number} [options.from=0] - Offset for pagination
 * @returns {Promise<Object>} - The search results
 */
async function searchSecFilings(query, options = {}) {
  // Set default options
  const { 
    category = 'form-4', 
    size = 10,
    from = 0,
    cacheTtl = 24 * 60 * 60 * 1000 // Cache for 1 day by default
  } = options;

  // Generate cache key
  const cacheKey = `sec-search-${query}-${category}-${size}-${from}`.replace(/[^a-zA-Z0-9-]/g, '_');
  
  // Check cache first
  if (cacheUtils.hasCachedItem('sec-search', cacheKey)) {
    console.log(`[searchUtil] Using cached search results for query: ${query}`);
    return cacheUtils.getCachedItem('sec-search', cacheKey);
  }
  
  // Build search parameters
  const searchParams = new URLSearchParams({
    q: query,
    category: category,
    from: from,
    size: size
  });
  
  console.log(`[searchUtil] Searching SEC filings with query: ${query}`);
  
  try {
    // Make rate-limited request to SEC EDGAR Full-Text Search API
    const response = await secRateLimiter.scheduleRequest(async () => {
      return axios.get(
        `https://efts.sec.gov/LATEST/search-index?${searchParams}`,
        { 
          headers: { 
            'User-Agent': 'HRVSTR Financial Analysis Platform (educational purposes) contact@example.com',
            'Accept': 'application/json',
            'Host': 'efts.sec.gov'
          },
          timeout: 30000, // Increase timeout to 30 seconds
          validateStatus: function (status) {
            return status < 500; // Accept anything less than 500 as valid
          }
        }
      );
    });
    
    // Handle rate limiting response
    if (response.status === 429) {
      console.warn(`[searchUtil] Rate limited for query "${query}". Returning empty results.`);
      const emptyResults = {
        took: 0,
        timed_out: false,
        hits: {
          total: {
            value: 0,
            relation: "eq"
          },
          max_score: 0,
          hits: []
        },
        error: 'SEC API rate limited - please try again later'
      };
      return emptyResults;
    }
    
    // Cache successful results
    cacheUtils.setCachedItem('sec-search', cacheKey, response.data, cacheTtl);
    
    return response.data;
  } catch (error) {
    const isRateLimit = error.response?.status === 429;
    const isServerError = error.response?.status >= 500;
    
    if (isRateLimit) {
      console.warn(`[searchUtil] Rate limited for query "${query}". Using fallback data.`);
    } else if (isServerError) {
      console.warn(`[searchUtil] Server error (${error.response?.status}) for query "${query}". Using fallback data.`);
    } else {
      console.error(`[searchUtil] SEC search error for query "${query}":`, error.message);
    }
  
    // Return empty results instead of mock data
    console.log(`[searchUtil] SEC API unavailable - returning empty results`);
    const emptyResults = {
      took: 0,
      timed_out: false,
      hits: {
        total: {
          value: 0,
          relation: "eq"
        },
        max_score: 0,
        hits: []
      },
      error: 'SEC data temporarily unavailable'
    };

    return emptyResults;
  }
}

// Mock data generation function removed - no fallback data allowed

module.exports = {
  searchSecFilings
};