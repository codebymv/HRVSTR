import React, { useState, useEffect } from 'react';
import { TimeRange } from '../../types';
import { clearSecCache, fetchSecDataParallel } from '../../services/api';
import { RefreshCw, Loader2, Crown, Lock, Zap } from 'lucide-react';
import ProgressBar from '../ProgressBar';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import { useToast } from '../../contexts/ToastContext';
import { 
  checkUnlockSession, 
  storeUnlockSession, 
  getAllUnlockSessions,
  getSessionTimeRemainingFormatted 
} from '../../utils/sessionStorage';
import InsiderTradesTab from './InsiderTradesTab.tsx';
import InstitutionalHoldingsTab from './InstitutionalHoldingsTab.tsx';
import TierLimitDialog from '../UI/TierLimitDialog';

interface SECFilingsDashboardProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
}

const SECFilingsDashboard: React.FC<SECFilingsDashboardProps> = ({ 
  onLoadingProgressChange 
}) => {
  const { theme } = useTheme();
  const { tierInfo, refreshTierInfo } = useTier();
  const { showTierLimitDialog, tierLimitDialog, closeTierLimitDialog } = useTierLimits();
  const { info } = useToast();
  const isLight = theme === 'light';
  
  // Theme specific styling
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const tabActiveBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  const tabInactiveBg = isLight ? 'bg-stone-300/70' : 'bg-gray-800/50';
  const tabActiveText = isLight ? 'text-stone-900' : 'text-white';
  const tabInactiveText = isLight ? 'text-stone-600' : 'text-gray-400';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  
  // Tier access logic
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  const hasInstitutionalAccess = currentTier !== 'free'; // Pro+ feature
  
  // Component unlock state - session-based
  const [unlockedComponents, setUnlockedComponents] = useState<{
    insiderTrading: boolean;
    institutionalHoldings: boolean;
  }>({
    insiderTrading: false,
    institutionalHoldings: false
  });

  // Session state for time tracking
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  
  // Check for existing unlock sessions on mount
  useEffect(() => {
    const checkExistingSessions = () => {
      const insiderSession = checkUnlockSession('insiderTrading');
      const institutionalSession = checkUnlockSession('institutionalHoldings');

      setUnlockedComponents({
        insiderTrading: !!insiderSession,
        institutionalHoldings: !!institutionalSession
      });

      // Update active sessions for display
      const sessions = getAllUnlockSessions();
      setActiveSessions(sessions);
      
      if (insiderSession || institutionalSession) {
        console.log('🔓 Restored SEC filings unlock sessions:', {
          insiderTrading: insiderSession ? getSessionTimeRemainingFormatted(insiderSession) : 'Locked',
          institutionalHoldings: institutionalSession ? getSessionTimeRemainingFormatted(institutionalSession) : 'Locked'
        });
      }
    };

    checkExistingSessions();

    // Check for expired sessions every minute
    const interval = setInterval(checkExistingSessions, 60000);
    return () => clearInterval(interval);
  }, []);

  // Credit costs for each component
  const COMPONENT_COSTS = {
    insiderTrading: 8,          // Insider trading data
    institutionalHoldings: 12,  // Institutional holdings data (13F filings)
  };

  // Handlers for unlocking individual components
  const handleUnlockComponent = async (component: keyof typeof unlockedComponents, cost: number) => {
    console.log(`🔓 Attempting to unlock ${component} for ${cost} credits`);
    
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
        const sessions = getAllUnlockSessions();
        setActiveSessions(sessions);
        
        // Show appropriate toast message
        if (data.existingSession) {
          info(`${component} already unlocked (${data.timeRemaining}h remaining)`);
        } else {
          info(`${data.creditsUsed} credits used`);
          console.log(`💳 Component unlocked successfully:`, {
            component,
            creditsUsed: data.creditsUsed,
            sessionDuration: data.sessionDurationHours,
            creditsRemaining: data.creditsRemaining
          });
        }
        
        // Refresh tier info to update usage meter
        if (refreshTierInfo) {
          await refreshTierInfo();
        }

        // Auto-trigger data refresh for newly unlocked components
        if (component === 'insiderTrading' && activeTab === 'insider') {
          console.log('🔓 Insider trading unlocked - refreshing data automatically');
          handleRefresh();
        } else if (component === 'institutionalHoldings' && activeTab === 'institutional') {
          console.log('🔓 Institutional holdings unlocked - refreshing data automatically');
          handleRefresh();
        }
      }
      
    } catch (error) {
      console.error(`Error unlocking ${component}:`, error);
      info(`Failed to unlock ${component}. Please try again.`);
    }
  };
  
  // Shared state between tabs
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    try {
      const saved = localStorage.getItem('secFilings_timeRange') as TimeRange;
      return saved && ['1d', '1w', '1m', '3m', '6m', '1y'].includes(saved) ? saved : ('1w' as TimeRange);
    } catch (e) {
      return '1w' as TimeRange;
    }
  });
  const [activeTab, setActiveTab] = useState<'insider' | 'institutional'>(() => {
    try {
      const saved = localStorage.getItem('secFilings_activeTab') as 'insider' | 'institutional';
      // If user doesn't have institutional access and saved tab is institutional, default to insider
      if (!hasInstitutionalAccess && saved === 'institutional') {
        return 'insider';
      }
      return saved || 'insider';
    } catch (e) {
      return 'insider';
    }
  });
  
  // Helper function to check if data is stale (older than 30 minutes)
  const isDataStale = (timestamp: number | null): boolean => {
    if (!timestamp) return true;
    const thirtyMinutesInMs = 30 * 60 * 1000;
    return Date.now() - timestamp > thirtyMinutesInMs;
  };

  // Cached data state with localStorage persistence
  const [insiderTradesData, setInsiderTradesData] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('secFilings_insiderTrades');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.error('Error loading cached insider trades:', e);
      return [];
    }
  });
  
  const [institutionalHoldingsData, setInstitutionalHoldingsData] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('secFilings_institutionalHoldings');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.error('Error loading cached institutional holdings:', e);
      return [];
    }
  });
  
  // Track the last fetch time for each data type
  const [lastFetchTime, setLastFetchTime] = useState<{
    insiderTrades: number | null,
    institutionalHoldings: number | null
  }>(() => {
    try {
      const cached = localStorage.getItem('secFilings_lastFetchTime');
      return cached ? JSON.parse(cached) : { insiderTrades: null, institutionalHoldings: null };
    } catch (e) {
      console.error('Error loading cached fetch times:', e);
      return { insiderTrades: null, institutionalHoldings: null };
    }
  });
  
  // Combined loading and data freshness state - simplified to prevent race conditions
  const [loadingState, setLoadingState] = useState<{
    insiderTrades: { isLoading: boolean; needsRefresh: boolean };
    institutionalHoldings: { isLoading: boolean; needsRefresh: boolean };
  }>(() => {
    const insiderNeedsRefresh = insiderTradesData.length === 0 || isDataStale(lastFetchTime.insiderTrades);
    // Only check institutional refresh for users with access
    const institutionalNeedsRefresh = hasInstitutionalAccess && (institutionalHoldingsData.length === 0 || isDataStale(lastFetchTime.institutionalHoldings));
    
    console.log('🔄 DASHBOARD: Initial loading state calculation', {
      insiderDataLength: insiderTradesData.length,
      institutionalDataLength: institutionalHoldingsData.length,
      insiderLastFetch: lastFetchTime.insiderTrades,
      institutionalLastFetch: lastFetchTime.institutionalHoldings,
      insiderStale: isDataStale(lastFetchTime.insiderTrades),
      institutionalStale: isDataStale(lastFetchTime.institutionalHoldings),
      insiderNeedsRefresh,
      institutionalNeedsRefresh,
      hasInstitutionalAccess,
      currentTier
    });
    
    return {
      insiderTrades: { 
        isLoading: insiderNeedsRefresh, 
        needsRefresh: insiderNeedsRefresh 
      },
      institutionalHoldings: { 
        isLoading: institutionalNeedsRefresh, 
        needsRefresh: institutionalNeedsRefresh 
      }
    };
  });
  
  // Error state
  const [errors, setErrors] = useState({
    insiderTrades: null as string | null,
    institutionalHoldings: null as string | null
  });
  
  // Overall progress tracking for better UX
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  
  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (insiderTradesData.length > 0) {
      localStorage.setItem('secFilings_insiderTrades', JSON.stringify(insiderTradesData));
    }
  }, [insiderTradesData]);
  
  useEffect(() => {
    if (institutionalHoldingsData.length > 0) {
      localStorage.setItem('secFilings_institutionalHoldings', JSON.stringify(institutionalHoldingsData));
    }
  }, [institutionalHoldingsData]);
  
  // Save last fetch times to localStorage
  useEffect(() => {
    localStorage.setItem('secFilings_lastFetchTime', JSON.stringify(lastFetchTime));
  }, [lastFetchTime]);
  
  // Save time range and active tab preference
  useEffect(() => {
    localStorage.setItem('secFilings_timeRange', timeRange);
  }, [timeRange]);
  
  useEffect(() => {
    localStorage.setItem('secFilings_activeTab', activeTab);
  }, [activeTab]);
  
  // BACKUP: Monitor loading states and clear refresh state when all loading is complete
  useEffect(() => {
    if (isRefreshing) {
      const insiderDone = !loadingState.insiderTrades.isLoading;
      const institutionalDone = !hasInstitutionalAccess || !loadingState.institutionalHoldings.isLoading;
      
      console.log('🔄 BACKUP: Checking loading states:', { 
        isRefreshing, 
        insiderDone, 
        institutionalDone, 
        hasInstitutionalAccess,
        insiderLoading: loadingState.insiderTrades.isLoading,
        institutionalLoading: loadingState.institutionalHoldings.isLoading
      });
      
      if (insiderDone && institutionalDone) {
        console.log('🔄 BACKUP: All loading complete, clearing refresh state via useEffect');
        // Clear refresh state immediately - no delay needed
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing, loadingState.insiderTrades.isLoading, loadingState.institutionalHoldings.isLoading, hasInstitutionalAccess]);
  
  // Additional safety mechanism - clear refresh state after 5 seconds maximum
  useEffect(() => {
    if (isRefreshing) {
      const timeout = setTimeout(() => {
        console.warn('🔄 SAFETY: Force clearing refresh state after 5 seconds');
        setIsRefreshing(false);
      }, 5000); // Reduced from 10 seconds to 5 seconds
      
      return () => clearTimeout(timeout);
    }
  }, [isRefreshing]);
  
  // Additional backup: Monitor the loading handlers directly
  useEffect(() => {
    // If we're refreshing but neither tab is actually loading, clear refresh state
    if (isRefreshing && !loadingState.insiderTrades.isLoading && !loadingState.institutionalHoldings.isLoading) {
      console.log('🔄 DIRECT: No tabs loading while refreshing, clearing refresh state');
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500); // Small delay to avoid race conditions
    }
  }, [isRefreshing, loadingState.insiderTrades.isLoading, loadingState.institutionalHoldings.isLoading]);
  
  // Handle initial loading when component mounts
  useEffect(() => {
    console.log('🔄 DASHBOARD: Component mounted, checking if initial loading is needed');
    console.log('🔄 DASHBOARD: Current loading state:', loadingState);
    
    // If we need to load data and haven't started loading yet, ensure loading states are correct
    const needsInsiderRefresh = loadingState.insiderTrades.needsRefresh;
    const needsInstitutionalRefresh = hasInstitutionalAccess && loadingState.institutionalHoldings.needsRefresh;
    
    if (needsInsiderRefresh || needsInstitutionalRefresh) {
      console.log(`🔄 DASHBOARD: Initial loading needed - insider: ${needsInsiderRefresh}, institutional: ${needsInstitutionalRefresh}`);
      
      // Ensure the loading states are properly set to trigger the child components
      setLoadingState({
        insiderTrades: { 
          isLoading: needsInsiderRefresh, 
          needsRefresh: needsInsiderRefresh 
        },
        institutionalHoldings: { 
          isLoading: needsInstitutionalRefresh, 
          needsRefresh: needsInstitutionalRefresh 
        }
      });
    } else {
      console.log('🔄 DASHBOARD: No initial loading needed, using cached data');
    }
  }, []); // Only run on mount
  
  // Handle loading updates from child components - simplified
  const handleInsiderTradesLoading = (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => {
    console.log(`📊 INSIDER LOADING: isLoading=${isLoading}, progress=${progress}, stage="${stage}", dataLength=${data?.length || 0}, error=${error}, isRefreshing=${isRefreshing}`);
    
    setLoadingState(prev => ({
      ...prev,
      insiderTrades: { 
        isLoading, 
        needsRefresh: false // Once loading starts, no more refresh needed
      }
    }));
    
    // When loading completes successfully, update data and timestamps
    if (!isLoading && data) {
      console.log(`📊 INSIDER LOADING: Loading completed with ${data.length} items, updating data and timestamp`);
      setInsiderTradesData(data);
      setLastFetchTime(prev => ({
        ...prev,
        insiderTrades: Date.now()
      }));
    }
    
    // Update error state if provided
    if (error !== undefined) {
      console.log(`📊 INSIDER LOADING: Error state updated: ${error}`);
      setErrors(prev => ({ ...prev, insiderTrades: error }));
    }
    
    // Only update overall progress if this is the active tab
    if (activeTab === 'insider' || !isLoading) {
      setLoadingProgress(progress);
      setLoadingStage(stage);
      
      // Propagate to parent component
      if (onLoadingProgressChange) {
        onLoadingProgressChange(progress, stage);
      }
    }

    // EXPLICIT: Clear refresh state when insider loading completes
    if (!isLoading && isRefreshing) {
      console.log('✅ INSIDER LOADING: Insider loading complete, checking if we can clear refresh state');
      
      // Check if institutional also complete (or not needed)
      const institutionalComplete = !hasInstitutionalAccess || !loadingState.institutionalHoldings.isLoading;
      
      if (institutionalComplete) {
        console.log('✅ INSIDER LOADING: All loading complete, clearing refresh state immediately');
        setIsRefreshing(false);
      } else {
        console.log('✅ INSIDER LOADING: Waiting for institutional loading to complete');
      }
    }
  };
  
  // Handle loading updates from institutional holdings tab - simplified
  const handleInstitutionalHoldingsLoading = (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => {
    console.log(`🏛️ INSTITUTIONAL LOADING: isLoading=${isLoading}, progress=${progress}, stage="${stage}", dataLength=${data?.length || 0}, error=${error}, isRefreshing=${isRefreshing}`);
    
    setLoadingState(prev => ({
      ...prev,
      institutionalHoldings: { 
        isLoading, 
        needsRefresh: false // Once loading starts, no more refresh needed
      }
    }));
    
    // When loading completes successfully, update data and timestamps
    if (!isLoading && data) {
      console.log(`🏛️ INSTITUTIONAL LOADING: Loading completed with ${data.length} items, updating data and timestamp`);
      setInstitutionalHoldingsData(data);
      setLastFetchTime(prev => ({
        ...prev,
        institutionalHoldings: Date.now()
      }));
    }
    
    // Update error state if provided
    if (error !== undefined) {
      console.log(`🏛️ INSTITUTIONAL LOADING: Error state updated: ${error}`);
      setErrors(prev => ({ ...prev, institutionalHoldings: error }));
    }
    
    // Only update overall progress if this is the active tab
    if (activeTab === 'institutional' || !isLoading) {
      setLoadingProgress(progress);
      setLoadingStage(stage);
      
      // Propagate to parent component
      if (onLoadingProgressChange) {
        onLoadingProgressChange(progress, stage);
      }
    }

    // EXPLICIT: Clear refresh state when institutional loading completes
    if (!isLoading && isRefreshing) {
      console.log('✅ INSTITUTIONAL LOADING: Institutional loading complete, checking if we can clear refresh state');
      
      // Check if insider also complete
      const insiderComplete = !loadingState.insiderTrades.isLoading;
      
      if (insiderComplete) {
        console.log('✅ INSTITUTIONAL LOADING: All loading complete, clearing refresh state immediately');
        setIsRefreshing(false);
      } else {
        console.log('✅ INSTITUTIONAL LOADING: Waiting for insider loading to complete');
      }
    }
  };
  
  // Handle time range changes
  const handleTimeRangeChange = (range: TimeRange) => {
    console.log(`⏰ TIME RANGE: Changing from ${timeRange} to ${range}`);
    
    // Update the time range state
    setTimeRange(range);
    
    // Clear cached data when time range changes to force fresh fetch
    console.log('⏰ TIME RANGE: Clearing localStorage cache for new time range');
    localStorage.removeItem('secFilings_insiderTrades');
    localStorage.removeItem('secFilings_institutionalHoldings');
    localStorage.removeItem('secFilings_lastFetchTime');
    
    // Reset cached data in state
    setInsiderTradesData([]);
    setInstitutionalHoldingsData([]);
    setLastFetchTime({
      insiderTrades: null,
      institutionalHoldings: null
    });
    
    // Clear any existing errors
    setErrors({
      insiderTrades: null,
      institutionalHoldings: null
    });
    
    // Trigger fresh data loading for both tabs
    console.log('⏰ TIME RANGE: Triggering fresh data loading for new time range');
    setLoadingState({
      insiderTrades: { isLoading: true, needsRefresh: true },
      institutionalHoldings: { isLoading: true, needsRefresh: true }
    });
  };
  
  // Function to refresh data with cache clearing
  const handleRefresh = async () => {
    console.log('🔄 REFRESH: Starting refresh process...');
    
    try {
      setIsRefreshing(true);
      console.log('🔄 REFRESH: Set isRefreshing to true');
      
      // Update loading stage to show cache clearing operation
      setLoadingProgress(0);
      setLoadingStage('Refreshing SEC data...');
      console.log('🔄 REFRESH: Set loading stage to cache clearing');
      
      // Propagate to parent if callback exists
      if (onLoadingProgressChange) {
        onLoadingProgressChange(0, 'Refreshing SEC data...');
      }
      
      // Call the API function to clear cache
      console.log('🔄 REFRESH: Calling clearSecCache...');
      await clearSecCache();
      console.log('🔄 REFRESH: Cache cleared successfully');
      
      // Clear local storage cache as well
      console.log('🔄 REFRESH: Clearing localStorage cache');
      localStorage.removeItem('secFilings_insiderTrades');
      localStorage.removeItem('secFilings_institutionalHoldings');
      localStorage.removeItem('secFilings_lastFetchTime');
      
      // Now that cache is cleared, set the stage to 25% before fetching fresh data
      setLoadingProgress(25);
      setLoadingStage('Fetching fresh data in parallel...');
      console.log('🔄 REFRESH: Set loading stage to fetching fresh data');
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(25, 'Fetching fresh data in parallel...');
      }
      
      // Clear cached last fetch time to force fresh data
      console.log('🔄 REFRESH: Clearing cached fetch times');
      setLastFetchTime({
        insiderTrades: null,
        institutionalHoldings: null
      });
      
      // Reset cached data in state
      setInsiderTradesData([]);
      setInstitutionalHoldingsData([]);
      
      // Clear any previous errors
      setErrors({
        insiderTrades: null,
        institutionalHoldings: null
      });
      
      // Set loading states to trigger data refresh with streaming
      console.log('🔄 REFRESH: Setting loading states to trigger refresh');
      setLoadingState({
        insiderTrades: { isLoading: true, needsRefresh: true },
        institutionalHoldings: { isLoading: true, needsRefresh: true }
      });
      
      console.log('🔄 REFRESH: Refresh initiated successfully, waiting for loading handlers...');
      
    } catch (error) {
      console.error('❌ REFRESH: Error during refresh:', error);
      setIsRefreshing(false);
      
      // Show error state
      setLoadingProgress(0);
      setLoadingStage('Error refreshing data');
      
      // Set error states for both tabs
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh SEC data';
      setErrors({
        insiderTrades: errorMessage,
        institutionalHoldings: errorMessage
      });
      
      // Reset loading states on error
      setLoadingState({
        insiderTrades: { isLoading: false, needsRefresh: false },
        institutionalHoldings: { isLoading: false, needsRefresh: false }
      });
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(0, 'Error refreshing data');
      }
    }
  };
  
  // Debug function to clear all cache - available in browser console as window.clearSecCache
  useEffect(() => {
    (window as any).clearSecFilingsCache = () => {
      console.log('🧹 DEBUG: Clearing all SEC filings cache...');
      localStorage.removeItem('secFilings_insiderTrades');
      localStorage.removeItem('secFilings_institutionalHoldings');
      localStorage.removeItem('secFilings_lastFetchTime');
      localStorage.removeItem('secFilings_timeRange');
      localStorage.removeItem('secFilings_activeTab');
      
      setInsiderTradesData([]);
      setInstitutionalHoldingsData([]);
      setLastFetchTime({ insiderTrades: null, institutionalHoldings: null });
      setIsRefreshing(false);
      setErrors({ insiderTrades: null, institutionalHoldings: null });
      
      console.log('🧹 DEBUG: Cache cleared! Reload the page to see fresh data.');
    };
  }, []);
  
  // Handle tab switching - no more tier restrictions, use session unlocks instead
  const handleTabChange = (tab: 'insider' | 'institutional') => {
    setActiveTab(tab);
  };

  // Institutional Holdings Upgrade Card Component for free users
  const InstitutionalUpgradeCard: React.FC = () => {
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
          Institutional Holdings Analysis
        </h3>
        
        <p className={`${subTextColor} mb-4 max-w-md mx-auto`}>
          Access comprehensive 13F filing data, institutional ownership trends, and smart money tracking to enhance your investment research.
        </p>
        
        <div className={`${isLight ? 'bg-stone-200' : 'bg-gray-900'} rounded-lg p-4 mb-6`}>
          <h4 className={`font-semibold ${textColor} mb-2`}>Pro Features Include:</h4>
          <ul className={`text-sm ${subTextColor} space-y-1 text-left max-w-xs mx-auto`}>
            <li>• 13F institutional filing analysis</li>
            <li>• Institutional ownership tracking</li>
            <li>• Smart money position monitoring</li>
            <li>• Quarterly holding change alerts</li>
            <li>• Advanced filtering & sorting</li>
          </ul>
        </div>
        
        <button
          onClick={() => showTierLimitDialog(
            'Institutional Holdings',
            'Institutional holdings analysis is a Pro feature. Upgrade to access comprehensive 13F filing data and institutional investment tracking.',
            'Unlock institutional holdings, advanced SEC analysis, and comprehensive regulatory filing insights with HRVSTR Pro.',
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

  // Component for locked overlays
  const LockedOverlay: React.FC<{
    title: string;
    description: string;
    cost: number;
    componentKey: keyof typeof unlockedComponents;
    icon: React.ReactNode;
  }> = ({ title, description, cost, componentKey, icon }) => (
    <div className={`${isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'} rounded-lg border p-8 text-center relative overflow-hidden h-full flex flex-col justify-center`}>
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
    <>
      <div className="flex flex-col h-full">
        <div className={`flex flex-row justify-between items-center gap-4 mb-4 ${cardBg} rounded-lg p-4 border ${cardBorder}`}>
          <div className="flex-1">
            <h1 className={`text-xl font-bold ${textColor}`}>SEC Filings</h1>
            <p className={`text-sm ${subTextColor}`}>Track insider trading and institutional holdings</p>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Time range selector */}
            <select
              value={timeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value as TimeRange)}
              className={`py-1 px-2 rounded text-sm ${cardBg} ${textColor} border ${cardBorder}`}
              disabled={loadingState.insiderTrades.isLoading || loadingState.institutionalHoldings.isLoading}
            >
              <option value="1w">1 Week</option>
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
              <option value="6m">6 Months</option>
            </select>
            
            {/* Refresh button - now combines cache clearing and data refresh */}
            <button
              onClick={() => {
                console.log('🔄 DASHBOARD: Refresh button clicked!');
                console.log('🔄 DASHBOARD: Current states before refresh:', {
                  isRefreshing,
                  loadingState,
                  activeTab,
                  unlockedComponents
                });
                
                // Only refresh if the active tab component is unlocked
                const canRefresh = (activeTab === 'insider' && unlockedComponents.insiderTrading) || 
                                 (activeTab === 'institutional' && unlockedComponents.institutionalHoldings);
                
                if (canRefresh) {
                handleRefresh();
                } else {
                  info(`Please unlock ${activeTab === 'insider' ? 'Insider Trading' : 'Institutional Holdings'} first`);
                }
              }}
              disabled={isRefreshing || 
                       (activeTab === 'insider' && (loadingState.insiderTrades.isLoading || !unlockedComponents.insiderTrading)) ||
                       (activeTab === 'institutional' && (loadingState.institutionalHoldings.isLoading || !unlockedComponents.institutionalHoldings))}
              className={`p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white ${
                (isRefreshing || 
                 (activeTab === 'insider' && (loadingState.insiderTrades.isLoading || !unlockedComponents.insiderTrading)) ||
                 (activeTab === 'institutional' && (loadingState.institutionalHoldings.isLoading || !unlockedComponents.institutionalHoldings))) 
                ? 'opacity-50' : ''
              }`}
              title="Refresh SEC data"
            >
              {(isRefreshing || 
                (activeTab === 'insider' && loadingState.insiderTrades.isLoading) || 
                (activeTab === 'institutional' && loadingState.institutionalHoldings.isLoading)) ? (
                <Loader2 size={18} className="text-white animate-spin" />
              ) : (
                <RefreshCw size={18} className="text-white" />
              )}
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="mb-4 flex w-full">
          <button
            className={`py-2 px-4 rounded-t-lg font-medium text-sm flex-1 text-center ${
              activeTab === 'insider' ? `${tabActiveBg} ${tabActiveText}` : `${tabInactiveBg} ${tabInactiveText}`
            }`}
            onClick={() => handleTabChange('insider')}
          >
            Insider Trading
          </button>
          <button
            className={`py-2 px-4 rounded-t-lg font-medium text-sm flex-1 text-center relative ${
              activeTab === 'institutional' ? `${tabActiveBg} ${tabActiveText}` : `${tabInactiveBg} ${tabInactiveText}`
            }`}
            onClick={() => handleTabChange('institutional')}
          >
            Institutional Holdings
          </button>
        </div>
        
        {/* Loading progress bar - shown only when active tab is loading and unlocked */}
        {((activeTab === 'insider' && unlockedComponents.insiderTrading && loadingState.insiderTrades.isLoading) || 
          (activeTab === 'institutional' && unlockedComponents.institutionalHoldings && loadingState.institutionalHoldings.isLoading)) ? (
          <div className={`${cardBg} rounded-lg p-4 mb-4 border ${cardBorder}`}>
            <div className="flex flex-col items-center">
              <p className={`text-sm font-medium ${textColor} mb-2`}>{loadingStage}</p>
              <div className="w-full max-w-lg mb-2">
                <ProgressBar progress={loadingProgress} />
              </div>
              <p className="text-xs text-blue-400">{loadingProgress}% complete</p>
            </div>
          </div>
        ) : null}
        
        {/* Active tab content */}
        <div className="flex-1">
          {activeTab === 'insider' ? (
            unlockedComponents.insiderTrading ? (
            <InsiderTradesTab
              timeRange={timeRange}
              isLoading={loadingState.insiderTrades.isLoading}
              onLoadingChange={handleInsiderTradesLoading}
              forceReload={loadingState.insiderTrades.needsRefresh}
              initialData={insiderTradesData}
              error={errors.insiderTrades}
            />
            ) : (
              <LockedOverlay
                title="Insider Trading"
                description="Access real-time insider trading data, transaction details, and regulatory filing insights to track smart money movements."
                cost={COMPONENT_COSTS.insiderTrading}
                componentKey="insiderTrading"
                icon={<Lock className="w-8 h-8 text-white" />}
              />
            )
          ) : activeTab === 'institutional' ? (
            unlockedComponents.institutionalHoldings ? (
            <InstitutionalHoldingsTab
              timeRange={timeRange}
              isLoading={loadingState.institutionalHoldings.isLoading}
              onLoadingChange={handleInstitutionalHoldingsLoading}
              forceReload={loadingState.institutionalHoldings.needsRefresh}
              initialData={institutionalHoldingsData}
              error={errors.institutionalHoldings}
            />
            ) : (
              <LockedOverlay
                title="Institutional Holdings"
                description="Unlock comprehensive 13F filing data, institutional ownership trends, and smart money tracking for professional investment research."
                cost={COMPONENT_COSTS.institutionalHoldings}
                componentKey="institutionalHoldings"
                icon={<Crown className="w-8 h-8 text-white" />}
              />
            )
          ) : (
            <InstitutionalUpgradeCard />
          )}
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

export default SECFilingsDashboard;
