/**
 * Unified Sentiment Controller
 * Implements three-tier caching architecture: Session → Cache → Fresh API
 * Follows the exact pattern from SEC filings and earnings controllers
 */
const userSentimentCacheService = require('../services/userSentimentCacheService');
const { getUserTierInfo } = require('../middleware/tierMiddleware');
const { getUserWatchlistTickers, limitTickersByTier } = require('../utils/watchlistUtils');

/**
 * Get Reddit ticker sentiment with unified caching
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getRedditTickerSentimentWithCache(req, res) {
  try {
    const userId = req.user?.id;
    const { timeRange = '1w', refresh = 'false', tickers } = req.query;
    const forceRefresh = refresh === 'true';
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for sentiment data'
      });
    }
    
    // Get user tier info
    const tierInfo = await getUserTierInfo(userId);
    const userTier = tierInfo?.tier || 'free';
    
    // Get user's watchlist tickers or use provided tickers
    let targetTickers = tickers ? tickers.split(',') : await getUserWatchlistTickers(userId);
    
    // Apply tier limits
    targetTickers = limitTickersByTier(targetTickers, userTier);
    console.log(`[SENTIMENT UNIFIED] Reddit tickers for ${userTier} user: ${targetTickers.join(', ')}`);
    
    // Prepare options for cache service
    const options = {
      tickers: targetTickers,
      subreddits: ['wallstreetbets', 'stocks', 'investing', 'SecurityAnalysis'],
      limit: userSentimentCacheService.getDataLimit(userTier, 'reddit_tickers')
    };
    
    // Use unified cache service
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      userTier,
      'reddit_tickers',
      timeRange,
      forceRefresh,
      options,
      (progressData) => {
        // Progress callback for streaming updates
        console.log(`[SENTIMENT UNIFIED] Reddit tickers progress: ${progressData.progress}% - ${progressData.stage}`);
      }
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error getting Reddit ticker sentiment:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch Reddit ticker sentiment',
      userMessage: 'An error occurred while fetching sentiment data. Please try again.'
    });
  }
}

/**
 * Get Reddit market sentiment with unified caching
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getRedditMarketSentimentWithCache(req, res) {
  try {
    const userId = req.user?.id;
    const { timeRange = '1w', refresh = 'false' } = req.query;
    const forceRefresh = refresh === 'true';
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for sentiment data'
      });
    }
    
    // Get user tier info
    const tierInfo = await getUserTierInfo(userId);
    const userTier = tierInfo?.tier || 'free';
    
    // Prepare options for cache service
    const options = {
      subreddits: ['wallstreetbets', 'stocks', 'investing', 'SecurityAnalysis', 'StockMarket'],
      limit: userSentimentCacheService.getDataLimit(userTier, 'reddit_market')
    };
    
    // Use unified cache service
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      userTier,
      'reddit_market',
      timeRange,
      forceRefresh,
      options,
      (progressData) => {
        console.log(`[SENTIMENT UNIFIED] Reddit market progress: ${progressData.progress}% - ${progressData.stage}`);
      }
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error getting Reddit market sentiment:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch Reddit market sentiment',
      userMessage: 'An error occurred while fetching market sentiment data. Please try again.'
    });
  }
}

/**
 * Get Yahoo ticker sentiment with unified caching
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getYahooTickerSentimentWithCache(req, res) {
  try {
    const userId = req.user?.id;
    const { timeRange = '1w', refresh = 'false', tickers } = req.query;
    const forceRefresh = refresh === 'true';
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for sentiment data'
      });
    }
    
    // Get user tier info
    const tierInfo = await getUserTierInfo(userId);
    const userTier = tierInfo?.tier || 'free';
    
    // Get user's watchlist tickers or use provided tickers
    let targetTickers = tickers ? tickers.split(',') : await getUserWatchlistTickers(userId);
    
    // Apply tier limits
    targetTickers = limitTickersByTier(targetTickers, userTier);
    console.log(`[SENTIMENT UNIFIED] Yahoo tickers for ${userTier} user: ${targetTickers.join(', ')}`);
    
    // Prepare options for cache service
    const options = {
      tickers: targetTickers,
      limit: userSentimentCacheService.getDataLimit(userTier, 'yahoo_tickers')
    };
    
    // Use unified cache service
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      userTier,
      'yahoo_tickers',
      timeRange,
      forceRefresh,
      options,
      (progressData) => {
        console.log(`[SENTIMENT UNIFIED] Yahoo tickers progress: ${progressData.progress}% - ${progressData.stage}`);
      }
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error getting Yahoo ticker sentiment:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch Yahoo ticker sentiment',
      userMessage: 'An error occurred while fetching sentiment data. Please try again.'
    });
  }
}

/**
 * Get Yahoo market sentiment with unified caching
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getYahooMarketSentimentWithCache(req, res) {
  try {
    const userId = req.user?.id;
    const { timeRange = '1w', refresh = 'false' } = req.query;
    const forceRefresh = refresh === 'true';
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for sentiment data'
      });
    }
    
    // Get user tier info
    const tierInfo = await getUserTierInfo(userId);
    const userTier = tierInfo?.tier || 'free';
    
    // Prepare options for cache service
    const options = {
      limit: userSentimentCacheService.getDataLimit(userTier, 'yahoo_market')
    };
    
    // Use unified cache service
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      userTier,
      'yahoo_market',
      timeRange,
      forceRefresh,
      options,
      (progressData) => {
        console.log(`[SENTIMENT UNIFIED] Yahoo market progress: ${progressData.progress}% - ${progressData.stage}`);
      }
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error getting Yahoo market sentiment:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch Yahoo market sentiment',
      userMessage: 'An error occurred while fetching market sentiment data. Please try again.'
    });
  }
}

/**
 * Get Finviz ticker sentiment with unified caching
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getFinvizTickerSentimentWithCache(req, res) {
  try {
    const userId = req.user?.id;
    const { timeRange = '1w', refresh = 'false', tickers } = req.query;
    const forceRefresh = refresh === 'true';
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for sentiment data'
      });
    }
    
    // Get user tier info
    const tierInfo = await getUserTierInfo(userId);
    const userTier = tierInfo?.tier || 'free';
    
    // Get user's watchlist tickers or use provided tickers
    let targetTickers = tickers ? tickers.split(',') : await getUserWatchlistTickers(userId);
    
    // Apply tier limits
    targetTickers = limitTickersByTier(targetTickers, userTier);
    console.log(`[SENTIMENT UNIFIED] Finviz tickers for ${userTier} user: ${targetTickers.join(', ')}`);
    
    // Prepare options for cache service
    const options = {
      tickers: targetTickers,
      limit: userSentimentCacheService.getDataLimit(userTier, 'finviz_tickers')
    };
    
    // Use unified cache service
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      userTier,
      'finviz_tickers',
      timeRange,
      forceRefresh,
      options,
      (progressData) => {
        console.log(`[SENTIMENT UNIFIED] Finviz tickers progress: ${progressData.progress}% - ${progressData.stage}`);
      }
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error getting Finviz ticker sentiment:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch Finviz ticker sentiment',
      userMessage: 'An error occurred while fetching sentiment data. Please try again.'
    });
  }
}

/**
 * Get Finviz market sentiment with unified caching
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getFinvizMarketSentimentWithCache(req, res) {
  try {
    const userId = req.user?.id;
    const { timeRange = '1w', refresh = 'false' } = req.query;
    const forceRefresh = refresh === 'true';
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for sentiment data'
      });
    }
    
    // Get user tier info
    const tierInfo = await getUserTierInfo(userId);
    const userTier = tierInfo?.tier || 'free';
    
    // Prepare options for cache service
    const options = {
      limit: userSentimentCacheService.getDataLimit(userTier, 'finviz_market')
    };
    
    // Use unified cache service
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      userTier,
      'finviz_market',
      timeRange,
      forceRefresh,
      options,
      (progressData) => {
        console.log(`[SENTIMENT UNIFIED] Finviz market progress: ${progressData.progress}% - ${progressData.stage}`);
      }
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error getting Finviz market sentiment:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch Finviz market sentiment',
      userMessage: 'An error occurred while fetching market sentiment data. Please try again.'
    });
  }
}

/**
 * Get combined ticker sentiment from multiple sources with unified caching
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getCombinedTickerSentimentWithCache(req, res) {
  try {
    const userId = req.user?.id;
    const { timeRange = '1w', refresh = 'false', tickers, sources = 'reddit,yahoo,finviz' } = req.query;
    const forceRefresh = refresh === 'true';
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for sentiment data'
      });
    }
    
    // Get user tier info
    const tierInfo = await getUserTierInfo(userId);
    const userTier = tierInfo?.tier || 'free';
    
    // Get user's watchlist tickers or use provided tickers
    let targetTickers = tickers ? tickers.split(',') : await getUserWatchlistTickers(userId);
    
    // Apply tier limits
    targetTickers = limitTickersByTier(targetTickers, userTier);
    console.log(`[SENTIMENT UNIFIED] Combined tickers for ${userTier} user: ${targetTickers.join(', ')}`);
    
    // Prepare options for cache service
    const options = {
      tickers: targetTickers,
      sources: sources.split(','),
      limit: userSentimentCacheService.getDataLimit(userTier, 'combined_tickers')
    };
    
    // Use unified cache service
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      userTier,
      'combined_tickers',
      timeRange,
      forceRefresh,
      options,
      (progressData) => {
        console.log(`[SENTIMENT UNIFIED] Combined tickers progress: ${progressData.progress}% - ${progressData.stage}`);
      }
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error getting combined ticker sentiment:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch combined ticker sentiment',
      userMessage: 'An error occurred while fetching sentiment data. Please try again.'
    });
  }
}

/**
 * Get aggregated market sentiment from multiple sources with unified caching
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getAggregatedMarketSentimentWithCache(req, res) {
  try {
    const userId = req.user?.id;
    const { timeRange = '1w', refresh = 'false', sources = 'reddit,yahoo,finviz' } = req.query;
    const forceRefresh = refresh === 'true';
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for sentiment data'
      });
    }
    
    // Get user tier info
    const tierInfo = await getUserTierInfo(userId);
    const userTier = tierInfo?.tier || 'free';
    
    // Prepare options for cache service
    const options = {
      sources: sources.split(','),
      limit: userSentimentCacheService.getDataLimit(userTier, 'aggregated_market')
    };
    
    // Use unified cache service
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      userTier,
      'aggregated_market',
      timeRange,
      forceRefresh,
      options,
      (progressData) => {
        console.log(`[SENTIMENT UNIFIED] Aggregated market progress: ${progressData.progress}% - ${progressData.stage}`);
      }
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error getting aggregated market sentiment:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch aggregated market sentiment',
      userMessage: 'An error occurred while fetching market sentiment data. Please try again.'
    });
  }
}

/**
 * Get user's sentiment cache status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUserSentimentCacheStatus(req, res) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }
    
    const result = await userSentimentCacheService.getUserSentimentCacheStatus(userId);
    res.json(result);
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error getting cache status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache status'
    });
  }
}

/**
 * Clear user's sentiment cache
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function clearUserSentimentCache(req, res) {
  try {
    const userId = req.user?.id;
    const { dataType, timeRange } = req.query;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }
    
    const success = await userSentimentCacheService.clearUserSentimentCache(userId, dataType, timeRange);
    
    res.json({
      success,
      message: success ? 'Cache cleared successfully' : 'Failed to clear cache'
    });
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
}

/**
 * Get sentiment data with streaming progress updates (SSE)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function streamSentimentDataWithCache(req, res) {
  try {
    const userId = req.user?.id;
    const { dataType, timeRange = '1w', refresh = 'false' } = req.query;
    const forceRefresh = refresh === 'true';
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for sentiment data'
      });
    }
    
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Get user tier info
    const tierInfo = await getUserTierInfo(userId);
    const userTier = tierInfo?.tier || 'free';
    
    // Get user's watchlist tickers for ticker-based requests
    let options = {};
    if (dataType.includes('tickers')) {
      const targetTickers = await getUserWatchlistTickers(userId);
      const limitedTickers = limitTickersByTier(targetTickers, userTier);
      options.tickers = limitedTickers;
    }
    
    // Set up progress callback for streaming updates
    const progressCallback = (progressData) => {
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        ...progressData
      })}\n\n`);
    };
    
    // Use unified cache service with streaming callback
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      userTier,
      dataType,
      timeRange,
      forceRefresh,
      options,
      progressCallback
    );
    
    // Send final result
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      ...result
    })}\n\n`);
    
    res.end();
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error streaming sentiment data:', error);
    
    // Send error via SSE
    res.write(`data: ${JSON.stringify({
      type: 'error',
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch sentiment data',
      userMessage: 'An error occurred while fetching sentiment data. Please try again.'
    })}\n\n`);
    
    res.end();
  }
}

module.exports = {
  // Ticker sentiment endpoints
  getRedditTickerSentimentWithCache,
  getYahooTickerSentimentWithCache,
  getFinvizTickerSentimentWithCache,
  getCombinedTickerSentimentWithCache,
  
  // Market sentiment endpoints
  getRedditMarketSentimentWithCache,
  getYahooMarketSentimentWithCache,
  getFinvizMarketSentimentWithCache,
  getAggregatedMarketSentimentWithCache,
  
  // Cache management endpoints
  getUserSentimentCacheStatus,
  clearUserSentimentCache,
  
  // Streaming endpoint
  streamSentimentDataWithCache
}; 