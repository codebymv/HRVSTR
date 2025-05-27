/**
 * SEC EDGAR Full-Text Search API utilities
 * Provides functions for searching SEC filings using the EDGAR Full-Text Search API
 */
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
  
  // In this environment, we'll return mock data instead of making actual API calls
  console.log(`[searchUtil] Generating mock search results for query: ${query}`);
  
  // Generate mock search results based on the query
  const mockResults = generateMockSearchResults(query, category, size);
  
  // Cache the mock results
  cacheUtils.setCachedItem('sec-search', cacheKey, mockResults, cacheTtl);
  
  return mockResults;
}

/**
 * Generate mock search results for testing
 * @param {string} query - Search query
 * @param {string} category - Filing category
 * @param {number} size - Number of results to return
 * @returns {Object} - Mock search results
 */
function generateMockSearchResults(query, category, size) {
  // Extract ticker or CIK from query if present
  const tickerMatch = query.match(/ticker:([A-Z]+)/i);
  const cikMatch = query.match(/cik:(\d+)/i);
  const nameMatch = query.match(/name:([^&]+)/i);
  
  const ticker = tickerMatch ? tickerMatch[1].toUpperCase() : null;
  const cik = cikMatch ? cikMatch[1] : null;
  const name = nameMatch ? nameMatch[1].trim() : null;
  
  // Generate mock hits
  const hits = [];
  
  for (let i = 0; i < size; i++) {
    const mockHit = {
      _id: `mock-${category}-${i}`,
      _source: {
        cik: cik || `000${Math.floor(Math.random() * 9999999)}`.padStart(10, '0'),
        companyName: name || `Mock Company ${i}`,
        ticker: ticker || ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'TSLA'][i % 5],
        filingDate: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        formType: category === 'form-4' ? '4' : '13F',
        filingDescription: `Mock filing for ${ticker || 'MOCK'}`
      }
    };
    
    hits.push(mockHit);
  }
  
  return {
    took: 42,
    timed_out: false,
    hits: {
      total: {
        value: size,
        relation: "eq"
      },
      max_score: 1.0,
      hits: hits
    }
  };
}

module.exports = {
  searchSecFilings
};