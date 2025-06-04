const { pool } = require('../config/data-sources');

/**
 * Middleware to check for cached sentiment data before making API calls
 * This prevents unnecessary API calls when data is already available in the research session
 */

// Data freshness limits (how long data stays valid from a data quality perspective)
const DATA_FRESHNESS_MINUTES = {
  'reddit_market': 30,      // Reddit data changes frequently
  'yahoo_market': 60,       // Yahoo market sentiment 
  'finviz_tickers': 60,     // FinViz ticker data
  'yahoo_tickers': 60,      // Yahoo ticker sentiment
  'finviz_market': 60,      // FinViz market data
  'reddit_tickers': 30,     // Reddit ticker mentions
  'combined_tickers': 30,   // Combined sentiment data
  'aggregated_sentiment': 30 // Aggregated sentiment from multiple sources
};

/**
 * Generate cache key for sentiment data lookup
 */
function generateCacheKey(queryType, tickers = [], timeRange = '1w', subreddits = []) {
  const sortedTickers = Array.isArray(tickers) ? [...tickers].sort() : [];
  const sortedSubreddits = Array.isArray(subreddits) ? [...subreddits].sort() : [];
  
  return `${queryType}_${sortedTickers.join(',')}_${timeRange}_${sortedSubreddits.join(',')}`;
}

/**
 * Extract query parameters from request
 */
function extractQueryParams(req) {
  const { query, params, body } = req;
  
  // Determine query type from the route
  let queryType = 'unknown';
  
  // Get the full request URL path for more reliable matching
  const fullPath = req.originalUrl || req.url || '';
  const routePath = req.route?.path || '';
  
  console.log(`🔍 [CACHE DEBUG] Full path: ${fullPath}, Route path: ${routePath}`);
  
  // Match query types based on the actual endpoints being called
  if (fullPath.includes('/sentiment/reddit/market') || routePath.includes('/reddit/market')) {
    queryType = 'reddit_market';
  } else if (fullPath.includes('/sentiment/yahoo/market') || routePath.includes('/yahoo/market')) {
    queryType = 'yahoo_market';
  } else if (fullPath.includes('/finviz/ticker-sentiment') || routePath.includes('/ticker-sentiment')) {
    queryType = 'finviz_tickers';
  } else if (fullPath.includes('/sentiment/yahoo/tickers') || routePath.includes('/yahoo/tickers')) {
    queryType = 'yahoo_tickers';
  } else if (fullPath.includes('/sentiment/finviz/tickers') || routePath.includes('/finviz/tickers')) {
    queryType = 'finviz_tickers';
  } else if (fullPath.includes('/sentiment/reddit/tickers') || routePath.includes('/reddit/tickers')) {
    queryType = 'reddit_tickers';
  } else if (fullPath.includes('/sentiment/combined/tickers') || routePath.includes('/combined/tickers')) {
    queryType = 'combined_tickers';
  } else if (fullPath.includes('/sentiment/aggregate') || routePath.includes('/aggregate')) {
    queryType = 'aggregated_sentiment';
  }
  
  console.log(`🔍 [CACHE DEBUG] Detected query type: ${queryType}`);
  
  // Extract tickers (from query string or watchlist)
  let tickers = [];
  if (query.tickers) {
    tickers = query.tickers.split(',').map(t => t.trim().toUpperCase());
  }
  
  // Extract time range
  const timeRange = query.timeRange || query.time_range || '1w';
  
  // Extract subreddits (for reddit calls)
  const subreddits = query.subreddits ? query.subreddits.split(',') : [];
  
  return { queryType, tickers, timeRange, subreddits };
}

/**
 * Calculate appropriate cache expiration based on session and data freshness
 */
function calculateCacheExpiration(sessionExpiresAt, queryType) {
  const sessionExpiry = new Date(sessionExpiresAt);
  const dataFreshnessMinutes = DATA_FRESHNESS_MINUTES[queryType] || 30;
  const dataFreshnessExpiry = new Date(Date.now() + (dataFreshnessMinutes * 60 * 1000));
  
  // Use the earlier of session expiry or data freshness expiry
  const cacheExpiresAt = sessionExpiry < dataFreshnessExpiry ? sessionExpiry : dataFreshnessExpiry;
  
  console.log(`⏰ Cache expiration calculation for ${queryType}:`);
  console.log(`   Session expires: ${sessionExpiry.toISOString()}`);
  console.log(`   Data freshness expires: ${dataFreshnessExpiry.toISOString()}`);
  console.log(`   Using: ${cacheExpiresAt.toISOString()}`);
  
  return cacheExpiresAt;
}

/**
 * Check for cached sentiment data
 */
async function checkSentimentCache(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(); // No user, proceed to API call
    }
    
    // Extract query parameters
    const { queryType, tickers, timeRange, subreddits } = extractQueryParams(req);
    
    if (queryType === 'unknown') {
      console.log('⚠️ Unknown query type, skipping cache check');
      return next();
    }
    
    console.log(`🔍 Checking cache for: ${queryType}, tickers: ${tickers.join(',')}, timeRange: ${timeRange}`);
    
    // Map query types to session component names
    const componentMapping = {
      'reddit_market': 'chart',      // Chart component unlocks market data
      'yahoo_market': 'chart',       // Chart component unlocks market data
      'finviz_market': 'chart',      // Chart component unlocks market data
      'reddit_tickers': 'chart',     // Chart component needs ticker data for visualization
      'yahoo_tickers': 'chart',      // Chart component needs ticker data for visualization
      'finviz_tickers': 'chart',     // Chart component needs ticker data for visualization
      'combined_tickers': 'chart',   // Chart component needs combined ticker data
      'aggregated_sentiment': 'chart' // Chart component needs aggregated data
    };
    
    const sessionComponent = componentMapping[queryType];
    if (!sessionComponent) {
      console.log(`⚠️ No component mapping for ${queryType}, skipping cache check`);
      return next();
    }
    
    console.log(`🔗 Mapping ${queryType} → session component: ${sessionComponent}`);
    
    // Get active session for the mapped component
    const sessionResult = await pool.query(`
      SELECT session_id, expires_at, 
             EXTRACT(EPOCH FROM (expires_at - (NOW() AT TIME ZONE 'UTC')))/60 as minutes_remaining
      FROM research_sessions 
      WHERE user_id = $1 
        AND component = $2 
        AND status = 'active' 
        AND expires_at > (NOW() AT TIME ZONE 'UTC')
      ORDER BY created_at DESC 
      LIMIT 1
    `, [userId, sessionComponent]);
    
    if (sessionResult.rows.length === 0) {
      console.log(`❌ No active ${sessionComponent} session found for ${queryType}, proceeding to API call`);
      return next();
    }
    
    const session = sessionResult.rows[0];
    console.log(`📅 Active ${sessionComponent} session found: ${session.session_id}, expires in ${Math.round(session.minutes_remaining)}m`);
    
    // Check for cached data that hasn't expired AND is within session
    const cacheResult = await pool.query(`
      SELECT sentiment_data, api_metadata, fetched_at, expires_at
      FROM sentiment_research_data 
      WHERE session_id = $1 
        AND query_type = $2 
        AND tickers = $3 
        AND time_range = $4 
        AND COALESCE(subreddits, ARRAY[]::TEXT[]) = $5
        AND expires_at > (NOW() AT TIME ZONE 'UTC')
      ORDER BY fetched_at DESC 
      LIMIT 1
    `, [session.session_id, queryType, tickers, timeRange, subreddits]);
    
    if (cacheResult.rows.length > 0) {
      const cachedData = cacheResult.rows[0];
      const ageMinutes = Math.floor((Date.now() - new Date(cachedData.fetched_at).getTime()) / 60000);
      const expiresInMinutes = Math.floor((new Date(cachedData.expires_at).getTime() - Date.now()) / 60000);
      
      console.log(`✅ Found cached sentiment data (age: ${ageMinutes}m, expires in: ${expiresInMinutes}m), returning from cache`);
      
      // Return cached data in the same format as API response
      return res.json({
        success: true,
        sentimentData: cachedData.sentiment_data,
        cached: true,
        cachedAt: cachedData.fetched_at,
        expiresAt: cachedData.expires_at,
        sessionExpiresAt: session.expires_at,
        credits: cachedData.api_metadata?.credits || null
      });
    }
    
    console.log('📭 No cached data found, proceeding to API call');
    
    // Store session info for the post-processing middleware
    req.sentimentCacheInfo = {
      sessionId: session.session_id,
      sessionExpiresAt: session.expires_at,
      queryType,
      tickers,
      timeRange,
      subreddits
    };
    
    next();
    
  } catch (error) {
    console.error('Error checking sentiment cache:', error);
    // Continue to API call on cache check failure
    next();
  }
}

/**
 * Store sentiment data in cache after successful API response
 */
async function storeSentimentCache(req, res, next) {
  console.log('🔧 [CACHE DEBUG] storeSentimentCache middleware called');
  console.log('🔧 [CACHE DEBUG] req.sentimentCacheInfo:', !!req.sentimentCacheInfo);
  console.log('🔧 [CACHE DEBUG] res.locals.sentimentResponse:', !!res.locals.sentimentResponse);
  
  // Only run if we have cache info (meaning cache check was performed)
  if (!req.sentimentCacheInfo || !res.locals.sentimentResponse) {
    console.log('⚠️ [CACHE DEBUG] Missing cache info or response data, skipping storage');
    return next();
  }
  
  try {
    const { sessionId, sessionExpiresAt, queryType, tickers, timeRange, subreddits } = req.sentimentCacheInfo;
    const responseData = res.locals.sentimentResponse;
    
    console.log(`🔧 [CACHE DEBUG] Attempting to store: ${queryType}, session: ${sessionId}`);
    console.log(`🔧 [CACHE DEBUG] Response data has sentimentData:`, !!responseData.sentimentData);
    
    // Calculate expiry time based on BOTH session duration AND data freshness
    const cacheExpiresAt = calculateCacheExpiration(sessionExpiresAt, queryType);
    
    // Don't cache if session expires very soon (less than 5 minutes)
    const minutesUntilSessionExpiry = Math.floor((new Date(sessionExpiresAt).getTime() - Date.now()) / 60000);
    if (minutesUntilSessionExpiry < 5) {
      console.log(`⏰ Session expires in ${minutesUntilSessionExpiry}m, skipping cache storage`);
      return next();
    }
    
    // Extract metadata with support for different data formats
    const apiMetadata = {
      credits: responseData.credits || null,
      fetchDuration: res.locals.fetchDuration || null,
      dataCount: responseData.sentimentData ? 
        (Array.isArray(responseData.sentimentData) ? responseData.sentimentData.length : 1) :
        (responseData.timestamps ? responseData.timestamps.length : 1),
      sessionExpiresAt: sessionExpiresAt,
      dataFreshnessMinutes: DATA_FRESHNESS_MINUTES[queryType] || 30,
      dataFormat: responseData.sentimentData ? 'ticker_sentiment' : 'market_chart'
    };
    
    console.log(`💾 Storing sentiment data in cache: ${queryType}, expires: ${cacheExpiresAt.toISOString()}`);
    
    // Prepare data for storage - handle both sentimentData and market data formats
    let dataToStore;
    if (responseData.sentimentData) {
      dataToStore = responseData.sentimentData;
    } else {
      // Store market chart data in a consistent format
      dataToStore = {
        timestamps: responseData.timestamps || [],
        bullish: responseData.bullish || [],
        bearish: responseData.bearish || [],
        neutral: responseData.neutral || [],
        total: responseData.total || [],
        meta: responseData.meta || {}
      };
    }
    
    // Store in database
    await pool.query(`
      INSERT INTO sentiment_research_data (
        session_id, user_id, query_type, tickers, time_range, subreddits,
        sentiment_data, api_metadata, expires_at, fetch_duration_ms, credits_consumed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (session_id, query_type, tickers, time_range, subreddits) 
      DO UPDATE SET 
        sentiment_data = EXCLUDED.sentiment_data,
        api_metadata = EXCLUDED.api_metadata,
        expires_at = EXCLUDED.expires_at,
        fetch_duration_ms = EXCLUDED.fetch_duration_ms,
        credits_consumed = EXCLUDED.credits_consumed,
        updated_at = CURRENT_TIMESTAMP
    `, [
      sessionId,
      req.user.id,
      queryType,
      tickers,
      timeRange,
      subreddits.length > 0 ? subreddits : null,
      JSON.stringify(dataToStore),
      JSON.stringify(apiMetadata),
      cacheExpiresAt,
      res.locals.fetchDuration || null,
      res.locals.creditsUsed || 0
    ]);
    
    const cacheMinutesRemaining = Math.floor((cacheExpiresAt.getTime() - Date.now()) / 60000);
    console.log(`✅ Sentiment data cached successfully, expires in ${cacheMinutesRemaining}m`);
    
  } catch (error) {
    console.error('❌ [CACHE DEBUG] Error storing sentiment cache:', error);
    // Don't fail the request if caching fails
  }
  
  next();
}

/**
 * Middleware to capture response data for caching and store it immediately
 */
function captureSentimentResponse(req, res, next) {
  console.log('🔧 [CACHE DEBUG] captureSentimentResponse middleware called');
  
  const originalJson = res.json;
  
  res.json = function(data) {
    console.log('🔧 [CACHE DEBUG] Response intercepted, data structure:', {
      hasData: !!data,
      hasSentimentData: !!(data && data.sentimentData),
      hasMarketData: !!(data && (data.timestamps || data.bullish || data.bearish)),
      dataKeys: data ? Object.keys(data) : 'no data'
    });
    
    // Store the response data for potential caching
    // Accept both sentimentData format (for tickers) and market data format (for charts)
    const hasValidData = data && (
      data.sentimentData ||  // Standard ticker sentiment format
      data.timestamps ||     // Reddit market chart format
      data.bullish ||        // Market sentiment format
      data.bearish           // Market sentiment format
    );
    
    if (hasValidData) {
      res.locals.sentimentResponse = data;
      console.log('✅ [CACHE DEBUG] Response data captured for caching');
      
      // Store in cache immediately (since middleware after res.json() doesn't execute reliably)
      if (req.sentimentCacheInfo) {
        storeSentimentDataImmediately(req, res, data);
      }
    } else {
      console.log('⚠️ [CACHE DEBUG] No valid sentiment/market data found in response, not caching');
    }
    
    // Call the original json method
    return originalJson.call(this, data);
  };
  
  next();
}

/**
 * Store sentiment data immediately (called from within captureSentimentResponse)
 */
async function storeSentimentDataImmediately(req, res, responseData) {
  console.log('🔧 [CACHE DEBUG] storeSentimentDataImmediately called');
  
  try {
    const { sessionId, sessionExpiresAt, queryType, tickers, timeRange, subreddits } = req.sentimentCacheInfo;
    
    console.log(`🔧 [CACHE DEBUG] Attempting to store: ${queryType}, session: ${sessionId}`);
    console.log(`🔧 [CACHE DEBUG] Response data has sentimentData:`, !!responseData.sentimentData);
    
    // Calculate expiry time based on BOTH session duration AND data freshness
    const cacheExpiresAt = calculateCacheExpiration(sessionExpiresAt, queryType);
    
    // Don't cache if session expires very soon (less than 5 minutes)
    const minutesUntilSessionExpiry = Math.floor((new Date(sessionExpiresAt).getTime() - Date.now()) / 60000);
    if (minutesUntilSessionExpiry < 5) {
      console.log(`⏰ Session expires in ${minutesUntilSessionExpiry}m, skipping cache storage`);
      return;
    }
    
    // Extract metadata
    const apiMetadata = {
      credits: responseData.credits || null,
      fetchDuration: res.locals.fetchDuration || null,
      dataCount: responseData.sentimentData ? 
        (Array.isArray(responseData.sentimentData) ? responseData.sentimentData.length : 1) :
        (responseData.timestamps ? responseData.timestamps.length : 1),
      sessionExpiresAt: sessionExpiresAt,
      dataFreshnessMinutes: DATA_FRESHNESS_MINUTES[queryType] || 30,
      dataFormat: responseData.sentimentData ? 'ticker_sentiment' : 'market_chart'
    };
    
    console.log(`💾 Storing sentiment data in cache: ${queryType}, expires: ${cacheExpiresAt.toISOString()}`);
    
    // Prepare data for storage - handle both sentimentData and market data formats
    let dataToStore;
    if (responseData.sentimentData) {
      dataToStore = responseData.sentimentData;
    } else {
      // Store market chart data in a consistent format
      dataToStore = {
        timestamps: responseData.timestamps || [],
        bullish: responseData.bullish || [],
        bearish: responseData.bearish || [],
        neutral: responseData.neutral || [],
        total: responseData.total || [],
        meta: responseData.meta || {}
      };
    }
    
    // Store in database
    await pool.query(`
      INSERT INTO sentiment_research_data (
        session_id, user_id, query_type, tickers, time_range, subreddits,
        sentiment_data, api_metadata, expires_at, fetch_duration_ms, credits_consumed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (session_id, query_type, tickers, time_range, subreddits) 
      DO UPDATE SET 
        sentiment_data = EXCLUDED.sentiment_data,
        api_metadata = EXCLUDED.api_metadata,
        expires_at = EXCLUDED.expires_at,
        fetch_duration_ms = EXCLUDED.fetch_duration_ms,
        credits_consumed = EXCLUDED.credits_consumed,
        updated_at = CURRENT_TIMESTAMP
    `, [
      sessionId,
      req.user.id,
      queryType,
      tickers,
      timeRange,
      subreddits.length > 0 ? subreddits : null,
      JSON.stringify(dataToStore),
      JSON.stringify(apiMetadata),
      cacheExpiresAt,
      res.locals.fetchDuration || null,
      res.locals.creditsUsed || 0
    ]);
    
    const cacheMinutesRemaining = Math.floor((cacheExpiresAt.getTime() - Date.now()) / 60000);
    console.log(`✅ Sentiment data cached successfully, expires in ${cacheMinutesRemaining}m`);
    
  } catch (error) {
    console.error('❌ [CACHE DEBUG] Error storing sentiment cache immediately:', error);
    // Don't fail the request if caching fails
  }
}

module.exports = {
  checkSentimentCache,
  storeSentimentCache,
  captureSentimentResponse,
  generateCacheKey
}; 