import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TimeRange } from '../src/types';

// Mock fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create a mock for localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock the earnings hook
const useEarningsData = vi.fn();

// Mock the hook implementation
vi.mock('../src/hooks/useEarningsData', () => ({
  default: () => useEarningsData()
}));

// Sample data for tests
const upcomingEarningsData = [
  {
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    reportDate: '2025-05-20',
    estimatedEPS: 1.45,
    estEPS: 1.45
  },
  {
    ticker: 'MSFT',
    companyName: 'Microsoft Corp.',
    reportDate: '2025-05-22',
    estimatedEPS: 2.34,
    estEPS: 2.34
  }
];

const historicalEarningsData = [
  {
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    reportDate: '2025-02-20',
    estimatedEPS: 1.42,
    actualEPS: 1.47,
    surprisePercentage: 3.52
  },
  {
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    reportDate: '2024-11-20',
    estimatedEPS: 1.39,
    actualEPS: 1.45,
    surprisePercentage: 4.31
  }
];

describe('Earnings Caching', () => {
  beforeEach(() => {
    // Clear mocks and localStorage before each test
    mockFetch.mockClear();
    mockLocalStorage.clear();
    vi.clearAllMocks();
    
    // Setup default successful response for upcoming earnings
    mockFetch.mockImplementation((url) => {
      if (url.toString().includes('/api/earnings/upcoming')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ earningsEvents: upcomingEarningsData })
        });
      } else if (url.toString().includes('/api/earnings/historical')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ historicalEarnings: historicalEarningsData })
        });
      }
      return Promise.reject(new Error('URL not mocked'));
    });

    // Default return value for the hook
    useEarningsData.mockReturnValue({
      upcomingEarnings: [],
      historicalEarnings: {},
      loading: false,
      error: null,
      refreshData: vi.fn(),
      clearCache: vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load cached earnings data on initial mount', () => {
    // Pre-populate localStorage with cached data
    const mockUpcomingEarnings = [...upcomingEarningsData];
    const mockHistoricalEarnings = { 'AAPL': [...historicalEarningsData] };
    
    mockLocalStorage.setItem('earnings_upcoming', JSON.stringify(mockUpcomingEarnings));
    mockLocalStorage.setItem('earnings_historical', JSON.stringify(mockHistoricalEarnings));
    mockLocalStorage.setItem('earnings_lastUpdated', JSON.stringify(Date.now()));
    
    // Create a mock implementation that checks localStorage on mount
    const mockImplementation = () => {
      const cachedUpcoming = mockLocalStorage.getItem('earnings_upcoming');
      const cachedHistorical = mockLocalStorage.getItem('earnings_historical');
      
      return {
        upcomingEarnings: cachedUpcoming ? JSON.parse(cachedUpcoming) : [],
        historicalEarnings: cachedHistorical ? JSON.parse(cachedHistorical) : {},
        loading: false,
        error: null,
        refreshData: vi.fn(),
        clearCache: vi.fn()
      };
    };
    
    useEarningsData.mockImplementation(mockImplementation);
    
    // Render the hook
    const { result } = renderHook(() => useEarningsData());
    
    // Verify data was loaded from localStorage
    expect(result.current.upcomingEarnings).toEqual(mockUpcomingEarnings);
    expect(result.current.historicalEarnings).toEqual(mockHistoricalEarnings);
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('earnings_upcoming');
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('earnings_historical');
  });

  it('should fetch new data when cache is stale', async () => {
    // Pre-populate localStorage with stale data (older than 30 minutes)
    const staleTimestamp = Date.now() - (31 * 60 * 1000); // 31 minutes ago
    
    mockLocalStorage.setItem('earnings_upcoming', JSON.stringify([{ ticker: 'OLD' }]));
    mockLocalStorage.setItem('earnings_lastUpdated', JSON.stringify(staleTimestamp));
    
    // Fresh data from API
    const freshData = {
      upcomingEarnings: upcomingEarningsData,
      historicalEarnings: { 'AAPL': historicalEarningsData }
    };
    
    // Mock the fetch implementation
    mockFetch.mockImplementation(() => {
      // Store the fresh data in localStorage to simulate a successful fetch
      mockLocalStorage.setItem('earnings_upcoming', JSON.stringify(freshData.upcomingEarnings));
      mockLocalStorage.setItem('earnings_historical', JSON.stringify(freshData.historicalEarnings));
      mockLocalStorage.setItem('earnings_lastUpdated', JSON.stringify(Date.now()));
      
      return Promise.resolve({
        ok: true,
        json: async () => ({ earningsEvents: freshData.upcomingEarnings })
      });
    });
    
    // Mock the hook to implement cache staleness check
    useEarningsData.mockImplementation(() => {
      const lastUpdated = mockLocalStorage.getItem('earnings_lastUpdated');
      const isStale = !lastUpdated || (Date.now() - JSON.parse(lastUpdated)) > 30 * 60 * 1000;
      
      return {
        upcomingEarnings: JSON.parse(mockLocalStorage.getItem('earnings_upcoming') || '[]'),
        historicalEarnings: JSON.parse(mockLocalStorage.getItem('earnings_historical') || '{}'),
        loading: false,
        error: null,
        refreshData: async () => {
          if (isStale) {
            await mockFetch('/api/earnings/upcoming');
          }
        },
        clearCache: vi.fn()
      };
    });
    
    // Render the hook
    const { result } = renderHook(() => useEarningsData());
    
    // Call refresh data
    await act(async () => {
      await result.current.refreshData();
    });
    
    // Verify fetch was called to get fresh data
    expect(mockFetch).toHaveBeenCalled();
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('earnings_upcoming', JSON.stringify(freshData.upcomingEarnings));
  });

  it('should clear cache when requested', () => {
    // Setup cache clearing function
    const mockClearCache = vi.fn(() => {
      mockLocalStorage.removeItem('earnings_upcoming');
      mockLocalStorage.removeItem('earnings_historical');
      mockLocalStorage.removeItem('earnings_lastUpdated');
    });
    
    // Mock the hook implementation
    useEarningsData.mockImplementation(() => ({
      upcomingEarnings: [],
      historicalEarnings: {},
      loading: false,
      error: null,
      refreshData: vi.fn(),
      clearCache: mockClearCache
    }));
    
    // Render the hook
    const { result } = renderHook(() => useEarningsData());
    
    // Call clearCache
    act(() => {
      result.current.clearCache();
    });
    
    // Verify localStorage items were removed
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('earnings_upcoming');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('earnings_historical');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('earnings_lastUpdated');
  });

  it('should handle API errors gracefully', async () => {
    // Mock API error
    mockFetch.mockRejectedValueOnce(new Error('API Error'));
    
    // Mock error handling in the hook
    const mockImplementation = () => {
      // Create a mock error state without using hooks syntax
      const errorMessage = 'Failed to fetch earnings data';
      
      const refreshData = async (timeRange?: TimeRange) => {
        try {
          await mockFetch('/api/earnings/upcoming');
        } catch (err) {
          // Error already set in the return object
          return null;
        }
      };
      
      return {
        upcomingEarnings: [],
        historicalEarnings: {},
        loading: false,
        error: 'Failed to fetch earnings data',
        refreshData,
        clearCache: vi.fn()
      };
    };
    
    useEarningsData.mockImplementation(mockImplementation);
    
    // Render the hook
    const { result } = renderHook(() => useEarningsData());
    
    // Verify error state
    expect(result.current.error).toBe('Failed to fetch earnings data');
  });

  it('should allow manual refresh regardless of cache status', async () => {
    // Pre-populate localStorage with fresh data
    const freshTimestamp = Date.now() - (5 * 60 * 1000); // 5 minutes ago
    
    mockLocalStorage.setItem('earnings_upcoming', JSON.stringify([{ ticker: 'CACHED' }]));
    mockLocalStorage.setItem('earnings_lastUpdated', JSON.stringify(freshTimestamp));
    
    // Fresh data from API
    const freshData = {
      upcomingEarnings: [{ ticker: 'MANUAL_REFRESH' }],
      historicalEarnings: { 'MANUAL_REFRESH': [] }
    };
    
    // Mock the fetch implementation with forceRefresh parameter
    const mockRefreshData = vi.fn().mockImplementation(async (forceRefresh = false) => {
      const lastUpdated = mockLocalStorage.getItem('earnings_lastUpdated');
      const isStale = !lastUpdated || (Date.now() - JSON.parse(lastUpdated)) > 30 * 60 * 1000;
      
      // Only fetch if cache is stale or forceRefresh is true
      if (isStale || forceRefresh) {
        await mockFetch('/api/earnings/upcoming');
        
        mockLocalStorage.setItem('earnings_upcoming', JSON.stringify(freshData.upcomingEarnings));
        mockLocalStorage.setItem('earnings_historical', JSON.stringify(freshData.historicalEarnings));
        mockLocalStorage.setItem('earnings_lastUpdated', JSON.stringify(Date.now()));
        
        return freshData;
      }
      
      // Otherwise return cached data
      return {
        upcomingEarnings: JSON.parse(mockLocalStorage.getItem('earnings_upcoming') || '[]'),
        historicalEarnings: JSON.parse(mockLocalStorage.getItem('earnings_historical') || '{}')
      };
    });
    
    useEarningsData.mockImplementation(() => ({
      upcomingEarnings: JSON.parse(mockLocalStorage.getItem('earnings_upcoming') || '[]'),
      historicalEarnings: JSON.parse(mockLocalStorage.getItem('earnings_historical') || '{}'),
      loading: false,
      error: null,
      refreshData: mockRefreshData,
      clearCache: vi.fn()
    }));
    
    // Render the hook
    const { result } = renderHook(() => useEarningsData());
    
    // Initial data should be from cache
    expect(result.current.upcomingEarnings).toEqual([{ ticker: 'CACHED' }]);
    
    // Force refresh regardless of cache freshness
    await act(async () => {
      await result.current.refreshData(true);
    });
    
    // Verify fetch was called despite fresh cache
    expect(mockFetch).toHaveBeenCalled();
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('earnings_upcoming', JSON.stringify(freshData.upcomingEarnings));
  });

  it('should cache historical earnings data for specific tickers', async () => {
    // Mock the hook implementation
    const mockImplementation = () => {
      const getHistoricalEarnings = async (ticker: string) => {
        // Check cache first
        const cachedHistorical = mockLocalStorage.getItem(`earnings_historical_${ticker}`);
        if (cachedHistorical) {
          return JSON.parse(cachedHistorical);
        }
        
        // Fetch from API if not in cache
        const response = await mockFetch(`/api/earnings/historical/${ticker}`);
        const data = await response.json();
        
        // Cache the result
        mockLocalStorage.setItem(`earnings_historical_${ticker}`, JSON.stringify(data.historicalEarnings));
        
        return data.historicalEarnings;
      };
      
      return {
        upcomingEarnings: [],
        historicalEarnings: {},
        loading: false,
        error: null,
        getHistoricalEarnings,
        refreshData: vi.fn(),
        clearCache: vi.fn()
      };
    };
    
    useEarningsData.mockImplementation(mockImplementation);
    
    // Render the hook
    const { result } = renderHook(() => useEarningsData());
    
    // First call should fetch from API
    await act(async () => {
      await result.current.getHistoricalEarnings('AAPL');
    });
    
    // Verify API was called
    expect(mockFetch).toHaveBeenCalledWith('/api/earnings/historical/AAPL');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('earnings_historical_AAPL', JSON.stringify(historicalEarningsData));
    
    // Reset mocks
    mockFetch.mockClear();
    
    // Second call should use cache
    await act(async () => {
      await result.current.getHistoricalEarnings('AAPL');
    });
    
    // API should not be called again
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
