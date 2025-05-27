/**
 * Tests for Proxy Server Caching
 * 
 * These tests verify the caching behavior of the proxy server,
 * including TTL settings, request deduplication, and cache invalidation.
 */
const request = require('supertest');
const nock = require('nock');
const express = require('express');
const cacheManager = require('../src/utils/cacheManager');

// Create a test app with Express
const app = express();

// Configure test routes
app.get('/api/reddit/subreddit/:subreddit', async (req, res) => {
  const subreddit = req.params.subreddit;
  const freshData = req.query._freshData === 'true';
  const cacheKey = `reddit:${subreddit}`;
  const resource = 'reddit-api';
  
  try {
    const data = await cacheManager.getOrFetch(
      cacheKey,
      resource,
      async () => {
        // Call external Reddit API
        const url = `https://www.reddit.com/r/${subreddit}/hot.json`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Reddit API error');
        const json = await response.json();
        return json.data.children.map(child => child.data);
      },
      { forceRefresh: freshData }
    );
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sec/filing/:id', async (req, res) => {
  const id = req.params.id;
  const cacheKey = `sec:filing:${id}`;
  const resource = 'sec-api';
  
  try {
    const data = await cacheManager.getOrFetch(
      cacheKey,
      resource,
      async () => {
        // Call external SEC API
        const url = `https://www.sec.gov/Archives/edgar/data/${id}/form4.xml`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('SEC API error');
        return await response.text();
      },
      { ttl: 24 * 60 * 60 } // 24 hour cache for SEC filings
    );
    
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sentiment/stock/:ticker', async (req, res) => {
  const ticker = req.params.ticker;
  const cacheKey = `sentiment:${ticker}`;
  const resource = 'sentiment-api';
  
  try {
    const data = await cacheManager.getOrFetch(
      cacheKey,
      resource,
      async () => {
        // Call external Sentiment API
        const url = `https://sentiment-api.hrvstr.com/api/analyze?ticker=${ticker}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Sentiment API error');
        return await response.json();
      },
      { ttl: 60 * 60 } // 1 hour cache for sentiment data
    );
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/slow-endpoint', async (req, res) => {
  const cacheKey = 'slow-data';
  const resource = 'slow-api';
  
  try {
    const data = await cacheManager.getOrFetch(
      cacheKey,
      resource,
      async () => {
        // Call external slow API
        const url = 'https://slow-api.hrvstr.com/api/data';
        const response = await fetch(url);
        if (!response.ok) throw new Error('Slow API error');
        return await response.json();
      },
      { ttl: 300 } // 5 minute cache
    );
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/test-short-ttl', async (req, res) => {
  const cacheKey = 'test-ttl';
  const resource = 'test-api';
  
  try {
    const data = await cacheManager.getOrFetch(
      cacheKey,
      resource,
      async () => {
        // Call external API
        const url = 'https://api.hrvstr.com/api/test-ttl';
        const response = await fetch(url);
        if (!response.ok) throw new Error('Test API error');
        return await response.json();
      },
      { ttl: 10 } // 10 second TTL
    );
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mock dates for consistent testing
const originalDateNow = Date.now;

describe('Proxy Server Caching', () => {
  // Save original fetch
  const originalFetch = global.fetch;
  
  beforeEach(() => {
    // Clear cache before each test
    cacheManager.clear();
    
    // Spy on cache methods
    jest.spyOn(cacheManager, 'get');
    jest.spyOn(cacheManager, 'set');
    jest.spyOn(cacheManager, 'has');
    
    // Mock fetch
    global.fetch = jest.fn();
  });
  
  afterEach(() => {
    // Restore fetch
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    Date.now = originalDateNow;
  });
  
  describe('Reddit API Caching', () => {
    test('should cache Reddit API responses with appropriate TTL', async () => {
      // Mock the Reddit API response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            children: [
              { data: { id: 'post1', title: 'AAPL to the moon', author: 'user1' } },
              { data: { id: 'post2', title: 'TSLA thoughts?', author: 'user2' } }
            ]
          }
        })
      });
      
      // First request should hit the API and cache the result
      const response1 = await request(app)
        .get('/api/reddit/subreddit/wallstreetbets')
        .set('Accept', 'application/json');
      
      expect(response1.status).toBe(200);
      expect(response1.body).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(cacheManager.set).toHaveBeenCalled();
      
      // Clear fetch mock count
      global.fetch.mockClear();
      
      // Second request should use cached data
      const response2 = await request(app)
        .get('/api/reddit/subreddit/wallstreetbets')
        .set('Accept', 'application/json');
      
      expect(response2.status).toBe(200);
      expect(response2.body).toHaveLength(2);
      expect(global.fetch).not.toHaveBeenCalled(); // API should not be called
      expect(cacheManager.get).toHaveBeenCalled();
    });
    
    test('should respect cache-busting query parameters', async () => {
      // Mock the Reddit API response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            children: [
              { data: { id: 'post1', title: 'AAPL to the moon', author: 'user1' } }
            ]
          }
        })
      });
      
      // First request to populate cache
      await request(app)
        .get('/api/reddit/subreddit/wallstreetbets')
        .set('Accept', 'application/json');
      
      // Fetch should be called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // Clear mock counts
      global.fetch.mockClear();
      
      // Second request with cache-busting parameter should bypass cache
      const response = await request(app)
        .get('/api/reddit/subreddit/wallstreetbets?_freshData=true')
        .set('Accept', 'application/json');
      
      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(1); // API should be called again
    });
  });
  
  describe('SEC API Caching', () => {
    test('should cache SEC filings with longer TTL than other endpoints', async () => {
      // Mock date.now for consistent testing
      const mockTime = 1000000;
      Date.now = jest.fn().mockReturnValue(mockTime);
      
      // Mock the SEC API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => '<xml>Mock SEC Filing Data</xml>'
      });
      
      // First request should hit the API and cache the result
      const response1 = await request(app)
        .get('/api/sec/filing/123456')
        .set('Accept', 'application/json');
      
      expect(response1.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // Clear fetch call history
      global.fetch.mockClear();
      
      // Move time forward 1 hour
      const newTime = mockTime + (60 * 60 * 1000);
      Date.now = jest.fn().mockReturnValue(newTime);
      
      // Second request (1 hour later) should still use cache for SEC filings
      const response2 = await request(app)
        .get('/api/sec/filing/123456')
        .set('Accept', 'application/json');
      
      expect(response2.status).toBe(200);
      expect(global.fetch).not.toHaveBeenCalled(); // Should not call API again
      expect(cacheManager.get).toHaveBeenCalled();
    });
  });
  
  describe('Sentiment Analysis Caching', () => {
    test('should cache sentiment data with medium TTL', async () => {
      // Mock the sentiment analysis API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ticker: 'AAPL',
          score: 0.75,
          sentiment: 'bullish',
          source: 'combined'
        })
      });
      
      // First request should hit the API and cache the result
      const response1 = await request(app)
        .get('/api/sentiment/stock/AAPL')
        .set('Accept', 'application/json');
      
      expect(response1.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // Clear fetch mock count
      global.fetch.mockClear();
      
      // Second request should use cached data
      const response2 = await request(app)
        .get('/api/sentiment/stock/AAPL')
        .set('Accept', 'application/json');
      
      expect(response2.status).toBe(200);
      expect(global.fetch).not.toHaveBeenCalled(); // Should not call API again
      expect(cacheManager.get).toHaveBeenCalled();
    });
  });
  
  describe('Earnings API Caching', () => {
    test('should cache earnings data with appropriate TTL', async () => {
      // Create a test route for earnings data
      app.get('/api/earnings/upcoming', async (req, res) => {
        const cacheKey = 'earnings:upcoming';
        const resource = 'earnings-api';
        
        try {
          const data = await cacheManager.getOrFetch(
            cacheKey,
            resource,
            async () => {
              // Call external Earnings API
              const url = 'https://earnings-api.hrvstr.com/api/earnings/upcoming';
              const response = await fetch(url);
              if (!response.ok) throw new Error('Earnings API error');
              return await response.json();
            },
            { ttl: 3600 } // 1 hour cache
          );
          
          res.json(data);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // Mock the earnings API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          earningsEvents: [
            { ticker: 'AAPL', reportDate: '2025-08-01', estimatedEPS: 1.25 },
            { ticker: 'MSFT', reportDate: '2025-07-28', estimatedEPS: 2.10 }
          ]
        })
      });
      
      // First request should hit the API and cache the result
      const response1 = await request(app)
        .get('/api/earnings/upcoming')
        .set('Accept', 'application/json');
      
      expect(response1.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // Clear fetch mock count
      global.fetch.mockClear();
      
      // Second request should use cached data
      const response2 = await request(app)
        .get('/api/earnings/upcoming')
        .set('Accept', 'application/json');
      
      expect(response2.status).toBe(200);
      expect(response2.body.earningsEvents).toHaveLength(2);
      expect(global.fetch).not.toHaveBeenCalled(); // API should not be called again
      expect(cacheManager.get).toHaveBeenCalled();
    });
  });
  
  describe('API Error Handling with Cache', () => {
    test('should use cached data when external API is down', async () => {
      // Mock successful API for first call
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              { data: { id: 'post1', title: 'AAPL to the moon', author: 'user1' } }
            ]
          }
        })
      });
      
      // First successful request to populate cache
      await request(app)
        .get('/api/reddit/subreddit/wallstreetbets')
        .set('Accept', 'application/json');
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // Mock API failure for second request
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('API Error'));
      
      // Second request should use cached data despite API failure
      const response = await request(app)
        .get('/api/reddit/subreddit/wallstreetbets')
        .set('Accept', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1); // From cache
      
      // Verify cache was checked
      expect(cacheManager.get).toHaveBeenCalled();
    });
    
    test('should return error when API fails and no cache exists', async () => {
      // Mock API failure
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Internal Server Error'));
      
      // Request with no existing cache
      const response = await request(app)
        .get('/api/reddit/subreddit/investing')
        .set('Accept', 'application/json');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('Concurrent Requests', () => {
    test('should handle concurrent requests efficiently', async () => {
      // Track API call count
      let apiCallCount = 0;
      
      // Mock slow API response
      global.fetch = jest.fn().mockImplementation(() => {
        apiCallCount++;
        // Simulate a slow response
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ data: 'test' })
            });
          }, 50); // 50ms delay for faster tests
        });
      });
      
      // Make multiple concurrent requests
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .get('/api/slow-endpoint')
            .set('Accept', 'application/json')
        );
      }
      
      // Wait for all requests
      const responses = await Promise.all(requests);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // But API should only be called once due to request deduplication
      expect(apiCallCount).toBe(1);
    });
  });
  
  describe('Cache Invalidation', () => {
    test('should respect cache TTL settings', async () => {
      // Mock current time
      const mockInitialTime = 1000000;
      Date.now = jest.fn().mockReturnValue(mockInitialTime);
      
      // Mock API responses
      global.fetch = jest.fn().mockImplementationOnce(() => {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: 'test1' })
        });
      });
      
      // First request to populate cache with short TTL (10 seconds)
      await request(app)
        .get('/api/test-short-ttl')
        .set('Accept', 'application/json');
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // Clear fetch mock
      global.fetch.mockClear();
      
      // Advance time past TTL
      const mockLaterTime = mockInitialTime + 11000; // 11 seconds later
      Date.now = jest.fn().mockReturnValue(mockLaterTime);
      
      // Mock API for second request with updated data
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test2' })
      });
      
      // Second request should call API again due to expired cache
      const response = await request(app)
        .get('/api/test-short-ttl')
        .set('Accept', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toBe('test2');
      expect(global.fetch).toHaveBeenCalledTimes(1); // API should be called again
      
      // Verify cache check happened
      expect(cacheManager.has).toHaveBeenCalled();
    });
  });
});
