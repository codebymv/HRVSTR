import { useState, useEffect, useCallback, useRef } from 'react';
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

// Add retry tracking
const MAX_RETRIES = 2;
const RETRY_DELAY = 3000; // 3 seconds between retries

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
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

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
    if (currentLoadingState || isRetrying) {
      console.log('🔄 EARNINGS TABBED - Already loading or retrying, skipping...');
      return;
    }

    // Prevent infinite retries
    if (retryCount >= MAX_RETRIES && !forceRefresh) {
      console.error('❌ EARNINGS TABBED - Max retry attempts reached, stopping');
      handleUpcomingEarningsLoading(false, 0, 'Max retries reached', undefined, 'Unable to load data after multiple attempts. Please try refreshing the page.');
      return;
    }

    console.log('🚀 EARNINGS TABBED - Starting loadData with forceRefresh:', forceRefresh, 'retryCount:', retryCount);
    
    // Reset retry count on manual refresh
    if (forceRefresh) {
      setRetryCount(0);
    }
    
    // Determine if this will likely be a fresh API call vs cache load
    const hasExistingData = upcomingEarnings.length > 0;
    const isInUnlockFlow = isFreshUnlock;
    
    console.log(`📊 Load characteristics: hasExistingData=${hasExistingData}, forceRefresh=${forceRefresh}, isInUnlockFlow=${isInUnlockFlow}, retryCount=${retryCount}`);
    
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
        
        // If SSE fails to connect, try fallback API with retry limit
        if (!streamInitialized && retryCount < MAX_RETRIES) {
          console.log('🔄 SSE failed to connect, trying fallback API...');
          setIsRetrying(true);
          
          fetchUpcomingEarningsWithUserCache(timeRange, forceRefresh)
            .then(response => {
              setUpcomingEarnings(response);
              handleUpcomingEarningsLoading(false, 100, 'Completed via fallback!', response, null);
              setFreshUnlockState('upcomingEarnings', false);
              setIsRetrying(false);
              setRetryCount(0); // Reset on success
            })
            .catch(fallbackError => {
              console.error('❌ Fallback API failed:', fallbackError);
              setIsRetrying(false);
              
              // Increment retry count
              const newRetryCount = retryCount + 1;
              setRetryCount(newRetryCount);
              
              if (newRetryCount < MAX_RETRIES) {
                console.log(`🔄 Will retry in ${RETRY_DELAY / 1000} seconds (attempt ${newRetryCount}/${MAX_RETRIES})`);
                handleUpcomingEarningsLoading(false, 0, `Retrying in ${RETRY_DELAY / 1000}s...`, undefined, null);
                
                // Schedule retry
                setTimeout(() => {
                  if (hasUpcomingEarningsAccess) {
                    loadData(forceRefresh);
                  }
                }, RETRY_DELAY);
              } else {
                // Max retries reached
                console.error('❌ Max retries reached for earnings data');
                handleUpcomingEarningsLoading(false, 0, 'Failed to load', undefined, 'Unable to connect to earnings service. Please check your connection and try again later.');
                setFreshUnlockState('upcomingEarnings', false);
              }
            });
        } else if (retryCount >= MAX_RETRIES) {
          console.error('❌ Max retry attempts reached, not attempting fallback');
          handleUpcomingEarningsLoading(false, 0, 'Failed to load', undefined, 'Max retry attempts reached. Please refresh the page to try again.');
          setFreshUnlockState('upcomingEarnings', false);
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
  }, [timeRange, hasUpcomingEarningsAccess, loadingState.isLoading, isFreshUnlock, retryCount, isRetrying, handleUpcomingEarningsLoading, updateLoadingProgress, setFreshUnlockState]);

  // This hook no longer manages needsRefresh state to prevent infinite loops
  // All refresh logic is now handled by the main EarningsMonitorTabbed component
  // This prevents race conditions between multiple auto-loading mechanisms
  
  // NOTE: The initial loading state and refresh triggers are now managed entirely
  // by the main component using hasLoadedOnce tracking to prevent infinite loops

  // NOTE: Auto-loading is now handled by the main EarningsMonitorTabbed component
  // to prevent race conditions and duplicate requests

  return {
    upcomingEarnings,
    sortedEarnings,
    loadData,
    setUpcomingEarnings,
  };
}; 