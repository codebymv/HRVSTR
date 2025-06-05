import React, { useState, useEffect } from 'react';
import { TimeRange } from '../../types';
import { TrendingUp, Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import { useToast } from '../../contexts/ToastContext';
import { useEarningsUnlock } from '../../hooks/useEarningsUnlock';
import { useEarningsLoading } from '../../hooks/useEarningsLoading';
import { useUpcomingEarnings } from '../../hooks/useUpcomingEarnings';
import { useEarningsAnalysis } from '../../hooks/useEarningsAnalysis';
import { useEarningsRefresh } from '../../hooks/useEarningsRefresh';
import HarvestLoadingCard from '../UI/HarvestLoadingCard';
import ProgressBar from '../ProgressBar';
import EarningsMonitorHeader from './EarningsMonitorHeader';
import EarningsMonitorTabs from './EarningsMonitorTabs';
import EarningsTable from './EarningsTable';
import LockedOverlay from './LockedOverlay';
import EarningsAnalysisContent from './EarningsAnalysisContent';
import EarningsAnalysisSearch from './EarningsAnalysisSearch';
import TierLimitDialog from '../UI/TierLimitDialog';

interface EarningsMonitorTabbedProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
}

const EarningsMonitorTabbed: React.FC<EarningsMonitorTabbedProps> = ({ onLoadingProgressChange }) => {
  const { theme } = useTheme();
  const { tierLimitDialog, closeTierLimitDialog } = useTierLimits();
  const { info, warning } = useToast();
  
  // State management
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');
  
  // Add flag to track when we're in an unlock flow (different from refresh flow) 
  const [isUnlockFlow, setIsUnlockFlow] = useState({
    earningsAnalysis: false,
    upcomingEarnings: false
  });
  
  // Use the new earnings unlock hook
  const {
    unlockedComponents,
    isCheckingSessions,
    currentTier,
    hasEarningsAnalysisAccess,
    hasUpcomingEarningsAccess,
    handleUnlockComponent: hookHandleUnlockComponent,
    COMPONENT_COSTS
  } = useEarningsUnlock();
  
  // Use the earnings loading hook
  const {
    loadingState,
    loadingProgress,
    loadingStage,
    isFreshUnlock,
    earningsAnalysis,
    errors,
    setIsRefreshing,
    handleUpcomingEarningsLoading,
    handleEarningsAnalysisLoading,
    updateLoadingProgress,
    setFreshUnlockState,
    clearData,
    setNeedsRefresh,
    setErrors,
  } = useEarningsLoading(hasEarningsAnalysisAccess, hasUpcomingEarningsAccess, onLoadingProgressChange);
  
  // Use the upcoming earnings hook
  const {
    upcomingEarnings,
    sortedEarnings,
    loadData,
  } = useUpcomingEarnings({
    timeRange,
    hasUpcomingEarningsAccess,
    loadingState: loadingState.upcomingEarnings,
    isFreshUnlock: isFreshUnlock.upcomingEarnings,
    isUnlockFlow: isUnlockFlow.upcomingEarnings,
    errors,
    handleUpcomingEarningsLoading,
    updateLoadingProgress,
    setFreshUnlockState,
    setNeedsRefresh,
  });
  
  // Use the earnings analysis hook
  const {
    analyzedTickers,
    loadAnalysis,
  } = useEarningsAnalysis({
    hasEarningsAnalysisAccess,
    isFreshUnlock: isFreshUnlock.earningsAnalysis,
    handleEarningsAnalysisLoading,
    updateLoadingProgress,
    setFreshUnlockState,
  });

  // Use the earnings refresh hook
  const { refreshData } = useEarningsRefresh({
    unlockedComponents,
    upcomingEarnings,
    onLoadingProgressChange,
    setIsRefreshing,
    updateLoadingProgress,
    setErrors,
    clearData,
    setNeedsRefresh
  });
  
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
  
  // Data states that remain in component
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  // Add state for ticker input in analysis tab
  const [analysisTickerInput, setAnalysisTickerInput] = useState<string>('');

  // Handle time range changes - no localStorage, just trigger fresh fetch
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    
    // Clear existing data and errors
    clearData();
    setErrors({
      upcomingEarnings: null,
      analysis: null
    });
    
    // Trigger refresh for unlocked components
    if (unlockedComponents.upcomingEarnings) {
      setNeedsRefresh('upcomingEarnings', true);
    }
  };

  // Handle ticker click
  const handleTickerClick = (ticker: string) => {
    setSelectedTicker(ticker);
    
    // If we have earnings analysis access and are not currently analyzing that ticker
    if (hasEarningsAnalysisAccess && earningsAnalysis?.ticker !== ticker) {
      console.log('🔄 EARNINGS MONITOR - Loading analysis for selected ticker:', ticker);
      loadAnalysis(ticker);
      setActiveTab('analysis'); // Switch to analysis tab to show the results
    }
  };

  // Handle tab switching
  const handleTabChange = (tab: 'upcoming' | 'analysis') => {
    setActiveTab(tab);
  };

  // Handle component unlocking - with unlock flow tracking
  const handleUnlockComponent = async (component: keyof typeof unlockedComponents, cost: number) => {
    // Set unlock flow flag BEFORE calling the hook
    setIsUnlockFlow(prev => ({
      ...prev,
      [component]: true
    }));
    
    console.log('🔄 EARNINGS MONITOR - Setting unlock flow flag for:', component);
    
    try {
      await hookHandleUnlockComponent(component, cost);
      console.log('🔄 EARNINGS MONITOR - Unlock completed for:', component);
    } catch (error) {
      console.error('🔄 EARNINGS MONITOR - Unlock failed for:', component, error);
      // Clear unlock flow flag on error
      setIsUnlockFlow(prev => ({
        ...prev,
        [component]: false
      }));
    }
  };

  // Handle manual ticker input for analysis
  const handleAnalyzeManualTicker = async () => {
    const ticker = analysisTickerInput.toUpperCase().trim();
    if (!ticker) {
      warning('Please enter a valid ticker symbol');
      return;
    }

    if (!hasEarningsAnalysisAccess) {
      info('Please unlock Earnings Analysis to analyze tickers');
      return;
    }

    setFreshUnlockState('earningsAnalysis', true);
    
    try {
      await loadAnalysis(ticker);
    } catch (error) {
      console.error('Analysis error:', error);
    }
  };

  // Handle Enter key in ticker input
  const handleTickerInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAnalyzeManualTicker();
    }
  };

  // Auto-trigger data loading when upcoming earnings needsRefresh changes
  useEffect(() => {
    if (loadingState.upcomingEarnings.needsRefresh && hasUpcomingEarningsAccess) {
      console.log('🔄 EARNINGS MONITOR - Triggering upcoming earnings refresh');
      loadData();
    }
  }, [loadingState.upcomingEarnings.needsRefresh, hasUpcomingEarningsAccess, loadData]);

  // Auto-trigger analysis loading when earningsAnalysis needsRefresh changes  
  useEffect(() => {
    if (loadingState.earningsAnalysis.needsRefresh && hasEarningsAnalysisAccess && upcomingEarnings.length > 0) {
      console.log('🔄 EARNINGS MONITOR - Triggering earnings analysis refresh');
      loadAnalysis(upcomingEarnings[0].ticker);
    }
  }, [loadingState.earningsAnalysis.needsRefresh, hasEarningsAnalysisAccess, upcomingEarnings.length]);

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
      setNeedsRefresh('upcomingEarnings', true);
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

  // Clear unlock flow flags when loading completes
  useEffect(() => {
    if (!loadingState.upcomingEarnings.isLoading && isUnlockFlow.upcomingEarnings) {
      console.log('🔄 EARNINGS MONITOR - Clearing upcoming earnings unlock flow flag after loading');
      setIsUnlockFlow(prev => ({ ...prev, upcomingEarnings: false }));
    }
  }, [loadingState.upcomingEarnings.isLoading, isUnlockFlow.upcomingEarnings]);

  useEffect(() => {
    if (!loadingState.earningsAnalysis.isLoading && isUnlockFlow.earningsAnalysis) {
      console.log('🔄 EARNINGS MONITOR - Clearing earnings analysis unlock flow flag after loading');
      setIsUnlockFlow(prev => ({ ...prev, earningsAnalysis: false }));
    }
  }, [loadingState.earningsAnalysis.isLoading, isUnlockFlow.earningsAnalysis]);

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
        <EarningsMonitorHeader
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          onRefresh={refreshData}
          isLoading={loadingState.upcomingEarnings.isLoading || loadingState.earningsAnalysis.isLoading}
          hasUnlockedComponents={unlockedComponents.earningsAnalysis || unlockedComponents.upcomingEarnings}
          isLight={isLight}
          cardBg={cardBg}
          cardBorder={cardBorder}
          textColor={textColor}
          subTextColor={subTextColor}
        />
        
        {/* Tabs */}
        <EarningsMonitorTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabActiveBg={tabActiveBg}
          tabActiveText={tabActiveText}
          tabInactiveBg={tabInactiveBg}
          tabInactiveText={tabInactiveText}
        />
        
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
                        <EarningsTable
                          sortedEarnings={sortedEarnings}
                          selectedTicker={selectedTicker}
                          onTickerClick={handleTickerClick}
                          analyzedTickers={analyzedTickers}
                          errors={errors}
                          textColor={textColor}
                          subTextColor={subTextColor}
                          headerBg={headerBg}
                          cardBorder={cardBorder}
                          isLight={isLight}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <LockedOverlay
                  title="Upcoming Earnings"
                  description="Unlock access to the comprehensive earnings calendar with real-time updates and detailed company information."
                  cost={COMPONENT_COSTS.upcomingEarnings}
                  componentKey="upcomingEarnings"
                  icon={<TrendingUp className="w-8 h-8 text-white" />}
                  onUnlock={handleUnlockComponent}
                  isLight={isLight}
                  textColor={textColor}
                  subTextColor={subTextColor}
                />
              )}
            </>
          )}
          
          {activeTab === 'analysis' && (
            <>
              {hasEarningsAnalysisAccess ? (
                <>
                  {loadingState.earningsAnalysis.isLoading ? (
                    <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-full`}>
                      <div className={`${headerBg} p-4`}>
                        <h2 className={`text-lg font-semibold ${textColor}`}>Earnings Analysis</h2>
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
                            Analyzing Earnings Data
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
                  ) : earningsAnalysis ? (
                    <EarningsAnalysisContent
                      earningsAnalysis={earningsAnalysis}
                      isLoading={loadingState.earningsAnalysis.isLoading}
                      error={errors.analysis}
                      isLight={isLight}
                      cardBg={cardBg}
                      cardBorder={cardBorder}
                      headerBg={headerBg}
                      textColor={textColor}
                      subTextColor={subTextColor}
                    />
                  ) : (
                    <EarningsAnalysisSearch
                      analysisTickerInput={analysisTickerInput}
                      setAnalysisTickerInput={setAnalysisTickerInput}
                      onAnalyzeManualTicker={handleAnalyzeManualTicker}
                      onTickerInputKeyPress={handleTickerInputKeyPress}
                      onLoadAnalysis={loadAnalysis}
                      upcomingEarningsCount={upcomingEarnings.length}
                      isLight={isLight}
                      cardBg={cardBg}
                      cardBorder={cardBorder}
                      textColor={textColor}
                      subTextColor={subTextColor}
                    />
                  )}
                </>
              ) : (
                <LockedOverlay
                  title="Earnings Analysis"
                  description="Unlock detailed earnings analysis for any ticker. Analyze historical performance, surprises, and financial metrics independently."
                  cost={COMPONENT_COSTS.earningsAnalysis}
                  componentKey="earningsAnalysis"
                  icon={<TrendingUp className="w-8 h-8 text-white" />}
                  onUnlock={handleUnlockComponent}
                  isLight={isLight}
                  textColor={textColor}
                  subTextColor={subTextColor}
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