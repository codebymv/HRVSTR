const express = require('express');
const router = express.Router();
const controller = require('../controllers/earningsController');
const { v4: uuidv4 } = require('uuid');

// Get progress for a scraping operation (no auth needed for basic earnings data)
router.get('/progress/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const progress = controller.getProgress(sessionId);
    
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

// Start earnings scraping with progress tracking (no auth needed for basic earnings data)
router.post('/start-scraping', async (req, res) => {
  try {
    const { timeRange = '1w' } = req.body;
    const sessionId = uuidv4();
    
    console.log(`🚀 Starting earnings scraping with session ID: ${sessionId}`);
    
    // Start scraping in background
    controller.scrapeEarningsCalendar(timeRange, sessionId)
      .then(results => {
        console.log(`✅ Background scraping completed for session ${sessionId}: ${results.length} events`);
      })
      .catch(error => {
        console.error(`❌ Background scraping failed for session ${sessionId}:`, error);
        controller.updateProgress(sessionId, 0, `Error: ${error.message}`);
      });
    
    // Return session ID immediately
    res.json({
      success: true,
      sessionId,
      message: 'Scraping started in background'
    });
  } catch (error) {
    console.error('Error starting scraping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start scraping'
    });
  }
});

// Update the existing upcoming earnings route to support both old and new ways
// Basic earnings data is available to all users, no auth required
router.get('/upcoming', async (req, res) => {
  try {
    const { timeRange = '1w', withProgress = 'false' } = req.query;
    
    if (withProgress === 'true') {
      // Return session ID for progress tracking
      const sessionId = uuidv4();
      
      console.log(`🚀 Starting background earnings scraping with session ID: ${sessionId}`);
      
      // Start scraping in background WITHOUT awaiting
      setImmediate(async () => {
        try {
          console.log(`📊 Background scraping started for session ${sessionId}`);
          const results = await controller.scrapeEarningsCalendar(timeRange, sessionId);
          console.log(`✅ Background scraping completed for session ${sessionId}: ${results.length} events`);
          // Store results in progress for retrieval
          controller.updateProgress(sessionId, 100, `Completed! Found ${results.length} earnings events`, null, results);
        } catch (error) {
          console.error(`❌ Background scraping failed for session ${sessionId}:`, error);
          controller.updateProgress(sessionId, 0, `Error: ${error.message}`);
        }
      });
      
      // Return immediately with session ID
      return res.json({
        success: true,
        sessionId,
        message: 'Scraping started with progress tracking'
      });
    }
    
    // Original behavior - direct scraping without progress
    console.log(`🔍 Fetching upcoming earnings for time range: ${timeRange}`);
    const earnings = await controller.scrapeEarningsCalendar(timeRange);
    
    console.log(`✅ Successfully fetched ${earnings.length} upcoming earnings`);
    res.json({
      success: true,
      data: earnings,
      count: earnings.length,
      timeRange,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching upcoming earnings:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch upcoming earnings data'
    });
  }
});

module.exports = router; 