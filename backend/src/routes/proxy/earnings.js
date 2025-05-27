/**
 * Earnings Routes
 * Handles API routes for earnings data
 */
const express = require('express');
const router = express.Router();
const earningsController = require('../../controllers/earningsController');
const validateDataSource = require('../../middleware/dataSourceValidator');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('earnings'));

/**
 * @route GET /api/earnings/upcoming
 * @desc Get upcoming earnings data
 * @access Public
 */
router.get('/upcoming', earningsController.getUpcomingEarnings);

/**
 * @route GET /api/earnings/historical/:ticker
 * @desc Get historical earnings data for a specific ticker
 * @access Public
 */
router.get('/historical/:ticker', earningsController.getHistoricalEarnings);

/**
 * @route GET /api/earnings/analysis/:ticker
 * @desc Get earnings analysis for a specific ticker
 * @access Public
 */
router.get('/analysis/:ticker', earningsController.analyzeEarnings);

module.exports = router;
