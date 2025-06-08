const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const sentimentController = require('../controllers/sentimentControllerUnified');

/**
 * Unified Sentiment Routes
 * Implements three-tier caching architecture: Session → Cache → Fresh API
 * All routes require authentication and follow the same pattern as SEC/earnings
 */

// ===== TICKER SENTIMENT ROUTES =====

/**
 * @route GET /api/sentiment-unified/reddit/tickers
 * @desc Get Reddit ticker sentiment with unified caching
 * @access Private (requires authentication)
 * @query {string} timeRange - Time range (1d, 3d, 1w, 1m, 3m, 6m)
 * @query {string} refresh - Force refresh (true/false)
 * @query {string} tickers - Comma-separated ticker list (optional, uses watchlist if not provided)
 */
router.get('/reddit/tickers', authenticateToken, sentimentController.getRedditTickerSentimentWithCache);

/**
 * @route GET /api/sentiment-unified/yahoo/tickers
 * @desc Get Yahoo ticker sentiment with unified caching
 * @access Private (requires authentication)
 * @query {string} timeRange - Time range (1d, 3d, 1w, 1m, 3m, 6m)
 * @query {string} refresh - Force refresh (true/false)
 * @query {string} tickers - Comma-separated ticker list (optional, uses watchlist if not provided)
 */
router.get('/yahoo/tickers', authenticateToken, sentimentController.getYahooTickerSentimentWithCache);

/**
 * @route GET /api/sentiment-unified/finviz/tickers
 * @desc Get Finviz ticker sentiment with unified caching
 * @access Private (requires authentication)
 * @query {string} timeRange - Time range (1d, 3d, 1w, 1m, 3m, 6m)
 * @query {string} refresh - Force refresh (true/false)
 * @query {string} tickers - Comma-separated ticker list (optional, uses watchlist if not provided)
 */
router.get('/finviz/tickers', authenticateToken, sentimentController.getFinvizTickerSentimentWithCache);

/**
 * @route GET /api/sentiment-unified/combined/tickers
 * @desc Get combined ticker sentiment from multiple sources with unified caching
 * @access Private (requires authentication)
 * @query {string} timeRange - Time range (1d, 3d, 1w, 1m, 3m, 6m)
 * @query {string} refresh - Force refresh (true/false)
 * @query {string} tickers - Comma-separated ticker list (optional, uses watchlist if not provided)
 * @query {string} sources - Comma-separated source list (reddit,yahoo,finviz)
 */
router.get('/combined/tickers', authenticateToken, sentimentController.getCombinedTickerSentimentWithCache);

// ===== MARKET SENTIMENT ROUTES =====

/**
 * @route GET /api/sentiment-unified/reddit/market
 * @desc Get Reddit market sentiment with unified caching
 * @access Private (requires authentication)
 * @query {string} timeRange - Time range (1d, 3d, 1w, 1m, 3m, 6m)
 * @query {string} refresh - Force refresh (true/false)
 */
router.get('/reddit/market', authenticateToken, sentimentController.getRedditMarketSentimentWithCache);

/**
 * @route GET /api/sentiment-unified/yahoo/market
 * @desc Get Yahoo market sentiment with unified caching
 * @access Private (requires authentication)
 * @query {string} timeRange - Time range (1d, 3d, 1w, 1m, 3m, 6m)
 * @query {string} refresh - Force refresh (true/false)
 */
router.get('/yahoo/market', authenticateToken, sentimentController.getYahooMarketSentimentWithCache);

/**
 * @route GET /api/sentiment-unified/finviz/market
 * @desc Get Finviz market sentiment with unified caching
 * @access Private (requires authentication)
 * @query {string} timeRange - Time range (1d, 3d, 1w, 1m, 3m, 6m)
 * @query {string} refresh - Force refresh (true/false)
 */
router.get('/finviz/market', authenticateToken, sentimentController.getFinvizMarketSentimentWithCache);

/**
 * @route GET /api/sentiment-unified/aggregated/market
 * @desc Get aggregated market sentiment from multiple sources with unified caching
 * @access Private (requires authentication)
 * @query {string} timeRange - Time range (1d, 3d, 1w, 1m, 3m, 6m)
 * @query {string} refresh - Force refresh (true/false)
 * @query {string} sources - Comma-separated source list (reddit,yahoo,finviz)
 */
router.get('/aggregated/market', authenticateToken, sentimentController.getAggregatedMarketSentimentWithCache);

// ===== STREAMING ROUTES =====

/**
 * @route GET /api/sentiment-unified/stream
 * @desc Get sentiment data with real-time progress updates (Server-Sent Events)
 * @access Private (requires authentication)
 * @query {string} dataType - Data type (reddit_tickers, yahoo_tickers, etc.)
 * @query {string} timeRange - Time range (1d, 3d, 1w, 1m, 3m, 6m)
 * @query {string} refresh - Force refresh (true/false)
 */
router.get('/stream', authenticateToken, sentimentController.streamSentimentDataWithCache);

// ===== CACHE MANAGEMENT ROUTES =====

/**
 * @route GET /api/sentiment-unified/cache/status
 * @desc Get user's sentiment cache status
 * @access Private (requires authentication)
 */
router.get('/cache/status', authenticateToken, sentimentController.getUserSentimentCacheStatus);

/**
 * @route DELETE /api/sentiment-unified/cache
 * @desc Clear user's sentiment cache
 * @access Private (requires authentication)
 * @query {string} dataType - Optional: specific data type to clear
 * @query {string} timeRange - Optional: specific time range to clear
 */
router.delete('/cache', authenticateToken, sentimentController.clearUserSentimentCache);

// ===== AI ANALYSIS ROUTES =====

/**
 * @route POST /api/sentiment-unified/reddit/analyze-post
 * @desc Analyze a Reddit post with AI to explain its sentiment contribution
 * @access Private (requires authentication, Pro+ tier)
 * @body {object} post - Reddit post object with title, content, upvotes, etc.
 */
router.post('/reddit/analyze-post', authenticateToken, sentimentController.analyzeRedditPost);

/**
 * @route POST /api/sentiment-unified/ticker/analyze
 * @desc Analyze a ticker's sentiment data with AI on-demand
 * @access Private (requires authentication, Pro+ tier)
 * @body {object} sentimentData - Ticker sentiment data object
 */
router.post('/ticker/analyze', authenticateToken, sentimentController.analyzeTickerSentiment);

/**
 * @route POST /api/sentiment-unified/chart/market/analyze
 * @desc Analyze market sentiment chart data with AI for a given time period
 * @access Private (requires authentication, Pro+ tier)
 * @body {array} chartData - Chart data points array
 * @body {string} timeRange - Time range (1d, 3d, 1w)
 * @body {object} sentimentContext - Additional context for analysis
 */
router.post('/chart/market/analyze', authenticateToken, sentimentController.analyzeMarketSentimentChart);

/**
 * @route POST /api/sentiment-unified/chart/ticker/analyze
 * @desc Analyze ticker sentiment chart data with AI for selected tickers over time period
 * @access Private (requires authentication, Pro+ tier)
 * @body {array} chartData - Chart data points array
 * @body {array} selectedTickers - Array of selected ticker symbols
 * @body {string} timeRange - Time range (1d, 3d, 1w)
 * @body {object} sentimentContext - Additional context for analysis
 */
router.post('/chart/ticker/analyze', authenticateToken, sentimentController.analyzeTickerSentimentChart);

// ===== LEGACY COMPATIBILITY ROUTES =====
// These routes provide backward compatibility with the old sentiment API
// while internally using the new unified caching system

/**
 * @route GET /api/sentiment-unified/legacy/yahoo/tickers
 * @desc Legacy Yahoo ticker sentiment endpoint with unified caching
 * @access Private (requires authentication)
 * @deprecated Use /yahoo/tickers instead
 */
router.get('/legacy/yahoo/tickers', authenticateToken, (req, res, next) => {
  console.log('🔄 [SENTIMENT LEGACY] Redirecting Yahoo tickers request to unified system');
  sentimentController.getYahooTickerSentimentWithCache(req, res, next);
});

/**
 * @route GET /api/sentiment-unified/legacy/reddit/tickers
 * @desc Legacy Reddit ticker sentiment endpoint with unified caching
 * @access Private (requires authentication)
 * @deprecated Use /reddit/tickers instead
 */
router.get('/legacy/reddit/tickers', authenticateToken, (req, res, next) => {
  console.log('🔄 [SENTIMENT LEGACY] Redirecting Reddit tickers request to unified system');
  sentimentController.getRedditTickerSentimentWithCache(req, res, next);
});

// ===== HEALTH CHECK ROUTE =====

/**
 * @route GET /api/sentiment-unified/health
 * @desc Health check for sentiment unified system
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'sentiment-unified',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: {
      sessionBasedUnlocking: true,
      userSpecificCaching: true,
      freshApiFetching: true,
      streamingUpdates: true,
      tierBasedLimits: true,
      creditManagement: true
    }
  });
});

module.exports = router; 