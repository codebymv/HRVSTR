/**
 * Reddit API utility functions
 * Handles common operations for Reddit API integration
 */
const axios = require('axios');
const apiKeys = require('../config/api-keys');
const cacheManager = require('./cacheManager');
const sentiment = require('./sentiment');

// Register rate limits for Reddit API
cacheManager.registerRateLimit('reddit-api', 60, 60); // 60 requests per minute

let accessToken = null;
let tokenExpiration = 0;

/**
 * Get OAuth2 access token from Reddit
 * @returns {Promise<string>} Access token
 */
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  
  // Return cached token if it's still valid
  if (accessToken && now < tokenExpiration - 60) {
    return accessToken;
  }
  
  try {
    const response = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      'grant_type=client_credentials',
      {
        auth: {
          username: apiKeys.getRedditClientId(),
          password: apiKeys.getRedditClientSecret()
        },
        headers: {
          'User-Agent': apiKeys.getRedditUserAgent(),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    accessToken = response.data.access_token;
    tokenExpiration = now + response.data.expires_in;
    
    return accessToken;
  } catch (error) {
    console.error('Error getting Reddit access token:', error.message);
    throw new Error('Failed to authenticate with Reddit API');
  }
}

/**
 * Fetch posts from a subreddit
 * @param {string} subreddit - Subreddit name
 * @param {Object} options - Request options
 * @param {number} options.limit - Number of posts to fetch
 * @param {string} options.sort - Sort method (hot, new, top, etc.)
 * @param {string} options.time - Time period for top posts (hour, day, week, month, year, all)
 * @returns {Promise<Array>} Array of posts
 */
async function fetchSubredditPosts(subreddit, { limit = 25, sort = 'hot', time = 'week' } = {}) {
  try {
    const token = await getAccessToken();
    const response = await axios.get(
      `https://oauth.reddit.com/r/${subreddit}/${sort}?limit=${limit}&t=${time}&raw_json=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': apiKeys.getRedditUserAgent()
        }
      }
    );
    
    return response.data.data.children;
  } catch (error) {
    console.error(`Error fetching posts from r/${subreddit}:`, error.message);
    throw new Error(`Failed to fetch posts from r/${subreddit}`);
  }
  
  return posts;
}

/**
 * Extract common stock tickers from text
 * @param {string} text - Text to extract tickers from
 * @returns {Array<string>} Array of ticker symbols
 */
function extractTickers(text) {
  const tickerRegex = /\b[A-Z]{2,5}\b/g;
  const commonTickers = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'AMD'];
  
  // Extract all potential ticker symbols
  const matches = text.match(tickerRegex) || [];
  
  // Filter to common tickers
  return matches.filter(ticker => commonTickers.includes(ticker));
}

/**
 * Format Reddit post for client consumption
 * @param {Object} post - Reddit post data
 * @returns {Object} Formatted post
 */
function formatRedditPost(post) {
  const { data } = post;
  return {
    id: data.id,
    title: data.title,
    author: data.author,
    created: data.created_utc,
    score: data.ups,
    upvoteRatio: data.upvote_ratio,
    numComments: data.num_comments,
    url: data.url,
    permalink: `https://reddit.com${data.permalink}`,
    selftext: data.selftext
  };
}

module.exports = {
  fetchSubredditPosts,
  extractTickers,
  formatRedditPost
};