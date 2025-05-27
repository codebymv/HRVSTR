/**
 * Finviz Routes
 * Handles API routes for Finviz data
 */
const express = require('express');
const router = express.Router();
const finvizController = require('../../controllers/finvizController');
const validateDataSource = require('../../middleware/dataSourceValidator');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('finviz'));

/**
 * @route GET /api/finviz/ticker-sentiment
 * @desc Get ticker-specific sentiment data from Finviz
 * @access Public
 */
router.get('/ticker-sentiment', finvizController.getTickerSentiment);

module.exports = router;
