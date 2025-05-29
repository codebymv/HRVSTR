import React, { useState, useEffect } from 'react';
import { TimeRange } from '../../types';
import { clearSecCache, fetchSecDataParallel } from '../../services/api';
import { RefreshCw, Loader2, Crown, Lock } from 'lucide-react';
import ProgressBar from '../ProgressBar';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { useTierLimits } from '../../hooks/useTierLimits';
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
  const { tierInfo } = useTier();
  const { showTierLimitDialog, tierLimitDialog, closeTierLimitDialog } = useTierLimits();
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
  
  // Shared state between tabs
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    try {
      return (localStorage.getItem('secFilings_timeRange') as TimeRange) || '1m';
    } catch (e) {
      return '1m';
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
    const institutionalNeedsRefresh = institutionalHoldingsData.length === 0 || isDataStale(lastFetchTime.institutionalHoldings);
    
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
  
  // Handle loading updates from child components - simplified
  const handleInsiderTradesLoading = (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => {
    setLoadingState(prev => ({
      ...prev,
      insiderTrades: { 
        isLoading, 
        needsRefresh: false // Once loading starts, no more refresh needed
      }
    }));
    
    // When loading completes successfully, update data and timestamps
    if (!isLoading && data) {
      setInsiderTradesData(data);
      setLastFetchTime(prev => ({
        ...prev,
        insiderTrades: Date.now()
      }));
    }
    
    // Update error state if provided
    if (error !== undefined) {
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
  };
  
  // Handle loading updates from institutional holdings tab - simplified
  const handleInstitutionalHoldingsLoading = (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => {
    setLoadingState(prev => ({
      ...prev,
      institutionalHoldings: { 
        isLoading, 
        needsRefresh: false // Once loading starts, no more refresh needed
      }
    }));
    
    // When loading completes successfully, update data and timestamps
    if (!isLoading && data) {
      setInstitutionalHoldingsData(data);
      setLastFetchTime(prev => ({
        ...prev,
        institutionalHoldings: Date.now()
      }));
    }
    
    // Update error state if provided
    if (error !== undefined) {
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
  };
  
  // Handle time range changes
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
  };
  
  // Function to refresh data with cache clearing
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      
      // Update loading stage to show cache clearing operation
      setLoadingProgress(0);
      setLoadingStage('Refreshing SEC data...');
      
      // Propagate to parent if callback exists
      if (onLoadingProgressChange) {
        onLoadingProgressChange(0, 'Refreshing SEC data...');
      }
      
      // Call the API function to clear cache
      await clearSecCache();
      
      // Now that cache is cleared, set the stage to 25% before fetching fresh data
      setLoadingProgress(25);
      setLoadingStage('Fetching fresh data in parallel...');
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(25, 'Fetching fresh data in parallel...');
      }
      
      // Use parallel fetching for optimal refresh performance
      setLoadingProgress(50);
      setLoadingStage('Loading insider trades and institutional holdings...');
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(50, 'Loading insider trades and institutional holdings...');
      }
      
      // Fetch both data types in parallel with refresh=true
      const parallelData = await fetchSecDataParallel(timeRange, true);
      
      // Update progress
      setLoadingProgress(75);
      setLoadingStage('Processing data...');
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(75, 'Processing data...');
      }
      
      // Update both datasets simultaneously
      setInsiderTradesData(parallelData.insiderTrades);
      setInstitutionalHoldingsData(parallelData.institutionalHoldings);
      
      // Update last fetch times for both
      const now = Date.now();
      setLastFetchTime({
        insiderTrades: now,
        institutionalHoldings: now
      });
      
      // Clear loading states since we're handling the data directly
      setLoadingState({
        insiderTrades: { isLoading: false, needsRefresh: false },
        institutionalHoldings: { isLoading: false, needsRefresh: false }
      });
      
      // Clear any previous errors
      setErrors({
        insiderTrades: null,
        institutionalHoldings: null
      });
      
      // Final progress update
      setLoadingProgress(100);
      setLoadingStage('Refresh complete');
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(100, 'Refresh complete');
      }
      
      setIsRefreshing(false);
      
      // Reset progress after a short delay
      setTimeout(() => {
        setLoadingProgress(0);
        setLoadingStage('Ready');
      }, 1000);
      
    } catch (error) {
      console.error('Error refreshing SEC data:', error);
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
  
  // Handle tab switching with tier restrictions
  const handleTabChange = (tab: 'insider' | 'institutional') => {
    if (tab === 'institutional' && !hasInstitutionalAccess) {
      // Show tier limit dialog for institutional holdings
      showTierLimitDialog(
        'Institutional Holdings',
        'Institutional holdings analysis is a Pro feature. Upgrade to access comprehensive 13F filing data and institutional investment tracking.',
        'Unlock institutional holdings, advanced SEC analysis, and comprehensive regulatory filing insights with HRVSTR Pro.',
        'general'
      );
      return;
    }
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

  return (
    <>
      <div className="flex flex-col h-full">
        <div className={`flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 ${cardBg} rounded-lg p-4 border ${cardBorder}`}>
          <div>
            <h1 className={`text-xl font-bold ${textColor}`}>SEC Filings</h1>
            <p className={`text-sm ${subTextColor}`}>Track insider trading and institutional holdings</p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Time range selector */}
            <select
              value={timeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value as TimeRange)}
              className={`py-1 px-2 rounded text-sm ${cardBg} ${textColor} border ${cardBorder}`}
              disabled={loadingState.insiderTrades.isLoading || loadingState.institutionalHoldings.isLoading}
            >
              <option value="1d">1 Day</option>
              <option value="1w">1 Week</option>
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
            </select>
            
            {/* Refresh button - now combines cache clearing and data refresh */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || loadingState.insiderTrades.isLoading || loadingState.institutionalHoldings.isLoading}
              className={`p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white ${(isRefreshing || loadingState.insiderTrades.isLoading || loadingState.institutionalHoldings.isLoading) ? 'opacity-50' : ''}`}
              title="Refresh SEC data"
            >
              {(isRefreshing || loadingState.insiderTrades.isLoading || loadingState.institutionalHoldings.isLoading) ? (
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
            } ${!hasInstitutionalAccess ? 'opacity-75' : ''}`}
            onClick={() => handleTabChange('institutional')}
          >
            Institutional Holdings
            {!hasInstitutionalAccess && (
              <Lock className="w-4 h-4 inline-block ml-1" />
            )}
          </button>
        </div>
        
        {/* Loading progress bar - shown only when active tab is loading */}
        {(activeTab === 'insider' && loadingState.insiderTrades.isLoading) || (activeTab === 'institutional' && loadingState.institutionalHoldings.isLoading && hasInstitutionalAccess) ? (
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
            <InsiderTradesTab
              timeRange={timeRange}
              isLoading={loadingState.insiderTrades.isLoading}
              onLoadingChange={handleInsiderTradesLoading}
              forceReload={loadingState.insiderTrades.needsRefresh}
              initialData={insiderTradesData}
              error={errors.insiderTrades}
            />
          ) : activeTab === 'institutional' && hasInstitutionalAccess ? (
            <InstitutionalHoldingsTab
              timeRange={timeRange}
              isLoading={loadingState.institutionalHoldings.isLoading}
              onLoadingChange={handleInstitutionalHoldingsLoading}
              forceReload={loadingState.institutionalHoldings.needsRefresh}
              initialData={institutionalHoldingsData}
              error={errors.institutionalHoldings}
            />
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
