import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface ActivityItem {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  symbol: string | null;
  created_at: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalActivities: number;
  hasMore: boolean;
  limit: number;
}

interface UseRecentActivityInfiniteScrollReturn {
  activities: ActivityItem[];
  hasMore: boolean;
  loading: boolean;
  loadingProgress: number;
  loadingStage: string;
  error: string | null;
  handleLoadMore: () => void;
  fetchActivities: (forceRefresh?: boolean, pageOverride?: number) => Promise<void>;
  resetPagination: () => void;
}

export const useRecentActivityInfiniteScroll = (): UseRecentActivityInfiniteScrollReturn => {
  const { user } = useAuth();
  
  // Activity data state
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalActivities, setTotalActivities] = useState(0);
  
  // Refs for managing requests
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef(0);

  // Constants
  const ITEMS_PER_PAGE = 10;
  const THROTTLE_MS = 300;

  // Reset pagination and clear data
  const resetPagination = useCallback(() => {
    setActivities([]);
    setCurrentPage(1);
    setHasMore(true);
    setError(null);
    setTotalActivities(0);
    setLoadingProgress(0);
    setLoadingStage('');
  }, []);

  // Fetch activities with pagination
  const fetchActivities = useCallback(async (forceRefresh = false, pageOverride?: number) => {
    if (!user?.token) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    const pageToFetch = pageOverride || (forceRefresh ? 1 : currentPage);
    
    // Simple race condition prevention using just loading state
    if (isLoadingRef.current) {
      console.log(`🚫 Request already in progress, skipping`);
      return;
    }

    // Reset on force refresh
    if (forceRefresh) {
      resetPagination();
    }
    
    console.log(`🚀 Starting request for page ${pageToFetch}`);
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);
    setLoadingStage('Loading recent activity...');
    setLoadingProgress(10);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      setLoadingProgress(30);
      setLoadingStage('Fetching activity data...');
      
      const response = await axios.get(`${apiUrl}/api/activity`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
          // Add cache control headers to ensure we get fresh data for pagination
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        params: {
          page: pageToFetch,
          limit: ITEMS_PER_PAGE
        }
      });

      setLoadingProgress(60);
      setLoadingStage('Processing activity data...');

      // Handle response structure
      let responseData = response.data;
      let newActivities: ActivityItem[] = [];
      let paginationInfo: PaginationInfo | null = null;

      // Add debug logging
      console.log(`🔍 Activity API Debug - Page ${pageToFetch}:`, {
        status: response.status,
        dataType: typeof responseData,
        isArray: Array.isArray(responseData),
        responseStructure: responseData ? Object.keys(responseData) : 'null'
      });

      // Check if response has pagination structure
      if (responseData && responseData.activities && responseData.pagination) {
        // New paginated response structure
        newActivities = responseData.activities;
        paginationInfo = responseData.pagination;
        
        console.log(`📊 Page ${pageToFetch}: ${newActivities.length} activities, hasMore: ${paginationInfo?.hasMore}`);
      } else if (Array.isArray(responseData)) {
        // Backward compatibility - treat as array of activities
        newActivities = responseData;
        // Determine if there are more pages based on response size
        paginationInfo = {
          currentPage: pageToFetch,
          totalPages: newActivities.length < ITEMS_PER_PAGE ? pageToFetch : pageToFetch + 1,
          totalActivities: newActivities.length + (pageToFetch - 1) * ITEMS_PER_PAGE,
          hasMore: newActivities.length >= ITEMS_PER_PAGE,
          limit: ITEMS_PER_PAGE
        };
      } else {
        // Empty or unexpected response
        console.log('Empty or unexpected response structure:', responseData);
        newActivities = [];
        paginationInfo = {
          currentPage: pageToFetch,
          totalPages: pageToFetch,
          totalActivities: activities.length,
          hasMore: false, // Only set hasMore to false for truly empty responses
          limit: ITEMS_PER_PAGE
        };
      }

      setLoadingProgress(80);
      setLoadingStage('Updating activity list...');

      // Update state based on whether this is initial load or load more
      if (forceRefresh || pageToFetch === 1) {
        setActivities(newActivities);
      } else {
        // Only append if we actually have new activities and avoid duplicates
        if (newActivities.length > 0) {
          setActivities(prev => {
            console.log(`🔄 Current: ${prev.length} activities, attempting to add: ${newActivities.length}`);
            
            // Create a Set of existing activity IDs for fast lookup
            const existingIds = new Set(prev.map(activity => activity.id));
            
            // Filter out activities that already exist
            const uniqueNewActivities = newActivities.filter(activity => !existingIds.has(activity.id));
            
            console.log(`🔄 Unique new activities: ${uniqueNewActivities.length}, duplicates filtered: ${newActivities.length - uniqueNewActivities.length}`);
            
            // If no new unique activities, don't append but don't stop infinite scroll
            // Only stop infinite scroll when backend tells us hasMore is false
            if (uniqueNewActivities.length === 0) {
              console.log('🔄 No new unique activities from this request (likely race condition), but keeping infinite scroll active');
              return prev;
            }
            
            // Return new array with unique activities appended
            return [...prev, ...uniqueNewActivities];
          });
        }
      }

      // Update pagination state
      if (paginationInfo) {
        console.log(`🎯 Updating pagination state:`, {
          oldHasMore: hasMore,
          newHasMore: paginationInfo.hasMore,
          currentPage: paginationInfo.currentPage,
          totalPages: paginationInfo.totalPages,
          totalActivities: paginationInfo.totalActivities
        });
        
        setHasMore(paginationInfo.hasMore);
        setTotalActivities(paginationInfo.totalActivities);
        setCurrentPage(paginationInfo.currentPage);
      }

      setLoadingProgress(100);
      setLoadingStage('Activity loaded successfully');
      
      // Clear loading state after a brief delay
      setTimeout(() => {
        setLoadingStage('');
        setLoadingProgress(0);
      }, 500);

    } catch (error: any) {
      console.error('Error fetching activities:', error);
      
      if (error.response?.status === 429) {
        setError('Rate limit exceeded. Please wait a moment and try again.');
        // Auto-retry after 3 seconds for rate limit errors
        setTimeout(() => {
          if (user?.token) {
            fetchActivities(forceRefresh, pageOverride);
          }
        }, 3000);
      } else {
        setError('Failed to fetch recent activity');
      }
      
      setLoadingStage('');
      setLoadingProgress(0);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
      lastLoadTimeRef.current = Date.now();
    }
  }, [user?.token, currentPage, resetPagination, activities.length]);

  // Handle loading more activities
  const handleLoadMore = useCallback(() => {
    // Don't load if already loading, no more activities, or too soon since last load
    if (isLoadingRef.current || !hasMore || loading) {
      console.log(`🚫 Hook handleLoadMore blocked: loading=${loading}, hasMore=${hasMore}, isLoadingRef=${isLoadingRef.current}, currentPage=${currentPage}`);
      return;
    }

    const now = Date.now();
    if (now - lastLoadTimeRef.current < THROTTLE_MS) {
      console.log(`🚫 Hook throttling: too soon since last request (${now - lastLoadTimeRef.current}ms < ${THROTTLE_MS}ms), currentPage=${currentPage}`);
      return;
    }

    // Calculate next page and fetch directly to avoid race condition
    const nextPage = currentPage + 1;
    console.log(`📖 Hook loading more: current page ${currentPage} → next page ${nextPage}, total activities: ${activities.length}`);
    
    // Update page state and fetch
    setCurrentPage(nextPage);
    fetchActivities(false, nextPage);
  }, [hasMore, loading, currentPage, fetchActivities, activities.length]);

  return {
    activities,
    hasMore,
    loading,
    loadingProgress,
    loadingStage,
    error,
    handleLoadMore,
    fetchActivities,
    resetPagination
  };
}; 