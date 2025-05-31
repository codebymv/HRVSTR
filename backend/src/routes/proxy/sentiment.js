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

module.exports = router;