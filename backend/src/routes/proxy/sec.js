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
 * @desc Get insider trades data from SEC (all recent filings)
 * @access Public
 */
router.get('/insider-trades', validateSecInsider, secController.getInsiderTrades);

/**
 * @route GET /api/sec/insider-trades/:ticker
 * @desc Get insider trades data for a specific ticker
 * @access Public
 */
router.get('/insider-trades/:ticker', validateSecInsider, secController.getInsiderTradesByTicker);

/**
 * @route GET /api/sec/institutional-holdings
 * @desc Get institutional holdings data from SEC (all recent filings)
 * @access Public
 */
router.get('/institutional-holdings', validateSecInstitutional, secController.getInstitutionalHoldings);

/**
 * @route GET /api/sec/institutional-holdings/:ticker
 * @desc Get institutional holdings data for a specific ticker
 * @access Public
 */
router.get('/institutional-holdings/:ticker', validateSecInstitutional, secController.getInstitutionalHoldingsByTicker);

/**
 * @route GET /api/sec/abnormal-activity
 * @desc Detect abnormal trading activity patterns from insider trades
 * @access Public
 */
router.get('/abnormal-activity', validateSecInsider, secController.getAbnormalActivity);

/**
 * @route GET /api/sec/filing/:accessionNumber
 * @desc Get detailed information for a specific SEC filing
 * @access Public
 */
router.get('/filing/:accessionNumber', secController.getFilingDetails);

/**
 * @route GET /api/sec/summary/:ticker
 * @desc Get comprehensive SEC summary for a ticker (insider trades + institutional holdings)
 * @access Public
 */
router.get('/summary/:ticker', secController.getTickerSummary);

/**
 * @route GET /api/sec/clear-cache
 * @desc Clear the SEC data cache (for development and testing)
 * @access Public
 */
router.get('/clear-cache', secController.clearCache);

module.exports = router;
