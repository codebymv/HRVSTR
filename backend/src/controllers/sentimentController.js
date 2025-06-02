/**
 * Sentiment Controller
 * Handles business logic for sentiment analysis API endpoints
 */
const redditSentimentService = require('../services/redditSentimentService');
const finvizSentimentService = require('../services/finvizSentimentService');
const yahooSentimentService = require('../services/yahooSentimentService');
const aggregatedSentimentService = require('../services/aggregatedSentimentService');
const { getUserWatchlistTickers, limitTickersByTier } = require('../utils/watchlistUtils');
const { getUserTierInfo } = require('../middleware/tierMiddleware');

/**
 * Get ticker sentiment data from Reddit
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getRedditTickerSentiment(req, res, next) {
  try {
    const { timeRange = '1w' } = req.query;
    const userId = req.user?.id; // Get user ID from authenticated request
    
    // Get user's watchlist tickers
    let userTickers = await getUserWatchlistTickers(userId);
    
    // Get user tier and apply limits
    if (userId) {
      try {
        const tierInfo = await getUserTierInfo(userId);
        const userTier = tierInfo?.tier || 'free';
        userTickers = limitTickersByTier(userTickers, userTier);
        console.log(`[SENTIMENT CONTROLLER] Using ${userTickers.length} tickers for ${userTier} user: ${userTickers.join(', ')}`);
      } catch (tierError) {
        console.error('[SENTIMENT CONTROLLER] Error getting tier info:', tierError);
        // Continue with unlimited tickers on error
      }
    }
    
    const result = await redditSentimentService.getRedditTickerSentiment(timeRange, userId, userTickers);
    res.json(result);
  } catch (error) {
    console.error('Error fetching Reddit ticker sentiment:', error.message);
    next(error);
  }
}

/**
 * Get market sentiment data from Reddit
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getRedditMarketSentiment(req, res, next) {
  try {
    const { timeRange = '1w' } = req.query;
    const userId = req.user?.id; // Get user ID from authenticated request
    const result = await redditSentimentService.getRedditMarketSentiment(timeRange, userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching Reddit market sentiment:', error.message);
    next(error);
  }
}

/**
 * Get ticker sentiment data from Finviz
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getFinvizSentiment(req, res) {
  try {
    const { tickers } = req.query;
    const userId = req.user?.id;
    
    let targetTickers = tickers;
    
    // If no tickers specified, use user's watchlist
    if (!tickers) {
      const userTickers = await getUserWatchlistTickers(userId);
      
      // Apply tier limits
      if (userId) {
        try {
          const tierInfo = await getUserTierInfo(userId);
          const userTier = tierInfo?.tier || 'free';
          const limitedTickers = limitTickersByTier(userTickers, userTier);
          targetTickers = limitedTickers.join(',');
          console.log(`[SENTIMENT CONTROLLER] Using watchlist tickers for FinViz: ${targetTickers}`);
        } catch (tierError) {
          console.error('[SENTIMENT CONTROLLER] Error getting tier info:', tierError);
          targetTickers = userTickers.join(',');
        }
      } else {
        targetTickers = userTickers.join(',');
      }
    }
    
    if (!targetTickers) {
      return res.status(400).json({ error: 'No tickers available for analysis' });
    }
    
    const result = await finvizSentimentService.getFinvizTickerSentiment(targetTickers);
    res.json(result);
  } catch (error) {
    console.error('Finviz sentiment error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get ticker sentiment data from Yahoo Finance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getYahooSentiment(req, res) {
  try {
    const { tickers } = req.query;
    const userId = req.user?.id;
    
    let targetTickers = tickers;
    
    // If no tickers specified, use user's watchlist
    if (!tickers) {
      const userTickers = await getUserWatchlistTickers(userId);
      
      // Apply tier limits
      if (userId) {
        try {
          const tierInfo = await getUserTierInfo(userId);
          const userTier = tierInfo?.tier || 'free';
          const limitedTickers = limitTickersByTier(userTickers, userTier);
          targetTickers = limitedTickers.join(',');
          console.log(`[SENTIMENT CONTROLLER] Using watchlist tickers for Yahoo: ${targetTickers}`);
        } catch (tierError) {
          console.error('[SENTIMENT CONTROLLER] Error getting tier info:', tierError);
          targetTickers = userTickers.join(',');
        }
      } else {
        targetTickers = userTickers.join(',');
      }
    }
    
    if (!targetTickers) {
      return res.status(400).json({ error: 'No tickers available for analysis' });
    }
    
    const result = await yahooSentimentService.getYahooTickerSentiment(targetTickers);
    res.json(result);
  } catch (error) {
    console.error('Yahoo sentiment error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get market sentiment data from Yahoo Finance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getYahooMarketSentiment(req, res) {
  try {
    const result = await yahooSentimentService.getYahooMarketSentiment();
    res.json(result);
  } catch (error) {
    console.error('Yahoo market sentiment error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get aggregated sentiment data from multiple sources
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getAggregatedSentiment(req, res, next) {
  try {
    const { tickers, timeRange = '1w', sources = 'reddit,finviz' } = req.query;
    const userId = req.user?.id;
    
    let targetTickers = tickers;
    
    // If no tickers specified, use user's watchlist
    if (!tickers) {
      const userTickers = await getUserWatchlistTickers(userId);
      
      // Apply tier limits
      if (userId) {
        try {
          const tierInfo = await getUserTierInfo(userId);
          const userTier = tierInfo?.tier || 'free';
          const limitedTickers = limitTickersByTier(userTickers, userTier);
          targetTickers = limitedTickers.join(',');
          console.log(`[SENTIMENT CONTROLLER] Using watchlist tickers for aggregated sentiment: ${targetTickers}`);
        } catch (tierError) {
          console.error('[SENTIMENT CONTROLLER] Error getting tier info:', tierError);
          targetTickers = userTickers.join(',');
        }
      } else {
        targetTickers = userTickers.join(',');
      }
    }
    
    if (!targetTickers) {
      return res.status(400).json({ error: 'No tickers available for analysis' });
    }
    
    const sourcesList = sources.split(',');
    const result = await aggregatedSentimentService.getAggregatedSentiment(targetTickers, timeRange, sourcesList);
    res.json(result);
  } catch (error) {
    console.error('Error fetching aggregated sentiment:', error.message);
    next(error);
  }
}

module.exports = {
  getRedditTickerSentiment,
  getRedditMarketSentiment,
  getFinvizSentiment,
  getYahooSentiment,
  getYahooMarketSentiment,
  getAggregatedSentiment
};
