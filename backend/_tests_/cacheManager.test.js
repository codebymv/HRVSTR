/**
 * Tests for Cache Manager
 * 
 * These tests focus on the cache manager improvements for request deduplication
 * and concurrent request handling.
 */
const cacheManager = require('../src/utils/cacheManager');

// We need to mock the cache manager methods since it's a singleton using NodeCache underneath
describe('Cache Manager', () => {
  // Setup mocks before each test
  beforeEach(() => {
    // Clear cache before tests
    cacheManager.clear();
    cacheManager.pendingRequests = {};
    
    // Spy on methods
    jest.spyOn(cacheManager, 'get');
    jest.spyOn(cacheManager, 'set');
    jest.spyOn(cacheManager, 'has');
    jest.spyOn(cacheManager, 'delete');
  });
  
  // Restore original methods after each test
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Request Queue System', () => {
    test('should deduplicate concurrent requests for the same resource', async () => {
      // Create a mock fetch function that tracks call count
      const mockFetch = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // small delay
        return 'test-data';
      });
      
      // Make multiple concurrent requests for the same resource
      const promises = [];
      const numRequests = 5;
      
      for (let i = 0; i < numRequests; i++) {
        promises.push(
          cacheManager.getOrFetch('test-key', 'test-resource', mockFetch, { ttl: 60 })
        );
      }
      
      // Wait for all promises to resolve
      const results = await Promise.all(promises);
      
      // Verify that all requests returned the same data
      results.forEach(result => {
        expect(result).toBe('test-data');
      });
      
      // Verify the fetch function was only called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Verify data was cached
      expect(cacheManager.set).toHaveBeenCalledWith('test-key', 'test-data', 60);
    });

    test('should handle errors in fetch function and remove from pending requests', async () => {
      // Set up the has method to return false (no cache)
      cacheManager.has.mockReturnValue(false);
      
      // Create a mock fetch function that throws an error
      const mockError = new Error('Test error');
      const mockFetch = jest.fn().mockRejectedValue(mockError);
      
      // Attempt to fetch data that will result in an error
      await expect(
        cacheManager.getOrFetch('error-key', 'test-resource', mockFetch, { ttl: 60 })
      ).rejects.toThrow('Test error');
      
      // Verify the fetch function was called
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Verify the pending request was removed
      expect(cacheManager.pendingRequests['error-key']).toBeUndefined();
    });

    test('should return cached data instead of making a new request', async () => {
      // Set up the has method to return true (cached data exists)
      cacheManager.has.mockReturnValue(true);
      const cachedData = 'cached-data';
      cacheManager.get.mockReturnValue(cachedData);
      
      // Create a mock fetch function
      const mockFetch = jest.fn();
      
      // Fetch the cached data
      const result = await cacheManager.getOrFetch('cached-key', 'test-resource', mockFetch);
      
      // Verify cached data was returned
      expect(result).toBe(cachedData);
      
      // Verify the fetch function was not called
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('should use cached data when rate limited', async () => {
      // Set up cached data
      // Set up the has method to return true for cached data check
      cacheManager.has.mockReturnValue(true);
      const cachedData = 'rate-limited-data';
      cacheManager.get.mockReturnValue(cachedData);
      
      // Mock rate limiting
      jest.spyOn(cacheManager, 'isRateLimited').mockReturnValue(true);
      jest.spyOn(cacheManager, 'getRateLimitInfo').mockReturnValue({
        nextAllowedAt: Math.floor(Date.now() / 1000) + 60
      });
      
      // Create a mock fetch function
      const mockFetch = jest.fn();
      
      // Fetch when rate limited
      const result = await cacheManager.getOrFetch('rate-limited-key', 'rate-limited-resource', mockFetch);
      
      // Verify cached data was returned
      expect(result).toBe(cachedData);
      
      // Verify the fetch function was not called
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should use cached data when fetch fails', async () => {
      // Set up the has method to return true (cached data exists) when checked
      // We need to make it return true after the fetch fails
      let fetchFailed = false;
      cacheManager.has.mockImplementation(() => fetchFailed);
      
      const cachedData = 'error-fallback-data';
      cacheManager.get.mockReturnValue(cachedData);
      
      // Create a mock fetch function that throws an error
      const mockFetch = jest.fn().mockImplementation(async () => {
        fetchFailed = true; // Now has() will return true
        throw new Error('Fetch failed');
      });
      
      // Fetch with error
      const result = await cacheManager.getOrFetch('error-fallback-key', 'test-resource', mockFetch);
      
      // Verify cached data was returned
      expect(result).toBe(cachedData);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should throw error when fetch fails and no cached data exists', async () => {
      // Set up the has method to return false (no cache)
      cacheManager.has.mockReturnValue(false);
      
      // Create a mock fetch function that throws an error
      const mockFetch = jest.fn().mockRejectedValue(new Error('No cache available'));
      
      // Attempt to fetch data that will result in an error with no cache
      await expect(
        cacheManager.getOrFetch('no-cache-key', 'test-resource', mockFetch)
      ).rejects.toThrow('No cache available');
      
      // Verify the fetch function was called
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rate Limiting', () => {
    test('should register and check rate limits', () => {
      // Register a rate limit
      cacheManager.registerRateLimit('test-api', 100, 60); // 100 requests per minute
      
      // Mock date.now for consistent testing
      const originalDateNow = Date.now;
      const mockTime = 1000000;
      Date.now = jest.fn().mockReturnValue(mockTime);
      
      // Check rate limiting - should not be limited initially
      expect(cacheManager.isRateLimited('test-api')).toBe(false);
      
      // Get rate limit info
      const info = cacheManager.getRateLimitInfo('test-api');
      expect(info).toHaveProperty('isLimited', false);
      expect(info).toHaveProperty('remaining');
      expect(info).toHaveProperty('resetAt');
      
      // Restore date.now
      Date.now = originalDateNow;
    });
  });
  
  describe('Request Deduplication', () => {
    test('should save and read from pending requests object', async () => {
      // Directly test the pendingRequests mechanism
      expect(cacheManager.pendingRequests).toEqual({});
      
      // Add a pending request
      const pendingPromise = Promise.resolve('pending-result');
      cacheManager.pendingRequests['pending-key'] = pendingPromise;
      
      // Check it was stored
      expect(cacheManager.pendingRequests['pending-key']).toBe(pendingPromise);
      
      // Wait for it to resolve
      const result = await cacheManager.pendingRequests['pending-key'];
      expect(result).toBe('pending-result');
    });
  });
});
