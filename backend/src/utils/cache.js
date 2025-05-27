/**
 * Cache utility functions
 * Provides a centralized caching mechanism for API responses
 */

// In-memory cache
const cache = new Map();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a cache key from type and parameters
 * @param {string} type - Cache type identifier
 * @param {Object} params - Parameters to include in the key
 * @returns {string} Cache key
 */
function getCacheKey(type, params = {}) {
  return `${type}:${JSON.stringify(params)}`;
}

/**
 * Get an item from cache
 * @param {string} type - Cache type identifier
 * @param {Object} params - Parameters to include in the key
 * @returns {*} Cached item or undefined if not found
 */
function getCachedItem(type, params = {}) {
  const key = getCacheKey(type, params);
  const item = cache.get(key);
  
  if (!item) return undefined;
  
  // Check if item is expired
  if (item.expiry && item.expiry < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  
  return item.data;
}

/**
 * Set an item in cache
 * @param {string} type - Cache type identifier
 * @param {Object} params - Parameters to include in the key
 * @param {*} data - Data to cache
 * @param {number} ttl - Time to live in milliseconds
 */
function setCachedItem(type, params = {}, data, ttl = DEFAULT_TTL) {
  const key = getCacheKey(type, params);
  cache.set(key, {
    data,
    expiry: Date.now() + ttl
  });
}

/**
 * Check if an item exists in cache
 * @param {string} type - Cache type identifier
 * @param {Object} params - Parameters to include in the key
 * @returns {boolean} True if item exists in cache
 */
function hasCachedItem(type, params = {}) {
  const key = getCacheKey(type, params);
  const item = cache.get(key);
  
  if (!item) return false;
  
  // Check if item is expired
  if (item.expiry && item.expiry < Date.now()) {
    cache.delete(key);
    return false;
  }
  
  return true;
}

/**
 * Clear items from cache
 * @param {string} [type] - Optional cache type identifier to clear only specific type
 * @returns {number} Number of cache entries cleared
 */
function clearCache(type) {
  // If type is provided, only clear that type
  if (type) {
    let count = 0;
    // Remove all cache entries that start with the specified type
    for (const key of cache.keys()) {
      if (key.startsWith(`${type}:`)) {
        cache.delete(key);
        count++;
      }
    }
    return count;
  } 
  
  // Otherwise, clear the entire cache
  const count = cache.size;
  cache.clear();
  return count;
}

module.exports = {
  getCacheKey,
  getCachedItem,
  setCachedItem,
  hasCachedItem,
  clearCache,
  DEFAULT_TTL
};