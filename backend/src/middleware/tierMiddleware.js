const { pool } = require('../config/data-sources');

// Tier configuration
const TIER_LIMITS = {
  free: {
    watchlistLimit: 5,
    monthlyCredits: 50,
    dailyCredits: 10,
    features: ['FinViz', 'SEC-Insider', 'Earnings'],
    historyDays: 1,
    maxTickersPerRequest: 3,
    rateLimitPerMinute: 10
  },
  pro: {
    watchlistLimit: 25,
    monthlyCredits: 500,
    dailyCredits: 100,
    features: ['FinViz', 'SEC-Insider', 'SEC-Institutional', 'Earnings', 'Reddit', 'Yahoo'],
    historyDays: 30,
    maxTickersPerRequest: 10,
    rateLimitPerMinute: 50
  },
  elite: {
    watchlistLimit: -1, // unlimited
    monthlyCredits: 2000,
    dailyCredits: 500,
    features: ['FinViz', 'SEC-Insider', 'SEC-Institutional', 'Earnings', 'Reddit', 'Yahoo', 'AlphaVantage'],
    historyDays: 90,
    maxTickersPerRequest: 50,
    rateLimitPerMinute: 200
  },
  institutional: {
    watchlistLimit: -1, // unlimited
    monthlyCredits: 10000,
    dailyCredits: 2000,
    features: ['FinViz', 'SEC-Insider', 'SEC-Institutional', 'Earnings', 'Reddit', 'Yahoo', 'AlphaVantage'],
    historyDays: 365,
    maxTickersPerRequest: 100,
    rateLimitPerMinute: 500
  }
};

// Credit costs for different operations
const CREDIT_COSTS = {
  // Sentiment Analysis (per ticker)
  'sentiment-finviz': 1,
  'sentiment-yahoo': 1,
  'sentiment-reddit': 3, // More expensive due to processing complexity
  'sentiment-aggregated': 2,
  
  // SEC Data
  'sec-filing': 2,
  'sec-insider': 1,
  'sec-institutional': 3,
  
  // Market Data
  'earnings-analysis': 2,
  'market-sentiment': 3,
  'real-time-refresh': 1,
  'historical-data': 5,
  
  // Premium Features
  'alert-setup': 1,
  'custom-analysis': 5
};

/**
 * Calculate credit cost for sentiment operations
 */
const calculateSentimentCost = (tickers, sources = []) => {
  if (!Array.isArray(tickers)) {
    tickers = typeof tickers === 'string' ? tickers.split(',') : [tickers];
  }
  
  const tickerCount = tickers.length;
  let totalCost = 0;
  
  // Calculate cost per source
  sources.forEach(source => {
    const costPerTicker = CREDIT_COSTS[`sentiment-${source.toLowerCase()}`] || 1;
    totalCost += tickerCount * costPerTicker;
  });
  
  // Default to finviz if no sources specified
  if (sources.length === 0) {
    totalCost = tickerCount * CREDIT_COSTS['sentiment-finviz'];
  }
  
  // Apply bulk discount for 5+ tickers
  if (tickerCount >= 5) {
    totalCost = Math.ceil(totalCost * 0.8); // 20% discount
  }
  
  return Math.max(1, totalCost); // Minimum 1 credit
};

/**
 * Enhanced credit checking middleware for sentiment operations
 */
const checkSentimentCredits = (req, res, next) => {
  return checkCreditsForOperation('sentiment')(req, res, next);
};

/**
 * Create a credit checking middleware for a specific operation type
 */
const checkCredits = (operationType) => {
  return checkCreditsForOperation(operationType);
};

/**
 * Generic credit checking middleware with transaction support
 */
const checkCreditsForOperation = (operationType) => {
  return async (req, res, next) => {
    try {
      console.log(`[TIER DEBUG] Checking credits for operation: ${operationType}, user: ${req.user?.id}`);
      
      const userId = req.user?.id;
      if (!userId) {
        console.error('[TIER ERROR] No authenticated user found for credit check');
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Calculate credit cost based on operation type
      let creditCost = 1;
      let operationDetails = {};
      
      if (operationType === 'sentiment') {
        const { tickers } = req.query;
        const tickerList = tickers ? tickers.split(',').map(t => t.trim()).filter(Boolean) : [];
        
        // Determine sources based on route
        const sources = [];
        if (req.route.path.includes('finviz') || req.baseUrl.includes('finviz')) {
          sources.push('finviz');
        }
        if (req.route.path.includes('yahoo') || req.baseUrl.includes('yahoo')) {
          sources.push('yahoo');
        }
        if (req.route.path.includes('reddit') || req.baseUrl.includes('reddit')) {
          sources.push('reddit');
        }
        
        creditCost = calculateSentimentCost(tickerList, sources);
        operationDetails = { 
          tickers: tickerList, 
          sources, 
          tickerCount: tickerList.length 
        };
        
        // Check ticker limits per tier
        const userResult = await pool.query(
          'SELECT tier FROM users WHERE id = $1',
          [userId]
        );
        
        if (userResult.rows.length > 0) {
          const userTier = userResult.rows[0].tier;
          const tierLimits = TIER_LIMITS[userTier];
          
          if (tickerList.length > tierLimits.maxTickersPerRequest) {
            return res.status(400).json({
              error: `Too many tickers requested. Your ${userTier} tier allows maximum ${tierLimits.maxTickersPerRequest} tickers per request`,
              code: 'TICKER_LIMIT_EXCEEDED',
              limit: tierLimits.maxTickersPerRequest,
              requested: tickerList.length
            });
          }
        }
      } else {
        creditCost = CREDIT_COSTS[operationType] || 1;
      }

      // Get user's current credit status with row locking
      const userResult = await pool.query(
        'SELECT tier, credits_remaining, credits_reset_date, credits_monthly_limit FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userResult.rows.length === 0) {
        console.error(`[TIER ERROR] User not found: ${userId}`);
        return res.status(404).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      const user = userResult.rows[0];

      // Check if credits need to be reset (monthly cycle)
      const now = new Date();
      const resetDate = new Date(user.credits_reset_date);
      
      if (now >= resetDate) {
        // Reset credits for new month
        const tierLimits = TIER_LIMITS[user.tier];
        const newResetDate = new Date();
        newResetDate.setMonth(newResetDate.getMonth() + 1);

        await pool.query(
          'UPDATE users SET credits_remaining = $1, credits_reset_date = $2 WHERE id = $3',
          [tierLimits.monthlyCredits, newResetDate, userId]
        );

        user.credits_remaining = tierLimits.monthlyCredits;
        console.log(`🔄 Credits reset for user ${userId}: ${tierLimits.monthlyCredits} credits`);
      }

      // Check if user has sufficient credits
      if (user.credits_remaining < creditCost) {
        console.error(`[TIER ERROR] Insufficient credits for user ${userId}: has ${user.credits_remaining}, needs ${creditCost}`);
        return res.status(402).json({ 
          error: 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
          required: creditCost,
          remaining: user.credits_remaining,
          tier: user.tier,
          operation: operationType,
          details: operationDetails
        });
      }

      // Store operation info for deduction after successful operation
      req.creditOperation = {
        userId,
        cost: creditCost,
        type: operationType,
        details: operationDetails,
        tier: user.tier,
        remainingBefore: user.credits_remaining
      };

      console.log(`💳 Credit check passed - User: ${userId}, Operation: ${operationType}, Cost: ${creditCost}, Remaining: ${user.credits_remaining}`);
      next();

    } catch (error) {
      console.error('[TIER ERROR] Error in credit check:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'CREDIT_CHECK_ERROR'
      });
    }
  };
};

/**
 * Enhanced credit deduction middleware with logging
 */
const deductCredits = async (req, res, next) => {
  try {
    const operation = req.creditOperation;
    
    if (!operation) {
      // No credit operation to process
      return next();
    }

    const { userId, cost, type, details, tier } = operation;
    
    // Begin transaction for atomic credit deduction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Deduct credits
      const result = await client.query(
        'UPDATE users SET credits_remaining = credits_remaining - $1 WHERE id = $2 RETURNING credits_remaining',
        [cost, userId]
      );
      
      const newBalance = result.rows[0]?.credits_remaining;
      
      // Log the credit deduction in activities
      await client.query(
        `INSERT INTO activities (user_id, activity_type, title, description, symbol)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'credit_deduction',
          `${cost} Credits Used - ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          `${cost} credits deducted for ${type} operation. ${details.tickerCount ? `Processed ${details.tickerCount} tickers` : 'Operation completed'}. Remaining: ${newBalance}`,
          details.tickers ? details.tickers[0] : null // Use first ticker as symbol reference
        ]
      );
      
      await client.query('COMMIT');
      
      // Add credit info to response
      res.locals.creditInfo = {
        used: cost,
        remaining: newBalance,
        operation: type,
        tier
      };
      
      console.log(`✅ Credits deducted - User: ${userId}, Cost: ${cost}, New Balance: ${newBalance}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    next();
    
  } catch (error) {
    console.error('❌ Error deducting credits:', error);
    // Don't fail the request, but log the error
    next();
  }
};

/**
 * Middleware to add credit info to successful responses
 */
const addCreditInfoToResponse = (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  // Override json method to add credit info
  res.json = function(data) {
    if (res.locals.creditInfo && data && typeof data === 'object') {
      data.credits = res.locals.creditInfo;
    }
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Middleware to check if user's tier allows access to a feature
 */
const checkFeatureAccess = (feature) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userResult = await pool.query(
        'SELECT tier FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userTier = userResult.rows[0].tier;
      const tierLimits = TIER_LIMITS[userTier];

      if (!tierLimits.features.includes(feature)) {
        return res.status(403).json({ 
          error: 'Feature not available for your tier',
          feature,
          tier: userTier,
          requiredTiers: Object.keys(TIER_LIMITS).filter(tier => 
            TIER_LIMITS[tier].features.includes(feature)
          )
        });
      }

      req.userTier = userTier;
      next();

    } catch (error) {
      console.error('Error checking feature access:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to check watchlist limits
 */
const checkWatchlistLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userResult = await pool.query(
      'SELECT tier FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userTier = userResult.rows[0].tier;
    const tierLimits = TIER_LIMITS[userTier];

    // Check current watchlist count if there's a limit
    if (tierLimits.watchlistLimit !== -1) {
      const watchlistResult = await pool.query(
        'SELECT COUNT(*) FROM watchlist WHERE user_id = $1',
        [userId]
      );

      const currentCount = parseInt(watchlistResult.rows[0].count);

      if (currentCount >= tierLimits.watchlistLimit) {
        return res.status(403).json({ 
          error: 'Watchlist limit reached',
          limit: tierLimits.watchlistLimit,
          current: currentCount,
          tier: userTier
        });
      }
    }

    req.userTier = userTier;
    next();

  } catch (error) {
    console.error('Error checking watchlist limit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get user's tier info
 */
const getUserTierInfo = async (userId) => {
  try {
    const userResult = await pool.query(
      'SELECT tier, credits_remaining, credits_monthly_limit, credits_reset_date FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return null;
    }

    const user = userResult.rows[0];
    const tierLimits = TIER_LIMITS[user.tier];

    return {
      tier: user.tier,
      credits: {
        remaining: user.credits_remaining,
        monthly: user.credits_monthly_limit,
        resetDate: user.credits_reset_date
      },
      limits: tierLimits,
      features: tierLimits.features
    };
  } catch (error) {
    console.error('Error getting user tier info:', error);
    return null;
  }
};

module.exports = {
  checkCredits: checkCreditsForOperation,
  checkSentimentCredits,
  deductCredits,
  addCreditInfoToResponse,
  calculateSentimentCost,
  checkFeatureAccess,
  checkWatchlistLimit,
  getUserTierInfo,
  TIER_LIMITS,
  CREDIT_COSTS
}; 