/**
 * Reddit Routes
 * Handles API routes for Reddit data
 */
const express = require('express');
const router = express.Router();
const redditController = require('../../controllers/redditController');
const validateDataSource = require('../../middleware/dataSourceValidator');
const authenticateToken = require('../../middleware/authMiddleware');
const { checkSentimentSession } = require('../../middleware/sentimentSessionMiddleware');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('reddit'));

/**
 * @route GET /api/reddit/subreddit/:subreddit
 * @desc Get posts from a subreddit
 * @access Protected (requires authentication only - no credits charged)
 */
router.get('/subreddit/:subreddit', authenticateToken, redditController.getSubredditPosts);

/**
 * @route GET /api/reddit/ticker-sentiment
 * @desc Get ticker-specific sentiment data from Reddit
 * @access Protected (requires authentication + active session - no credits charged)
 */
router.get('/ticker-sentiment', 
  authenticateToken,
  checkSentimentSession,
  redditController.getTickerSentiment
);

/**
 * @route GET /api/reddit/sentiment
 * @desc Get overall market sentiment data from Reddit
 * @access Protected (requires authentication + active session - no credits charged)
 */
router.get('/sentiment', 
  authenticateToken,
  checkSentimentSession,
  redditController.getSentiment
);

/**
 * @route POST /api/reddit/settings/update-keys
 * @desc Update Reddit API keys
 * @access Public
 */
router.post('/settings/update-keys', redditController.updateApiKeys);

module.exports = router;
