import React, { useState, useEffect } from 'react';
import { RefreshCw, Loader2, Lock, Crown, TrendingUp, Zap, ListChecks } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTier } from '../../contexts/TierContext';
import { useToast } from '../../contexts/ToastContext';
import { useSECUnlock } from '../../hooks/useSECUnlock';
import { useSECLoading } from '../../hooks/useSECLoading';
import { useSECTimeRange } from '../../hooks/useSECTimeRange';
import InsiderTradesTab from './InsiderTradesTab';
import InstitutionalHoldingsTab from './InstitutionalHoldingsTab';
import TierLimitDialog from '../UI/TierLimitDialog';
import ProgressBar from '../ProgressBar';
import HarvestLoadingCard from '../UI/HarvestLoadingCard';

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
  const { info } = useToast();
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

  // Use the new SEC unlock hook
  const {
    unlockedComponents,
    activeSessions,
    isFreshUnlock,
    currentTier,
    hasInsiderAccess,
    hasInstitutionalAccess,
    handleUnlockComponent: hookHandleUnlockComponent,
    setFreshUnlockState,
    COMPONENT_COSTS
  } = useSECUnlock();

  // Use the SEC loading hook with fresh unlock state
  const {
    isRefreshing,
    loadingProgress,
    loadingStage,
    loadingState,
    errors,
    insiderTradesData,
    institutionalHoldingsData,
    isFreshUnlock: loadingIsFreshUnlock,
    handleInsiderTradesLoading,
    handleInstitutionalHoldingsLoading,
    handleRefresh,
    setLoadingState
  } = useSECLoading({
    onLoadingProgressChange,
    hasInsiderAccess,
    hasInstitutionalAccess,
    isFreshUnlock,
    setFreshUnlockState
  });

  const { timeRange, handleTimeRangeChange } = useSECTimeRange({ 
    hasInsiderAccess, 
    hasInstitutionalAccess, 
    setLoadingState 
  });

  // State management - simplified without localStorage
  const [activeTab, setActiveTab] = useState<'insider' | 'institutional'>('insider');
  
  // Tier limit dialog state
  const [showTierDialog, setShowTierDialog] = useState(false);
  const [tierDialogContent, setTierDialogContent] = useState({
    feature: '',
    description: '',
    benefits: '',
    requiredTier: ''
  });

  // Show tier limit dialog for institutional features
  const showTierLimitDialog = (feature: string, description: string, benefits: string, requiredTier: string) => {
    console.log(`Tier limit reached for ${feature}. Required: ${requiredTier}. Current: ${currentTier}`);
    setTierDialogContent({ feature, description, benefits, requiredTier });
    setShowTierDialog(true);
  };
  
  // Handle tab switching
  const handleTabChange = (tab: 'insider' | 'institutional') => {
    // SAFETY FIX: Reset stuck loading state when switching to institutional tab
    if (tab === 'institutional' && loadingState.institutionalHoldings.isLoading) {
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
          onClick={() => window.location.href = '/settings/tiers'}
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
          onClick={() => hookHandleUnlockComponent(componentKey, cost)}
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
              className={`py-1 px-2 rounded text-sm ${cardBg} ${textColor} border ${cardBorder} ${
                !(unlockedComponents.insiderTrading || unlockedComponents.institutionalHoldings)
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
              disabled={loadingState.insiderTrades.isLoading || loadingState.institutionalHoldings.isLoading || !(unlockedComponents.insiderTrading || unlockedComponents.institutionalHoldings)}
              title={
                (unlockedComponents.insiderTrading || unlockedComponents.institutionalHoldings)
                  ? 'Select time range'
                  : 'Unlock components to change time range'
              }
            >
              <option value="1w">1 Week</option>
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
              <option value="6m">6 Months</option>
            </select>
            
            {/* Refresh button */}
            <button
              className={`transition-colors rounded-full p-2 ${
                // Show different styling based on unlock state
                (unlockedComponents.insiderTrading || unlockedComponents.institutionalHoldings)
                  ? `${isLight ? 'bg-blue-500' : 'bg-blue-600'} hover:${isLight ? 'bg-blue-600' : 'bg-blue-700'} text-white` // Unlocked: normal blue
                  : 'bg-gray-400 cursor-not-allowed text-gray-200' // Locked: grayed out
              } ${(isRefreshing || loadingState.insiderTrades.isLoading || loadingState.institutionalHoldings.isLoading) ? 'opacity-50' : ''}`}
              onClick={handleRefresh}
              disabled={(isRefreshing || loadingState.insiderTrades.isLoading || loadingState.institutionalHoldings.isLoading) || !(unlockedComponents.insiderTrading || unlockedComponents.institutionalHoldings)}
              title={
                (unlockedComponents.insiderTrading || unlockedComponents.institutionalHoldings)
                  ? 'Refresh SEC data'
                  : 'Unlock components to refresh data'
              }
            >
              {/* Only show spinner if components are unlocked AND loading */}
              {(unlockedComponents.insiderTrading || unlockedComponents.institutionalHoldings) && (isRefreshing || loadingState.insiderTrades.isLoading || loadingState.institutionalHoldings.isLoading) ? (
                <Loader2 size={18} className="text-white animate-spin" />
              ) : (
                <RefreshCw size={18} className={
                  // Gray icon when locked, white when unlocked
                  !(unlockedComponents.insiderTrading || unlockedComponents.institutionalHoldings)
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
        
        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'insider' && (
            <>
              {unlockedComponents.insiderTrading ? (
                <>
                  {loadingState.insiderTrades.isLoading ? (
                    <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
                      <div className={`${headerBg} p-4`}>
                        <h2 className={`text-lg font-semibold ${textColor}`}>Recent Insider Transactions</h2>
                      </div>
                      {loadingIsFreshUnlock.insiderTrading ? (
                        <HarvestLoadingCard
                          progress={loadingProgress}
                          stage={loadingStage}
                          operation="insider-trading"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                          <Loader2 className="text-blue-500 animate-spin mb-4" size={32} />
                          <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                            Loading Insider Trading Data
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
              ) : (
                <LockedOverlay
                  title="Insider Trading Data"
                  description="Unlock access to real-time insider trading transactions, executive stock purchases, and regulatory filings data."
                  cost={COMPONENT_COSTS.insiderTrading}
                  componentKey="insiderTrading"
                  icon={<ListChecks className="w-8 h-8 text-white" />}
                />
              )}
            </>
          )}
          
          {activeTab === 'institutional' && (
            <>
              {/* Check tier first - free users should see upgrade card, not unlock option */}
              {currentTier === 'free' ? (
                <InstitutionalUpgradeCard />
              ) : unlockedComponents.institutionalHoldings ? (
                <>
                  {loadingState.institutionalHoldings.isLoading ? (
                    <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
                      <div className={`${headerBg} p-4`}>
                        <h2 className={`text-lg font-semibold ${textColor}`}>Institutional Holdings</h2>
                      </div>
                      {loadingIsFreshUnlock.institutionalHoldings ? (
                        <HarvestLoadingCard
                          progress={loadingProgress}
                          stage={loadingStage}
                          operation="institutional-holdings"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                          <Loader2 className="text-blue-500 animate-spin mb-4" size={32} />
                          <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                            Loading Institutional Holdings Data
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
                // Pro+ users without unlock get credit unlock option
                <LockedOverlay
                  title="Institutional Holdings"
                  description="Access comprehensive 13F filing data, institutional investment tracking, and hedge fund position analysis."
                  cost={COMPONENT_COSTS.institutionalHoldings}
                  componentKey="institutionalHoldings"
                  icon={<ListChecks className="w-8 h-8 text-white" />}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default SECFilingsDashboard;
