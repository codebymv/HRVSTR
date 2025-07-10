/**
 * Finviz Routes
 * Handles API routes for Finviz data
 */
const express = require('express');
const router = express.Router();
const finvizController = require('../../controllers/finvizController');
const validateDataSource = require('../../middleware/dataSourceValidator');
const authenticateToken = require('../../middleware/authMiddleware');
const { checkSentimentSession } = require('../../middleware/sentimentSessionMiddleware');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('finviz'));

/**
 * @route GET /api/finviz/ticker-sentiment
 * @desc Get ticker-specific sentiment data from Finviz
 * @access Protected (requires authentication + active session - no credits charged)
 */
router.get('/ticker-sentiment', 
  authenticateToken,
  checkSentimentSession,
  finvizController.getTickerSentiment
);

module.exports = router;
