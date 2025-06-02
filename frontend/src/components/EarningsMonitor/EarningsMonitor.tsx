import React, { useState, useEffect } from 'react';
import { TimeRange } from '../../types';
import { EarningsEvent, EarningsAnalysis, analyzeEarningsSurprise, fetchUpcomingEarningsWithProgress, ProgressUpdate } from '../../services/earningsService';
import { RefreshCw, AlertTriangle, Info, TrendingUp, TrendingDown, BarChart2, Loader2, Crown, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { useToast } from '../../contexts/ToastContext';
import { 
  checkUnlockSession, 
  storeUnlockSession, 
  getAllUnlockSessions,
  getSessionTimeRemainingFormatted 
} from '../../utils/sessionStorage';
import ProgressBar from '../ProgressBar';

interface EarningsMonitorProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
}

const EarningsMonitor: React.FC<EarningsMonitorProps> = ({ onLoadingProgressChange }) => {
  const { theme } = useTheme();
  const { tierInfo, refreshTierInfo } = useTier();
  const { info } = useToast();
  const isLight = theme === 'light';
  
  // Component unlock state - session-based
  const [unlockedComponents, setUnlockedComponents] = useState<{
    earningsTable: boolean;
    earningsAnalysis: boolean;
  }>({
    earningsTable: false,
    earningsAnalysis: false
  });
  
  // Check for existing unlock sessions on mount
  useEffect(() => {
    const checkExistingSessions = () => {
      const tableSession = checkUnlockSession('earningsTable');
      const analysisSession = checkUnlockSession('earningsAnalysis');

      setUnlockedComponents({
        earningsTable: !!tableSession,
        earningsAnalysis: !!analysisSession
      });

      // Update active sessions for display
      getAllUnlockSessions();
      
      if (tableSession || analysisSession) {
        // Session restoration logging removed for production
      }
    };

    checkExistingSessions();

    // Check for expired sessions every minute
    const interval = setInterval(checkExistingSessions, 60000);
    return () => clearInterval(interval);
  }, []);

  // Credit costs for each component
  const COMPONENT_COSTS = {
    earningsTable: 6,      // Upcoming earnings data
    earningsAnalysis: 10,  // Detailed company analysis
  };

  // Handlers for unlocking individual components
  const handleUnlockComponent = async (component: keyof typeof unlockedComponents, cost: number) => {
    // Check if already unlocked in current session
    const existingSession = checkUnlockSession(component);
    if (existingSession) {
      const timeRemaining = getSessionTimeRemainingFormatted(existingSession);
      info(`${component} already unlocked (${timeRemaining})`);
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
        
        // Store session in localStorage
        storeUnlockSession(component, {
          sessionId: data.sessionId,
          expiresAt: data.expiresAt,
          creditsUsed: data.creditsUsed,
          tier: tierInfo?.tier || 'free'
        });
        
        // Update active sessions
        getAllUnlockSessions();
        
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

        // Auto-load data for newly unlocked components
        if (component === 'earningsTable') {
          loadData();
        } else if (component === 'earningsAnalysis' && selectedTicker) {
          loadAnalysis(selectedTicker);
        }
      }
      
    } catch (error) {
      console.error(`Error unlocking ${component}:`, error);
      info(`Failed to unlock ${component}. Please try again.`);
    }
  };
  
  // Theme specific styling
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const tableHeaderBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-300'; // Improved contrast for dark mode
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const hoverBg = isLight ? 'hover:bg-stone-200' : 'hover:bg-gray-800';
  const selectedBg = isLight ? 'bg-blue-100' : 'bg-blue-900/30'; // Background for selected items
  const analysisBg = isLight ? 'bg-stone-200' : 'bg-gray-800/90'; // Lighter background in light mode for better contrast
  
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');
  const [loading, setLoading] = useState({
    upcomingEarnings: false, // Start with false, will be set based on cache freshness
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
    
    // Set initial loading state based on cache freshness and unlock status
    if (unlockedComponents.earningsTable && needsRefresh) {
      setLoading(prev => ({ ...prev, upcomingEarnings: true }));
    } else if (unlockedComponents.earningsTable && !needsRefresh) {
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
  }, [timeRange, unlockedComponents.earningsTable]);

  const sortEarnings = (earnings: EarningsEvent[]): EarningsEvent[] => {
    // Since we removed sorting functionality, just return the earnings as-is
    // sorted by report date ascending by default
    return [...earnings].sort((a, b) => {
      const aDate = new Date(a.reportDate).getTime();
      const bDate = new Date(b.reportDate).getTime();
      return aDate - bDate;
    });
  };

  const sortedEarnings = React.useMemo(() => {
    return sortEarnings(upcomingEarnings);
  }, [upcomingEarnings]);

  const loadData = async () => {
    // Only load if earnings table is unlocked
    if (!unlockedComponents.earningsTable) {
      return;
    }

    // Check if we have fresh cached data
    const hasData = upcomingEarnings.length > 0;
    const dataIsStale = isDataStale(lastFetchTime);

    // If we have fresh data, no need to fetch
    if (hasData && !dataIsStale) {
      setLoading(prev => ({ ...prev, upcomingEarnings: false }));
      return;
    }

    setLoading({
      upcomingEarnings: true,
      analysis: false
    });
    
    setErrors({
      upcomingEarnings: null,
      analysis: null
    });
    
    // Reset progress tracking
    setLoadingProgress(0);
    setLoadingStage('Starting earnings scraping...');
    if (onLoadingProgressChange) {
      onLoadingProgressChange(0, 'Starting earnings scraping...');
    }
    
    try {
      // Use the new progress tracking system
      const earnings = await fetchUpcomingEarningsWithProgress(
        timeRange,
        (progress: ProgressUpdate) => {
          // Update progress with real-time information from backend
          setLoadingProgress(progress.percent);
          setLoadingStage(progress.message);
          
          if (onLoadingProgressChange) {
            onLoadingProgressChange(progress.percent, progress.message);
          }
          
          if (progress.currentDate) {
            // Progress logging removed for production
          }
        }
      );
      
      setUpcomingEarnings(earnings);
      setLastFetchTime(Date.now());
      setLoading(prev => ({ ...prev, upcomingEarnings: false }));
      
      // Final progress update
      setLoadingProgress(100);
      setLoadingStage(`Completed! Found ${earnings.length} earnings events`);
      if (onLoadingProgressChange) {
        onLoadingProgressChange(100, `Completed! Found ${earnings.length} earnings events`);
      }
      
    } catch (error) {
      console.error('Upcoming earnings error:', error);
      setErrors(prev => ({ 
        ...prev, 
        upcomingEarnings: error instanceof Error ? error.message : 'Failed to fetch upcoming earnings data' 
      }));
      setLoading(prev => ({ ...prev, upcomingEarnings: false }));
      
      // Error progress update
      setLoadingProgress(0);
      setLoadingStage('Failed to load earnings data');
      if (onLoadingProgressChange) {
        onLoadingProgressChange(0, 'Failed to load earnings data');
      }
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
      
      // Step 2: Perform analysis
      updateProgress(2, `Analyzing earnings surprises for ${ticker}...`);
      const analysis = await analyzeEarningsSurprise(ticker);
      
      // Step 3: Complete analysis
      updateProgress(3, `Finalizing ${ticker} earnings analysis...`);
      setEarningsAnalysis(analysis);
      setLoading(prev => ({ ...prev, analysis: false }));
    } catch (error) {
      console.error('Earnings analysis error:', error);
      setErrors(prev => ({ 
        ...prev, 
        analysis: error instanceof Error ? error.message : 'Failed to analyze earnings data' 
      }));
      setLoading(prev => ({ ...prev, analysis: false }));
    }
  };

  const refreshData = () => {
    // Clear cached data to force fresh fetch
    localStorage.removeItem('earnings_upcomingEarnings');
    localStorage.removeItem('earnings_lastFetchTime');
    
    // Reset cached data in state
    setUpcomingEarnings([]);
    setLastFetchTime(null);
    
    // Clear any existing errors
    setErrors({
      upcomingEarnings: null,
      analysis: null
    });
    
    // Force fresh data load
    loadData();
    
    if (selectedTicker && unlockedComponents.earningsAnalysis) {
      loadAnalysis(selectedTicker);
    }
  };

  // Handle time range changes
  const handleTimeRangeChange = (range: TimeRange) => {
    // Update the time range state
    setTimeRange(range);
    
    // Clear cached data when time range changes to force fresh fetch
    localStorage.removeItem('earnings_upcomingEarnings');
    localStorage.removeItem('earnings_lastFetchTime');
    
    // Reset cached data in state
    setUpcomingEarnings([]);
    setLastFetchTime(null);
    
    // Clear any existing errors
    setErrors({
      upcomingEarnings: null,
      analysis: null
    });
    
    // Trigger fresh data loading if unlocked
    if (unlockedComponents.earningsTable) {
      loadData();
    }
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
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center mx-auto gap-2"
        >
          <Crown className="w-4 h-4" />
          Unlock for {cost} Credits
        </button>
      </div>
    </div>
  );

  return (
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
            disabled={loading.upcomingEarnings || loading.analysis || !(unlockedComponents.earningsTable || unlockedComponents.earningsAnalysis)}
            className={`p-2 rounded-full transition-colors ${
              // Show different styling based on unlock state
              (unlockedComponents.earningsTable || unlockedComponents.earningsAnalysis)
                ? 'bg-blue-600 hover:bg-blue-700 text-white' // Unlocked: normal blue
                : 'bg-gray-400 cursor-not-allowed text-gray-200' // Locked: grayed out
            } ${(loading.upcomingEarnings || loading.analysis) ? 'opacity-50' : ''}`}
            title={
              (unlockedComponents.earningsTable || unlockedComponents.earningsAnalysis)
                ? 'Refresh earnings data'
                : 'Unlock components to refresh data'
            }
          >
            {/* Only show spinner if components are unlocked AND loading */}
            {(unlockedComponents.earningsTable || unlockedComponents.earningsAnalysis) && (loading.upcomingEarnings || loading.analysis) ? (
              <Loader2 size={18} className="text-white animate-spin" />
            ) : (
              <RefreshCw size={18} className={
                // Gray icon when locked, white when unlocked
                !(unlockedComponents.earningsTable || unlockedComponents.earningsAnalysis)
                  ? 'text-gray-200' 
                  : 'text-white'
              } />
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings Table Column */}
        <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden`}>
          <div className={`p-4 border-b ${borderColor}`}>
            <h2 className={`text-lg font-semibold ${textColor}`}>Upcoming Earnings</h2>
          </div>
          <div className="p-4">
            {unlockedComponents.earningsTable ? (
              <>
            {loading.upcomingEarnings ? (
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
                    {sortedEarnings
                      .filter((earnings) => {
                        // Final UI-level validation - filter out any invalid tickers
                        if (!earnings.ticker || typeof earnings.ticker !== 'string' || earnings.ticker.trim() === '') {
                          return false;
                        }
                        return true;
                      })
                      .map((earnings, index) => {
                      // Defensive check for any remaining edge cases
                      if (!earnings.ticker || typeof earnings.ticker !== 'string' || earnings.ticker.trim() === '') {
                        // Skip rendering this item
                        return null;
                      }
                      
                      return (
                        <tr 
                          key={`earnings-${earnings.ticker}-${index}`} 
                          className={`${hoverBg} ${selectedTicker === earnings.ticker ? selectedBg : ''} cursor-pointer transition-colors`}
                          onClick={() => {
                            // Validate ticker before processing
                            if (earnings.ticker && typeof earnings.ticker === 'string' && earnings.ticker.trim() !== '') {
                              setSelectedTicker(earnings.ticker);
                              if (unlockedComponents.earningsAnalysis) {
                                loadAnalysis(earnings.ticker);
                              }
                            } else {
                              console.warn('Invalid ticker symbol:', earnings.ticker);
                            }
                          }}
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
                    }).filter(Boolean)} {/* Remove any null entries */}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                <Info className="mb-2" size={32} />
                <p>No upcoming earnings found in the selected time range</p>
              </div>
            )}
              </>
            ) : (
              <LockedOverlay
                title="Upcoming Earnings"
                description="Access real-time upcoming earnings calendar with company names, ticker symbols, and report dates across multiple timeframes."
                cost={COMPONENT_COSTS.earningsTable}
                componentKey="earningsTable"
                icon={<BarChart2 className="w-8 h-8 text-white" />}
              />
            )}
          </div>
        </div>

        {/* Earnings Analysis Column */}
        <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden`}>
          <div className={`p-4 border-b ${borderColor}`}>
            <h2 className={`text-lg font-semibold ${textColor}`}>
              {selectedTicker ? `${selectedTicker} Earnings Analysis` : 'Earnings Analysis'}
            </h2>
          </div>
          <div className="p-4">
            {unlockedComponents.earningsAnalysis ? (
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`${analysisBg} rounded-lg p-4`}>
                    <div className="flex items-center space-x-2 mb-2">
                      <BarChart2 size={20} className="text-blue-400" />
                      <span className="text-sm font-medium">Financial Metrics</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Current Price:</span>
                        <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                          {earningsAnalysis.currentPrice !== null 
                            ? `$${earningsAnalysis.currentPrice.toFixed(2)}`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Price Change:</span>
                        <span className={
                          earningsAnalysis.priceChangePercent === null
                            ? isLight ? 'text-stone-600' : 'text-gray-400'
                            : earningsAnalysis.priceChangePercent > 0 
                              ? 'text-green-500' 
                              : 'text-red-500'
                        }>
                          {earningsAnalysis.priceChangePercent !== null
                            ? `${earningsAnalysis.priceChangePercent > 0 ? '+' : ''}${earningsAnalysis.priceChangePercent.toFixed(2)}%`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Market Cap:</span>
                        <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                          {earningsAnalysis.marketCap !== null
                            ? `$${(earningsAnalysis.marketCap / 1e9).toFixed(2)}B`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>P/E Ratio:</span>
                        <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                          {earningsAnalysis.pe !== null
                            ? earningsAnalysis.pe.toFixed(1)
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={`${analysisBg} rounded-lg p-4`}>
                    <div className="flex items-center space-x-2 mb-2">
                      {earningsAnalysis.priceChangePercent && earningsAnalysis.priceChangePercent > 0 ? (
                        <TrendingUp size={20} className="text-green-500" />
                      ) : (
                        <TrendingDown size={20} className="text-red-500" />
                      )}
                      <span className="text-sm font-medium">Company & Trading Info</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Sector:</span>
                        <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                          {earningsAnalysis.sector || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>Day Range:</span>
                        <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                          {earningsAnalysis.dayLow !== null && earningsAnalysis.dayHigh !== null
                            ? `$${earningsAnalysis.dayLow.toFixed(2)} - $${earningsAnalysis.dayHigh.toFixed(2)}`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>52W Range:</span>
                        <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                          {earningsAnalysis.yearLow !== null && earningsAnalysis.yearHigh !== null
                            ? `$${earningsAnalysis.yearLow.toFixed(2)} - $${earningsAnalysis.yearHigh.toFixed(2)}`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isLight ? 'text-stone-800 font-medium' : 'text-gray-200 font-medium'}>EPS:</span>
                        <span className={isLight ? 'text-blue-700 font-medium' : 'text-blue-300 font-medium'}>
                          {earningsAnalysis.eps !== null
                            ? `$${earningsAnalysis.eps.toFixed(2)}`
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`${analysisBg} rounded-lg p-4`}>
                  <h3 className="text-sm font-medium mb-2">Analysis Summary</h3>
                  <p className={`${isLight ? 'text-stone-800' : 'text-gray-200'} text-sm`}>
                    {earningsAnalysis.companyName} ({earningsAnalysis.sector}) 
                    {earningsAnalysis.analysisScore !== undefined && earningsAnalysis.riskLevel ? (
                      <>
                        {' '}has an analysis score of <span className="text-blue-500 font-medium">{earningsAnalysis.analysisScore}</span>
                        {' '}with a <span className={
                          earningsAnalysis.riskLevel === 'High' ? 'text-red-500' :
                          earningsAnalysis.riskLevel === 'Medium' ? 'text-yellow-500' : 'text-green-500'
                        }>{earningsAnalysis.riskLevel}</span> risk level.
                      </>
                    ) : ''}
                    {earningsAnalysis.dataLimitations && earningsAnalysis.dataLimitations.length > 0 && (
                      <>
                        {' '}
                        <span className={isLight ? 'text-stone-600' : 'text-gray-400'}>
                          Note: {earningsAnalysis.dataLimitations.join(', ')}.
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center p-10 ${subTextColor} text-center`}>
                <Info className="mb-2" size={32} />
                <p>Select a ticker to view earnings analysis</p>
              </div>
            )}
              </>
            ) : (
              <LockedOverlay
                title="Earnings Analysis"
                description="Unlock detailed company analysis including financial metrics, trading ranges, sector information, and professional earnings insights."
                cost={COMPONENT_COSTS.earningsAnalysis}
                componentKey="earningsAnalysis"
                icon={<TrendingUp className="w-8 h-8 text-white" />}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EarningsMonitor;