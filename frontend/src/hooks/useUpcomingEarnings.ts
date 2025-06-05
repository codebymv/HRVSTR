import { useState, useEffect, useCallback } from 'react';
import { TimeRange, EarningsEvent } from '../types';
import { fetchUpcomingEarningsWithUserCache, streamUpcomingEarnings } from '../services/earnings';

interface UseUpcomingEarningsProps {
  timeRange: TimeRange;
  hasUpcomingEarningsAccess: boolean;
  loadingState: { isLoading: boolean; needsRefresh: boolean };
  isFreshUnlock: boolean;
  isUnlockFlow?: boolean;
  errors: { upcomingEarnings: string | null };
  handleUpcomingEarningsLoading: (
    isLoading: boolean, 
    progress: number, 
    stage: string, 
    data?: EarningsEvent[], 
    error?: string | null
  ) => void;
  updateLoadingProgress: (progress: number, stage: string) => void;
  setFreshUnlockState: (component: 'upcomingEarnings', value: boolean) => void;
  setNeedsRefresh: (component: 'upcomingEarnings', needsRefresh: boolean) => void;
}

export const useUpcomingEarnings = ({
  timeRange,
  hasUpcomingEarningsAccess,
  loadingState,
  isFreshUnlock,
  isUnlockFlow = false,
  errors,
  handleUpcomingEarningsLoading,
  updateLoadingProgress,
  setFreshUnlockState,
  setNeedsRefresh,
}: UseUpcomingEarningsProps) => {
  const [upcomingEarnings, setUpcomingEarnings] = useState<EarningsEvent[]>([]);

  // Sort earnings by date
  const sortEarnings = useCallback((earnings: EarningsEvent[]): EarningsEvent[] => {
    return [...earnings].sort((a, b) => {
      const dateA = a.reportDate ? new Date(a.reportDate).getTime() : 0;
      const dateB = b.reportDate ? new Date(b.reportDate).getTime() : 0;
      return dateA - dateB;
    });
  }, []);

  const sortedEarnings = sortEarnings(upcomingEarnings);

  // Load data function
  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    if (!hasUpcomingEarningsAccess) {
      console.log('🔒 EARNINGS TABBED - Access denied for upcoming earnings');
      return;
    }

    // Check current loading state directly
    const currentLoadingState = loadingState.isLoading;
    if (currentLoadingState) {
      console.log('🔄 EARNINGS TABBED - Already loading, skipping...');
      return;
    }

    console.log('🚀 EARNINGS TABBED - Starting loadData with forceRefresh:', forceRefresh);
    
    // Determine if this will likely be a fresh API call vs cache load
    const hasExistingData = upcomingEarnings.length > 0;
    const isInUnlockFlow = isFreshUnlock;
    
    console.log(`📊 Load characteristics: hasExistingData=${hasExistingData}, forceRefresh=${forceRefresh}, isInUnlockFlow=${isInUnlockFlow}`);
    
    // Set fresh unlock flag based on unlock flow or manual refresh
    if (isInUnlockFlow) {
      console.log('🌟 In unlock flow - maintaining harvest loading card display');
      updateLoadingProgress(0, 'Fetching your earnings data...');
    } else if (forceRefresh && !hasExistingData) {
      console.log('🔄 Manual refresh with no existing data - showing harvest loading card (likely fresh API)');
      setFreshUnlockState('upcomingEarnings', true);
      updateLoadingProgress(0, 'Starting fresh data fetch...');
    } else {
      console.log('📦 Loading from cache or has existing data - using simple loader');
      setFreshUnlockState('upcomingEarnings', false);
    }
    
    handleUpcomingEarningsLoading(true, 0, 'Initializing...', undefined, null);

    try {
      console.log(`📊 Loading earnings data with user cache: timeRange=${timeRange}, forceRefresh=${forceRefresh}`);
      
      // Add timeout mechanism as fallback to non-streaming API
      let timeoutId: NodeJS.Timeout;
      let streamInitialized = false;
      
      // Try streaming first, but fallback to direct API if it doesn't work within 5 seconds
      const fallbackTimeoutId = setTimeout(async () => {
        if (!streamInitialized) {
          console.warn('⚠️ Earnings SSE stream not initializing - switching to direct API fallback');
          
          try {
            handleUpcomingEarningsLoading(true, 25, 'Switching to direct API...', undefined, null);
            const response = await fetchUpcomingEarningsWithUserCache(timeRange, forceRefresh);
            handleUpcomingEarningsLoading(false, 100, 'Completed!', response, null);
            // Reset flags after fallback API completes
            setFreshUnlockState('upcomingEarnings', false);
          } catch (fallbackError) {
            console.error('❌ Fallback API also failed:', fallbackError);
            handleUpcomingEarningsLoading(false, 0, 'Failed to load', undefined, String(fallbackError) || 'Both streaming and direct API failed');
            setFreshUnlockState('upcomingEarnings', false);
          }
        }
      }, 5000); // 5 second fallback timeout
      
      timeoutId = setTimeout(() => {
        console.warn('⚠️ Earnings loading timeout - request taking too long');
        handleUpcomingEarningsLoading(false, 0, 'Loading timeout', undefined, 'Request timed out, please try again');
        setFreshUnlockState('upcomingEarnings', false);
      }, 240000); // Increased from 120s to 240s to match backend
      
      // Use streaming API for better UX - matching original signature
      let streamAborted = false;
      const streamSource = streamUpcomingEarnings(
        timeRange,
        forceRefresh,
        (progressData) => {
          if (streamAborted) return;
          
          streamInitialized = true;
          clearTimeout(fallbackTimeoutId);
          console.log('📊 Earnings progress update received:', progressData);
          
          handleUpcomingEarningsLoading(true, progressData.progress || 0, progressData.stage || 'Processing...', undefined, null);
        },
        (data) => {
          if (streamAborted) return;
          
          streamInitialized = true;
          clearTimeout(fallbackTimeoutId);
          clearTimeout(timeoutId);
          console.log('✅ Earnings stream completed:', data);
          
          // Check if data source is fresh or cache
          if (data.success && data.data) {
            const isFromCache = data.source === 'cache';
            console.log(`📊 Data source: ${data.source}, fromCache: ${isFromCache}`);
            
            // Update the local state with the fetched data
            setUpcomingEarnings(data.data);
            
            // For unlock flows, always show harvest loading regardless of cache status
            if (isUnlockFlow) {
              console.log('🌟 Unlock flow - keeping harvest loading card (user spent credits)');
              // Keep isFreshUnlock as true for unlock flows
            } else {
              // For manual refreshes, show harvest loading only for fresh API calls
              if (!isFromCache && forceRefresh) {
                console.log('🔄 Fresh API call - showing harvest loading card');
                setFreshUnlockState('upcomingEarnings', true);
              } else {
                console.log('📦 Cache hit - using simple loader');
                setFreshUnlockState('upcomingEarnings', false);
              }
            }
            
            handleUpcomingEarningsLoading(false, 100, 'Completed!', data.data, null);
            
            // Reset unlock flags after completion with appropriate delay
            const resetDelay = (isInUnlockFlow || (!isFromCache && forceRefresh)) ? 1500 : 100;
            setTimeout(() => {
              setFreshUnlockState('upcomingEarnings', false);
            }, resetDelay);
          } else {
            console.error('❌ Stream completed but no valid data received:', data);
            handleUpcomingEarningsLoading(false, 0, 'Failed', undefined, 'No data received');
            setFreshUnlockState('upcomingEarnings', false);
          }
        },
        (error) => {
          if (streamAborted) return;
          
          clearTimeout(fallbackTimeoutId);
          clearTimeout(timeoutId);
          console.error('❌ Earnings stream error:', error);
          handleUpcomingEarningsLoading(false, 0, 'Error occurred', undefined, String(error) || 'Failed to load earnings data');
          setFreshUnlockState('upcomingEarnings', false);
        }
      );
      
      // Additional event listeners for debugging
      streamSource.addEventListener('open', () => {
        console.log('📡 Earnings SSE connection opened');
        streamInitialized = true;
        clearTimeout(fallbackTimeoutId);
      });
      
      streamSource.addEventListener('error', (event) => {
        console.error('📡 Earnings SSE error event:', event);
        clearTimeout(fallbackTimeoutId);
        clearTimeout(timeoutId);
        
        // If SSE fails to connect, try fallback API
        if (!streamInitialized) {
          console.log('🔄 SSE failed to connect, trying fallback API...');
          fetchUpcomingEarningsWithUserCache(timeRange, forceRefresh)
            .then(response => {
              setUpcomingEarnings(response);
              handleUpcomingEarningsLoading(false, 100, 'Completed via fallback!', response, null);
              setFreshUnlockState('upcomingEarnings', false);
            })
            .catch(fallbackError => {
              console.error('❌ Fallback API failed:', fallbackError);
              handleUpcomingEarningsLoading(false, 0, 'Failed to load', undefined, String(fallbackError) || 'Failed to load earnings data');
              setFreshUnlockState('upcomingEarnings', false);
            });
        }
      });
      
      // Cleanup function
      return () => {
        streamAborted = true;
        streamSource.close();
        clearTimeout(timeoutId);
        clearTimeout(fallbackTimeoutId);
      };
      
    } catch (error) {
      console.error('❌ Error loading earnings data:', error);
      handleUpcomingEarningsLoading(false, 0, 'Failed to load', undefined, String(error) || 'Failed to load earnings data');
      setFreshUnlockState('upcomingEarnings', false);
    }
  }, [timeRange, hasUpcomingEarningsAccess, loadingState.isLoading, upcomingEarnings.length, isFreshUnlock, handleUpcomingEarningsLoading, updateLoadingProgress, setFreshUnlockState]);

  // Calculate initial loading state based on cache freshness
  useEffect(() => {
    if (!hasUpcomingEarningsAccess) {
      setNeedsRefresh('upcomingEarnings', false);
      return;
    }

    const hasData = upcomingEarnings.length > 0;
    const needsRefresh = !hasData;
    
    if (needsRefresh && !loadingState.isLoading) {
      setNeedsRefresh('upcomingEarnings', true);
    } else if (!needsRefresh) {
      setNeedsRefresh('upcomingEarnings', false);
    }
  }, [hasUpcomingEarningsAccess, upcomingEarnings.length, loadingState.isLoading, setNeedsRefresh]);

  // Auto-load data when component becomes unlocked and has no data - triggers immediately 
  useEffect(() => {
    if (hasUpcomingEarningsAccess && !loadingState.isLoading && upcomingEarnings.length === 0 && !errors.upcomingEarnings) {
      console.log('🔄 EARNINGS MONITOR - Auto-loading data on component unlock');
      loadData(false);
    }
  }, [hasUpcomingEarningsAccess, upcomingEarnings.length, errors.upcomingEarnings, loadingState.isLoading, loadData]);

  return {
    upcomingEarnings,
    sortedEarnings,
    loadData,
    setUpcomingEarnings,
  };
}; 