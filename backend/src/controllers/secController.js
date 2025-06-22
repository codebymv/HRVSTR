/**
 * SEC Controller
 * Handles business logic for SEC API endpoints
 */
const secService = require('../services/secService');
const cacheManager = require('../utils/cacheManager');
const cache = require('../utils/cache');
const { pool: db } = require('../config/data-sources');

// Register rate limits for SEC endpoints
cacheManager.registerRateLimit('sec-insider', 30, 60); // 30 requests per minute for insider trades
cacheManager.registerRateLimit('sec-institutional', 20, 60); // 20 requests per minute for institutional
cacheManager.registerRateLimit('sec-filing', 50, 60); // 50 requests per minute for individual filings

/**
 * Helper function to determine cache TTL based on data type and data freshness
 */
function getCacheTtl(dataType, isMarketHours = false) {
  // During market hours (9:30 AM - 4:00 PM ET), use shorter cache times
  // Outside market hours, use longer cache times since filings are less frequent
  
  const now = new Date();
  const etHour = now.getHours() - 5; // Approximate ET conversion (ignoring DST)
  const isMarketOpen = etHour >= 9 && etHour <= 16;
  
  switch (dataType) {
    case 'insider-trades': 
      return isMarketOpen ? 15 * 60 : 45 * 60; // 15 min during market, 45 min after
    case 'institutional-holdings': 
      return isMarketOpen ? 30 * 60 : 90 * 60; // 30 min during market, 90 min after
    case 'filing-details': 
      return 24 * 60 * 60; // 24 hours (filings don't change)
    case 'abnormal-activity': 
      return isMarketOpen ? 10 * 60 : 30 * 60; // 10 min during market, 30 min after
    default: 
      return isMarketOpen ? 20 * 60 : 60 * 60; // 20 min during market, 60 min after
  }
}

/**
 * Get insider trades data from SEC (all recent filings)
 * Now integrates with user-specific database caching
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getInsiderTrades(req, res, next) {
  try {
    const { timeRange = '1m', limit = 100, refresh = 'false' } = req.query;
    const userId = req.user?.id; // From auth middleware
    const userTier = req.user?.tier || 'free';

    console.log(`[secController] getInsiderTrades for user ${userId}, tier: ${userTier}`);

    // Use user-specific cache service for authenticated users
    if (userId) {
      const userSecCacheService = require('../services/userSecCacheService');
      const result = await userSecCacheService.getSecDataForUser(
        userId, 
        userTier, 
        'insider_trades', 
        timeRange, 
        refresh === 'true'
      );

      if (!result.success) {
        // Handle specific error types
        if (result.error === 'TIER_RESTRICTION') {
          return res.status(403).json({
            error: 'ACCESS_DENIED',
            message: result.message,
            userMessage: result.userMessage,
            tierRequired: result.tierRequired
          });
        } else if (result.error === 'INSUFFICIENT_CREDITS') {
          return res.status(402).json({
            error: 'PAYMENT_REQUIRED',
            message: result.message,
            userMessage: result.userMessage,
            creditsRequired: result.creditsRequired,
            creditsAvailable: result.creditsAvailable
          });
        } else {
          return res.status(500).json({
            error: 'SERVICE_ERROR',
            message: result.message,
            userMessage: result.userMessage || 'Unable to fetch insider trades data'
          });
        }
      }

      return res.json(result.data);
    }

    // Fallback to legacy cache system for non-authenticated users
    const cacheKey = `sec-insider-trades-${timeRange}-${limit}`;
    const ttl = getCacheTtl('insider-trades');

    const result = await cacheManager.getOrFetch(cacheKey, 'sec-insider', async () => {
      console.log(`Fetching fresh SEC insider trades data for ${timeRange}`);
      
      const serviceResult = await secService.getInsiderTrades(timeRange, parseInt(limit));
      
      if (!serviceResult.success) {
        throw new Error(serviceResult.message || 'Failed to fetch insider trades');
      }

      return {
        timeRange,
        insiderTrades: serviceResult.data, // serviceResult.data is the array
        count: serviceResult.count,
        source: 'sec-edgar',
        refreshed: true,
        lastUpdated: new Date().toISOString()
      };
    }, ttl, refresh === 'true');

    console.log(`[secController] Legacy cache result structure:`, {
      hasResult: !!result,
      insiderTradesType: typeof result?.insiderTrades,
      isArray: Array.isArray(result?.insiderTrades),
      count: result?.insiderTrades?.length || result?.count || 0
    });

    res.json(result);
  } catch (error) {
    console.error(`SEC Insider Trades Error: ${error.message}`);
    next(error);
  }
}

/**
 * Get insider trades data for a specific ticker
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getInsiderTradesByTicker(req, res, next) {
  try {
    const { ticker } = req.params;
    const { timeRange = '1m', limit = 50 } = req.query;
    const cacheKey = `sec-insider-ticker-${ticker.toUpperCase()}-${timeRange}-${limit}`;
    const ttl = getCacheTtl('insider-trades');

    const result = await cacheManager.getOrFetch(cacheKey, 'sec-insider', async () => {
      console.log(`Fetching SEC insider trades for ticker ${ticker}`);
      
      // First get all insider trades, then filter by ticker
      const allTrades = await secService.fetchInsiderTrades(timeRange, parseInt(limit) * 2);
      const tickerTrades = allTrades.filter(trade => 
        trade.ticker && trade.ticker.toUpperCase() === ticker.toUpperCase()
      );

      return {
        ticker: ticker.toUpperCase(),
        timeRange,
        insiderTrades: tickerTrades.slice(0, parseInt(limit)),
        count: tickerTrades.length,
        source: 'sec-edgar',
        lastUpdated: new Date().toISOString()
      };
    }, ttl);

    res.json(result);
  } catch (error) {
    console.error(`SEC Insider Trades by Ticker Error: ${error.message}`);
    next(error);
  }
}

/**
 * Get institutional holdings data from SEC (all recent filings)
 * Now integrates with user-specific database caching
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getInstitutionalHoldings(req, res, next) {
  try {
    const { timeRange = '1m', limit = 50, refresh = 'false' } = req.query;
    const userId = req.user?.id; // From auth middleware
    const userTier = req.user?.tier || 'free';

    console.log(`[secController] getInstitutionalHoldings for user ${userId}, tier: ${userTier}`);

    // Use user-specific cache service for authenticated users
    if (userId) {
      const userSecCacheService = require('../services/userSecCacheService');
      const result = await userSecCacheService.getSecDataForUser(
        userId, 
        userTier, 
        'institutional_holdings', 
        timeRange, 
        refresh === 'true'
      );

      if (!result.success) {
        // Handle specific error types
        if (result.error === 'TIER_RESTRICTION') {
          return res.status(403).json({
            error: 'ACCESS_DENIED',
            message: result.message,
            userMessage: result.userMessage,
            tierRequired: result.tierRequired
          });
        } else if (result.error === 'INSUFFICIENT_CREDITS') {
          return res.status(402).json({
            error: 'PAYMENT_REQUIRED',
            message: result.message,
            userMessage: result.userMessage,
            creditsRequired: result.creditsRequired,
            creditsAvailable: result.creditsAvailable
          });
        } else {
          return res.status(500).json({
            error: 'SERVICE_ERROR',
            message: result.message,
            userMessage: result.userMessage || 'Unable to fetch institutional holdings data'
          });
        }
      }

      return res.json(result.data);
    }

    // Fallback to legacy cache system for non-authenticated users
    const cacheKey = `sec-institutional-holdings-${timeRange}-${limit}`;
    const ttl = getCacheTtl('institutional-holdings');

    const result = await cacheManager.getOrFetch(cacheKey, 'sec-institutional', async () => {
      console.log(`Fetching fresh SEC institutional holdings data for ${timeRange}`);
      
      const institutionalHoldings = await secService.fetchInstitutionalHoldings(timeRange, parseInt(limit));

      return {
        timeRange,
        institutionalHoldings,
        count: institutionalHoldings.length,
        source: 'sec-edgar',
        refreshed: true,
        lastUpdated: new Date().toISOString()
      };
    }, ttl, refresh === 'true');

    res.json(result);
  } catch (error) {
    console.error(`SEC Institutional Holdings Error: ${error.message}`);
    next(error);
  }
}

/**
 * Get institutional holdings data for a specific ticker
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getInstitutionalHoldingsByTicker(req, res, next) {
  try {
    const { ticker } = req.params;
    const { timeRange = '1m', limit = 20 } = req.query;
    const cacheKey = `sec-institutional-ticker-${ticker.toUpperCase()}-${timeRange}-${limit}`;
    const ttl = getCacheTtl('institutional-holdings');

    const result = await cacheManager.getOrFetch(cacheKey, 'sec-institutional', async () => {
      console.log(`Fetching SEC institutional holdings for ticker ${ticker}`);
      
      // First get all holdings, then filter by ticker
      const allHoldings = await secService.fetchInstitutionalHoldings(timeRange, parseInt(limit) * 2);
      const tickerHoldings = allHoldings.filter(holding => 
        holding.ticker && holding.ticker.toUpperCase() === ticker.toUpperCase()
      );

      return {
        ticker: ticker.toUpperCase(),
        timeRange,
        institutionalHoldings: tickerHoldings.slice(0, parseInt(limit)),
        count: tickerHoldings.length,
        source: 'sec-edgar',
        lastUpdated: new Date().toISOString()
      };
    }, ttl);

    res.json(result);
  } catch (error) {
    console.error(`SEC Institutional Holdings by Ticker Error: ${error.message}`);
    next(error);
  }
}

/**
 * Detect abnormal trading activity patterns from insider trades
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getAbnormalActivity(req, res, next) {
  try {
    const { timeRange = '1m', minScore = 0.7, limit = 20 } = req.query;
    const cacheKey = `sec-abnormal-activity-${timeRange}-${minScore}-${limit}`;
    const ttl = getCacheTtl('abnormal-activity');

    const result = await cacheManager.getOrFetch(cacheKey, 'sec-insider', async () => {
      console.log(`Analyzing abnormal SEC trading activity for ${timeRange}`);
      
      const insiderTrades = await secService.fetchInsiderTrades(timeRange, 200);
      const abnormalActivity = analyzeAbnormalActivity(insiderTrades, parseFloat(minScore));

      return {
        timeRange,
        minScore: parseFloat(minScore),
        abnormalActivity: abnormalActivity.slice(0, parseInt(limit)),
        count: abnormalActivity.length,
        source: 'sec-edgar',
        lastUpdated: new Date().toISOString()
      };
    }, ttl);

    res.json(result);
  } catch (error) {
    console.error(`SEC Abnormal Activity Error: ${error.message}`);
    next(error);
  }
}

/**
 * Get detailed information for a specific SEC filing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getFilingDetails(req, res, next) {
  try {
    const { accessionNumber } = req.params;
    const cacheKey = `sec-filing-${accessionNumber}`;
    const ttl = getCacheTtl('filing-details');

    const result = await cacheManager.getOrFetch(cacheKey, 'sec-filing', async () => {
      console.log(`Fetching SEC filing details for ${accessionNumber}`);
      
      // This would require additional implementation in secService
      const filingDetails = await secService.getFilingDetails(accessionNumber);

      return {
        accessionNumber,
        filingDetails,
        source: 'sec-edgar',
        lastUpdated: new Date().toISOString()
      };
    }, ttl);

    res.json(result);
  } catch (error) {
    console.error(`SEC Filing Details Error: ${error.message}`);
    next(error);
  }
}

/**
 * Get comprehensive SEC summary for a ticker (insider trades + institutional holdings)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getTickerSummary(req, res, next) {
  try {
    const { ticker } = req.params;
    const { timeRange = '1m' } = req.query;
    const userTier = req.userTier || req.user?.tier || 'free';
    const hasInstitutionalAccess = userTier !== 'free';
    
    const cacheKey = `sec-summary-${ticker.toUpperCase()}-${timeRange}-${userTier}`;
    const ttl = getCacheTtl('insider-trades'); // Use shorter TTL for summary

    const result = await cacheManager.getOrFetch(cacheKey, 'sec-insider', async () => {
      console.log(`Fetching SEC summary for ticker ${ticker} (tier: ${userTier})`);
      
      // Always fetch insider trades (available to all tiers)
      const insiderTrades = await secService.fetchInsiderTrades(timeRange, 100);
      
      // Only fetch institutional holdings for Pro+ users
      let institutionalHoldings = [];
      if (hasInstitutionalAccess) {
        institutionalHoldings = await secService.fetchInstitutionalHoldings(timeRange, 100);
      }

      // Filter by ticker
      const tickerInsiderTrades = insiderTrades.filter(trade => 
        trade.ticker && trade.ticker.toUpperCase() === ticker.toUpperCase()
      );
      
      const tickerInstitutionalHoldings = hasInstitutionalAccess ? 
        institutionalHoldings.filter(holding => 
          holding.ticker && holding.ticker.toUpperCase() === ticker.toUpperCase()
        ) : [];

      // Analyze patterns
      const insiderActivity = analyzeInsiderActivity(tickerInsiderTrades);
      const institutionalActivity = hasInstitutionalAccess ? 
        analyzeInstitutionalActivity(tickerInstitutionalHoldings) : 
        { tierRestricted: true, message: 'Institutional holdings require Pro tier or higher' };

      const summary = {
        ticker: ticker.toUpperCase(),
        timeRange,
        userTier,
        summary: {
          insiderTrades: {
            count: tickerInsiderTrades.length,
            trades: tickerInsiderTrades.slice(0, 10), // Top 10 recent
            analysis: insiderActivity
          }
        },
        source: 'sec-edgar',
        lastUpdated: new Date().toISOString()
      };

      // Only include institutional holdings for Pro+ users
      if (hasInstitutionalAccess) {
        summary.summary.institutionalHoldings = {
          count: tickerInstitutionalHoldings.length,
          holdings: tickerInstitutionalHoldings.slice(0, 10), // Top 10 by value
          analysis: institutionalActivity
        };
      } else {
        summary.summary.institutionalHoldings = {
          tierRestricted: true,
          message: 'Institutional holdings analysis is available with Pro tier or higher',
          upgradeRequired: true
        };
      }

      return summary;
    }, ttl);

    res.json(result);
  } catch (error) {
    console.error(`SEC Ticker Summary Error: ${error.message}`);
    next(error);
  }
}

/**
 * Clear the SEC data cache
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function clearCache(req, res, next) {
  try {
    const clearedKeys = [];
    let totalCleared = 0;

    // Clear all SEC-related cache keys
    const patterns = [
      'sec-insider-trades*',
      'sec-insider-ticker*',
      'sec-institutional-holdings*',
      'sec-institutional-ticker*',
      'sec-abnormal-activity*',
      'sec-filing*',
      'sec-summary*'
    ];

    console.log('Starting SEC cache clearing operation...');

    patterns.forEach(pattern => {
      try {
        const cleared = cacheManager.clearCacheByPattern(pattern);
        if (cleared > 0) {
          clearedKeys.push(pattern);
          totalCleared += cleared;
          console.log(`Cleared ${cleared} entries for pattern: ${pattern}`);
        } else {
          console.log(`No entries found for pattern: ${pattern}`);
        }
      } catch (patternError) {
        console.error(`Error clearing pattern ${pattern}:`, patternError.message);
      }
    });

    console.log(`Cache clearing completed. Total cleared: ${totalCleared} items`);
    
    res.json({ 
      success: true, 
      message: `Cleared ${totalCleared} items from cache`, 
      clearedCount: totalCleared,
      clearedKeys,
      patterns: patterns,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error clearing cache: ${error.message}`);
    
    // Provide a more detailed error response
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Helper function to analyze abnormal trading activity
 */
function analyzeAbnormalActivity(trades, minScore) {
  // Group trades by ticker
  const tradesByTicker = {};
  trades.forEach(trade => {
    if (!trade.ticker) return;
    const ticker = trade.ticker.toUpperCase();
    if (!tradesByTicker[ticker]) {
      tradesByTicker[ticker] = [];
    }
    tradesByTicker[ticker].push(trade);
  });

  const abnormalStocks = [];

  Object.entries(tradesByTicker).forEach(([ticker, tickerTrades]) => {
    if (tickerTrades.length < 2) return; // Need at least 2 trades to detect patterns

    const analysis = {
      ticker,
      tradeCount: tickerTrades.length,
      totalValue: tickerTrades.reduce((sum, trade) => sum + (trade.totalValue || 0), 0),
      insiderCount: new Set(tickerTrades.map(trade => trade.insiderName)).size,
      recentActivity: tickerTrades.filter(trade => {
        const tradeDate = new Date(trade.transactionDate);
        const daysDiff = (new Date() - tradeDate) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7; // Recent activity in last 7 days
      }).length
    };

    // Calculate abnormality score based on various factors
    let score = 0;
    
    // High number of insiders trading
    if (analysis.insiderCount >= 3) score += 0.3;
    
    // High total value
    if (analysis.totalValue > 1000000) score += 0.2;
    
    // Recent concentrated activity
    if (analysis.recentActivity / analysis.tradeCount > 0.5) score += 0.3;
    
    // High frequency of trades
    if (analysis.tradeCount >= 5) score += 0.2;

    analysis.abnormalityScore = Math.min(score, 1.0);

    if (analysis.abnormalityScore >= minScore) {
      abnormalStocks.push(analysis);
    }
  });

  // Sort by abnormality score descending
  return abnormalStocks.sort((a, b) => b.abnormalityScore - a.abnormalityScore);
}

/**
 * Helper function to analyze insider activity patterns
 */
function analyzeInsiderActivity(trades) {
  if (!trades.length) return { noActivity: true };

  const totalValue = trades.reduce((sum, trade) => sum + (trade.totalValue || 0), 0);
  const buyTrades = trades.filter(trade => trade.transactionType && trade.transactionType.toLowerCase().includes('buy'));
  const sellTrades = trades.filter(trade => trade.transactionType && trade.transactionType.toLowerCase().includes('sell'));

  return {
    totalTrades: trades.length,
    totalValue,
    buyCount: buyTrades.length,
    sellCount: sellTrades.length,
    netSentiment: buyTrades.length > sellTrades.length ? 'bullish' : sellTrades.length > buyTrades.length ? 'bearish' : 'neutral',
    uniqueInsiders: new Set(trades.map(trade => trade.insiderName)).size
  };
}

/**
 * Helper function to analyze institutional activity patterns
 */
function analyzeInstitutionalActivity(holdings) {
  if (!holdings.length) return { noActivity: true };

  const totalValue = holdings.reduce((sum, holding) => sum + (holding.marketValue || 0), 0);
  const totalShares = holdings.reduce((sum, holding) => sum + (holding.shares || 0), 0);

  return {
    totalHoldings: holdings.length,
    totalValue,
    totalShares,
    largestHolding: holdings.reduce((max, holding) => 
      (holding.marketValue || 0) > (max.marketValue || 0) ? holding : max, holdings[0]
    )
  };
}

/**
 * Get both insider trades and institutional holdings in parallel for optimal loading
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getSecDataParallel(req, res, next) {
  try {
    const { timeRange = '1m', insiderLimit = 100, institutionalLimit = 50, refresh = 'false' } = req.query;
    const userTier = req.userTier || req.user?.tier || 'free';
    const hasInstitutionalAccess = userTier !== 'free';
    
    // Use parallel cache keys for both data types, including tier in key for proper caching
    const insiderCacheKey = `sec-insider-trades-${timeRange}-${insiderLimit}`;
    const institutionalCacheKey = `sec-institutional-holdings-${timeRange}-${institutionalLimit}`;
    
    const insiderTtl = getCacheTtl('insider-trades');
    const institutionalTtl = getCacheTtl('institutional-holdings');
    
    console.log(`Parallel SEC data fetch for user tier: ${userTier}, institutional access: ${hasInstitutionalAccess}`);

    // Always fetch insider trades (available to all tiers)
    const insiderResult = await cacheManager.getOrFetch(insiderCacheKey, 'sec-insider', async () => {
      console.log(`Fetching fresh SEC insider trades data for ${timeRange}`);
      const insiderTrades = await secService.fetchInsiderTrades(timeRange, parseInt(insiderLimit));
      return {
        timeRange,
        insiderTrades,
        count: insiderTrades.length,
        source: 'sec-edgar',
        refreshed: true,
        lastUpdated: new Date().toISOString()
      };
    }, insiderTtl, refresh === 'true');

    // Conditionally fetch institutional holdings based on tier
    let institutionalResult;
    if (hasInstitutionalAccess) {
      institutionalResult = await cacheManager.getOrFetch(institutionalCacheKey, 'sec-institutional', async () => {
        console.log(`Fetching fresh SEC institutional holdings data for ${timeRange}`);
        const institutionalHoldings = await secService.fetchInstitutionalHoldings(timeRange, parseInt(institutionalLimit));
        return {
          timeRange,
          institutionalHoldings,
          count: institutionalHoldings.length,
          source: 'sec-edgar',
          refreshed: true,
          lastUpdated: new Date().toISOString()
        };
      }, institutionalTtl, refresh === 'true');
    } else {
      // Return tier restriction message for free users
      institutionalResult = {
        tierRestricted: true,
        message: 'Institutional holdings analysis is available with Pro tier or higher',
        upgradeRequired: true,
        userTier,
        lastUpdated: new Date().toISOString()
      };
    }

    // Combine results for a single response
    const combinedResult = {
      timeRange,
      userTier,
      insiderTrades: {
        data: insiderResult.insiderTrades,
        count: insiderResult.count,
        lastUpdated: insiderResult.lastUpdated
      },
      institutionalHoldings: hasInstitutionalAccess ? {
        data: institutionalResult.institutionalHoldings,
        count: institutionalResult.count,
        lastUpdated: institutionalResult.lastUpdated
      } : institutionalResult,
      source: 'sec-edgar',
      refreshed: refresh === 'true',
      fetchedAt: new Date().toISOString()
    };

    res.json(combinedResult);
  } catch (error) {
    console.error(`SEC Parallel Data Fetch Error: ${error.message}`);
    next(error);
  }
}

/**
 * Stream insider trades data with real-time progress updates using SSE
 * Now integrates with user-specific database caching
 */
async function streamInsiderTrades(req, res) {
  const { timeRange = '1m', limit = 100, refresh = 'false', token } = req.query;
  
  // Handle authentication from query parameter (EventSource doesn't support headers)
  let userId = req.user?.id;
  let userTier = req.user?.tier || 'free';
  
  if (token && !userId) {
    try {
      // Verify token manually if passed via query parameter
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      console.log(`🔍 SEC CONTROLLER - JWT decoded:`, { userId: decoded.userId, exp: decoded.exp });
      
      // Look up user to get current tier
      const userQuery = 'SELECT id, tier FROM users WHERE id = $1';
      const userResult = await db.query(userQuery, [decoded.userId]);
      
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
        userTier = userResult.rows[0].tier || 'free';
        console.log(`🔍 SEC CONTROLLER - Authenticated via token: user ${userId}, tier: ${userTier}`);
      } else {
        console.log(`🔍 SEC CONTROLLER - User not found in database for ID: ${decoded.userId}`);
      }
    } catch (error) {
      console.error('🔍 SEC CONTROLLER - Token verification failed:', error.message);
      console.log('🔍 SEC CONTROLLER - Continuing as unauthenticated user');
      // Continue as unauthenticated user
    }
  }
  
  console.log(`\n🔍 SEC CONTROLLER - streamInsiderTrades START`);
  console.log(`🔍 Request params:`, { timeRange, limit, refresh, userId, userTier });
  
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Keep track of whether we've sent a completion event
  let completed = false;

  // Progress callback function that emits SSE events
  const progressCallback = (progressData) => {
    if (completed) return; // Don't send more events after completion
    
    console.log(`🔍 SEC CONTROLLER - Progress callback:`, progressData);
    
    const eventData = JSON.stringify({
      ...progressData,
      timestamp: new Date().toISOString()
    });
    
    try {
      res.write(`data: ${eventData}\n\n`);
    } catch (error) {
      console.error('🔍 SEC CONTROLLER - Error writing SSE data:', error);
      completed = true;
    }
  };

  // Function to safely end the stream
  const endStream = (data = null, error = null) => {
    if (completed) return;
    completed = true;
    
    console.log(`🔍 SEC CONTROLLER - endStream called:`, { 
      hasData: !!data, 
      hasError: !!error,
      dataType: data ? typeof data : 'none',
      dataCount: data?.insiderTrades?.length || data?.count || 0
    });
    
    try {
      // Send final event
      const finalEvent = {
        stage: error ? 'Error occurred during processing' : 'Stream completed successfully',
        progress: error ? 0 : 100,
        total: data ? (data.insiderTrades?.length || data.count || 0) : 0,
        current: data ? (data.insiderTrades?.length || data.count || 0) : 0,
        completed: true,
        timestamp: new Date().toISOString()
      };
      
      if (error) {
        finalEvent.error = error;
        finalEvent.userMessage = error.userMessage || 'An error occurred while fetching SEC data';
        finalEvent.retryAfter = error.retryAfter || 60;
      } else if (data) {
        finalEvent.data = data;
        
        // Log sample of data being sent to frontend
        if (data.insiderTrades && data.insiderTrades.length > 0) {
          console.log(`🔍 SEC CONTROLLER - Insider trades data being sent:`, {
            firstTrade: {
              ticker: data.insiderTrades[0].ticker,
              filingDate: data.insiderTrades[0].filingDate,
              insiderName: data.insiderTrades[0].insiderName?.substring(0, 30)
            },
            uniqueDatesInResponse: [...new Set(data.insiderTrades.map(t => t.filingDate?.split('T')[0]))].slice(0, 5)
          });
        }
      }
      
      res.write(`data: ${JSON.stringify(finalEvent)}\n\n`);
    } catch (writeError) {
      console.error('🔍 SEC CONTROLLER - Error writing final SSE event:', writeError);
    } finally {
      // Always end the response
      try {
        res.end();
      } catch (endError) {
        console.error('🔍 SEC CONTROLLER - Error ending SSE response:', endError);
      }
    }
  };

  // Handle client disconnect
  req.on('close', () => {
    console.log('🔍 SEC CONTROLLER - SSE client disconnected');
    completed = true;
  });

  req.on('error', (error) => {
    console.error('🔍 SEC CONTROLLER - SSE request error:', error);
    endStream(null, error.message);
  });

  try {
    // Use the new user-specific cache service for authenticated users
    if (userId) {
      console.log(`🔍 SEC CONTROLLER - Using user-specific cache for ${userId}`);
      
      const userSecCacheService = require('../services/userSecCacheService');
      
      try {
        const result = await userSecCacheService.getSecDataForUser(
          userId, 
          userTier, 
          'insider_trades', 
          timeRange, 
          refresh === 'true', 
          progressCallback
        );
        
        console.log(`🔍 SEC CONTROLLER - User cache service result:`, {
          success: result?.success,
          fromCache: result?.fromCache,
          dataCount: result?.data?.insiderTrades?.length || result?.data?.count || 0,
          error: result?.error
        });
        
        if (!result.success) {
          console.error(`🔍 SEC CONTROLLER - User cache error: ${result.error}`);
          endStream(null, result);
          return;
        }
        
        // Send final result
        endStream(result.data);
        return;
      } catch (userCacheError) {
        console.error(`🔍 SEC CONTROLLER - User cache service threw error:`, userCacheError);
        console.log(`🔍 SEC CONTROLLER - Falling back to legacy system due to user cache error`);
        // Fall through to legacy system
      }
    }
    
    // Fallback to old cache system for non-authenticated users
    console.log(`🔍 SEC CONTROLLER - No user authentication, using legacy cache system`);
    
    // Check cache first, unless refresh is requested
    if (refresh !== 'true' && cache.hasCachedItem && cache.hasCachedItem('sec-insider-trades', { timeRange, limit })) {
      console.log(`🔍 SEC CONTROLLER - Serving cached SEC insider trades data for ${timeRange}`);
      
      // Send cached data immediately
      const cachedResult = cache.getCachedItem('sec-insider-trades', { timeRange, limit });
      
      console.log(`🔍 SEC CONTROLLER - Cached data:`, { 
        hasData: !!cachedResult,
        tradesCount: cachedResult?.insiderTrades?.length || 0
      });
      
      // Emit progress events for cached data
      progressCallback({
        stage: 'Insider trades loaded from cache',
        progress: 100,
        total: cachedResult.insiderTrades?.length || 0,
        current: cachedResult.insiderTrades?.length || 0
      });
      
      // Complete with cached data
      endStream(cachedResult);
      return;
    }

    // Fetch fresh data with progress streaming
    console.log(`🔍 SEC CONTROLLER - Streaming fresh SEC insider trades data for ${timeRange}`);
    
    // Use the enhanced getInsiderTrades method instead of direct fetchInsiderTrades
    const serviceResult = await secService.getInsiderTrades(timeRange, parseInt(limit), progressCallback);
    
    console.log(`🔍 SEC CONTROLLER - Service result:`, {
      success: serviceResult?.success,
      dataCount: serviceResult?.data?.length || 0,
      error: serviceResult?.error
    });
    
    // Check if the service returned an error
    if (!serviceResult.success) {
      console.error(`🔍 SEC CONTROLLER - SEC service error: ${serviceResult.error}`);
      endStream(null, serviceResult);
      return;
    }

    const result = {
      timeRange,
      insiderTrades: serviceResult.data,
      count: serviceResult.count,
      source: 'sec-edgar',
      refreshed: true,
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`🔍 SEC CONTROLLER - Final result structure:`, {
      timeRange: result.timeRange,
      tradesCount: result.insiderTrades?.length || 0,
      uniqueDates: result.insiderTrades ? [...new Set(result.insiderTrades.map(t => t.filingDate?.split('T')[0]))].slice(0, 5) : []
    });
    
    // Cache the result (30 minutes TTL) - only for non-authenticated users
    if (cache.setCachedItem) {
      cache.setCachedItem('sec-insider-trades', { timeRange, limit }, result, 30 * 60 * 1000);
    }
    
    // Send final result
    endStream(result);
    
  } catch (error) {
    console.error(`🔍 SEC CONTROLLER - SEC Insider Trades Stream Error: ${error.message}`);
    
    // Format error for user consumption
    const errorResponse = {
      error: 'STREAM_ERROR',
      message: error.message,
      userMessage: 'An unexpected error occurred while streaming SEC data. Please try again.',
      retryAfter: 30
    };
    
    endStream(null, errorResponse);
  }
}

/**
 * Get user's SEC cache status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getUserCacheStatus(req, res, next) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User authentication required'
      });
    }

    const userSecCacheService = require('../services/userSecCacheService');
    const cacheStatus = await userSecCacheService.getUserCacheStatus(userId);

    res.json({
      userId,
      cacheStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`SEC Cache Status Error: ${error.message}`);
    next(error);
  }
}

/**
 * Clear user's SEC cache
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function clearUserCache(req, res, next) {
  try {
    const userId = req.user?.id;
    const { dataType, timeRange } = req.query; // Optional filters
    
    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User authentication required'
      });
    }

    const db = require('../database/db');
    
    let query = 'DELETE FROM user_sec_cache WHERE user_id = $1';
    let params = [userId];
    
    // Add optional filters
    if (dataType) {
      query += ' AND data_type = $2';
      params.push(dataType);
    }
    
    if (timeRange) {
      const paramIndex = params.length + 1;
      query += ` AND time_range = $${paramIndex}`;
      params.push(timeRange);
    }
    
    query += ' RETURNING id, data_type, time_range';
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      message: 'User SEC cache cleared successfully',
      clearedEntries: result.rows.length,
      entries: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Clear User SEC Cache Error: ${error.message}`);
    next(error);
  }
}

module.exports = {
  getInsiderTrades,
  getInsiderTradesByTicker,
  getInstitutionalHoldings,
  getInstitutionalHoldingsByTicker,
  getAbnormalActivity,
  getFilingDetails,
  getTickerSummary,
  clearCache,
  getSecDataParallel,
  streamInsiderTrades,
  getUserCacheStatus,
  clearUserCache
};