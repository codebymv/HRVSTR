const { pool } = require('../config/data-sources');

// Tier configuration
const TIER_LIMITS = {
  free: {
    watchlistLimit: 5,
    monthlyCredits: 50,
    features: ['FinViz', 'SEC-Insider', 'Earnings'],
    historyDays: 1
  },
  pro: {
    watchlistLimit: 25,
    monthlyCredits: 500,
    features: ['FinViz', 'SEC-Insider', 'SEC-Institutional', 'Earnings', 'Reddit', 'Yahoo'],
    historyDays: 30
  },
  elite: {
    watchlistLimit: -1, // unlimited
    monthlyCredits: 2000,
    features: ['FinViz', 'SEC-Insider', 'SEC-Institutional', 'Earnings', 'Reddit', 'Yahoo', 'AlphaVantage'],
    historyDays: 90
  },
  institutional: {
    watchlistLimit: -1, // unlimited
    monthlyCredits: 10000,
    features: ['FinViz', 'SEC-Insider', 'SEC-Institutional', 'Earnings', 'Reddit', 'Yahoo', 'AlphaVantage'],
    historyDays: 365
  }
};

// Credit costs for different operations
const CREDIT_COSTS = {
  'sentiment-basic': 1,
  'sentiment-reddit': 3,
  'sec-filing': 2,
  'earnings-analysis': 2,
  'real-time-refresh': 1,
  'historical-data': 5
};

/**
 * Middleware to check if user has sufficient credits for an operation
 */
const checkCredits = (operation, cost = null) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get user's current credit status
      const userResult = await pool.query(
        'SELECT tier, credits_remaining, credits_reset_date FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];
      const creditCost = cost || CREDIT_COSTS[operation] || 1;

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
      }

      // Check if user has sufficient credits
      if (user.credits_remaining < creditCost) {
        return res.status(402).json({ 
          error: 'Insufficient credits',
          required: creditCost,
          remaining: user.credits_remaining,
          tier: user.tier
        });
      }

      // Store cost for deduction after successful operation
      req.creditCost = creditCost;
      req.userTier = user.tier;
      next();

    } catch (error) {
      console.error('Error checking credits:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to deduct credits after successful operation
 */
const deductCredits = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const creditCost = req.creditCost;

    if (userId && creditCost) {
      await pool.query(
        'UPDATE users SET credits_remaining = credits_remaining - $1 WHERE id = $2',
        [creditCost, userId]
      );
    }

    next();
  } catch (error) {
    console.error('Error deducting credits:', error);
    // Don't fail the request, just log the error
    next();
  }
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
  checkCredits,
  deductCredits,
  checkFeatureAccess,
  checkWatchlistLimit,
  getUserTierInfo,
  TIER_LIMITS,
  CREDIT_COSTS
}; 