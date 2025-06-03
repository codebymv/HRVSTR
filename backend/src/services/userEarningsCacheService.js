/**
 * User Earnings Cache Service
 * Manages user-specific earnings data caching with database backend
 * Follows the same architecture pattern as userSecCacheService.js
 */
const { pool: db } = require('../config/data-sources');
const earningsService = require('./earningsService');

/**
 * Cache configuration for earnings data
 */
const EARNINGS_CACHE_CONFIG = {
  // Cache TTL by tier (in seconds) - Action-oriented limits
  FREE_TIER_TTL: 1 * 60 * 60,       // 1 hour for free tier (encourages action)
  PRO_TIER_TTL: 2 * 60 * 60,        // 2 hours for pro tier (moderate window)
  ELITE_TIER_TTL: 4 * 60 * 60,      // 4 hours for elite tier (extended window)
  INSTITUTIONAL_TIER_TTL: 30 * 60,  // 30 minutes for institutional (ultra-fresh data)
  
  // Default limits by data type and tier
  LIMITS: {
    FREE: {
      upcoming_earnings: 25,
      earnings_analysis: 5,
      historical_earnings: 10
    },
    PRO: {
      upcoming_earnings: 100,
      earnings_analysis: 25,
      historical_earnings: 50
    },
    ELITE: {
      upcoming_earnings: 500,
      earnings_analysis: 100,
      historical_earnings: 200
    },
    INSTITUTIONAL: {
      upcoming_earnings: 1000,
      earnings_analysis: 500,
      historical_earnings: 1000
    }
  }
};

/**
 * Initialize earnings cache tables
 */
async function initializeEarningsCacheTables() {
  try {
    // Create user earnings cache table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_earnings_cache (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        data_type VARCHAR(50) NOT NULL,
        cache_key VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        tier VARCHAR(20) DEFAULT 'free',
        metadata JSONB DEFAULT '{}',
        UNIQUE(user_id, data_type, cache_key)
      )
    `);

    // Create indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_user_earnings_cache_lookup 
      ON user_earnings_cache(user_id, data_type, cache_key, expires_at)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_user_earnings_cache_expiry 
      ON user_earnings_cache(expires_at)
    `);

    console.log('✅ User earnings cache tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing earnings cache tables:', error);
    throw error;
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
      return EARNINGS_CACHE_CONFIG.INSTITUTIONAL_TIER_TTL;
    case 'elite':
      return EARNINGS_CACHE_CONFIG.ELITE_TIER_TTL;
    case 'pro':
      return EARNINGS_CACHE_CONFIG.PRO_TIER_TTL;
    case 'free':
    default:
      return EARNINGS_CACHE_CONFIG.FREE_TIER_TTL;
  }
}

/**
 * Get data limit based on tier and data type
 * @param {string} tier - User tier
 * @param {string} dataType - Type of data
 * @returns {number} - Data limit
 */
function getDataLimit(tier, dataType) {
  const tierKey = tier?.toUpperCase() || 'FREE';
  const limits = EARNINGS_CACHE_CONFIG.LIMITS[tierKey] || EARNINGS_CACHE_CONFIG.LIMITS.FREE;
  return limits[dataType] || limits.upcoming_earnings;
}

/**
 * Generate cache key for earnings data
 * @param {string} dataType - Type of data
 * @param {string} timeRange - Time range
 * @param {Object} options - Additional options
 * @returns {string} - Cache key
 */
function generateCacheKey(dataType, timeRange, options = {}) {
  const parts = [dataType, timeRange];
  
  if (options.ticker) {
    parts.push(options.ticker);
  }
  
  if (options.limit) {
    parts.push(`limit${options.limit}`);
  }
  
  return parts.join('_');
}

/**
 * Get cached earnings data for user
 * @param {number} userId - User ID
 * @param {string} dataType - Type of data (upcoming_earnings, earnings_analysis, etc.)
 * @param {string} timeRange - Time range
 * @param {Object} options - Additional options
 * @returns {Promise<Object|null>} - Cached data or null
 */
async function getCachedEarningsData(userId, dataType, timeRange, options = {}) {
  try {
    const cacheKey = generateCacheKey(dataType, timeRange, options);
    console.log(`📋 [CACHE LOOKUP] Searching for cache: user=${userId}, dataType=${dataType}, timeRange=${timeRange}, key=${cacheKey}`);
    
    const result = await db.query(`
      SELECT data, created_at, expires_at, metadata, id,
             EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_until_expiry
      FROM user_earnings_cache
      WHERE user_id = $1 AND data_type = $2 AND cache_key = $3 AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId, dataType, cacheKey]);

    console.log(`📋 [CACHE LOOKUP] Query returned ${result.rows.length} rows`);

    if (result.rows.length === 0) {
      // Let's also check if there are any entries for this user (even expired ones)
      const allEntriesResult = await db.query(`
        SELECT id, data_type, cache_key, created_at, expires_at,
               EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_until_expiry,
               CASE WHEN expires_at > NOW() THEN 'active' ELSE 'expired' END as status
        FROM user_earnings_cache
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `, [userId]);
      
      console.log(`📋 [CACHE LOOKUP] User has ${allEntriesResult.rows.length} total cache entries:`);
      allEntriesResult.rows.forEach((entry, index) => {
        console.log(`📋 [CACHE LOOKUP]   Entry ${index + 1}: ID=${entry.id}, type=${entry.data_type}, key=${entry.cache_key}, status=${entry.status}, expires_in=${Math.round(entry.seconds_until_expiry)}s`);
      });
      
      console.log(`📋 No valid cache found for user ${userId}, dataType: ${dataType}, key: ${cacheKey}`);
      return null;
    }

    const cachedData = result.rows[0];
    console.log(`📋 Cache HIT for user ${userId}, dataType: ${dataType}, key: ${cacheKey}, expires in ${Math.round(cachedData.seconds_until_expiry)} seconds`);
    
    return {
      data: cachedData.data,
      metadata: {
        fromCache: true,
        cacheAge: Date.now() - new Date(cachedData.created_at).getTime(),
        expiresAt: cachedData.expires_at,
        ...cachedData.metadata
      }
    };
  } catch (error) {
    console.error(`❌ [CACHE LOOKUP] Error getting cached earnings data for user ${userId}:`, error);
    return null;
  }
}

/**
 * Validate and fix JSON string for PostgreSQL JSONB compatibility
 * @param {string} jsonString - JSON string to validate
 * @returns {string} - Fixed JSON string
 */
function validateAndFixJSON(jsonString) {
  try {
    console.log(`🔧 [JSON FIX] Validating JSON string of length: ${jsonString.length}`);
    // First, try to parse the original JSON
    JSON.parse(jsonString);
    console.log(`✅ [JSON FIX] Original JSON is valid, no fixes needed`);
    return jsonString; // If it parses, it's valid
  } catch (error) {
    console.log(`🔧 [JSON FIX] Original JSON has issues: ${error.message}`);
    
    // Look for the specific problem area mentioned in the PostgreSQL error
    if (jsonString.includes('lastUpdated')) {
      console.log(`🔧 [JSON FIX] Found lastUpdated field, checking for issues...`);
      const lastUpdatedMatch = jsonString.match(/lastUpdated[^}]*}/g);
      if (lastUpdatedMatch) {
        console.log(`🔧 [JSON FIX] lastUpdated patterns found:`, lastUpdatedMatch.slice(0, 3));
      }
    }
    
    // Common JSON fixes
    let fixedJson = jsonString;
    
    // Fix 1: Remove trailing commas in objects
    console.log(`🔧 [JSON FIX] Applying fix 1: trailing commas in objects`);
    fixedJson = fixedJson.replace(/,(\s*})/g, '$1');
    
    // Fix 2: Remove trailing commas in arrays  
    console.log(`🔧 [JSON FIX] Applying fix 2: trailing commas in arrays`);
    fixedJson = fixedJson.replace(/,(\s*])/g, '$1');
    
    // Fix 3: Fix empty object values (key:,) 
    console.log(`🔧 [JSON FIX] Applying fix 3: empty object values`);
    fixedJson = fixedJson.replace(/:\s*,/g, ':null,');
    
    // Fix 4: Fix double commas
    console.log(`🔧 [JSON FIX] Applying fix 4: double commas`);
    fixedJson = fixedJson.replace(/,,+/g, ',');
    
    // Fix 5: Fix issues around lastUpdated field specifically
    console.log(`🔧 [JSON FIX] Applying fix 5: lastUpdated field issues`);
    fixedJson = fixedJson.replace(/("lastUpdated":"[^"]*")\s*}\s*,/g, '$1},');
    
    // Fix 6: Remove any orphaned quotes
    console.log(`🔧 [JSON FIX] Applying fix 6: orphaned quotes`);
    fixedJson = fixedJson.replace(/",\s*"/g, '","');
    
    // Fix 7: Fix colon/comma confusion that PostgreSQL detected
    console.log(`🔧 [JSON FIX] Applying fix 7: colon/comma confusion`);
    // Look for patterns like "key", instead of "key":
    fixedJson = fixedJson.replace(/"([^"]+)"\s*,\s*([^",:\s])/g, '"$1":$2');
    
    // Fix 8: Fix malformed object endings 
    console.log(`🔧 [JSON FIX] Applying fix 8: malformed object endings`);
    fixedJson = fixedJson.replace(/}"\s*,/g, '},');
    fixedJson = fixedJson.replace(/}"\s*}/g, '}}');
    
    console.log(`🔧 [JSON FIX] All fixes applied, testing result...`);
    
    try {
      JSON.parse(fixedJson);
      console.log(`✅ [JSON FIX] Successfully fixed JSON malformation`);
      return fixedJson;
    } catch (secondError) {
      console.log(`❌ [JSON FIX] Could not fix JSON: ${secondError.message}`);
      console.log(`❌ [JSON FIX] Problem area sample: ${fixedJson.substring(0, 200)}...`);
      
      // If the specific PostgreSQL error persists, try one more aggressive fix
      if (secondError.message.includes('Expected ":"') || secondError.message.includes('but found ","')) {
        console.log(`🔧 [JSON FIX] Attempting aggressive colon/comma fix...`);
        // More aggressive fix for colon/comma issues
        let aggressiveFixed = fixedJson;
        
        // Replace patterns where there might be confusion between : and ,
        aggressiveFixed = aggressiveFixed.replace(/("[^"]+"),([^",:\[\{])/g, '$1:$2');
        aggressiveFixed = aggressiveFixed.replace(/("[^"]+"),(\s*"[^"]+")/g, '$1:$2');
        
        try {
          JSON.parse(aggressiveFixed);
          console.log(`✅ [JSON FIX] Aggressive fix succeeded!`);
          return aggressiveFixed;
        } catch (thirdError) {
          console.log(`❌ [JSON FIX] Even aggressive fix failed: ${thirdError.message}`);
        }
      }
      
      throw new Error(`Unfixable JSON: ${secondError.message}`);
    }
  }
}

/**
 * Ultra-safe JSON sanitization for PostgreSQL JSONB
 * @param {any} data - Data to sanitize
 * @returns {any} - Sanitized data
 */
function ultraSafeJSONSanitize(data) {
  try {
    console.log(`🔧 [ULTRA SAFE] Starting sanitization, data type: ${typeof data}, isArray: ${Array.isArray(data)}`);
    
    // Step 1: Convert to JSON string with our custom replacer
    const jsonString = JSON.stringify(data, (key, value) => {
      // Handle all the problematic cases
      if (value === undefined) return null;
      if (typeof value === 'function') return null;
      if (typeof value === 'symbol') return null;
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'number' && !isFinite(value)) return null;
      
      // Handle potential circular references
      if (typeof value === 'object' && value !== null) {
        try {
          JSON.stringify(value);
          return value;
        } catch (err) {
          return '[Circular/Complex Object]';
        }
      }
      
      return value;
    });
    
    console.log(`🔧 [ULTRA SAFE] Step 1 complete, JSON length: ${jsonString.length}`);
    
    // Step 2: Validate and fix the JSON string
    console.log(`🔧 [ULTRA SAFE] Starting JSON validation and fixing...`);
    const fixedJsonString = validateAndFixJSON(jsonString);
    console.log(`🔧 [ULTRA SAFE] JSON validation complete`);
    
    // Step 3: Parse back to object
    console.log(`🔧 [ULTRA SAFE] Parsing fixed JSON back to object...`);
    const parsedData = JSON.parse(fixedJsonString);
    console.log(`🔧 [ULTRA SAFE] Parse successful`);
    
    // Step 4: Final validation - try to stringify again
    console.log(`🔧 [ULTRA SAFE] Final validation - re-stringifying...`);
    const finalJson = JSON.stringify(parsedData);
    console.log(`🔧 [ULTRA SAFE] Final validation successful, final JSON length: ${finalJson.length}`);
    
    return parsedData;
    
  } catch (error) {
    console.error(`❌ [ULTRA SAFE] All sanitization failed: ${error.message}`);
    console.error(`❌ [ULTRA SAFE] Stack trace:`, error.stack);
    
    // Ultimate fallback - return minimal safe structure
    return {
      _error: 'Complete sanitization failure',
      _originalType: typeof data,
      _isArray: Array.isArray(data),
      _count: Array.isArray(data) ? data.length : 1,
      _timestamp: new Date().toISOString(),
      _sample: Array.isArray(data) && data.length > 0 ? 
        { ticker: data[0]?.ticker || 'unknown' } : 
        'Non-array data'
    };
  }
}

/**
 * Store earnings data in user cache
 * @param {number} userId - User ID
 * @param {string} dataType - Type of data
 * @param {string} timeRange - Time range
 * @param {Object} data - Data to cache
 * @param {string} tier - User tier
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} - Success status
 */
async function storeEarningsDataInCache(userId, dataType, timeRange, data, tier, options = {}) {
  try {
    console.log(`💾 [CACHE STORE] Starting cache storage for user ${userId}, type: ${dataType}, timeRange: ${timeRange}, tier: ${tier}`);
    
    const cacheKey = generateCacheKey(dataType, timeRange, options);
    const ttlSeconds = getCacheTTL(tier);
    
    // FIX: Ensure we use consistent UTC time for expiration calculation
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (ttlSeconds * 1000));
    
    console.log(`💾 [CACHE STORE] TTL calculation - Current time: ${now.toISOString()}, TTL: ${ttlSeconds}s, Expires at: ${expiresAt.toISOString()}`);
    
    // Apply data limits based on tier
    const limit = getDataLimit(tier, dataType);
    const limitedData = Array.isArray(data) ? data.slice(0, limit) : data;
    
    // Sanitize data to ensure it's JSON-serializable and PostgreSQL-compatible
    console.log(`💾 [CACHE STORE] Before sanitization - Data type: ${typeof limitedData}, Array: ${Array.isArray(limitedData)}, Length: ${Array.isArray(limitedData) ? limitedData.length : 'N/A'}`);
    
    // Log a sample of the data structure for debugging
    if (Array.isArray(limitedData) && limitedData.length > 0) {
      console.log(`💾 [CACHE STORE] Sample data item keys:`, Object.keys(limitedData[0] || {}));
      
      // Check for the problematic lastUpdated field
      if (limitedData[0] && limitedData[0].lastUpdated) {
        console.log(`💾 [CACHE STORE] Found lastUpdated field:`, limitedData[0].lastUpdated);
      }
    }
    
    const sanitizedData = ultraSafeJSONSanitize(limitedData);
    console.log(`💾 [CACHE STORE] Sanitization completed successfully`);
    
    const metadata = {
      tier,
      originalCount: Array.isArray(data) ? data.length : 1,
      limitedCount: Array.isArray(limitedData) ? limitedData.length : 1,
      ttlSeconds,
      ...options.metadata
    };

    // Also sanitize metadata
    const sanitizedMetadata = ultraSafeJSONSanitize(metadata);

    console.log(`💾 [CACHE STORE] Cache key: ${cacheKey}, TTL: ${ttlSeconds}s, Expires: ${expiresAt}, Data count: ${Array.isArray(sanitizedData) ? sanitizedData.length : 1}`);

    // Log the exact data being sent to PostgreSQL for debugging
    console.log(`💾 [DB QUERY] About to insert into database:`);
    console.log(`💾 [DB QUERY] userId (type: ${typeof userId}):`, userId);
    console.log(`💾 [DB QUERY] dataType:`, dataType);
    console.log(`💾 [DB QUERY] cacheKey:`, cacheKey);
    console.log(`💾 [DB QUERY] sanitizedData (type: ${typeof sanitizedData}):`, Array.isArray(sanitizedData) ? `Array with ${sanitizedData.length} items` : 'Object');
    console.log(`💾 [DB QUERY] expiresAt:`, expiresAt);
    console.log(`💾 [DB QUERY] tier:`, tier);
    console.log(`💾 [DB QUERY] sanitizedMetadata (type: ${typeof sanitizedMetadata}):`, sanitizedMetadata);
    
    // CRITICAL FIX: Ensure we pass clean, simple JavaScript objects to PostgreSQL
    // The issue is that our sanitized objects might have some internal structure that causes double-encoding
    // Let's convert to JSON string and back to ensure completely clean objects
    const cleanData = JSON.parse(JSON.stringify(sanitizedData));
    const cleanMetadata = JSON.parse(JSON.stringify(sanitizedMetadata));
    
    console.log(`💾 [DB QUERY] Using clean data - type: ${typeof cleanData}, array: ${Array.isArray(cleanData)}`);
    console.log(`💾 [DB QUERY] Using clean metadata - type: ${typeof cleanMetadata}`);

    // NEW APPROACH: Convert to JSON strings manually to bypass pg driver JSONB conversion issues
    const dataJsonString = JSON.stringify(cleanData);
    const metadataJsonString = JSON.stringify(cleanMetadata);
    
    console.log(`💾 [DB QUERY] Manual JSON strings - data length: ${dataJsonString.length}, metadata length: ${metadataJsonString.length}`);
    console.log(`💾 [DB QUERY] Data JSON string sample (first 100 chars):`, dataJsonString.substring(0, 100));
    console.log(`💾 [DB QUERY] Data JSON string sample (last 100 chars):`, dataJsonString.substring(dataJsonString.length - 100));
    
    // Ensure we pass the expiration time as UTC ISO string to avoid timezone issues
    const expiresAtUTC = expiresAt.toISOString();
    console.log(`💾 [DB QUERY] Expiration time UTC: ${expiresAtUTC}`);

    const result = await db.query(`
      INSERT INTO user_earnings_cache (user_id, data_type, cache_key, data, expires_at, tier, metadata)
      VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz, $6, $7::jsonb)
      ON CONFLICT (user_id, data_type, cache_key)
      DO UPDATE SET data = $4::jsonb, expires_at = $5::timestamptz, tier = $6, metadata = $7::jsonb, created_at = CURRENT_TIMESTAMP
      RETURNING id, created_at, expires_at
    `, [userId, dataType, cacheKey, dataJsonString, expiresAtUTC, tier, metadataJsonString]);

    console.log(`💾 [CACHE STORE] Successfully stored cache entry with ID: ${result.rows[0].id}, created: ${result.rows[0].created_at}, expires: ${result.rows[0].expires_at}`);
    console.log(`💾 Stored earnings data in cache for user ${userId}, type: ${dataType}, key: ${cacheKey}, expires: ${expiresAt}`);
    return true;
  } catch (error) {
    console.error(`❌ [CACHE STORE] Error storing earnings data in cache for user ${userId}:`, error);
    console.error(`❌ [CACHE STORE] Error details:`, error.message);
    
    // Additional debugging for JSON errors
    if (error.message.includes('invalid input syntax for type json')) {
      console.error(`❌ [CACHE STORE] JSON syntax error detected. Data type: ${typeof data}, Array: ${Array.isArray(data)}`);
      try {
        // Try to identify the problematic data
        const testJson = JSON.stringify(data);
        console.error(`❌ [CACHE STORE] Raw data JSON length: ${testJson.length}`);
      } catch (jsonError) {
        console.error(`❌ [CACHE STORE] Data contains non-serializable content:`, jsonError.message);
      }
    }
    
    return false;
  }
}

/**
 * Get earnings data with caching (main function)
 * @param {number} userId - User ID
 * @param {string} dataType - Type of data
 * @param {string} timeRange - Time range
 * @param {string} tier - User tier
 * @param {boolean} forceRefresh - Force refresh from source
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Earnings data response
 */
async function getEarningsData(userId, dataType, timeRange, tier, forceRefresh = false, options = {}) {
  try {
    console.log(`📊 getEarningsData: userId=${userId}, dataType=${dataType}, timeRange=${timeRange}, tier=${tier}, forceRefresh=${forceRefresh}`);

    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cachedData = await getCachedEarningsData(userId, dataType, timeRange, options);
      if (cachedData) {
        const limit = getDataLimit(tier, dataType);
        const limitedData = Array.isArray(cachedData.data) ? cachedData.data.slice(0, limit) : cachedData.data;
        
        return {
          success: true,
          data: limitedData,
          count: Array.isArray(limitedData) ? limitedData.length : 1,
          source: 'cache',
          metadata: cachedData.metadata
        };
      }
    }

    // Fetch fresh data from earnings service
    console.log(`🔄 Fetching fresh earnings data from service...`);
    let freshData;
    
    switch (dataType) {
      case 'upcoming_earnings':
        const limit = options.limit || getDataLimit(tier, dataType);
        freshData = await earningsService.getUpcomingEarnings(timeRange, limit, options.progressCallback);
        break;
        
      case 'earnings_analysis':
        if (!options.ticker) {
          throw new Error('Ticker required for earnings analysis');
        }
        freshData = await earningsService.getEarningsAnalysis(options.ticker);
        break;
        
      case 'historical_earnings':
        if (!options.ticker) {
          throw new Error('Ticker required for historical earnings');
        }
        const histLimit = options.limit || getDataLimit(tier, 'historical_earnings');
        freshData = await earningsService.getHistoricalEarnings(options.ticker, histLimit);
        break;
        
      default:
        throw new Error(`Unsupported data type: ${dataType}`);
    }

    if (!freshData.success) {
      return freshData;
    }

    // Store in cache
    await storeEarningsDataInCache(userId, dataType, timeRange, freshData.data, tier, options);
    
    // Apply tier limits to response
    const limit = getDataLimit(tier, dataType);
    const limitedData = Array.isArray(freshData.data) ? freshData.data.slice(0, limit) : freshData.data;

    return {
      success: true,
      data: limitedData,
      count: Array.isArray(limitedData) ? limitedData.length : 1,
      source: 'fresh',
      metadata: {
        fromCache: false,
        fetchedAt: new Date().toISOString(),
        tier,
        originalCount: Array.isArray(freshData.data) ? freshData.data.length : 1,
        limitedCount: Array.isArray(limitedData) ? limitedData.length : 1
      }
    };
  } catch (error) {
    console.error('❌ Error in getEarningsData:', error);
    return {
      success: false,
      error: 'EARNINGS_FETCH_ERROR',
      message: error.message,
      userMessage: 'Failed to fetch earnings data. Please try again.'
    };
  }
}

/**
 * Clear user's earnings cache
 * @param {number} userId - User ID
 * @param {string} dataType - Optional specific data type to clear
 * @param {string} timeRange - Optional specific time range to clear
 * @returns {Promise<Object>} - Clear result
 */
async function clearUserEarningsCache(userId, dataType = null, timeRange = null) {
  try {
    let query = 'DELETE FROM user_earnings_cache WHERE user_id = $1';
    const params = [userId];
    
    if (dataType) {
      query += ' AND data_type = $2';
      params.push(dataType);
      
      if (timeRange) {
        query += ' AND cache_key LIKE $3';
        params.push(`%${timeRange}%`);
      }
    }
    
    const result = await db.query(query, params);
    
    console.log(`🧹 Cleared ${result.rowCount} earnings cache entries for user ${userId}`);
    
    return {
      success: true,
      clearedEntries: result.rowCount,
      message: `Cleared ${result.rowCount} earnings cache entries`
    };
  } catch (error) {
    console.error('❌ Error clearing user earnings cache:', error);
    return {
      success: false,
      error: 'Failed to clear earnings cache',
      message: error.message
    };
  }
}

/**
 * Get user's earnings cache status
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Cache status
 */
async function getUserEarningsCacheStatus(userId) {
  try {
    const result = await db.query(`
      SELECT 
        data_type,
        cache_key,
        created_at,
        expires_at,
        tier,
        metadata
      FROM user_earnings_cache
      WHERE user_id = $1 AND expires_at > NOW()
      ORDER BY data_type, created_at DESC
    `, [userId]);

    const cacheStatus = {};
    result.rows.forEach(row => {
      if (!cacheStatus[row.data_type]) {
        cacheStatus[row.data_type] = [];
      }
      cacheStatus[row.data_type].push({
        cacheKey: row.cache_key,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        tier: row.tier,
        metadata: row.metadata
      });
    });

    return {
      success: true,
      cacheStatus,
      totalEntries: result.rows.length
    };
  } catch (error) {
    console.error('❌ Error getting earnings cache status:', error);
    return {
      success: false,
      error: 'Failed to get earnings cache status',
      message: error.message
    };
  }
}

/**
 * Clean up expired earnings cache entries
 * @returns {Promise<number>} - Number of deleted entries
 */
async function cleanupExpiredEarningsCache() {
  try {
    const result = await db.query(`
      DELETE FROM user_earnings_cache WHERE expires_at <= NOW()
    `);
    
    if (result.rowCount > 0) {
      console.log(`🧹 Cleaned up ${result.rowCount} expired earnings cache entries`);
    }
    
    return result.rowCount;
  } catch (error) {
    console.error('❌ Error cleaning up expired earnings cache:', error);
    return 0;
  }
}

module.exports = {
  initializeEarningsCacheTables,
  getEarningsData,
  getCachedEarningsData,
  storeEarningsDataInCache,
  clearUserEarningsCache,
  getUserEarningsCacheStatus,
  cleanupExpiredEarningsCache,
  EARNINGS_CACHE_CONFIG
}; 