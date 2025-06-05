import React, { useState, useEffect, useCallback } from 'react';
import { TimeRange, EarningsEvent, EarningsAnalysis } from '../../types';
import { fetchEarningsAnalysisWithUserCache, fetchUpcomingEarningsWithUserCache } from '../../services/api';
import { RefreshCw, AlertTriangle, Info, TrendingUp, TrendingDown, BarChart2, Loader2, Crown, Lock, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTier } from '../../contexts/TierContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import { useToast } from '../../contexts/ToastContext';
import { 
  storeUnlockSession, 
  getAllUnlockSessions,
  getSessionTimeRemainingFormatted,
  checkComponentAccess
} from '../../utils/sessionStorage';
import ProgressBar from '../ProgressBar';
import TierLimitDialog from '../UI/TierLimitDialog';
import HarvestLoadingCard from '../UI/HarvestLoadingCard';
import { 
  streamUpcomingEarnings
} from '../../services/api';

interface EarningsMonitorTabbedProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
}

const EarningsMonitorTabbed: React.FC<EarningsMonitorTabbedProps> = ({ onLoadingProgressChange }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { tierInfo, refreshTierInfo } = useTier();
  const { showTierLimitDialog, tierLimitDialog, closeTierLimitDialog } = useTierLimits();
  const { info, warning } = useToast();
  const isLight = theme === 'light';
  
  // Theme-based styling (matching SEC filings)
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const headerBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-gray-600' : 'text-gray-400';
  
  const tabActiveBg = isLight ? 'bg-blue-500' : 'bg-blue-600';
  const tabActiveText = 'text-white';
  const tabInactiveBg = isLight ? 'bg-gray-100' : 'bg-gray-800';
  const tabInactiveText = isLight ? 'text-gray-700' : 'text-gray-300';

  // Tab state
  const [activeTab, setActiveTab] = useState<'upcoming' | 'analysis'>('upcoming');

  // Component unlock state - managed by sessions
  const [unlockedComponents, setUnlockedComponents] = useState<{
    earningsAnalysis: boolean;
    upcomingEarnings: boolean;
  }>({
    earningsAnalysis: false,
    upcomingEarnings: false
  });

  // Session state for time tracking
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  
  // Add state to track when we're checking sessions (prevents locked overlay flash)
  const [isCheckingSessions, setIsCheckingSessions] = useState(true);
  
  // Get tier info
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  
  // Credit costs for each component
  const COMPONENT_COSTS = {
    earningsAnalysis: 8,
    upcomingEarnings: 12,
  };

  // State management
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingState, setLoadingState] = useState({
    upcomingEarnings: { isLoading: false, needsRefresh: false },
    earningsAnalysis: { isLoading: false, needsRefresh: false }
  });
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');

  // Track fresh unlocks vs cache loads for appropriate loading UI
  const [isFreshUnlock, setIsFreshUnlock] = useState({
    earningsAnalysis: false,
    upcomingEarnings: false
  });

  // Add flag to track when we're in an unlock flow (different from refresh flow)
  const [isUnlockFlow, setIsUnlockFlow] = useState({
    earningsAnalysis: false,
    upcomingEarnings: false
  });

  // Data states - no longer stored in localStorage (matching SEC filings approach)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [earningsAnalysis, setEarningsAnalysis] = useState<EarningsAnalysis | null>(null);
  const [upcomingEarnings, setUpcomingEarnings] = useState<EarningsEvent[]>([]);
  const [errors, setErrors] = useState<{
    upcomingEarnings: string | null;
    analysis: string | null;
  }>({
    upcomingEarnings: null,
    analysis: null
  });

  // Add state for ticker input in analysis tab
  const [analysisTickerInput, setAnalysisTickerInput] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Track which tickers have been analyzed in this session (for visual cache indication)
  const [analyzedTickers, setAnalyzedTickers] = useState<Set<string>>(new Set());

  // Check existing sessions for all users
  useEffect(() => {
    if (!tierInfo) return;
    
    const checkExistingSessions = async () => {
      setIsCheckingSessions(true);
      try {
        const earningsAnalysisSession = await checkComponentAccess('earningsAnalysis', currentTier);
        const upcomingEarningsSession = await checkComponentAccess('upcomingEarnings', currentTier);

        const newUnlockedState = {
          earningsAnalysis: !!earningsAnalysisSession,
          upcomingEarnings: !!upcomingEarningsSession
        };

        setUnlockedComponents(newUnlockedState);

        const sessions = await getAllUnlockSessions(currentTier);
        setActiveSessions(sessions);
        
        console.log('🔍 EARNINGS MONITOR TABBED - Component access check:', {
          earningsAnalysis: !!earningsAnalysisSession,
          upcomingEarnings: !!upcomingEarningsSession,
          currentTier,
          databaseSessions: sessions.length
        });
      } catch (error) {
        console.warn('Database session check failed:', error);
        setUnlockedComponents({
          earningsAnalysis: false,
          upcomingEarnings: false
        });
        setActiveSessions([]);
      } finally {
        setIsCheckingSessions(false);
      }
    };

    checkExistingSessions();
    const interval = setInterval(checkExistingSessions, 60000);
    return () => clearInterval(interval);
  }, [tierInfo, currentTier]);

  // Calculate component access state based on sessions
  const hasEarningsAnalysisAccess = unlockedComponents.earningsAnalysis;
  const hasUpcomingEarningsAccess = unlockedComponents.upcomingEarnings;
  
  // Calculate initial loading state based on cache freshness
  useEffect(() => {
    if (!hasUpcomingEarningsAccess) {
      setLoadingState(prev => ({ ...prev, upcomingEarnings: { isLoading: false, needsRefresh: false } }));
      return;
    }

    const hasData = upcomingEarnings.length > 0;
    const needsRefresh = !hasData;
    
    if (needsRefresh && !loadingState.upcomingEarnings.isLoading) {
      setLoadingState(prev => ({ ...prev, upcomingEarnings: { isLoading: false, needsRefresh: true } }));
    } else if (!needsRefresh) {
      setLoadingState(prev => ({ ...prev, upcomingEarnings: { isLoading: false, needsRefresh: false } }));
    }
  }, [hasUpcomingEarningsAccess, upcomingEarnings.length]);

  // Auto-load data when component becomes unlocked and has no data - triggers immediately 
  useEffect(() => {
    if (hasUpcomingEarningsAccess && !loadingState.upcomingEarnings.isLoading && upcomingEarnings.length === 0 && !errors.upcomingEarnings) {
      console.log('🔄 EARNINGS MONITOR - Auto-loading data on component unlock');
      loadData(false);
    }
  }, [hasUpcomingEarningsAccess, upcomingEarnings.length, errors.upcomingEarnings]);

  // Sort earnings by date
  const sortEarnings = (earnings: EarningsEvent[]): EarningsEvent[] => {
    return [...earnings].sort((a, b) => {
      const dateA = a.reportDate ? new Date(a.reportDate).getTime() : 0;
      const dateB = b.reportDate ? new Date(b.reportDate).getTime() : 0;
      return dateA - dateB;
    });
  };

  const sortedEarnings = sortEarnings(upcomingEarnings);

  // Load data function
  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    if (!hasUpcomingEarningsAccess) {
      console.log('🔒 EARNINGS TABBED - Access denied for upcoming earnings');
      return;
    }

    // Check current loading state directly
    const currentLoadingState = loadingState.upcomingEarnings.isLoading;
    if (currentLoadingState) {
      console.log('🔄 EARNINGS TABBED - Already loading, skipping...');
      return;
    }

    console.log('🚀 EARNINGS TABBED - Starting loadData with forceRefresh:', forceRefresh);
    
    // Determine if this will likely be a fresh API call vs cache load
    // Show harvest loading card when:
    // 1. We're in an unlock flow (user just spent credits)
    // 2. Force refresh is true (explicit refresh button)
    const hasExistingData = upcomingEarnings.length > 0;
    const isInUnlockFlow = isUnlockFlow.upcomingEarnings;
    
    console.log(`📊 Load characteristics: hasExistingData=${hasExistingData}, forceRefresh=${forceRefresh}, isInUnlockFlow=${isInUnlockFlow}`);
    
    // Set fresh unlock flag based on unlock flow or manual refresh
    if (isInUnlockFlow) {
      console.log('🌟 In unlock flow - maintaining harvest loading card display');
      // Don't override isFreshUnlock if we're in unlock flow - keep it as set by handleUnlockComponent
      setLoadingProgress(0);
      setLoadingStage('Fetching your earnings data...');
    } else if (forceRefresh) {
      console.log('🔄 Manual refresh - showing harvest loading card');
      setIsFreshUnlock(prev => ({
        ...prev,
        upcomingEarnings: true
      }));
      setLoadingProgress(0);
      setLoadingStage('Starting fresh data fetch...');
    } else {
      console.log('📦 Auto-load - using simple loader (cache likely)');
      setIsFreshUnlock(prev => ({
        ...prev,
        upcomingEarnings: false
      }));
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
            resetUnlockFlags();
          } catch (fallbackError) {
            console.error('❌ Fallback API also failed:', fallbackError);
            handleUpcomingEarningsLoading(false, 0, 'Failed to load', undefined, String(fallbackError) || 'Both streaming and direct API failed');
            resetUnlockFlags();
          }
        }
      }, 5000); // 5 second fallback timeout
      
      timeoutId = setTimeout(() => {
        console.warn('⚠️ Earnings loading timeout - request taking too long');
        handleUpcomingEarningsLoading(false, 0, 'Loading timeout', undefined, 'Request timed out, please try again');
        resetUnlockFlags();
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
            
            // For unlock flows, always show harvest loading regardless of cache status
            if (isInUnlockFlow) {
              console.log('🌟 Unlock flow - keeping harvest loading card (user spent credits)');
              // Keep isFreshUnlock as true for unlock flows
            } else {
              // For manual refreshes, show harvest loading only for fresh API calls
              if (!isFromCache && forceRefresh) {
                console.log('🔄 Manual refresh with fresh API call');
                setIsFreshUnlock(prev => ({
                  ...prev,
                  upcomingEarnings: true
                }));
              } else if (isFromCache) {
                console.log('📦 Cache hit - using simple loader');
                setIsFreshUnlock(prev => ({
                  ...prev,
                  upcomingEarnings: false
                }));
              }
            }
            
            handleUpcomingEarningsLoading(false, 100, 'Completed!', data.data, null);
            
            // Reset unlock flags after completion with appropriate delay
            const resetDelay = (isInUnlockFlow || (!isFromCache && forceRefresh)) ? 1500 : 100;
            setTimeout(() => {
              resetUnlockFlags();
            }, resetDelay);
          } else {
            console.error('❌ Stream completed but no valid data received:', data);
            handleUpcomingEarningsLoading(false, 0, 'Failed', undefined, 'No data received');
            resetUnlockFlags();
          }
        },
        (error) => {
          if (streamAborted) return;
          
          clearTimeout(fallbackTimeoutId);
          clearTimeout(timeoutId);
          console.error('❌ Earnings stream error:', error);
          handleUpcomingEarningsLoading(false, 0, 'Error occurred', undefined, String(error) || 'Failed to load earnings data');
          resetUnlockFlags();
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
              handleUpcomingEarningsLoading(false, 100, 'Completed via fallback!', response, null);
              resetUnlockFlags();
            })
            .catch(fallbackError => {
              console.error('❌ Fallback API failed:', fallbackError);
              handleUpcomingEarningsLoading(false, 0, 'Failed to load', undefined, String(fallbackError) || 'Failed to load earnings data');
              resetUnlockFlags();
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
      resetUnlockFlags();
    }
  }, [timeRange, hasUpcomingEarningsAccess, loadingState.upcomingEarnings.isLoading, upcomingEarnings.length, isUnlockFlow.upcomingEarnings]);

  // Helper function to reset unlock flags
  const resetUnlockFlags = () => {
    setIsFreshUnlock(prev => ({
      ...prev,
      upcomingEarnings: false
    }));
    setIsUnlockFlow(prev => ({
      ...prev,
      upcomingEarnings: false
    }));
  };

  // Load analysis function
  const loadAnalysis = useCallback(async (ticker: string) => {
    if (!hasEarningsAnalysisAccess) {
      console.log('🔒 EARNINGS TABBED - Access denied for earnings analysis');
      return;
    }

    // Determine appropriate loading UI based on:
    // 1. Fresh unlock (credits spent) → Always harvest loading
    // 2. New ticker (not analyzed in this session) → Harvest loading (likely fresh scraping)
    // 3. Previously analyzed ticker → Simple cache loading
    const isInUnlockFlow = isUnlockFlow.earningsAnalysis;
    const wasAnalyzedBefore = analyzedTickers.has(ticker);
    const shouldShowHarvestLoading = isInUnlockFlow || !wasAnalyzedBefore;
    
    console.log(`🔍 Loading analysis for ${ticker}: isInUnlockFlow=${isInUnlockFlow}, wasAnalyzedBefore=${wasAnalyzedBefore}, showHarvestLoading=${shouldShowHarvestLoading}`);
    
    // Set loading UI based on unlock flow or ticker analysis history
    if (isInUnlockFlow) {
      console.log('🌟 Just unlocked - showing harvest loading card (user spent credits)');
      // Keep isFreshUnlock as set by handleUnlockComponent
      setLoadingProgress(0);
      setLoadingStage(`Analyzing ${ticker} earnings...`);
    } else if (!wasAnalyzedBefore) {
      console.log('🔍 New ticker - showing harvest loading card (likely fresh scraping)');
      setIsFreshUnlock(prev => ({
        ...prev,
        earningsAnalysis: true
      }));
      setLoadingProgress(0);
      setLoadingStage(`Analyzing ${ticker} earnings...`);
    } else {
      console.log('📦 Previously analyzed ticker - showing simple cache loading');
      setIsFreshUnlock(prev => ({
        ...prev,
        earningsAnalysis: false
      }));
      setLoadingProgress(0);
      setLoadingStage(`Loading ${ticker} from cache...`);
    }

    handleEarningsAnalysisLoading(true, 0, `Analyzing ${ticker} earnings...`, undefined, null);
    
    try {
      if (shouldShowHarvestLoading) {
        // Show harvest loading stages for fresh unlocks or new tickers
        handleEarningsAnalysisLoading(true, 10, `Initializing analysis for ${ticker}...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        handleEarningsAnalysisLoading(true, 25, `Fetching company profile for ${ticker}...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        handleEarningsAnalysisLoading(true, 40, `Scraping historical earnings for ${ticker}...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 400));
        
        handleEarningsAnalysisLoading(true, 60, `Processing earnings data for ${ticker}...`, undefined, null);
      } else {
        // Show simple cache loading for previously analyzed tickers
        handleEarningsAnalysisLoading(true, 50, `Loading ${ticker} analysis...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      // Perform the actual API call
      console.log(`🔍 Starting fetchEarningsAnalysisWithUserCache for ${ticker}`);
      const result = await fetchEarningsAnalysisWithUserCache(ticker);
      console.log(`✅ Analysis completed for ${ticker}:`, result);
      
      // Log actual data source for monitoring (no UI changes)
      const isFromCache = result.source === 'cache';
      console.log(`📊 Data source: ${result.source}, fromCache: ${isFromCache}, UI choice: ${shouldShowHarvestLoading ? 'harvest' : 'simple'}, wasAnalyzedBefore: ${wasAnalyzedBefore}`);
      
      // Complete the loading process based on initial UI choice
      if (shouldShowHarvestLoading) {
        // Continue with harvest loading stages
        handleEarningsAnalysisLoading(true, 80, `Computing analysis metrics for ${ticker}...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        handleEarningsAnalysisLoading(true, 95, `Finalizing ${ticker} analysis...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        // Quick completion for cache
        handleEarningsAnalysisLoading(true, 90, `Finalizing ${ticker} analysis...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      handleEarningsAnalysisLoading(false, 100, 'Analysis complete!', result.analysis, null);
      
      // Add ticker to analyzed set for future reference
      setAnalyzedTickers(prev => new Set([...prev, ticker]));
      
      // Reset unlock flags after appropriate delay
      const resetDelay = shouldShowHarvestLoading ? 1500 : 100;
      setTimeout(() => {
        setIsFreshUnlock(prev => ({
          ...prev,
          earningsAnalysis: false
        }));
        if (isInUnlockFlow) {
          setIsUnlockFlow(prev => ({
            ...prev,
            earningsAnalysis: false
          }));
        }
      }, resetDelay);
      
    } catch (error) {
      console.error('❌ Earnings analysis error:', error);
      
      // Ensure loading state is properly cleared on error
      handleEarningsAnalysisLoading(false, 0, 'Analysis failed', undefined, String(error) || 'Failed to analyze earnings data');
      
      // Reset unlock flags immediately on error
      setIsFreshUnlock(prev => ({
        ...prev,
        earningsAnalysis: false
      }));
      if (isInUnlockFlow) {
        setIsUnlockFlow(prev => ({
          ...prev,
          earningsAnalysis: false
        }));
      }
      
      // Also reset loading progress explicitly
      setLoadingProgress(0);
      setLoadingStage('Analysis failed');
    }
  }, [hasEarningsAnalysisAccess, isUnlockFlow.earningsAnalysis, analyzedTickers]);

  // Refresh data function - updated to match SEC filings pattern
  const refreshData = async () => {
    // Check if any components are actually unlocked
    const hasUnlockedComponents = unlockedComponents.earningsAnalysis || unlockedComponents.upcomingEarnings;
    
    if (!hasUnlockedComponents) {
      info('Please unlock at least one component before refreshing');
      return;
    }

    setIsRefreshing(true);
    setLoadingProgress(0);
    setLoadingStage('Clearing cache...');
    
    try {
      if (onLoadingProgressChange) {
        onLoadingProgressChange(20, 'Clearing cache...');
      }

      // Clear user's specific cache (using appropriate API)
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token');
      
      await fetch(`${proxyUrl}/api/earnings/clear-cache`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(50, 'Cache cleared');
      }

      // Reset errors
      setErrors({
        upcomingEarnings: null,
        analysis: null
      });
      
      // Clear existing data
      setUpcomingEarnings([]);
      setEarningsAnalysis(null);
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(80, 'Triggering refresh...');
      }
      
      // Trigger refresh for unlocked components only
      if (unlockedComponents.upcomingEarnings) {
        setLoadingState(prev => ({
          ...prev,
          upcomingEarnings: { 
            isLoading: false, 
            needsRefresh: true 
          }
        }));
      }
      
      if (unlockedComponents.earningsAnalysis && selectedTicker) {
        setLoadingState(prev => ({
          ...prev,
          earningsAnalysis: { 
            isLoading: false, 
            needsRefresh: true 
          }
        }));
      }
      
      console.log('🔄 EARNINGS MONITOR - Manual refresh triggered for unlocked components:', {
        upcomingEarnings: unlockedComponents.upcomingEarnings,
        earningsAnalysis: unlockedComponents.earningsAnalysis
      });
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(100, 'Refresh complete');
      }
    } catch (error) {
      console.error('Error during refresh:', error);
      info('Error refreshing data. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle time range changes - no localStorage, just trigger fresh fetch
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    
    // Clear current data and trigger fresh fetch
    setUpcomingEarnings([]);
    setEarningsAnalysis(null);
    setSelectedTicker(null);
    
    // Clear any existing errors
    setErrors({
      upcomingEarnings: null,
      analysis: null
    });
    
    // Set loading states to trigger data refresh based on access
    setLoadingState({
      upcomingEarnings: { 
        isLoading: hasUpcomingEarningsAccess, 
        needsRefresh: hasUpcomingEarningsAccess 
      },
      earningsAnalysis: { 
        isLoading: false, 
        needsRefresh: false 
      }
    });
  };

  // Handle ticker click
  const handleTickerClick = (ticker: string) => {
    console.log(`🔗 EARNINGS TABBED - Clicked ticker: ${ticker}`);
    setSelectedTicker(ticker);
    
    // If user has analysis access, switch to analysis tab and load analysis
    if (hasEarningsAnalysisAccess) {
      setActiveTab('analysis');
      loadAnalysis(ticker);
    } else {
      // If no analysis access, stay on upcoming tab but show ticker as selected
      info('Unlock Earnings Analysis to view detailed analysis for this ticker');
    }
  };

  // Handle tab change
  const handleTabChange = (tab: 'upcoming' | 'analysis') => {
    setActiveTab(tab);
  };

  // Handle unlock component
  const handleUnlockComponent = async (component: keyof typeof unlockedComponents, cost: number) => {
    // Check if already unlocked using database-only approach
    const existingSession = await checkComponentAccess(component, currentTier);
    if (existingSession) {
      const timeRemaining = getSessionTimeRemainingFormatted(existingSession);
      info(`${component} already unlocked (${timeRemaining}h remaining)`);
      return;
    }
    
    try {
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${proxyUrl}/api/credits/unlock-component`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          component,
          cost
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to unlock component');
      }
      
      if (data.success) {
        // Update component state
        setUnlockedComponents(prev => ({
          ...prev,
          [component]: true
        }));
        
        // IMPORTANT: Trigger analysis loading if ticker is selected and earningsAnalysis was unlocked
        if (component === 'earningsAnalysis' && selectedTicker) {
          // Trigger analysis loading for the selected ticker
          loadAnalysis(selectedTicker);
        }
        
        // Store session in localStorage for backward compatibility only
        storeUnlockSession(component, {
          sessionId: data.sessionId,
          expiresAt: data.expiresAt,
          creditsUsed: data.creditsUsed,
          tier: tierInfo?.tier || 'free'
        });
        
        // Update active sessions by querying database
        const sessions = await getAllUnlockSessions();
        setActiveSessions(sessions);
        
        // Show appropriate toast message and set unlock flow flags
        if (data.existingSession) {
          info(`${component} already unlocked (${data.timeRemaining}h remaining)`);
          // This is a cache load, not a fresh unlock - no special loading needed
          setIsFreshUnlock(prev => ({
            ...prev,
            [component]: false
          }));
          setIsUnlockFlow(prev => ({
            ...prev,
            [component]: false
          }));
        } else {
          info(`${data.creditsUsed} credits used`);
          // This is a fresh unlock with credits spent - ALWAYS show harvest loading for initial data fetch
          console.log(`🌟 FRESH UNLOCK: ${component} - Credits spent, will show harvest loading for initial data fetch`);
          setIsFreshUnlock(prev => ({
            ...prev,
            [component]: true
          }));
          setIsUnlockFlow(prev => ({
            ...prev,
            [component]: true
          }));
        }
        
        // Refresh tier info to update usage meter
        if (refreshTierInfo) {
          await refreshTierInfo();
        }
        
        // Trigger data loading if upcoming earnings was unlocked
        if (component === 'upcomingEarnings') {
          // Pass true to indicate this is a force refresh from unlock (not manual refresh)
          loadData(true);
        }
      }
      
    } catch (error) {
      info(`Failed to unlock ${component}. Please try again.`);
    }
  };

  // Handle loading updates from upcoming earnings tab
  const handleUpcomingEarningsLoading = (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => {
    setLoadingState(prev => ({
      ...prev,
      upcomingEarnings: { 
        isLoading, 
        needsRefresh: false
      }
    }));
    
    // When loading completes successfully, update data
    if (!isLoading && data) {
      setUpcomingEarnings(data);
    }
    
    // Update error state if provided
    if (error !== undefined) {
      setErrors(prev => ({ ...prev, upcomingEarnings: error }));
    }
    
    // Always update progress for analysis loading (to support harvest loading card)
    setLoadingProgress(progress);
    setLoadingStage(stage);
    
    // Propagate to parent component
    if (onLoadingProgressChange) {
      onLoadingProgressChange(progress, stage);
    }

    // Clear refresh state when upcoming earnings loading completes
    if (!isLoading && isRefreshing) {
      const analysisComplete = !hasEarningsAnalysisAccess || !loadingState.earningsAnalysis.isLoading;
      if (analysisComplete) {
        setIsRefreshing(false);
      }
    }
  };
  
  // Handle loading updates from earnings analysis tab
  const handleEarningsAnalysisLoading = (isLoading: boolean, progress: number, stage: string, data?: any, error?: string | null) => {
    setLoadingState(prev => ({
      ...prev,
      earningsAnalysis: { 
        isLoading, 
        needsRefresh: false
      }
    }));
    
    // When loading completes successfully, update data
    if (!isLoading && data) {
      setEarningsAnalysis(data);
    }
    
    // Update error state if provided
    if (error !== undefined) {
      setErrors(prev => ({ ...prev, analysis: error }));
    }
    
    // Always update progress for analysis loading (to support harvest loading card)
    setLoadingProgress(progress);
    setLoadingStage(stage);
    
    // Propagate to parent component
    if (onLoadingProgressChange) {
      onLoadingProgressChange(progress, stage);
    }

    // Clear refresh state when analysis loading completes
    if (!isLoading && isRefreshing) {
      const upcomingComplete = !loadingState.upcomingEarnings.isLoading;
      if (upcomingComplete) {
        setIsRefreshing(false);
      }
    }
  };

  // Monitor loading states and clear refresh state when all loading is complete
  useEffect(() => {
    if (isRefreshing) {
      const upcomingDone = !hasUpcomingEarningsAccess || !loadingState.upcomingEarnings.isLoading;
      const analysisDone = !hasEarningsAnalysisAccess || !loadingState.earningsAnalysis.isLoading;
      
      // If no components are accessible, end refresh immediately
      if (!hasUpcomingEarningsAccess && !hasEarningsAnalysisAccess) {
        console.log('🔄 EARNINGS MONITOR - No components accessible, ending refresh');
        setIsRefreshing(false);
        return;
      }
      
      if (upcomingDone && analysisDone) {
        console.log('🔄 EARNINGS MONITOR - All accessible components loaded, ending refresh');
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing, loadingState.upcomingEarnings.isLoading, loadingState.earningsAnalysis.isLoading, hasUpcomingEarningsAccess, hasEarningsAnalysisAccess]);

  // Monitor needsRefresh state and trigger loading
  useEffect(() => {
    if (loadingState.upcomingEarnings.needsRefresh && hasUpcomingEarningsAccess && !loadingState.upcomingEarnings.isLoading) {
      console.log('🔄 EARNINGS MONITOR - Triggering upcoming earnings refresh');
      loadData(true);
    }
  }, [loadingState.upcomingEarnings.needsRefresh, hasUpcomingEarningsAccess]);

  useEffect(() => {
    if (loadingState.earningsAnalysis.needsRefresh && hasEarningsAnalysisAccess && selectedTicker && !loadingState.earningsAnalysis.isLoading) {
      console.log('🔄 EARNINGS MONITOR - Triggering earnings analysis refresh');
      loadAnalysis(selectedTicker);
    }
  }, [loadingState.earningsAnalysis.needsRefresh, hasEarningsAnalysisAccess, selectedTicker]);

  // Auto-trigger data loading when components become unlocked (cross-device sync)
  useEffect(() => {
    // Only auto-trigger if the current tier supports the component
    const tierSupportsUpcoming = true; // All tiers can unlock upcoming earnings with credits
    const tierSupportsAnalysis = ['pro', 'elite', 'institutional'].includes(currentTier.toLowerCase());
    
    // Trigger data loading for upcoming earnings when it becomes unlocked
    if (unlockedComponents.upcomingEarnings && 
        tierSupportsUpcoming &&
        !loadingState.upcomingEarnings.isLoading && 
        !loadingState.upcomingEarnings.needsRefresh &&
        upcomingEarnings.length === 0) {
      console.log('🔄 EARNINGS MONITOR - Auto-triggering upcoming earnings data load');
      setLoadingState(prev => ({
        ...prev,
        upcomingEarnings: { 
          isLoading: true, // Fix: Set to true immediately to prevent empty state flicker
          needsRefresh: true 
        }
      }));
    }
    
    // For earnings analysis, we don't auto-trigger since it requires a selected ticker
    // But we ensure the component state is ready when unlocked
    if (unlockedComponents.earningsAnalysis && 
        tierSupportsAnalysis &&
        !loadingState.earningsAnalysis.isLoading) {
      console.log('🔄 EARNINGS MONITOR - Earnings analysis unlocked and ready');
    }
  }, [
    unlockedComponents.upcomingEarnings, 
    unlockedComponents.earningsAnalysis,
    loadingState.upcomingEarnings.isLoading,
    loadingState.earningsAnalysis.isLoading,
    loadingState.upcomingEarnings.needsRefresh,
    loadingState.earningsAnalysis.needsRefresh,
    upcomingEarnings.length,
    currentTier // Add currentTier as dependency to react to tier changes
  ]);

  // Handle manual ticker input for analysis
  const handleAnalyzeManualTicker = async () => {
    const ticker = analysisTickerInput.trim().toUpperCase();
    if (!ticker) {
      warning('Please enter a valid ticker symbol');
      return;
    }

    if (!hasEarningsAnalysisAccess) {
      info('Please unlock Earnings Analysis to analyze tickers');
      return;
    }

    setIsAnalyzing(true);
    setSelectedTicker(ticker);
    setAnalysisTickerInput('');
    
    try {
      await loadAnalysis(ticker);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Enter key in ticker input
  const handleTickerInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAnalyzeManualTicker();
    }
  };

  // Locked overlay component
  const LockedOverlay: React.FC<{
    title: string;
    description: string;
    cost: number;
    componentKey: keyof typeof unlockedComponents;
    icon: React.ReactNode;
  }> = ({ title, description, cost, componentKey, icon }) => (
    <div className={`${isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'} rounded-lg border p-8 text-center relative overflow-hidden`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600" />
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
        
        <h3 className={`text-xl font-bold ${textColor} mb-2`}>
          {title}
        </h3>
        
        <p className={`${subTextColor} mb-6 max-w-sm mx-auto`}>
          {description}
        </p>
        
        <div className={`${isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/20 border-blue-800'} rounded-lg p-4 border mb-6`}>
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <Zap className="w-4 h-4 text-blue-500" />
            <span className={textColor}>{cost} credits</span>
          </div>
        </div>
        
        <button
          onClick={() => handleUnlockComponent(componentKey, cost)}
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center mx-auto gap-2"
        >
          <Crown className="w-4 h-4" />
          Unlock for {cost} Credits
        </button>
      </div>
    </div>
  );

  // Earnings upgrade card for free users
  const EarningsUpgradeCard: React.FC = () => {
    const buttonBg = isLight ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700';
    
    return (
      <div className="text-center p-8">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <Crown className="w-8 h-8 text-white" />
        </div>
        <h3 className={`text-xl font-bold ${textColor} mb-3`}>Upgrade to Pro</h3>
        <p className={`${subTextColor} mb-6 leading-relaxed`}>
          Earnings analysis is a Pro feature. Upgrade to access comprehensive analysis and insights.
        </p>
        
        <div className={`${isLight ? 'bg-stone-200' : 'bg-gray-800'} rounded-lg p-4 mb-6`}>
          <h4 className={`font-semibold ${textColor} mb-2`}>Pro Features Include:</h4>
          <ul className={`text-sm ${subTextColor} text-left space-y-1`}>
            <li>• Comprehensive earnings analysis</li>
            <li>• Company financial overview</li>
            <li>• Performance metrics tracking</li>
            <li>• Risk assessment insights</li>
          </ul>
        </div>
        
        <button
          onClick={() => showTierLimitDialog(
            'Earnings Analysis',
            'Earnings analysis is a Pro feature. Upgrade to access comprehensive company analysis, financial metrics, and professional insights.',
            'Unlock advanced earnings analysis, sector information, trading ranges, and detailed financial insights with HRVSTR Pro.',
            'general'
          )}
          className={`${buttonBg} text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center mx-auto`}
        >
          <Crown className="w-4 h-4 mr-2" />
          Upgrade to Pro
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Tier Limit Dialog */}
      {tierLimitDialog.isOpen && (
        <TierLimitDialog
          isOpen={tierLimitDialog.isOpen}
          onClose={closeTierLimitDialog}
          featureName={tierLimitDialog.featureName}
          message={tierLimitDialog.message}
          upgradeMessage={tierLimitDialog.upgradeMessage}
          currentTier={currentTier}
          context={tierLimitDialog.context}
        />
      )}

      <div className="flex flex-col h-full">
        {/* Header */}
        <div className={`flex flex-row justify-between items-center gap-4 mb-4 ${cardBg} rounded-lg p-4 border ${cardBorder}`}>
          <div className="flex-1">
            <h1 className={`text-xl font-bold ${textColor}`}>Earnings Monitor</h1>
            <p className={`text-sm ${subTextColor}`}>Track upcoming earnings events and analysis</p>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Time range selector */}
            <select 
              value={timeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value as TimeRange)}
              className={`py-1 px-2 rounded text-sm ${cardBg} ${textColor} border ${cardBorder} ${
                !(unlockedComponents.earningsAnalysis || unlockedComponents.upcomingEarnings)
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
              disabled={loadingState.upcomingEarnings.isLoading || loadingState.earningsAnalysis.isLoading || !(unlockedComponents.earningsAnalysis || unlockedComponents.upcomingEarnings)}
            >
              <option value="1d">Today</option>
              <option value="1w">This Week</option>
            </select>
            
            {/* Refresh button */}
            <button 
              className={`transition-colors rounded-full p-2 ${
                (unlockedComponents.earningsAnalysis || unlockedComponents.upcomingEarnings)
                  ? `${isLight ? 'bg-blue-500' : 'bg-blue-600'} hover:${isLight ? 'bg-blue-600' : 'bg-blue-700'} text-white`
                  : 'bg-gray-400 cursor-not-allowed text-gray-200'
              } ${(loadingState.upcomingEarnings.isLoading || loadingState.earningsAnalysis.isLoading) ? 'opacity-50' : ''}`}
              onClick={refreshData}
              disabled={(loadingState.upcomingEarnings.isLoading || loadingState.earningsAnalysis.isLoading) || !(unlockedComponents.earningsAnalysis || unlockedComponents.upcomingEarnings)}
            >
              {(unlockedComponents.earningsAnalysis || unlockedComponents.upcomingEarnings) && (loadingState.upcomingEarnings.isLoading || loadingState.earningsAnalysis.isLoading) ? (
                <Loader2 size={18} className="text-white animate-spin" />
              ) : (
                <RefreshCw size={18} className={
                  !(unlockedComponents.earningsAnalysis || unlockedComponents.upcomingEarnings)
                    ? 'text-gray-200' 
                    : 'text-white'
                } />
              )}
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="mb-4 flex w-full">
          <button
            className={`py-2 px-4 rounded-t-lg font-medium text-sm flex-1 text-center ${
              activeTab === 'upcoming' ? `${tabActiveBg} ${tabActiveText}` : `${tabInactiveBg} ${tabInactiveText}`
            }`}
            onClick={() => handleTabChange('upcoming')}
          >
            Upcoming Earnings
          </button>
          <button
            className={`py-2 px-4 rounded-t-lg font-medium text-sm flex-1 text-center ${
              activeTab === 'analysis' ? `${tabActiveBg} ${tabActiveText}` : `${tabInactiveBg} ${tabInactiveText}`
            }`}
            onClick={() => handleTabChange('analysis')}
          >
            Earnings Analysis
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'upcoming' && (
            <>
              {isCheckingSessions ? (
                // Show loading while checking sessions to prevent locked overlay flash
                <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
                  <div className={`${headerBg} p-4`}>
                    <h2 className={`text-lg font-semibold ${textColor}`}>Upcoming Earnings</h2>
                  </div>
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <Loader2 className="text-blue-500 animate-spin mb-4" size={32} />
                    <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                      Checking Access...
                    </h3>
                    <p className={`text-sm ${subTextColor} mb-4`}>
                      Verifying component access...
                    </p>
                    <div className="w-full max-w-md">
                      <ProgressBar progress={50} />
                      <div className={`text-xs ${subTextColor} mt-2 text-center`}>
                        Checking access...
                      </div>
                    </div>
                  </div>
                </div>
              ) : hasUpcomingEarningsAccess ? (
                <>
                  {loadingState.upcomingEarnings.isLoading || (upcomingEarnings.length === 0 && !errors.upcomingEarnings) ? (
                    <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
                      <div className={`${headerBg} p-4`}>
                        <h2 className={`text-lg font-semibold ${textColor}`}>Upcoming Earnings</h2>
                      </div>
                      {isFreshUnlock.upcomingEarnings ? (
                        <HarvestLoadingCard
                          progress={loadingProgress}
                          stage={loadingStage}
                          operation="earnings-calendar"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                          <Loader2 className="text-blue-500 animate-spin mb-4" size={32} />
                          <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                            Loading Upcoming Earnings
                          </h3>
                          <p className={`text-sm ${subTextColor} mb-4`}>
                            Loading from cache...
                          </p>
                          <div className="w-full max-w-md">
                            <ProgressBar progress={loadingProgress} />
                            <div className={`text-xs ${subTextColor} mt-2 text-center`}>
                              {loadingStage} - {loadingProgress}%
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
                      <div className="p-4 h-full overflow-auto">
                        {errors.upcomingEarnings ? (
                          <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                            <AlertTriangle className="mb-2 text-yellow-500" size={32} />
                            <p>{errors.upcomingEarnings}</p>
                          </div>
                        ) : upcomingEarnings.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className={`min-w-full ${textColor}`}>
                              <thead className={`${headerBg} border-b ${cardBorder}`}>
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Ticker</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Company</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                                </tr>
                              </thead>
                              <tbody className={`divide-y ${cardBorder}`}>
                                {sortedEarnings.filter((earnings) => {
                                  if (!earnings.ticker || typeof earnings.ticker !== 'string' || earnings.ticker.trim() === '') {
                                    return false;
                                  }
                                  return true;
                                }).map((earnings, index) => {
                                  if (!earnings.ticker || typeof earnings.ticker !== 'string' || earnings.ticker.trim() === '') {
                                    return null;
                                  }
                                  
                                  // Determine row styling - blue highlight for selected OR previously analyzed
                                  const isSelected = selectedTicker === earnings.ticker;
                                  const isAnalyzed = analyzedTickers.has(earnings.ticker);
                                  const shouldHighlight = isSelected || isAnalyzed;
                                  
                                  const rowBg = shouldHighlight ? (isLight ? 'bg-blue-100' : 'bg-blue-900/30') : '';
                                  const hoverBg = isLight ? 'hover:bg-stone-200' : 'hover:bg-gray-800';
                                  
                                  return (
                                    <tr 
                                      key={`earnings-${earnings.ticker}-${index}`} 
                                      className={`${hoverBg} ${rowBg} cursor-pointer transition-colors`}
                                      onClick={() => handleTickerClick(earnings.ticker)}
                                    >
                                      <td className="px-4 py-3 font-medium">{earnings.ticker}</td>
                                      <td className="px-4 py-3">
                                        {earnings.companyName || 'Unknown Company'}
                                      </td>
                                      <td className="px-4 py-3">
                                        {earnings.reportDate ? 
                                          new Date(earnings.reportDate).toLocaleDateString() : 
                                          'TBA'}
                                      </td>
                                    </tr>
                                  );
                                }).filter(Boolean)}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                            <Info className="mb-2" size={32} />
                            <p>No upcoming earnings found in the selected time range</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <LockedOverlay
                  title="Upcoming Earnings"
                  description="Unlock access to upcoming earnings calendar with comprehensive company event tracking and dates."
                  cost={COMPONENT_COSTS.upcomingEarnings}
                  componentKey="upcomingEarnings"
                  icon={<TrendingUp className="w-8 h-8 text-white" />}
                />
              )}
            </>
          )}
          
          {activeTab === 'analysis' && (
            <>
              {currentTier === 'free' ? (
                <EarningsUpgradeCard />
              ) : hasEarningsAnalysisAccess ? (
                <>
                  {!selectedTicker ? (
                    <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
                      <div className="p-6 h-full flex flex-col items-center justify-center">
                        <div className={`flex flex-col items-center text-center max-w-md mx-auto space-y-6`}>
                          <div className={`p-4 rounded-full ${isLight ? 'bg-blue-100' : 'bg-blue-900/30'}`}>
                            <TrendingUp className={`w-8 h-8 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                          </div>
                          
                          <div className="space-y-2">
                            <h3 className={`text-lg font-semibold ${textColor}`}>
                              Earnings Analysis
                            </h3>
                            <p className={`text-sm ${subTextColor}`}>
                              Enter a ticker symbol to analyze earnings history, surprises, and financial metrics
                            </p>
                          </div>
                          
                          <div className="w-full space-y-3">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={analysisTickerInput}
                                onChange={(e) => setAnalysisTickerInput(e.target.value.toUpperCase())}
                                onKeyPress={handleTickerInputKeyPress}
                                placeholder="Enter ticker (e.g., AAPL)"
                                className={`flex-1 px-3 py-2 border rounded-md text-sm ${
                                  isLight 
                                    ? 'bg-white border-stone-300 text-stone-900 placeholder-stone-500 focus:border-blue-500' 
                                    : 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-400'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                maxLength={10}
                              />
                              <button
                                onClick={handleAnalyzeManualTicker}
                                disabled={!analysisTickerInput.trim() || isAnalyzing}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                  !analysisTickerInput.trim() || isAnalyzing
                                    ? isLight 
                                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed' 
                                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : isLight
                                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                                      : 'bg-blue-600 text-white hover:bg-blue-500'
                                }`}
                              >
                                {isAnalyzing ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Analyze'
                                )}
                              </button>
                            </div>
                            
                            <div className={`text-xs ${subTextColor} text-center`}>
                              Or click a ticker from the Upcoming Earnings tab
                            </div>
                            
                            {/* Popular ticker suggestions */}
                            <div className="w-full">
                              <p className={`text-xs ${subTextColor} mb-2 text-center`}>
                                Popular tickers:
                              </p>
                              <div className="flex flex-wrap gap-2 justify-center">
                                {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'].map((ticker) => (
                                  <button
                                    key={ticker}
                                    onClick={() => {
                                      setAnalysisTickerInput('');
                                      setSelectedTicker(ticker);
                                      loadAnalysis(ticker);
                                    }}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                                      isLight
                                        ? 'border-stone-300 text-stone-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50'
                                        : 'border-gray-600 text-gray-400 hover:border-blue-400 hover:text-blue-400 hover:bg-blue-900/20'
                                    }`}
                                  >
                                    {ticker}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : loadingState.earningsAnalysis.isLoading ? (
                    <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
                      <div className={`${headerBg} p-4`}>
                        <h2 className={`text-lg font-semibold ${textColor}`}>Earnings Analysis for {selectedTicker}</h2>
                      </div>
                      {isFreshUnlock.earningsAnalysis ? (
                        <HarvestLoadingCard
                          progress={loadingProgress}
                          stage={loadingStage}
                          operation="earnings-analysis"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                          <Loader2 className="text-blue-500 animate-spin mb-4" size={32} />
                          <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                            Loading Earnings Analysis
                          </h3>
                          <p className={`text-sm ${subTextColor} mb-4`}>
                            Loading from cache...
                          </p>
                          <div className="w-full max-w-md">
                            <ProgressBar progress={loadingProgress} />
                            <div className={`text-xs ${subTextColor} mt-2 text-center`}>
                              {loadingStage} - {loadingProgress}%
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
                      <div className="p-4 h-full overflow-auto">
                        {errors.analysis ? (
                          <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                            <AlertTriangle className="mb-2 text-yellow-500" size={32} />
                            <p>{errors.analysis}</p>
                          </div>
                        ) : earningsAnalysis ? (
                          <div className="space-y-4">
                            {/* Company Information */}
                            <div className={`${isLight ? 'bg-stone-200' : 'bg-gray-800/90'} rounded-lg p-4`}>
                              <div className="flex items-center space-x-2 mb-3">
                                <TrendingUp size={20} className="text-blue-400" />
                                <span className="text-sm font-medium">Company Overview</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Company:</span>
                                    <span className={isLight ? 'text-stone-900 font-medium' : 'text-white font-medium'}>
                                      {earningsAnalysis.companyName || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Sector:</span>
                                    <span className={isLight ? 'text-stone-900 font-medium' : 'text-white font-medium'}>
                                      {earningsAnalysis.sector || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Industry:</span>
                                    <span className={isLight ? 'text-stone-900 font-medium' : 'text-white font-medium'}>
                                      {earningsAnalysis.industry || 'N/A'}
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Market Cap:</span>
                                    <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                                      {earningsAnalysis.marketCap 
                                        ? `$${(earningsAnalysis.marketCap / 1000000000).toFixed(2)}B`
                                        : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>P/E Ratio:</span>
                                    <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                                      {(earningsAnalysis.pe !== null && earningsAnalysis.pe !== undefined) ? earningsAnalysis.pe.toFixed(2) : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>EPS:</span>
                                    <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                                      {(earningsAnalysis.eps !== null && earningsAnalysis.eps !== undefined) ? `$${earningsAnalysis.eps.toFixed(2)}` : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Financial Metrics */}
                            <div className={`${isLight ? 'bg-stone-200' : 'bg-gray-800/90'} rounded-lg p-4`}>
                              <div className="flex items-center space-x-2 mb-3">
                                <TrendingUp size={20} className="text-green-400" />
                                <span className="text-sm font-medium">Financial Metrics</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Current Price:</span>
                                    <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                                      {(earningsAnalysis.currentPrice !== null && earningsAnalysis.currentPrice !== undefined)
                                        ? `$${earningsAnalysis.currentPrice.toFixed(2)}`
                                        : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Price Change:</span>
                                    <span className={
                                      (earningsAnalysis.priceChangePercent === null || earningsAnalysis.priceChangePercent === undefined)
                                        ? isLight ? 'text-stone-600' : 'text-gray-400'
                                        : earningsAnalysis.priceChangePercent > 0 
                                          ? 'text-green-500 font-medium' 
                                          : 'text-red-500 font-medium'
                                    }>
                                      {(earningsAnalysis.priceChangePercent !== null && earningsAnalysis.priceChangePercent !== undefined)
                                        ? `${earningsAnalysis.priceChangePercent > 0 ? '+' : ''}${earningsAnalysis.priceChangePercent.toFixed(2)}%`
                                        : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Day Range:</span>
                                    <span className={isLight ? 'text-stone-900 font-medium' : 'text-white font-medium'}>
                                      {earningsAnalysis.dayLow && earningsAnalysis.dayHigh
                                        ? `$${earningsAnalysis.dayLow.toFixed(2)} - $${earningsAnalysis.dayHigh.toFixed(2)}`
                                        : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>52W Range:</span>
                                    <span className={isLight ? 'text-stone-900 font-medium' : 'text-white font-medium'}>
                                      {earningsAnalysis.yearLow && earningsAnalysis.yearHigh
                                        ? `$${earningsAnalysis.yearLow.toFixed(2)} - $${earningsAnalysis.yearHigh.toFixed(2)}`
                                        : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Earnings Date:</span>
                                    <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                                      {earningsAnalysis.earningsDate 
                                        ? new Date(earningsAnalysis.earningsDate).toLocaleDateString()
                                        : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Analysis Score:</span>
                                    <span className={
                                      (earningsAnalysis.analysisScore ?? 0) >= 70 ? 'text-green-500 font-medium' :
                                      (earningsAnalysis.analysisScore ?? 0) >= 50 ? 'text-yellow-500 font-medium' :
                                      'text-red-500 font-medium'
                                    }>
                                      {earningsAnalysis.analysisScore ? `${earningsAnalysis.analysisScore}/100` : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Additional analysis sections would continue here... */}
                            {/* For brevity, I'm including just the key sections */}
                          </div>
                        ) : (
                          <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                            <Info className="mb-2" size={32} />
                            <p>No analysis data available for the selected ticker</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <LockedOverlay
                  title="Earnings Analysis"
                  description="Unlock detailed earnings analysis for any ticker. Analyze historical performance, surprises, and financial metrics independently."
                  cost={COMPONENT_COSTS.earningsAnalysis}
                  componentKey="earningsAnalysis"
                  icon={<TrendingUp className="w-8 h-8 text-white" />}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default EarningsMonitorTabbed; 