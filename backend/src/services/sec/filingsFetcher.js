const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const { secRateLimiter } = require('./utils/rateLimiter');

// Parsing helpers are kept in a separate module to maintain a clear separation of concerns
const {
  parseSecForm4Data,
  parseSecForm13FData
} = require('./filingsParser');

/**
 * Retry configuration for SEC API requests
 * Updated for free-tier compatibility with strict rate limiting
 */
const SEC_RETRY_CONFIG = {
  maxRetries: 5, // Increase max retries since we're being more patient
  baseDelay: 10000, // Start with 10 seconds (much more conservative)
  maxDelay: 120000, // Cap at 2 minutes for free tier
  backoffMultiplier: 2.0, // More gradual backoff
  rateLimitDelay: 30000 // Special delay for 429 errors - 30 seconds
};

// Enhanced caching strategy for free tier
const CACHE_CONFIG = {
  // Cache validity periods (in milliseconds)
  FREE_TIER_CACHE_DURATION: 30 * 60 * 1000, // 30 minutes for free tier
  PRO_TIER_CACHE_DURATION: 10 * 60 * 1000,  // 10 minutes for pro tier
  ERROR_CACHE_DURATION: 5 * 60 * 1000,      // 5 minutes for error responses
  
  // Maximum cache entries to prevent memory issues
  MAX_CACHE_ENTRIES: 100
};

// Simple in-memory cache
const apiCache = new Map();
const cacheTimestamps = new Map();

/**
 * Get cache key for request
 */
function getCacheKey(url, params = {}) {
  const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return `${url}?${sortedParams}`;
}

/**
 * Check if cache entry is valid
 */
function isCacheValid(key, maxAge = CACHE_CONFIG.FREE_TIER_CACHE_DURATION) {
  const timestamp = cacheTimestamps.get(key);
  if (!timestamp) return false;
  
  return (Date.now() - timestamp) < maxAge;
}

/**
 * Get from cache if valid
 */
function getFromCache(key, maxAge) {
  if (isCacheValid(key, maxAge) && apiCache.has(key)) {
    console.log(`[filingsFetcher] 📋 Cache HIT for ${key}`);
    return apiCache.get(key);
  }
  return null;
}

/**
 * Store in cache
 */
function storeInCache(key, data, isError = false) {
  // Limit cache size
  if (apiCache.size >= CACHE_CONFIG.MAX_CACHE_ENTRIES) {
    // Remove oldest entries
    const oldestKeys = Array.from(cacheTimestamps.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, 10)
      .map(entry => entry[0]);
    
    oldestKeys.forEach(oldKey => {
      apiCache.delete(oldKey);
      cacheTimestamps.delete(oldKey);
    });
  }
  
  apiCache.set(key, data);
  cacheTimestamps.set(key, Date.now());
  
  const cacheType = isError ? 'ERROR' : 'SUCCESS';
  console.log(`[filingsFetcher] 💾 Cache ${cacheType} stored for ${key}`);
}

/**
 * Clear stale cache entries to prevent old data issues
 */
function clearStaleCache() {
  const now = Date.now();
  const staleKeys = [];
  
  for (const [key, timestamp] of cacheTimestamps.entries()) {
    // Remove entries older than 2 hours to prevent stale data issues
    if (now - timestamp > 2 * 60 * 60 * 1000) {
      staleKeys.push(key);
    }
  }
  
  staleKeys.forEach(key => {
    apiCache.delete(key);
    cacheTimestamps.delete(key);
  });
  
  if (staleKeys.length > 0) {
    console.log(`[filingsFetcher] 🧹 Cleared ${staleKeys.length} stale cache entries`);
  }
}

/**
 * Make SEC API request with retry logic for rate limiting
 * @param {string} url - SEC API endpoint URL
 * @param {Object} options - Axios request options
 * @param {function} progressCallback - Progress callback function
 * @param {number} attempt - Current attempt number (for internal use)
 * @returns {Promise<Object>} - Axios response object
 */
async function secApiRequestWithRetry(url, options = {}, progressCallback = null, attempt = 1) {
  // Wrap the actual request in rate limiting
  const makeRequest = async () => {
    return secRateLimiter.scheduleRequest(async () => {
      console.log(`[filingsFetcher] SEC API Request attempt ${attempt}/${SEC_RETRY_CONFIG.maxRetries + 1}: ${url}`);
      
      const response = await axios.get(url, {
        ...options,
        headers: {
          'User-Agent': 'HRVSTR Financial Analysis Platform (educational purposes) contact@example.com',
          'Accept': 'application/atom+xml,application/xml,text/xml,*/*',
          'Accept-Encoding': 'gzip, deflate',
          ...options.headers
        },
        timeout: 30000 // Increase timeout to 30 seconds for better reliability
      });
      
      console.log(`[filingsFetcher] ✅ SEC API Request successful on attempt ${attempt}`);
      return response;
    });
  };

  try {
    return await makeRequest();
  } catch (error) {
    const isRateLimit = error.response?.status === 429;
    const isServerError = error.response?.status >= 500;
    const isNetworkError = !error.response && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT');
    
    // Check if we should retry
    const shouldRetry = (isRateLimit || isServerError || isNetworkError) && attempt <= SEC_RETRY_CONFIG.maxRetries;
    
    if (shouldRetry) {
      // Calculate delay with exponential backoff
      let delay = Math.min(
        SEC_RETRY_CONFIG.baseDelay * Math.pow(SEC_RETRY_CONFIG.backoffMultiplier, attempt - 1),
        SEC_RETRY_CONFIG.maxDelay
      );
      
      // Special handling for rate limits - use much longer delays
      if (isRateLimit) {
        delay = Math.max(delay, SEC_RETRY_CONFIG.rateLimitDelay * attempt); // Scale up rate limit delays
        
        // Respect Retry-After header if present
        if (error.response?.headers['retry-after']) {
          const retryAfter = parseInt(error.response.headers['retry-after']);
          if (!isNaN(retryAfter)) {
            delay = Math.max(delay, retryAfter * 1000); // Convert to milliseconds
          }
        }
      } else {
        // Add jitter to prevent thundering herd for non-rate-limit errors
        delay = delay + (Math.random() * 2000);
      }
      
      const errorType = isRateLimit ? 'Rate Limit (429)' : 
                       isServerError ? `Server Error (${error.response?.status})` : 
                       'Network Error';
      
      const delaySeconds = Math.round(delay / 1000);
      console.warn(`[filingsFetcher] ⚠️ ${errorType} on attempt ${attempt}. Retrying in ${delaySeconds}s... (Free tier: longer delays required)`);
      
      // Emit progress update for rate limiting with better messaging
      if (progressCallback) {
        const stageMessage = isRateLimit 
          ? `Rate Limit (429) - SEC servers busy. Waiting ${delaySeconds}s... (${attempt}/${SEC_RETRY_CONFIG.maxRetries})`
          : `${errorType} encountered. Retrying in ${delaySeconds}s... (${attempt}/${SEC_RETRY_CONFIG.maxRetries})`;
          
        progressCallback({
          stage: stageMessage,
          progress: Math.round((attempt / (SEC_RETRY_CONFIG.maxRetries + 1)) * 20), // Use 20% of progress for retries
          total: 100,
          current: 0,
          isRateLimit: isRateLimit,
          userMessage: isRateLimit 
            ? 'SEC servers are very busy. Please be patient - this is normal for free API access.'
            : 'Retrying request due to temporary issue...'
        });
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Recursive retry
      return secApiRequestWithRetry(url, options, progressCallback, attempt + 1);
    }
    
    // If we've exhausted retries or it's a non-retryable error
    const errorMessage = isRateLimit 
      ? 'SEC API rate limit exceeded. Please try again later or reduce request frequency.'
      : isServerError 
        ? `SEC API server error (${error.response?.status}). Please try again later.`
        : isNetworkError
          ? 'Network error connecting to SEC API. Please check your connection.'
          : `SEC API request failed: ${error.message}`;
    
    console.error(`[filingsFetcher] ❌ SEC API Request failed after ${attempt} attempts: ${errorMessage}`);
    
    // Emit error progress
    if (progressCallback) {
      progressCallback({
        stage: 'Error fetching SEC data',
        progress: 0,
        total: 0,
        current: 0,
        error: errorMessage
      });
    }
    
    // Re-throw with enhanced error message
    const enhancedError = new Error(errorMessage);
    enhancedError.isRateLimit = isRateLimit;
    enhancedError.isServerError = isServerError;
    enhancedError.isNetworkError = isNetworkError;
    enhancedError.originalError = error;
    enhancedError.attemptsMade = attempt;
    throw enhancedError;
  }
}

/**
 * Fetch SEC Form 4 (insider trade) data from the SEC EDGAR RSS feed and parse it.
 *
 * @param {string} [timeRange] - Time-range filter ('1w', '1m', '3m', '6m')
 * @param {number} [limit=100]  - Maximum number of entries to fetch from the feed
 * @param {function} [progressCallback] - Optional callback function for progress updates
 * @param {boolean} [isFreeTier=true] - Whether user is on free tier (affects caching)
 * @returns {Promise<Array>} Parsed insider-trade objects
 */
async function fetchInsiderTrades(timeRange = '1m', limit = 100, progressCallback = null, isFreeTier = true) {
  try {
    console.log(`\n🔍 FLOW TRACE - fetchInsiderTrades START`);
    console.log(`🔍 Input parameters:`, { timeRange, limit, isFreeTier });
    
    // Clear stale cache entries first to prevent old data issues
    clearStaleCache();
    
    // Calculate date range for SEC API filtering
    const endDate = new Date();
    const startDate = new Date();
    
    console.log(`🔍 Initial dates:`, { 
      endDate: endDate.toISOString(), 
      startDate: startDate.toISOString() 
    });
    
    // Calculate start date based on time range
    switch (timeRange) {
      case '1w':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '1m':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case '3m':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      default:
        startDate.setMonth(endDate.getMonth() - 1); // Default to 1 month
    }
    
    console.log(`🔍 After timeRange calculation:`, { 
      timeRange,
      startDate: startDate.toISOString(), 
      endDate: endDate.toISOString(),
      daysDifference: Math.round((endDate - startDate) / (1000 * 60 * 60 * 24))
    });
    
    // Format dates for SEC API (YYYYMMDD format)
    const formatDateForSEC = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };
    
    const startDateStr = formatDateForSEC(startDate);
    const endDateStr = formatDateForSEC(endDate);
    
    console.log(`🔍 Formatted dates for SEC API:`, { 
      startDateStr, 
      endDateStr 
    });
    
    // Check cache first (especially important for free tier)
    const cacheKey = getCacheKey(`sec_insider_trades_${timeRange}`, { timeRange, limit, startDateStr, endDateStr });
    const maxCacheAge = isFreeTier ? CACHE_CONFIG.FREE_TIER_CACHE_DURATION : CACHE_CONFIG.PRO_TIER_CACHE_DURATION;
    
    const cachedData = getFromCache(cacheKey, maxCacheAge);
    if (cachedData) {
      console.log(`🔍 CACHE HIT - Returning cached data for ${timeRange} (${cachedData.length} trades)`);
      if (progressCallback) {
        progressCallback({ 
          stage: `Loading cached insider trades (${timeRange})...`, 
          progress: 100, 
          total: cachedData.length, 
          current: cachedData.length 
        });
      }
      return cachedData;
    }
    
    // Build SEC EDGAR search URL for historical data instead of just RSS feed
    // The RSS feed only shows recent filings (1-3 days), but search gives us historical data
    let allInsiderTrades = [];
    
    // For longer time ranges, make multiple API calls to get more historical data
    if (timeRange === '1m' || timeRange === '3m' || timeRange === '6m') {
      console.log(`🔍 Fetching historical data for ${timeRange} using multi-day approach`);
      
      // Calculate how many days to fetch
      const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
      const daysPerBatch = 5; // Fetch 5 days at a time
      const batches = Math.min(Math.ceil(totalDays / daysPerBatch), 6); // Limit to 6 batches to avoid rate limits
      
      console.log(`🔍 Will fetch ${batches} batches covering ${totalDays} days`);
      
      // Make multiple API calls to get more historical data
      for (let batch = 0; batch < batches; batch++) {
        const batchEndDate = new Date(endDate);
        batchEndDate.setDate(batchEndDate.getDate() - (batch * daysPerBatch));
        
        const batchStartDate = new Date(batchEndDate);
        batchStartDate.setDate(batchStartDate.getDate() - daysPerBatch);
        
        // Don't go before our target start date
        if (batchStartDate < startDate) {
          batchStartDate.setTime(startDate.getTime());
        }
        
        const batchStartStr = formatDateForSEC(batchStartDate);
        const batchEndStr = formatDateForSEC(batchEndDate);
        
        const batchUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&count=${Math.min(100, limit)}&datea=${batchStartStr}&dateb=${batchEndStr}&output=atom`;
        
        console.log(`🔍 Batch ${batch + 1}/${batches}: ${batchStartStr} to ${batchEndStr}`);
        
        // Check cache first for this batch
        const batchCacheKey = getCacheKey(batchUrl, { timeRange: `batch_${batch}`, limit });
        const batchCachedData = getFromCache(batchCacheKey, isFreeTier ? CACHE_CONFIG.FREE_TIER_CACHE_DURATION : CACHE_CONFIG.PRO_TIER_CACHE_DURATION);
        
        if (batchCachedData) {
          console.log(`🔍 Batch ${batch + 1} - Using cached data (${batchCachedData.length} trades)`);
          allInsiderTrades.push(...batchCachedData);
        } else {
          try {
            // Add delay between requests to respect rate limits
            if (batch > 0) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
            }
            
            // Emit progress for this batch
            if (progressCallback) {
              progressCallback({ 
                stage: `Fetching historical data batch ${batch + 1}/${batches} (${batchStartDate.toDateString()})...`, 
                progress: 10 + (batch / batches * 60), 
                total: limit, 
                current: allInsiderTrades.length 
              });
            }
            
            console.log(`🔍 Making API request for batch ${batch + 1}: ${batchUrl}`);
            const batchResponse = await secApiRequestWithRetry(batchUrl, {}, progressCallback);
            
            // Parse this batch
            const batchTrades = await parseSecForm4Data(batchResponse.data, limit, null);
            console.log(`🔍 Batch ${batch + 1} returned ${batchTrades.length} trades`);
            
            // Cache this batch
            storeInCache(batchCacheKey, batchTrades, false);
            
            // Add to our collection
            allInsiderTrades.push(...batchTrades);
            
            // Stop if we've hit our limit
            if (allInsiderTrades.length >= limit) {
              console.log(`🔍 Reached limit of ${limit} trades, stopping batch fetching`);
              break;
            }
            
          } catch (error) {
            console.error(`🔍 Error fetching batch ${batch + 1}:`, error.message);
            // Continue with other batches even if one fails
            if (error.isRateLimit && batch > 0) {
              console.log(`🔍 Rate limited on batch ${batch + 1}, stopping to preserve remaining data`);
              break;
            }
          }
        }
      }
      
      // Remove duplicates and limit results with better deduplication logic
      const uniqueTrades = allInsiderTrades.filter((trade, index, self) => {
        // Create a more comprehensive unique identifier
        const createTradeId = (t) => {
          const dateStr = new Date(t.filingDate).toISOString().split('T')[0]; // YYYY-MM-DD
          const tickerClean = (t.ticker || '').trim().toUpperCase();
          const nameClean = (t.insiderName || '').trim().substring(0, 50); // First 50 chars
          const sharesStr = String(t.shares || 0);
          const valueStr = String(t.value || 0);
          
          return `${dateStr}_${tickerClean}_${nameClean}_${sharesStr}_${valueStr}`;
        };
        
        const currentTradeId = createTradeId(trade);
        
        return index === self.findIndex(t => {
          const compareTradeId = createTradeId(t);
          return compareTradeId === currentTradeId;
        });
      });
      
      console.log(`🔍 Multi-batch fetch complete: ${allInsiderTrades.length} total trades, ${uniqueTrades.length} unique trades`);
      
      // IMPORTANT FIX: Filter by actual time range after fetching to remove old data
      const now = new Date();
      const filteredTrades = uniqueTrades.filter(trade => {
        try {
          const tradeDate = new Date(trade.filingDate);
          const diffInDays = (now - tradeDate) / (1000 * 60 * 60 * 24);
          
          let maxDays;
          switch (timeRange) {
            case '1w': maxDays = 7; break;
            case '1m': maxDays = 30; break;
            case '3m': maxDays = 90; break;
            case '6m': maxDays = 180; break;
            default: maxDays = 30; break;
          }
          
          // Allow for some tolerance (e.g., 2 extra days) to account for timezone differences
          const isWithinRange = diffInDays <= (maxDays + 2) && diffInDays >= -1;
          
          if (!isWithinRange) {
            console.log(`🔍 FILTERING OUT trade outside ${timeRange} range: ${trade.ticker} from ${tradeDate.toDateString()} (${Math.round(diffInDays)} days ago)`);
          }
          
          return isWithinRange;
        } catch (error) {
          console.error('🔍 Error filtering trade by date:', error.message);
          return false; // Exclude trades with invalid dates
        }
      });
      
      console.log(`🔍 Date filtering: ${uniqueTrades.length} -> ${filteredTrades.length} trades within ${timeRange} range`);
      
      // Sort by filing date (most recent first)
      const sortedTrades = filteredTrades.sort((a, b) => {
        try {
          const dateA = new Date(a.filingDate);
          const dateB = new Date(b.filingDate);
          return dateB - dateA; // Descending order (newest first)
        } catch (error) {
          return 0;
        }
      });
      
      // Log final date range for debugging
      if (sortedTrades.length > 0) {
        const oldestTrade = sortedTrades[sortedTrades.length - 1];
        const newestTrade = sortedTrades[0];
        console.log(`🔍 Final date range: ${new Date(oldestTrade.filingDate).toDateString()} to ${new Date(newestTrade.filingDate).toDateString()}`);
        
        // Extract unique dates for debugging
        const uniqueDates = [...new Set(sortedTrades.map(t => new Date(t.filingDate).toISOString().split('T')[0]))].sort();
        console.log(`🔍 uniqueDatesInResponse: ${JSON.stringify(uniqueDates)}`);
      }
      
      // Store the filtered result in cache
      storeInCache(cacheKey, sortedTrades.slice(0, limit), false);
      
      if (progressCallback) {
        progressCallback({ 
          stage: `Historical data loaded (${sortedTrades.length} trades found)`, 
          progress: 100, 
          total: sortedTrades.length, 
          current: sortedTrades.length 
        });
      }
      
      console.log(`🔍 FLOW TRACE - Multi-batch fetch completed: ${sortedTrades.length} trades`);
      return sortedTrades.slice(0, limit);
      
    } else {
      // For 1 week, use single API call
      const secUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&count=${limit}&datea=${startDateStr}&dateb=${endDateStr}&output=atom`;
      console.log(`🔍 Using single API call for ${timeRange}: ${secUrl}`);
      
      console.log(`🔍 CACHE MISS - Making fresh API request for ${timeRange}`);
      console.log(`🔍 FLOW TRACE - About to make SEC API request...`);

      // Emit initial progress
      if (progressCallback) {
        progressCallback({ 
          stage: `Fetching SEC Form 4 data (${timeRange}: ${startDate.toDateString()} to ${endDate.toDateString()})...`, 
          progress: 5, 
          total: limit, 
          current: 0 
        });
      }

      // Make the API request with retry logic
      let response;
      let insiderTrades = [];
      
      try {
        response = await secApiRequestWithRetry(secUrl, {}, progressCallback);

        console.log(`🔍 SEC API Response received:`);
        console.log(`🔍 - Status: ${response.status}`);
        console.log(`🔍 - Data length: ${response.data?.length || 0} characters`);
        console.log(`🔍 - Content-Type: ${response.headers['content-type']}`);

        // Emit progress after successful fetch
        if (progressCallback) {
          progressCallback({ 
            stage: 'SEC data received, starting XML parsing...', 
            progress: 20, 
            total: limit, 
            current: 0 
          });
        }

        console.log(`🔍 FLOW TRACE - About to parse XML data...`);

        // Parse the XML data using the form4Parser with progress callback
        insiderTrades = await parseSecForm4Data(response.data, limit, progressCallback);
        
        console.log(`🔍 FLOW TRACE - XML parsing completed:`);
        console.log(`🔍 - Number of trades parsed: ${insiderTrades?.length || 0}`);
        
        // Apply the same date filtering and sorting as multi-batch
        if (insiderTrades && insiderTrades.length > 0) {
          const now = new Date();
          const filteredTrades = insiderTrades.filter(trade => {
            try {
              const tradeDate = new Date(trade.filingDate);
              const diffInDays = (now - tradeDate) / (1000 * 60 * 60 * 24);
              
              let maxDays;
              switch (timeRange) {
                case '1w': maxDays = 7; break;
                case '1m': maxDays = 30; break;
                case '3m': maxDays = 90; break;
                case '6m': maxDays = 180; break;
                default: maxDays = 30; break;
              }
              
              // Allow for some tolerance (e.g., 2 extra days) to account for timezone differences
              const isWithinRange = diffInDays <= (maxDays + 2) && diffInDays >= -1;
              
              if (!isWithinRange) {
                console.log(`🔍 FILTERING OUT trade outside ${timeRange} range: ${trade.ticker} from ${tradeDate.toDateString()} (${Math.round(diffInDays)} days ago)`);
              }
              
              return isWithinRange;
            } catch (error) {
              console.error('🔍 Error filtering trade by date:', error.message);
              return false; // Exclude trades with invalid dates
            }
          });
          
          console.log(`🔍 Date filtering: ${insiderTrades.length} -> ${filteredTrades.length} trades within ${timeRange} range`);
          
          // Sort by filing date (most recent first)
          const sortedTrades = filteredTrades.sort((a, b) => {
            try {
              const dateA = new Date(a.filingDate);
              const dateB = new Date(b.filingDate);
              return dateB - dateA; // Descending order (newest first)
            } catch (error) {
              return 0;
            }
          });
          
          // Log final date range for debugging
          if (sortedTrades.length > 0) {
            const oldestTrade = sortedTrades[sortedTrades.length - 1];
            const newestTrade = sortedTrades[0];
            console.log(`🔍 Final date range: ${new Date(oldestTrade.filingDate).toDateString()} to ${new Date(newestTrade.filingDate).toDateString()}`);
            
            // Extract unique dates for debugging
            const uniqueDates = [...new Set(sortedTrades.map(t => new Date(t.filingDate).toISOString().split('T')[0]))].sort();
            console.log(`🔍 uniqueDatesInResponse: ${JSON.stringify(uniqueDates)}`);
          }
          
          insiderTrades = sortedTrades;
        }
        
        // Store successful result in cache
        storeInCache(cacheKey, insiderTrades, false);
        
      } catch (error) {
        console.error(`🔍 FLOW TRACE - Error during SEC API request/parsing:`, error.message);
        
        // For rate limit errors, try to return stale cached data if available
        if (error.isRateLimit) {
          const staleCachedData = apiCache.get(cacheKey);
          if (staleCachedData) {
            console.log(`🔍 RATE LIMIT FALLBACK - Returning stale cached data (${staleCachedData.length} trades)`);
            if (progressCallback) {
              progressCallback({ 
                stage: `Rate limited - using cached data (${timeRange})`, 
                progress: 100, 
                total: staleCachedData.length, 
                current: staleCachedData.length,
                userMessage: 'Using recent cached data due to rate limits'
              });
            }
            return staleCachedData;
          }
        }
        
        // Store error in cache to prevent repeated failures
        storeInCache(cacheKey, [], true);
        throw error;
      }
      
      // If we got no data from the parser, return empty array
      if (!insiderTrades || insiderTrades.length === 0) {
        console.log('🔍 FLOW TRACE - No insider trades found, returning empty array');
        if (progressCallback) {
          progressCallback({ 
            stage: 'No insider trades found for the selected time range', 
            progress: 100, 
            total: 0, 
            current: 0 
          });
        }
        return [];
      }

      console.log(`🔍 FLOW TRACE - fetchInsiderTrades COMPLETE: ${insiderTrades.length} trades`);
      return insiderTrades;
    }
  } catch (err) {
    console.error('🔍 FLOW TRACE - Error in fetchInsiderTrades:', err.message);
    
    // Emit error progress
    if (progressCallback) {
      const userFriendlyMessage = err.isRateLimit 
        ? 'SEC servers are very busy. Please try again in a few minutes.'
        : 'Error fetching insider trading data. Please try again later.';
        
      progressCallback({ 
        stage: 'Error fetching insider trades', 
        progress: 0, 
        total: 0, 
        current: 0,
        error: userFriendlyMessage
      });
    }
    
    // Return empty array instead of throwing to prevent server crash
    return [];
  }
}

/**
 * Fetch SEC Form 13F (institutional holding) data from the SEC EDGAR RSS feed and parse it.
 *
 * @param {string} [timeRange] - Optional time-range filter (placeholder for future use)
 * @param {number} [limit=100]  - Maximum number of entries to fetch from the feed
 * @returns {Promise<Array>} Parsed institutional-holding objects
 */
async function fetchInstitutionalHoldings(timeRange = '1m', limit = 100) {
  try {
    // The SEC RSS feed URL for the latest Form 13F filings
    const secUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=13F&count=${limit}&output=atom`;
    console.log(`[filingsFetcher] Fetching SEC Form 13F filings from: ${secUrl}`);

    // Make the API request with retry logic
    const response = await secApiRequestWithRetry(secUrl);

    // Parse the XML data using the form13FParser
    const institutionalHoldings = await parseSecForm13FData(response.data, limit);
    
    // If we got no data from the parser, return empty array
    if (!institutionalHoldings || institutionalHoldings.length === 0) {
      console.log('[filingsFetcher] No institutional holdings found from SEC API');
      return [];
    }
    
    console.log(`[filingsFetcher] Successfully fetched ${institutionalHoldings.length} institutional holdings`);
    return institutionalHoldings;
  } catch (error) {
    console.error('[filingsFetcher] Error fetching SEC institutional holdings:', error.message);
    // Return empty array instead of sample data
    return [];
  }
}

module.exports = {
  fetchInsiderTrades,
  fetchInstitutionalHoldings
};