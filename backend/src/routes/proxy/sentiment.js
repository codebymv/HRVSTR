/**
 * Sentiment Routes
 * Handles API routes for sentiment analysis
 */
const express = require('express');
const router = express.Router();
const sentimentController = require('../../controllers/sentimentController');
const validateDataSource = require('../../middleware/dataSourceValidator');
const authenticateToken = require('../../middleware/authMiddleware');
const { checkSentimentCredits, deductCredits, addCreditInfoToResponse, checkCredits } = require('../../middleware/tierMiddleware');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('sentiment'));

/**
 * @route GET /api/sentiment/reddit/tickers
 * @desc Get ticker sentiment data from Reddit
 * @access Protected (requires authentication and credits)
 */
router.get('/reddit/tickers', 
  authenticateToken,
  checkSentimentCredits,
  addCreditInfoToResponse,
  sentimentController.getRedditTickerSentiment,
  deductCredits
);

/**
 * @route GET /api/sentiment/reddit/market
 * @desc Get market sentiment data from Reddit
 * @access Protected (requires authentication and credits)
 */
router.get('/reddit/market', 
  authenticateToken,
  checkCredits('sentiment-reddit'),
  addCreditInfoToResponse,
  sentimentController.getRedditMarketSentiment,
  deductCredits
);

/**
 * @route GET /api/sentiment/finviz/tickers
 * @desc Get ticker sentiment data from Finviz
 * @access Protected (requires authentication and credits)
 */
router.get('/finviz/tickers', 
  authenticateToken,
  checkSentimentCredits,
  addCreditInfoToResponse,
  sentimentController.getFinvizSentiment,
  deductCredits
);

/**
 * @route GET /api/sentiment/yahoo/tickers
 * @desc Get ticker sentiment data from Yahoo Finance
 * @access Protected (requires authentication and credits)
 */
router.get('/yahoo/tickers', 
  authenticateToken,
  checkSentimentCredits,
  addCreditInfoToResponse,
  sentimentController.getYahooSentiment,
  deductCredits
);

/**
 * @route GET /api/sentiment/yahoo/market
 * @desc Get market sentiment data from Yahoo Finance
 * @access Protected (requires authentication and credits)
 */
router.get('/yahoo/market', 
  authenticateToken,
  checkCredits('market-sentiment'),
  addCreditInfoToResponse,
  sentimentController.getYahooMarketSentiment,
  deductCredits
);

/**
 * @route GET /api/sentiment/yahoo-market
 * @desc Get historical market sentiment data from Yahoo Finance
 * @access Protected (requires authentication and credits)
 */
router.get('/yahoo-market', 
  authenticateToken,
  checkCredits('market-sentiment'),
  addCreditInfoToResponse,
  sentimentController.getYahooMarketSentiment,
  deductCredits
);

/**
 * @route GET /api/sentiment/finviz-market
 * @desc Get historical market sentiment data from FinViz
 * @access Protected (requires authentication and credits)
 */
router.get('/finviz-market', 
  authenticateToken,
  checkCredits('market-sentiment'),
  addCreditInfoToResponse,
  sentimentController.getFinvizMarketSentiment,
  deductCredits
);

/**
 * @route GET /api/sentiment/aggregate
 * @desc Get aggregated sentiment data from multiple sources
 * @access Protected (requires authentication and credits)
 */
router.get('/aggregate', 
  authenticateToken,
  checkCredits('sentiment-aggregated'),
  addCreditInfoToResponse,
  sentimentController.getAggregatedSentiment,
  deductCredits
);

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