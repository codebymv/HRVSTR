/**
 * Earnings Controller
 * Handles business logic for earnings API endpoints
 */
const earningsUtils = require('../utils/earnings');
const earningsAnalysisUtils = require('../utils/earnings-analysis');
const cacheUtils = require('../utils/cache');
const { randomDelay } = require('../utils/scraping-helpers');

/**
 * Get upcoming earnings data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getUpcomingEarnings(req, res, next) {
  try {
    const { timeRange = '1m', refresh = false } = req.query;
    
    // Check cache first (unless refresh is requested)
    if (!refresh && cacheUtils.hasCachedItem('earnings-upcoming', { timeRange })) {
      console.log(`Serving cached earnings data for ${timeRange}`);
      return res.json(cacheUtils.getCachedItem('earnings-upcoming', { timeRange }));
    }
    
    // Add a small delay to avoid rate limiting if refresh was requested
    if (refresh) {
      await randomDelay(500, 1500);
    }
    
    // Scrape earnings calendar data
    const earningsEvents = await earningsUtils.scrapeEarningsCalendar(timeRange);
    
    // Determine the primary data source
    const primarySource = earningsEvents.length > 0 && earningsEvents[0].source ? 
      earningsEvents[0].source : 'placeholder';
    
    const result = {
      timeRange,
      earningsEvents,
      count: earningsEvents.length,
      source: primarySource,
      timestamp: new Date().toISOString(),
      isPlaceholder: primarySource === 'placeholder'
    };
    
    // Cache the result (6 hours TTL for real data, 1 hour for placeholders)
    const cacheTTL = primarySource === 'placeholder' ? 
      1 * 60 * 60 * 1000 : // 1 hour
      6 * 60 * 60 * 1000;  // 6 hours
    
    cacheUtils.setCachedItem('earnings-upcoming', { timeRange }, result, cacheTTL);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching upcoming earnings:', error.message);
    
    // Return a more informative error response
    res.status(500).json({
      error: 'Error fetching earnings data',
      message: error.message,
      timeRange: req.query.timeRange || '1m',
      timestamp: new Date().toISOString(),
      // Generate placeholder data even on error
      earningsEvents: earningsUtils.generatePlaceholderEarnings(req.query.timeRange || '1m'),
      isPlaceholder: true,
      source: 'error-fallback'
    });
  }
}

/**
 * Get historical earnings data for a specific ticker
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getHistoricalEarnings(req, res, next) {
  try {
    const { ticker } = req.params;
    
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker parameter is required' });
    }
    
    // Check cache first
    const cacheKey = `earnings-historical-${ticker}`;
    if (cacheUtils.hasCachedItem('earnings-historical', { ticker })) {
      console.log(`Serving cached historical earnings data for ${ticker}`);
      return res.json(cacheUtils.getCachedItem('earnings-historical', { ticker }));
    }
    
    // Fetch historical earnings data
    const historicalEarnings = await earningsUtils.fetchHistoricalEarnings(ticker);
    
    // Determine the primary data source
    const primarySource = historicalEarnings.length > 0 && historicalEarnings[0].source ? 
      historicalEarnings[0].source : 'placeholder';
    
    const result = {
      ticker,
      historicalEarnings,
      count: historicalEarnings.length,
      source: primarySource,
      timestamp: new Date().toISOString(),
      isPlaceholder: primarySource === 'placeholder'
    };
    
    // Cache the result (24 hours TTL for real data, 1 hour for placeholders)
    const cacheTTL = primarySource === 'placeholder' ? 
      1 * 60 * 60 * 1000 : // 1 hour
      24 * 60 * 60 * 1000; // 24 hours
    
    cacheUtils.setCachedItem('earnings-historical', { ticker }, result, cacheTTL);
    
    res.json(result);
  } catch (error) {
    console.error(`Error fetching historical earnings for ${req.params.ticker}:`, error.message);
    
    // Return a more informative error response with placeholder data
    res.status(500).json({
      error: 'Error fetching historical earnings data',
      message: error.message,
      ticker: req.params.ticker,
      timestamp: new Date().toISOString(),
      // Generate placeholder data even on error
      historicalEarnings: earningsUtils.generateHistoricalEarningsPlaceholder(req.params.ticker),
      isPlaceholder: true,
      source: 'error-fallback'
    });
  }
}

/**
 * Analyze earnings data for a specific ticker
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function analyzeEarnings(req, res, next) {
  try {
    const { ticker } = req.params;
    
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker parameter is required' });
    }
    
    // Check cache first
    const cacheKey = `earnings-analysis-${ticker}`;
    if (cacheUtils.hasCachedItem('earnings-analysis', { ticker })) {
      console.log(`Serving cached earnings analysis for ${ticker}`);
      return res.json(cacheUtils.getCachedItem('earnings-analysis', { ticker }));
    }
    
    // Fetch historical earnings data
    let historicalEarnings;
    
    try {
      // Try to get from cache first
      if (cacheUtils.hasCachedItem('earnings-historical', { ticker })) {
        const cachedData = cacheUtils.getCachedItem('earnings-historical', { ticker });
        historicalEarnings = cachedData.historicalEarnings;
      } else {
        // Fetch if not in cache
        historicalEarnings = await earningsUtils.fetchHistoricalEarnings(ticker);
      }
    } catch (error) {
      console.error(`Error fetching historical earnings for analysis: ${error.message}`);
      // Generate placeholder data if fetch fails
      historicalEarnings = earningsUtils.generateHistoricalEarningsPlaceholder(ticker);
    }
    
    // Analyze the earnings data
    const analysis = earningsAnalysisUtils.analyzeEarnings(historicalEarnings);
    
    const result = {
      ticker,
      analysis,
      timestamp: new Date().toISOString(),
      isPlaceholder: historicalEarnings.length > 0 && historicalEarnings[0].isPlaceholder
    };
    
    // Cache the result (6 hours TTL)
    cacheUtils.setCachedItem('earnings-analysis', { ticker }, result, 6 * 60 * 60 * 1000);
    
    res.json(result);
  } catch (error) {
    console.error(`Error analyzing earnings for ${req.params.ticker}:`, error.message);
    
    // Return a more informative error response
    res.status(500).json({
      error: 'Error analyzing earnings data',
      message: error.message,
      ticker: req.params.ticker,
      timestamp: new Date().toISOString(),
      analysis: {
        beatFrequency: 0,
        averageSurprise: 0,
        consistency: 0,
        postEarningsDrift: 0,
        latestEarnings: {
          surprise: 0,
          magnitude: 0,
          marketReaction: 0
        }
      },
      isPlaceholder: true
    });
  }
}

module.exports = {
  getUpcomingEarnings,
  getHistoricalEarnings,
  analyzeEarnings
};
