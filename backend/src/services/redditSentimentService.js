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
 * Analyze sentiment of Reddit posts for a specific ticker with enhanced Python integration
 * @param {string} ticker - Stock ticker symbol
 * @param {Array} posts - Array of Reddit posts
 * @returns {Promise<Object>} Sentiment analysis result
 */
async function analyzeTickerSentiment(ticker, posts) {
  console.log(`[REDDIT SENTIMENT DEBUG] Analyzing sentiment for ${ticker} with ${posts.length} total posts`);
  
  const tickerRegex = new RegExp(`\\b${ticker}\\b`, 'i');
  const relevantPosts = posts.filter(post => 
    tickerRegex.test(post.data.title) || 
    tickerRegex.test(post.data.selftext)
  );

  console.log(`[REDDIT SENTIMENT DEBUG] Found ${relevantPosts.length} relevant posts for ${ticker}`);

  if (relevantPosts.length === 0) {
    return sentimentUtils.formatSentimentData(
      ticker, 0, 0, 0, 'reddit', new Date().toISOString(), 0, 0
    );
  }

  // Prepare texts for batch analysis
  const texts = relevantPosts.map(post => `${post.data.title} ${post.data.selftext}`);
  const tickers = new Array(texts.length).fill(ticker);
  
  try {
    // Use enhanced batch sentiment analysis
    const sentimentResults = await sentimentUtils.analyzeBatchSentiment(texts, tickers, 'reddit', true);
    
    // Calculate averages
    const totalScore = sentimentResults.reduce((sum, result) => sum + (result.score || 0), 0);
    const totalConfidence = sentimentResults.reduce((sum, result) => sum + (result.confidence || 0), 0);
    
    const avgScore = sentimentResults.length > 0 ? totalScore / sentimentResults.length : 0;
    const avgConfidence = sentimentResults.length > 0 ? Math.round(totalConfidence / sentimentResults.length) : 0;
    
    // Check if any results used enhanced analysis
    const hasEnhanced = sentimentResults.some(result => result.enhanced);
    
    console.log(`[REDDIT SENTIMENT DEBUG] ${ticker}: avgScore=${avgScore}, avgConfidence=${avgConfidence}, posts=${relevantPosts.length}, enhanced=${hasEnhanced}`);
    
    // Use the enhanced formatSentimentData function with proper confidence
    const result = sentimentUtils.formatSentimentData(
      ticker,
      avgScore,
      relevantPosts.length, // postCount
      relevantPosts.reduce((sum, post) => sum + (post.data.num_comments || 0), 0), // commentCount
      'reddit',
      new Date().toISOString(),
      avgConfidence, // baseConfidence from sentiment analysis
      Math.round(Math.abs(avgScore) * 100) // strength as percentage
    );
    
    // Add enhanced analysis metadata if available
    if (hasEnhanced) {
      result.enhanced = true;
      result.enhancedMetrics = {
        finbertResults: sentimentResults.filter(r => r.finbert).length,
        vaderResults: sentimentResults.filter(r => r.vader).length,
        entitiesExtracted: sentimentResults.reduce((sum, r) => sum + (r.words?.length || 0), 0)
      };
    }
    
    return result;
    
  } catch (error) {
    console.error(`[REDDIT SENTIMENT ERROR] Enhanced analysis failed for ${ticker}:`, error.message);
    
    // Fallback to basic analysis
    const sentimentScores = [];
    const sentimentConfidences = [];
    let totalScore = 0;
    let totalConfidence = 0;
    
    for (const post of relevantPosts) {
      const text = `${post.data.title} ${post.data.selftext}`;
      const sentimentResult = sentimentUtils.analyzeSentimentBasic(text);
      
      const score = sentimentResult.comparative || 0;
      const confidence = sentimentResult.confidence || 0;
      
      sentimentScores.push(score);
      sentimentConfidences.push(confidence);
      totalScore += score;
      totalConfidence += confidence;
    }

    const avgScore = relevantPosts.length > 0 ? totalScore / relevantPosts.length : 0;
    const avgConfidence = relevantPosts.length > 0 ? Math.round(totalConfidence / relevantPosts.length) : 0;
    
    console.log(`[REDDIT SENTIMENT DEBUG] ${ticker} (fallback): avgScore=${avgScore}, avgConfidence=${avgConfidence}, posts=${relevantPosts.length}`);
    
    return sentimentUtils.formatSentimentData(
      ticker,
      avgScore,
      relevantPosts.length,
      relevantPosts.reduce((sum, post) => sum + (post.data.num_comments || 0), 0),
      'reddit',
      new Date().toISOString(),
      avgConfidence,
      Math.round(Math.abs(avgScore) * 100)
    );
  }
}

async function getRedditTickerSentiment(timeRange = '1w', userId = null, userTickers = null) {
  const ttl = selectTtl(timeRange);
  const cacheKey = `reddit-ticker-sentiment-${timeRange}-${userId || 'system'}-${userTickers ? userTickers.join(',') : 'default'}`;

  return cacheManager.getOrFetch(cacheKey, 'reddit-sentiment', async () => {
    console.log(`[REDDIT SENTIMENT DEBUG] Fetching real Reddit ticker sentiment data for ${timeRange} (user: ${userId || 'system'})`);
    
    try {
      // Fetch posts from relevant subreddits
      const subreddits = ['stocks', 'wallstreetbets', 'investing', 'StockMarket'];
      const allPosts = [];
      
      console.log(`[REDDIT SENTIMENT DEBUG] Starting to fetch from ${subreddits.length} subreddits...`);
      
      // Fetch posts from each subreddit in parallel with optimized limits
      await Promise.all(subreddits.map(async subreddit => {
        try {
          console.log(`[REDDIT SENTIMENT DEBUG] Fetching posts from r/${subreddit}...`);
          
          // 🔧 OPTIMIZATION: Dynamic post limits based on timeRange for better data quality
          let postLimit;
          switch(timeRange) {
            case '1d': postLimit = 25; break;  // Focus on recent hot posts
            case '3d': postLimit = 50; break;  // Balanced recent activity
            case '1w': postLimit = 75; break;  // Comprehensive weekly view
            default: postLimit = 50; break;
          }
          
          const posts = await redditUtils.fetchSubredditPosts(subreddit, { 
            limit: postLimit, 
            time: timeRange === '1d' ? 'day' : timeRange === '3d' ? 'week' : 'week',
            sort: timeRange === '1d' ? 'hot' : 'top', // Use 'top' for longer timeframes
            userId: userId
          });
          console.log(`[REDDIT SENTIMENT DEBUG] Fetched ${posts.length} posts from r/${subreddit} (limit: ${postLimit})`);
          allPosts.push(...posts);
        } catch (error) {
          console.error(`[REDDIT SENTIMENT ERROR] Error fetching posts from r/${subreddit}:`, error.message);
          console.error(`[REDDIT SENTIMENT ERROR] Full error:`, error);
        }
      }));
      
      console.log(`[REDDIT SENTIMENT DEBUG] Total posts collected: ${allPosts.length}`);
      
      if (allPosts.length === 0) {
        console.error('[REDDIT SENTIMENT ERROR] No posts found in any subreddit - this might indicate API authentication issues');
        throw new Error('No posts found in any subreddit');
      }
      
      // Use user-provided tickers or fall back to default popular tickers
      const tickers = userTickers && userTickers.length > 0 
        ? userTickers 
        : ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'TSLA', 'NVDA', 'AMD', 'META', 'SPY', 'QQQ'];
      
      const sentimentData = [];
      
      console.log(`[REDDIT SENTIMENT DEBUG] Analyzing sentiment for ${tickers.length} ${userTickers ? 'user watchlist' : 'default'} tickers: ${tickers.join(', ')}`);
      
      for (const ticker of tickers) {
        try {
          const analysis = await analyzeTickerSentiment(ticker, allPosts);
          if (analysis.postCount > 0) {
            sentimentData.push(analysis);
            console.log(`[REDDIT SENTIMENT DEBUG] Added sentiment data for ${ticker}: score=${analysis.score}, posts=${analysis.postCount}, enhanced=${analysis.enhanced || false}`);
          } else {
            console.log(`[REDDIT SENTIMENT DEBUG] No posts found for ${ticker}, skipping`);
          }
        } catch (error) {
          console.error(`[REDDIT SENTIMENT ERROR] Error analyzing sentiment for ${ticker}:`, error.message);
        }
      }
      
      console.log(`[REDDIT SENTIMENT DEBUG] Final sentiment data count: ${sentimentData.length}`);
      
      const result = { 
        sentimentData,
        meta: {
          totalPosts: allPosts.length,
          uniqueTickers: sentimentData.length,
          sources: subreddits,
          timeRange,
          userTickers: userTickers ? true : false,
          tickersAnalyzed: tickers
        }
      };
      
      console.log(`[REDDIT SENTIMENT DEBUG] Returning result:`, JSON.stringify(result, null, 2));
      
      return result;
      
    } catch (error) {
      console.error('[REDDIT SENTIMENT ERROR] Error in getRedditTickerSentiment:', error.message);
      console.error('[REDDIT SENTIMENT ERROR] Full error stack:', error.stack);
      throw new Error(`Failed to fetch Reddit sentiment data: ${error.message}`);
    }
  }, ttl);
}

async function getRedditMarketSentiment(timeRange = '1w', userId = null) {
  const ttl = selectTtl(timeRange);
  const cacheKey = `reddit-market-sentiment-${timeRange}-${userId || 'system'}`;
  
  return cacheManager.getOrFetch(cacheKey, 'reddit-sentiment', async () => {
    console.log(`Fetching real Reddit market sentiment data for ${timeRange} (user: ${userId || 'system'})`);
    
    try {
      // Define subreddits to analyze
      const subreddits = ['stocks', 'wallstreetbets', 'investing', 'StockMarket'];
      const allPosts = [];
      
      // Fetch posts from each subreddit in parallel
      await Promise.all(subreddits.map(async subreddit => {
        try {
          const posts = await redditUtils.fetchSubredditPosts(subreddit, { 
            limit: 100, 
            time: timeRange === '1d' ? 'day' : timeRange === '3d' ? 'week' : 'week',
            sort: timeRange === '1d' ? 'hot' : 'top',
            userId: userId
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
        case '3d':
          startDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
          intervalMs = 3 * 60 * 60 * 1000; // 3 hours
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
          const sentimentResult = sentimentUtils.analyzeSentiment(text);
          // Use comparative score for consistency
          const score = sentimentResult.comparative || 0;
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
          
          // Debug: Log actual sentiment score distribution
          const scoresAbove15 = bucket.sentimentScores.filter(s => s > 0.15).length;
          const scoresBelow15 = bucket.sentimentScores.filter(s => s < -0.15).length;
          const scoresBetween = totalPosts - scoresAbove15 - scoresBelow15;
          console.log(`Bucket ${bucket.start.toISOString()}: ${totalPosts} posts, ${scoresAbove15} bullish (>0.15), ${scoresBelow15} bearish (<-0.15), ${scoresBetween} neutral`);
          
          // Sample some scores for debugging
          if (bucket.sentimentScores.length > 0) {
            const sampleScores = bucket.sentimentScores.slice(0, 5);
            console.log(`Sample scores:`, sampleScores);
          }
          
          // Use the same sentiment classification logic as formatSentimentData
          // This ensures consistency between ticker and market sentiment
          let bullCount = 0;
          let bearCount = 0;
          let neutCount = 0;
          
          bucket.sentimentScores.forEach(score => {
            if (score > 0.15) {          // Same threshold as formatSentimentData
              bullCount++;
            } else if (score < -0.15) {   // Same threshold as formatSentimentData
              bearCount++;
            } else {
              neutCount++;
            }
          });
          
          // Convert to percentages
          const bull = bullCount / totalPosts;
          const bear = bearCount / totalPosts;
          const neut = neutCount / totalPosts;
          
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