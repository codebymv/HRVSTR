const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { 
  getUserCredits, 
  CREDIT_COSTS, 
  TIER_LIMITS,
  calculateCreditCost 
} = require('../middleware/premiumCreditMiddleware');
const { pool } = require('../config/data-sources');

/**
 * GET /api/credits/balance
 * Get user's current credit balance and tier info
 */
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const creditBalance = await getUserCredits(userId);
    
    // Get tier-specific information
    const tierLimits = TIER_LIMITS[creditBalance.tier?.toLowerCase()] || TIER_LIMITS.free;
    
    res.json({
      success: true,
      balance: creditBalance,
      tierLimits,
      creditCosts: CREDIT_COSTS
    });
  } catch (error) {
    console.error('Error fetching credit balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch credit balance'
    });
  }
});

/**
 * GET /api/credits/cost/:action
 * Get the credit cost for a specific action for the current user
 */
router.get('/cost/:action', authenticateToken, async (req, res) => {
  try {
    const { action } = req.params;
    const userId = req.user.id;
    
    const creditBalance = await getUserCredits(userId);
    const userTier = creditBalance.tier?.toLowerCase() || 'free';
    
    if (!CREDIT_COSTS.hasOwnProperty(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action'
      });
    }
    
    const cost = calculateCreditCost(action, userTier);
    const baseCost = CREDIT_COSTS[action];
    const tierLimits = TIER_LIMITS[userTier] || TIER_LIMITS.free;
    
    res.json({
      success: true,
      action,
      cost,
      baseCost,
      discount: baseCost - cost,
      discountRate: tierLimits.discount_rate || 0,
      tier: userTier,
      hasAccess: tierLimits.features.includes(action) || baseCost === 0
    });
  } catch (error) {
    console.error('Error calculating credit cost:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate credit cost'
    });
  }
});

/**
 * POST /api/credits/purchase
 * Purchase additional credits (would integrate with Stripe)
 */
router.post('/purchase', authenticateToken, async (req, res) => {
  try {
    const { credits, paymentIntentId } = req.body;
    const userId = req.user.id;
    
    // Validate input
    if (!credits || credits <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credit amount'
      });
    }
    
    // Check if user can purchase credits
    const creditBalance = await getUserCredits(userId);
    const tierLimits = TIER_LIMITS[creditBalance.tier?.toLowerCase()] || TIER_LIMITS.free;
    
    if (!tierLimits.can_purchase) {
      return res.status(403).json({
        success: false,
        error: 'Credit purchases not available for your tier',
        upgradeMessage: 'Upgrade to Pro to purchase additional credits'
      });
    }
    
    // In a real implementation, you would:
    // 1. Verify the payment with Stripe
    // 2. Only proceed if payment is confirmed
    
    // For now, we'll simulate a successful purchase
    console.log(`💰 Credit purchase simulation: ${credits} credits for user ${userId}`);
    
    // Add credits to user account
    await pool.query(`
      UPDATE users 
      SET credits_purchased = COALESCE(credits_purchased, 0) + $1
      WHERE id = $2
    `, [credits, userId]);
    
    // Log the purchase transaction
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
      'credit_purchase',
      -credits, // Negative because it's a credit addition
      creditBalance.remaining + credits,
      JSON.stringify({
        purchase_amount: credits,
        payment_intent_id: paymentIntentId || 'simulated',
        tier: creditBalance.tier
      }),
      new Date().toISOString()
    ]);
    
    // Get updated balance
    const updatedBalance = await getUserCredits(userId);
    
    res.json({
      success: true,
      message: `Successfully purchased ${credits} credits`,
      balance: updatedBalance
    });
  } catch (error) {
    console.error('Error purchasing credits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to purchase credits'
    });
  }
});

/**
 * GET /api/credits/transactions
 * Get user's credit transaction history
 */
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        action,
        credits_used,
        credits_remaining,
        metadata,
        created_at
      FROM credit_transactions 
      WHERE user_id = $1
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `, [userId, parseInt(limit), parseInt(offset)]);
    
    const transactions = result.rows;
    
    // Parse metadata for each transaction
    const formattedTransactions = transactions.map(tx => ({
      ...tx,
      metadata: JSON.parse(tx.metadata || '{}')
    }));
    
    res.json({
      success: true,
      transactions: formattedTransactions
    });
  } catch (error) {
    console.error('Error fetching credit transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch credit transactions'
    });
  }
});

/**
 * POST /api/credits/research-session
 * Start or manage a research session
 */
router.post('/research-session', authenticateToken, async (req, res) => {
  try {
    const { action, symbol, sessionId } = req.body;
    const userId = req.user.id;
    
    if (action === 'start') {
      // Create new research session
      const sessionData = {
        id: `session_${Date.now()}_${userId}`,
        symbol: symbol || 'UNKNOWN',
        startTime: new Date().toISOString(),
        creditsUsed: 0,
        queries: 0,
        status: 'active'
      };
      
      // In a real implementation, you would store this in the database
      console.log('🔬 Creating research session:', sessionData);
      
      res.json({
        success: true,
        session: sessionData
      });
    } else if (action === 'pause' || action === 'complete') {
      // Update session status
      console.log(`📊 Research session ${sessionId} ${action}ed`);
      
      res.json({
        success: true,
        message: `Session ${action}ed successfully`
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid action'
      });
    }
  } catch (error) {
    console.error('Error managing research session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to manage research session'
    });
  }
});

/**
 * POST /api/credits/unlock-component
 * Unlock a component by deducting credits (with session persistence)
 */
router.post('/unlock-component', authenticateToken, async (req, res) => {
  try {
    const { component, cost, sessionDuration } = req.body;
    const userId = req.user.id;
    
    // Validate input
    if (!component || !cost || cost <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid component or cost'
      });
    }
    
    // Get user's tier for session duration
    const userResult = await pool.query(
      'SELECT tier, monthly_credits, credits_used, credits_purchased, credits_reset_date FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    
    // Check for existing active session for this component
    const existingSession = await pool.query(
      'SELECT session_id, expires_at, credits_used FROM research_sessions WHERE user_id = $1 AND component = $2 AND status = $3 AND expires_at > CURRENT_TIMESTAMP',
      [userId, component, 'active']
    );
    
    if (existingSession.rows.length > 0) {
      const session = existingSession.rows[0];
      const timeRemaining = new Date(session.expires_at) - new Date();
      const hoursRemaining = Math.round(timeRemaining / (1000 * 60 * 60) * 10) / 10;
      
      return res.json({
        success: true,
        message: `Component already unlocked in active session`,
        creditsUsed: 0,
        sessionId: session.session_id,
        expiresAt: session.expires_at,
        timeRemaining: hoursRemaining,
        existingSession: true
      });
    }
    
    // Calculate session duration based on tier if not provided
    const tierSessionDurations = {
      free: 30 * 60 * 1000,        // 30 minutes
      pro: 2 * 60 * 60 * 1000,     // 2 hours
      elite: 4 * 60 * 60 * 1000,   // 4 hours
      institutional: 8 * 60 * 60 * 1000 // 8 hours
    };
    
    const defaultDuration = tierSessionDurations[user.tier.toLowerCase()] || tierSessionDurations.free;
    const finalSessionDuration = sessionDuration || defaultDuration;
    
    // Check if user has sufficient credits (existing logic)
    const totalCredits = user.monthly_credits + (user.credits_purchased || 0);
    const remainingCredits = totalCredits - user.credits_used;
    
    if (remainingCredits < cost) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        required: cost,
        remaining: remainingCredits
      });
    }
    
    // Begin transaction for atomic operation
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Deduct credits
      const result = await client.query(
        'UPDATE users SET credits_used = credits_used + $1 WHERE id = $2 RETURNING monthly_credits, credits_used, credits_purchased',
        [cost, userId]
      );
      
      const updatedUser = result.rows[0];
      const newTotalCredits = updatedUser.monthly_credits + (updatedUser.credits_purchased || 0);
      const newRemainingCredits = newTotalCredits - updatedUser.credits_used;
      
      // Generate session ID and calculate expiry
      const sessionId = `session_${userId}_${component}_${Date.now()}`;
      const expiresAt = new Date(Date.now() + finalSessionDuration);
      
      // Create research session
      await client.query(`
        INSERT INTO research_sessions (
          user_id, 
          session_id, 
          component, 
          credits_used, 
          expires_at,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        userId,
        sessionId,
        component,
        cost,
        expiresAt,
        JSON.stringify({
          tier: user.tier,
          component_cost: cost,
          session_duration_ms: finalSessionDuration
        })
      ]);
      
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
        `unlock_${component}`,
        cost,
        newRemainingCredits,
        JSON.stringify({
          component,
          tier: user.tier,
          component_cost: cost,
          session_id: sessionId,
          expires_at: expiresAt
        }),
        new Date().toISOString()
      ]);
      
      // Log the activity
      await client.query(
        `INSERT INTO activities (user_id, activity_type, title, description)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          'component_unlock',
          `Unlocked ${component}`,
          `${cost} credits used to unlock ${component} component for ${Math.round(finalSessionDuration / (1000 * 60 * 60))} hours`
        ]
      );
      
      await client.query('COMMIT');
      
      const hoursUnlocked = Math.round(finalSessionDuration / (1000 * 60 * 60) * 10) / 10;
      
      console.log(`💳 Component unlocked - User: ${userId}, Component: ${component}, Cost: ${cost}, Session: ${hoursUnlocked}h, Remaining: ${newRemainingCredits}`);
      
      res.json({
        success: true,
        message: `Successfully unlocked ${component}`,
        creditsUsed: cost,
        creditsRemaining: newRemainingCredits,
        component,
        sessionId,
        expiresAt,
        sessionDurationHours: hoursUnlocked,
        existingSession: false
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error unlocking component:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlock component'
    });
  }
});

/**
 * GET /api/credits/active-sessions
 * Get user's active unlock sessions
 */
router.get('/active-sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Clean up expired sessions first
    await pool.query('SELECT cleanup_expired_sessions()');
    
    // Get active sessions
    const activeSessions = await pool.query(
      'SELECT component, session_id, expires_at, credits_used, unlocked_at FROM research_sessions WHERE user_id = $1 AND status = $2 AND expires_at > CURRENT_TIMESTAMP ORDER BY unlocked_at DESC',
      [userId, 'active']
    );
    
    // Calculate time remaining for each session
    const sessionsWithTimeRemaining = activeSessions.rows.map(session => {
      const timeRemaining = new Date(session.expires_at) - new Date();
      const hoursRemaining = Math.max(0, Math.round(timeRemaining / (1000 * 60 * 60) * 10) / 10);
      
      return {
        ...session,
        timeRemainingHours: hoursRemaining,
        isExpired: timeRemaining <= 0
      };
    });
    
    res.json({
      success: true,
      activeSessions: sessionsWithTimeRemaining
    });
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active sessions'
    });
  }
});

/**
 * GET /api/credits/cleanup-status
 * Get session and cache cleanup status
 */
router.get('/cleanup-status', authenticateToken, async (req, res) => {
  try {
    const { sessionCleanupScheduler } = require('../utils/sessionCleanupScheduler');
    const stats = await sessionCleanupScheduler.getCleanupStats();
    
    if (stats.success) {
      res.json({
        success: true,
        ...stats
      });
    } else {
      res.status(500).json({
        success: false,
        error: stats.error
      });
    }
  } catch (error) {
    console.error('Error getting cleanup status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cleanup status'
    });
  }
});

/**
 * POST /api/credits/manual-cleanup
 * Trigger manual cleanup of expired sessions and cache
 */
router.post('/manual-cleanup', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role; // Assuming admin role checking exists
    
    // Only allow admins to trigger manual cleanup (you can adjust this)
    // if (userRole !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Insufficient permissions'
    //   });
    // }
    
    const { sessionCleanupScheduler } = require('../utils/sessionCleanupScheduler');
    const result = await sessionCleanupScheduler.runManualCleanup();
    
    res.json({
      success: true,
      message: 'Manual cleanup completed',
      results: result
    });
  } catch (error) {
    console.error('Error running manual cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run manual cleanup'
    });
  }
});

/**
 * GET /api/credits/component-access/:component
 * Check if user has access to a specific component
 */
router.get('/component-access/:component', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const component = req.params.component;
    
    if (!component) {
      return res.status(400).json({
        success: false,
        error: 'Component parameter is required'
      });
    }
    
    // Clean up expired sessions first
    await pool.query('SELECT cleanup_expired_sessions()');
    
    // Check for active session for this component
    const sessionResult = await pool.query(
      'SELECT session_id, component, credits_used, expires_at, status, metadata FROM research_sessions WHERE user_id = $1 AND component = $2 AND status = $3 AND expires_at > CURRENT_TIMESTAMP ORDER BY unlocked_at DESC LIMIT 1',
      [userId, component, 'active']
    );
    
    const hasAccess = sessionResult.rows.length > 0;
    const session = hasAccess ? sessionResult.rows[0] : null;
    
    // Calculate time remaining if there's an active session
    let timeRemainingHours = 0;
    if (session) {
      const timeRemaining = new Date(session.expires_at) - new Date();
      timeRemainingHours = Math.max(0, Math.round(timeRemaining / (1000 * 60 * 60) * 10) / 10);
    }
    
    res.json({
      success: true,
      hasAccess,
      component,
      session: session ? {
        session_id: session.session_id,
        component: session.component,
        credits_used: session.credits_used,
        expires_at: session.expires_at,
        status: session.status,
        metadata: session.metadata,
        timeRemainingHours
      } : null
    });
  } catch (error) {
    console.error('Error checking component access:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check component access'
    });
  }
});

/**
 * GET /api/credits/session-debug/:userId?
 * Debug endpoint to check specific user's sessions
 */
router.get('/session-debug/:userId?', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.id;
    
    // Only allow users to debug their own sessions unless admin
    if (targetUserId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Can only debug your own sessions'
      });
    }
    
    // Get detailed session information
    const sessions = await pool.query(`
      SELECT 
        session_id,
        component,
        status,
        credits_used,
        unlocked_at,
        expires_at,
        EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))/3600 as hours_remaining,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - unlocked_at))/3600 as hours_since_unlock,
        metadata
      FROM research_sessions 
      WHERE user_id = $1
      ORDER BY unlocked_at DESC
      LIMIT 20
    `, [targetUserId]);
    
    // Get cache data for this user
    const cacheData = await pool.query(`
      SELECT 
        query_type,
        tickers,
        fetched_at,
        expires_at,
        EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))/60 as minutes_remaining,
        credits_consumed
      FROM sentiment_research_data srd
      JOIN research_sessions rs ON srd.session_id = rs.session_id
      WHERE srd.user_id = $1
      ORDER BY srd.fetched_at DESC
      LIMIT 20
    `, [targetUserId]);
    
    res.json({
      success: true,
      userId: targetUserId,
      sessions: sessions.rows.map(session => ({
        ...session,
        hoursRemaining: Math.round(session.hours_remaining * 100) / 100,
        hoursSinceUnlock: Math.round(session.hours_since_unlock * 100) / 100,
        isExpired: session.hours_remaining <= 0
      })),
      cacheEntries: cacheData.rows.map(entry => ({
        ...entry,
        minutesRemaining: Math.round(entry.minutes_remaining * 100) / 100,
        isExpired: entry.minutes_remaining <= 0
      }))
    });
  } catch (error) {
    console.error('Error debugging sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to debug sessions'
    });
  }
});

module.exports = router; 