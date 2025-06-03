import React, { useState, useEffect } from 'react';
import { RefreshCw, Loader2, Lock, Crown } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTier } from '../../contexts/TierContext';
import InsiderTradesTab from './InsiderTradesTab';
import InstitutionalHoldingsTab from './InstitutionalHoldingsTab';
import { clearSecCache, clearUserSecCache } from '../../services/api';
import TierLimitDialog from '../UI/TierLimitDialog';
import ProgressBar from '../ProgressBar';

type TimeRange = '1w' | '1m' | '3m' | '6m';

interface SECFilingsDashboardProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
}

const SECFilingsDashboard: React.FC<SECFilingsDashboardProps> = ({ 
  onLoadingProgressChange 
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { tierInfo } = useTier();
  const isLight = theme === 'light';
  
  // Theme-based styling
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const headerBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-gray-600' : 'text-gray-400';
  
  const tabActiveBg = isLight ? 'bg-blue-500' : 'bg-blue-600';
  const tabActiveText = 'text-white';
  const tabInactiveBg = isLight ? 'bg-gray-100' : 'bg-gray-800';
  const tabInactiveText = isLight ? 'text-gray-700' : 'text-gray-300';

  // State management - simplified without localStorage
  const [activeTab, setActiveTab] = useState<'insider' | 'institutional'>('insider');
  const [timeRange, setTimeRange] = useState<TimeRange>('1m');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  
  // Tier limit dialog state
  const [showTierDialog, setShowTierDialog] = useState(false);
  const [tierDialogContent, setTierDialogContent] = useState({
    feature: '',
    description: '',
    benefits: '',
    requiredTier: ''
  });
  
  // Data states - no longer stored in localStorage
  const [insiderTradesData, setInsiderTradesData] = useState<any[]>([]);
  const [institutionalHoldingsData, setInstitutionalHoldingsData] = useState<any[]>([]);
  
  // Loading states for components
  const [loadingState, setLoadingState] = useState({
    insiderTrades: { isLoading: false, needsRefresh: false },
    institutionalHoldings: { isLoading: false, needsRefresh: false }
  });

  // Error states
  const [errors, setErrors] = useState<{
    insiderTrades: string | null;
    institutionalHoldings: string | null;
  }>({
    insiderTrades: null,
    institutionalHoldings: null
  });

  // Check tier access using TierContext instead of AuthContext
  const currentTier = tierInfo?.tier || 'free';
  const hasInstitutionalAccess = Boolean(currentTier && ['pro', 'elite', 'institutional'].includes(currentTier));
  
  console.log(`🔍 SEC DASHBOARD - Tier access check:`, {
    currentTier,
    hasInstitutionalAccess,
    tierInfo: tierInfo ? 'loaded' : 'not loaded',
    user: user ? 'authenticated' : 'not authenticated'
  });

  // Handle loading updates from insider trades tab
  const handleInsiderTradesLoading = (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => {
    setLoadingState(prev => ({
      ...prev,
      insiderTrades: { 
        isLoading, 
        needsRefresh: false
      }
    }));
    
    // When loading completes successfully, update data
    if (!isLoading && data) {
      setInsiderTradesData(data);
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

    // Clear refresh state when insider loading completes
    if (!isLoading && isRefreshing) {
      const institutionalComplete = !hasInstitutionalAccess || !loadingState.institutionalHoldings.isLoading;
      if (institutionalComplete) {
        setIsRefreshing(false);
      }
    }
  };
  
  // Handle loading updates from institutional holdings tab
  const handleInstitutionalHoldingsLoading = (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => {
    setLoadingState(prev => ({
      ...prev,
      institutionalHoldings: { 
        isLoading, 
        needsRefresh: false
      }
    }));
    
    // When loading completes successfully, update data
    if (!isLoading && data) {
      setInstitutionalHoldingsData(data);
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

    // Clear refresh state when institutional loading completes
    if (!isLoading && isRefreshing) {
      const insiderComplete = !loadingState.insiderTrades.isLoading;
      if (insiderComplete) {
        setIsRefreshing(false);
      }
    }
  };
  
  // Handle time range changes - no localStorage, just trigger fresh fetch
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    
    // Clear current data and trigger fresh fetch
    setInsiderTradesData([]);
    setInstitutionalHoldingsData([]);
    
    // Clear any existing errors
    setErrors({
      insiderTrades: null,
      institutionalHoldings: null
    });
    
    // Set loading states to trigger data refresh based on tier
    setLoadingState({
      insiderTrades: { 
        isLoading: true, 
        needsRefresh: true 
      },
      institutionalHoldings: { 
        isLoading: hasInstitutionalAccess, 
        needsRefresh: hasInstitutionalAccess 
      }
    });
  };
  
  // Function to refresh data - now clears backend cache
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
      
      // Clear backend cache if user is authenticated, otherwise clear legacy cache
      if (user?.id) {
        // Clear user-specific cache via new API endpoint
        try {
          await clearUserSecCache();
          console.log('Successfully cleared user-specific SEC cache');
        } catch (error) {
          console.warn('Error clearing user cache, falling back to legacy cache clear:', error);
          await clearSecCache();
        }
      } else {
        // Fall back to legacy cache clearing for non-authenticated users
        await clearSecCache();
      }
      
      // Now that cache is cleared, set the stage to 25% before fetching fresh data
      setLoadingProgress(25);
      setLoadingStage('Fetching fresh data...');
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(25, 'Fetching fresh data...');
      }
      
      // Clear current data
      setInsiderTradesData([]);
      setInstitutionalHoldingsData([]);
      
      // Clear any previous errors
      setErrors({
        insiderTrades: null,
        institutionalHoldings: null
      });
      
      // Set loading states to trigger data refresh based on tier
      setLoadingState({
        insiderTrades: { 
          isLoading: true, 
          needsRefresh: true 
        },
        institutionalHoldings: { 
          isLoading: hasInstitutionalAccess, 
          needsRefresh: hasInstitutionalAccess 
        }
      });
      
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

  // Monitor tier changes and trigger institutional loading when access is granted
  useEffect(() => {
    // Only trigger when tier access changes from false to true
    if (hasInstitutionalAccess && currentTier !== 'free' && tierInfo) {
      console.log(`🔍 SEC DASHBOARD - Tier access granted, triggering institutional holdings load:`, {
        currentTier,
        hasInstitutionalAccess,
        currentInstitutionalLoading: loadingState.institutionalHoldings.isLoading
      });
      
      // If institutional tab is not currently loading and we have no data, trigger loading
      if (!loadingState.institutionalHoldings.isLoading && institutionalHoldingsData.length === 0) {
        setLoadingState(prev => ({
          ...prev,
          institutionalHoldings: { 
            isLoading: true, 
            needsRefresh: true 
          }
        }));
      }
    }
  }, [hasInstitutionalAccess, currentTier, tierInfo?.tier, loadingState.institutionalHoldings.isLoading, institutionalHoldingsData.length]);

  // Monitor loading states and clear refresh state when all loading is complete
  useEffect(() => {
    if (isRefreshing) {
      const insiderDone = !loadingState.insiderTrades.isLoading;
      const institutionalDone = !hasInstitutionalAccess || !loadingState.institutionalHoldings.isLoading;
      
      if (insiderDone && institutionalDone) {
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing, loadingState.insiderTrades.isLoading, loadingState.institutionalHoldings.isLoading, hasInstitutionalAccess]);
  
  // Safety mechanism - clear refresh state after 5 seconds maximum
  useEffect(() => {
    if (isRefreshing) {
      const timeout = setTimeout(() => {
        setIsRefreshing(false);
        setLoadingState({
          insiderTrades: { isLoading: false, needsRefresh: false },
          institutionalHoldings: { isLoading: false, needsRefresh: false }
        });
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [isRefreshing]);

  // Show tier limit dialog for institutional features
  const showTierLimitDialog = (feature: string, description: string, benefits: string, requiredTier: string) => {
    console.log(`Tier limit reached for ${feature}. Required: ${requiredTier}. Current: ${currentTier}`);
    setTierDialogContent({ feature, description, benefits, requiredTier });
    setShowTierDialog(true);
  };
  
  // Handle tab switching - with tier restrictions
  const handleTabChange = (tab: 'insider' | 'institutional') => {
    // Prevent switching to institutional tab if user doesn't have access
    if (tab === 'institutional' && !hasInstitutionalAccess) {
      showTierLimitDialog(
        'Institutional Holdings',
        'Institutional holdings analysis is a Pro feature. Upgrade to access comprehensive 13F filing data and institutional investment tracking.',
        'Unlock institutional holdings, advanced SEC analysis, and comprehensive regulatory filing insights with HRVSTR Pro.',
        'pro'
      );
      return;
    }
    
    // SAFETY FIX: Reset stuck loading state when switching to institutional tab
    if (tab === 'institutional' && hasInstitutionalAccess && loadingState.institutionalHoldings.isLoading) {
      console.warn('🔄 SEC DASHBOARD - Resetting stuck institutional loading state...');
      setLoadingState(prev => ({
        ...prev,
        institutionalHoldings: { 
          isLoading: false, 
          needsRefresh: false
        }
      }));
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
            'pro'
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
      {showTierDialog && (
        <TierLimitDialog
          isOpen={showTierDialog}
          onClose={() => setShowTierDialog(false)}
          title={tierDialogContent.feature}
          message={tierDialogContent.description}
          featureName={tierDialogContent.feature}
          currentTier={currentTier}
          upgradeMessage={tierDialogContent.benefits}
          context="institutional"
        />
      )}

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
            
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || 
                       loadingState.insiderTrades.isLoading || 
                       loadingState.institutionalHoldings.isLoading}
              className={`p-2 rounded-full transition-colors bg-blue-600 hover:bg-blue-700 text-white ${(isRefreshing || loadingState.insiderTrades.isLoading || loadingState.institutionalHoldings.isLoading) ? 'opacity-50' : ''}`}
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
            } ${!hasInstitutionalAccess ? 'opacity-60 cursor-pointer' : ''}`}
            onClick={() => handleTabChange('institutional')}
          >
            Institutional Holdings
            {!hasInstitutionalAccess && (
              <Lock className="w-3 h-3 inline-block ml-1" />
            )}
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'insider' && (
            <>
              {loadingState.insiderTrades.isLoading ? (
                <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
                  <div className={`${headerBg} p-4`}>
                    <h2 className={`text-lg font-semibold ${textColor}`}>Recent Insider Transactions</h2>
                  </div>
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Loader2 className="mb-3 text-blue-500 animate-spin" size={32} />
                    <p className={`text-lg font-semibold ${textColor} mb-2`}>{loadingStage}</p>
                    <div className="w-full max-w-sm mt-4 mb-2">
                      <ProgressBar progress={loadingProgress} />
                    </div>
                    <div className={`text-xs ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>{loadingProgress}% complete</div>
                  </div>
                </div>
              ) : (
                <InsiderTradesTab
                  timeRange={timeRange}
                  isLoading={loadingState.insiderTrades.isLoading}
                  onLoadingChange={handleInsiderTradesLoading}
                  forceReload={loadingState.insiderTrades.needsRefresh}
                  initialData={insiderTradesData}
                  error={errors.insiderTrades}
                />
              )}
            </>
          )}
          
          {activeTab === 'institutional' && (
            hasInstitutionalAccess ? (
              <>
                {loadingState.institutionalHoldings.isLoading ? (
                  <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
                    <div className={`${headerBg} p-4`}>
                      <h2 className={`text-lg font-semibold ${textColor}`}>Institutional Holdings</h2>
                    </div>
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Loader2 className="mb-3 text-blue-500 animate-spin" size={32} />
                      <p className={`text-lg font-semibold ${textColor} mb-2`}>{loadingStage}</p>
                      <div className="w-full max-w-sm mt-4 mb-2">
                        <ProgressBar progress={loadingProgress} />
                      </div>
                      <div className={`text-xs ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>{loadingProgress}% complete</div>
                    </div>
                  </div>
                ) : (
                  <InstitutionalHoldingsTab
                    timeRange={timeRange}
                    isLoading={loadingState.institutionalHoldings.isLoading}
                    onLoadingChange={handleInstitutionalHoldingsLoading}
                    forceReload={loadingState.institutionalHoldings.needsRefresh}
                    initialData={institutionalHoldingsData}
                    error={errors.institutionalHoldings}
                  />
                )}
              </>
            ) : (
              <InstitutionalUpgradeCard />
            )
          )}
        </div>
      </div>
    </>
  );
};

export default SECFilingsDashboard;
