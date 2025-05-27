/**
 * Reddit Controller
 * Handles business logic for Reddit API endpoints
 */
const redditUtils = require('../utils/reddit');
const sentimentService = require('../services/sentimentService');
const cacheUtils = require('../utils/cache');
const apiKeys = require('../config/api-keys');

/**
 * Get posts from a subreddit
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getSubredditPosts(req, res, next) {
  try {
    const { subreddit } = req.params;
    const { limit = 25, timeframe = 'day' } = req.query;
    
    const posts = await redditUtils.fetchSubredditPosts(subreddit, { limit, timeframe });
    
    // Format response for frontend
    res.json({
      // This preserves the children array that the frontend expects
      data: {
        children: posts
      },
      posts: posts.map(redditUtils.formatRedditPost)
    });
  } catch (error) {
    console.error('Error fetching subreddit posts:', error.message);
    next(error);
  }
}

/**
 * Get ticker sentiment data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getTickerSentiment(req, res, next) {
  try {
    const { timeRange = '1w' } = req.query;
    const result = await sentimentService.getRedditTickerSentiment(timeRange);
    
    // Log confidence values to verify they're being set
    if (result && result.sentimentData) {
      console.log('CONFIDENCE DEBUG - API Response Data:', 
        result.sentimentData.map(item => ({
          ticker: item.ticker,
          confidence: item.confidence,
          timestamp: new Date().toISOString()
        }))
      );
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error calculating ticker sentiment:', error.message);
    next(error);
  }
}

/**
 * Get overall sentiment data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getSentiment(req, res, next) {
  try {
    const { timeRange = '1w' } = req.query;
    const result = await sentimentService.getRedditMarketSentiment(timeRange);
    res.json(result);
  } catch (error) {
    console.error('Error calculating sentiment:', error.message);
    next(error);
  }
}

/**
 * Update Reddit API keys
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function updateApiKeys(req, res, next) {
  try {
    const { 
      reddit_client_id, 
      reddit_client_secret, 
      reddit_user_agent,
      reddit_username,
      reddit_password
    } = req.body;
    
    apiKeys.updateApiKeys({
      reddit_client_id,
      reddit_client_secret,
      reddit_user_agent,
      reddit_username,
      reddit_password
    });
    
    res.json({ success: true, message: 'API keys updated successfully' });
  } catch (error) {
    console.error('Error updating API keys:', error.message);
    next(error);
  }
}

module.exports = {
  getSubredditPosts,
  getTickerSentiment,
  getSentiment,
  updateApiKeys
};
