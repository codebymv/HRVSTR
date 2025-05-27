/**
 * SEC Controller
 * Handles business logic for SEC API endpoints
 */
const secService = require('../services/secService');
const cacheUtils = require('../utils/cache');

/**
 * Get insider trades data from SEC
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getInsiderTrades(req, res, next) {
  try {
    const { timeRange = '1m', limit = 100, refresh = 'false' } = req.query;
    
    // Check cache first, unless refresh is requested
    if (refresh !== 'true' && cacheUtils.hasCachedItem('sec-insider-trades', { timeRange, limit })) {
      console.log(`Serving cached SEC insider trades data for ${timeRange}`);
      return res.json(cacheUtils.getCachedItem('sec-insider-trades', { timeRange, limit }));
    }
    
    // If refresh=true or no cached data, fetch fresh data
    console.log(`Fetching fresh SEC insider trades data for ${timeRange}`);
    
    // Fetch and process insider trades using our service
    const insiderTrades = await secService.fetchInsiderTrades(timeRange, parseInt(limit));

    const result = {
      timeRange,
      insiderTrades,
      count: insiderTrades.length,
      source: 'sec-edgar',
      refreshed: true
    };
    
    // Cache the result (30 minutes TTL)
    cacheUtils.setCachedItem('sec-insider-trades', { timeRange, limit }, result, 30 * 60 * 1000);
    
    res.json(result);
  } catch (error) {
    console.error(`SEC Insider Trades Error: ${error.message}`);
    next(error);
  }
}

/**
 * Get institutional holdings data from SEC
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getInstitutionalHoldings(req, res, next) {
  try {
    const { timeRange = '1m', limit = 50, refresh = 'false' } = req.query;
    
    // Check cache first, unless refresh is requested
    if (refresh !== 'true' && cacheUtils.hasCachedItem('sec-institutional-holdings', { timeRange, limit })) {
      console.log(`Serving cached SEC institutional holdings data for ${timeRange}`);
      return res.json(cacheUtils.getCachedItem('sec-institutional-holdings', { timeRange, limit }));
    }
    
    // If refresh=true or no cached data, fetch fresh data
    console.log(`Fetching fresh SEC institutional holdings data for ${timeRange}`);
    
    // Fetch and process institutional holdings using our service
    const institutionalHoldings = await secService.fetchInstitutionalHoldings(timeRange, parseInt(limit));

    const result = {
      timeRange,
      institutionalHoldings,
      count: institutionalHoldings.length,
      source: 'sec-edgar',
      refreshed: true
    };
    
    // Cache the result (30 minutes TTL)
    cacheUtils.setCachedItem('sec-institutional-holdings', { timeRange, limit }, result, 30 * 60 * 1000);
    
    res.json(result);
  } catch (error) {
    console.error(`SEC Institutional Holdings Error: ${error.message}`);
    next(error);
  }
}

/**
 * Clear the SEC data cache
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function clearCache(req, res, next) {
  try {
    // Get all cache keys that start with 'sec-'
    const clearedKeys = [];
    let totalCleared = 0;
    
    // Clear insider trades cache
    const insiderTradesCleared = cacheUtils.clearCache('sec-insider-trades');
    if (insiderTradesCleared > 0) {
      clearedKeys.push('sec-insider-trades');
      totalCleared += insiderTradesCleared;
    }
    
    // Clear institutional holdings cache
    const holdingsCleared = cacheUtils.clearCache('sec-institutional-holdings');
    if (holdingsCleared > 0) {
      clearedKeys.push('sec-institutional-holdings');
      totalCleared += holdingsCleared;
    }
    
    console.log(`Cleared ${totalCleared} items from SEC data cache`);
    res.json({ 
      success: true, 
      message: `Cleared ${totalCleared} items from cache`, 
      clearedCount: totalCleared,
      clearedKeys
    });
  } catch (error) {
    console.error(`Error clearing cache: ${error.message}`);
    next(error);
  }
}

module.exports = {
  getInsiderTrades,
  getInstitutionalHoldings,
  clearCache
};