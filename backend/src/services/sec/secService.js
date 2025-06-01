/**
 * Get insider trades with enhanced free tier support
 * @param {string} timeRange - Time range for the query
 * @param {number} limit - Maximum number of results
 * @param {function} progressCallback - Progress callback function
 * @param {Object} userContext - User context including tier information
 * @returns {Promise<Array>} Array of insider trades
 */
async function getInsiderTrades(timeRange = '1m', limit = 100, progressCallback = null, userContext = {}) {
  try {
    const isFreeTier = !userContext.tier || userContext.tier === 'free';
    
    // Emit initial status with tier-appropriate messaging
    if (progressCallback) {
      const tierMessage = isFreeTier 
        ? 'Free tier: Checking cache and making minimal API requests...'
        : 'Pro tier: Fetching fresh data...';
        
      progressCallback({
        stage: tierMessage,
        progress: 1,
        total: 100,
        current: 0,
        userMessage: isFreeTier 
          ? 'Free tier users experience longer wait times due to SEC rate limits. Cached data is used when available.'
          : 'Pro tier provides faster access with priority handling.'
      });
    }
    
    console.log(`[secService] Fetching insider trades for ${timeRange}, limit: ${limit}, tier: ${userContext.tier || 'free'}`);
    
    // Use the enhanced fetchInsiderTrades with tier awareness
    const trades = await fetchInsiderTrades(timeRange, limit, progressCallback, isFreeTier);
    
    console.log(`[secService] Successfully fetched ${trades.length} insider trades`);
    return trades;
    
  } catch (error) {
    console.error('[secService] Error fetching insider trades:', error.message);
    
    // Enhanced error handling with user-friendly messages
    if (progressCallback) {
      let userMessage = 'Error fetching insider trading data. Please try again later.';
      let stage = 'Error fetching insider trades';
      
      if (error.isRateLimit) {
        userMessage = 'SEC servers are very busy right now. This is common for free accounts. Please wait a few minutes and try again, or consider upgrading for priority access.';
        stage = 'Rate limit encountered - SEC servers busy';
      } else if (error.isNetworkError) {
        userMessage = 'Network connection issue. Please check your internet connection and try again.';
        stage = 'Network connection error';
      } else if (error.isServerError) {
        userMessage = 'SEC servers are temporarily unavailable. Please try again in a few minutes.';
        stage = 'SEC API temporarily unavailable';
      }
      
      progressCallback({
        stage,
        progress: 0,
        total: 0,
        current: 0,
        error: userMessage,
        isRateLimit: error.isRateLimit || false
      });
    }
    
    // Return empty array instead of throwing to prevent cascading failures
    return [];
  }
} 