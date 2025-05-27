/**
 * Reddit Routes
 * Handles API routes for Reddit data
 */
const express = require('express');
const router = express.Router();
const redditController = require('../../controllers/redditController');
const validateDataSource = require('../../middleware/dataSourceValidator');

// Apply the data source validator middleware to all routes
router.use(validateDataSource('reddit'));

/**
 * @route GET /api/reddit/subreddit/:subreddit
 * @desc Get posts from a subreddit
 * @access Public
 */
router.get('/subreddit/:subreddit', redditController.getSubredditPosts);

/**
 * @route GET /api/reddit/ticker-sentiment
 * @desc Get ticker-specific sentiment data from Reddit
 * @access Public
 */
router.get('/ticker-sentiment', redditController.getTickerSentiment);

/**
 * @route GET /api/reddit/sentiment
 * @desc Get overall market sentiment data from Reddit
 * @access Public
 */
router.get('/sentiment', redditController.getSentiment);

/**
 * @route POST /api/reddit/settings/update-keys
 * @desc Update Reddit API keys
 * @access Public
 */
router.post('/settings/update-keys', redditController.updateApiKeys);

module.exports = router;
