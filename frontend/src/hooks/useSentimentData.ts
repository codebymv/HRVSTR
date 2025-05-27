import { useState, useEffect, useCallback } from 'react';
import { SentimentData } from '../types';

interface SentimentResponse {
  sentimentData: SentimentData[];
  timestamp?: string;
}

interface UseSentimentDataOptions {
  timeRange?: string;
  refreshInterval?: number;
  forceRefresh?: boolean;
}

interface CacheEntry {
  data: SentimentResponse;
  timestamp: number;
  expiresAt: number;
}

// In-memory cache for client-side
const cache = new Map<string, CacheEntry>();

/**
 * Hook for fetching and caching sentiment data
 * Coordinates with backend caching to avoid unnecessary reloads
 */
export function useSentimentData(
  endpoint: string,
  options: UseSentimentDataOptions = {}
) {
  const { 
    timeRange = '1w', 
    refreshInterval = 0, // 0 means no auto-refresh
    forceRefresh = false 
  } = options;
  
  const [data, setData] = useState<SentimentResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Create a cache key based on endpoint and parameters
  const cacheKey = `${endpoint}:${timeRange}`;
  
  // Function to check if cache is valid
  const isCacheValid = useCallback((entry: CacheEntry | undefined): boolean => {
    if (!entry) return false;
    return Date.now() < entry.expiresAt;
  }, []);
  
  // Function to fetch data
  const fetchData = useCallback(async (skipCache: boolean = false) => {
    // Check cache first if not skipping
    if (!skipCache) {
      const cachedData = cache.get(cacheKey);
      if (cachedData && isCacheValid(cachedData)) {
        setData(cachedData.data);
        setLoading(false);
        setError(null);
        setLastUpdated(new Date(cachedData.timestamp));
        setProgress(100);
        return;
      }
    }
    
    // Start loading sequence
    setLoading(true);
    setError(null);
    setProgress(10);
    
    try {
      // Prepare URL with parameters
      const url = new URL(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}${endpoint}`);
      if (timeRange) {
        url.searchParams.append('timeRange', timeRange);
      }
      
      // Add cache-busting parameter if forcing refresh
      if (forceRefresh) {
        url.searchParams.append('_t', Date.now().toString());
      }
      
      setProgress(30);
      
      // Fetch data from API
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': forceRefresh ? 'no-cache' : 'default'
        }
      });
      
      setProgress(70);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      setProgress(90);
      
      // Determine cache TTL based on timeRange
      let cacheTTL = 5 * 60 * 1000; // Default: 5 minutes
      switch (timeRange) {
        case '1d': cacheTTL = 2 * 60 * 1000; break;  // 2 minutes for 1-day data
        case '1w': cacheTTL = 5 * 60 * 1000; break;  // 5 minutes for 1-week data
        case '1m': cacheTTL = 15 * 60 * 1000; break; // 15 minutes for 1-month data
        case '3m': cacheTTL = 30 * 60 * 1000; break; // 30 minutes for 3-month data
      }
      
      // Update cache
      const now = Date.now();
      cache.set(cacheKey, {
        data: result,
        timestamp: now,
        expiresAt: now + cacheTTL
      });
      
      // Update state
      setData(result);
      setLastUpdated(new Date());
      setProgress(100);
      
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      
      // If error and we have cached data, use it as fallback
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        setData(cachedData.data);
        setLastUpdated(new Date(cachedData.timestamp));
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, endpoint, timeRange, forceRefresh, isCacheValid]);
  
  // Function to manually refresh data
  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);
  
  // Initial data fetch
  useEffect(() => {
    fetchData(forceRefresh);
    
    // Set up auto-refresh if interval is provided
    let intervalId: NodeJS.Timeout | undefined;
    if (refreshInterval > 0) {
      intervalId = setInterval(() => {
        fetchData(true);
      }, refreshInterval);
    }
    
    // Clean up
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchData, forceRefresh, refreshInterval]);
  
  // Calculate time until next refresh
  const timeUntilRefresh = useCallback(() => {
    const cachedData = cache.get(cacheKey);
    if (!cachedData) return 0;
    
    const timeRemaining = Math.max(0, cachedData.expiresAt - Date.now());
    return Math.floor(timeRemaining / 1000); // Return seconds
  }, [cacheKey]);
  
  // Return data and control functions
  return {
    data: data?.sentimentData || [],
    loading,
    error,
    progress,
    lastUpdated,
    refresh,
    timeUntilRefresh,
    isStale: lastUpdated ? (Date.now() - lastUpdated.getTime() > 5 * 60 * 1000) : false
  };
}
