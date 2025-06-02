const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { getUserTierInfo, TIER_LIMITS, CREDIT_COSTS } = require('../middleware/tierMiddleware');
const { pool } = require('../config/data-sources');

/**
 * GET /api/subscription/tier-info
 * Get current user's tier information
 */
router.get('/tier-info', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const tierInfo = await getUserTierInfo(userId);

    if (!tierInfo) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate days until credit reset
    const now = new Date();
    const resetDate = new Date(tierInfo.credits.resetDate);
    const daysUntilReset = Math.ceil((resetDate - now) / (1000 * 60 * 60 * 24));

    // Get current watchlist count
    const watchlistResult = await pool.query(
      'SELECT COUNT(*) FROM watchlist WHERE user_id = $1',
      [userId]
    );
    const watchlistCount = parseInt(watchlistResult.rows[0].count);

    // Add cache-busting headers to prevent stale tier data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString(),
      'ETag': `"${userId}-${tierInfo.tier}-${Date.now()}"`
    });

    res.json({
      success: true,
      data: {
        ...tierInfo,
        credits: {
          ...tierInfo.credits,
          daysUntilReset
        },
        usage: {
          watchlist: {
            current: watchlistCount,
            limit: tierInfo.limits.watchlistLimit
          }
        }
      }
    });

  } catch (error) {
    console.error('Error getting tier info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/subscription/available-tiers
 * Get all available subscription tiers with their features
 */
router.get('/available-tiers', (req, res) => {
  try {
    const tiers = Object.keys(TIER_LIMITS).map(tierName => ({
      name: tierName,
      ...TIER_LIMITS[tierName],
      pricing: {
        free: { price: 0, period: 'forever' },
        pro: { price: 19, period: 'month' },
        elite: { price: 49, period: 'month' },
        institutional: { price: 199, period: 'month' }
      }[tierName]
    }));

    res.json({
      success: true,
      data: {
        tiers,
        creditCosts: CREDIT_COSTS
      }
    });

  } catch (error) {
    console.error('Error getting available tiers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/subscription/simulate-upgrade
 * Simulate upgrading to a different tier (for prototyping)
 */
router.post('/simulate-upgrade', authenticateToken, async (req, res) => {
  try {
    const { tier } = req.body;
    const userId = req.user.id;

    // Validate tier
    if (!TIER_LIMITS[tier]) {
      return res.status(400).json({ 
        error: 'Invalid tier',
        availableTiers: Object.keys(TIER_LIMITS)
      });
    }

    const tierLimits = TIER_LIMITS[tier];
    const newResetDate = new Date();
    newResetDate.setMonth(newResetDate.getMonth() + 1);

    // Update user's tier and reset credits
    await pool.query(
      `UPDATE users SET 
        tier = $1,
        credits_used = 0,
        monthly_credits = $2,
        credits_reset_date = $3
      WHERE id = $4`,
      [tier, tierLimits.monthlyCredits, newResetDate, userId]
    );

    // Log the tier change
    await pool.query(
      `INSERT INTO activities (user_id, activity_type, title, description)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        'tier_change',
        `Upgraded to ${tier.charAt(0).toUpperCase() + tier.slice(1)}`,
        `Successfully upgraded subscription tier to ${tier}`
      ]
    );

    const updatedTierInfo = await getUserTierInfo(userId);

    res.json({
      success: true,
      message: `Successfully upgraded to ${tier} tier`,
      data: updatedTierInfo
    });

  } catch (error) {
    console.error('Error simulating upgrade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/subscription/add-credits
 * Add credits to user's account (for prototyping)
 */
router.post('/add-credits', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid credit amount' });
    }

    // Add credits to user's account (as purchased credits)
    await pool.query(
      'UPDATE users SET credits_purchased = COALESCE(credits_purchased, 0) + $1 WHERE id = $2',
      [amount, userId]
    );

    // Log the credit addition
    await pool.query(
      `INSERT INTO activities (user_id, activity_type, title, description)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        'credits_added',
        `Added ${amount} Credits`,
        `${amount} credits added to account`
      ]
    );

    const updatedTierInfo = await getUserTierInfo(userId);

    res.json({
      success: true,
      message: `Successfully added ${amount} credits`,
      data: updatedTierInfo
    });

  } catch (error) {
    console.error('Error adding credits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/subscription/usage-stats
 * Get user's usage statistics
 */
router.get('/usage-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get recent activity related to credit usage
    const activityResult = await pool.query(
      `SELECT activity_type, title, description, created_at 
       FROM activities 
       WHERE user_id = $1 
       AND (activity_type LIKE '%credit%' OR activity_type LIKE '%tier%')
       ORDER BY created_at DESC 
       LIMIT 10`,
      [userId]
    );

    // Get current tier info
    const tierInfo = await getUserTierInfo(userId);

    res.json({
      success: true,
      data: {
        tierInfo,
        recentActivity: activityResult.rows,
        creditCosts: CREDIT_COSTS
      }
    });

  } catch (error) {
    console.error('Error getting usage stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 