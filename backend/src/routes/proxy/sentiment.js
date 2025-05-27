/**
 * Sentiment Routes
 * Handles API routes for sentiment analysis
 */
const express = require('express');
const router = express.Router();
const sentimentController = require('../../controllers/sentimentController');
const validateDataSource = require('../../middleware/dataSourceValidator');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('sentiment'));

/**
 * @route GET /api/sentiment/reddit/tickers
 * @desc Get ticker sentiment data from Reddit
 * @access Public
 */
router.get('/reddit/tickers', sentimentController.getRedditTickerSentiment);

/**
 * @route GET /api/sentiment/reddit/market
 * @desc Get market sentiment data from Reddit
 * @access Public
 */
router.get('/reddit/market', sentimentController.getRedditMarketSentiment);

/**
 * @route GET /api/sentiment/finviz/tickers
 * @desc Get ticker sentiment data from Finviz
 * @access Public
 */
router.get('/finviz/tickers', sentimentController.getFinvizSentiment);

/**
 * @route GET /api/sentiment/yahoo/tickers
 * @desc Get ticker sentiment data from Yahoo Finance
 * @access Public
 */
router.get('/yahoo/tickers', sentimentController.getYahooSentiment);

/**
 * @route GET /api/sentiment/yahoo/market
 * @desc Get market sentiment data from Yahoo Finance
 * @access Public
 */
router.get('/yahoo/market', sentimentController.getYahooMarketSentiment);

/**
 * @route GET /api/sentiment/aggregate
 * @desc Get aggregated sentiment data from multiple sources
 * @access Public
 */
router.get('/aggregate', sentimentController.getAggregatedSentiment);

module.exports = router;