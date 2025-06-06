/**
 * SEC Controller Refactored - Clean HTTP endpoint handlers using specialized components
 */

// Import specialized components
const secAuthManager = require('../utils/auth/secAuthManager');
const secCacheManager = require('../utils/cache/secCacheManager');
const secErrorHandler = require('../utils/errors/secErrorHandler');
const secResponseFormatter = require('../utils/formatters/secResponseFormatter');
const secStreamManager = require('../utils/streaming/secStreamManager');
const secDataAnalyzer = require('../services/analysis/secDataAnalyzer');

// Legacy services
const secService = require('../services/secService');
const userSecCacheService = require('../services/userSecCacheService');

/**
 * Get insider trades data from SEC
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getInsiderTrades(req, res, next) {
  try {
    const { timeRange = '1m', limit = 100, refresh = 'false' } = req.query;
    
    // Validate access
    const authResult = secAuthManager.validateSecAccess(req, 'insider_trades');
    if (!authResult.success) {
      return res.status(secErrorHandler.ERROR_STATUS_CODES[authResult.error] || 403)
        .json(authResult);
    }

    const { userId, userTier } = authResult;

    let result;
    if (userId) {
      result = await userSecCacheService.getSecDataForUser(
        userId, 
        userTier, 
        'insider_trades', 
        timeRange, 
        refresh === 'true'
      );

      if (!result.success) {
        const errorResponse = secErrorHandler.handleError(new Error(result.message), {
          endpoint: req.path,
          userId,
          operation: 'getInsiderTrades'
        });
        return res.status(errorResponse.statusCode).json(errorResponse);
      }

      const formattedResponse = secResponseFormatter.formatInsiderTradesResponse(
        result.data.insiderTrades || [],
        { timeRange, limit, includeAnalysis: userTier !== 'free' }
      );

      return res.json(formattedResponse);
    }

    // Legacy fallback
    const serviceResult = await secService.getInsiderTrades(timeRange, parseInt(limit));
    
    if (!serviceResult.success) {
      const errorResponse = secErrorHandler.handleError(
        new Error(serviceResult.message || 'Failed to fetch insider trades'),
        { endpoint: req.path, operation: 'getInsiderTrades' }
      );
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    const formattedResponse = secResponseFormatter.formatInsiderTradesResponse(
      serviceResult.data || [],
      { timeRange, limit }
    );

    res.json(formattedResponse);

  } catch (error) {
    const errorResponse = secErrorHandler.handleError(error, {
      endpoint: req.path,
      userId: req.user?.id,
      operation: 'getInsiderTrades'
    });
    res.status(errorResponse.statusCode).json(errorResponse);
  }
}

/**
 * Get insider trades for specific ticker
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getInsiderTradesByTicker(req, res, next) {
  try {
    const { ticker } = req.params;
    const { timeRange = '1m', limit = 50 } = req.query;

    // Validate ticker parameter
    if (!ticker || ticker.length < 1 || ticker.length > 10) {
      const error = secErrorHandler.createValidationError('ticker', 'Invalid ticker symbol', ticker);
      const errorResponse = secErrorHandler.handleError(error, {
        endpoint: req.path,
        operation: 'getInsiderTradesByTicker'
      });
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Validate access
    const authResult = secAuthManager.validateSecAccess(req, 'insider_trades');
    if (!authResult.success) {
      return res.status(secErrorHandler.ERROR_STATUS_CODES[authResult.error] || 403)
        .json(authResult);
    }

    // Fetch data
    const allTrades = await secService.fetchInsiderTrades(timeRange, parseInt(limit) * 2);
    const tickerTrades = allTrades.filter(trade => 
      trade.ticker && trade.ticker.toUpperCase() === ticker.toUpperCase()
    );

    // Format response
    const formattedResponse = secResponseFormatter.formatInsiderTradesResponse(
      tickerTrades.slice(0, parseInt(limit)),
      { 
        timeRange, 
        limit,
        ticker: ticker.toUpperCase(),
        includeAnalysis: authResult.userTier !== 'free'
      }
    );

    res.json(formattedResponse);

  } catch (error) {
    const errorResponse = secErrorHandler.handleError(error, {
      endpoint: req.path,
      userId: req.user?.id,
      operation: 'getInsiderTradesByTicker'
    });
    res.status(errorResponse.statusCode).json(errorResponse);
  }
}

/**
 * Get institutional holdings data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getInstitutionalHoldings(req, res, next) {
  try {
    const { timeRange = '1m', limit = 50, refresh = 'false' } = req.query;
    
    // Validate access (institutional data requires higher tier)
    const authResult = secAuthManager.validateSecAccess(req, 'institutional_holdings');
    if (!authResult.success) {
      return res.status(secErrorHandler.ERROR_STATUS_CODES[authResult.error] || 403)
        .json(authResult);
    }

    const { userId, userTier } = authResult;

    // Use user-specific cache service
    const result = await userSecCacheService.getSecDataForUser(
      userId, 
      userTier, 
      'institutional_holdings', 
      timeRange, 
      refresh === 'true'
    );

    if (!result.success) {
      const errorResponse = secErrorHandler.handleError(new Error(result.message), {
        endpoint: req.path,
        userId,
        operation: 'getInstitutionalHoldings'
      });
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Format response
    const formattedResponse = secResponseFormatter.formatInstitutionalHoldingsResponse(
      result.data.institutionalHoldings || [],
      { timeRange, includeChanges: userTier === 'premium' }
    );

    res.json(formattedResponse);

  } catch (error) {
    const errorResponse = secErrorHandler.handleError(error, {
      endpoint: req.path,
      userId: req.user?.id,
      operation: 'getInstitutionalHoldings'
    });
    res.status(errorResponse.statusCode).json(errorResponse);
  }
}

/**
 * Get abnormal activity analysis
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getAbnormalActivity(req, res, next) {
  try {
    const { timeRange = '1w', minScore = 0.5 } = req.query;
    
    // Validate access (abnormal activity requires higher tier)
    const authResult = secAuthManager.validateSecAccess(req, 'abnormal_activity');
    if (!authResult.success) {
      return res.status(secErrorHandler.ERROR_STATUS_CODES[authResult.error] || 403)
        .json(authResult);
    }

    // Get insider trades data for analysis
    const tradesResult = await secService.getInsiderTrades(timeRange, 1000);
    if (!tradesResult.success) {
      const errorResponse = secErrorHandler.handleError(
        new Error('Failed to fetch trades for analysis'),
        { endpoint: req.path, operation: 'getAbnormalActivity' }
      );
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Analyze for abnormal patterns
    const analysis = secDataAnalyzer.analyzeAbnormalActivity(tradesResult.data, {
      scoreThreshold: parseFloat(minScore)
    });

    // Format response
    const formattedResponse = secResponseFormatter.formatAbnormalActivityResponse(
      analysis.abnormalTrades,
      { timeRange, minScore, includeDetails: authResult.userTier === 'premium' }
    );

    res.json(formattedResponse);

  } catch (error) {
    const errorResponse = secErrorHandler.handleError(error, {
      endpoint: req.path,
      userId: req.user?.id,
      operation: 'getAbnormalActivity'
    });
    res.status(errorResponse.statusCode).json(errorResponse);
  }
}

/**
 * Get filing details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getFilingDetails(req, res, next) {
  try {
    const { ticker, formType = 'all', limit = 20 } = req.query;

    // Validate access
    const authResult = secAuthManager.validateSecAccess(req, 'filing_details');
    if (!authResult.success) {
      return res.status(secErrorHandler.ERROR_STATUS_CODES[authResult.error] || 403)
        .json(authResult);
    }

    // Fetch filing details
    const filings = await secService.getFilingDetails(ticker, formType, parseInt(limit));

    // Format response
    const formattedResponse = secResponseFormatter.formatFilingDetailsResponse(
      filings,
      { 
        ticker, 
        formType, 
        includeContent: authResult.userTier === 'premium' 
      }
    );

    res.json(formattedResponse);

  } catch (error) {
    const errorResponse = secErrorHandler.handleError(error, {
      endpoint: req.path,
      userId: req.user?.id,
      operation: 'getFilingDetails'
    });
    res.status(errorResponse.statusCode).json(errorResponse);
  }
}

/**
 * Get ticker summary
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getTickerSummary(req, res, next) {
  try {
    const { ticker } = req.params;
    const { timeRange = '1m' } = req.query;

    // Validate ticker
    if (!ticker || ticker.length < 1) {
      const error = secErrorHandler.createValidationError('ticker', 'Ticker is required', ticker);
      const errorResponse = secErrorHandler.handleError(error, {
        endpoint: req.path,
        operation: 'getTickerSummary'
      });
      return res.status(errorResponse.statusCode).json(errorResponse);
    }

    // Validate access
    const authResult = secAuthManager.validateSecAccess(req, 'ticker_summary');
    if (!authResult.success) {
      return res.status(secErrorHandler.ERROR_STATUS_CODES[authResult.error] || 403)
        .json(authResult);
    }

    // Fetch summary data
    const summary = await secService.getTickerSummary(ticker, timeRange);

    // Format response
    const formattedResponse = secResponseFormatter.formatTickerSummaryResponse(
      summary,
      { 
        timeRange, 
        includeHistory: authResult.userTier !== 'free' 
      }
    );

    res.json(formattedResponse);

  } catch (error) {
    const errorResponse = secErrorHandler.handleError(error, {
      endpoint: req.path,
      userId: req.user?.id,
      operation: 'getTickerSummary'
    });
    res.status(errorResponse.statusCode).json(errorResponse);
  }
}

/**
 * Stream insider trades data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function streamInsiderTrades(req, res) {
  try {
    // Validate streaming access
    const authResult = secAuthManager.validateSecAccess(req, 'streaming', true);
    if (!authResult.success) {
      return res.status(secErrorHandler.ERROR_STATUS_CODES[authResult.error] || 403)
        .json(authResult);
    }

    // Data fetcher function for streaming
    const dataFetcher = async (params) => {
      const result = await secService.getInsiderTrades(params.timeRange || '1m', 100);
      return result.success ? result.data : [];
    };

    // Start streaming
    secStreamManager.startStream(req, res, 'insider_trades', dataFetcher, {
      updateInterval: authResult.userTier === 'premium' ? 15000 : 30000
    });

  } catch (error) {
    const errorResponse = secErrorHandler.handleError(error, {
      endpoint: req.path,
      userId: req.user?.id,
      operation: 'streamInsiderTrades'
    });
    
    if (!res.headersSent) {
      res.status(errorResponse.statusCode).json(errorResponse);
    }
  }
}

/**
 * Clear cache (admin function)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function clearCache(req, res, next) {
  try {
    const { dataType = 'all' } = req.query;

    // Admin access check would go here
    // For now, using basic auth check
    const authResult = secAuthManager.validateSecAccess(req, 'parallel_data');
    if (!authResult.success) {
      return res.status(secErrorHandler.ERROR_STATUS_CODES[authResult.error] || 403)
        .json(authResult);
    }

    // Get invalidation patterns
    const patterns = secCacheManager.getCacheInvalidationPatterns(dataType);

    // This would integrate with actual cache invalidation
    const result = {
      success: true,
      message: `Cache cleared for ${dataType}`,
      patterns,
      timestamp: new Date().toISOString()
    };

    res.json(result);

  } catch (error) {
    const errorResponse = secErrorHandler.handleError(error, {
      endpoint: req.path,
      userId: req.user?.id,
      operation: 'clearCache'
    });
    res.status(errorResponse.statusCode).json(errorResponse);
  }
}

/**
 * Get stream health status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getStreamHealth(req, res) {
  try {
    const health = secStreamManager.getStreamHealth();
    res.json(health);
  } catch (error) {
    const errorResponse = secErrorHandler.handleError(error, {
      endpoint: req.path,
      operation: 'getStreamHealth'
    });
    res.status(errorResponse.statusCode).json(errorResponse);
  }
}

/**
 * Get user cache status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUserCacheStatus(req, res) {
  try {
    const authResult = secAuthManager.validateSecAccess(req, 'ticker_summary');
    if (!authResult.success) {
      return res.status(secErrorHandler.ERROR_STATUS_CODES[authResult.error] || 403)
        .json(authResult);
    }

    const cacheStats = secCacheManager.getCacheStats(`user-${authResult.userId}`);
    const userLimits = secAuthManager.getUserLimits(authResult.userTier, 'all');

    const result = {
      success: true,
      userId: authResult.userId,
      userTier: authResult.userTier,
      cacheStats,
      limits: userLimits,
      timestamp: new Date().toISOString()
    };

    res.json(result);

  } catch (error) {
    const errorResponse = secErrorHandler.handleError(error, {
      endpoint: req.path,
      userId: req.user?.id,
      operation: 'getUserCacheStatus'
    });
    res.status(errorResponse.statusCode).json(errorResponse);
  }
}

module.exports = {
  getInsiderTrades,
  getInsiderTradesByTicker,
  getInstitutionalHoldings,
  getAbnormalActivity,
  getFilingDetails,
  getTickerSummary,
  streamInsiderTrades,
  clearCache,
  getStreamHealth,
  getUserCacheStatus
}; 