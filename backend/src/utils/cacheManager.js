/**
 * Cache Manager
 * Provides a unified approach to caching and rate limiting
 */
const NodeCache = require('node-cache');

class CacheManager {
  constructor(options = {}) {
    // Default options
    this.options = {
      defaultTTL: 5 * 60, // 5 minutes in seconds
      checkPeriod: 60, // Check for expired keys every minute
      ...options
    };
    
    // Initialize cache
    this.cache = new NodeCache({
      stdTTL: this.options.defaultTTL,
      checkperiod: this.options.checkPeriod
    });
    
    // Rate limit tracking
    this.rateLimits = new Map();
    
    // Add pending requests queue to prevent redundant concurrent requests
    this.pendingRequests = {};
  }
  
  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    return this.cache.get(key);
  }
  
  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   */
  set(key, value, ttl = this.options.defaultTTL) {
    return this.cache.set(key, value, ttl);
  }
  
  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  has(key) {
    return this.cache.has(key);
  }
  
  /**
   * Delete a key from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    return this.cache.del(key);
  }
  
  /**
   * Clear all cache
   */
  clear() {
    return this.cache.flushAll();
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return this.cache.getStats();
  }
  
  /**
   * Register a rate limit for a specific resource
   * @param {string} resource - Resource identifier
   * @param {number} limit - Number of requests allowed
   * @param {number} window - Time window in seconds
   */
  registerRateLimit(resource, limit, window) {
    this.rateLimits.set(resource, { limit, window });
  }
  
  /**
   * Check if a resource is rate limited
   * @param {string} resource - Resource identifier
   * @returns {boolean} True if rate limited
   */
  isRateLimited(resource) {
    const rateKey = `rate:${resource}`;
    const usageKey = `usage:${resource}`;
    const now = Math.floor(Date.now() / 1000);
    
    // Get rate limit config
    const rateLimit = this.rateLimits.get(resource);
    if (!rateLimit) return false;
    
    // Get current usage
    const usage = this.get(usageKey) || [];
    
    // Clean up old timestamps
    const validUsage = usage.filter(timestamp => 
      timestamp > now - rateLimit.window
    );
    
    // Check if rate limited
    const isLimited = validUsage.length >= rateLimit.limit;
    
    // Update usage
    if (!isLimited) {
      validUsage.push(now);
    }
    this.set(usageKey, validUsage, rateLimit.window * 2);
    
    // Store rate limit status
    this.set(rateKey, {
      isLimited,
      remaining: Math.max(0, rateLimit.limit - validUsage.length),
      resetAt: now + rateLimit.window,
      nextAllowedAt: isLimited ? 
        Math.min(...validUsage) + rateLimit.window : 
        now
    }, rateLimit.window);
    
    return isLimited;
  }
  
  /**
   * Get rate limit info for a resource
   * @param {string} resource - Resource identifier
   * @returns {Object} Rate limit info
   */
  getRateLimitInfo(resource) {
    const rateKey = `rate:${resource}`;
    return this.get(rateKey) || {
      isLimited: false,
      remaining: this.rateLimits.get(resource)?.limit || 0,
      resetAt: 0,
      nextAllowedAt: 0
    };
  }
  
  /**
   * Get or fetch data with caching and rate limiting
   * @param {string} key - Cache key
   * @param {string} resource - Resource for rate limiting
   * @param {Function} fetchFn - Function to fetch data if not cached
   * @param {Object} options - Options
   * @param {number} options.ttl - Cache TTL in seconds
   * @param {boolean} options.forceRefresh - Force refresh even if cached
   * @returns {Promise<*>} Fetched or cached data
   */
  async getOrFetch(key, resource, fetchFn, options = {}) {
    const { ttl = this.options.defaultTTL, forceRefresh = false } = options;
    
    // Check if we have a cached value and not forcing refresh
    if (!forceRefresh && this.has(key)) {
      return this.get(key);
    }
    
    // Check rate limiting
    if (this.isRateLimited(resource)) {
      const rateInfo = this.getRateLimitInfo(resource);
      const waitTime = rateInfo.nextAllowedAt - Math.floor(Date.now() / 1000);
      
      console.warn(`Rate limited for ${resource}. Try again in ${waitTime} seconds.`);
      
      // Return cached data if available, even if stale
      if (this.has(key)) {
        return this.get(key);
      }
      
      throw new Error(`Rate limited for ${resource}. No cached data available.`);
    }
    
    // Check if this request is already in progress
    if (this.pendingRequests[key]) {
      console.log(`Request for ${key} already in progress, reusing promise`);
      return this.pendingRequests[key];
    }
    
    // Create a new promise for this request and store it
    try {
      // Store the promise in pendingRequests
      this.pendingRequests[key] = (async () => {
        try {
          // Fetch fresh data
          const data = await fetchFn();
          
          // Cache the result
          this.set(key, data, ttl);
          
          return data;
        } catch (error) {
          // If error and we have cached data, return that
          if (this.has(key)) {
            console.warn(`Error fetching fresh data: ${error.message}. Using cached data.`);
            return this.get(key);
          }
          
          // Otherwise, rethrow
          throw error;
        } finally {
          // Remove from pending requests when done
          delete this.pendingRequests[key];
        }
      })();
      
      return this.pendingRequests[key];
    } catch (error) {
      // This should never happen since we're using an async IIFE, but just in case
      delete this.pendingRequests[key];
      throw error;
    }
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

module.exports = cacheManager;