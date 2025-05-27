import React, { useState, useEffect } from 'react';
import { TimeRange } from '../../types';
import { clearSecCache } from '../../services/api';
import { RefreshCw, Loader2 } from 'lucide-react';
import ProgressBar from '../ProgressBar';
import { useTheme } from '../../contexts/ThemeContext';
import InsiderTradesTab from './InsiderTradesTab.tsx';
import InstitutionalHoldingsTab from './InstitutionalHoldingsTab.tsx';

interface SECFilingsDashboardProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
}

const SECFilingsDashboard: React.FC<SECFilingsDashboardProps> = ({ 
  onLoadingProgressChange 
}) => {
  const { theme } = useTheme();
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
      return (localStorage.getItem('secFilings_activeTab') as 'insider' | 'institutional') || 'insider';
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
  
  // Combined loading state
  const [loading, setLoading] = useState({
    insiderTrades: insiderTradesData.length === 0,
    institutionalHoldings: institutionalHoldingsData.length === 0
  });
  
  // Separate reload trigger state based on cache age
  const [shouldReload, setShouldReload] = useState({
    insiderTrades: insiderTradesData.length === 0 || isDataStale(lastFetchTime.insiderTrades),
    institutionalHoldings: institutionalHoldingsData.length === 0 || isDataStale(lastFetchTime.institutionalHoldings)
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
  
  // Handle loading updates from child components
  const handleInsiderTradesLoading = (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => {
    // When loading completes, turn off reload trigger as well
    if (!isLoading && loading.insiderTrades) {
      setShouldReload(prev => ({ ...prev, insiderTrades: false }));
      
      // If data was provided, update the state and last fetch time
      if (data) {
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
    }
    
    setLoading(prev => ({ ...prev, insiderTrades: isLoading }));
    
    // Only update overall progress if this is the active tab
    if (activeTab === 'insider' || isLoading === false) {
      setLoadingProgress(progress);
      setLoadingStage(stage);
      
      // Propagate to parent component
      if (onLoadingProgressChange) {
        onLoadingProgressChange(progress, stage);
      }
    }
  };
  
  // Handle loading updates from institutional holdings tab
  const handleInstitutionalHoldingsLoading = (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => {
    // When loading completes, turn off reload trigger as well
    if (!isLoading && loading.institutionalHoldings) {
      setShouldReload(prev => ({ ...prev, institutionalHoldings: false }));
      
      // If data was provided, update the state and last fetch time
      if (data) {
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
    }
    
    setLoading(prev => ({ ...prev, institutionalHoldings: isLoading }));
    
    // Only update overall progress if this is the active tab
    if (activeTab === 'institutional' || isLoading === false) {
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
      
      // Now that cache is cleared, set the stage to 50% before refreshing data
      setLoadingProgress(50);
      setLoadingStage('Loading fresh data...');
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(50, 'Loading fresh data...');
      }
      
      // After cache is cleared, we'll set loading states
      setLoading({
        insiderTrades: true,
        institutionalHoldings: true
      });
      
      // Set reload flags for both components
      setShouldReload({
        insiderTrades: true,
        institutionalHoldings: true
      });
      
      // Clear cached last fetch time to force fresh data
      setLastFetchTime({
        insiderTrades: null,
        institutionalHoldings: null
      });
      localStorage.removeItem('secFilings_lastFetchTime');
      
      setIsRefreshing(false);
    } catch (error) {
      console.error('Error refreshing SEC data:', error);
      setIsRefreshing(false);
      
      // Show error state
      setLoadingProgress(0);
      setLoadingStage('Error refreshing data');
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(0, 'Error refreshing data');
      }
    }
  };
  
  return (
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
            disabled={loading.insiderTrades || loading.institutionalHoldings}
          >
            <option value="1d">1 Day</option>
            <option value="1w">1 Week</option>
            <option value="1m">1 Month</option>
            <option value="3m">3 Months</option>
          </select>
          
          {/* Refresh button - now combines cache clearing and data refresh */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || loading.insiderTrades || loading.institutionalHoldings}
            className={`p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white ${(isRefreshing || loading.insiderTrades || loading.institutionalHoldings) ? 'opacity-50' : ''}`}
            title="Refresh SEC data"
          >
            {(isRefreshing || loading.insiderTrades || loading.institutionalHoldings) ? (
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
          onClick={() => setActiveTab('insider')}
        >
          Insider Trading
        </button>
        <button
          className={`py-2 px-4 rounded-t-lg font-medium text-sm flex-1 text-center ${
            activeTab === 'institutional' ? `${tabActiveBg} ${tabActiveText}` : `${tabInactiveBg} ${tabInactiveText}`
          }`}
          onClick={() => setActiveTab('institutional')}
        >
          Institutional Holdings
        </button>
      </div>
      
      {/* Loading progress bar - shown only when active tab is loading */}
      {(activeTab === 'insider' && loading.insiderTrades) || (activeTab === 'institutional' && loading.institutionalHoldings) ? (
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
            isLoading={loading.insiderTrades}
            onLoadingChange={handleInsiderTradesLoading}
            forceReload={shouldReload.insiderTrades}
            initialData={insiderTradesData}
            error={errors.insiderTrades}
          />
        ) : (
          <InstitutionalHoldingsTab
            timeRange={timeRange}
            isLoading={loading.institutionalHoldings}
            onLoadingChange={handleInstitutionalHoldingsLoading}
            forceReload={shouldReload.institutionalHoldings}
            initialData={institutionalHoldingsData}
            error={errors.institutionalHoldings}
          />
        )}
      </div>
    </div>
  );
};

export default SECFilingsDashboard;
