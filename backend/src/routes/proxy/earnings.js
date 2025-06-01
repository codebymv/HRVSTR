/**
 * Earnings Routes
 * Handles API routes for earnings data using free data sources
 */
const express = require('express');
const router = express.Router();
const earningsController = require('../../controllers/earningsController');
const validateDataSource = require('../../middleware/dataSourceValidator');
const { v4: uuidv4 } = require('uuid');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('earnings'));

/**
 * @route GET /api/earnings/upcoming
 * @desc Get upcoming earnings data from Yahoo Finance with optional progress tracking
 * @access Public
 */
router.get('/upcoming', async (req, res) => {
  try {
    const { timeRange = '1w', withProgress = 'false' } = req.query;
    
    if (withProgress === 'true') {
      // Return session ID for progress tracking
      const sessionId = uuidv4();
      
      console.log(`🚀 Starting background earnings scraping with session ID: ${sessionId}`);
      
      // Set initial progress immediately
      earningsController.updateProgress(sessionId, 0, 'Initializing earnings scraping...', null, null);
      
      // Start scraping in background WITHOUT awaiting
      setImmediate(async () => {
        try {
          console.log(`📊 Background scraping started for session ${sessionId}`);
          const results = await earningsController.scrapeEarningsCalendar(timeRange, sessionId);
          console.log(`✅ Background scraping completed for session ${sessionId}: ${results.length} events`);
          // Store results in progress for retrieval
          earningsController.updateProgress(sessionId, 100, `Completed! Found ${results.length} earnings events`, null, results);
        } catch (error) {
          console.error(`❌ Background scraping failed for session ${sessionId}:`, error);
          earningsController.updateProgress(sessionId, 0, `Error: ${error.message}`);
        }
      });
      
      // Return immediately with session ID
      return res.json({
        success: true,
        sessionId,
        message: 'Scraping started with progress tracking'
      });
    }
    
    // Original behavior - use existing controller
    return await earningsController.getUpcomingEarnings(req, res);
    
  } catch (error) {
    console.error('Error in earnings upcoming route:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch upcoming earnings data'
    });
  }
});

/**
 * @route GET /api/earnings/progress/:sessionId
 * @desc Get progress for a scraping operation
 * @access Public
 */
router.get('/progress/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const progress = earningsController.getProgress(sessionId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Progress not found or session expired'
      });
    }
    
    res.json({
      success: true,
      progress
    });
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get progress'
    });
  }
});

/**
 * @route GET /api/earnings/analysis/:ticker
 * @desc Get earnings analysis for a specific ticker using free data sources
 * @access Public
 */
router.get('/analysis/:ticker', earningsController.getEarningsAnalysis);

/**
 * @route GET /api/earnings/historical/:ticker
 * @desc Get historical earnings data for a specific ticker (placeholder for now)
 * @access Public
 */
router.get('/historical/:ticker', (req, res) => {
  // Temporary response while we implement full historical data
  res.status(200).json({
    success: true,
    ticker: req.params.ticker,
    historicalEarnings: [], // Empty array for now
    message: 'Historical earnings data not yet implemented with free data sources',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route GET /api/earnings/company/:ticker
 * @desc Get basic company information using free FMP endpoints
 * @access Public
 */
router.get('/company/:ticker', earningsController.getCompanyInfo);

/**
 * @route GET /api/earnings/health
 * @desc Health check for earnings service
 * @access Public
 */
router.get('/health', earningsController.getEarningsHealth);

module.exports = router;
