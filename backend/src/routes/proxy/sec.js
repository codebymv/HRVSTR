/**
 * SEC Routes
 * Handles API routes for SEC data
 */
const express = require('express');
const router = express.Router();
const secController = require('../../controllers/secController');
const validateDataSource = require('../../middleware/dataSourceValidator');
const { checkFeatureAccess } = require('../../middleware/tierMiddleware');
const authenticateToken = require('../../middleware/authMiddleware');

// Apply data source validators to specific routes
const validateSecInsider = validateDataSource('sec_insider');
const validateSecInstitutional = validateDataSource('sec_institutional');

/**
 * @route GET /api/sec/insider-trades
 * @desc Get insider trades data from SEC (all recent filings)
 * @access Public - Available to all tiers
 */
router.get('/insider-trades', validateSecInsider, secController.getInsiderTrades);

/**
 * @route GET /api/sec/insider-trades/stream
 * @desc Stream insider trades data with real-time progress updates using SSE
 * @access Public - Available to all tiers
 */
router.get('/insider-trades/stream', validateSecInsider, secController.streamInsiderTrades);

/**
 * @route GET /api/sec/insider-trades/:ticker
 * @desc Get insider trades data for a specific ticker
 * @access Public - Available to all tiers
 */
router.get('/insider-trades/:ticker', validateSecInsider, secController.getInsiderTradesByTicker);

/**
 * @route GET /api/sec/institutional-holdings
 * @desc Get institutional holdings data from SEC (all recent filings)
 * @access Pro+ - Requires Pro tier or higher
 */
router.get('/institutional-holdings', authenticateToken, checkFeatureAccess('SEC-Institutional'), validateSecInstitutional, secController.getInstitutionalHoldings);

/**
 * @route GET /api/sec/institutional-holdings/:ticker
 * @desc Get institutional holdings data for a specific ticker
 * @access Pro+ - Requires Pro tier or higher
 */
router.get('/institutional-holdings/:ticker', authenticateToken, checkFeatureAccess('SEC-Institutional'), validateSecInstitutional, secController.getInstitutionalHoldingsByTicker);

/**
 * @route GET /api/sec/parallel
 * @desc Get both insider trades and institutional holdings in parallel for optimal loading
 * @access Public - But institutional holdings will be filtered based on tier
 */
router.get('/parallel', authenticateToken, validateSecInsider, secController.getSecDataParallel);

/**
 * @route GET /api/sec/abnormal-activity
 * @desc Detect abnormal trading activity patterns from insider trades
 * @access Public - Available to all tiers
 */
router.get('/abnormal-activity', validateSecInsider, secController.getAbnormalActivity);

/**
 * @route GET /api/sec/filing/:accessionNumber
 * @desc Get detailed information for a specific SEC filing
 * @access Public - Available to all tiers
 */
router.get('/filing/:accessionNumber', secController.getFilingDetails);

/**
 * @route GET /api/sec/summary/:ticker
 * @desc Get comprehensive SEC summary for a ticker (insider trades + institutional holdings)
 * @access Public - But institutional holdings will be filtered based on tier
 */
router.get('/summary/:ticker', authenticateToken, secController.getTickerSummary);

/**
 * @route GET /api/sec/cache/status
 * @desc Get user's SEC data cache status and expiration times
 * @access Authenticated - Requires valid user token
 */
router.get('/cache/status', authenticateToken, secController.getUserCacheStatus);

/**
 * @route DELETE /api/sec/cache/clear
 * @desc Clear user's SEC data cache (forces fresh fetch on next request)
 * @access Authenticated - Requires valid user token
 */
router.delete('/cache/clear', authenticateToken, secController.clearUserCache);

/**
 * @route GET /api/sec/clear-cache
 * @desc Clear the SEC data cache (for development and testing)
 * @access Public - Available to all tiers
 */
router.get('/clear-cache', secController.clearCache);

module.exports = router;
