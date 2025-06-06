/**
 * Yahoo Finance API routes
 * Handles requests for Yahoo Finance data
 */
const express = require('express');
const router = express.Router();
const yahooController = require('../../controllers/yahooController');
const validateDataSource = require('../../middleware/dataSourceValidator');
const authenticateToken = require('../../middleware/authMiddleware');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('yahoo'));

/**
 * @route GET /api/yahoo/ticker-sentiment
 * @description Get sentiment data for specified tickers from Yahoo Finance
 * @param {string} tickers - Comma-separated list of tickers
 * @access Protected (requires authentication only - no credits charged)
 */
router.get('/ticker-sentiment', 
  authenticateToken,
  yahooController.getTickerSentiment
);

/**
 * @route GET /api/yahoo/market-sentiment
 * @description Get market sentiment data from Yahoo Finance
 * @access Protected (requires authentication only - no credits charged)
 */
router.get('/market-sentiment', 
  authenticateToken,
  yahooController.getMarketSentiment
);

module.exports = router;
