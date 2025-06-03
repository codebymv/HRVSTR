/**
 * Earnings Controller
 * Handles business logic for earnings API endpoints using user-specific caching
 * Updated to follow the same architecture pattern as secController.js
 */
const earningsService = require('../services/earningsService');
const userEarningsCacheService = require('../services/userEarningsCacheService');
const cacheUtils = require('../utils/cache');
const earningsUtils = require('../utils/earnings');
const { randomDelay } = require('../utils/scraping-helpers');

/**
 * Get upcoming earnings data with user-specific caching
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getUpcomingEarnings(req, res, next) {
  try {
    const { timeRange = '1m', refresh = 'false', limit } = req.query;
    const userId = req.user?.id;
    const tier = req.user?.tier || 'free';
    
    console.log(`📊 Earnings request: userId=${userId}, timeRange=${timeRange}, tier=${tier}, refresh=${refresh}`);
    
    if (!userId) {
      // For unauthenticated users, use simple caching
      return await getUpcomingEarningsUnauthenticated(req, res, next);
    }
    
    try {
      const options = {
        limit: limit ? parseInt(limit) : null
      };
      
      const data = await userEarningsCacheService.getEarningsData(
        userId,
        'upcoming_earnings',
        timeRange,
        tier,
        refresh === 'true',
        options
      );
      
      if (!data.success) {
        return res.status(500).json({
          success: false,
          error: data.error,
          message: data.userMessage || data.message,
          retryAfter: data.retryAfter,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        data: data.data,
        count: data.count,
        source: data.source,
        metadata: data.metadata,
        timeRange,
        tier,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      if (error.message.includes('INSUFFICIENT_CREDITS')) {
        return res.status(402).json({
          success: false,
          error: 'INSUFFICIENT_CREDITS',
          message: 'Insufficient credits for this operation',
          userMessage: 'You have reached your earnings data limit for this billing period.'
        });
      }
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error in getUpcomingEarnings:', error);
    res.status(500).json({
      success: false,
      error: 'EARNINGS_FETCH_ERROR',
      message: 'Failed to fetch upcoming earnings data',
      userMessage: 'Unable to load earnings data at the moment. Please try again.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get upcoming earnings for unauthenticated users (simple caching)
 */
async function getUpcomingEarningsUnauthenticated(req, res, next) {
  try {
    const { timeRange = '1m', refresh = 'false' } = req.query;
    
    // Check cache first (unless refresh is requested)
    if (refresh !== 'true' && cacheUtils.hasCachedItem('earnings-upcoming', timeRange)) {
      const cachedData = cacheUtils.getCachedItem('earnings-upcoming', timeRange);
      console.log(`📋 Serving cached upcoming earnings data for ${timeRange}`);
      
      // Apply free tier limits for unauthenticated users
      const limitedData = cachedData.slice(0, 25);
      
      return res.json({
        success: true,
        data: limitedData,
        source: 'cache',
        timeRange,
        count: limitedData.length,
        tier: 'free',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔍 Fetching upcoming earnings for time range: ${timeRange}`);
    
    // Add random delay to avoid rate limiting
    await randomDelay(500, 1500);
    
    // Fetch upcoming earnings
    const result = await earningsService.getUpcomingEarnings(timeRange, 25);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        message: result.userMessage || result.message,
        timestamp: new Date().toISOString()
      });
    }

    // Cache the results for 1 hour
    cacheUtils.setCachedItem('earnings-upcoming', timeRange, result.data, 3600);
    
    res.json({
      success: true,
      data: result.data,
      source: 'fresh',
      timeRange,
      count: result.count,
      tier: 'free',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in getUpcomingEarningsUnauthenticated:', error);
    res.status(500).json({
      success: false,
      error: 'EARNINGS_FETCH_ERROR',
      message: 'Failed to fetch upcoming earnings data',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get earnings analysis for a specific ticker with user caching
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getEarningsAnalysis(req, res, next) {
  try {
    const { ticker } = req.params;
    const { refresh = 'false', timeRange = '1m' } = req.query;
    const userId = req.user?.id;
    const tier = req.user?.tier || 'free';

    if (!ticker) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_TICKER',
        message: 'Ticker symbol is required',
        timestamp: new Date().toISOString()
      });
    }

    const normalizedTicker = ticker.toUpperCase();
    console.log(`📊 Fetching earnings analysis for: ${normalizedTicker}, userId: ${userId}`);

    if (!userId) {
      // For unauthenticated users, use simple caching
      return await getEarningsAnalysisUnauthenticated(req, res, next);
    }

    try {
      const options = {
        ticker: normalizedTicker
      };
      
      const data = await userEarningsCacheService.getEarningsData(
        userId,
        'earnings_analysis',
        timeRange,
        tier,
        refresh === 'true',
        options
      );
      
      if (!data.success) {
        return res.status(500).json({
          success: false,
          error: data.error,
          message: data.userMessage || data.message,
          ticker: normalizedTicker,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        ticker: normalizedTicker,
        analysis: data.data,
        source: data.source,
        metadata: data.metadata,
        tier,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      if (error.message.includes('INSUFFICIENT_CREDITS')) {
        return res.status(402).json({
          success: false,
          error: 'INSUFFICIENT_CREDITS',
          message: 'Insufficient credits for earnings analysis',
          ticker: normalizedTicker
        });
      }
      throw error;
    }

  } catch (error) {
    console.error(`❌ Error analyzing earnings for ${req.params.ticker}:`, error);
    res.status(500).json({
      success: false,
      error: 'EARNINGS_ANALYSIS_ERROR',
      message: 'Failed to analyze earnings data',
      ticker: req.params.ticker,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get earnings analysis for unauthenticated users
 */
async function getEarningsAnalysisUnauthenticated(req, res, next) {
  try {
    const { ticker } = req.params;
    const { refresh = 'false' } = req.query;
    const normalizedTicker = ticker.toUpperCase();

    // Check cache first
    if (refresh !== 'true' && cacheUtils.hasCachedItem('earnings-analysis', normalizedTicker)) {
      const cachedAnalysis = cacheUtils.getCachedItem('earnings-analysis', normalizedTicker);
      console.log(`📋 Serving cached analysis for ${normalizedTicker}`);
      return res.json({
        success: true,
        ticker: normalizedTicker,
        analysis: cachedAnalysis,
        source: 'cache',
        tier: 'free',
        timestamp: new Date().toISOString()
      });
    }

    // Add random delay to avoid rate limiting
    await randomDelay(800, 2000);

    // Perform earnings analysis
    const result = await earningsService.getEarningsAnalysis(normalizedTicker);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        message: result.userMessage || result.message,
        ticker: normalizedTicker,
        timestamp: new Date().toISOString()
      });
    }
    
    // Cache the analysis for 2 hours
    cacheUtils.setCachedItem('earnings-analysis', normalizedTicker, result.data, 7200);
    
    res.json({
      success: true,
      ticker: normalizedTicker,
      analysis: result.data,
      source: 'fresh',
      tier: 'free',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Error in getEarningsAnalysisUnauthenticated:`, error);
    res.status(500).json({
      success: false,
      error: 'EARNINGS_ANALYSIS_ERROR',
      message: 'Failed to analyze earnings data',
      ticker: req.params.ticker,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get historical earnings for a ticker with user caching
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getHistoricalEarnings(req, res, next) {
  try {
    const { ticker } = req.params;
    const { refresh = 'false', timeRange = '1m', limit } = req.query;
    const userId = req.user?.id;
    const tier = req.user?.tier || 'free';

    if (!ticker) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_TICKER',
        message: 'Ticker symbol is required',
        timestamp: new Date().toISOString()
      });
    }

    const normalizedTicker = ticker.toUpperCase();
    console.log(`📊 Fetching historical earnings for: ${normalizedTicker}`);

    if (!userId) {
      // Return placeholder for unauthenticated users
      return res.json({
        success: true,
        ticker: normalizedTicker,
        historicalEarnings: [],
        message: 'Historical earnings data requires authentication',
        count: 0,
        tier: 'free',
        timestamp: new Date().toISOString()
      });
    }

    try {
      const options = {
        ticker: normalizedTicker,
        limit: limit ? parseInt(limit) : null
      };
      
      const data = await userEarningsCacheService.getEarningsData(
        userId,
        'historical_earnings',
        timeRange,
        tier,
        refresh === 'true',
        options
      );
      
      if (!data.success) {
        return res.status(500).json({
          success: false,
          error: data.error,
          message: data.userMessage || data.message,
          ticker: normalizedTicker,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        ticker: normalizedTicker,
        historicalEarnings: data.data,
        count: data.count,
        source: data.source,
        metadata: data.metadata,
        tier,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      if (error.message.includes('INSUFFICIENT_CREDITS')) {
        return res.status(402).json({
          success: false,
          error: 'INSUFFICIENT_CREDITS',
          message: 'Insufficient credits for historical earnings data',
          ticker: normalizedTicker
        });
      }
      throw error;
    }

  } catch (error) {
    console.error(`❌ Error fetching historical earnings for ${req.params.ticker}:`, error);
    res.status(500).json({
      success: false,
      error: 'HISTORICAL_EARNINGS_ERROR',
      message: 'Failed to fetch historical earnings data',
      ticker: req.params.ticker,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get user's earnings cache status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getUserEarningsCacheStatus(req, res, next) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'User authentication required'
      });
    }

    const cacheStatus = await userEarningsCacheService.getUserEarningsCacheStatus(userId);

    res.json({
      success: true,
      userId,
      cacheStatus: cacheStatus.cacheStatus,
      totalEntries: cacheStatus.totalEntries,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Earnings Cache Status Error: ${error.message}`);
    next(error);
  }
}

/**
 * Clear user's earnings cache
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function clearUserEarningsCache(req, res, next) {
  try {
    const userId = req.user?.id;
    const { dataType, timeRange } = req.query;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'User authentication required'
      });
    }

    const result = await userEarningsCacheService.clearUserEarningsCache(userId, dataType, timeRange);

    res.json({
      success: true,
      userId,
      clearedEntries: result.clearedEntries,
      message: result.message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Clear Earnings Cache Error: ${error.message}`);
    next(error);
  }
}

/**
 * Clear the earnings data cache (for development and testing)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function clearEarningsCache(req, res, next) {
  try {
    const result = await earningsService.clearEarningsCache();
    
    res.json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Clear Earnings Cache Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear earnings cache',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Legacy functions for backward compatibility
async function getCompanyInfo(req, res, next) {
  try {
    const { ticker } = req.params;
    const normalizedTicker = ticker.toUpperCase();
    
    const result = await earningsService.getCompanyInfo(normalizedTicker);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error,
        message: result.message,
        ticker: normalizedTicker,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      ticker: normalizedTicker,
      companyInfo: result.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error fetching company info for ${req.params.ticker}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company information',
      message: error.message,
      ticker: req.params.ticker,
      timestamp: new Date().toISOString()
    });
  }
}

async function getEarningsHealth(req, res) {
  res.json({
    success: true,
    service: 'earnings',
    status: 'operational',
    version: '2.0.0',
    features: [
      'upcoming_earnings',
      'earnings_analysis', 
      'historical_earnings',
      'user_caching',
      'tier_based_limits'
    ],
    timestamp: new Date().toISOString()
  });
}

// Progress tracking (legacy support)
const progressStorage = new Map();

function getProgress(sessionId) {
  return progressStorage.get(sessionId) || null;
}

function updateProgress(sessionId, percent, message, currentDate = null, results = null) {
  progressStorage.set(sessionId, {
    percent,
    message,
    currentDate,
    results,
    timestamp: new Date().toISOString()
  });
  
  // Auto-cleanup after 10 minutes
  setTimeout(() => {
    progressStorage.delete(sessionId);
  }, 10 * 60 * 1000);
}

async function scrapeEarningsCalendar(timeRange, sessionId = null) {
  return await earningsUtils.scrapeEarningsCalendar(timeRange, sessionId);
}

module.exports = {
  getUpcomingEarnings,
  getEarningsAnalysis,
  getHistoricalEarnings,
  getUserEarningsCacheStatus,
  clearUserEarningsCache,
  clearEarningsCache,
  getCompanyInfo,
  getEarningsHealth,
  getProgress,
  updateProgress,
  scrapeEarningsCalendar
};
