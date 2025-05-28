import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { TimeRange } from '../../types';
import { RefreshCw, Loader2 } from 'lucide-react';

// Custom hooks
import { useSentimentData } from '../../hooks/useSentimentData';
import { useTimeRangeDebounce } from '../../hooks/useTimeRangeDebounce';

// Components
import SentimentChartCard from './SentimentChartCard';
import SentimentScoresSection from './SentimentScoresSection';
import RedditPostsSection from './RedditPostsSection';

const SentimentDashboard: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  
  // State for time range selection
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');
  
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
    handleLoadMorePosts,
  } = useSentimentData(timeRange);
  
  // Use time range debounce hook for smooth transitions
  const {
    isTransitioning: uiTransitioning,
    handleTimeRangeChange,
    setIsTransitioning,
  } = useTimeRangeDebounce();
  
  // Combined transitioning state
  const isTransitioning = dataTransitioning || uiTransitioning;
  
  // Handle time range changes with debouncing
  const onTimeRangeChange = (range: TimeRange) => {
    // Prevent unnecessary changes if the range is the same
    if (range === timeRange) {
      return;
    }
    
    handleTimeRangeChange(range, (newRange) => {
      setTimeRange(newRange);
      // Reset transitioning state after a short delay to allow data to load
      setTimeout(() => setIsTransitioning(false), 300);
    });
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
            />
            
            {/* Reddit Posts Section */}
            <RedditPostsSection
              posts={redditPosts}
              isLoading={loading.posts}
              loadingProgress={loadingProgress}
              loadingStage={loadingStage}
              error={errors.posts}
              hasMore={hasMorePosts}
              onLoadMore={handleLoadMorePosts}
            />
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
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentimentDashboard;
