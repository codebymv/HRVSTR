/**
 * SEC API Rate Limiter
 * 
 * Implements client-side rate limiting to respect SEC EDGAR API limits
 * According to SEC guidelines:
 * - No more than 10 requests per second per IP
 * - Reasonable request patterns to avoid overloading servers
 * 
 * Updated for stricter free-tier compliance
 */

class SecRateLimiter {
  constructor() {
    this.requestQueue = [];
    // Much more conservative for free tier - only 2 requests per second
    this.maxRequestsPerSecond = 2; 
    this.minRequestInterval = 1000 / this.maxRequestsPerSecond; // 500ms between requests
    this.lastRequestTime = 0;
    this.processingQueue = false;
    this.consecutiveErrors = 0;
    this.backoffMultiplier = 1;
  }

  /**
   * Add a request to the rate-limited queue
   * @param {Function} requestFunction - Function that makes the actual request
   * @returns {Promise} - Promise that resolves when the request completes
   */
  async scheduleRequest(requestFunction) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        execute: requestFunction,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      // Start processing if not already running
      if (!this.processingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  async processQueue() {
    if (this.processingQueue) return;
    
    this.processingQueue = true;
    
    try {
      while (this.requestQueue.length > 0) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        // Apply backoff multiplier if we've had consecutive errors
        const effectiveInterval = this.minRequestInterval * this.backoffMultiplier;
        
        // Wait if we need to respect the rate limit
        if (timeSinceLastRequest < effectiveInterval) {
          const waitTime = effectiveInterval - timeSinceLastRequest;
          console.log(`[SecRateLimiter] Rate limiting: waiting ${waitTime}ms before next request (backoff: ${this.backoffMultiplier}x)`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        // Get the next request
        const request = this.requestQueue.shift();
        this.lastRequestTime = Date.now();
        
        try {
          console.log(`[SecRateLimiter] Executing request (${this.requestQueue.length} remaining in queue)`);
          const result = await request.execute();
          
          // Reset backoff on success
          this.consecutiveErrors = 0;
          this.backoffMultiplier = 1;
          
          request.resolve(result);
        } catch (error) {
          console.error(`[SecRateLimiter] Request failed:`, error.message);
          
          // Increase backoff on rate limit errors
          if (error.response?.status === 429) {
            this.consecutiveErrors++;
            this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, 8); // Cap at 8x
            console.log(`[SecRateLimiter] Rate limit error ${this.consecutiveErrors}, increasing backoff to ${this.backoffMultiplier}x`);
          }
          
          request.reject(error);
        }
        
        // Add a longer buffer between requests for free tier
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.requestQueue.length,
      processing: this.processingQueue,
      lastRequestTime: this.lastRequestTime,
      timeSinceLastRequest: Date.now() - this.lastRequestTime,
      consecutiveErrors: this.consecutiveErrors,
      backoffMultiplier: this.backoffMultiplier
    };
  }

  /**
   * Reset backoff (useful for manual intervention)
   */
  resetBackoff() {
    this.consecutiveErrors = 0;
    this.backoffMultiplier = 1;
    console.log(`[SecRateLimiter] Backoff reset manually`);
  }
}

// Create a singleton instance
const secRateLimiter = new SecRateLimiter();

module.exports = {
  secRateLimiter,
  SecRateLimiter
}; 