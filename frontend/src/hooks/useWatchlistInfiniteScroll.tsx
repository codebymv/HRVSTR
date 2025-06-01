import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

interface WatchlistItem {
  id: string;
  symbol: string;
  company_name: string;
  last_price: string | number | null;
  price_change: string | number | null;
}

interface LoadingState {
  watchlist: boolean;
}

interface UseWatchlistInfiniteScrollReturn {
  // Data
  watchlist: WatchlistItem[];
  cachedWatchlist: WatchlistItem[];
  
  // Pagination
  hasMore: boolean;
  page: number;
  
  // Loading states
  loading: LoadingState;
  loadingProgress: number;
  loadingStage: string;
  error: string | null;
  
  // Actions
  handleLoadMore: () => void;
  fetchWatchlist: (forceRefresh?: boolean) => Promise<void>;
  updateLoadingState: (updates: Partial<LoadingState>) => void;
  
  // Cache management
  resetPagination: () => void;
}

export const useWatchlistInfiniteScroll = (): UseWatchlistInfiniteScrollReturn => {
  const { user } = useAuth();
  
  // Constants - Following our documentation pattern
  const ITEMS_PER_PAGE = 10;
  
  // Cache all data (following Cached Infinite Scroll Pattern)
  const [cachedWatchlist, setCachedWatchlist] = useState<WatchlistItem[]>([]);
  
  // Display filtered subset
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Loading states
  const [loading, setLoading] = useState<LoadingState>({ watchlist: false });
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...');
  const [error, setError] = useState<string | null>(null);
  
  // Refs to prevent duplicate calls
  const fetchingWatchlist = useRef(false);
  
  // Cache with timestamps to prevent unnecessary requests
  const dataCache = useRef({
    watchlist: { data: null as WatchlistItem[] | null, timestamp: 0 }
  });
  
  // Cache duration in milliseconds (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000;
  
  // Helper function to check if cached data is still valid
  const isCacheValid = (timestamp: number) => {
    return Date.now() - timestamp < CACHE_DURATION;
  };
  
  // Update loading state helper
  const updateLoadingState = useCallback((updates: Partial<LoadingState>) => {
    setLoading(prev => ({ ...prev, ...updates }));
  }, []);
  
  // Fetch watchlist data from API
  const fetchWatchlist = useCallback(async (forceRefresh = false) => {
    if (!user?.token) {
      setError('User not authenticated');
      updateLoadingState({ watchlist: false });
      return;
    }

    // Check if request is already in progress
    if (fetchingWatchlist.current) {
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh && dataCache.current.watchlist.data && isCacheValid(dataCache.current.watchlist.timestamp)) {
      setCachedWatchlist(dataCache.current.watchlist.data);
      updateLoadingState({ watchlist: false });
      return;
    }

    fetchingWatchlist.current = true;
    updateLoadingState({ watchlist: true });
    setLoadingProgress(0);
    setLoadingStage('Fetching watchlist data...');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      // Simulate progress for better UX
      setLoadingProgress(25);
      setLoadingStage('Connecting to server...');
      
      const response = await axios.get(`${apiUrl}/api/watchlist`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      
      setLoadingProgress(50);
      setLoadingStage('Processing watchlist data...');
      
      // Handle different response structures (defensive programming)
      let watchlistData: WatchlistItem[] = [];
      
      if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data)) {
          watchlistData = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          watchlistData = response.data.data;
        } else if (response.data.data && response.data.data.stocks && Array.isArray(response.data.data.stocks)) {
          watchlistData = response.data.data.stocks;
          // Store tier limits if available
          if (response.data.data.limits) {
            sessionStorage.setItem('watchlist_limits', JSON.stringify(response.data.data.limits));
          }
        } else if (response.data.stocks && Array.isArray(response.data.stocks)) {
          watchlistData = response.data.stocks;
          if (response.data.limits) {
            sessionStorage.setItem('watchlist_limits', JSON.stringify(response.data.limits));
          }
        } else if (response.data.watchlist && Array.isArray(response.data.watchlist)) {
          watchlistData = response.data.watchlist;
        } else {
          console.warn('Unexpected watchlist response structure:', response.data);
          watchlistData = [];
        }
      } else {
        watchlistData = [];
      }
      
      // Ensure it's definitely an array
      if (!Array.isArray(watchlistData)) {
        console.error('Failed to convert watchlist response to array, using empty array');
        watchlistData = [];
      }
      
      setLoadingProgress(75);
      setLoadingStage('Organizing watchlist...');
      
      // Update cache
      dataCache.current.watchlist = {
        data: watchlistData,
        timestamp: Date.now()
      };
      
      setCachedWatchlist(watchlistData);
      setError(null);
      
      setLoadingProgress(100);
      setLoadingStage('Watchlist loaded successfully');
      
    } catch (error: any) {
      console.error('Error fetching watchlist:', error);
      if (error.response?.status === 429) {
        setError('Rate limit exceeded. Data will retry automatically in a moment.');
        // Auto-retry after 3 seconds for rate limit errors
        setTimeout(() => {
          if (user?.token) {
            fetchWatchlist(true);
          }
        }, 3000);
      } else {
        setError('Failed to fetch watchlist');
      }
      setCachedWatchlist([]);
    } finally {
      updateLoadingState({ watchlist: false });
      fetchingWatchlist.current = false;
    }
  }, [user?.token, updateLoadingState]);
  
  // Load more from cached data (Cached Infinite Scroll Pattern)
  const handleLoadMore = useCallback(() => {
    if (!hasMore || loading.watchlist) {
      return;
    }

    updateLoadingState({ watchlist: true });

    try {
      const nextPage = page + 1;
      const startIndex = (nextPage - 1) * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      
      // Get the next page of cached items
      const newItems = cachedWatchlist.slice(startIndex, endIndex);
      
      // Only update if we have new items
      if (newItems.length > 0) {
        setWatchlist(prev => [...prev, ...newItems]);
        setPage(nextPage);
        setHasMore(endIndex < cachedWatchlist.length);
      } else {
        setHasMore(false);
      }
    } finally {
      // Always reset loading state
      updateLoadingState({ watchlist: false });
    }
  }, [page, hasMore, loading.watchlist, cachedWatchlist, updateLoadingState]);
  
  // Reset pagination when cached data changes
  useEffect(() => {
    const firstPageItems = cachedWatchlist.slice(0, ITEMS_PER_PAGE);
    setWatchlist(firstPageItems);
    setPage(1);
    setHasMore(cachedWatchlist.length > ITEMS_PER_PAGE);
  }, [cachedWatchlist]);
  
  // Reset pagination helper
  const resetPagination = useCallback(() => {
    setPage(1);
    setWatchlist([]);
    setHasMore(true);
  }, []);
  
  return {
    // Data
    watchlist,
    cachedWatchlist,
    
    // Pagination
    hasMore,
    page,
    
    // Loading states
    loading,
    loadingProgress,
    loadingStage,
    error,
    
    // Actions
    handleLoadMore,
    fetchWatchlist,
    updateLoadingState,
    
    // Cache management
    resetPagination
  };
}; 