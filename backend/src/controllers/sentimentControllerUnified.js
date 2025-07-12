/**
 * Unified Sentiment Controller
 * Implements three-tier caching architecture: Session → Cache → Fresh API
 * Follows the exact pattern from SEC filings and earnings controllers
 */
const userSentimentCacheService = require('../services/userSentimentCacheService');
const { getUserTierInfo } = require('../middleware/tierMiddleware');
const { getUserWatchlistTickers, limitTickersByTier } = require('../utils/watchlistUtils');
const aiExplanationService = require('../services/aiExplanationService');
const aiRedditAnalysisService = require('../services/aiRedditAnalysisService');
const aiTickerAnalysisService = require('../services/aiTickerAnalysisService');

/**
 * Enrich sentiment data with AI explanations
 * @param {Array} sentimentArray - Array of sentiment data objects
 * @param {string} userTier - User's tier level
 * @returns {Promise<Array>} - Enriched sentiment data with AI explanations
 */
async function enrichSentimentWithAI(sentimentArray, userTier) {
  try {
    // Only add AI explanations for Pro+ users to create upgrade incentive
    const shouldAddAI = userTier !== 'free';
    
    if (!shouldAddAI || !Array.isArray(sentimentArray)) {
      return sentimentArray;
    }

    // Process top 5 sentiment items to control costs
    const itemsToProcess = sentimentArray.slice(0, 5);
    const enrichedItems = [];

    for (const item of itemsToProcess) {
      try {
        const explanation = await aiExplanationService.explainSentiment(item);
        enrichedItems.push({
          ...item,
          aiExplanation: explanation
        });
      } catch (error) {
        console.error(`❌ Failed to generate AI explanation for ${item.ticker}:`, error);
        enrichedItems.push(item); // Keep original item if AI fails
      }
    }

    // Return enriched items + remaining items without AI explanations
    const remainingItems = sentimentArray.slice(5);
    return [...enrichedItems, ...remainingItems];

  } catch (error) {
    console.error('❌ Error enriching sentiment with AI:', error);
    return sentimentArray; // Return original data if enrichment fails
  }
}

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
    
    // Use unified cache service with session-based approach
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      'scores', // Component name for research_sessions - unified under scores
      'reddit_tickers',
      timeRange,
      options,
      (progressData) => {
        // Progress callback for streaming updates
        console.log(`[SENTIMENT UNIFIED] Reddit tickers progress: ${progressData.progress}% - ${progressData.stage}`);
      }
    );
    
    // Debug and enrich with AI explanations
    console.log('🔍 [AI DEBUG] Full result structure:', {
      success: result.success,
      hasData: !!result.data,
      dataType: typeof result.data,
      dataLength: Array.isArray(result.data) ? result.data.length : 'not array',
      resultKeys: Object.keys(result)
    });
    
    // Extract the actual sentiment array from nested structure
    const sentimentArray = result.data?.data?.sentimentData;
    
    if (result.success && sentimentArray && Array.isArray(sentimentArray)) {
      console.log(`🤖 Enriching ${sentimentArray.length} Reddit sentiments with AI explanations...`);
      const enrichedSentiments = await enrichSentimentWithAI(sentimentArray, userTier);
      
      // Put the enriched data back into the nested structure
      result.data.data.sentimentData = enrichedSentiments;
    } else {
      console.log('⚠️ [AI DEBUG] Skipping Reddit AI enrichment - no valid sentiment array found', {
        hasResultData: !!result.data,
        hasNestedData: !!result.data?.data,
        hasSentimentData: !!result.data?.data?.sentimentData,
        isArray: Array.isArray(result.data?.data?.sentimentData)
      });
    }
    
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
    
    // Use unified cache service with session-based approach
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      'scores', // Component name for research_sessions - unified under scores
      'reddit_market',
      timeRange,
      options,
      (progressData) => {
        console.log(`[SENTIMENT UNIFIED] Reddit market progress: ${progressData.progress}% - ${progressData.stage}`);
      }
    );
    
    // Debug: Log the exact structure being returned
    console.log('🔍 [REDDIT MARKET DEBUG] Controller result structure:', {
      success: result.success,
      hasData: !!result.data,
      dataKeys: result.data ? Object.keys(result.data) : 'no data',
      dataType: typeof result.data,
      fromCache: result.cached,
      resultKeys: Object.keys(result)
    });
    
    if (result.data) {
      console.log('🔍 [REDDIT MARKET DEBUG] Data content preview:', {
        hasTimestamps: !!result.data.timestamps,
        hasBullish: !!result.data.bullish,
        hasPosts: !!result.data.posts,
        hasSentimentData: !!result.data.sentimentData,
        dataStructure: Object.keys(result.data)
      });
    }
    
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
    
    // Use unified cache service with session-based approach
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      'scores', // Component name for research_sessions - unified under scores
      'yahoo_tickers',
      timeRange,
      options,
      (progressData) => {
        console.log(`[SENTIMENT UNIFIED] Yahoo tickers progress: ${progressData.progress}% - ${progressData.stage}`);
      }
    );
    
    // Debug and enrich with AI explanations
    console.log('🔍 [AI DEBUG] Yahoo result structure:', {
      success: result.success,
      hasData: !!result.data,
      dataType: typeof result.data,
      dataLength: Array.isArray(result.data) ? result.data.length : 'not array',
      resultKeys: Object.keys(result)
    });
    
    // Deep debug of result.data structure
    if (result.data) {
      console.log('🔍 [AI DEBUG] result.data contents:', {
        dataKeys: Object.keys(result.data),
        dataType: typeof result.data,
        isArray: Array.isArray(result.data),
        dataStructure: result.data
      });
    }
    
    // Extract the actual sentiment array from nested structure
    const sentimentArray = result.data?.data?.sentimentData;
    
    if (result.success && sentimentArray && Array.isArray(sentimentArray)) {
      console.log(`🤖 Enriching ${sentimentArray.length} Yahoo sentiments with AI explanations...`);
      const enrichedSentiments = await enrichSentimentWithAI(sentimentArray, userTier);
      
      // Put the enriched data back into the nested structure
      result.data.data.sentimentData = enrichedSentiments;
    } else {
      console.log('⚠️ [AI DEBUG] Skipping Yahoo AI enrichment - no valid sentiment array found', {
        hasResultData: !!result.data,
        hasNestedData: !!result.data?.data,
        hasSentimentData: !!result.data?.data?.sentimentData,
        isArray: Array.isArray(result.data?.data?.sentimentData)
      });
    }
    
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
    
    // Use unified cache service with session-based approach
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      'scores', // Component name for research_sessions - unified under scores
      'yahoo_market',
      timeRange,
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
    
    // Use unified cache service with session-based approach
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      'scores', // Component name for research_sessions - unified under scores
      'finviz_tickers',
      timeRange,
      options,
      (progressData) => {
        console.log(`[SENTIMENT UNIFIED] Finviz tickers progress: ${progressData.progress}% - ${progressData.stage}`);
      }
    );
    
    // Extract the actual sentiment array from nested structure
    const sentimentArray = result.data?.data?.sentimentData;
    
    if (result.success && sentimentArray && Array.isArray(sentimentArray)) {
      console.log(`🤖 Enriching ${sentimentArray.length} Finviz sentiments with AI explanations...`);
      const enrichedSentiments = await enrichSentimentWithAI(sentimentArray, userTier);
      
      // Put the enriched data back into the nested structure
      result.data.data.sentimentData = enrichedSentiments;
    } else {
      console.log('⚠️ [AI DEBUG] Skipping Finviz AI enrichment - no valid sentiment array found', {
        hasResultData: !!result.data,
        hasNestedData: !!result.data?.data,
        hasSentimentData: !!result.data?.data?.sentimentData,
        isArray: Array.isArray(result.data?.data?.sentimentData)
      });
    }
    
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
    
    // Use unified cache service with session-based approach
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      'scores', // Component name for research_sessions - unified under scores
      'finviz_market',
      timeRange,
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
    
    // Use unified cache service with session-based approach
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      'scores', // Component name for research_sessions - unified under scores
      'combined_tickers',
      timeRange,
      options,
      (progressData) => {
        console.log(`[SENTIMENT UNIFIED] Combined tickers progress: ${progressData.progress}% - ${progressData.stage}`);
      }
    );
    
    // Extract the actual sentiment array from nested structure
    const sentimentArray = result.data?.data?.sentimentData;
    
    if (result.success && sentimentArray && Array.isArray(sentimentArray)) {
      console.log(`🤖 Enriching ${sentimentArray.length} Combined sentiments with AI explanations...`);
      const enrichedSentiments = await enrichSentimentWithAI(sentimentArray, userTier);
      
      // Put the enriched data back into the nested structure
      result.data.data.sentimentData = enrichedSentiments;
    } else {
      console.log('⚠️ [AI DEBUG] Skipping Combined AI enrichment - no valid sentiment array found', {
        hasResultData: !!result.data,
        hasNestedData: !!result.data?.data,
        hasSentimentData: !!result.data?.data?.sentimentData,
        isArray: Array.isArray(result.data?.data?.sentimentData)
      });
    }
    
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
    
    // Use unified cache service with session-based approach
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      'scores', // Component name for research_sessions - unified under scores
      'aggregated_market',
      timeRange,
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
    
    // Use unified cache service with streaming callback and session-based approach
    const componentName = userSentimentCacheService.SENTIMENT_CACHE_CONFIG.COMPONENT_MAPPING[dataType] || 'sentimentScores';
    const result = await userSentimentCacheService.getSentimentDataForUser(
      userId,
      componentName, // Component name for research_sessions
      dataType,
      timeRange,
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

/**
 * Analyze a Reddit post with AI to explain its sentiment contribution
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function analyzeRedditPost(req, res) {
  try {
    const userId = req.user?.id;
    const { post } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for AI analysis'
      });
    }
    
    if (!post || !post.title || !post.content) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Post data with title and content is required'
      });
    }
    
    // Import credit middleware functions
    const { getUserCredits, calculateCreditCost, hasFeatureAccess } = require('../middleware/premiumCreditMiddleware');
    
    // Get user's credit balance and tier info
    const creditBalance = await getUserCredits(userId);
    const userTier = creditBalance.tier?.toLowerCase() || 'free';
    
    // Check if user has access to AI analysis feature
    if (!hasFeatureAccess('ai_reddit_analysis', userTier)) {
      return res.status(403).json({
        success: false,
        error: 'FEATURE_NOT_AVAILABLE',
        message: 'AI Reddit post analysis feature is not available in your tier',
        upgradeRequired: true,
        feature: 'ai_reddit_analysis'
      });
    }
    
    // Calculate credit cost for AI analysis
    const creditCost = calculateCreditCost('ai_reddit_analysis', userTier);
    
    // Check if user has sufficient credits
    if (creditBalance.remaining < creditCost) {
      return res.status(402).json({
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        message: `Insufficient credits for AI analysis. Required: ${creditCost}, Available: ${creditBalance.remaining}`,
        creditInfo: {
          required: creditCost,
          available: creditBalance.remaining,
          action: 'ai_reddit_analysis'
        }
      });
    }
    
    console.log(`🤖 Analyzing Reddit post for ${userTier} user: "${post.title.substring(0, 50)}..." (Cost: ${creditCost} credits)`);
    
    // Begin transaction for atomic credit deduction
    const { pool } = require('../config/data-sources');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Deduct credits
      await client.query(`
        UPDATE users 
        SET credits_used = credits_used + $1
        WHERE id = $2
      `, [creditCost, userId]);
      
      // Log the transaction
      await client.query(`
        INSERT INTO credit_transactions (
          user_id, 
          action, 
          credits_used, 
          credits_remaining, 
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        userId,
        'ai_reddit_analysis',
        creditCost,
        creditBalance.remaining - creditCost,
        JSON.stringify({
          post_title: post.title.substring(0, 100),
          tier: userTier,
          original_cost: 1,
          final_cost: creditCost
        }),
        new Date().toISOString()
      ]);
      
      // Analyze the post with AI
      const analysis = await aiRedditAnalysisService.analyzeRedditPost(post);
      
      await client.query('COMMIT');
      
      console.log(`💳 Credits deducted: ${creditCost} for AI Reddit analysis (User: ${userId})`);
      
      res.json({
        success: true,
        data: {
          analysis,
          model: 'Gemini 1.5 Flash',
          timestamp: new Date().toISOString()
        },
        creditInfo: {
          used: creditCost,
          remaining: creditBalance.remaining - creditCost
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error analyzing Reddit post:', error);
    res.status(500).json({
      success: false,
      error: 'ANALYSIS_ERROR',
      message: 'Failed to analyze Reddit post',
      userMessage: 'An error occurred while analyzing the post. Please try again.'
    });
  }
}

/**
 * Analyze a ticker's sentiment data with AI on-demand (with caching)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function analyzeTickerSentiment(req, res) {
  try {
    const userId = req.user?.id;
    const { sentimentData, forceRefresh = false } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for AI analysis'
      });
    }
    
    if (!sentimentData || !sentimentData.ticker) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Sentiment data with ticker is required'
      });
    }
    
    // Import credit middleware functions and AI analysis service
    const { getUserCredits, calculateCreditCost, hasFeatureAccess } = require('../middleware/premiumCreditMiddleware');
    const { analyzeTickerSentiment: aiAnalyzeTickerSentiment } = require('../services/aiTickerAnalysisService');
    
    // Get user's credit balance and tier info
    const creditBalance = await getUserCredits(userId);
    const userTier = creditBalance.tier?.toLowerCase() || 'free';
    
    // Check if user has access to AI analysis feature
    if (!hasFeatureAccess('ai_ticker_analysis', userTier)) {
      return res.status(403).json({
        success: false,
        error: 'FEATURE_NOT_AVAILABLE',
        message: 'AI sentiment analysis feature is not available in your tier',
        upgradeRequired: true,
        feature: 'ai_ticker_analysis'
      });
    }
    
    console.log(`🤖 Processing AI ticker analysis request for ${sentimentData.ticker} (user: ${userId}, tier: ${userTier})`);
    
    // Use the cached AI analysis service
    const analysisResult = await aiAnalyzeTickerSentiment(sentimentData, userId, userTier, forceRefresh);
    
    // Handle the response format (either cached or fresh)
    if (analysisResult.analysis) {
      // New cached format
      const analysis = analysisResult.analysis;
      const metadata = analysisResult.metadata || {};
      
      return res.json({
        success: true,
        data: {
          analysis,
          model: 'Gemini 1.5 Flash',
          timestamp: new Date().toISOString(),
          ...metadata
        },
        creditInfo: {
          used: metadata.creditsUsed || 0,
          remaining: creditBalance.remaining - (metadata.creditsUsed || 0),
          fromCache: metadata.fromCache || false,
          hasActiveSession: metadata.hasActiveSession || false
        }
      });
    } else {
      // Fallback to old format if needed
      const analysis = analysisResult;
      
      // Only charge credits if this is a fresh analysis (not cached)
      const creditCost = calculateCreditCost('ai_ticker_analysis', userTier);
      
      return res.json({
        success: true,
        data: {
          analysis,
          model: 'Gemini 1.5 Flash',
          timestamp: new Date().toISOString()
        },
        creditInfo: {
          used: creditCost,
          remaining: creditBalance.remaining - creditCost
        }
      });
    }
    
    console.log(`🤖 Analyzing ticker sentiment for ${userTier} user: ${sentimentData.ticker} (Cost: ${creditCost} credits)`);
    
    // Begin transaction for atomic credit deduction
    const { pool } = require('../config/data-sources');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Deduct credits
      await client.query(`
        UPDATE users 
        SET credits_used = credits_used + $1
        WHERE id = $2
      `, [creditCost, userId]);
      
      // Log the transaction
      await client.query(`
        INSERT INTO credit_transactions (
          user_id, 
          action, 
          credits_used, 
          credits_remaining, 
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        userId,
        'ai_ticker_analysis',
        creditCost,
        creditBalance.remaining - creditCost,
        JSON.stringify({
          ticker: sentimentData.ticker,
          tier: userTier,
          original_cost: 1,
          final_cost: creditCost
        }),
        new Date().toISOString()
      ]);
      
      // Analyze the sentiment data with AI
      const analysis = await aiTickerAnalysisService.analyzeTickerSentiment(sentimentData);
      
      await client.query('COMMIT');
      
      console.log(`💳 Credits deducted: ${creditCost} for AI ticker analysis (User: ${userId})`);
      
      res.json({
        success: true,
        data: {
          analysis,
          ticker: sentimentData.ticker,
          model: 'Gemini 1.5 Flash',
          timestamp: new Date().toISOString()
        },
        creditInfo: {
          used: creditCost,
          remaining: creditBalance.remaining - creditCost
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error analyzing ticker sentiment:', error);
    res.status(500).json({
      success: false,
      error: 'ANALYSIS_ERROR',
      message: 'Failed to analyze ticker sentiment',
      userMessage: 'An error occurred while analyzing the sentiment. Please try again.'
    });
  }
}

/**
 * Analyze market sentiment chart data with AI for a given time period
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function analyzeMarketSentimentChart(req, res) {
  try {
    const userId = req.user?.id;
    const { chartData, timeRange, sentimentContext } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for AI analysis'
      });
    }
    
    if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Chart data is required for analysis'
      });
    }
    
    // Import credit middleware functions
    const { getUserCredits, calculateCreditCost, hasFeatureAccess } = require('../middleware/premiumCreditMiddleware');
    
    // Get user's credit balance and tier info
    const creditBalance = await getUserCredits(userId);
    const userTier = creditBalance.tier?.toLowerCase() || 'free';
    
    // Check if user has access to AI analysis feature
    if (!hasFeatureAccess('ai_market_analysis', userTier)) {
      return res.status(403).json({
        success: false,
        error: 'FEATURE_NOT_AVAILABLE',
        message: 'AI market analysis feature is not available in your tier',
        upgradeRequired: true,
        feature: 'ai_market_analysis'
      });
    }
    
    // Calculate credit cost for AI analysis (slightly higher for chart analysis)
    const creditCost = calculateCreditCost('ai_market_analysis', userTier);
    
    // Check if user has sufficient credits
    if (creditBalance.remaining < creditCost) {
      return res.status(402).json({
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        message: `Insufficient credits for AI analysis. Required: ${creditCost}, Available: ${creditBalance.remaining}`,
        creditInfo: {
          required: creditCost,
          available: creditBalance.remaining,
          action: 'ai_market_analysis'
        }
      });
    }
    
    console.log(`🤖 Analyzing market sentiment chart for ${userTier} user over ${timeRange} (Cost: ${creditCost} credits)`);
    
    // Begin transaction for atomic credit deduction
    const { pool } = require('../config/data-sources');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Deduct credits
      await client.query(`
        UPDATE users 
        SET credits_used = credits_used + $1
        WHERE id = $2
      `, [creditCost, userId]);
      
      // Log the transaction
      await client.query(`
        INSERT INTO credit_transactions (
          user_id, 
          action, 
          credits_used, 
          credits_remaining, 
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        userId,
        'ai_market_analysis',
        creditCost,
        creditBalance.remaining - creditCost,
        JSON.stringify({
          timeRange,
          dataPoints: chartData.length,
          tier: userTier,
          original_cost: 1,
          final_cost: creditCost
        }),
        new Date().toISOString()
      ]);
      
      // Create market sentiment analysis service if not exists
      const aiMarketAnalysisService = require('../services/aiMarketAnalysisService');
      
      // Analyze the chart data with AI
      const analysis = await aiMarketAnalysisService.analyzeMarketChart({
        chartData,
        timeRange,
        context: sentimentContext
      });
      
      await client.query('COMMIT');
      
      console.log(`💳 Credits deducted: ${creditCost} for AI market chart analysis (User: ${userId})`);
      
      res.json({
        success: true,
        data: {
          analysis,
          timeRange,
          dataPoints: chartData.length,
          model: 'Gemini 1.5 Flash',
          timestamp: new Date().toISOString()
        },
        creditInfo: {
          used: creditCost,
          remaining: creditBalance.remaining - creditCost
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error analyzing market sentiment chart:', error);
    res.status(500).json({
      success: false,
      error: 'ANALYSIS_ERROR',
      message: 'Failed to analyze market sentiment chart',
      userMessage: 'An error occurred while analyzing the chart. Please try again.'
    });
  }
}

/**
 * Analyze ticker sentiment chart data with AI for selected tickers over time period (with caching)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function analyzeTickerSentimentChart(req, res) {
  try {
    const userId = req.user?.id;
    const { chartData, selectedTickers, timeRange, sentimentContext, forceRefresh = false } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for AI analysis'
      });
    }
    
    if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Chart data is required for analysis'
      });
    }
    
    if (!selectedTickers || !Array.isArray(selectedTickers) || selectedTickers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Selected tickers are required for ticker analysis'
      });
    }
    
    // Import credit middleware functions and chart analysis service
    const { getUserCredits, calculateCreditCost, hasFeatureAccess } = require('../middleware/premiumCreditMiddleware');
    const { analyzeTickerSentimentChart: aiAnalyzeChart } = require('../services/sentimentChartAnalysisService');
    
    // Get user's credit balance and tier info
    const creditBalance = await getUserCredits(userId);
    const userTier = creditBalance.tier?.toLowerCase() || 'free';
    
    // Check if user has access to AI analysis feature
    if (!hasFeatureAccess('ai_ticker_chart_analysis', userTier)) {
      return res.status(403).json({
        success: false,
        error: 'FEATURE_NOT_AVAILABLE',
        message: 'AI ticker chart analysis feature is not available in your tier',
        upgradeRequired: true,
        feature: 'ai_ticker_chart_analysis'
      });
    }
    
    console.log(`🤖 Processing AI chart analysis request for ${selectedTickers.join(', ')} over ${timeRange} (user: ${userId}, tier: ${userTier})`);
    
    // Prepare chart data for analysis
    const chartAnalysisData = {
      tickers: selectedTickers,
      timeRange: timeRange || '1w',
      dataPoints: chartData,
      totalDataPoints: chartData.length,
      viewMode: 'ticker',
      context: sentimentContext
    };
    
    // Use the cached AI analysis service
    const analysisResult = await aiAnalyzeChart(chartAnalysisData, userId, userTier, forceRefresh);
    
    // Handle the response format (either cached or fresh)
    if (analysisResult.analysis) {
      // New cached format
      const analysis = analysisResult.analysis;
      const metadata = analysisResult.metadata || {};
      
      return res.json({
        success: true,
        data: {
          analysis,
          model: 'Gemini 1.5 Flash',
          timestamp: new Date().toISOString(),
          tickers: selectedTickers,
          timeRange,
          dataPoints: chartData.length,
          ...metadata
        },
        creditInfo: {
          used: metadata.creditsUsed || 0,
          remaining: creditBalance.remaining - (metadata.creditsUsed || 0),
          fromCache: metadata.fromCache || false,
          hasActiveSession: metadata.hasActiveSession || false
        }
      });
    } else {
      // Fallback to old format if needed
      const analysis = analysisResult;
      
      // Only charge credits if this is a fresh analysis (not cached)
      const baseCreditCost = calculateCreditCost('ai_ticker_chart_analysis', userTier);
      const tickerMultiplier = Math.min(selectedTickers.length, 5);
      const creditCost = baseCreditCost * tickerMultiplier;
      
      return res.json({
        success: true,
        data: {
          analysis,
          model: 'Gemini 1.5 Flash',
          timestamp: new Date().toISOString(),
          tickers: selectedTickers,
          timeRange,
          dataPoints: chartData.length
        },
        creditInfo: {
          used: creditCost,
          remaining: creditBalance.remaining - creditCost
        }
      });
    }
    
    try {
      await client.query('BEGIN');
      
      // Deduct credits
      await client.query(`
        UPDATE users 
        SET credits_used = credits_used + $1
        WHERE id = $2
      `, [creditCost, userId]);
      
      // Log the transaction
      await client.query(`
        INSERT INTO credit_transactions (
          user_id, 
          action, 
          credits_used, 
          credits_remaining, 
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        userId,
        'ai_ticker_chart_analysis',
        creditCost,
        creditBalance.remaining - creditCost,
        JSON.stringify({
          tickers: selectedTickers,
          timeRange,
          dataPoints: chartData.length,
          tier: userTier,
          original_cost: baseCreditCost,
          final_cost: creditCost,
          ticker_multiplier: tickerMultiplier
        }),
        new Date().toISOString()
      ]);
      
      // Create ticker chart analysis service if not exists
      const aiTickerChartAnalysisService = require('../services/aiTickerChartAnalysisService');
      
      // Analyze the ticker chart data with AI
      const analysis = await aiTickerChartAnalysisService.analyzeTickerChart({
        chartData,
        selectedTickers,
        timeRange,
        context: sentimentContext
      });
      
      await client.query('COMMIT');
      
      console.log(`💳 Credits deducted: ${creditCost} for AI ticker chart analysis (User: ${userId})`);
      
      res.json({
        success: true,
        data: {
          analysis,
          tickers: selectedTickers,
          timeRange,
          dataPoints: chartData.length,
          model: 'Gemini 1.5 Flash',
          timestamp: new Date().toISOString()
        },
        creditInfo: {
          used: creditCost,
          remaining: creditBalance.remaining - creditCost
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[SENTIMENT UNIFIED] Error analyzing ticker sentiment chart:', error);
    res.status(500).json({
      success: false,
      error: 'ANALYSIS_ERROR',
      message: 'Failed to analyze ticker sentiment chart',
      userMessage: 'An error occurred while analyzing the chart. Please try again.'
    });
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
  streamSentimentDataWithCache,
  
  // AI analysis endpoints
  analyzeRedditPost,
  analyzeTickerSentiment,
  analyzeMarketSentimentChart,
  analyzeTickerSentimentChart
};