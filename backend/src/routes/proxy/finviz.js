/**
 * Finviz Routes
 * Handles API routes for Finviz data
 */
const express = require('express');
const router = express.Router();
const finvizController = require('../../controllers/finvizController');
const validateDataSource = require('../../middleware/dataSourceValidator');
const authenticateToken = require('../../middleware/authMiddleware');
const { checkSentimentCredits, deductCredits, addCreditInfoToResponse } = require('../../middleware/tierMiddleware');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('finviz'));

/**
 * @route GET /api/finviz/ticker-sentiment
 * @desc Get ticker-specific sentiment data from Finviz
 * @access Protected (requires authentication and credits)
 */
router.get('/ticker-sentiment', 
  authenticateToken,
  checkSentimentCredits,
  addCreditInfoToResponse,
  finvizController.getTickerSentiment,
  deductCredits
);

module.exports = router;
