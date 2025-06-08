const { pool } = require('../config/data-sources');

// Credit costs for different actions
const CREDIT_COSTS = {
  reddit_sentiment: 5,
  finviz_sentiment: 3,
  yahoo_sentiment: 2,
  research_bundle: 12, // Combined discount (normally 10)
  deep_analysis: 8,
  historical_data: 4,
  
  // AI Features
  ai_ticker_analysis: 1,        // AI insights for ticker sentiment
  ai_reddit_analysis: 1,        // AI insights for Reddit posts
  ai_market_analysis: 1,        // AI insights for market sentiment charts
  ai_ticker_chart_analysis: 1,  // AI insights for ticker sentiment charts
  
  // Special actions
  refresh_data: 0,      // Free refresh/reload
  page_load: 0,         // Free page loads
  pagination: 0,        // Free pagination
  filter: 0,            // Free filtering
  
  // Tiered access (still use credits but at different rates)
  elite_research_bundle: 10,  // 20% additional discount for elite
  institutional_bundle: 8     // 33% discount for institutional
};

// Tier-specific credit limits and features
const TIER_LIMITS = {
  free: {
    monthly_credits: 0,
    can_purchase: true,
    max_sessions: 0,
    features: ['ai_ticker_analysis', 'ai_reddit_analysis', 'ai_market_analysis', 'ai_ticker_chart_analysis'] // Make AI features available to free users with credits
  },
  pro: {
    monthly_credits: 500,
    can_purchase: true,
    max_sessions: 3,
    features: ['reddit_sentiment', 'finviz_sentiment', 'yahoo_sentiment', 'research_bundle', 'ai_ticker_analysis', 'ai_reddit_analysis', 'ai_market_analysis', 'ai_ticker_chart_analysis']
  },
  elite: {
    monthly_credits: 2000,
    can_purchase: true,
    max_sessions: 10,
    features: ['reddit_sentiment', 'finviz_sentiment', 'yahoo_sentiment', 'elite_research_bundle', 'deep_analysis', 'ai_ticker_analysis', 'ai_reddit_analysis', 'ai_market_analysis', 'ai_ticker_chart_analysis'],
    discount_rate: 0.2 // 20% discount on all credit costs
  },
  institutional: {
    monthly_credits: 10000,
    can_purchase: true,
    max_sessions: -1, // unlimited
    features: ['reddit_sentiment', 'finviz_sentiment', 'yahoo_sentiment', 'institutional_bundle', 'deep_analysis', 'historical_data', 'ai_ticker_analysis', 'ai_reddit_analysis', 'ai_market_analysis', 'ai_ticker_chart_analysis'],
    discount_rate: 0.33 // 33% discount on all credit costs
  }
};

/**
 * Get user's current credit balance
 */
async function getUserCredits(userId) {
  try {
    const query = `
      SELECT 
        monthly_credits,
        credits_used,
        credits_purchased,
        credits_reset_date,
        tier
      FROM users 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = result.rows[0];
    
    // Check if we need to reset monthly credits
    const now = new Date();
    const resetDate = new Date(user.credits_reset_date);
    
    if (now > resetDate) {
      // Reset monthly credits
      const tierLimits = TIER_LIMITS[user.tier?.toLowerCase()] || TIER_LIMITS.free;
      const nextResetDate = new Date(now);
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);
      
      await pool.query(`
        UPDATE users 
        SET credits_used = 0, 
            monthly_credits = $1,
            credits_reset_date = $2
        WHERE id = $3
      `, [tierLimits.monthly_credits, nextResetDate.toISOString(), userId]);
      
      user.credits_used = 0;
      user.monthly_credits = tierLimits.monthly_credits;
    }
    
    const totalCredits = user.monthly_credits + (user.credits_purchased || 0);
    const remainingCredits = totalCredits - user.credits_used;
    
    return {
      total: totalCredits,
      used: user.credits_used,
      remaining: remainingCredits,
      monthly_allocation: user.monthly_credits,
      purchased: user.credits_purchased || 0,
      tier: user.tier
    };
  } catch (error) {
    console.error('Error getting user credits:', error);
    throw error;
  }
}

/**
 * Calculate actual credit cost for user (including tier discounts)
 */
function calculateCreditCost(action, userTier) {
  const baseCost = CREDIT_COSTS[action];
  if (baseCost === undefined) {
    throw new Error(`Unknown action: ${action}`);
  }
  
  // Free actions
  if (baseCost === 0) {
    return 0;
  }
  
  const tierLimits = TIER_LIMITS[userTier?.toLowerCase()] || TIER_LIMITS.free;
  const discountRate = tierLimits.discount_rate || 0;
  
  const finalCost = Math.ceil(baseCost * (1 - discountRate));
  return Math.max(finalCost, 1); // Minimum 1 credit
}

/**
 * Check if user has access to a feature
 */
function hasFeatureAccess(action, userTier) {
  const tierLimits = TIER_LIMITS[userTier?.toLowerCase()] || TIER_LIMITS.free;
  return tierLimits.features.includes(action) || CREDIT_COSTS[action] === 0;
}

/**
 * Middleware to check credits before API call
 */
const checkCredits = (action, options = {}) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          creditInfo: null
        });
      }
      
      // Get user's credit balance
      const creditBalance = await getUserCredits(userId);
      const userTier = creditBalance.tier?.toLowerCase() || 'free';
      
      // Check feature access
      if (!hasFeatureAccess(action, userTier)) {
        return res.status(403).json({
          success: false,
          error: 'Feature not available in your tier',
          creditInfo: creditBalance,
          requiredTier: 'pro',
          upgradeMessage: 'Upgrade to Pro to access this feature'
        });
      }
      
      // Calculate credit cost
      const creditCost = calculateCreditCost(action, userTier);
      
      // Check if user has enough credits
      if (creditBalance.remaining < creditCost) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient credits',
          creditInfo: creditBalance,
          requiredCredits: creditCost,
          availableCredits: creditBalance.remaining,
          message: `This action requires ${creditCost} credits but you only have ${creditBalance.remaining} remaining.`
        });
      }
      
      // Store credit info for use in the route
      req.creditInfo = {
        action,
        cost: creditCost,
        balance: creditBalance,
        tier: userTier
      };
      
      next();
    } catch (error) {
      console.error('Credit check error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during credit check',
        creditInfo: null
      });
    }
  };
};

/**
 * Middleware to deduct credits after successful API call
 */
const deductCredits = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const creditInfo = req.creditInfo;
    
    if (!userId || !creditInfo || creditInfo.cost === 0) {
      return next();
    }
    
    // Deduct credits
    await pool.query(`
      UPDATE users 
      SET credits_used = credits_used + $1
      WHERE id = $2
    `, [creditInfo.cost, userId]);
    
    // Log the transaction
    await pool.query(`
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
      creditInfo.action,
      creditInfo.cost,
      creditInfo.balance.remaining - creditInfo.cost,
      JSON.stringify({
        tier: creditInfo.tier,
        original_cost: CREDIT_COSTS[creditInfo.action],
        final_cost: creditInfo.cost,
        discount_applied: creditInfo.tier !== 'free' && TIER_LIMITS[creditInfo.tier]?.discount_rate > 0
      }),
      new Date().toISOString()
    ]);
    
    console.log(`💳 Credits deducted: ${creditInfo.cost} for ${creditInfo.action} (User: ${userId})`);
    
    next();
  } catch (error) {
    console.error('Error deducting credits:', error);
    // Don't fail the request, just log the error
    next();
  }
};

/**
 * Get credit info for response
 */
const addCreditInfo = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    if (req.creditInfo) {
      data.creditInfo = {
        action: req.creditInfo.action,
        cost: req.creditInfo.cost,
        remaining: req.creditInfo.balance.remaining - req.creditInfo.cost,
        tier: req.creditInfo.tier
      };
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Combined middleware for complete credit handling
 */
const requireCredits = (action, options = {}) => {
  return [
    checkCredits(action, options),
    addCreditInfo,
    // deductCredits will be called after the route handler succeeds
  ];
};

/**
 * Middleware to apply after successful API response
 */
const finalizeCreditTransaction = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Only deduct credits on successful responses (2xx status codes)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      deductCredits(req, res, () => {});
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  checkCredits,
  deductCredits,
  addCreditInfo,
  requireCredits,
  finalizeCreditTransaction,
  getUserCredits,
  calculateCreditCost,
  hasFeatureAccess,
  CREDIT_COSTS,
  TIER_LIMITS
}; 