const redditUtils = require('../utils/reddit');
const sentimentUtils = require('../utils/sentiment');
const cacheManager = require('../utils/cacheManager');
const axios = require('axios');

// Rate limit: 20 requests per minute
cacheManager.registerRateLimit('reddit-sentiment', 20, 60);

function selectTtl(range) {
  switch (range) {
    case '1d': return 30 * 60;    // 30 minutes
    case '1w': return 60 * 60;     // 1 hour
    case '1m': return 3 * 60 * 60; // 3 hours
    case '3m': return 6 * 60 * 60; // 6 hours
    default: return 60 * 60;       // 1 hour
  }
}

/**
 * Analyze sentiment of Reddit posts for a specific ticker
 * @param {string} ticker - Stock ticker symbol
 * @param {Array} posts - Array of Reddit posts
 * @returns {Object} Sentiment analysis result
 */
function analyzeTickerSentiment(ticker, posts) {
  const tickerRegex = new RegExp(`\\b${ticker}\\b`, 'i');
  const relevantPosts = posts.filter(post => 
    tickerRegex.test(post.data.title) || 
    tickerRegex.test(post.data.selftext)
  );

  const sentimentScores = [];
  let totalScore = 0;
  
  relevantPosts.forEach(post => {
    const text = `${post.data.title} ${post.data.selftext}`;
    const score = sentimentUtils.analyzeSentiment(text);
    sentimentScores.push(score);
    totalScore += score;
  });

  const avgScore = relevantPosts.length > 0 ? totalScore / relevantPosts.length : 0.5;
  
  // Calculate confidence based on number of relevant posts
  const confidence = Math.min(100, Math.round((relevantPosts.length / posts.length) * 200));
  
  return {
    ticker,
    score: avgScore,
    sentiment: avgScore > 0.6 ? 'bullish' : avgScore < 0.4 ? 'bearish' : 'neutral',
    source: 'reddit',
    timestamp: new Date().toISOString(),
    postCount: relevantPosts.length,
    commentCount: relevantPosts.reduce((sum, post) => sum + (post.data.num_comments || 0), 0),
    confidence
  };
}

async function getRedditTickerSentiment(timeRange = '1w') {
  const ttl = selectTtl(timeRange);
  const cacheKey = `reddit-ticker-sentiment-${timeRange}`;

  return cacheManager.getOrFetch(cacheKey, 'reddit-sentiment', async () => {
    console.log(`Fetching real Reddit ticker sentiment data for ${timeRange}`);
    
    try {
      // Fetch posts from relevant subreddits
      const subreddits = ['stocks', 'wallstreetbets', 'investing', 'StockMarket'];
      const allPosts = [];
      
      // Fetch posts from each subreddit in parallel
      await Promise.all(subreddits.map(async subreddit => {
        try {
          const posts = await redditUtils.fetchSubredditPosts(subreddit, { 
            limit: 50, 
            time: timeRange === '1d' ? 'day' : 'week' 
          });
          allPosts.push(...posts);
        } catch (error) {
          console.error(`Error fetching posts from r/${subreddit}:`, error.message);
        }
      }));
      
      if (allPosts.length === 0) {
        throw new Error('No posts found in any subreddit');
      }
      
      // Analyze sentiment for each ticker
      const tickers = ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'TSLA', 'NVDA', 'AMD', 'META', 'SPY', 'QQQ'];
      const sentimentData = [];
      
      for (const ticker of tickers) {
        try {
          const analysis = analyzeTickerSentiment(ticker, allPosts);
          if (analysis.postCount > 0) {
            sentimentData.push(analysis);
          }
        } catch (error) {
          console.error(`Error analyzing sentiment for ${ticker}:`, error.message);
        }
      }
      
      return { 
        sentimentData,
        meta: {
          totalPosts: allPosts.length,
          uniqueTickers: sentimentData.length,
          sources: subreddits,
          timeRange
        }
      };
      
    } catch (error) {
      console.error('Error in getRedditTickerSentiment:', error.message);
      throw new Error('Failed to fetch Reddit sentiment data');
    }
  }, ttl);
}

async function getRedditMarketSentiment(timeRange = '1w') {
  const ttl = selectTtl(timeRange);
  const cacheKey = `reddit-market-sentiment-${timeRange}`;
  
  return cacheManager.getOrFetch(cacheKey, 'reddit-sentiment', async () => {
    console.log(`Fetching real Reddit market sentiment data for ${timeRange}`);
    
    try {
      // Define subreddits to analyze
      const subreddits = ['stocks', 'wallstreetbets', 'investing', 'StockMarket'];
      const allPosts = [];
      
      // Fetch posts from each subreddit in parallel
      await Promise.all(subreddits.map(async subreddit => {
        try {
          const posts = await redditUtils.fetchSubredditPosts(subreddit, { 
            limit: 100, 
            time: timeRange === '1d' ? 'day' : 'week',
            sort: timeRange === '1d' ? 'hot' : 'top'
          });
          allPosts.push(...posts);
        } catch (error) {
          console.error(`Error fetching posts from r/${subreddit}:`, error.message);
        }
      }));
      
      if (allPosts.length === 0) {
        throw new Error('No posts found in any subreddit');
      }
      
      // Group posts by time interval
      const now = new Date();
      let intervalMs, startDate;
      
      switch(timeRange) {
        case '1d':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          intervalMs = 60 * 60 * 1000; // 1 hour
          break;
        case '1w':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          intervalMs = 6 * 60 * 60 * 1000; // 6 hours
          break;
        case '1m':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          intervalMs = 24 * 60 * 60 * 1000; // 1 day
          break;
        case '3m':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          intervalMs = 3 * 24 * 60 * 60 * 1000; // 3 days
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          intervalMs = 6 * 60 * 60 * 1000; // 6 hours
      }
      
      // Initialize time buckets
      const buckets = [];
      for (let t = startDate.getTime(); t <= now.getTime(); t += intervalMs) {
        buckets.push({
          start: new Date(t),
          end: new Date(t + intervalMs),
          posts: [],
          sentimentScores: []
        });
      }
      
      // Categorize posts into time buckets and analyze sentiment
      allPosts.forEach(post => {
        const postDate = new Date(post.data.created_utc * 1000);
        const bucket = buckets.find(b => postDate >= b.start && postDate < b.end);
        
        if (bucket) {
          bucket.posts.push(post);
          const text = `${post.data.title} ${post.data.selftext}`;
          const score = sentimentUtils.analyzeSentiment(text);
          bucket.sentimentScores.push(score);
        }
      });
      
      // Calculate sentiment distribution for each time bucket
      const timestamps = [];
      const bullish = [];
      const bearish = [];
      const neutral = [];
      const total = [];
      
      buckets.forEach(bucket => {
        if (bucket.posts.length > 0) {
          const totalPosts = bucket.sentimentScores.length;
          const bull = bucket.sentimentScores.filter(s => s > 0.6).length / totalPosts;
          const bear = bucket.sentimentScores.filter(s => s < 0.4).length / totalPosts;
          const neut = 1 - bull - bear;
          
          timestamps.push(bucket.start.toISOString());
          bullish.push(bull);
          bearish.push(bear);
          neutral.push(neut);
          total.push(totalPosts);
        }
      });
      
      return {
        timestamps,
        bullish,
        bearish,
        neutral,
        total,
        meta: {
          source: 'reddit',
          timeRange,
          lastUpdated: now.toISOString(),
          totalPosts: allPosts.length,
          subreddits
        }
      };
      
    } catch (error) {
      console.error('Error in getRedditMarketSentiment:', error.message);
      throw new Error('Failed to fetch Reddit market sentiment data');
    }
  }, ttl);
}

module.exports = { getRedditTickerSentiment, getRedditMarketSentiment };