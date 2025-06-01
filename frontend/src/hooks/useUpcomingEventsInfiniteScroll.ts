import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface EventItem {
  id: string;
  symbol: string;
  event_type: string;
  scheduled_at: string;
  status: string;
}

interface UseUpcomingEventsInfiniteScrollReturn {
  events: EventItem[];
  hasMore: boolean;
  loading: boolean;
  loadingProgress: number;
  loadingStage: string;
  error: string | null;
  handleLoadMore: () => void;
  fetchEvents: (forceRefresh?: boolean) => Promise<void>;
  resetPagination: () => void;
}

export const useUpcomingEventsInfiniteScroll = (): UseUpcomingEventsInfiniteScrollReturn => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFetching, setIsFetching] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const ITEMS_PER_PAGE = 20;

  const resetPagination = useCallback(() => {
    setEvents([]);
    setCurrentPage(1);
    setHasMore(true);
    setError(null);
    setLoadingProgress(0);
    setLoadingStage('');
  }, []);

  const fetchEvents = useCallback(async (forceRefresh = false) => {
    if (!user?.token) {
      setError('User not authenticated');
      return;
    }

    if (isFetching) return;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsFetching(true);

    const pageToFetch = forceRefresh ? 1 : currentPage;
    
    if (forceRefresh) {
      setEvents([]);
      setCurrentPage(1);
      setHasMore(true);
      setError(null);
    }

    setLoading(true);
    setLoadingStage('Fetching upcoming events...');
    setLoadingProgress(10);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(
        `${apiUrl}/api/events?page=${pageToFetch}&limit=${ITEMS_PER_PAGE}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          },
          signal: abortControllerRef.current.signal
        }
      );

      setLoadingProgress(50);
      setLoadingStage('Processing events data...');

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setLoadingProgress(80);

      // Handle different response structures
      let eventsData: EventItem[] = [];
      if (Array.isArray(data)) {
        eventsData = data;
      } else if (data.data && Array.isArray(data.data)) {
        eventsData = data.data;
      } else if (data.events && Array.isArray(data.events)) {
        eventsData = data.events;
      } else {
        console.warn('Unexpected events response structure:', data);
        eventsData = [];
      }

      setLoadingProgress(90);
      setLoadingStage('Finalizing...');

      if (forceRefresh || pageToFetch === 1) {
        setEvents(eventsData);
      } else {
        setEvents(prev => {
          // Remove duplicates based on event ID
          const existingIds = new Set(prev.map(event => event.id));
          const newEvents = eventsData.filter(event => !existingIds.has(event.id));
          return [...prev, ...newEvents];
        });
      }

      // Update pagination state
      if (eventsData.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      } else {
        setCurrentPage(prev => forceRefresh ? 2 : prev + 1);
      }

      setLoadingProgress(100);
      setError(null);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Request was cancelled, don't update state
      }
      
      console.error('Error fetching upcoming events:', err);
      setError(err.message || 'Failed to fetch upcoming events');
      
      if (err.message?.includes('Rate limit')) {
        setTimeout(() => {
          if (user?.token) {
            fetchEvents(forceRefresh);
          }
        }, 3000);
      }
    } finally {
      setLoading(false);
      setIsFetching(false);
      setLoadingStage('');
      setLoadingProgress(0);
    }
  }, [user?.token, currentPage, isFetching]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loading || isFetching) return;
    fetchEvents(false);
  }, [hasMore, loading, isFetching, fetchEvents]);

  // Initial fetch
  useEffect(() => {
    if (user?.token && events.length === 0 && !loading) {
      fetchEvents(true);
    }
  }, [user?.token]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    events,
    hasMore,
    loading,
    loadingProgress,
    loadingStage,
    error,
    handleLoadMore,
    fetchEvents,
    resetPagination
  };
}; 