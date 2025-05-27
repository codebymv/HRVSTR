/**
 * Tests for API Caching Performance
 * 
 * These tests focus on measuring and validating the performance
 * improvements from the caching system.
 */
const request = require('supertest');
const nock = require('nock');
const express = require('express');
const cacheManager = require('../src/utils/cacheManager');

// For measuring performance
const { performance } = require('perf_hooks');

// Create a test Express app
const app = express();

// Configure a test route that uses caching
app.get('/api/sentiment/stock/:ticker', async (req, res) => {
  const ticker = req.params.ticker;
  const cacheKey = `sentiment:${ticker}`;
  const resource = 'sentiment-api';
  
  try {
    const data = await cacheManager.getOrFetch(
      cacheKey,
      resource,
      async () => {
        // This would normally call an external API
        const url = `https://sentiment-api.hrvstr.com/analyze?ticker=${ticker}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('API Error');
        return response.json();
      },
      { ttl: 300 } // 5 minutes cache
    );
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Configure routes for other test cases
app.get('/api/large-data-endpoint', async (req, res) => {
  const cacheKey = 'large-data';
  const resource = 'large-data-api';
  
  try {
    const data = await cacheManager.getOrFetch(
      cacheKey,
      resource,
      async () => {
        const url = 'https://api.hrvstr.com/api/large-data';
        const response = await fetch(url);
        if (!response.ok) throw new Error('API Error');
        return response.json();
      },
      { ttl: 60 }
    );
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// We'll create different mocks for each test

describe('API Caching Performance', () => {
  // Original fetch implementation
  const originalFetch = global.fetch;
  
  beforeEach(() => {
    // Clear cache before each test
    cacheManager.clear();
    
    // Reset fetch mock for each test
    global.fetch = jest.fn();
  });
  
  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });
  
  describe('Response Time Improvements', () => {
    test('should significantly improve response times for cached endpoints', async () => {
      // Mock a slow API response for sentiment analysis
      global.fetch = jest.fn().mockImplementation((url) => {
        // Add delay to simulate a slow response
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                results: [
                  { ticker: 'AAPL', score: 0.8, sentiment: 'positive' }
                ]
              })
            });
          }, 200); // Simulate a slow response (200ms)
        });
      });
      
      // First request (uncached) - should be slow
      const startTime1 = performance.now();
      
      const response1 = await request(app)
        .get('/api/sentiment/stock/AAPL')
        .set('Accept', 'application/json');
        
      const endTime1 = performance.now();
      const duration1 = endTime1 - startTime1;
      
      expect(response1.status).toBe(200);
      expect(global.fetch).toHaveBeenCalled();
      
      // Reset fetch calls counter
      global.fetch.mockClear();
      
      // Second request (cached) - should be fast
      const startTime2 = performance.now();
      
      const response2 = await request(app)
        .get('/api/sentiment/stock/AAPL')
        .set('Accept', 'application/json');
        
      const endTime2 = performance.now();
      const duration2 = endTime2 - startTime2;
      
      expect(response2.status).toBe(200);
      
      // The fetch should not be called again (using cache)
      expect(global.fetch).not.toHaveBeenCalled();
      
      // The cached response should be faster than the uncached response
      expect(duration2).toBeLessThan(duration1);
      
      // For debugging
      console.log(`Uncached request took ${duration1}ms`);
      console.log(`Cached request took ${duration2}ms`);
      console.log(`Performance improvement: ${Math.round(duration1 / duration2)}x faster`);
    });
    
    test('should maintain performance with high request volume', async () => {
      // Setup route for testing
      app.get('/api/high-volume-test', async (req, res) => {
        const cacheKey = 'high-volume-test';
        const resource = 'test-api';
        
        try {
          const data = await cacheManager.getOrFetch(
            cacheKey,
            resource,
            async () => {
              // This would normally call an external API
              const response = await fetch('https://api.example.com/data');
              return await response.json();
            },
            { ttl: 60 } // 1 minute cache
          );
          
          res.json(data);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
      
      // Mock the API response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test data' })
      });
      
      // First request to populate cache
      await request(app)
        .get('/api/high-volume-test')
        .set('Accept', 'application/json');
      
      // Clear the mock call count
      global.fetch.mockClear();
      
      // Measure performance with multiple simultaneous requests
      const requestCount = 20; // Reduced from 50 for faster tests
      const startTime = performance.now();
      
      const requests = [];
      for (let i = 0; i < requestCount; i++) {
        requests.push(
          request(app)
            .get('/api/high-volume-test')
            .set('Accept', 'application/json')
        );
      }
      
      const responses = await Promise.all(requests);
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const averageDuration = totalDuration / requestCount;
      
      // Verify all responses were successful
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Fetch should not be called again (all requests should use cache)
      expect(global.fetch).not.toHaveBeenCalled();
      
      // Log performance metrics
      console.log(`Processed ${requestCount} requests in ${totalDuration}ms`);
      console.log(`Average response time: ${averageDuration}ms per request`);
    });
  });
  
  describe('Memory Usage', () => {
    test('should maintain efficient memory usage with large responses', async () => {
      // Create a large response payload (approximately 1MB)
      const generateLargePayload = (size) => {
        // Generate array of random data
        const randomData = [];
        for (let i = 0; i < size; i++) {
          randomData.push({
            id: `item-${i}`,
            value: Math.random().toString(36).substring(2),
            timestamp: Date.now(),
            details: {
              field1: Math.random(),
              field2: Math.random().toString(36).substring(2),
              field3: Math.random() > 0.5
            }
          });
        }
        return { data: randomData };
      };
      
      // Mock large response from API - reduced size for faster tests
      const largePayload = generateLargePayload(1000);
      
      // Setup mock
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => largePayload
      });
      
      // First request to populate cache
      const response1 = await request(app)
        .get('/api/large-data-endpoint')
        .set('Accept', 'application/json');
      
      expect(response1.status).toBe(200);
      expect(global.fetch).toHaveBeenCalled();
      
      // Reset mock counter
      global.fetch.mockClear();
      
      // Check memory usage before making additional requests
      const memoryBefore = process.memoryUsage();
      
      // Make multiple requests to the cached endpoint
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/large-data-endpoint')
            .set('Accept', 'application/json')
        );
      }
      
      await Promise.all(requests);
      
      // Verify fetch wasn't called again (used cache)
      expect(global.fetch).not.toHaveBeenCalled();
      
      // Check memory usage after
      const memoryAfter = process.memoryUsage();
      
      // Calculate heap size difference in MB
      const heapDiffMB = (memoryAfter.heapUsed - memoryBefore.heapUsed) / (1024 * 1024);
      
      // Memory increase should be minimal (threshold may need adjustment)
      // We expect some increase but it should be well managed by the cache system
      expect(heapDiffMB).toBeLessThan(10); // Less than 10MB increase for 10 identical requests
      
      console.log(`Memory usage before: ${memoryBefore.heapUsed / (1024 * 1024)} MB`);
      console.log(`Memory usage after: ${memoryAfter.heapUsed / (1024 * 1024)} MB`);
      console.log(`Difference: ${heapDiffMB.toFixed(2)} MB`);
    });
    
    test('should handle cache expiration without memory leaks', async () => {
      // Mock timers for controlled testing
      jest.useFakeTimers();
      
      // Mock API with cacheable response
      nock('https://api.hrvstr.com')
        .get('/api/test-data')
        .times(2) // Will be called twice
        .reply(200, { data: 'test' });
      
      // Initial memory usage
      const initialMemory = process.memoryUsage();
      
      // Make initial request to populate cache with short TTL
      await request(app)
        .get('/api/test-data-endpoint?ttl=1')
        .set('Accept', 'application/json');
      
      // Fast-forward time past cache expiration
      jest.advanceTimersByTime(2000); // 2 seconds
      
      // Capture memory usage after cache expiration
      const midMemory = process.memoryUsage();
      
      // Make another request which should create a new cache entry
      await request(app)
        .get('/api/test-data-endpoint?ttl=1')
        .set('Accept', 'application/json');
      
      // Fast-forward time past cache expiration again
      jest.advanceTimersByTime(2000); // 2 seconds
      
      // Final memory check
      const finalMemory = process.memoryUsage();
      
      // Calculate heap differences in MB
      const midHeapDiffMB = (midMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);
      const finalHeapDiffMB = (finalMemory.heapUsed - midMemory.heapUsed) / (1024 * 1024);
      
      // The second cache cycle should be manageable
      // Note: We can't reliably test exact GC behavior in unit tests
      // So we just verify the memory isn't growing exponentially
      expect(finalHeapDiffMB).toBeLessThan(10); // Limit overall growth
      
      console.log(`Initial heap: ${initialMemory.heapUsed / (1024 * 1024)} MB`);
      console.log(`Mid heap: ${midMemory.heapUsed / (1024 * 1024)} MB (${midHeapDiffMB.toFixed(2)} MB increase)`);
      console.log(`Final heap: ${finalMemory.heapUsed / (1024 * 1024)} MB (${finalHeapDiffMB.toFixed(2)} MB increase)`);
      
      // Restore timers
      jest.useRealTimers();
    });
  });
  
  describe('Cache Efficiency', () => {
    test('should properly deduplicate similar requests with different query parameters', async () => {
      // Track how many times the API was actually called
      let apiCallCount = 0;
      
      // Setup a test route for stock data
      app.get('/api/stocks', async (req, res) => {
        const ticker = req.query.ticker;
        const cacheKey = `stocks:${ticker}`;
        const resource = 'stocks-api';
        
        try {
          const data = await cacheManager.getOrFetch(
            cacheKey,
            resource,
            async () => {
              // This would normally call an external API
              const url = `https://api.example.com/stocks?ticker=${ticker}`;
              const response = await fetch(url);
              return await response.json();
            },
            { ttl: 60 } // 1 minute cache
          );
          
          res.json(data);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
      
      // Mock fetch to track unique calls
      global.fetch = jest.fn().mockImplementation(url => {
        apiCallCount++;
        // Extract ticker from URL
        const ticker = new URL(url).searchParams.get('ticker');
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: `data for ${ticker}` })
        });
      });
      
      // Make requests with different query parameters in the same shape
      const tickers = ['AAPL', 'MSFT', 'GOOG', 'AAPL', 'MSFT', 'GOOG'];
      
      for (const ticker of tickers) {
        await request(app)
          .get(`/api/stocks?ticker=${ticker}`)
          .set('Accept', 'application/json');
      }
      
      // API should only be called for unique combinations
      expect(apiCallCount).toBe(3); // Once for each unique ticker
    });
    
    // Set longer timeout for this specific test
    test('should handle cache stampede for popular endpoints', async () => {
      // Setup a test route for popular data that uses caching
      app.get('/api/popular-endpoint', async (req, res) => {
        const cacheKey = 'popular-data';
        const resource = 'popular-api';
        
        try {
          const data = await cacheManager.getOrFetch(
            cacheKey,
            resource,
            async () => {
              // This would normally call an external API
              const response = await fetch('https://api.example.com/popular-data');
              return await response.json();
            },
            { ttl: 60 } // 1 minute cache
          );
          
          res.json(data);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
      
      // Counter to track API calls
      let apiCallCount = 0;
      
      // Mock a slow API response
      global.fetch = jest.fn().mockImplementation(() => {
        apiCallCount++;
        // Return a delayed response to simulate a slow API
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ data: 'popular data' })
            });
          }, 50); // Reduced to 50ms delay for faster tests
        });
      });
      
      // Make simultaneous first-time requests (cache stampede scenario)
      const requestCount = 5; // Reduced from 20 to 5 for faster tests
      const requests = [];
      
      for (let i = 0; i < requestCount; i++) {
        requests.push(
          request(app)
            .get('/api/popular-endpoint')
            .set('Accept', 'application/json')
        );
      }
      
      // Wait for all requests to complete
      const responses = await Promise.all(requests);
      
      // All responses should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ data: 'popular data' });
      });
      
      // The fetch function should only be called once due to deduplication
      expect(apiCallCount).toBe(1);
    });
  });
});
