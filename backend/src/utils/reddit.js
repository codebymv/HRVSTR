/**
 * Reddit API utility functions
 * Handles common operations for Reddit API integration
 */
const axios = require('axios');
const cacheManager = require('./cacheManager');
const sentiment = require('./sentiment');
const { getEffectiveApiKey } = require('./userApiKeys');

// Register rate limits for Reddit API
cacheManager.registerRateLimit('reddit-api', 60, 60); // 60 requests per minute

let accessTokenCache = new Map();
let tokenExpirationCache = new Map();

/**
 * Get OAuth2 access token from Reddit for a specific user
 * @param {string} userId - User ID to get keys for
 * @returns {Promise<string>} Access token
 */
async function getAccessToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  const cacheKey = userId || 'system';
  
  console.log(`[REDDIT AUTH DEBUG] Getting access token for user: ${cacheKey}`);
  
  // Return cached token if it's still valid
  const cachedToken = accessTokenCache.get(cacheKey);
  const cachedExpiration = tokenExpirationCache.get(cacheKey);
  
  if (cachedToken && cachedExpiration && now < cachedExpiration - 60) {
    console.log(`[REDDIT AUTH DEBUG] Using cached token for ${cacheKey}, expires in ${cachedExpiration - now} seconds`);
    return cachedToken;
  }
  
  try {
    // Get user-specific API keys or fall back to environment variables
    const clientId = await getEffectiveApiKey(userId, 'reddit', 'client_id');
    const clientSecret = await getEffectiveApiKey(userId, 'reddit', 'client_secret');
    
    console.log(`[REDDIT AUTH DEBUG] Client ID available: ${!!clientId}, Client Secret available: ${!!clientSecret}`);
    
    if (!clientId || !clientSecret) {
      console.error('[REDDIT AUTH ERROR] Reddit API credentials not configured');
      throw new Error('Reddit API credentials not configured');
    }
    
    console.log(`[REDDIT AUTH DEBUG] Making OAuth request to Reddit...`);
    
    const response = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      'grant_type=client_credentials',
      {
        auth: {
          username: clientId,
          password: clientSecret
        },
        headers: {
          'User-Agent': process.env.REDDIT_USER_AGENT || 'hrvstr/1.0.0',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log(`[REDDIT AUTH DEBUG] OAuth response status: ${response.status}`);
    console.log(`[REDDIT AUTH DEBUG] Token received, expires in: ${response.data.expires_in} seconds`);
    
    const token = response.data.access_token;
    const expiration = now + response.data.expires_in;
    
    // Cache the token
    accessTokenCache.set(cacheKey, token);
    tokenExpirationCache.set(cacheKey, expiration);
    
    return token;
  } catch (error) {
    console.error('[REDDIT AUTH ERROR] Error getting Reddit access token:', error.message);
    if (error.response) {
      console.error('[REDDIT AUTH ERROR] Response status:', error.response.status);
      console.error('[REDDIT AUTH ERROR] Response data:', error.response.data);
    }
    console.error('[REDDIT AUTH ERROR] Full error stack:', error.stack);
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
 * @param {string} options.userId - User ID for API key retrieval
 * @returns {Promise<Array>} Array of posts
 */
async function fetchSubredditPosts(subreddit, { limit = 25, sort = 'hot', time = 'week', userId = null } = {}) {
  try {
    console.log(`[REDDIT API DEBUG] Fetching ${limit} posts from r/${subreddit} (sort: ${sort}, time: ${time}, user: ${userId || 'system'})`);
    
    const token = await getAccessToken(userId);
    
    if (!token) {
      throw new Error('Failed to get access token');
    }
    
    const url = `https://oauth.reddit.com/r/${subreddit}/${sort}?limit=${limit}&t=${time}&raw_json=1`;
    console.log(`[REDDIT API DEBUG] Making request to: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': process.env.REDDIT_USER_AGENT || 'hrvstr/1.0.0'
      }
    });
    
    console.log(`[REDDIT API DEBUG] Response status: ${response.status} for r/${subreddit}`);
    console.log(`[REDDIT API DEBUG] Posts received: ${response.data?.data?.children?.length || 0} from r/${subreddit}`);
    
    if (response.data?.data?.children) {
      // Log some sample post titles for debugging
      const sampleTitles = response.data.data.children.slice(0, 3).map(post => post.data.title);
      console.log(`[REDDIT API DEBUG] Sample post titles from r/${subreddit}:`, sampleTitles);
    }
    
    return response.data.data.children;
  } catch (error) {
    console.error(`[REDDIT API ERROR] Error fetching posts from r/${subreddit}:`, error.message);
    if (error.response) {
      console.error(`[REDDIT API ERROR] Response status: ${error.response.status} for r/${subreddit}`);
      console.error(`[REDDIT API ERROR] Response data:`, error.response.data);
    }
    console.error(`[REDDIT API ERROR] Full error stack:`, error.stack);
    throw new Error(`Failed to fetch posts from r/${subreddit}`);
  }
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