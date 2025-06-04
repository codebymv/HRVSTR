import React, { useState, useEffect } from 'react';
import { TimeRange, EarningsEvent, EarningsAnalysis } from '../../types';
import { fetchUpcomingEarningsWithProgress, ProgressUpdate } from '../../services/earningsService';
import { fetchEarningsAnalysisWithUserCache } from '../../services/api';
import { RefreshCw, AlertTriangle, Info, TrendingUp, TrendingDown, BarChart2, Loader2, Crown, Lock, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTier } from '../../contexts/TierContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import { useToast } from '../../contexts/ToastContext';
import { 
  checkUnlockSession, 
  storeUnlockSession, 
  getAllUnlockSessions,
  getSessionTimeRemainingFormatted,
  checkComponentAccess,
  clearComponentAccessCache
} from '../../utils/sessionStorage';
import ProgressBar from '../ProgressBar';
import TierLimitDialog from '../UI/TierLimitDialog';
import { 
  fetchUpcomingEarningsWithUserCache, 
  streamUpcomingEarnings,
  clearUserEarningsCache,
  getUserEarningsCacheStatus,
  clearEarningsCache 
} from '../../services/api';

interface EarningsMonitorProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
}

const EarningsMonitor: React.FC<EarningsMonitorProps> = ({ onLoadingProgressChange }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { tierInfo, refreshTierInfo } = useTier();
  const { showTierLimitDialog, tierLimitDialog, closeTierLimitDialog } = useTierLimits();
  const { info } = useToast();
  const isLight = theme === 'light';
  
  // Component unlock state - managed by sessions
  const [unlockedComponents, setUnlockedComponents] = useState<{
    earningsAnalysis: boolean;
  }>({
    earningsAnalysis: false
  });

  // Session state for time tracking
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  
  // Get tier info
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  
  // Credit costs for each component
  const COMPONENT_COSTS = {
    earningsAnalysis: 8, // Earnings analysis feature
  };

  // Check existing sessions for all users
  useEffect(() => {
    if (!tierInfo) return;
    
    const checkExistingSessions = async () => {
      try {
        // Use database-only checking - no more localStorage fallback
        const analysisSession = await checkComponentAccess('earningsAnalysis', currentTier);

        setUnlockedComponents({
          earningsAnalysis: !!analysisSession
        });

        // Update active sessions for display - NOW QUERIES DATABASE ONLY
        const sessions = await getAllUnlockSessions();
        setActiveSessions(sessions);
        
        console.log('🔍 EARNINGS MONITOR - Component access check (DATABASE ONLY):', {
          earningsAnalysis: !!analysisSession,
          analysisSessionId: analysisSession?.sessionId,
          currentTier,
          databaseSessions: sessions.length
        });
      } catch (error) {
        console.warn('Database session check failed:', error);
        // No more localStorage fallback - just set to false if database fails
        setUnlockedComponents({
          earningsAnalysis: false
        });

        setActiveSessions([]);
      }
    };

    // Check sessions immediately
    checkExistingSessions();
    
    // RATE LIMITING FIX: Check for expired sessions every 5 minutes instead of 1 minute
    const interval = setInterval(checkExistingSessions, 5 * 60 * 1000); // Changed from 60000ms to 300000ms
    return () => clearInterval(interval);
  }, [tierInfo, currentTier]);
  
  // Theme specific styling
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const tableHeaderBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-300';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const hoverBg = isLight ? 'hover:bg-stone-200' : 'hover:bg-gray-800';
  const selectedBg = isLight ? 'bg-blue-100' : 'bg-blue-900/30';
  const analysisBg = isLight ? 'bg-stone-200' : 'bg-gray-800/90';
  
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');
  const [loading, setLoading] = useState({
    upcomingEarnings: false,
    analysis: false
  });
  
  // Helper function to check if data is stale (older than 30 minutes)
  const isDataStale = (timestamp: number | null): boolean => {
    if (!timestamp) return true;
    const thirtyMinutesInMs = 30 * 60 * 1000;
    return Date.now() - timestamp > thirtyMinutesInMs;
  };

  // Cached data state with localStorage persistence
  const [upcomingEarnings, setUpcomingEarnings] = useState<EarningsEvent[]>(() => {
    try {
      const cached = localStorage.getItem('earnings_upcomingEarnings');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.error('Error loading cached earnings:', e);
      return [];
    }
  });
  
  // Track the last fetch time
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(() => {
    try {
      const cached = localStorage.getItem('earnings_lastFetchTime');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.error('Error loading cached fetch time:', e);
      return null;
    }
  });
  
  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (upcomingEarnings.length > 0) {
      localStorage.setItem('earnings_upcomingEarnings', JSON.stringify(upcomingEarnings));
    }
  }, [upcomingEarnings]);
  
  // Save last fetch time to localStorage
  useEffect(() => {
    if (lastFetchTime) {
      localStorage.setItem('earnings_lastFetchTime', JSON.stringify(lastFetchTime));
    }
  }, [lastFetchTime]);
  
  // Calculate initial loading state based on cache freshness
  useEffect(() => {
    const hasData = upcomingEarnings.length > 0;
    const dataIsStale = isDataStale(lastFetchTime);
    const needsRefresh = !hasData || dataIsStale;
    
    // Set initial loading state based on cache freshness - earnings table is always available
    if (needsRefresh) {
      setLoading(prev => ({ ...prev, upcomingEarnings: true }));
    } else if (!needsRefresh) {
      setLoading(prev => ({ ...prev, upcomingEarnings: false }));
    }
  }, []); // Only run on mount
  
  // Progress tracking states for better UX
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...');
  const [errors, setErrors] = useState<{
    upcomingEarnings: string | null;
    analysis: string | null;
  }>({
    upcomingEarnings: null,
    analysis: null,
  });
  
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [earningsAnalysis, setEarningsAnalysis] = useState<EarningsAnalysis | null>(null);

  // Debug function to clear all earnings cache - available in browser console
  useEffect(() => {
    (window as any).clearEarningsCache = () => {
      localStorage.removeItem('earnings_upcomingEarnings');
      localStorage.removeItem('earnings_lastFetchTime');
      
      setUpcomingEarnings([]);
      setLastFetchTime(null);
      setErrors({ upcomingEarnings: null, analysis: null });
      setLoading({ upcomingEarnings: false, analysis: false });
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const sortEarnings = (earnings: EarningsEvent[]): EarningsEvent[] => {
    return [...earnings].sort((a, b) => {
      const dateA = a.reportDate ? new Date(a.reportDate).getTime() : 0;
      const dateB = b.reportDate ? new Date(b.reportDate).getTime() : 0;
      return dateA - dateB; // Sort by report date ascending
    });
  };

  const sortedEarnings = sortEarnings(upcomingEarnings);

  const loadData = async (forceRefresh: boolean = false) => {
    // FIX: Don't auto-load data or set empty arrays - let the UI handle locked state
    // Only proceed with data loading if user actually has an active session
    const hasEarningsAccess = await checkComponentAccess('earningsAnalysis', currentTier);
    if (!hasEarningsAccess) {
      console.log('📊 No active earnings session - UI will show unlock prompt');
      // Don't set empty arrays or change loading state - let UI handle it
      return;
    }
    
    console.log('📊 User has earnings access - loading data');
    setLoading(prev => ({ ...prev, upcomingEarnings: true }));
    setErrors(prev => ({ ...prev, upcomingEarnings: null }));
    
    try {
      console.log(`📊 Loading earnings data with user cache: timeRange=${timeRange}, forceRefresh=${forceRefresh}`);
      
      // Use streaming API for better UX
      let streamAborted = false;
      const streamSource = streamUpcomingEarnings(
        timeRange,
        forceRefresh,
        (progressData) => {
          if (streamAborted) return;
          
          console.log('📊 Earnings progress:', progressData);
          setLoadingProgress(progressData.progress);
          setLoadingStage(progressData.stage);
          
          // Propagate to parent component if callback exists
          if (onLoadingProgressChange) {
            onLoadingProgressChange(progressData.progress, progressData.stage);
          }
        },
        (data) => {
          if (streamAborted) return;
          
          console.log('✅ Earnings stream completed:', data);
          if (data.success && data.data) {
            setUpcomingEarnings(data.data);
          }
          setLoading(prev => ({ ...prev, upcomingEarnings: false }));
          
          if (onLoadingProgressChange) {
            onLoadingProgressChange(100, 'Completed!');
          }
        },
        (error) => {
          if (streamAborted) return;
          
          console.error('❌ Earnings stream error:', error);
          setErrors(prev => ({ 
            ...prev, 
            upcomingEarnings: error
          }));
          setLoading(prev => ({ ...prev, upcomingEarnings: false }));
          
          if (onLoadingProgressChange) {
            onLoadingProgressChange(0, 'Error occurred');
          }
        }
      );
      
      // Cleanup function
      return () => {
        streamAborted = true;
        streamSource.close();
      };
      
    } catch (error) {
      console.error('Earnings data loading error:', error);
      setErrors(prev => ({ 
        ...prev, 
        upcomingEarnings: error instanceof Error ? error.message : 'Failed to load earnings data' 
      }));
      setLoading(prev => ({ ...prev, upcomingEarnings: false }));
    }
  };

  const loadAnalysis = async (ticker: string) => {
    // Only load if earnings analysis is unlocked
    if (!unlockedComponents.earningsAnalysis) {
      return;
    }

    setLoading(prev => ({ ...prev, analysis: true }));
    setErrors(prev => ({ ...prev, analysis: null }));
    
    // Reset progress tracking for analysis
    setLoadingProgress?.(0);
    setLoadingStage?.(`Analyzing ${ticker} earnings...`);
    if (onLoadingProgressChange) {
      onLoadingProgressChange(0, `Analyzing ${ticker} earnings...`);
    }
    
    // Total steps in analysis loading process
    const totalSteps = 3;
    
    // Helper function to update progress
    const updateProgress = (step: number, stage: string) => {
      const progressPercentage = Math.round((step / totalSteps) * 100);
      setLoadingProgress?.(progressPercentage);
      setLoadingStage?.(stage);
      
      // Propagate to parent component if callback exists
      if (onLoadingProgressChange) {
        onLoadingProgressChange(progressPercentage, stage);
      }
    };
    
    try {
      // Step 1: Initialize analysis
      updateProgress(1, `Fetching historical data for ${ticker}...`);
      
      // Step 2: Perform analysis with timeout
      updateProgress(2, `Analyzing earnings surprises for ${ticker}...`);
      
      // Create abort controller for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, 30000); // 30 second timeout
      
      try {
        const analysis = await fetchEarningsAnalysisWithUserCache(
          ticker, 
          '1m', 
          false, 
          abortController.signal
        );
        
        clearTimeout(timeoutId);
        
        // Step 3: Complete analysis
        updateProgress(3, `Finalizing ${ticker} earnings analysis...`);
        setEarningsAnalysis(analysis);
        
        // Success - clear loading state
        setLoading(prev => ({ ...prev, analysis: false }));
        
        // Final progress update
        setLoadingProgress?.(100);
        setLoadingStage?.('Analysis complete');
        if (onLoadingProgressChange) {
          onLoadingProgressChange(100, 'Analysis complete');
        }
        
      } catch (apiError) {
        clearTimeout(timeoutId);
        
        // Handle specific error types
        if (abortController.signal.aborted) {
          throw new Error('Analysis request timed out. Please try again.');
        } else if (apiError instanceof Error && apiError.message.includes('404')) {
          throw new Error(`No earnings data available for ${ticker}`);
        } else if (apiError instanceof Error && apiError.message.includes('402')) {
          throw new Error('Insufficient credits for earnings analysis');
        } else {
          throw apiError;
        }
      }
      
    } catch (error) {
      console.error('Earnings analysis error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze earnings data';
      setErrors(prev => ({ 
        ...prev, 
        analysis: errorMessage
      }));
      
      // Always clear loading state on error
      setLoading(prev => ({ ...prev, analysis: false }));
      
      // Reset progress on error
      setLoadingProgress?.(0);
      setLoadingStage?.('Analysis failed');
      if (onLoadingProgressChange) {
        onLoadingProgressChange(0, `Analysis failed: ${errorMessage}`);
      }
    }
  };

  const refreshData = () => {
    loadData();
    
    if (selectedTicker && unlockedComponents.earningsAnalysis) {
      loadAnalysis(selectedTicker);
    }
  };

  const handleTimeRangeChange = (range: TimeRange) => {
    // Clear cached data when time range changes
    localStorage.removeItem('earnings_upcomingEarnings');
    localStorage.removeItem('earnings_lastFetchTime');
    
    // Reset state
    setUpcomingEarnings([]);
    setLastFetchTime(null);
    setEarningsAnalysis(null);
    setSelectedTicker(null);
    setErrors({ upcomingEarnings: null, analysis: null });
    
    // Update time range
    setTimeRange(range);
    
    // Trigger data loading only if user has access (session-controlled)
    loadData();
  };

  // Handle ticker selection with tier restrictions
  const handleTickerClick = (ticker: string) => {
    setSelectedTicker(ticker);
    
    if (!unlockedComponents.earningsAnalysis) {
      // Show tier limit dialog for analysis
      showTierLimitDialog(
        'Earnings Analysis',
        'Detailed earnings analysis is a Pro feature. Upgrade to access comprehensive company analysis, financial metrics, and professional insights.',
        'Unlock advanced earnings analysis, sector information, trading ranges, and detailed financial insights with HRVSTR Pro.',
        'general'
      );
      return;
    }
    
    // Load analysis for Pro+ users
    loadAnalysis(ticker);
  };

  // Component for locked overlays
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
        
        <h3 className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-white'} mb-2`}>
          {title}
        </h3>
        
        <p className={`${isLight ? 'text-gray-600' : 'text-gray-400'} mb-6 max-w-sm mx-auto`}>
          {description}
        </p>
        
        <div className={`${isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/20 border-blue-800'} rounded-lg p-4 border mb-6`}>
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <Zap className="w-4 h-4 text-blue-500" />
            <span className={isLight ? 'text-gray-900' : 'text-white'}>{cost} credits</span>
          </div>
        </div>
        
        <button
          onClick={() => handleUnlockComponent(componentKey, cost)}
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center mx-auto gap-2"
        >
          <Crown className="w-4 h-4" />
          Unlock for {cost} Credits
        </button>
      </div>
    </div>
  );

  // Handlers for unlocking individual components
  const handleUnlockComponent = async (component: keyof typeof unlockedComponents, cost: number) => {
    try {
      // Check if already unlocked using database-only approach
      const existingSession = await checkComponentAccess(component, currentTier);
      if (existingSession) {
        const timeRemaining = getSessionTimeRemainingFormatted(existingSession);
        info(`${component} already unlocked (${timeRemaining})`);
        return;
      }
      
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
        // RATE LIMITING FIX: Clear cache for this component to get fresh data
        clearComponentAccessCache(component);
        
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
        
        // Update active sessions
        const sessions = await getAllUnlockSessions();
        setActiveSessions(sessions);
        
        // Show appropriate toast message
        if (data.existingSession) {
          info(`${component} already unlocked (${data.timeRemaining}h remaining)`);
        } else {
          info(`${data.creditsUsed} credits used`);
        }
        
        // Refresh tier info to update usage meter
        if (refreshTierInfo) {
          await refreshTierInfo();
        }
      }
      
    } catch (error) {
      info(`Failed to unlock ${component}. Please try again.`);
    }
  };

  // Earnings Analysis Upgrade Card Component for free users
  const EarningsUpgradeCard: React.FC = () => {
    const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
    const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
    const gradientFrom = isLight ? 'from-blue-500' : 'from-blue-600';
    const gradientTo = isLight ? 'to-purple-600' : 'to-purple-700';
    const buttonBg = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';
    
    return (
      <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} text-center h-full flex flex-col justify-center`}>
        <div className={`w-16 h-16 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Lock className="w-8 h-8 text-white" />
        </div>
        
        <h3 className={`text-xl font-bold ${textColor} mb-2`}>
          Earnings Analysis
        </h3>
        
        <p className={`${subTextColor} mb-4 max-w-md mx-auto`}>
          Access comprehensive earnings analysis with performance metrics, risk assessment, and historical earnings data to enhance your investment research.
        </p>
        
        <div className={`${isLight ? 'bg-stone-200' : 'bg-gray-900'} rounded-lg p-4 mb-6`}>
          <h4 className={`font-semibold ${textColor} mb-2`}>Pro Features Include:</h4>
          <ul className={`text-sm ${subTextColor} space-y-1 text-left max-w-xs mx-auto`}>
            <li>• Earnings surprise analysis</li>
            <li>• Historical performance tracking</li>
            <li>• Risk assessment metrics</li>
            <li>• Company financial overview</li>
            <li>• Post-earnings drift analysis</li>
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
      <div className="flex flex-col h-full">
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
              className={`py-1 px-2 rounded text-sm ${cardBg} ${textColor} border ${cardBorder}`}
            >
              <option value="1d">Today</option>
              <option value="1w">This Week</option>
            </select>
            
            {/* Refresh button */}
            <button 
              onClick={refreshData}
              disabled={loading.upcomingEarnings || loading.analysis}
              className={`p-2 rounded-full transition-colors bg-blue-600 hover:bg-blue-700 text-white ${(loading.upcomingEarnings || loading.analysis) ? 'opacity-50' : ''}`}
              title="Refresh earnings data"
            >
              {(loading.upcomingEarnings || loading.analysis) ? (
                <Loader2 size={18} className="text-white animate-spin" />
              ) : (
                <RefreshCw size={18} className="text-white" />
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Earnings Table Column - Session-based unlocking like Analysis */}
          <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden`}>
            <div className={`p-4 border-b ${borderColor}`}>
              <h2 className={`text-lg font-semibold ${textColor}`}>Upcoming Earnings</h2>
            </div>
            <div className="p-4">
              {/* FIX: Make upcoming earnings section consistent with analysis section */}
              {currentTier === 'free' ? (
                <EarningsUpgradeCard />
              ) : !unlockedComponents.earningsAnalysis ? (
                // Pro+ users without unlock get credit unlock option for upcoming earnings too
                <LockedOverlay
                  title="Upcoming Earnings"
                  description="Unlock access to upcoming earnings events and analysis data."
                  cost={COMPONENT_COSTS.earningsAnalysis}
                  componentKey="earningsAnalysis"
                  icon={<BarChart2 className="w-8 h-8 text-white" />}
                />
              ) : loading.upcomingEarnings ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Loader2 className="mb-3 text-blue-500 animate-spin" size={32} />
                  <p className={`text-lg font-semibold ${textColor} mb-2`}>{loadingStage}</p>
                  <div className="w-full max-w-sm mt-4 mb-2">
                    <ProgressBar progress={loadingProgress} />
                  </div>
                  <div className="text-xs text-blue-400">{loadingProgress}% complete</div>
                </div>
              ) : errors.upcomingEarnings ? (
                <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                  <AlertTriangle className="mb-2 text-yellow-500" size={32} />
                  <p>{errors.upcomingEarnings}</p>
                </div>
              ) : upcomingEarnings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className={`min-w-full ${textColor}`}>
                    <thead className={`${tableHeaderBg} ${borderColor}`}>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Ticker</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Company</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderColor}`}>
                      {sortedEarnings.filter((earnings) => {
                        // Final UI-level validation - filter out any invalid tickers
                        if (!earnings.ticker || typeof earnings.ticker !== 'string' || earnings.ticker.trim() === '') {
                          return false;
                        }
                        return true;
                      }).map((earnings, index) => {
                        // Defensive check for any remaining edge cases
                        if (!earnings.ticker || typeof earnings.ticker !== 'string' || earnings.ticker.trim() === '') {
                          // Skip rendering this item
                          return null;
                        }
                        
                        return (
                          <tr 
                            key={`earnings-${earnings.ticker}-${index}`} 
                            className={`${hoverBg} ${selectedTicker === earnings.ticker ? selectedBg : ''} cursor-pointer transition-colors`}
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

          {/* Earnings Analysis Column - Session-based unlocking */}
          <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden`}>
            <div className={`p-4 border-b ${borderColor}`}>
              <h2 className={`text-lg font-semibold ${textColor}`}>
                {selectedTicker ? `${selectedTicker} Earnings Analysis` : 'Earnings Analysis'}
              </h2>
            </div>
            <div className="p-4">
              {/* Check tier first - free users should see upgrade card, not unlock option */}
              {currentTier === 'free' ? (
                <EarningsUpgradeCard />
              ) : !unlockedComponents.earningsAnalysis ? (
                // Pro+ users without unlock get credit unlock option
                <LockedOverlay
                  title="Earnings Analysis"
                  description="Unlock comprehensive earnings analysis with performance metrics, risk assessment, and historical earnings data."
                  cost={COMPONENT_COSTS.earningsAnalysis}
                  componentKey="earningsAnalysis"
                  icon={<BarChart2 className="w-8 h-8 text-white" />}
                />
              ) : (
                <>
                  {!selectedTicker ? (
                    <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                      <Info className="mb-2" size={32} />
                      <p>Select a ticker from the table to view earnings analysis</p>
                    </div>
                  ) : loading.analysis ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Loader2 className="mb-3 text-blue-500 animate-spin" size={32} />
                      <p className={`text-lg font-semibold ${textColor} mb-2`}>{loadingStage}</p>
                      <div className="w-full max-w-sm mt-4 mb-2">
                        <ProgressBar progress={loadingProgress} />
                      </div>
                      <div className="text-xs text-blue-400">{loadingProgress}% complete</div>
                    </div>
                  ) : errors.analysis ? (
                    <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                      <AlertTriangle className="mb-2 text-yellow-500" size={32} />
                      <p>{errors.analysis}</p>
                    </div>
                  ) : earningsAnalysis ? (
                    <div className="space-y-4">
                      {/* Company Information */}
                      <div className={`${analysisBg} rounded-lg p-4`}>
                        <div className="flex items-center space-x-2 mb-3">
                          <BarChart2 size={20} className="text-blue-400" />
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
                      <div className={`${analysisBg} rounded-lg p-4`}>
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

                      {/* Earnings Performance Metrics */}
                      {(earningsAnalysis.historicalEarningsCount ?? 0) > 0 && (
                        <div className={`${analysisBg} rounded-lg p-4`}>
                          <div className="flex items-center space-x-2 mb-3">
                            <TrendingDown size={20} className="text-purple-400" />
                            <span className="text-sm font-medium">Earnings Performance</span>
                            <span className={`text-xs px-2 py-1 rounded ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-900 text-blue-300'}`}>
                              {earningsAnalysis.historicalEarningsCount} quarters
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Beat Frequency:</span>
                                <span className={
                                  (earningsAnalysis.beatFrequency ?? 0) >= 70 ? 'text-green-500 font-medium' :
                                  (earningsAnalysis.beatFrequency ?? 0) >= 50 ? 'text-yellow-500 font-medium' :
                                  'text-red-500 font-medium'
                                }>
                                  {earningsAnalysis.beatFrequency !== null && earningsAnalysis.beatFrequency !== undefined ? `${earningsAnalysis.beatFrequency}%` : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Avg Surprise:</span>
                                <span className={
                                  (earningsAnalysis.averageSurprise ?? 0) > 0 ? 'text-green-500 font-medium' :
                                  (earningsAnalysis.averageSurprise ?? 0) < 0 ? 'text-red-500 font-medium' :
                                  isLight ? 'text-stone-900 font-medium' : 'text-white font-medium'
                                }>
                                  {earningsAnalysis.averageSurprise !== null && earningsAnalysis.averageSurprise !== undefined
                                    ? `${(earningsAnalysis.averageSurprise ?? 0) > 0 ? '+' : ''}${earningsAnalysis.averageSurprise.toFixed(2)}%`
                                    : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Consistency:</span>
                                <span className={
                                  (earningsAnalysis.consistency ?? 0) >= 70 ? 'text-green-500 font-medium' :
                                  (earningsAnalysis.consistency ?? 0) >= 50 ? 'text-yellow-500 font-medium' :
                                  'text-red-500 font-medium'
                                }>
                                  {earningsAnalysis.consistency !== null && earningsAnalysis.consistency !== undefined ? `${earningsAnalysis.consistency.toFixed(1)}%` : 'N/A'}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Latest Surprise:</span>
                                <span className={
                                  (earningsAnalysis.latestEarnings?.surprise ?? 0) > 0 ? 'text-green-500 font-medium' :
                                  (earningsAnalysis.latestEarnings?.surprise ?? 0) < 0 ? 'text-red-500 font-medium' :
                                  isLight ? 'text-stone-900 font-medium' : 'text-white font-medium'
                                }>
                                  {earningsAnalysis.latestEarnings?.surprise !== null && earningsAnalysis.latestEarnings?.surprise !== undefined
                                    ? `${(earningsAnalysis.latestEarnings?.surprise ?? 0) > 0 ? '+' : ''}${earningsAnalysis.latestEarnings.surprise.toFixed(2)}%`
                                    : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Surprise Magnitude:</span>
                                <span className={isLight ? 'text-stone-900 font-medium' : 'text-white font-medium'}>
                                  {earningsAnalysis.latestEarnings?.magnitude !== null && earningsAnalysis.latestEarnings?.magnitude !== undefined
                                    ? `${earningsAnalysis.latestEarnings.magnitude.toFixed(2)}%`
                                    : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Post-Earnings Drift:</span>
                                <span className={
                                  (earningsAnalysis.postEarningsDrift ?? 0) > 0 ? 'text-green-500 font-medium' :
                                  (earningsAnalysis.postEarningsDrift ?? 0) < 0 ? 'text-red-500 font-medium' :
                                  isLight ? 'text-stone-900 font-medium' : 'text-white font-medium'
                                }>
                                  {earningsAnalysis.postEarningsDrift !== null && earningsAnalysis.postEarningsDrift !== undefined
                                    ? `${(earningsAnalysis.postEarningsDrift ?? 0) > 0 ? '+' : ''}${earningsAnalysis.postEarningsDrift.toFixed(2)}%`
                                    : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Risk Assessment */}
                      <div className={`${analysisBg} rounded-lg p-4`}>
                        <div className="flex items-center space-x-2 mb-3">
                          <AlertTriangle size={20} className="text-orange-400" />
                          <span className="text-sm font-medium">Risk Assessment</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className={isLight ? 'text-stone-700' : 'text-gray-300'}>Risk Level:</span>
                            <span className={
                              earningsAnalysis.riskLevel === 'Low' ? 'text-green-500 font-medium' :
                              earningsAnalysis.riskLevel === 'Medium' ? 'text-yellow-500 font-medium' :
                              earningsAnalysis.riskLevel === 'High' ? 'text-red-500 font-medium' :
                              isLight ? 'text-stone-900 font-medium' : 'text-white font-medium'
                            }>
                              {earningsAnalysis.riskLevel || 'N/A'}
                            </span>
                          </div>
                          {earningsAnalysis.dataLimitations && earningsAnalysis.dataLimitations.length > 0 && (
                            <div className="mt-3">
                              <span className={`text-xs ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>Data Limitations:</span>
                              <ul className={`text-xs mt-1 space-y-1 ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
                                {earningsAnalysis.dataLimitations.map((limitation, index) => (
                                  <li key={index}>• {limitation}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Data Sources */}
                      {earningsAnalysis.dataSources && (
                        <div className={`text-xs ${isLight ? 'text-stone-500' : 'text-gray-500'} mt-2`}>
                          <span>Data Sources: {earningsAnalysis.dataSources.join(', ')}</span>
                          {earningsAnalysis.timestamp && (
                            <span className="ml-2">
                              • Updated: {new Date(earningsAnalysis.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                      <Info className="mb-2" size={32} />
                      <p>Select a ticker to view earnings analysis</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <TierLimitDialog
        isOpen={tierLimitDialog.isOpen}
        onClose={closeTierLimitDialog}
        featureName={tierLimitDialog.featureName}
        message={tierLimitDialog.message}
        upgradeMessage={tierLimitDialog.upgradeMessage}
        currentTier={tierInfo?.tier || 'Free'}
        context={tierLimitDialog.context}
      />
    </>
  );
};

export default EarningsMonitor;