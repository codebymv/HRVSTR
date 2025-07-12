import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import { useToast } from '../../contexts/ToastContext';
import { 
  checkComponentAccess, 
  storeUnlockSession, 
  getAllUnlockSessions,
  getSessionTimeRemainingFormatted 
} from '../../utils/sessionStorage';
import { TimeRange } from '../../types';
import { RefreshCw, Loader2, Key, Lock, Settings, TrendingUp, Zap, BarChart2,Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Custom hooks
import { useSentimentUnlock } from '../../hooks/useSentimentUnlock';
import { useSentimentLoading } from '../../hooks/useSentimentLoading';
import { useSentimentData } from '../../hooks/useSentimentData';

// Components
import SentimentChartCard from './SentimentChartCard';
import SentimentScoresSection from './SentimentScoresSection';
import RedditPostsSection from './RedditPostsSection';
import TierLimitDialog from '../UI/TierLimitDialog';

const LockedOverlay: React.FC<{
  title: string;
  description: string;
  cost: number;
  componentKey: 'chart' | 'scores' | 'reddit';
  icon: React.ReactNode;
  handleUnlockComponent: (component: 'chart' | 'scores' | 'reddit', cost: number) => Promise<any>;
  isLight: boolean;
  textColor: string;
  mutedTextColor: string;
}> = ({ title, description, cost, componentKey, icon, handleUnlockComponent, isLight, textColor, mutedTextColor }) => (
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
        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center mx-auto gap-2"
      >
        <Key className="w-4 h-4" />
        Unlock for {cost} Credits
      </button>
    </div>
  </div>
);

const SentimentDashboard: React.FC = () => {
  const { theme } = useTheme();
  const { tierInfo, refreshTierInfo } = useTier();
  const { showTierLimitDialog, closeTierLimitDialog, tierLimitDialog } = useTierLimits();
  const { info, warning } = useToast();
  const navigate = useNavigate();
  const isLight = theme === 'light';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  
  // Time range state
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // State for API key status
  const [redditApiKeysConfigured, setRedditApiKeysConfigured] = useState<boolean>(false);
  const [checkingApiKeys, setCheckingApiKeys] = useState<boolean>(true);
  
  // Get tier info - handle loading state properly to avoid showing locks during initialization
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  const isLoadingTier = tierInfo === null;
  // During tier loading, assume tier access to avoid showing locks prematurely
  const hasRedditTierAccess = isLoadingTier ? true : currentTier !== 'free';
  
  // Combined access: needs both tier access AND API keys configured
  const hasFullRedditAccess = hasRedditTierAccess && redditApiKeysConfigured;
  
  // 🔧 FIX: Stabilize Reddit access to prevent hook restarts during TierContext updates
  const [stableRedditAccess, setStableRedditAccess] = useState<boolean>(() => {
    return false; // Always start with false, will be updated when tier loads
  });
  
  // Update stable access when tier info or API keys change, but only if it represents a real change
  useEffect(() => {
    console.log('🔄 REDDIT ACCESS EFFECT:', {
      tierInfo: tierInfo !== null ? { tier: tierInfo.tier } : 'null',
      hasRedditTierAccess,
      redditApiKeysConfigured,
      hasFullRedditAccess,
      stableRedditAccess,
      currentTier
    });
    
    if (tierInfo !== null) { // Only proceed when tier info is actually loaded
      const newAccess = hasFullRedditAccess;
      if (newAccess !== stableRedditAccess) {
        console.log(`🔄 REDDIT ACCESS: Updating from ${stableRedditAccess} to ${newAccess} (tier: ${currentTier})`);
        console.log(`🔄 REDDIT ACCESS DETAILS: tierAccess=${hasRedditTierAccess}, keysConfigured=${redditApiKeysConfigured}`);
        setStableRedditAccess(newAccess);
        
        // If Reddit access changed, clear sentiment cache to force refresh with correct access level
        if (stableRedditAccess !== newAccess) {
          console.log('🔄 REDDIT ACCESS CHANGE: Clearing sentiment cache due to Reddit access change');
          localStorage.removeItem('sentiment_allSentiments');
          localStorage.removeItem('sentiment_allTickerSentiments');
          localStorage.removeItem('sentiment_cachedRedditPosts');
          localStorage.removeItem('sentiment_lastFetchTime');
        }
      } else {
        console.log('🔄 REDDIT ACCESS: No change needed', { current: stableRedditAccess, calculated: newAccess });
      }
    }
  }, [tierInfo, hasFullRedditAccess, stableRedditAccess, currentTier, hasRedditTierAccess, redditApiKeysConfigured]);

  // Use the new sentiment unlock hook
  const {
    unlockedComponents,
    isCheckingSessions,
    hasChartAccess,
    hasScoresAccess,
    hasRedditAccess,
    handleUnlockComponent,
    isFreshUnlock,
    COMPONENT_COSTS
  } = useSentimentUnlock();

  // Use the sentiment loading hook
  const {
    loadingState,
    loadingProgress,
    loadingStage,
    isRefreshing,
    errors,
    chartData,
    sentimentScores,
    redditPosts,
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

  // Combined ready state - ensures loading persists until ALL verifications complete
  const isFullyReady = !isCheckingSessions && !checkingApiKeys && tierInfo !== null;
  
  // Use sentiment data hook for the actual data fetching
  const {
    topSentiments,
    finvizSentiments,
    yahooSentiments,
    combinedSentiments,
    redditPosts: originalRedditPosts,
    chartData: originalChartData,
    loading,
    errors: dataErrors,
    hasMorePosts,
    handleLoadMorePosts: originalHandleLoadMorePosts,
    isDataLoading,
    refreshData: originalRefreshData
  } = useSentimentData(timeRange, stableRedditAccess, isFullyReady);

  // Debug logging for hook parameters
  useEffect(() => {
    console.log('🎯 SENTIMENT HOOK PARAMS:', {
      timeRange,
      stableRedditAccess,
      isFullyReady,
      hookCalled: true
    });
  }, [timeRange, stableRedditAccess, isFullyReady]);

  // Debug logging for sentiment data
  useEffect(() => {
    console.log('🔍 SENTIMENT DATA DEBUG:', {
      currentTier,
      stableRedditAccess,
      isFullyReady,
      topSentimentsLength: topSentiments.length,
      finvizSentimentsLength: finvizSentiments.length,
      yahooSentimentsLength: yahooSentiments.length,
      combinedSentimentsLength: combinedSentiments.length,
      redditPostsLength: redditPosts.length,
      loadingStates: loading,
      errors
    });
  }, [currentTier, stableRedditAccess, isFullyReady, topSentiments, finvizSentiments, yahooSentiments, combinedSentiments, redditPosts, loading, errors]);

  // Refresh data handler
  const refreshData = async () => {
    // Check if any components are actually unlocked
    const hasUnlockedComponents = unlockedComponents.chart || unlockedComponents.scores || unlockedComponents.reddit;
    
    if (!hasUnlockedComponents) {
      info('Please unlock at least one component before refreshing');
      return;
    }
    
    try {
      // Clear sentiment cache before refreshing
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      const response = await fetch(`${proxyUrl}/api/sentiment/clear-cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Cache cleared successfully:', result);
        info('Cache cleared - refreshing with fresh data');
      } else {
        console.warn('⚠️ Cache clearing failed, proceeding with refresh anyway');
        info('Refreshing data (cache clear failed)');
      }
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
      info('Refreshing data (cache clear unavailable)');
    }
    
    handleRefresh();
  };

  // Handle time range changes
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    setIsTransitioning(true);
    setTimeout(() => setIsTransitioning(false), 300);
  };
  
  // Check API key status on component mount AND when tier changes
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

    // Run check on mount and when tier changes
    checkApiKeyStatus();
    
    // Also refresh API key status periodically
    const interval = setInterval(checkApiKeyStatus, 10 * 60 * 1000); // Cut frequency in half: was 5 minutes, now 10 minutes
    
    return () => clearInterval(interval);
  }, [currentTier]); // 🔧 Added currentTier dependency to trigger refresh on tier changes


  // Simple handleLoadMorePosts without tier limits for now
  const handleLoadMorePosts = () => {
    originalHandleLoadMorePosts();
  };

  // Use COMPONENT_COSTS from the hook instead of declaring locally

  // Reddit Upgrade Card Component for free users
  const RedditUpgradeCard: React.FC = () => {
    const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
    const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
    const gradientFrom = isLight ? 'from-blue-500' : 'from-blue-600';
    const gradientTo = isLight ? 'to-purple-600' : 'to-purple-700';
    const buttonBg = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';
    
    return (
      <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} text-center`}>
        <div className={`w-16 h-16 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Lock className="w-8 h-8 text-white" />
        </div>
        
        <h3 className={`text-xl font-bold ${textColor} mb-2`}>
          Reddit Sentiment Analysis
        </h3>
        
        <p className={`${mutedTextColor} mb-4 max-w-md mx-auto`}>
          Unlock real-time Reddit sentiment analysis, social media monitoring, and community insights to enhance your market intelligence.
        </p>
        
        <div className={`${isLight ? 'bg-stone-200' : 'bg-gray-900'} rounded-lg p-4 mb-6`}>
          <h4 className={`font-semibold ${textColor} mb-2`}>Pro Features Include:</h4>
          <ul className={`text-sm ${mutedTextColor} space-y-1 text-left max-w-xs mx-auto`}>
            <li>• Live Reddit posts & sentiment</li>
            <li>• Social media trend analysis</li>
            <li>• Community sentiment tracking</li>
            <li>• Advanced filtering options</li>
            <li>• Real-time data updates</li>
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

  // Reddit Setup Card Component for Pro users without API keys
  const RedditSetupCard: React.FC = () => {
    const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
    const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
    const gradientFrom = isLight ? 'from-orange-500' : 'from-orange-600';
    const gradientTo = isLight ? 'to-red-600' : 'to-red-700';
    const buttonBg = isLight ? 'bg-orange-500 hover:bg-orange-600' : 'bg-orange-600 hover:bg-orange-700';
    const secondaryButtonBg = isLight ? 'bg-gray-500 hover:bg-gray-600' : 'bg-gray-600 hover:bg-gray-700';
    
    return (
      <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} text-center`}>
        <div className={`w-16 h-16 bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Key className="w-8 h-8 text-white" />
        </div>
        
        <h3 className={`text-xl font-bold ${textColor} mb-2`}>
          Setup Reddit API Keys
        </h3>
        
        <p className={`${mutedTextColor} mb-4 max-w-md mx-auto`}>
          Your Pro subscription includes Reddit sentiment analysis! Configure your Reddit API credentials to unlock real-time social media insights.
        </p>
        
        <div className={`${isLight ? 'bg-orange-50' : 'bg-orange-900/20'} rounded-lg p-4 mb-6 border ${isLight ? 'border-orange-200' : 'border-orange-800'}`}>
          <h4 className={`font-semibold ${textColor} mb-2`}>Quick Setup Steps:</h4>
          <ol className={`text-sm ${mutedTextColor} space-y-1 text-left max-w-xs mx-auto`}>
            <li>1. Visit Reddit's App Preferences</li>
            <li>2. Create a new application</li>
            <li>3. Copy your Client ID & Secret</li>
            <li>4. Add them in Settings → API Keys</li>
            <li>5. Enjoy Reddit sentiment data!</li>
          </ol>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/settings/api-keys')}
            className={`${buttonBg} text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center`}
          >
            <Settings className="w-4 h-4 mr-2" />
            Configure API Keys
          </button>
          <a
            href="https://www.reddit.com/prefs/apps"
            target="_blank"
            rel="noopener noreferrer"
            className={`${secondaryButtonBg} text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center`}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Get Reddit Keys
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex-1 ${isLight ? 'bg-stone-200' : 'bg-gray-950'} pb-8`}>
      <div className="container mx-auto p-4 lg:p-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          {/* Title row with refresh button */}
          <div className="flex justify-between items-center">
            <h1 className={`text-2xl font-bold ${textColor}`}>Sentiment Scraper</h1>
            
            <div className="flex gap-2">
              <button 
                className={`transition-colors rounded-full p-2 ${
                  // Show different styling based on unlock state
                  (unlockedComponents.chart || unlockedComponents.scores || unlockedComponents.reddit)
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white' // Unlocked: gradient purple
                    : 'bg-gray-400 cursor-not-allowed text-gray-200' // Locked: grayed out
                } ${(isDataLoading || loading.chart || loadingState.scores.isLoading || loadingState.reddit.isLoading) ? 'opacity-50' : ''}`}
                onClick={refreshData}
                disabled={(isDataLoading || loadingState.chart.isLoading || loadingState.scores.isLoading || loadingState.reddit.isLoading) || !(unlockedComponents.chart || unlockedComponents.scores || unlockedComponents.reddit)}
                title={
                  (unlockedComponents.chart || unlockedComponents.scores || unlockedComponents.reddit)
                    ? 'Refresh sentiment data'
                    : 'Unlock components to refresh data'
                }
              >
                {/* Only show spinner if components are unlocked AND loading */}
                {(unlockedComponents.chart || unlockedComponents.scores || unlockedComponents.reddit) && (isDataLoading || loadingState.chart.isLoading || loadingState.scores.isLoading || loadingState.reddit.isLoading) ? (
                  <Loader2 size={18} className="text-white animate-spin" />
                ) : (
                  <RefreshCw size={18} className={
                    // Gray icon when locked, white when unlocked
                    !(unlockedComponents.chart || unlockedComponents.scores || unlockedComponents.reddit)
                      ? 'text-gray-200' 
                      : 'text-white'
                  } />
                )}
              </button>
            </div>
          </div>
          
          {/* Description row */}
          <p className={`${mutedTextColor}`}>Track real-time sentiment across social platforms</p>
        </div>
        
        {/* Dashboard Layout - Show components with locked overlays */}
        <div className="space-y-6">
          {/* Main Content Grid */}
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
            {/* Sentiment Overview Chart */}
            {isCheckingSessions ? (
              // Show loading while checking sessions to prevent locked overlay flash
              <div className={`${isLight ? 'bg-stone-300' : 'bg-gray-800'} rounded-lg border ${isLight ? 'border-stone-400' : 'border-gray-700'} overflow-hidden h-96`}>
                <div className={`${isLight ? 'bg-stone-400' : 'bg-gray-900'} p-4`}>
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
                  <div className="w-full max-w-md">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: '50%' }}></div>
                    </div>
                    <div className={`text-xs ${mutedTextColor} mt-2 text-center`}>
                      Checking access...
                    </div>
                  </div>
                </div>
              </div>
            ) : unlockedComponents.chart ? (
            <SentimentChartCard
              chartData={chartData}
              timeRange={timeRange}
              loading={loading.chart}
              isTransitioning={isTransitioning}
              loadingProgress={loadingProgress}
              loadingStage={loadingStage}
              isDataLoading={isDataLoading}
              errors={{
                chart: errors.chart,
                rateLimited: false
              }}
              onRefresh={refreshData}
              hasRedditAccess={stableRedditAccess}
            />
              ) : (
                <LockedOverlay
                  title="Market Sentiment Chart"
                  description="Unlock real-time market sentiment timeline showing bullish, bearish, and neutral trends across multiple timeframes."
                  cost={COMPONENT_COSTS.chart}
                  componentKey="chart"
                  icon={<BarChart2 className="w-8 h-8 text-white" />}
                  handleUnlockComponent={handleUnlockComponent}
                  isLight={isLight}
                  textColor={textColor}
                  mutedTextColor={mutedTextColor}
                />
              )}
            
            {/* Sentiment Scores Section - Show on mobile between chart and reddit */}
            <div className="xl:hidden">
              {!isFullyReady ? (
                // Show loading while checking sessions to prevent locked overlay flash
                <div className={`${isLight ? 'bg-stone-300' : 'bg-gray-800'} rounded-lg border ${isLight ? 'border-stone-400' : 'border-gray-700'} overflow-hidden h-96`}>
                  <div className={`${isLight ? 'bg-stone-400' : 'bg-gray-900'} p-4`}>
                    <h2 className={`text-lg font-semibold ${textColor}`}>Sentiment Scores</h2>
                  </div>
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <Loader2 className="text-blue-500 animate-spin mb-4" size={32} />
                    <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                      Checking Access...
                    </h3>
                    <p className={`text-sm ${mutedTextColor} mb-4`}>
                      {isCheckingSessions && checkingApiKeys ? 'Verifying access and configuration...' :
                       isCheckingSessions ? 'Verifying component access...' : 
                       checkingApiKeys ? 'Checking configuration...' :
                       'Finalizing setup...'}
                    </p>
                    <div className="w-full max-w-md">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: '50%' }}></div>
                      </div>
                      <div className={`text-xs ${mutedTextColor} mt-2 text-center`}>
                        {isCheckingSessions && checkingApiKeys ? 'Running verifications...' :
                         isCheckingSessions ? 'Checking access...' : 
                         checkingApiKeys ? 'Validating setup...' :
                         'Almost ready...'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : unlockedComponents.scores ? (
              <SentimentScoresSection 
                redditSentiments={topSentiments}
                finvizSentiments={finvizSentiments}
                yahooSentiments={yahooSentiments}
                combinedSentiments={combinedSentiments}
                isLoading={loadingState.scores.isLoading}
                loadingProgress={loadingProgress}
                loadingStage={loadingStage}
                error={errors.scores}
                isRateLimited={false}
                hasRedditAccess={stableRedditAccess}
                hasRedditTierAccess={hasRedditTierAccess}
                redditApiKeysConfigured={redditApiKeysConfigured}
                isCheckingAccess={isCheckingSessions}
                isFreshUnlock={isFreshUnlock.scores}
              />
                ) : (
                  <LockedOverlay
                    title="Sentiment Scores"
                    description="Unlock real-time sentiment analysis for individual stocks from Reddit, FinViz, and Yahoo Finance."
                    cost={COMPONENT_COSTS.scores}
                    componentKey="scores"
                    icon={<BarChart2 className="w-8 h-8 text-white" />}
                    handleUnlockComponent={handleUnlockComponent}
                    isLight={isLight}
                    textColor={textColor}
                    mutedTextColor={mutedTextColor}
                  />
                )}
            </div>
            
            {/* Reddit Posts Section - Now appears last on mobile */}
            {(() => {
              console.log('🔍 REDDIT RENDER DEBUG:', {
                isCheckingSessions,
                checkingApiKeys,
                tierInfo: tierInfo !== null,
                isFullyReady,
                hasRedditTierAccess,
                redditApiKeysConfigured,
                'unlockedComponents.reddit': unlockedComponents.reddit,
                renderPath: !isFullyReady ? 'loading' : 
                           !hasRedditTierAccess ? 'upgrade' : 
                           !redditApiKeysConfigured ? 'setup' : 
                           unlockedComponents.reddit ? 'posts' : 'locked'
              });
              return null;

})()}
            {/* Show unified loading state until ALL verifications complete */}
            {!isFullyReady ? (
              // Show loading while checking sessions or API keys to prevent empty state flash
              <div className={`${isLight ? 'bg-stone-300' : 'bg-gray-800'} rounded-lg border ${isLight ? 'border-stone-400' : 'border-gray-700'} overflow-hidden h-96`}>
                <div className={`${isLight ? 'bg-stone-400' : 'bg-gray-900'} p-4`}>
                  <h2 className={`text-lg font-semibold ${textColor}`}>Reddit Posts</h2>
                </div>
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Loader2 className="text-blue-500 animate-spin mb-4" size={32} />
                  <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                    Checking Access...
                  </h3>
                  <p className={`text-sm ${mutedTextColor} mb-4`}>
                    {isCheckingSessions && checkingApiKeys ? 'Verifying access and configuration...' :
                     isCheckingSessions ? 'Verifying session access...' : 
                     checkingApiKeys ? 'Checking Reddit configuration...' :
                     'Finalizing setup...'}
                  </p>
                  <div className="w-full max-w-md">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: '50%' }}></div>
                    </div>
                    <div className={`text-xs ${mutedTextColor} mt-2 text-center`}>
                      {isCheckingSessions && checkingApiKeys ? 'Running verifications...' :
                       isCheckingSessions ? 'Checking access...' : 
                       checkingApiKeys ? 'Validating API keys...' :
                       'Almost ready...'}
                    </div>
                  </div>
                </div>
              </div>
            ) : !hasRedditTierAccess ? (
              // Free users - show upgrade card
              <RedditUpgradeCard />
            ) : !redditApiKeysConfigured ? (
              // Pro users without API keys - show setup card
              <RedditSetupCard />
            ) : (
                // Pro users with API keys - show normal Reddit posts or locked overlay
                unlockedComponents.reddit ? (
              <RedditPostsSection
                posts={redditPosts}
                isLoading={loadingState.reddit.isLoading}
                loadingProgress={loadingProgress}
                loadingStage={loadingStage}
                error={errors.reddit}
                hasMore={hasMorePosts}
                onLoadMore={handleLoadMorePosts}
                isCheckingAccess={isCheckingSessions}
                isFreshUnlock={isFreshUnlock.reddit}
              />
                ) : (
                  <LockedOverlay
                    title="Reddit Posts"
                    description="Access real-time Reddit posts and community discussions about market trends and stock sentiment."
                    cost={COMPONENT_COSTS.reddit}
                    componentKey="reddit"
                    icon={<BarChart2 className="w-8 h-8 text-white" />}
                    handleUnlockComponent={handleUnlockComponent}
                    isLight={isLight}
                    textColor={textColor}
                    mutedTextColor={mutedTextColor}
                  />
                )
            )}
          </div>
          
          {/* Sidebar - Hidden on mobile, shown on xl+ */}
          <div className="hidden xl:block xl:w-1/3 space-y-6">
            {/* Sentiment Scores Section */}
            {!isFullyReady ? (
              // Show loading while checking sessions to prevent locked overlay flash
              <div className={`${isLight ? 'bg-stone-300' : 'bg-gray-800'} rounded-lg border ${isLight ? 'border-stone-400' : 'border-gray-700'} overflow-hidden h-96`}>
                <div className={`${isLight ? 'bg-stone-400' : 'bg-gray-900'} p-4`}>
                  <h2 className={`text-lg font-semibold ${textColor}`}>Sentiment Scores</h2>
                </div>
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Loader2 className="text-blue-500 animate-spin mb-4" size={32} />
                  <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                    Checking Access...
                  </h3>
                  <p className={`text-sm ${mutedTextColor} mb-4`}>
                    {isCheckingSessions && checkingApiKeys ? 'Verifying access and configuration...' :
                     isCheckingSessions ? 'Verifying component access...' : 
                     checkingApiKeys ? 'Checking configuration...' :
                     'Finalizing setup...'}
                  </p>
                  <div className="w-full max-w-md">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: '50%' }}></div>
                    </div>
                    <div className={`text-xs ${mutedTextColor} mt-2 text-center`}>
                      {isCheckingSessions && checkingApiKeys ? 'Running verifications...' :
                       isCheckingSessions ? 'Checking access...' : 
                       checkingApiKeys ? 'Validating setup...' :
                       'Almost ready...'}
                    </div>
                  </div>
                </div>
              </div>
            ) : unlockedComponents.scores ? (
            <SentimentScoresSection 
              redditSentiments={topSentiments}
              finvizSentiments={finvizSentiments}
              yahooSentiments={yahooSentiments}
              combinedSentiments={combinedSentiments}
              isLoading={loadingState.scores.isLoading}
            loadingProgress={loadingProgress}
            loadingStage={loadingStage}
            error={errors.scores}
            isRateLimited={false}
              hasRedditAccess={stableRedditAccess}
              hasRedditTierAccess={hasRedditTierAccess}
              redditApiKeysConfigured={redditApiKeysConfigured}
              isCheckingAccess={isCheckingSessions}
              isFreshUnlock={isFreshUnlock.scores}
            />
              ) : (
                <LockedOverlay
                  title="Sentiment Scores"
                  description="Unlock detailed sentiment analysis for individual stocks with confidence scores and trend data."
                  cost={COMPONENT_COSTS.scores}
                  componentKey="scores"
                  icon={<BarChart2 className="w-8 h-8 text-white" />}
                  handleUnlockComponent={handleUnlockComponent}
                  isLight={isLight}
                  textColor={textColor}
                  mutedTextColor={mutedTextColor}
                />
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
    </div>
  );
};

export default SentimentDashboard;
