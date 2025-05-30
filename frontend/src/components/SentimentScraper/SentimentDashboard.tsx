import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import { TimeRange } from '../../types';
import { RefreshCw, Loader2, Crown, Lock, Settings, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Custom hooks
import { useSentimentData } from '../../hooks/useSentimentData';
import { useTimeRangeDebounce } from '../../hooks/useTimeRangeDebounce';

// Components
import SentimentChartCard from './SentimentChartCard';
import SentimentScoresSection from './SentimentScoresSection';
import RedditPostsSection from './RedditPostsSection';
import TierLimitDialog from '../UI/TierLimitDialog';

const SentimentDashboard: React.FC = () => {
  const { theme } = useTheme();
  const { tierInfo } = useTier();
  const { showTierLimitDialog, tierLimitDialog, closeTierLimitDialog } = useTierLimits();
  const navigate = useNavigate();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  
  // State for time range selection
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');
  
  // State to track if tier limit dialog has been shown for this session
  const [tierLimitDialogShown, setTierLimitDialogShown] = useState(false);
  
  // State for API key status
  const [redditApiKeysConfigured, setRedditApiKeysConfigured] = useState<boolean>(false);
  const [checkingApiKeys, setCheckingApiKeys] = useState<boolean>(true);
  
  // Reddit posts tier limits (posts per page = 10)
  const REDDIT_TIER_LIMITS = {
    free: 0,         // No access to Reddit posts
    pro: -1,         // unlimited
    elite: -1,       // unlimited
    institutional: -1 // unlimited
  };
  
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  const redditPostLimit = REDDIT_TIER_LIMITS[currentTier as keyof typeof REDDIT_TIER_LIMITS] || REDDIT_TIER_LIMITS.free;
  const hasRedditTierAccess = currentTier !== 'free';
  
  // Combined access: needs both tier access AND API keys configured
  const hasFullRedditAccess = hasRedditTierAccess && redditApiKeysConfigured;
  
  // Check API key status on component mount
  useEffect(() => {
    const checkApiKeyStatus = async () => {
      try {
        const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
        const response = await fetch(`${proxyUrl}/api/settings/key-status`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.dataSources) {
            setRedditApiKeysConfigured(data.dataSources.reddit || false);
          }
        }
      } catch (error) {
        console.error('Error checking API key status:', error);
        setRedditApiKeysConfigured(false);
      } finally {
        setCheckingApiKeys(false);
      }
    };

    checkApiKeyStatus();
  }, []);

  // Refresh API key status when the user returns to this tab/window
  useEffect(() => {
    const refreshApiKeyStatus = async () => {
      try {
        const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
        const response = await fetch(`${proxyUrl}/api/settings/key-status`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.dataSources) {
            setRedditApiKeysConfigured(data.dataSources.reddit || false);
          }
        }
      } catch (error) {
        console.error('Error refreshing API key status:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshApiKeyStatus();
      }
    };

    const handleFocus = () => {
      refreshApiKeyStatus();
    };

    // Add event listeners for when user returns to the tab
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Cleanup event listeners
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Use sentiment data hook for all data management
  const {
    // Data states
    redditPosts,
    chartData,
    topSentiments,
    finvizSentiments,
    yahooSentiments,
    combinedSentiments,
    
    // Loading states
    loading,
    loadingProgress,
    loadingStage,
    isDataLoading,
    isTransitioning: dataTransitioning,
    
    // Error states
    errors,
    
    // Pagination
    redditPage,
    hasMorePosts,
    
    // Actions
    refreshData,
    handleLoadMorePosts: originalHandleLoadMorePosts,
  } = useSentimentData(timeRange, hasFullRedditAccess);
  
  // Use time range debounce hook for smooth transitions
  const {
    isTransitioning: uiTransitioning,
    handleTimeRangeChange,
    setIsTransitioning,
  } = useTimeRangeDebounce();
  
  // Combined transitioning state
  const isTransitioning = dataTransitioning || uiTransitioning;
  
  // Custom handleLoadMorePosts with tier limit checking
  const handleLoadMorePosts = () => {
    // Check if tier limit would be exceeded and dialog hasn't been shown yet
    if (redditPostLimit !== -1 && redditPosts.length >= redditPostLimit && !tierLimitDialogShown) {
      // Show tier limit dialog with Reddit context
      showTierLimitDialog(
        'Reddit Posts',
        `You've reached the Reddit posts limit for the ${currentTier === 'free' ? 'Free' : currentTier} tier (${redditPosts.length}/${redditPostLimit} posts). Upgrade for unlimited access to social sentiment data.`,
        'Upgrade to Pro for unlimited Reddit posts, advanced sentiment analysis, and real-time social media monitoring across all platforms.',
        'reddit'
      );
      setTierLimitDialogShown(true);
      return;
    }
    
    // If under limit, proceed with normal loading
    if (redditPostLimit === -1 || redditPosts.length < redditPostLimit) {
      originalHandleLoadMorePosts();
    }
  };

  // Handle time range changes with debouncing
  const onTimeRangeChange = (range: TimeRange) => {
    // Prevent unnecessary changes if the range is the same
    if (range === timeRange) {
      return;
    }
    
    // Reset tier limit dialog state when changing time ranges
    setTierLimitDialogShown(false);
    
    handleTimeRangeChange(range, (newRange) => {
      setTimeRange(newRange);
      // Reset transitioning state after a short delay to allow data to load
      setTimeout(() => setIsTransitioning(false), 300);
    });
  };

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
          onClick={() => showTierLimitDialog(
            'Reddit Sentiment',
            'Reddit sentiment analysis is a Pro feature. Upgrade to access real-time social media monitoring and community insights.',
            'Unlock Reddit posts, sentiment analysis, and advanced social media monitoring with HRVSTR Pro.',
            'reddit'
          )}
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
            
            <button 
              className={`${isLight ? 'bg-blue-500' : 'bg-blue-600'} hover:${isLight ? 'bg-blue-600' : 'bg-blue-700'} rounded-full p-2 transition-colors ${isDataLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={refreshData}
              disabled={isDataLoading}
              title="Refresh Data"
            >
              {isDataLoading ? (
                <Loader2 size={18} className="text-white animate-spin" />
              ) : (
                <RefreshCw size={18} className="text-white" />
              )}
            </button>
          </div>
          
          {/* Description row */}
          <p className={`${mutedTextColor}`}>Track real-time sentiment across social platforms</p>
        </div>
        
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
            {/* Sentiment Overview Chart */}
            <SentimentChartCard
              chartData={chartData}
              timeRange={timeRange}
              onTimeRangeChange={onTimeRangeChange}
              loading={loading.chart}
              isTransitioning={isTransitioning}
              loadingProgress={loadingProgress}
              loadingStage={loadingStage}
              isDataLoading={isDataLoading}
              errors={{
                chart: errors.chart,
                rateLimited: errors.rateLimited
              }}
              onRefresh={refreshData}
              hasRedditAccess={hasFullRedditAccess}
            />
            
            {/* Sentiment Scores Section - Show on mobile between chart and reddit */}
            <div className="xl:hidden">
              <SentimentScoresSection 
                redditSentiments={topSentiments}
                finvizSentiments={finvizSentiments}
                yahooSentiments={yahooSentiments}
                combinedSentiments={combinedSentiments}
                isLoading={loading.sentiment}
                loadingProgress={loadingProgress}
                loadingStage={loadingStage}
                error={errors.sentiment}
                isRateLimited={errors.rateLimited}
                hasRedditAccess={hasFullRedditAccess}
                hasRedditTierAccess={hasRedditTierAccess}
                redditApiKeysConfigured={redditApiKeysConfigured}
              />
            </div>
            
            {/* Reddit Posts Section - Now appears last on mobile */}
            {checkingApiKeys ? (
              // Loading state while checking API keys
              <div className={`${isLight ? 'bg-stone-300' : 'bg-gray-800'} rounded-lg p-6 border ${isLight ? 'border-stone-400' : 'border-gray-700'} text-center`}>
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className={`${mutedTextColor}`}>Checking Reddit configuration...</p>
              </div>
            ) : !hasRedditTierAccess ? (
              // Free users - show upgrade card
              <RedditUpgradeCard />
            ) : !redditApiKeysConfigured ? (
              // Pro users without API keys - show setup card
              <RedditSetupCard />
            ) : (
              // Pro users with API keys - show normal Reddit posts
              <RedditPostsSection
                posts={redditPosts}
                isLoading={loading.posts}
                loadingProgress={loadingProgress}
                loadingStage={loadingStage}
                error={errors.posts}
                hasMore={redditPostLimit === -1 ? hasMorePosts : (hasMorePosts && (!tierLimitDialogShown || redditPosts.length < redditPostLimit))}
                onLoadMore={handleLoadMorePosts}
              />
            )}
          </div>
          
          {/* Sidebar - Hidden on mobile, shown on xl+ */}
          <div className="hidden xl:block xl:w-1/3 space-y-6">
            {/* Sentiment Scores Section */}
            <SentimentScoresSection 
              redditSentiments={topSentiments}
              finvizSentiments={finvizSentiments}
              yahooSentiments={yahooSentiments}
              combinedSentiments={combinedSentiments}
              isLoading={loading.sentiment}
              loadingProgress={loadingProgress}
              loadingStage={loadingStage}
              error={errors.sentiment}
              isRateLimited={errors.rateLimited}
              hasRedditAccess={hasFullRedditAccess}
              hasRedditTierAccess={hasRedditTierAccess}
              redditApiKeysConfigured={redditApiKeysConfigured}
            />
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
