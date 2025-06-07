import React, { useState, useEffect } from 'react';
import { TimeRange } from '../../types';
import { RefreshCw, Loader2, Crown, TrendingUp, BarChart2, MessageSquare, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import { useToast } from '../../contexts/ToastContext';
import { useSentimentUnlock } from '../../hooks/useSentimentUnlock';
import { useSentimentLoading } from '../../hooks/useSentimentLoading';
import { useSentimentData } from '../../hooks/useSentimentData';
import HarvestLoadingCard from '../UI/HarvestLoadingCard';
import ProgressBar from '../ProgressBar';
import SentimentChartCard from './SentimentChartCard';
import SentimentScoresSection from './SentimentScoresSection';
import RedditPostsSection from './RedditPostsSection';
import TierLimitDialog from '../UI/TierLimitDialog';

interface SentimentMonitorProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
}

const SentimentMonitor: React.FC<SentimentMonitorProps> = ({ onLoadingProgressChange }) => {
  const { theme } = useTheme();
  const { showTierLimitDialog, tierLimitDialog, closeTierLimitDialog } = useTierLimits();
  const { info } = useToast();
  
  // State management
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');
  
  // State for API key status (Reddit-specific)
  const [redditApiKeysConfigured, setRedditApiKeysConfigured] = useState<boolean>(false);
  const [checkingApiKeys, setCheckingApiKeys] = useState<boolean>(true);
  
  // Use the new sentiment unlock hook
  const {
    unlockedComponents,
    isCheckingSessions,
    currentTier,
    hasChartAccess,
    hasScoresAccess,
    hasRedditAccess,
    handleUnlockComponent: hookHandleUnlockComponent,
    COMPONENT_COSTS
  } = useSentimentUnlock();
  
  // Use the sentiment loading hook
  const {
    loadingState,
    loadingProgress,
    loadingStage,
    isFreshUnlock,
    isRefreshing,
    errors,
    setIsRefreshing,
    handleChartLoading,
    handleScoresLoading,
    handleRedditLoading,
    updateLoadingProgress,
    setFreshUnlockState,
    clearData,
    setNeedsRefresh,
    handleRefresh,
  } = useSentimentLoading(hasChartAccess, hasScoresAccess, hasRedditAccess, onLoadingProgressChange);
  
  const isLight = theme === 'light';
  
  // Theme-based styling (matching earnings/SEC filings)
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const headerBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subTextColor = isLight ? 'text-gray-600' : 'text-gray-400';
  
  // Reddit access management (stable to prevent hook cycling)
  const hasRedditTierAccess = currentTier !== 'free';
  const hasFullRedditAccess = hasRedditTierAccess && redditApiKeysConfigured;
  const [stableRedditAccess, setStableRedditAccess] = useState<boolean>(false);
  
  // Update stable Reddit access only when both tier and API keys are verified
  useEffect(() => {
    if (!checkingApiKeys) {
      const newAccess = hasFullRedditAccess;
      if (newAccess !== stableRedditAccess) {
        console.log(`🔄 REDDIT ACCESS: Updating from ${stableRedditAccess} to ${newAccess} (tier: ${currentTier})`);
        setStableRedditAccess(newAccess);
        
        // Clear sentiment cache if Reddit access changed
        if (stableRedditAccess !== newAccess) {
          console.log('🔄 REDDIT ACCESS CHANGE: Clearing sentiment cache due to Reddit access change');
          localStorage.removeItem('sentiment_allSentiments');
          localStorage.removeItem('sentiment_allTickerSentiments');
          localStorage.removeItem('sentiment_cachedRedditPosts');
          localStorage.removeItem('sentiment_lastFetchTime');
        }
      }
    }
  }, [hasFullRedditAccess, stableRedditAccess, currentTier, checkingApiKeys]);

  // Check Reddit API key status on mount and tier changes
  useEffect(() => {
    const checkApiKeyStatus = async () => {
      try {
        const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
          setRedditApiKeysConfigured(false);
          return;
        }
        
        console.log('🔑 Checking Reddit API key status for tier:', currentTier);
        
        const response = await fetch(`${proxyUrl}/api/settings/key-status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('🔑 API key status response:', data);
          if (data.success && data.dataSources) {
            const redditConfigured = data.dataSources.reddit || false;
            console.log(`🔑 Reddit API keys configured: ${redditConfigured}`);
            setRedditApiKeysConfigured(redditConfigured);
          } else {
            setRedditApiKeysConfigured(false);
          }
        } else {
          console.error('🔑 API key status check failed:', response.status);
          setRedditApiKeysConfigured(false);
        }
      } catch (error) {
        console.error('🔑 Error checking API key status:', error);
        setRedditApiKeysConfigured(false);
      } finally {
        setCheckingApiKeys(false);
      }
    };

    checkApiKeyStatus();
    const interval = setInterval(checkApiKeyStatus, 5 * 60 * 1000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [currentTier]);

  // Combined ready state
  const isFullyReady = !isCheckingSessions && !checkingApiKeys;
  
  // Use sentiment data hook for the actual data fetching (only when fully ready)
  const {
    topSentiments,
    finvizSentiments,
    yahooSentiments,
    combinedSentiments,
    redditPosts,
    chartData,
    loading,
    errors: dataErrors,
    hasMorePosts,
    handleLoadMorePosts: originalHandleLoadMorePosts,
    isDataLoading,
    refreshData: originalRefreshData
  } = useSentimentData(timeRange, stableRedditAccess, isFullyReady);



  // Sync loading states from useSentimentData to useSentimentLoading
  useEffect(() => {
    // Update chart loading state
    if (hasChartAccess) {
      const chartLoading = loading.chart || (chartData.length === 0 && !dataErrors.chart);
      handleChartLoading(chartLoading, dataErrors.chart);
    }
  }, [hasChartAccess, loading.chart, chartData.length, dataErrors.chart, handleChartLoading]);

  useEffect(() => {
    // Update scores loading state  
    if (hasScoresAccess) {
      const scoresLoading = loading.sentiment || (topSentiments.length === 0 && finvizSentiments.length === 0 && !dataErrors.sentiment);
      handleScoresLoading(scoresLoading, dataErrors.sentiment);
    }
  }, [hasScoresAccess, loading.sentiment, topSentiments.length, finvizSentiments.length, dataErrors.sentiment, handleScoresLoading]);

  useEffect(() => {
    // Update reddit loading state
    if (hasRedditAccess) {
      const redditLoading = loading.posts || (redditPosts.length === 0 && !dataErrors.posts);
      handleRedditLoading(redditLoading, dataErrors.posts);
    }
  }, [hasRedditAccess, loading.posts, redditPosts.length, dataErrors.posts, handleRedditLoading]);

  // Handle component unlocking
  const handleUnlockComponent = async (component: keyof typeof unlockedComponents, cost: number) => {
    try {
      await hookHandleUnlockComponent(component, cost);
      console.log('🔄 SENTIMENT MONITOR - Unlock completed for:', component);
    } catch (error) {
      console.error('🔄 SENTIMENT MONITOR - Unlock failed for:', component, error);
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
          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium transition-all hover:from-blue-600 hover:to-purple-700 flex items-center justify-center mx-auto"
        >
          <Crown className="w-4 h-4 mr-2" />
          Unlock Component
        </button>
      </div>
    </div>
  );

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
            <h1 className={`text-xl font-bold ${textColor}`}>Sentiment Monitor</h1>
            <p className={`text-sm ${subTextColor}`}>Track real-time sentiment across social platforms</p>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Time range selector */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className={`py-1 px-2 rounded text-sm ${cardBg} ${textColor} border ${cardBorder} ${
                !(hasChartAccess || hasScoresAccess || hasRedditAccess)
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
              disabled={isRefreshing || !(hasChartAccess || hasScoresAccess || hasRedditAccess)}
              title={
                (hasChartAccess || hasScoresAccess || hasRedditAccess)
                  ? 'Select time range'
                  : 'Unlock components to change time range'
              }
            >
              <option value="1d">1 Day</option>
              <option value="1w">1 Week</option>
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
            </select>
            
            {/* Refresh button */}
            <button
              className={`transition-colors rounded-full p-2 ${
                // Show different styling based on unlock state
                (hasChartAccess || hasScoresAccess || hasRedditAccess)
                  ? `${isLight ? 'bg-blue-500' : 'bg-blue-600'} hover:${isLight ? 'bg-blue-600' : 'bg-blue-700'} text-white` // Unlocked: normal blue
                  : 'bg-gray-400 cursor-not-allowed text-gray-200' // Locked: grayed out
              } ${isRefreshing ? 'opacity-50' : ''}`}
              onClick={handleRefresh}
              disabled={isRefreshing || !(hasChartAccess || hasScoresAccess || hasRedditAccess)}
              title={
                (hasChartAccess || hasScoresAccess || hasRedditAccess)
                  ? 'Refresh sentiment data'
                  : 'Unlock components to refresh data'
              }
            >
              {/* Only show spinner if components are unlocked AND loading */}
              {(hasChartAccess || hasScoresAccess || hasRedditAccess) && isRefreshing ? (
                <Loader2 size={18} className="text-white animate-spin" />
              ) : (
                <RefreshCw size={18} className={
                  // Gray icon when locked, white when unlocked
                  !(hasChartAccess || hasScoresAccess || hasRedditAccess)
                    ? 'text-gray-200' 
                    : 'text-white'
                } />
              )}
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 p-6 h-full">
            {/* Chart Section - Full Width */}
            <div className="xl:col-span-2">
              {isCheckingSessions ? (
                // Show loading while checking sessions to prevent locked overlay flash
                <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-96`}>
                  <div className={`${headerBg} p-4`}>
                    <h2 className={`text-lg font-semibold ${textColor}`}>Market Sentiment Chart</h2>
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
              ) : hasChartAccess ? (
                <>
                  {loading.chart || (chartData.length === 0 && !dataErrors.chart) ? (
                    <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-96`}>
                      <div className={`${headerBg} p-4`}>
                        <h2 className={`text-lg font-semibold ${textColor}`}>Market Sentiment Chart</h2>
                      </div>
                      {isFreshUnlock.chart ? (
                        <HarvestLoadingCard
                          progress={loadingProgress}
                          stage={loadingStage}
                          operation="sentiment-chart"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                          <Loader2 className="text-blue-500 animate-spin mb-4" size={32} />
                          <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                            Loading Chart Data
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
                    <SentimentChartCard
                      chartData={chartData}
                      loading={loading.chart}
                      isTransitioning={false}
                      loadingProgress={loadingProgress}
                      loadingStage={loadingStage}
                      isDataLoading={isRefreshing}
                      timeRange={timeRange}
                      onTimeRangeChange={setTimeRange}
                      errors={{
                        chart: errors.chart || dataErrors.chart,
                        rateLimited: false
                      }}
                      onRefresh={handleRefresh}
                      hasRedditAccess={stableRedditAccess}
                    />
                  )}
                </>
              ) : (
                <LockedOverlay
                  title="Market Sentiment Chart"
                  description="Unlock real-time market sentiment timeline showing bullish, bearish, and neutral trends across multiple timeframes."
                  cost={COMPONENT_COSTS.chart}
                  componentKey="chart"
                  icon={<BarChart2 className="w-8 h-8 text-white" />}
                />
              )}
            </div>

            {/* Sentiment Scores Section */}
            <div>
              {isCheckingSessions ? (
                // Show loading while checking sessions to prevent locked overlay flash
                <SentimentScoresSection
                  redditSentiments={[]}
                  finvizSentiments={[]}
                  yahooSentiments={[]}
                  combinedSentiments={[]}
                  isLoading={false}
                  loadingProgress={50}
                  loadingStage="Checking access..."
                  error={null}
                  isCheckingAccess={true}
                  hasRedditAccess={stableRedditAccess}
                />
              ) : hasScoresAccess ? (
                <>
                  {loading.sentiment ? (
                    <SentimentScoresSection
                      redditSentiments={[]}
                      finvizSentiments={[]}
                      yahooSentiments={[]}
                      combinedSentiments={[]}
                      isLoading={true}
                      loadingProgress={loadingProgress}
                      loadingStage={loadingStage}
                      error={null}
                      isFreshUnlock={isFreshUnlock.scores}
                      hasRedditAccess={stableRedditAccess}
                    />
                  ) : (
                    <SentimentScoresSection
                      redditSentiments={topSentiments}
                      finvizSentiments={finvizSentiments}
                      yahooSentiments={yahooSentiments}
                      combinedSentiments={combinedSentiments}
                      isLoading={loading.sentiment}
                      loadingProgress={loadingProgress}
                      loadingStage={loadingStage}
                      error={dataErrors.sentiment}
                      isRateLimited={false}
                      hasRedditAccess={stableRedditAccess}
                    />
                  )}
                </>
              ) : (
                <LockedOverlay
                  title="Sentiment Scores"
                  description="Access detailed sentiment analysis and scoring across multiple data sources and tickers."
                  cost={COMPONENT_COSTS.scores}
                  componentKey="scores"
                  icon={<BarChart2 className="w-8 h-8 text-white" />}
                />
              )}
            </div>

            {/* Reddit Posts Section */}
            <div>
              {isCheckingSessions ? (
                // Show loading while checking sessions to prevent locked overlay flash
                <RedditPostsSection
                  posts={[]}
                  isLoading={false}
                  loadingProgress={50}
                  loadingStage="Checking access..."
                  error={null}
                  isCheckingAccess={true}
                />
              ) : !hasRedditTierAccess ? (
                // Tier-based lock for free users (can't access Reddit API keys)
                <div className={`${isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'} rounded-lg border p-8 text-center relative overflow-hidden`}>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-8 h-8 text-white" />
                    </div>
                    
                    <h3 className={`text-xl font-bold ${textColor} mb-2`}>
                      Reddit Posts
                    </h3>
                    
                    <p className={`${subTextColor} mb-4 max-w-md mx-auto`}>
                      Reddit API integration is available with Pro tier or higher. Upgrade to monitor real-time Reddit discussions and sentiment from financial communities.
                    </p>
                    
                    <div className={`${isLight ? 'bg-blue-50' : 'bg-blue-900/20'} rounded-lg p-4 mb-6 border ${isLight ? 'border-blue-200' : 'border-blue-800'}`}>
                      <h4 className={`font-semibold ${textColor} mb-2`}>What you get with Pro:</h4>
                      <ul className={`text-sm ${subTextColor} space-y-1 text-left max-w-xs mx-auto`}>
                        <li>• Real-time Reddit posts from financial communities</li>
                        <li>• Sentiment analysis of discussions</li>
                        <li>• Configure your own Reddit API credentials</li>
                        <li>• Bypass rate limits with your own keys</li>
                        <li>• Enhanced market sentiment tracking</li>
                      </ul>
                    </div>
                    
                    <button
                      onClick={() => window.location.href = '/settings/tiers'}
                      className={`${isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center mx-auto`}
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade to Pro
                    </button>
                    
                    {/* <p className={`text-xs ${subTextColor} mt-3`}>
                      Current tier: <span className="font-medium capitalize">{currentTier}</span>
                    </p> */}
                  </div>
                </div>
              ) : hasRedditAccess ? (
                <>
                  {loading.posts || (redditPosts.length === 0 && !dataErrors.posts) ? (
                    <RedditPostsSection
                      posts={[]}
                      isLoading={true}
                      loadingProgress={loadingProgress}
                      loadingStage={loadingStage}
                      error={null}
                      isFreshUnlock={isFreshUnlock.reddit}
                    />
                  ) : (
                    <RedditPostsSection
                      posts={redditPosts}
                      isLoading={loading.posts}
                      loadingProgress={loadingProgress}
                      loadingStage={loadingStage}
                      error={dataErrors.posts}
                      hasMore={hasMorePosts}
                      onLoadMore={originalHandleLoadMorePosts}
                    />
                  )}
                </>
              ) : (
                <LockedOverlay
                  title="Reddit Posts"
                  description="Monitor real-time Reddit discussions and sentiment from financial communities."
                  cost={COMPONENT_COSTS.reddit}
                  componentKey="reddit"
                  icon={<MessageSquare className="w-8 h-8 text-white" />}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Tier Limit Dialog */}
      <TierLimitDialog
        isOpen={tierLimitDialog.isOpen}
        onClose={closeTierLimitDialog}
        featureName={tierLimitDialog.featureName}
        message={tierLimitDialog.message}
        upgradeMessage={tierLimitDialog.upgradeMessage}
        context={tierLimitDialog.context}
      />
    </>
  );
};

export default SentimentMonitor; 