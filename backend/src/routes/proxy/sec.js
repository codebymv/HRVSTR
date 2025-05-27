/**
 * SEC Routes
 * Handles API routes for SEC data
 */
const express = require('express');
const router = express.Router();
const secController = require('../../controllers/secController');
const validateDataSource = require('../../middleware/dataSourceValidator');

// Apply data source validators to specific routes
const validateSecInsider = validateDataSource('sec_insider');
const validateSecInstitutional = validateDataSource('sec_institutional');

/**
 * @route GET /api/sec/insider-trades
 * @desc Get insider trades data from SEC
 * @access Public
 */
router.get('/insider-trades', validateSecInsider, secController.getInsiderTrades);

/**
 * @route GET /api/sec/institutional-holdings
 * @desc Get institutional holdings data from SEC
 * @access Public
 */
router.get('/institutional-holdings', validateSecInstitutional, secController.getInstitutionalHoldings);

/**
 * @route GET /api/sec/clear-cache
 * @desc Clear the SEC data cache (for development and testing)
 * @access Public
 */
router.get('/clear-cache', secController.clearCache);

module.exports = router;
