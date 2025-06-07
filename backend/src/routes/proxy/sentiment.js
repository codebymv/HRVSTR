/**
 * Sentiment Routes
 * Handles API routes for sentiment analysis
 */
const express = require('express');
const router = express.Router();
const sentimentController = require('../../controllers/sentimentController');
const validateDataSource = require('../../middleware/dataSourceValidator');
const authenticateToken = require('../../middleware/authMiddleware');
const {
  getHistoricalSentimentController,
  getSentimentTrendsController,
  getComparativeHistoricalController,
  getHistoricalSummaryController
} = require('../../controllers/historicalSentimentController');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('sentiment'));

/**
 * @route GET /api/sentiment/reddit/tickers
 * @desc Get ticker sentiment data from Reddit
 * @access Protected (requires authentication only - no credits charged)
 */
router.get('/reddit/tickers', 
  authenticateToken,
  sentimentController.getRedditTickerSentiment
);

/**
 * @route GET /api/sentiment/reddit/market
 * @desc Get market sentiment data from Reddit
 * @access Protected (requires authentication only - no credits charged)
 */
router.get('/reddit/market', 
  authenticateToken,
  sentimentController.getRedditMarketSentiment
);

/**
 * @route GET /api/sentiment/finviz/tickers
 * @desc Get ticker sentiment data from Finviz
 * @access Protected (requires authentication only - no credits charged)
 */
router.get('/finviz/tickers', 
  authenticateToken,
  sentimentController.getFinvizSentiment
);

/**
 * @route GET /api/sentiment/yahoo/tickers
 * @desc Get ticker sentiment data from Yahoo Finance
 * @access Protected (requires authentication only - no credits charged)
 */
router.get('/yahoo/tickers', 
  authenticateToken,
  sentimentController.getYahooSentiment
);

/**
 * @route GET /api/sentiment/yahoo/market
 * @desc Get market sentiment data from Yahoo Finance
 * @access Protected (requires authentication only - no credits charged)
 */
router.get('/yahoo/market', 
  authenticateToken,
  sentimentController.getYahooMarketSentiment
);

/**
 * @route GET /api/sentiment/yahoo-market
 * @desc Get historical market sentiment data from Yahoo Finance
 * @access Protected (requires authentication only - no credits charged)
 */
router.get('/yahoo-market', 
  authenticateToken,
  sentimentController.getYahooMarketSentiment
);

/**
 * @route GET /api/sentiment/finviz-market
 * @desc Get historical market sentiment data from FinViz
 * @access Protected (requires authentication only - no credits charged)
 */
router.get('/finviz-market', 
  authenticateToken,
  sentimentController.getFinvizMarketSentiment
);

/**
 * @route GET /api/sentiment/aggregate
 * @desc Get aggregated sentiment data from multiple sources
 * @access Protected (requires authentication only - no credits charged)
 */
router.get('/aggregate', 
  authenticateToken,
  sentimentController.getAggregatedSentiment
);

// Historical Sentiment Routes

/**
 * @route GET /api/sentiment/historical/:ticker
 * @desc Get historical sentiment data for a ticker
 * @access Protected (requires authentication)
 */
router.get('/historical/:ticker', authenticateToken, getHistoricalSentimentController);

/**
 * @route GET /api/sentiment/trends/:ticker
 * @desc Get sentiment trends for a ticker
 * @access Protected (requires authentication)
 */
router.get('/trends/:ticker', authenticateToken, getSentimentTrendsController);

/**
 * @route GET /api/sentiment/comparative
 * @desc Get comparative historical sentiment for multiple tickers
 * @access Protected (requires authentication)
 */
router.get('/comparative', authenticateToken, getComparativeHistoricalController);

/**
 * @route GET /api/sentiment/summary/:ticker
 * @desc Get historical sentiment summary with key metrics
 * @access Protected (requires authentication)
 */
router.get('/summary/:ticker', authenticateToken, getHistoricalSummaryController);

/**
 * @route POST /api/sentiment/test/manual-aggregation
 * @desc Manual test route for sentiment aggregation (development only)
 * @access Protected (requires authentication)
 */
router.post('/test/manual-aggregation', authenticateToken, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Manual aggregation test route not available in production'
    });
  }

  try {
    const { runManualAggregation } = require('../../jobs/dailySentimentAggregation');
    const { tickers } = req.body;
    
    console.log('🔧 Manual aggregation requested by:', req.user.email);
    
    // Use custom tickers or default subset for testing
    const testTickers = tickers || ['AAPL', 'TSLA', 'MSFT'];
    
    const results = await runManualAggregation(testTickers);
    
    res.json({
      success: true,
      message: 'Manual sentiment aggregation completed',
      data: results,
      requestedBy: req.user.email,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Manual aggregation test failed:', error);
    res.status(500).json({
      error: 'Manual aggregation failed',
      message: error.message
    });
  }
});

/**
 * Clear sentiment cache
 */
router.post('/clear-cache', async (req, res) => {
  try {
    console.log('🗑️ Clearing sentiment caches...');
    
    // Import cache manager
    const cacheManager = require('../../utils/cacheManager');
    
    // Clear FinViz sentiment cache
    const finvizCleared = cacheManager.clearCacheByPattern('finviz-sentiment-*');
    console.log(`Cleared ${finvizCleared} FinViz sentiment cache entries`);
    
    // Clear Yahoo sentiment cache  
    const yahooCleared = cacheManager.clearCacheByPattern('yahoo-sentiment-*');
    console.log(`Cleared ${yahooCleared} Yahoo sentiment cache entries`);
    
    // Clear market sentiment caches
    const marketCleared = cacheManager.clearCacheByPattern('*-market-sentiment');
    console.log(`Cleared ${marketCleared} market sentiment cache entries`);
    
    const totalCleared = finvizCleared + yahooCleared + marketCleared;
    
    res.json({
      success: true,
      message: `Cleared ${totalCleared} sentiment cache entries`,
      details: {
        finviz: finvizCleared,
        yahoo: yahooCleared,
        market: marketCleared,
        total: totalCleared
      }
    });
  } catch (error) {
    console.error('Error clearing sentiment cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear sentiment cache',
      error: error.message
    });
  }
});

module.exports = router;