/**
 * Yahoo Finance API routes
 * Handles requests for Yahoo Finance data
 */
const express = require('express');
const router = express.Router();
const yahooController = require('../../controllers/yahooController');
const validateDataSource = require('../../middleware/dataSourceValidator');
const authenticateToken = require('../../middleware/authMiddleware');
const { checkSentimentCredits, deductCredits, addCreditInfoToResponse, checkCredits } = require('../../middleware/tierMiddleware');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('yahoo'));

/**
 * @route GET /api/yahoo/ticker-sentiment
 * @description Get sentiment data for specified tickers from Yahoo Finance
 * @param {string} tickers - Comma-separated list of tickers
 * @access Protected (requires authentication and credits)
 */
router.get('/ticker-sentiment', 
  authenticateToken,
  checkSentimentCredits,
  addCreditInfoToResponse,
  yahooController.getTickerSentiment,
  deductCredits
);

/**
 * @route GET /api/yahoo/market-sentiment
 * @description Get market sentiment data from Yahoo Finance
 * @access Protected (requires authentication and credits)
 */
router.get('/market-sentiment', 
  authenticateToken,
  checkCredits('market-sentiment'),
  addCreditInfoToResponse,
  yahooController.getMarketSentiment,
  deductCredits
);

module.exports = router;
