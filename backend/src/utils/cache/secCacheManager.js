/**
 * SEC Cache Manager - Intelligent caching strategies for SEC data
 */

/**
 * Calculate cache TTL based on data type and market conditions
 * @param {string} dataType - Type of SEC data
 * @param {Object} options - Additional options
 * @returns {number} - TTL in seconds
 */
function calculateCacheTtl(dataType, options = {}) {
  const { 
    isMarketHours = null,
    forceRefresh = false,
    userTier = 'free'
  } = options;

  if (forceRefresh) {
    return 0; // No cache if force refresh
  }

  // Determine if market is currently open
  const marketOpen = isMarketHours !== null ? isMarketHours : isCurrentlyMarketHours();

  // Base TTLs for different data types
  const baseTtls = {
    'insider_trades': {
      marketOpen: 15 * 60,    // 15 minutes during market hours
      marketClosed: 45 * 60   // 45 minutes after hours
    },
    'institutional_holdings': {
      marketOpen: 30 * 60,    // 30 minutes during market hours
      marketClosed: 90 * 60   // 90 minutes after hours
    },
    'filing_details': {
      marketOpen: 24 * 60 * 60,  // 24 hours (filings don't change)
      marketClosed: 24 * 60 * 60
    },
    'abnormal_activity': {
      marketOpen: 10 * 60,    // 10 minutes during market hours
      marketClosed: 30 * 60   // 30 minutes after hours
    },
    'ticker_summary': {
      marketOpen: 20 * 60,    // 20 minutes during market hours
      marketClosed: 60 * 60   // 60 minutes after hours
    },
    'parallel_data': {
      marketOpen: 15 * 60,    // 15 minutes during market hours
      marketClosed: 45 * 60   // 45 minutes after hours
    }
  };

  const dataTypeTtl = baseTtls[dataType];
  if (!dataTypeTtl) {
    // Default TTL for unknown data types
    return marketOpen ? 20 * 60 : 60 * 60;
  }

  const baseTtl = marketOpen ? dataTypeTtl.marketOpen : dataTypeTtl.marketClosed;

  // Adjust TTL based on user tier
  const tierMultipliers = {
    'free': 1.0,      // Standard TTL
    'pro': 0.7,       // 30% shorter cache for more fresh data
    'premium': 0.5    // 50% shorter cache for freshest data
  };

  const multiplier = tierMultipliers[userTier] || 1.0;
  return Math.round(baseTtl * multiplier);
}

/**
 * Check if market is currently open (9:30 AM - 4:00 PM ET)
 * @returns {boolean} - Whether market is open
 */
function isCurrentlyMarketHours() {
  const now = new Date();
  
  // Convert to Eastern Time (approximation - doesn't handle DST perfectly)
  const etOffset = -5; // EST offset from UTC
  const etHour = now.getUTCHours() + etOffset;
  const etMinute = now.getUTCMinutes();
  
  // Market hours: 9:30 AM - 4:00 PM ET
  const marketOpenTime = 9 * 60 + 30; // 9:30 in minutes
  const marketCloseTime = 16 * 60;    // 4:00 PM in minutes
  const currentTime = etHour * 60 + etMinute;
  
  // Check if it's a weekday (0 = Sunday, 6 = Saturday)
  const dayOfWeek = now.getUTCDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  
  return isWeekday && currentTime >= marketOpenTime && currentTime < marketCloseTime;
}

/**
 * Generate cache key for SEC data
 * @param {string} dataType - Type of SEC data
 * @param {Object} params - Parameters for the request
 * @param {string} userId - User ID (optional, for user-specific caching)
 * @returns {string} - Generated cache key
 */
function generateCacheKey(dataType, params = {}, userId = null) {
  const {
    timeRange = '1m',
    limit = 100,
    ticker = null,
    minScore = null,
    refresh = false
  } = params;

  // Base key components
  const keyComponents = [
    'sec',
    dataType.replace('_', '-'),
    timeRange,
    `limit-${limit}`
  ];

  // Add optional parameters
  if (ticker) {
    keyComponents.push(`ticker-${ticker.toUpperCase()}`);
  }

  if (minScore !== null) {
    keyComponents.push(`score-${minScore}`);
  }

  // Add user-specific component for personalized caching
  if (userId) {
    keyComponents.push(`user-${userId}`);
  }

  return keyComponents.join('-');
}

/**
 * Generate cache key for user-specific SEC data
 * @param {string} userId - User ID
 * @param {string} dataType - Type of SEC data
 * @param {Object} params - Parameters for the request
 * @returns {string} - User-specific cache key
 */
function generateUserCacheKey(userId, dataType, params = {}) {
  return generateCacheKey(dataType, params, userId);
}

/**
 * Determine cache namespace based on data type and access pattern
 * @param {string} dataType - Type of SEC data
 * @param {string} accessPattern - How the data is being accessed
 * @returns {string} - Cache namespace
 */
function getCacheNamespace(dataType, accessPattern = 'standard') {
  const namespaces = {
    'insider_trades': {
      'standard': 'sec-insider',
      'streaming': 'sec-insider-stream',
      'ticker': 'sec-insider-ticker'
    },
    'institutional_holdings': {
      'standard': 'sec-institutional',
      'streaming': 'sec-institutional-stream',
      'ticker': 'sec-institutional-ticker'
    },
    'filing_details': {
      'standard': 'sec-filing',
      'document': 'sec-filing-doc'
    },
    'abnormal_activity': {
      'standard': 'sec-abnormal',
      'analysis': 'sec-abnormal-analysis'
    },
    'ticker_summary': {
      'standard': 'sec-ticker-summary',
      'detailed': 'sec-ticker-detailed'
    },
    'parallel_data': {
      'standard': 'sec-parallel',
      'combined': 'sec-parallel-combined'
    }
  };

  const dataTypeNamespaces = namespaces[dataType];
  if (!dataTypeNamespaces) {
    return `sec-${dataType}`;
  }

  return dataTypeNamespaces[accessPattern] || dataTypeNamespaces.standard;
}

/**
 * Create cache configuration for specific request
 * @param {string} dataType - Type of SEC data
 * @param {Object} params - Request parameters
 * @param {Object} options - Additional options
 * @returns {Object} - Cache configuration
 */
function createCacheConfig(dataType, params = {}, options = {}) {
  const {
    userId = null,
    userTier = 'free',
    accessPattern = 'standard',
    forceRefresh = false
  } = options;

  const key = generateCacheKey(dataType, params, userId);
  const namespace = getCacheNamespace(dataType, accessPattern);
  const ttl = calculateCacheTtl(dataType, { 
    userTier, 
    forceRefresh 
  });

  return {
    key,
    namespace,
    ttl,
    dataType,
    params,
    userId,
    userTier,
    accessPattern,
    forceRefresh,
    generated: new Date().toISOString()
  };
}

/**
 * Invalidate cache patterns for specific data types
 * @param {string} dataType - Type of SEC data to invalidate
 * @param {Object} params - Optional parameters to narrow invalidation
 * @returns {Array} - Array of cache key patterns to invalidate
 */
function getCacheInvalidationPatterns(dataType, params = {}) {
  const patterns = [];

  switch (dataType) {
    case 'insider_trades':
      patterns.push(`sec-insider-*`);
      if (params.ticker) {
        patterns.push(`*ticker-${params.ticker.toUpperCase()}*`);
      }
      break;

    case 'institutional_holdings':
      patterns.push(`sec-institutional-*`);
      if (params.ticker) {
        patterns.push(`*ticker-${params.ticker.toUpperCase()}*`);
      }
      break;

    case 'abnormal_activity':
      patterns.push(`sec-abnormal-*`);
      break;

    case 'all':
      patterns.push(`sec-*`);
      break;

    default:
      patterns.push(`sec-${dataType}-*`);
  }

  return patterns;
}

/**
 * Get cache statistics for monitoring
 * @param {string} namespace - Cache namespace to analyze
 * @returns {Object} - Cache statistics
 */
function getCacheStats(namespace = null) {
  // This would integrate with your cache implementation
  // For now, returning a placeholder structure
  return {
    namespace,
    totalKeys: 0,
    totalSize: 0,
    hitRate: 0.0,
    avgTtl: 0,
    oldestEntry: null,
    newestEntry: null,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Optimize cache configuration based on usage patterns
 * @param {string} dataType - Type of SEC data
 * @param {Object} usageStats - Usage statistics
 * @returns {Object} - Optimized cache configuration
 */
function optimizeCacheConfig(dataType, usageStats = {}) {
  const {
    hitRate = 0.5,
    avgResponseTime = 1000,
    requestFrequency = 10,
    userTier = 'free'
  } = usageStats;

  let optimizedTtl = calculateCacheTtl(dataType, { userTier });

  // Adjust TTL based on hit rate
  if (hitRate > 0.8) {
    // High hit rate - can afford longer cache
    optimizedTtl *= 1.2;
  } else if (hitRate < 0.3) {
    // Low hit rate - shorter cache for fresher data
    optimizedTtl *= 0.8;
  }

  // Adjust based on response time
  if (avgResponseTime > 3000) {
    // Slow responses - favor caching
    optimizedTtl *= 1.3;
  }

  // Adjust based on request frequency
  if (requestFrequency > 50) {
    // High frequency - shorter cache for fresher data
    optimizedTtl *= 0.9;
  }

  return {
    optimizedTtl: Math.round(optimizedTtl),
    originalTtl: calculateCacheTtl(dataType, { userTier }),
    optimizationFactor: optimizedTtl / calculateCacheTtl(dataType, { userTier }),
    reason: 'Optimized based on usage patterns',
    usageStats
  };
}

module.exports = {
  calculateCacheTtl,
  isCurrentlyMarketHours,
  generateCacheKey,
  generateUserCacheKey,
  getCacheNamespace,
  createCacheConfig,
  getCacheInvalidationPatterns,
  getCacheStats,
  optimizeCacheConfig
}; 