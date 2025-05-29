import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTier } from '../../contexts/TierContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import { TimeRange } from '../../types';
import { RefreshCw, Loader2, Crown, Lock } from 'lucide-react';

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
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  
  // State for time range selection
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');
  
  // State to track if tier limit dialog has been shown for this session
  const [tierLimitDialogShown, setTierLimitDialogShown] = useState(false);
  
  // Reddit posts tier limits (posts per page = 10)
  const REDDIT_TIER_LIMITS = {
    free: 0,         // No access to Reddit posts
    pro: -1,         // unlimited
    elite: -1,       // unlimited
    institutional: -1 // unlimited
  };
  
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  const redditPostLimit = REDDIT_TIER_LIMITS[currentTier as keyof typeof REDDIT_TIER_LIMITS] || REDDIT_TIER_LIMITS.free;
  const hasRedditAccess = currentTier !== 'free';
  
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
  } = useSentimentData(timeRange, hasRedditAccess);
  
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

  return (
    <div className={`flex-1 ${isLight ? 'bg-stone-200' : 'bg-gray-950'} pb-8`}>
      <div className="container mx-auto p-4 lg:p-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className={`text-2xl font-bold ${textColor}`}>Sentiment Scraper</h1>
            <p className={`${mutedTextColor} mt-1`}>Track real-time sentiment across social platforms</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
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
              hasRedditAccess={hasRedditAccess}
            />
            
            {/* Reddit Posts Section */}
            {hasRedditAccess ? (
              <RedditPostsSection
                posts={redditPosts}
                isLoading={loading.posts}
                loadingProgress={loadingProgress}
                loadingStage={loadingStage}
                error={errors.posts}
                hasMore={redditPostLimit === -1 ? hasMorePosts : (hasMorePosts && (!tierLimitDialogShown || redditPosts.length < redditPostLimit))}
                onLoadMore={handleLoadMorePosts}
              />
            ) : (
              <RedditUpgradeCard />
            )}
          </div>
          
          {/* Sidebar */}
          <div className="xl:w-1/3 space-y-6">
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
              hasRedditAccess={hasRedditAccess}
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
