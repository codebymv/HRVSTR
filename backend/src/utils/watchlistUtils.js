/**
 * Watchlist utility functions
 * Provides functions for working with user watchlist data
 */
const { pool } = require('../config/data-sources');

/**
 * Get user's watchlist tickers for sentiment analysis
 * @param {string} userId - User ID
 * @returns {Promise<Array<string>>} Array of ticker symbols
 */
async function getUserWatchlistTickers(userId) {
  try {
    if (!userId) {
      console.log('[WATCHLIST UTILS] No user ID provided, using default tickers');
      return getDefaultTickers();
    }

    const result = await pool.query(
      'SELECT DISTINCT symbol FROM watchlist WHERE user_id = $1 ORDER BY symbol',
      [userId]
    );
    
    const tickers = result.rows.map(row => row.symbol);
    
    console.log(`[WATCHLIST UTILS] Found ${tickers.length} tickers in user ${userId}'s watchlist: ${tickers.join(', ')}`);
    
    // Fallback to popular tickers if watchlist is empty
    if (tickers.length === 0) {
      console.log('[WATCHLIST UTILS] User watchlist is empty, using default tickers');
      return getDefaultTickers();
    }
    
    return tickers;
  } catch (error) {
    console.error('[WATCHLIST UTILS] Error fetching watchlist tickers:', error);
    // Fallback to hardcoded tickers on error
    return getDefaultTickers();
  }
}

/**
 * Get default tickers when user has no watchlist or on error
 * @returns {Array<string>} Array of default ticker symbols
 */
function getDefaultTickers() {
  return ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'SPY', 'QQQ'];
}

/**
 * Validate and limit tickers based on user tier
 * @param {Array<string>} tickers - Array of ticker symbols
 * @param {string} userTier - User's subscription tier
 * @returns {Array<string>} Limited array of tickers
 */
function limitTickersByTier(tickers, userTier) {
  const tierLimits = {
    'free': 3,
    'pro': 25,
    'elite': 50,
    'institutional': 100
  };
  
  const limit = tierLimits[userTier] || tierLimits['free'];
  
  if (tickers.length <= limit) {
    return tickers;
  }
  
  console.log(`[WATCHLIST UTILS] Limiting ${tickers.length} tickers to ${limit} for ${userTier} tier`);
  return tickers.slice(0, limit);
}

module.exports = {
  getUserWatchlistTickers,
  getDefaultTickers,
  limitTickersByTier
}; 