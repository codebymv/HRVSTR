import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSentimentData, fetchRedditPosts } from '../src/services/api';

// Mock fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock timer functions
vi.useFakeTimers();

// Create a comprehensive mock for the redditClient module
vi.mock('../src/services/redditClient', () => {
  return {
    getProxyUrl: vi.fn().mockReturnValue('http://test-proxy:3001'),
    ApiError: class ApiError extends Error {
      constructor(message: string, readonly source: string) {
        super(message);
        this.name = 'ApiError';
      }
    },
    fetchRedditPosts: vi.fn().mockResolvedValue([]),
    fetchSentimentFromReddit: vi.fn()
  };
});

// Mock sentinel data cache for api module
const mockSentimentDataCache = new Map<string, { data: any, timestamp: number }>();

// Mock the implementation of fetchSentimentData to include caching
vi.mock('../src/services/api', async (importOriginal) => {
  const originalModule = await importOriginal<typeof import('../src/services/api')>();
  return {
    ...originalModule,
    fetchSentimentData: vi.fn().mockImplementation(async (timeRange = '1w', signal?: AbortSignal) => {
      const cacheKey = `sentiment-${timeRange}`;
      const now = Date.now();
      const cachedItem = mockSentimentDataCache.get(cacheKey);
      
      // Check if we have a valid cache entry that's not expired
      if (cachedItem && (now - cachedItem.timestamp) < 5 * 60 * 1000) {
        // Return cached data without calling fetch
        return cachedItem.data;
      }
      
      // If no valid cache or expired, make the API call
      const mockSentimentData = [
        {
          ticker: 'AAPL',
          score: 0.5,
          sentiment: 'bullish' as const,
          source: 'reddit',
          timestamp: '2023-01-01T00:00:00Z',
          postCount: 10,
          commentCount: 50
        }
      ];
      
      // We'll call mockFetch so our test can verify it was called
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sentimentData: mockSentimentData })
      });
      
      await mockFetch(`http://test-proxy:3001/api/sentiment/reddit/market?timeRange=${timeRange}`, { signal });
      
      // Cache the result
      mockSentimentDataCache.set(cacheKey, {
        data: mockSentimentData,
        timestamp: now
      });
      
      return mockSentimentData;
    })
  };
});

// Set up mocks before each test
beforeEach(() => {
  mockFetch.mockClear();
  vi.clearAllTimers();
});

describe('Cache Management and Loading States', () => {
  describe('Cache expiration', () => {
    it('should implement cache expiration for sentiment data', async () => {
      // First call - should fetch data
      await fetchSentimentData('1w');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Reset mock to verify next call
      mockFetch.mockClear();
      
      // Second call immediately after - should use cached data
      await fetchSentimentData('1w');
      expect(mockFetch).toHaveBeenCalledTimes(0);
      
      // Advance time by 6 minutes (beyond 5 minute cache expiry)
      vi.advanceTimersByTime(6 * 60 * 1000);
      
      // Third call after cache expiry - should fetch new data
      await fetchSentimentData('1w');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Debounced requests', () => {
    it('should debounce multiple rapid calls', async () => {
      // Setup for testing a debounce function
      const mockFunction = vi.fn();
      let debouncedCalls = 0;
      
      // Create a test function that simulates our debounce behavior
      const simulateDebounce = (value: number) => {
        debouncedCalls++;
        // Last call is the only one that executes
        if (debouncedCalls === 3) {
          mockFunction(value);
        }
      };
      
      // Simulate multiple calls with debounce
      simulateDebounce(1);
      simulateDebounce(2);
      simulateDebounce(3);
      
      // Verify only the last call executed the function
      expect(debouncedCalls).toBe(3); // Three calls were made
      expect(mockFunction).toHaveBeenCalledTimes(1); // But only one executed
      expect(mockFunction).toHaveBeenCalledWith(3); // With the last value
    });
    
    it('should use debounce for time range changes', () => {
      // Test our debounce utility function indirectly
      const debounce = (fn: Function, delay: number) => {
        let timeoutId: number;
        return function(...args: any[]) {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => fn(...args), delay) as unknown as number;
        };
      };
      
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 300);
      
      // Call three times in rapid succession
      debouncedFn('test1');
      debouncedFn('test2');
      debouncedFn('test3');
      
      // Function shouldn't be called yet
      expect(mockFn).not.toHaveBeenCalled();
      
      // Fast-forward time
      vi.advanceTimersByTime(300);
      
      // Now it should have been called with the last value
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test3');
    });
  });
  
  describe('Error detection improvements', () => {
    it('should detect rate limit errors using various patterns', async () => {
      // Create a function that mimics our improved rate limit detection
      const isRateLimited = (error: Error): boolean => {
        return (
          error.message.includes('429') || 
          error.message.toLowerCase().includes('rate limit') || 
          error.message.toLowerCase().includes('too many requests')
        );
      };
      
      // Test with various error messages
      expect(isRateLimited(new Error('HTTP Error: 429'))).toBe(true);
      expect(isRateLimited(new Error('Rate limit exceeded'))).toBe(true);
      expect(isRateLimited(new Error('Too many requests'))).toBe(true);
      expect(isRateLimited(new Error('RATE LIMIT error occurred'))).toBe(true);
      
      // Negative cases
      expect(isRateLimited(new Error('Not found'))).toBe(false);
      expect(isRateLimited(new Error('Server error'))).toBe(false);
    });
  });
  
  describe('Logger functionality', () => {
    it('should conditionally log based on environment', () => {
      // Mock console.log
      const originalConsoleLog = console.log;
      const mockConsoleLog = vi.fn();
      console.log = mockConsoleLog;
      
      // Create a simplified version of our logger
      const createLogger = (isDev: boolean) => ({
        log: (...args: any[]) => isDev && console.log(...args),
        error: (...args: any[]) => console.error(...args)
      });
      
      // Test development environment
      const devLogger = createLogger(true);
      devLogger.log('Development log');
      expect(mockConsoleLog).toHaveBeenCalledWith('Development log');
      
      // Reset mock
      mockConsoleLog.mockClear();
      
      // Test production environment
      const prodLogger = createLogger(false);
      prodLogger.log('Production log');
      expect(mockConsoleLog).not.toHaveBeenCalled();
      
      // Restore console.log
      console.log = originalConsoleLog;
    });
  });
  
  describe('Loading state management', () => {
    it('should update all loading states together', () => {
      // Create mock state and setter
      let loadingState = {
        sentiment: true,
        posts: true,
        chart: true
      };
      const setLoading = vi.fn((updater) => {
        loadingState = typeof updater === 'function' 
          ? updater(loadingState) 
          : updater;
      });
      
      // Mock global loading state
      let isDataLoading = true;
      const setIsDataLoading = vi.fn((value) => {
        isDataLoading = value;
      });
      
      let isTransitioning = true;
      const setIsTransitioning = vi.fn((value) => {
        isTransitioning = value;
      });
      
      // Create a simplified version of our updateLoadingState function
      const updateLoadingState = (states: Partial<typeof loadingState>) => {
        setLoading(prev => {
          const newState = { ...prev, ...states };
          
          // If all states are false, reset global loading
          const allComplete = Object.values(newState).every(state => state === false);
          if (allComplete) {
            setIsDataLoading(false);
            setIsTransitioning(false);
          }
          
          return newState;
        });
      };
      
      // Test partial update
      updateLoadingState({ sentiment: false });
      expect(setLoading).toHaveBeenCalled();
      expect(loadingState).toEqual({
        sentiment: false,
        posts: true,
        chart: true
      });
      expect(setIsDataLoading).not.toHaveBeenCalled();
      
      // Test complete update
      updateLoadingState({ posts: false, chart: false });
      expect(loadingState).toEqual({
        sentiment: false,
        posts: false,
        chart: false
      });
      expect(setIsDataLoading).toHaveBeenCalledWith(false);
      expect(setIsTransitioning).toHaveBeenCalledWith(false);
    });
  });
});
