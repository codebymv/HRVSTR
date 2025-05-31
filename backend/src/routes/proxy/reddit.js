/**
 * Reddit Routes
 * Handles API routes for Reddit data
 */
const express = require('express');
const router = express.Router();
const redditController = require('../../controllers/redditController');
const validateDataSource = require('../../middleware/dataSourceValidator');
const authenticateToken = require('../../middleware/authMiddleware');
const { checkSentimentCredits, deductCredits, addCreditInfoToResponse, checkCredits } = require('../../middleware/tierMiddleware');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('reddit'));

/**
 * @route GET /api/reddit/subreddit/:subreddit
 * @desc Get posts from a subreddit
 * @access Protected (requires authentication and Reddit API keys - Pro feature)
 */
router.get('/subreddit/:subreddit', 
  authenticateToken,
  redditController.getSubredditPosts
);

/**
 * @route GET /api/reddit/ticker-sentiment
 * @desc Get ticker-specific sentiment data from Reddit
 * @access Protected (requires authentication and credits - Reddit analysis is premium)
 */
router.get('/ticker-sentiment', 
  authenticateToken,
  checkSentimentCredits,
  addCreditInfoToResponse,
  redditController.getTickerSentiment,
  deductCredits
);

/**
 * @route GET /api/reddit/sentiment
 * @desc Get overall market sentiment data from Reddit
 * @access Protected (requires authentication and credits - Reddit analysis is premium)
 */
router.get('/sentiment', 
  authenticateToken,
  checkCredits('sentiment-reddit'),
  addCreditInfoToResponse,
  redditController.getSentiment,
  deductCredits
);

/**
 * @route POST /api/reddit/settings/update-keys
 * @desc Update Reddit API keys
 * @access Public
 */
router.post('/settings/update-keys', redditController.updateApiKeys);

module.exports = router;
