import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import { useToast } from '../../contexts/ToastContext';
import { useSentimentUnlock } from '../../hooks/useSentimentUnlock';
import { useSentimentLoading } from '../../hooks/useSentimentLoading';
import { useSentimentData } from '../../hooks/useSentimentData';
import { TimeRange } from '../../types';
import { RefreshCw, Loader2, Crown, Lock, Settings, Key, TrendingUp, Zap, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Components
import SentimentChartCard from './SentimentChartCard';
import SentimentScoresSection from './SentimentScoresSection';
import RedditPostsSection from './RedditPostsSection';
import TierLimitDialog from '../UI/TierLimitDialog';
import HarvestLoadingCard from '../UI/HarvestLoadingCard';
import ProgressBar from '../ProgressBar';

const SentimentDashboard: React.FC = () => {
  const { theme } = useTheme();
  const { showTierLimitDialog, tierLimitDialog, closeTierLimitDialog } = useTierLimits();
  const { info } = useToast();
  const navigate = useNavigate();
  const isLight = theme === 'light';
  
  // Theme-based styling
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-800';
  const headerBg = isLight ? 'bg-stone-400' : 'bg-gray-800';
  
  // Time range state
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // State for API key status (Reddit-specific)
  const [redditApiKeysConfigured, setRedditApiKeysConfigured] = useState<boolean>(false);
  const [checkingApiKeys, setCheckingApiKeys] = useState<boolean>(true);
  
  // Use the sentiment unlock hook (follows earnings pattern)
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

  // Use the sentiment loading hook (follows earnings pattern)
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
  } = useSentimentLoading(hasChartAccess, hasScoresAccess, hasRedditAccess);

  // Reddit access state (stable to prevent hook cycling)
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
      }
    }
  }, [hasFullRedditAccess, stableRedditAccess, currentTier, checkingApiKeys]);

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

  // Handle time range changes
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    setIsTransitioning(true);
    
    // Clear existing data and errors
    clearData();
    
    // Trigger refresh for unlocked components
    if (unlockedComponents.chart) {
      setNeedsRefresh('chart', true);
    }
    if (unlockedComponents.scores) {
      setNeedsRefresh('scores', true);
    }
    if (unlockedComponents.reddit) {
      setNeedsRefresh('reddit', true);
    }
    
    setTimeout(() => setIsTransitioning(false), 300);
  };

  // Handle component unlocking
  const handleUnlockComponent = async (component: keyof typeof unlockedComponents, cost: number) => {
    try {
      await hookHandleUnlockComponent(component, cost);
      console.log('🔄 SENTIMENT DASHBOARD - Unlock completed for:', component);
    } catch (error) {
      console.error('🔄 SENTIMENT DASHBOARD - Unlock failed for:', component, error);
    }
  };

  // Refresh data handler
  const refreshData = () => {
    const hasUnlockedComponents = unlockedComponents.chart || unlockedComponents.scores || unlockedComponents.reddit;
    
    if (!hasUnlockedComponents) {
      info('Please unlock at least one component before refreshing');
      return;
    }
    
    handleRefresh();
  };

  // Handle loading more posts
  const handleLoadMorePosts = () => {
    if (hasRedditAccess) {
      originalHandleLoadMorePosts();
    } else {
      info('Please unlock Reddit posts to load more content');
    }
  };

  // Component for locked overlays (follows earnings pattern)
  const LockedOverlay: React.FC<{
    title: string;
    description: string;
    cost: number;
    componentKey: keyof typeof unlockedComponents;
    icon: React.ReactNode;
  }> = ({ title, description, cost, componentKey, icon }) => (
    <div className={`${isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'} rounded-lg border p-8 text-center relative overflow-hidden`}>
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600" />
      </div>
      
      <div className="relative z-10">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
        
        <h3 className={`text-xl font-bold ${textColor} mb-2`}>
          {title}
        </h3>
        
        <p className={`${mutedTextColor} mb-6 max-w-sm mx-auto`}>
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
        <div className={`${headerBg} p-4 rounded-t-lg border-b ${cardBorder}`}>
          <div className="flex items-center justify-between">
            <h1 className={`text-xl font-bold ${textColor}`}>
              Sentiment Dashboard
            </h1>
            
            <div className="flex items-center gap-3">
              {/* Time Range Selector */}
              <select
                value={timeRange}
                onChange={(e) => handleTimeRangeChange(e.target.value as TimeRange)}
                className={`px-3 py-2 rounded-lg border ${cardBorder} ${cardBg} ${textColor} text-sm`}
                disabled={isTransitioning}
              >
                <option value="1d">1 Day</option>
                <option value="3d">3 Days</option>
                <option value="1w">1 Week</option>
              </select>
              
              {/* Refresh Button */}
              <button
                onClick={refreshData}
                disabled={isRefreshing || isTransitioning}
                className={`p-2 rounded-lg ${cardBg} border ${cardBorder} ${textColor} hover:bg-opacity-80 transition-colors disabled:opacity-50`}
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-6 p-6">
          {/* Chart Section */}
          <div className="xl:col-span-2">
            {isCheckingSessions ? (
              <div className={`${cardBg} rounded-lg border ${cardBorder} overflow-hidden h-96`}>
                <div className={`${headerBg} p-4`}>
                  <h2 className={`text-lg font-semibold ${textColor}`}>Market Sentiment Chart</h2>
                </div>
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Loader2 className="text-blue-500 animate-spin mb-4" size={32} />
                  <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                    Checking Access...
                  </h3>
                  <p className={`text-sm ${mutedTextColor} mb-4`}>
                    Verifying component access...
                  </p>
                </div>
              </div>
            ) : hasChartAccess ? (
              <>
                {loadingState.chart.isLoading ? (
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
                        <p className={`text-sm ${mutedTextColor} mb-4`}>
                          Loading from cache...
                        </p>
                        <div className="w-full max-w-md">
                          <ProgressBar progress={loadingProgress} />
                          <div className={`text-xs ${mutedTextColor} mt-2 text-center`}>
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
                    isTransitioning={isTransitioning}
                    loadingProgress={loadingProgress}
                    loadingStage={loadingStage}
                    isDataLoading={loading.chart}
                    errors={{
                      chart: errors.chart,
                      rateLimited: false
                    }}
                    onRefresh={refreshData}
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
            {hasScoresAccess ? (
              <SentimentScoresSection
                topSentiments={topSentiments}
                finvizSentiments={finvizSentiments}
                yahooSentiments={yahooSentiments}
                combinedSentiments={combinedSentiments}
                isLoading={loading.scores}
                errors={{
                  scores: errors.scores,
                  rateLimited: false
                }}
                onRefresh={refreshData}
                hasRedditAccess={stableRedditAccess}
              />
            ) : (
              <LockedOverlay
                title="Sentiment Scores"
                description="Access detailed sentiment analysis and scoring across multiple data sources and tickers."
                cost={COMPONENT_COSTS.scores}
                componentKey="scores"
                icon={<TrendingUp className="w-8 h-8 text-white" />}
              />
            )}
          </div>

          {/* Reddit Posts Section */}
          <div>
            {hasRedditAccess ? (
              <RedditPostsSection
                redditPosts={redditPosts}
                isLoading={loading.reddit}
                hasMorePosts={hasMorePosts}
                onLoadMore={handleLoadMorePosts}
                errors={{
                  reddit: errors.reddit,
                  rateLimited: false
                }}
                onRefresh={refreshData}
                hasRedditAccess={stableRedditAccess}
              />
            ) : (
              <LockedOverlay
                title="Reddit Posts"
                description="Monitor real-time Reddit discussions and sentiment from financial communities."
                cost={COMPONENT_COSTS.reddit}
                componentKey="reddit"
                icon={<Key className="w-8 h-8 text-white" />}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SentimentDashboard; 