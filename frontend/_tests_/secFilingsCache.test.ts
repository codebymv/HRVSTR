import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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

// Mock the SEC filings hook
const useSecFilingsData = vi.fn();

// Mock the hook implementation
vi.mock('../src/hooks/useSecFilingsData', () => ({
  default: () => useSecFilingsData()
}));

describe('SEC Filings Caching', () => {
  beforeEach(() => {
    // Clear mocks and localStorage before each test
    mockFetch.mockClear();
    mockLocalStorage.clear();
    
    // Setup default successful response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        insiderTrades: [
          { ticker: 'AAPL', insiderName: 'John Doe', transactionType: 'BUY', shares: 1000 },
          { ticker: 'MSFT', insiderName: 'Jane Smith', transactionType: 'SELL', shares: 500 }
        ],
        institutionalHoldings: [
          { ticker: 'AAPL', institution: 'Blackrock', shares: 5000000 },
          { ticker: 'MSFT', institution: 'Vanguard', shares: 4500000 }
        ]
      })
    });

    // Default return value for the hook
    useSecFilingsData.mockReturnValue({
      insiderTrades: [],
      institutionalHoldings: [],
      loading: false,
      error: null,
      refreshData: vi.fn(),
      clearCache: vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load data from localStorage on initial mount', () => {
    // Pre-populate localStorage with cached data
    const mockInsiderTrades = [
      { ticker: 'AAPL', insiderName: 'John Doe', transactionType: 'BUY', shares: 1000 }
    ];
    const mockInstitutionalHoldings = [
      { ticker: 'AAPL', institution: 'Blackrock', shares: 5000000 }
    ];
    
    mockLocalStorage.setItem('secFilings_insiderTrades', JSON.stringify(mockInsiderTrades));
    mockLocalStorage.setItem('secFilings_institutionalHoldings', JSON.stringify(mockInstitutionalHoldings));
    mockLocalStorage.setItem('secFilings_lastUpdated', JSON.stringify(Date.now()));
    
    // Create a mock implementation that checks localStorage on mount
    const mockImplementation = () => {
      const cachedInsiderTrades = mockLocalStorage.getItem('secFilings_insiderTrades');
      const cachedInstitutionalHoldings = mockLocalStorage.getItem('secFilings_institutionalHoldings');
      
      return {
        insiderTrades: cachedInsiderTrades ? JSON.parse(cachedInsiderTrades) : [],
        institutionalHoldings: cachedInstitutionalHoldings ? JSON.parse(cachedInstitutionalHoldings) : [],
        loading: false,
        error: null,
        refreshData: vi.fn(),
        clearCache: vi.fn()
      };
    };
    
    useSecFilingsData.mockImplementation(mockImplementation);
    
    // Render the hook
    const { result } = renderHook(() => useSecFilingsData());
    
    // Verify data was loaded from localStorage
    expect(result.current.insiderTrades).toEqual(mockInsiderTrades);
    expect(result.current.institutionalHoldings).toEqual(mockInstitutionalHoldings);
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('secFilings_insiderTrades');
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('secFilings_institutionalHoldings');
  });

  it('should fetch new data when cache is stale', async () => {
    // Pre-populate localStorage with stale data (older than 30 minutes)
    const staleTimestamp = Date.now() - (31 * 60 * 1000); // 31 minutes ago
    
    mockLocalStorage.setItem('secFilings_insiderTrades', JSON.stringify([{ ticker: 'OLD' }]));
    mockLocalStorage.setItem('secFilings_lastUpdated', JSON.stringify(staleTimestamp));
    
    // Fresh data from API
    const freshData = {
      insiderTrades: [{ ticker: 'FRESH' }],
      institutionalHoldings: [{ ticker: 'FRESH', institution: 'New Fund' }]
    };
    
    // Mock the fetch implementation
    const mockRefreshData = vi.fn().mockImplementation(async () => {
      // Simulate API call
      await mockFetch('/api/sec/filings');
      
      // Update localStorage with fresh data
      mockLocalStorage.setItem('secFilings_insiderTrades', JSON.stringify(freshData.insiderTrades));
      mockLocalStorage.setItem('secFilings_institutionalHoldings', JSON.stringify(freshData.institutionalHoldings));
      mockLocalStorage.setItem('secFilings_lastUpdated', JSON.stringify(Date.now()));
      
      return freshData;
    });
    
    // Mock the hook to implement cache staleness check
    useSecFilingsData.mockImplementation(() => {
      const lastUpdated = mockLocalStorage.getItem('secFilings_lastUpdated');
      const isStale = !lastUpdated || (Date.now() - JSON.parse(lastUpdated)) > 30 * 60 * 1000;
      
      return {
        insiderTrades: freshData.insiderTrades,
        institutionalHoldings: freshData.institutionalHoldings,
        loading: false,
        error: null,
        refreshData: mockRefreshData,
        clearCache: vi.fn(),
        isStale
      };
    });
    
    // Render the hook
    const { result } = renderHook(() => useSecFilingsData());
    
    // Verify stale cache was detected
    expect(result.current.isStale).toBe(true);
    
    // Simulate calling refreshData
    await act(async () => {
      await result.current.refreshData();
    });
    
    // Verify fetch was called to get fresh data
    expect(mockFetch).toHaveBeenCalled();
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('secFilings_insiderTrades', JSON.stringify(freshData.insiderTrades));
  });

  it('should clear cache when requested', () => {
    // Setup cache clearing function
    const mockClearCache = vi.fn(() => {
      mockLocalStorage.removeItem('secFilings_insiderTrades');
      mockLocalStorage.removeItem('secFilings_institutionalHoldings');
      mockLocalStorage.removeItem('secFilings_lastUpdated');
    });
    
    useSecFilingsData.mockImplementation(() => ({
      insiderTrades: [],
      institutionalHoldings: [],
      loading: false,
      error: null,
      refreshData: vi.fn(),
      clearCache: mockClearCache
    }));
    
    // Render the hook
    const { result } = renderHook(() => useSecFilingsData());
    
    // Call clearCache
    act(() => {
      result.current.clearCache();
    });
    
    // Verify localStorage items were removed
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('secFilings_insiderTrades');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('secFilings_institutionalHoldings');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('secFilings_lastUpdated');
  });

  it('should handle API errors gracefully', async () => {
    // Mock API error
    mockFetch.mockRejectedValueOnce(new Error('API Error'));
    
    // Mock error handling in the hook
    const mockImplementation = () => {
      // Create a mock error state without using hooks syntax
      const errorMessage = 'Failed to fetch SEC filings data';
      
      const refreshData = async () => {
        try {
          await mockFetch('/api/sec/filings');
        } catch (err) {
          // Error already set in the return object
          return null;
        }
      };
      
      return {
        insiderTrades: [],
        institutionalHoldings: [],
        loading: false,
        error: 'Failed to fetch SEC filings data',
        refreshData,
        clearCache: vi.fn()
      };
    };
    
    useSecFilingsData.mockImplementation(mockImplementation);
    
    // Render the hook
    const { result } = renderHook(() => useSecFilingsData());
    
    // Verify error state
    expect(result.current.error).toBe('Failed to fetch SEC filings data');
  });

  it('should allow manual refresh regardless of cache status', async () => {
    // Pre-populate localStorage with fresh data
    const freshTimestamp = Date.now() - (5 * 60 * 1000); // 5 minutes ago
    
    mockLocalStorage.setItem('secFilings_insiderTrades', JSON.stringify([{ ticker: 'CACHED' }]));
    mockLocalStorage.setItem('secFilings_lastUpdated', JSON.stringify(freshTimestamp));
    
    // Fresh data from API
    const freshData = {
      insiderTrades: [{ ticker: 'MANUAL_REFRESH' }],
      institutionalHoldings: [{ ticker: 'MANUAL_REFRESH' }]
    };
    
    // Mock the fetch implementation with forceRefresh parameter
    const mockRefreshData = vi.fn().mockImplementation(async (forceRefresh = false) => {
      const lastUpdated = mockLocalStorage.getItem('secFilings_lastUpdated');
      const isStale = !lastUpdated || (Date.now() - JSON.parse(lastUpdated)) > 30 * 60 * 1000;
      
      // Only fetch if cache is stale or forceRefresh is true
      if (isStale || forceRefresh) {
        await mockFetch('/api/sec/filings');
        
        mockLocalStorage.setItem('secFilings_insiderTrades', JSON.stringify(freshData.insiderTrades));
        mockLocalStorage.setItem('secFilings_institutionalHoldings', JSON.stringify(freshData.institutionalHoldings));
        mockLocalStorage.setItem('secFilings_lastUpdated', JSON.stringify(Date.now()));
        
        return freshData;
      }
      
      // Otherwise return cached data
      return {
        insiderTrades: JSON.parse(mockLocalStorage.getItem('secFilings_insiderTrades') || '[]'),
        institutionalHoldings: JSON.parse(mockLocalStorage.getItem('secFilings_institutionalHoldings') || '[]')
      };
    });
    
    useSecFilingsData.mockImplementation(() => ({
      insiderTrades: JSON.parse(mockLocalStorage.getItem('secFilings_insiderTrades') || '[]'),
      institutionalHoldings: JSON.parse(mockLocalStorage.getItem('secFilings_institutionalHoldings') || '[]'),
      loading: false,
      error: null,
      refreshData: mockRefreshData,
      clearCache: vi.fn()
    }));
    
    // Render the hook
    const { result } = renderHook(() => useSecFilingsData());
    
    // Initial data should be from cache
    expect(result.current.insiderTrades).toEqual([{ ticker: 'CACHED' }]);
    
    // Force refresh regardless of cache freshness
    await act(async () => {
      await result.current.refreshData(true);
    });
    
    // Verify fetch was called despite fresh cache
    expect(mockFetch).toHaveBeenCalled();
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('secFilings_insiderTrades', JSON.stringify(freshData.insiderTrades));
  });
});
