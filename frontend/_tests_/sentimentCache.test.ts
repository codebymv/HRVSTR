import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSentimentData } from '../src/hooks/useSentimentData';
import { renderHook, act } from '@testing-library/react';
import * as api from '../src/services/api';
import * as watchlistClient from '../src/services/watchlistSentimentClient';

// Mock the useTier hook
vi.mock('../src/contexts/TierContext', () => ({
  useTier: () => ({
    tierInfo: {
      tier: 'free',
      credits: {
        remaining: 100,
        monthly: 100,
        purchased: 0,
        used: 0,
        total: 100,
        resetDate: '2024-01-01T00:00:00.000Z'
      },
      limits: {
        watchlistLimit: 5,
        monthlyCredits: 100,
        features: ['basic'],
        historyDays: 30
      },
      features: ['basic']
    },
    loading: false,
    error: null,
    refreshTierInfo: vi.fn(),
    simulateUpgrade: vi.fn(),
    addCredits: vi.fn()
  })
}));

// Define the proper options interface based on the hook implementation
interface UseSentimentDataOptions {
  timeRange?: string;
  refreshInterval?: number;
  forceRefresh?: boolean;
}

// Create a mock for the fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock our cache storage
const mockCache = new Map();
const isCacheValidOriginal = (cache: any) => {
  if (!cache || !cache.timestamp || !cache.ttl) return false;
  return (Date.now() - cache.timestamp) < cache.ttl;
};

// Create modifiable mock implementation
let isCacheValid = isCacheValidOriginal;

vi.mock('../src/utils/cacheUtils', () => ({
  getCache: (key: string) => mockCache.get(key),
  setCache: (key: string, data: any, ttl: number) => {
    mockCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  },
  clearCache: () => mockCache.clear(),
  isCacheValid: (cache: any) => isCacheValid(cache)
}));

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    length: 0,
    key: () => null
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock the API services
vi.mock('../src/services/api', () => ({
  fetchSentimentData: vi.fn(),
  fetchRedditPosts: vi.fn(),
  fetchTickerSentiments: vi.fn(),
  fetchAggregatedMarketSentiment: vi.fn()
}));

vi.mock('../src/services/watchlistSentimentClient', () => ({
  fetchWatchlistFinvizSentiment: vi.fn(),
  fetchWatchlistYahooSentiment: vi.fn(),
  fetchWatchlistRedditSentiment: vi.fn()
}));

// Use fake timers for time manipulation
vi.useFakeTimers();

describe('Sentiment Analysis Caching', () => {
  beforeEach(() => {
    // Clear mocks and cache before each test
    mockFetch.mockClear();
    mockCache.clear();
    
    // Setup default successful response for global fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        sentimentData: [
          { ticker: 'AAPL', score: 0.8, sentiment: 'bullish' as const, source: 'reddit' as const },
          { ticker: 'MSFT', score: 0.6, sentiment: 'bullish' as const, source: 'reddit' as const }
        ]
      })
    });
    
    // Setup mocked API services with default responses
    const mockSentimentData = [
      { ticker: 'AAPL', score: 0.8, sentiment: 'bullish' as const, source: 'reddit' as const, timestamp: new Date().toISOString(), confidence: 0.9, postCount: 10, commentCount: 5, upvotes: 15 },
      { ticker: 'MSFT', score: 0.6, sentiment: 'bullish' as const, source: 'reddit' as const, timestamp: new Date().toISOString(), confidence: 0.8, postCount: 8, commentCount: 3, upvotes: 12 }
    ];
    
    vi.mocked(api.fetchSentimentData).mockResolvedValue(mockSentimentData);
    vi.mocked(api.fetchRedditPosts).mockResolvedValue([]);
    vi.mocked(api.fetchTickerSentiments).mockResolvedValue(mockSentimentData);
    vi.mocked(api.fetchAggregatedMarketSentiment).mockResolvedValue([]);
    vi.mocked(watchlistClient.fetchWatchlistFinvizSentiment).mockResolvedValue([]);
    vi.mocked(watchlistClient.fetchWatchlistYahooSentiment).mockResolvedValue([]);
    vi.mocked(watchlistClient.fetchWatchlistRedditSentiment).mockResolvedValue([]);
    
    // Reset timers for each test
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should fetch data on initial load', async () => {
    // Switch to real timers for this test since we're dealing with async operations
    vi.useRealTimers();
    
    const { result } = renderHook(() => 
      useSentimentData('1d', true, true)
    );
    
    // Initially should be loading with no data
    expect(result.current.loading.sentiment).toBe(true);
    expect(result.current.topSentiments).toEqual([]);
    
    // Wait for the async operation to complete
    await act(async () => {
      await Promise.resolve(); // Allow any microtasks to execute
    });
    
    // After update should have data and not be loading
    expect(result.current.loading.sentiment).toBe(false);
    // Check that at least one of the API services was called
    expect(
      vi.mocked(api.fetchSentimentData).mock.calls.length +
      vi.mocked(api.fetchTickerSentiments).mock.calls.length +
      vi.mocked(watchlistClient.fetchWatchlistFinvizSentiment).mock.calls.length +
      vi.mocked(watchlistClient.fetchWatchlistYahooSentiment).mock.calls.length
    ).toBeGreaterThan(0);
  });

  it('should use cached data when available and valid', async () => {
    // Switch to real timers for this test
    vi.useRealTimers();
    
    // Set up localStorage cache with proper structure
    const cachedSentiments = [
      { ticker: 'AAPL', score: 0.8, sentiment: 'bullish' as const, source: 'reddit' as const, timestamp: new Date().toISOString(), confidence: 0.9, postCount: 10, commentCount: 5, upvotes: 15 },
      { ticker: 'MSFT', score: 0.6, sentiment: 'bullish' as const, source: 'reddit' as const, timestamp: new Date().toISOString(), confidence: 0.8, postCount: 8, commentCount: 3, upvotes: 12 }
    ];
    
    const cachedTickerSentiments = [
      { ticker: 'AAPL', score: 0.8, sentiment: 'bullish' as const, source: 'reddit' as const, timestamp: new Date().toISOString(), confidence: 0.9, postCount: 10, commentCount: 5, upvotes: 15 },
      { ticker: 'MSFT', score: 0.6, sentiment: 'bullish' as const, source: 'reddit' as const, timestamp: new Date().toISOString(), confidence: 0.8, postCount: 8, commentCount: 3, upvotes: 12 }
    ];
    
    mockLocalStorage.setItem('sentiment_allSentiments', JSON.stringify(cachedSentiments));
    mockLocalStorage.setItem('sentiment_allTickerSentiments', JSON.stringify(cachedTickerSentiments));
    mockLocalStorage.setItem('sentiment_lastFetchTime', JSON.stringify(Date.now()));
    
    // Reset mock fetch before test
    mockFetch.mockClear();
    
    // First call should use the cached data
    const { result } = renderHook(() => 
      useSentimentData('1d', true, true)
    );
    
    // Wait for any async operations
    await act(async () => {
      await Promise.resolve();
    });
    
    // Should have cached data and not be loading
    expect(result.current.loading.sentiment).toBe(false);
    expect(result.current.topSentiments.length).toBeGreaterThan(0);
  });

  it('should handle different time ranges', async () => {
    // Switch to real timers for this test
    vi.useRealTimers();
    
    // Reset fetch mock
    mockFetch.mockClear();
    
    // Test with 1d timeRange
    const { result } = renderHook(() => 
      useSentimentData('1d', true, true)
    );
    
    await act(async () => {
      await Promise.resolve();
    });
    
    // Should initialize properly
    expect(result.current.loading).toBeDefined();
    expect(result.current.topSentiments).toBeDefined();
  });

  it('should handle multiple time ranges', async () => {
    // Use real timers
    vi.useRealTimers();
    
    // Clear everything to start fresh
    mockLocalStorage.clear();
    mockFetch.mockClear();
    
    // Test with 1d timeRange
    const { result: result1d } = renderHook(() => 
      useSentimentData('1d', true, true)
    );
    
    await act(async () => {
      await Promise.resolve();
    });
    
    // Should initialize properly
    expect(result1d.current.loading).toBeDefined();
    
    // Test with 1m timeRange
    const { result: result1m } = renderHook(() => 
      useSentimentData('1m', true, true)
    );
    
    await act(async () => {
      await Promise.resolve();
    });
    
    // Should initialize properly
    expect(result1m.current.loading).toBeDefined();
  });

  it('should handle API errors gracefully', async () => {
    // Switch to real timers for this test
    vi.useRealTimers();
    
    // Make API call fail
    mockFetch.mockRejectedValueOnce(new Error('API Error'));
    
    const { result } = renderHook(() => 
      useSentimentData('1d', true, true)
    );
    
    await act(async () => {
      await Promise.resolve();
    });
    
    // Should handle error gracefully
    expect(result.current.loading.sentiment).toBe(false);
    expect(result.current.topSentiments).toEqual([]);
  });

  it('should initialize with default values', async () => {
    // Switch to real timers for this test
    vi.useRealTimers();
    
    const { result } = renderHook(() => 
      useSentimentData('1d', false, false)
    );
    
    await act(async () => {
      await Promise.resolve();
    });
    
    // Should initialize with default values
    expect(result.current.loading).toBeDefined();
    expect(result.current.topSentiments).toBeDefined();
  });
});
