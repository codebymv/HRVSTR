/**
 * User Sentiment Cache Service
 * Manages user-specific sentiment data caching with database backend
 * Follows the same architecture pattern as userSecCacheService.js and userEarningsCacheService.js
 */
const { pool: db } = require('../config/data-sources');
const sentimentService = require('./sentimentService');

/**
 * Cache configuration for sentiment data
 */
const SENTIMENT_CACHE_CONFIG = {
  // Cache TTL by tier (in seconds) - Action-oriented limits
  FREE_TIER_TTL: 1 * 60 * 60,       // 1 hour for free tier (encourages action)
  PRO_TIER_TTL: 2 * 60 * 60,        // 2 hours for pro tier (moderate window)
  ELITE_TIER_TTL: 4 * 60 * 60,      // 4 hours for elite tier (extended window)
  INSTITUTIONAL_TIER_TTL: 30 * 60,  // 30 minutes for institutional (ultra-fresh data)
  
  // Component mapping for research_sessions integration
  // 🔧 FIX: Map all sentiment data endpoints to 'scores' component
  // This ensures that unlocking sentiment scores provides access to all required data sources
  COMPONENT_MAPPING: {
    'reddit_tickers': 'scores',
    'yahoo_tickers': 'scores', 
    'finviz_tickers': 'scores',
    'reddit_market': 'scores',
    'yahoo_market': 'scores',
    'finviz_market': 'scores',
    'combined_tickers': 'scores',
    'aggregated_market': 'scores'
  },
  
  // Data limits based on tier
  LIMITS: {
    FREE: {
      reddit_tickers: 10,
      yahoo_tickers: 5,
      finviz_tickers: 5,
      reddit_market: 1,
      yahoo_market: 1,
      finviz_market: 1
    },
    PRO: {
      reddit_tickers: 50,
      yahoo_tickers: 25,
      finviz_tickers: 25,
      reddit_market: 3,
      yahoo_market: 3,
      finviz_market: 3
    },
    ELITE: {
      reddit_tickers: 200,
      yahoo_tickers: 100,
      finviz_tickers: 100,
      reddit_market: 10,
      yahoo_market: 10,
      finviz_market: 10
    },
    INSTITUTIONAL: {
      reddit_tickers: -1, // unlimited
      yahoo_tickers: -1,
      finviz_tickers: -1,
      reddit_market: -1,
      yahoo_market: -1,
      finviz_market: -1
    }
  },
  
  // Credit costs for different data types and time ranges
  CREDIT_COSTS: {
    FREE: {
      reddit_tickers: { '1d': 3, '3d': 6, '1w': 10, '1m': 15, '3m': 25, '6m': 35 },
      yahoo_tickers: { '1d': 4, '3d': 8, '1w': 12, '1m': 18, '3m': 30, '6m': 40 },
      finviz_tickers: { '1d': 4, '3d': 8, '1w': 12, '1m': 18, '3m': 30, '6m': 40 },
      reddit_market: { '1d': 2, '3d': 4, '1w': 6, '1m': 10, '3m': 15, '6m': 20 },
      yahoo_market: { '1d': 2, '3d': 4, '1w': 6, '1m': 10, '3m': 15, '6m': 20 },
      finviz_market: { '1d': 2, '3d': 4, '1w': 6, '1m': 10, '3m': 15, '6m': 20 }
    },
    PRO: {
      reddit_tickers: { '1d': 1, '3d': 2, '1w': 3, '1m': 5, '3m': 8, '6m': 12 },
      yahoo_tickers: { '1d': 1, '3d': 2, '1w': 4, '1m': 6, '3m': 10, '6m': 15 },
      finviz_tickers: { '1d': 1, '3d': 2, '1w': 4, '1m': 6, '3m': 10, '6m': 15 },
      reddit_market: { '1d': 1, '3d': 1, '1w': 2, '1m': 3, '3m': 5, '6m': 8 },
      yahoo_market: { '1d': 1, '3d': 1, '1w': 2, '1m': 3, '3m': 5, '6m': 8 },
      finviz_market: { '1d': 1, '3d': 1, '1w': 2, '1m': 3, '3m': 5, '6m': 8 }
    },
    ELITE: {
      reddit_tickers: { '1d': 0, '3d': 0, '1w': 1, '1m': 1, '3m': 2, '6m': 3 },
      yahoo_tickers: { '1d': 0, '3d': 0, '1w': 1, '1m': 2, '3m': 3, '6m': 4 },
      finviz_tickers: { '1d': 0, '3d': 0, '1w': 1, '1m': 2, '3m': 3, '6m': 4 },
      reddit_market: { '1d': 0, '3d': 0, '1w': 0, '1m': 1, '3m': 1, '6m': 2 },
      yahoo_market: { '1d': 0, '3d': 0, '1w': 0, '1m': 1, '3m': 1, '6m': 2 },
      finviz_market: { '1d': 0, '3d': 0, '1w': 0, '1m': 1, '3m': 1, '6m': 2 }
    },
    INSTITUTIONAL: {
      reddit_tickers: { '1d': 0, '3d': 0, '1w': 0, '1m': 0, '3m': 0, '6m': 0 },
      yahoo_tickers: { '1d': 0, '3d': 0, '1w': 0, '1m': 0, '3m': 0, '6m': 0 },
      finviz_tickers: { '1d': 0, '3d': 0, '1w': 0, '1m': 0, '3m': 0, '6m': 0 },
      reddit_market: { '1d': 0, '3d': 0, '1w': 0, '1m': 0, '3m': 0, '6m': 0 },
      yahoo_market: { '1d': 0, '3d': 0, '1w': 0, '1m': 0, '3m': 0, '6m': 0 },
      finviz_market: { '1d': 0, '3d': 0, '1w': 0, '1m': 0, '3m': 0, '6m': 0 }
    }
  }
};

/**
 * Check for active unlock session in research_sessions table
 * @param {string} userId - User ID
 * @param {string} component - Component name
 * @returns {Promise<Object|null>} - Active session or null
 */
async function checkActiveUnlockSession(userId, component) {
  try {
    const query = `
      SELECT session_id, expires_at, credits_used, metadata, unlocked_at
      FROM research_sessions 
      WHERE user_id = $1 
        AND component = $2 
        AND status = 'active' 
        AND expires_at > NOW() AT TIME ZONE 'UTC'
      ORDER BY unlocked_at DESC 
      LIMIT 1
    `;
    
    const result = await db.query(query, [userId, component]);
    
    if (result.rows.length > 0) {
      const session = result.rows[0];
      const timeRemaining = new Date(session.expires_at) - new Date();
      const hoursRemaining = Math.round(timeRemaining / (1000 * 60 * 60) * 10) / 10;
      
      console.log(`🔓 [SENTIMENT CACHE] Active session found for user ${userId}, component: ${component}, ${hoursRemaining}h remaining`);
      
      return session;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ [SENTIMENT CACHE] Error checking active session for user ${userId}, component ${component}:`, error);
    return null;
  }
}

/**
 * Get user tier from database
 * @param {string} userId - User ID
 * @returns {Promise<string>} - User tier
 */
async function getUserTier(userId) {
  try {
    const query = 'SELECT tier FROM users WHERE id = $1';
    const result = await db.query(query, [userId]);
    
    if (result.rows.length > 0) {
      return result.rows[0].tier || 'free';
    }
    
    return 'free';
  } catch (error) {
    console.error(`❌ [SENTIMENT CACHE] Error getting user tier for ${userId}:`, error);
    return 'free';
  }
}

/**
 * Get user credits from database
 * @param {string} userId - User ID
 * @returns {Promise<number>} - User credits
 */
async function getUserCredits(userId) {
  try {
    const query = 'SELECT credits FROM users WHERE id = $1';
    const result = await db.query(query, [userId]);
    
    if (result.rows.length > 0) {
      return result.rows[0].credits || 0;
    }
    
    return 0;
  } catch (error) {
    console.error(`❌ [SENTIMENT CACHE] Error getting user credits for ${userId}:`, error);
    return 0;
  }
}

/**
 * Deduct credits from user account
 * @param {string} userId - User ID
 * @param {number} credits - Credits to deduct
 * @param {Object} metadata - Transaction metadata
 * @returns {Promise<Object>} - Deduction result
 */
async function deductUserCredits(userId, credits, metadata = {}) {
  try {
    const query = `
      UPDATE users 
      SET credits = credits - $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND credits >= $2
      RETURNING credits
    `;
    
    const result = await db.query(query, [userId, credits]);
    
    if (result.rows.length > 0) {
      console.log(`💳 [SENTIMENT CACHE] Deducted ${credits} credits from user ${userId}, remaining: ${result.rows[0].credits}`);
      
      // Log the transaction
      await db.query(`
        INSERT INTO credit_transactions (user_id, amount, type, description, metadata, created_at)
        VALUES ($1, $2, 'debit', $3, $4, CURRENT_TIMESTAMP)
      `, [
        userId,
        -credits,
        `Sentiment data access: ${metadata.component || 'unknown'}`,
        JSON.stringify(metadata)
      ]);
      
      return {
        success: true,
        remainingCredits: result.rows[0].credits
      };
    }
    
    return {
      success: false,
      error: 'INSUFFICIENT_CREDITS',
      message: 'Insufficient credits for this operation'
    };
  } catch (error) {
    console.error(`❌ [SENTIMENT CACHE] Error deducting credits for user ${userId}:`, error);
    return {
      success: false,
      error: 'DATABASE_ERROR',
      message: 'Failed to process credit deduction'
    };
  }
}

/**
 * Get cache TTL based on user tier
 * @param {string} tier - User tier
 * @returns {number} - TTL in seconds
 */
function getCacheTTL(tier) {
  switch (tier?.toLowerCase()) {
    case 'institutional':
      return SENTIMENT_CACHE_CONFIG.INSTITUTIONAL_TIER_TTL;
    case 'elite':
      return SENTIMENT_CACHE_CONFIG.ELITE_TIER_TTL;
    case 'pro':
      return SENTIMENT_CACHE_CONFIG.PRO_TIER_TTL;
    case 'free':
    default:
      return SENTIMENT_CACHE_CONFIG.FREE_TIER_TTL;
  }
}

/**
 * Get data limit based on tier and data type
 * @param {string} tier - User tier
 * @param {string} dataType - Type of data
 * @returns {number} - Data limit (-1 for unlimited)
 */
function getDataLimit(tier, dataType) {
  const tierKey = tier?.toUpperCase() || 'FREE';
  const limits = SENTIMENT_CACHE_CONFIG.LIMITS[tierKey] || SENTIMENT_CACHE_CONFIG.LIMITS.FREE;
  return limits[dataType] || limits.reddit_tickers;
}

/**
 * Get credit cost for sentiment data
 * @param {string} tier - User tier
 * @param {string} dataType - Type of data
 * @param {string} timeRange - Time range
 * @returns {number} - Credit cost
 */
function getCreditCost(tier, dataType, timeRange) {
  const tierKey = tier?.toUpperCase() || 'FREE';
  const costs = SENTIMENT_CACHE_CONFIG.CREDIT_COSTS[tierKey] || SENTIMENT_CACHE_CONFIG.CREDIT_COSTS.FREE;
  const dataTypeCosts = costs[dataType] || costs.reddit_tickers;
  return dataTypeCosts[timeRange] || dataTypeCosts['1w'];
}

/**
 * Generate cache key for sentiment data
 * @param {string} dataType - Type of data
 * @param {string} timeRange - Time range
 * @param {Object} options - Additional options (tickers, subreddits, etc.)
 * @returns {string} - Cache key
 */
function generateCacheKey(dataType, timeRange, options = {}) {
  const parts = [dataType, timeRange];
  
  if (options.tickers && Array.isArray(options.tickers) && options.tickers.length > 0) {
    // Sort tickers for consistent caching
    const sortedTickers = [...options.tickers].sort();
    parts.push(sortedTickers.join(','));
  }
  
  if (options.subreddits && Array.isArray(options.subreddits) && options.subreddits.length > 0) {
    // Sort subreddits for consistent caching
    const sortedSubreddits = [...options.subreddits].sort();
    parts.push(sortedSubreddits.join(','));
  }
  
  if (options.limit) {
    parts.push(`limit${options.limit}`);
  }
  
  const cacheKey = parts.join('_');
  
  // Ensure cache key length limit
  if (cacheKey.length > 255) {
    return cacheKey.substring(0, 250) + '_hash';
  }
  
  return cacheKey;
}

/**
 * Get cached sentiment data for user
 * @param {string} userId - User ID
 * @param {string} dataType - Type of data (reddit_tickers, yahoo_tickers, etc.)
 * @param {string} timeRange - Time range
 * @param {Object} options - Additional options
 * @returns {Promise<Object|null>} - Cached data or null
 */
async function getCachedSentimentData(userId, dataType, timeRange, options = {}) {
  try {
    const cacheKey = generateCacheKey(dataType, timeRange, options);
    console.log(`📋 [SENTIMENT CACHE LOOKUP] Searching for cache: user=${userId}, dataType=${dataType}, timeRange=${timeRange}, key=${cacheKey}`);
    
    const result = await db.query(`
      SELECT data_json, created_at, expires_at, metadata, id,
             EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_until_expiry
      FROM user_sentiment_cache
      WHERE user_id = $1 AND data_type = $2 AND time_range = $3 AND cache_key = $4 AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId, dataType, timeRange, cacheKey]);

    console.log(`📋 [SENTIMENT CACHE LOOKUP] Query returned ${result.rows.length} rows`);

    if (result.rows.length === 0) {
      // Check if there are any entries for this user (even expired ones) for debugging
      const allEntriesResult = await db.query(`
        SELECT id, data_type, cache_key, created_at, expires_at,
               EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_until_expiry,
               CASE WHEN expires_at > NOW() THEN 'active' ELSE 'expired' END as status
        FROM user_sentiment_cache
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `, [userId]);
      
      console.log(`📋 [SENTIMENT CACHE LOOKUP] User has ${allEntriesResult.rows.length} total cache entries:`);
      allEntriesResult.rows.forEach((entry, index) => {
        console.log(`📋 [SENTIMENT CACHE LOOKUP]   Entry ${index + 1}: ID=${entry.id}, type=${entry.data_type}, key=${entry.cache_key}, status=${entry.status}, expires_in=${Math.round(entry.seconds_until_expiry)}s`);
      });
      
      console.log(`📋 No valid cache found for user ${userId}, dataType: ${dataType}, key: ${cacheKey}`);
      return null;
    }

    const cachedData = result.rows[0];
    console.log(`📋 Cache HIT for user ${userId}, dataType: ${dataType}, key: ${cacheKey}, expires in ${Math.round(cachedData.seconds_until_expiry)} seconds`);
    
    // Handle format conversion for cached data
    let processedData = cachedData.data_json;
    
    // For market sentiment data, check if we have old nested format and convert it
    if (dataType.includes('_market')) {
      // If cached data has nested structure {data: {data: actualData}}, extract the inner data
      if (processedData && processedData.data && processedData.data.data) {
        console.log(`📋 [CACHE FORMAT FIX] Converting old nested format for ${dataType}`);
        processedData = processedData.data;
      }
    }
    
    return {
      data: processedData,
      metadata: {
        fromCache: true,
        cacheAge: Date.now() - new Date(cachedData.created_at).getTime(),
        expiresAt: cachedData.expires_at,
        secondsUntilExpiry: cachedData.seconds_until_expiry,
        ...cachedData.metadata
      }
    };
  } catch (error) {
    console.error(`❌ [SENTIMENT CACHE LOOKUP] Error getting cached sentiment data for user ${userId}:`, error);
    return null;
  }
}

/**
 * Store sentiment data in cache
 * @param {string} userId - User ID
 * @param {string} dataType - Type of data
 * @param {string} timeRange - Time range
 * @param {Object} data - Data to cache
 * @param {number} creditsUsed - Credits used for this data
 * @param {string} userTier - User tier
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} - Success status
 */
async function storeSentimentDataInCache(userId, dataType, timeRange, data, creditsUsed, userTier, options = {}) {
  try {
    const cacheKey = generateCacheKey(dataType, timeRange, options);
    const ttl = getCacheTTL(userTier);
    const expiresAt = new Date(Date.now() + ttl * 1000);
    
    console.log(`💾 [SENTIMENT CACHE STORE] Storing cache for user ${userId}, dataType: ${dataType}, key: ${cacheKey}, TTL: ${ttl}s`);
    
    // Prepare metadata
    const metadata = {
      dataCount: Array.isArray(data.data || data) ? (data.data || data).length : 1,
      fetchDuration: data.metadata?.fetchDuration || 'unknown',
      tier: userTier,
      creditsUsed,
      originalOptions: options,
      cacheGeneratedAt: new Date().toISOString()
    };
    
    // Store main cache entry
    const cacheResult = await db.query(`
      INSERT INTO user_sentiment_cache (
        user_id, 
        data_type, 
        time_range, 
        cache_key, 
        data_json, 
        metadata,
        expires_at,
        credits_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, data_type, time_range, cache_key) 
      DO UPDATE SET 
        data_json = EXCLUDED.data_json,
        metadata = EXCLUDED.metadata,
        expires_at = EXCLUDED.expires_at,
        credits_used = EXCLUDED.credits_used,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [
      userId,
      dataType,
      timeRange,
      cacheKey,
      JSON.stringify(data),
      JSON.stringify(metadata),
      expiresAt,
      creditsUsed
    ]);
    
    const cacheId = cacheResult.rows[0].id;
    console.log(`💾 [SENTIMENT CACHE STORE] Cache entry stored with ID: ${cacheId}`);
    
    // Store detailed ticker data if available
    if (dataType.includes('tickers') && data.data && Array.isArray(data.data)) {
      await storeIndividualTickerSentiment(cacheId, userId, data.data, dataType);
    }
    
    // Store market data if available
    if (dataType.includes('market') && data.marketData) {
      await storeIndividualMarketSentiment(cacheId, userId, data.marketData, dataType);
    }
    
    console.log(`💾 [SENTIMENT CACHE STORE] Successfully stored cache for user ${userId}, dataType: ${dataType}`);
    return true;
    
  } catch (error) {
    console.error(`❌ [SENTIMENT CACHE STORE] Error storing sentiment cache for user ${userId}:`, error);
    return false;
  }
}

/**
 * Store individual ticker sentiment data
 * @param {string} cacheId - Cache ID
 * @param {string} userId - User ID
 * @param {Array} tickers - Ticker sentiment data
 * @param {string} source - Data source
 */
async function storeIndividualTickerSentiment(cacheId, userId, tickers, source) {
  if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
    console.log(`📊 [SENTIMENT STORE] No ticker data to store for cache ${cacheId}`);
    return;
  }
  
  console.log(`📊 [SENTIMENT STORE] Storing ${tickers.length} ticker sentiment records for cache ${cacheId}`);
  
  try {
    // Clear existing ticker data for this cache
    await db.query('DELETE FROM user_sentiment_tickers WHERE cache_id = $1', [cacheId]);
    
    // Insert new ticker data
    for (const ticker of tickers) {
      await db.query(`
        INSERT INTO user_sentiment_tickers (
          cache_id, user_id, ticker, source, sentiment_score, sentiment_label,
          confidence, mention_count, post_count, volume, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        cacheId,
        userId,
        ticker.ticker || ticker.symbol,
        source.split('_')[0], // Extract source from data_type (e.g., 'reddit' from 'reddit_tickers')
        ticker.sentiment || ticker.sentimentScore,
        ticker.sentimentLabel || ticker.sentiment_label,
        ticker.confidence,
        ticker.mentions || ticker.mention_count || 0,
        ticker.posts || ticker.post_count || 0,
        ticker.volume || 0,
        JSON.stringify(ticker)
      ]);
    }
    
    console.log(`📊 [SENTIMENT STORE] Successfully stored ${tickers.length} ticker sentiment records`);
  } catch (error) {
    console.error(`❌ [SENTIMENT STORE] Error storing ticker sentiment data:`, error);
  }
}

/**
 * Store individual market sentiment data
 * @param {string} cacheId - Cache ID
 * @param {string} userId - User ID
 * @param {Object} marketData - Market sentiment data
 * @param {string} source - Data source
 */
async function storeIndividualMarketSentiment(cacheId, userId, marketData, source) {
  if (!marketData) {
    console.log(`📊 [SENTIMENT STORE] No market data to store for cache ${cacheId}`);
    return;
  }
  
  console.log(`📊 [SENTIMENT STORE] Storing market sentiment data for cache ${cacheId}`);
  
  try {
    // Clear existing market data for this cache
    await db.query('DELETE FROM user_sentiment_market_data WHERE cache_id = $1', [cacheId]);
    
    // Insert new market data
    await db.query(`
      INSERT INTO user_sentiment_market_data (
        cache_id, user_id, source, market_sentiment, sentiment_label,
        confidence, data_date, metrics, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      cacheId,
      userId,
      source.split('_')[0], // Extract source from data_type
      marketData.sentiment || marketData.marketSentiment,
      marketData.sentimentLabel || marketData.sentiment_label,
      marketData.confidence,
      new Date(), // Current date for market data
      JSON.stringify(marketData.metrics || {}),
      JSON.stringify(marketData)
    ]);
    
    console.log(`📊 [SENTIMENT STORE] Successfully stored market sentiment data`);
  } catch (error) {
    console.error(`❌ [SENTIMENT STORE] Error storing market sentiment data:`, error);
  }
}

/**
 * Main function to get sentiment data for a user with session-based access control
 * Integrates with research_sessions table for sophisticated session management
 * @param {string} userId - User ID
 * @param {string} component - Component name (e.g., 'sentimentAnalysis', 'redditSentiment')
 * @param {string} dataType - Type of sentiment data
 * @param {string} timeRange - Time range for data
 * @param {Object} options - Additional options
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<Object>} - Sentiment data response
 */
async function getSentimentDataForUser(userId, userTier, dataType, timeRange, forceRefresh = false, options = {}, progressCallback = null) {
  try {
    console.log(`[userSentimentCache] Getting sentiment data for user ${userId}, type: ${dataType}, tier: ${userTier}`);
    
    // TIER 1: Check for active unlock session first
    const componentMap = {
      'reddit_tickers': 'sentimentReddit',
      'yahoo_tickers': 'sentimentScores',
      'finviz_tickers': 'sentimentChart',
      'reddit_market': 'sentimentReddit',
      'yahoo_market': 'sentimentScores',
      'finviz_market': 'sentimentChart',
      'combined_tickers': 'sentimentChart',
      'aggregated_market': 'sentimentChart'
    };
    
    const componentName = componentMap[dataType] || 'sentimentChart';
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
      
      console.log(`[userSentimentCache] User ${userId} has active session for ${componentName}, ${hoursRemaining}h remaining`);
      
      // TIER 2: Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedData = await getCachedSentimentData(userId, dataType, timeRange, options);
        if (cachedData) {
          console.log(`[userSentimentCache] Returning cached data for user ${userId} with active session`);
          
          if (progressCallback) {
            progressCallback({
              stage: `${dataType.replace('_', ' ')} loaded from cache`,
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
            expiresAt: cachedData.metadata.expiresAt,
            secondsUntilExpiry: cachedData.metadata.secondsUntilExpiry,
            hasActiveSession: true,
            creditsUsed: 0 // No credits used for active sessions
          };
        }
      }
      
      // TIER 3: If active session but no cache, fetch data without charging credits
      console.log(`[userSentimentCache] Active session found but no cache, fetching data for free for user ${userId}`);
      
      // Fetch fresh data (no credit deduction for active sessions)
      const freshData = await fetchFreshSentimentData(userId, dataType, timeRange, options, progressCallback);
      if (!freshData.success) {
        return freshData;
      }
      
      // Cache the fresh data (no credits charged)
      await storeSentimentDataInCache(userId, dataType, timeRange, freshData.data, 0, userTier, options);
      
      console.log(`[userSentimentCache] Successfully fetched and cached ${dataType} for user ${userId} with active session (no credits charged)`);
      
      return {
        success: true,
        data: freshData.data,
        creditsUsed: 0,
        fromCache: false,
        freshlyFetched: true,
        hasActiveSession: true
      };
    }
    
    // No active session - proceed with normal credit-based flow
    console.log(`[userSentimentCache] No active session found for user ${userId}, proceeding with credit-based access`);
    
    // TIER 2: Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = await getCachedSentimentData(userId, dataType, timeRange, options);
      if (cachedData) {
        console.log(`[userSentimentCache] Returning cached data for user ${userId}`);
        
        if (progressCallback) {
          progressCallback({
            stage: `${dataType.replace('_', ' ')} loaded from cache`,
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
          expiresAt: cachedData.metadata.expiresAt,
          secondsUntilExpiry: cachedData.metadata.secondsUntilExpiry,
          hasActiveSession: false
        };
      }
    }
    
    // TIER 3: No cache available, need to fetch fresh data (NO CREDITS CHARGED)
    // Note: Credit charging moved to unlock buttons only
    let creditsUsed = 0;
    
    console.log(`[userSentimentCache] Fetching fresh ${dataType} data for user ${userId} (free - no credits charged)`);
    
    const freshData = await fetchFreshSentimentData(userId, dataType, timeRange, options, progressCallback);
    if (!freshData.success) {
      return freshData;
    }
    
    // Cache the fresh data (no credits used)
    await storeSentimentDataInCache(userId, dataType, timeRange, freshData.data, creditsUsed, userTier, options);
    
    console.log(`[userSentimentCache] Successfully fetched and cached ${dataType} for user ${userId} (free - no credits charged)`);
    
    return {
      success: true,
      data: freshData.data,
      creditsUsed: 0, // No credits charged for sentiment data
      fromCache: false,
      freshlyFetched: true,
      hasActiveSession: false
    };
    
  } catch (error) {
    console.error(`❌ [SENTIMENT CACHE] Error getting sentiment data for user ${userId}:`, error);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Internal server error while fetching sentiment data',
      userMessage: 'Something went wrong. Please try again later.'
    };
  }
}

/**
 * Fetch fresh sentiment data from APIs
 * @param {string} userId - User ID for API key resolution
 * @param {string} dataType - Type of data
 * @param {string} timeRange - Time range
 * @param {Object} options - Additional options
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<Object>} - API response
 */
async function fetchFreshSentimentData(userId, dataType, timeRange, options, progressCallback) {
  try {
    // Import sentiment services with error handling
    let redditService, yahooService, finvizService;
    
    try {
      redditService = require('./redditSentimentService');
    } catch (e) {
      console.warn('❌ [SENTIMENT CACHE] redditSentimentService not available:', e.message);
    }
    
    try {
      yahooService = require('./yahooSentimentService');
    } catch (e) {
      console.warn('❌ [SENTIMENT CACHE] yahooSentimentService not available:', e.message);
    }
    
    try {
      finvizService = require('./finvizSentimentService');
    } catch (e) {
      console.warn('❌ [SENTIMENT CACHE] finvizSentimentService not available:', e.message);
    }
    
    if (progressCallback) {
      progressCallback({
        stage: `Fetching fresh ${dataType.replace('_', ' ')} data...`,
        progress: 10
      });
    }
    
    let result;
    
    switch (dataType) {
      case 'reddit_tickers':
        if (!redditService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            message: 'Reddit sentiment service is not available',
            userMessage: 'Reddit sentiment analysis is temporarily unavailable. Please try again later.'
          };
        }
        result = await redditService.getRedditTickerSentiment(timeRange, userId, options.tickers);
        break;
      case 'yahoo_tickers':
        if (!yahooService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            message: 'Yahoo sentiment service is not available',
            userMessage: 'Yahoo sentiment analysis is temporarily unavailable. Please try again later.'
          };
        }
        result = await yahooService.getYahooTickerSentiment(options.tickers ? options.tickers.join(',') : '');
        break;
      case 'finviz_tickers':
        if (!finvizService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            message: 'FinViz sentiment service is not available',
            userMessage: 'FinViz sentiment analysis is temporarily unavailable. Please try again later.'
          };
        }
        result = await finvizService.getFinvizTickerSentiment(options.tickers ? options.tickers.join(',') : '');
        break;
      case 'reddit_market':
        if (!redditService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            message: 'Reddit sentiment service is not available',
            userMessage: 'Reddit market sentiment is temporarily unavailable. Please try again later.'
          };
        }
        result = await redditService.getRedditMarketSentiment(timeRange, userId);
        break;
      case 'yahoo_market':
        if (!yahooService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            message: 'Yahoo sentiment service is not available',
            userMessage: 'Yahoo market sentiment is temporarily unavailable. Please try again later.'
          };
        }
        result = await yahooService.getYahooMarketSentiment(timeRange);
        break;
      case 'finviz_market':
        if (!finvizService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            message: 'FinViz sentiment service is not available',
            userMessage: 'FinViz market sentiment is temporarily unavailable. Please try again later.'
          };
        }
        result = await finvizService.getFinvizMarketSentiment(timeRange);
        break;
      default:
        return {
          success: false,
          error: 'INVALID_DATA_TYPE',
          message: `Invalid data type: ${dataType}`
        };
    }
    
    if (progressCallback) {
      progressCallback({
        stage: `Processing ${dataType.replace('_', ' ')} data...`,
        progress: 90
      });
    }
    
    // For market sentiment data, return the result directly to match frontend expectations
    if (dataType.includes('_market')) {
      return {
        success: true,
        data: result, // Direct result for market sentiment (contains timestamps, bullish, bearish, neutral arrays)
        fromCache: false,
        timeRange,
        dataType,
        source: dataType.split('_')[0],
        refreshed: true,
        lastUpdated: new Date().toISOString(),
        metadata: {
          fetchDuration: result.fetchDuration || 'unknown',
          options
        }
      };
    }
    
    // For ticker sentiment data, use the nested structure
    return {
      success: true,
      data: {
        timeRange,
        dataType,
        data: result.data || result,
        count: Array.isArray(result.data || result) ? (result.data || result).length : 1,
        source: dataType.split('_')[0],
        refreshed: true,
        lastUpdated: new Date().toISOString(),
        metadata: {
          fetchDuration: result.fetchDuration || 'unknown',
          options
        }
      }
    };
    
  } catch (error) {
    console.error(`❌ [userSentimentCache] Error fetching fresh ${dataType} data:`, error);
    return {
      success: false,
      error: 'API_ERROR',
      message: `Failed to fetch ${dataType} data from API`,
      userMessage: `Unable to fetch fresh ${dataType.replace('_', ' ')} data. Please try again.`
    };
  }
}

/**
 * Clean up expired cache entries
 * @returns {Promise<number>} - Number of entries cleaned
 */
async function cleanupExpiredSentimentCache() {
  try {
    const result = await db.query(`
      WITH deleted AS (
        DELETE FROM user_sentiment_cache 
        WHERE expires_at < CURRENT_TIMESTAMP 
        RETURNING id
      )
      SELECT COUNT(*) as deleted_count FROM deleted
    `);
    
    const deletedCount = result.rows[0].deleted_count;
    console.log(`🧹 [SENTIMENT CACHE] Cleaned up ${deletedCount} expired sentiment cache entries`);
    
    return deletedCount;
  } catch (error) {
    console.error(`❌ [SENTIMENT CACHE] Error cleaning up expired cache:`, error);
    return 0;
  }
}

/**
 * Get user sentiment cache status
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Cache status
 */
async function getUserSentimentCacheStatus(userId) {
  try {
    const result = await db.query(`
      SELECT 
        data_type,
        time_range,
        cache_key,
        created_at,
        expires_at,
        credits_used,
        metadata,
        EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_until_expiry,
        CASE WHEN expires_at > NOW() THEN 'active' ELSE 'expired' END as status
      FROM user_sentiment_cache
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);
    
    return {
      success: true,
      cacheEntries: result.rows,
      totalEntries: result.rows.length,
      activeEntries: result.rows.filter(row => row.status === 'active').length,
      expiredEntries: result.rows.filter(row => row.status === 'expired').length
    };
  } catch (error) {
    console.error(`❌ [SENTIMENT CACHE] Error getting cache status for user ${userId}:`, error);
    return {
      success: false,
      error: 'Failed to get cache status'
    };
  }
}

/**
 * Clear user sentiment cache
 * @param {string} userId - User ID
 * @param {string} dataType - Optional data type filter
 * @param {string} timeRange - Optional time range filter
 * @returns {Promise<boolean>} - Success status
 */
async function clearUserSentimentCache(userId, dataType = null, timeRange = null) {
  try {
    let query = 'DELETE FROM user_sentiment_cache WHERE user_id = $1';
    const params = [userId];
    
    if (dataType) {
      query += ' AND data_type = $2';
      params.push(dataType);
    }
    
    if (timeRange) {
      query += ` AND time_range = $${params.length + 1}`;
      params.push(timeRange);
    }
    
    const result = await db.query(query, params);
    console.log(`🗑️ [SENTIMENT CACHE] Cleared ${result.rowCount} cache entries for user ${userId}`);
    
    return true;
  } catch (error) {
    console.error(`❌ [SENTIMENT CACHE] Error clearing cache for user ${userId}:`, error);
    return false;
  }
}

module.exports = {
  getSentimentDataForUser,
  getCachedSentimentData,
  storeSentimentDataInCache,
  cleanupExpiredSentimentCache,
  getUserSentimentCacheStatus,
  clearUserSentimentCache,
  checkActiveUnlockSession,
  getUserTier,
  getUserCredits,
  deductUserCredits,
  getCacheTTL,
  getDataLimit,
  getCreditCost,
  generateCacheKey,
  SENTIMENT_CACHE_CONFIG
};