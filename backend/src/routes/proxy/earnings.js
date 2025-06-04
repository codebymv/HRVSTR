/**
 * Earnings Routes
 * Handles API routes for earnings data using user-specific caching
 * Updated to follow the same architecture pattern as SEC routes
 */
const express = require('express');
const router = express.Router();
const earningsController = require('../../controllers/earningsController');
const validateDataSource = require('../../middleware/dataSourceValidator');
const { checkFeatureAccess } = require('../../middleware/tierMiddleware');
const authenticateToken = require('../../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('earnings'));

/**
 * @route GET /api/earnings/upcoming
 * @desc Get upcoming earnings data with user-specific caching
 * @access Public - Available to all tiers, but uses session-based caching for authenticated users
 */
router.get('/upcoming', authenticateToken, async (req, res) => {
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
    
    // Use new controller with user-specific caching
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
 * @route GET /api/earnings/upcoming/stream
 * @desc Stream upcoming earnings data with real-time progress updates using SSE
 * @access Public - Available to all tiers (with enhanced features for authenticated users)
 */
router.get('/upcoming/stream', async (req, res) => {
  try {
    const { timeRange = '1w', refresh = 'false', token: queryToken } = req.query;
    
    // Optional authentication - check for token in headers or query params
    let user = null;
    let token = null;
    
    // Check for token in Authorization header first
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    // If no header token, check query parameter (for EventSource compatibility)
    if (!token && queryToken) {
      token = queryToken;
    }
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const { pool } = require('../../config/data-sources');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userResult = await pool.query('SELECT id, tier FROM users WHERE id = $1', [decoded.userId]);
        if (userResult.rows.length > 0) {
          const userData = userResult.rows[0];
          user = { 
            id: userData.id, 
            tier: userData.tier || 'free'
          };
          console.log(`[AUTH] User authenticated for SSE: ${userData.id} (Tier: ${user.tier})`);
        }
      } catch (authError) {
        console.log(`[AUTH] SSE authentication failed, proceeding as unauthenticated: ${authError.message}`);
        // Continue as unauthenticated user
      }
    }
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const sessionId = uuidv4();
    console.log(`📡 SSE: Starting earnings stream for session ${sessionId} (user: ${user ? user.id : 'unauthenticated'})`);
    
    // Send initial progress
    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    sendProgress({
      stage: 'Initializing earnings data fetch...',
      progress: 0,
      total: 100,
      current: 0,
      timestamp: new Date().toISOString()
    });
    
    // Start background fetching with progress updates
    setImmediate(async () => {
      try {
        // Simulate progress updates
        const progressSteps = [
          { progress: 10, stage: 'Connecting to earnings data sources...' },
          { progress: 30, stage: 'Fetching upcoming earnings calendar...' },
          { progress: 60, stage: 'Processing earnings data...' },
          { progress: 80, stage: 'Validating and cleaning data...' },
          { progress: 90, stage: 'Finalizing results...' }
        ];
        
        for (const step of progressSteps) {
          sendProgress({
            ...step,
            total: 100,
            current: step.progress,
            timestamp: new Date().toISOString()
          });
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Fetch actual data - with optional authentication
        const mockReq = { 
          query: { timeRange, refresh },
          user: user // This will be null for unauthenticated users or proper user object for authenticated users
        };
        const mockRes = {
          json: (data) => {
            sendProgress({
              stage: 'Completed!',
              progress: 100,
              total: 100,
              current: 100,
              completed: true,
              data: data,
              timestamp: new Date().toISOString()
            });
            res.end();
          },
          status: (code) => mockRes,
          // Add other methods that might be called
          writeHead: () => mockRes,
          write: () => mockRes,
          end: () => res.end()
        };
        
        await earningsController.getUpcomingEarnings(mockReq, mockRes);
        
      } catch (error) {
        console.error(`❌ SSE earnings stream error:`, error);
        sendProgress({
          stage: 'Error occurred',
          progress: 0,
          total: 100,
          current: 0,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        res.end();
      }
    });
    
    // Handle client disconnect
    req.on('close', () => {
      console.log(`📡 SSE: Client disconnected from earnings stream ${sessionId}`);
    });
    
  } catch (error) {
    console.error('Error in earnings stream route:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start earnings data stream'
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
 * @desc Get earnings analysis for a specific ticker with user caching
 * @access Authenticated - Pro feature, requires valid user token and Pro+ subscription
 */
router.get('/analysis/:ticker', authenticateToken, earningsController.getEarningsAnalysis);

/**
 * @route GET /api/earnings/historical/:ticker
 * @desc Get historical earnings data for a specific ticker with user caching
 * @access Authenticated - Requires authentication (different limits by tier)
 */
router.get('/historical/:ticker', authenticateToken, earningsController.getHistoricalEarnings);

/**
 * @route GET /api/earnings/company/:ticker
 * @desc Get basic company information using free endpoints
 * @access Public - Available to all tiers
 */
router.get('/company/:ticker', earningsController.getCompanyInfo);

/**
 * @route GET /api/earnings/cache/status
 * @desc Get user's earnings data cache status and expiration times
 * @access Authenticated - Requires valid user token
 */
router.get('/cache/status', authenticateToken, earningsController.getUserEarningsCacheStatus);

/**
 * @route DELETE /api/earnings/cache/clear
 * @desc Clear user's earnings data cache (forces fresh fetch on next request)
 * @access Authenticated - Requires valid user token
 */
router.delete('/cache/clear', authenticateToken, earningsController.clearUserEarningsCache);

/**
 * @route GET /api/earnings/clear-cache
 * @desc Clear the earnings data cache (for development and testing)
 * @access Public - Available to all tiers
 */
router.get('/clear-cache', earningsController.clearEarningsCache);

/**
 * @route GET /api/earnings/health
 * @desc Health check for earnings service
 * @access Public
 */
router.get('/health', earningsController.getEarningsHealth);

module.exports = router;
