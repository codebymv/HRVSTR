/**
 * User SEC Data Cache Service
 * Handles storing and retrieving SEC data per user with tier-based expiration
 */
const db = require('../database/db');
const secService = require('./secService');

/**
 * Cache configuration for SEC data
 */
const SEC_CACHE_CONFIG = {
  // Cache TTL by tier (in seconds) - Action-oriented limits
  FREE_TIER_TTL: 1 * 60 * 60,       // 1 hour for free tier (encourages action)
  PRO_TIER_TTL: 2 * 60 * 60,        // 2 hours for pro tier (moderate window)
  ELITE_TIER_TTL: 4 * 60 * 60,      // 4 hours for elite tier (extended window)
  INSTITUTIONAL_TIER_TTL: 30 * 60,  // 30 minutes for institutional (ultra-fresh data)
  
  // Default limits by data type and tier
  LIMITS: {
    FREE: {
      insider_trades: 10,
      institutional_holdings: 5,
      parallel_requests: 1
    },
    PRO: {
      insider_trades: 50,
      institutional_holdings: 25,
      parallel_requests: 2
    },
    ELITE: {
      insider_trades: 200,
      institutional_holdings: 100,
      parallel_requests: 3
    },
    INSTITUTIONAL: {
      insider_trades: 1000,
      institutional_holdings: 500,
      parallel_requests: 5
    }
  }
};

/**
 * Check if user has valid cached SEC data
 * @param {string} userId - User UUID
 * @param {string} dataType - 'insider_trades' or 'institutional_holdings'
 * @param {string} timeRange - Time range (1d, 3d, 1w, 1m, 3m, 6m)
 * @returns {Promise<Object|null>} Cached data or null if not found/expired
 */
async function getCachedSecData(userId, dataType, timeRange) {
  try {
    console.log(`[userSecCache] Checking cache for user ${userId}, type: ${dataType}, range: ${timeRange}`);
    
    const query = `
      SELECT 
        usc.data_json,
        usc.metadata,
        usc.expires_at,
        usc.credits_used,
        usc.created_at,
        EXTRACT(EPOCH FROM (usc.expires_at - CURRENT_TIMESTAMP)) as seconds_until_expiry
      FROM user_sec_cache usc
      WHERE usc.user_id = $1 
        AND usc.data_type = $2 
        AND usc.time_range = $3
        AND usc.expires_at > CURRENT_TIMESTAMP
    `;
    
    const result = await db.query(query, [userId, dataType, timeRange]);
    
    if (result.rows.length === 0) {
      console.log(`[userSecCache] No valid cache found for user ${userId}`);
      return null;
    }
    
    const cachedData = result.rows[0];
    console.log(`[userSecCache] Found valid cache for user ${userId}, expires in ${Math.round(cachedData.seconds_until_expiry)} seconds`);
    
    return {
      data: cachedData.data_json,
      metadata: cachedData.metadata,
      expiresAt: cachedData.expires_at,
      creditsUsed: cachedData.credits_used,
      fromCache: true,
      secondsUntilExpiry: Math.round(cachedData.seconds_until_expiry)
    };
  } catch (error) {
    console.error('[userSecCache] Error checking cached data:', error);
    return null;
  }
}

/**
 * Store SEC data in user cache
 * @param {string} userId - User UUID
 * @param {string} dataType - 'insider_trades' or 'institutional_holdings'
 * @param {string} timeRange - Time range
 * @param {Object} data - SEC data to cache
 * @param {number} creditsUsed - Credits consumed for this data
 * @param {string} userTier - User's tier for expiration calculation
 * @returns {Promise<boolean>} Success status
 */
async function cacheSecData(userId, dataType, timeRange, data, creditsUsed, userTier) {
  try {
    console.log(`[userSecCache] Caching SEC data for user ${userId}, type: ${dataType}, range: ${timeRange}`);
    
    // Calculate expiration based on tier
    const expirationQuery = `SELECT get_sec_cache_expiration($1::user_tier_enum, $2::sec_data_type_enum) as expiration`;
    const expirationResult = await db.query(expirationQuery, [userTier, dataType]);
    const expirationInterval = expirationResult.rows[0].expiration;
    
    // Prepare metadata
    const metadata = {
      dataCount: Array.isArray(data.insiderTrades) ? data.insiderTrades.length : 
                 Array.isArray(data.institutionalHoldings) ? data.institutionalHoldings.length : 0,
      fetchedAt: new Date().toISOString(),
      userTier,
      timeRange,
      source: data.source || 'sec-edgar'
    };
    
    // Insert or update cache entry
    const cacheQuery = `
      INSERT INTO user_sec_cache (user_id, data_type, time_range, data_json, metadata, expires_at, credits_used)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP + $6::INTERVAL, $7)
      ON CONFLICT (user_id, data_type, time_range)
      DO UPDATE SET
        data_json = EXCLUDED.data_json,
        metadata = EXCLUDED.metadata,
        expires_at = EXCLUDED.expires_at,
        credits_used = EXCLUDED.credits_used,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, expires_at
    `;
    
    const cacheResult = await db.query(cacheQuery, [
      userId, dataType, timeRange, JSON.stringify(data), JSON.stringify(metadata), expirationInterval, creditsUsed
    ]);
    
    const cacheId = cacheResult.rows[0].id;
    console.log(`[userSecCache] Successfully cached data with ID ${cacheId}, expires at ${cacheResult.rows[0].expires_at}`);
    
    // Store individual records for detailed tracking
    if (dataType === 'insider_trades' && data.insiderTrades) {
      await storeIndividualInsiderTrades(cacheId, userId, data.insiderTrades);
    } else if (dataType === 'institutional_holdings' && data.institutionalHoldings) {
      await storeIndividualInstitutionalHoldings(cacheId, userId, data.institutionalHoldings);
    }
    
    return true;
  } catch (error) {
    console.error('[userSecCache] Error caching SEC data:', error);
    return false;
  }
}

/**
 * Store individual insider trades records
 */
async function storeIndividualInsiderTrades(cacheId, userId, trades) {
  try {
    // Clear existing trades for this cache entry
    await db.query('DELETE FROM user_sec_insider_trades WHERE cache_id = $1', [cacheId]);
    
    // Insert new trades
    for (const trade of trades) {
      const query = `
        INSERT INTO user_sec_insider_trades (
          cache_id, user_id, ticker, insider_name, title, trade_type, 
          shares, price, value, filing_date, transaction_date, form_type, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `;
      
      await db.query(query, [
        cacheId, userId, trade.ticker, trade.insiderName, trade.title, trade.tradeType,
        trade.shares, trade.price, trade.value, trade.filingDate, trade.transactionDate,
        trade.formType, JSON.stringify(trade)
      ]);
    }
    
    console.log(`[userSecCache] Stored ${trades.length} individual insider trades`);
  } catch (error) {
    console.error('[userSecCache] Error storing individual insider trades:', error);
  }
}

/**
 * Store individual institutional holdings records
 */
async function storeIndividualInstitutionalHoldings(cacheId, userId, holdings) {
  try {
    // Clear existing holdings for this cache entry
    await db.query('DELETE FROM user_sec_institutional_holdings WHERE cache_id = $1', [cacheId]);
    
    // Insert new holdings
    for (const holding of holdings) {
      const query = `
        INSERT INTO user_sec_institutional_holdings (
          cache_id, user_id, ticker, institution_name, shares_held, value_held,
          percent_change, percentage_ownership, quarterly_change, filing_date,
          quarter_end, form_type, cik, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `;
      
      await db.query(query, [
        cacheId, userId, holding.ticker, holding.institutionName, 
        holding.sharesHeld || holding.totalSharesHeld, 
        holding.valueHeld || holding.totalValueHeld,
        holding.percentChange, holding.percentageOwnership, holding.quarterlyChange,
        holding.filingDate, holding.quarterEnd, holding.formType, holding.cik,
        JSON.stringify(holding)
      ]);
    }
    
    console.log(`[userSecCache] Stored ${holdings.length} individual institutional holdings`);
  } catch (error) {
    console.error('[userSecCache] Error storing individual institutional holdings:', error);
  }
}

/**
 * Get SEC data for user - check cache first, fetch if needed
 * @param {string} userId - User UUID
 * @param {string} userTier - User's tier
 * @param {string} dataType - 'insider_trades' or 'institutional_holdings'
 * @param {string} timeRange - Time range
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 * @param {Function} progressCallback - Progress callback for live updates
 * @returns {Promise<Object>} SEC data with metadata
 */
async function getSecDataForUser(userId, userTier, dataType, timeRange, forceRefresh = false, progressCallback = null) {
  try {
    console.log(`[userSecCache] Getting SEC data for user ${userId}, type: ${dataType}, tier: ${userTier}`);
    
    // Check if user has access to this data type
    if (dataType === 'institutional_holdings' && userTier === 'free') {
      return {
        success: false,
        error: 'TIER_RESTRICTION',
        message: 'Institutional holdings data requires Pro tier or higher',
        userMessage: 'Upgrade to Pro to access institutional holdings data',
        tierRequired: 'pro'
      };
    }

    // IMPORTANT: Check for active unlock session first
    const componentName = dataType === 'insider_trades' ? 'insiderTrading' : 'institutionalHoldings';
    const sessionQuery = `
      SELECT session_id, expires_at, credits_used, metadata
      FROM research_sessions 
      WHERE user_id = $1 
        AND component = $2 
        AND status = 'active' 
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY unlocked_at DESC 
      LIMIT 1
    `;
    
    const sessionResult = await db.query(sessionQuery, [userId, componentName]);
    const hasActiveSession = sessionResult.rows.length > 0;
    
    if (hasActiveSession) {
      const session = sessionResult.rows[0];
      const timeRemaining = new Date(session.expires_at) - new Date();
      const hoursRemaining = Math.round(timeRemaining / (1000 * 60 * 60) * 10) / 10;
      
      console.log(`[userSecCache] User ${userId} has active session for ${componentName}, ${hoursRemaining}h remaining`);
      
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedData = await getCachedSecData(userId, dataType, timeRange);
        if (cachedData) {
          console.log(`[userSecCache] Returning cached data for user ${userId} with active session`);
          
          if (progressCallback) {
            progressCallback({
              stage: `${dataType === 'insider_trades' ? 'Insider trades' : 'Institutional holdings'} loaded from cache`,
              progress: 100,
              total: cachedData.metadata?.dataCount || 0,
              current: cachedData.metadata?.dataCount || 0,
              fromCache: true,
              hasActiveSession: true
            });
          }
          
          return {
            success: true,
            data: cachedData.data,
            metadata: cachedData.metadata,
            fromCache: true,
            expiresAt: cachedData.expiresAt,
            secondsUntilExpiry: cachedData.secondsUntilExpiry,
            hasActiveSession: true,
            creditsUsed: 0 // No credits used for active sessions
          };
        }
      }
      
      // If active session but no cache, fetch data without charging credits
      console.log(`[userSecCache] Active session found but no cache, fetching data for free for user ${userId}`);
      
      // Fetch fresh data (no credit deduction for active sessions)
      let freshData;
      if (dataType === 'insider_trades') {
        const result = await secService.getInsiderTrades(timeRange, 100, progressCallback);
        if (!result.success) {
          return result;
        }
        freshData = {
          timeRange,
          insiderTrades: result.data,
          count: result.count,
          source: 'sec-edgar',
          refreshed: true,
          lastUpdated: new Date().toISOString()
        };
      } else if (dataType === 'institutional_holdings') {
        const holdings = await secService.getInstitutionalHoldings(timeRange, 50);
        freshData = {
          timeRange,
          institutionalHoldings: holdings,
          count: holdings.length,
          source: 'sec-edgar',
          refreshed: true,
          lastUpdated: new Date().toISOString()
        };
      }
      
      // Cache the fresh data (no credits charged)
      await cacheSecData(userId, dataType, timeRange, freshData, 0, userTier);
      
      console.log(`[userSecCache] Successfully fetched and cached ${dataType} for user ${userId} with active session (no credits charged)`);
      
      return {
        success: true,
        data: freshData,
        creditsUsed: 0,
        fromCache: false,
        freshlyFetched: true,
        hasActiveSession: true
      };
    }

    // No active session - proceed with normal credit-based flow
    console.log(`[userSecCache] No active session found for user ${userId}, proceeding with credit-based access`);
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = await getCachedSecData(userId, dataType, timeRange);
      if (cachedData) {
        console.log(`[userSecCache] Returning cached data for user ${userId}`);
        
        if (progressCallback) {
          progressCallback({
            stage: `${dataType === 'insider_trades' ? 'Insider trades' : 'Institutional holdings'} loaded from cache`,
            progress: 100,
            total: cachedData.metadata?.dataCount || 0,
            current: cachedData.metadata?.dataCount || 0,
            fromCache: true
          });
        }
        
        return {
          success: true,
          data: cachedData.data,
          metadata: cachedData.metadata,
          fromCache: true,
          expiresAt: cachedData.expiresAt,
          secondsUntilExpiry: cachedData.secondsUntilExpiry,
          hasActiveSession: false
        };
      }
    }
    
    // No cache available, need to fetch fresh data and charge credits
    let creditsUsed = 0;
    
    // Calculate credits cost
    const creditsQuery = `SELECT get_sec_data_credits_cost($1::user_tier_enum, $2::sec_data_type_enum, $3) as cost`;
    const creditsResult = await db.query(creditsQuery, [userTier, dataType, timeRange]);
    const creditsRequired = creditsResult.rows[0].cost;
    
    // Check if user has enough credits
    const userQuery = `
      SELECT 
        monthly_credits, 
        credits_used, 
        credits_purchased,
        (monthly_credits + COALESCE(credits_purchased, 0) - credits_used) as credits_remaining
      FROM users 
      WHERE id = $1
    `;
    const userResult = await db.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return {
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      };
    }
    
    const user = userResult.rows[0];
    const availableCredits = user.credits_remaining;
    
    if (availableCredits < creditsRequired) {
      return {
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        message: 'Insufficient credits for this request',
        userMessage: `This request requires ${creditsRequired} credits, but you have ${availableCredits} available`,
        creditsRequired,
        creditsAvailable: availableCredits
      };
    }

    // Deduct credits by incrementing credits_used
    const updateCreditsQuery = `UPDATE users SET credits_used = credits_used + $1 WHERE id = $2`;
    await db.query(updateCreditsQuery, [creditsRequired, userId]);
    
    creditsUsed = creditsRequired;
    
    // Log credit transaction
    const logQuery = `
      INSERT INTO credit_transactions (user_id, action, credits_used, credits_remaining, metadata)
      VALUES ($1, $2, $3, (
        SELECT (monthly_credits + COALESCE(credits_purchased, 0) - credits_used) 
        FROM users WHERE id = $1
      ), $4)
    `;
    await db.query(logQuery, [
      userId, 
      `sec_${dataType}`, 
      creditsRequired, 
      JSON.stringify({ dataType, timeRange, hasActiveSession: false })
    ]);
    
    console.log(`[userSecCache] Deducted ${creditsRequired} credits for user ${userId}`);

    // Fetch fresh data
    console.log(`[userSecCache] Fetching fresh ${dataType} data for user ${userId}`);
    
    let freshData;
    if (dataType === 'insider_trades') {
      const result = await secService.getInsiderTrades(timeRange, 100, progressCallback);
      if (!result.success) {
        return result;
      }
      freshData = {
        timeRange,
        insiderTrades: result.data,
        count: result.count,
        source: 'sec-edgar',
        refreshed: true,
        lastUpdated: new Date().toISOString()
      };
    } else if (dataType === 'institutional_holdings') {
      const holdings = await secService.getInstitutionalHoldings(timeRange, 50);
      freshData = {
        timeRange,
        institutionalHoldings: holdings,
        count: holdings.length,
        source: 'sec-edgar',
        refreshed: true,
        lastUpdated: new Date().toISOString()
      };
    }
    
    // Cache the fresh data
    await cacheSecData(userId, dataType, timeRange, freshData, creditsUsed, userTier);
    
    console.log(`[userSecCache] Successfully fetched and cached ${dataType} for user ${userId}`);
    
    return {
      success: true,
      data: freshData,
      creditsUsed,
      fromCache: false,
      freshlyFetched: true,
      hasActiveSession: false
    };
    
  } catch (error) {
    console.error('[userSecCache] Error getting SEC data for user:', error);
    return {
      success: false,
      error: 'CACHE_SERVICE_ERROR',
      message: 'Error retrieving SEC data',
      technical: error.message
    };
  }
}

/**
 * Clean up expired cache entries
 * @returns {Promise<number>} Number of entries cleaned up
 */
async function cleanupExpiredCache() {
  try {
    const result = await db.query('SELECT cleanup_expired_sec_cache()');
    const deletedCount = result.rows[0].cleanup_expired_sec_cache;
    console.log(`[userSecCache] Cleaned up ${deletedCount} expired cache entries`);
    return deletedCount;
  } catch (error) {
    console.error('[userSecCache] Error cleaning up expired cache:', error);
    return 0;
  }
}

/**
 * Get user's SEC cache status
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Cache status information
 */
async function getUserCacheStatus(userId) {
  try {
    const query = `
      SELECT 
        data_type,
        time_range,
        expires_at,
        credits_used,
        metadata,
        EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)) as seconds_until_expiry,
        CASE WHEN expires_at > CURRENT_TIMESTAMP THEN true ELSE false END as is_active
      FROM user_sec_cache
      WHERE user_id = $1
      ORDER BY data_type, time_range
    `;
    
    const result = await db.query(query, [userId]);
    
    const cacheStatus = {
      insider_trades: {},
      institutional_holdings: {}
    };
    
    result.rows.forEach(row => {
      cacheStatus[row.data_type][row.time_range] = {
        expiresAt: row.expires_at,
        secondsUntilExpiry: Math.round(row.seconds_until_expiry),
        isActive: row.is_active,
        creditsUsed: row.credits_used,
        dataCount: row.metadata?.dataCount || 0
      };
    });
    
    return cacheStatus;
  } catch (error) {
    console.error('[userSecCache] Error getting cache status:', error);
    return { insider_trades: {}, institutional_holdings: {} };
  }
}

module.exports = {
  getCachedSecData,
  cacheSecData,
  getSecDataForUser,
  cleanupExpiredCache,
  getUserCacheStatus
}; 