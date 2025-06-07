import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AlertTriangle, Info, Loader2, MessageSquare, TrendingUp, Globe, Layers } from 'lucide-react';
import SentimentCard from './SentimentCard';
import ProgressBar from '../ProgressBar';
import { SentimentData } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

type DataSource = 'reddit' | 'finviz' | 'yahoo' | 'combined';

interface SentimentScoresSectionProps {
  redditSentiments: SentimentData[];
  finvizSentiments: SentimentData[];
  yahooSentiments: SentimentData[];
  combinedSentiments: SentimentData[];
  isLoading: boolean;
  loadingProgress?: number;
  loadingStage?: string;
  error: string | null;
  isRateLimited?: boolean;
  hasRedditAccess?: boolean;
  hasRedditTierAccess?: boolean;
  redditApiKeysConfigured?: boolean;
  className?: string;
  // New props to match the access-based pattern
  isCheckingAccess?: boolean;
  isFreshUnlock?: boolean;
}

const SentimentScoresSection: React.FC<SentimentScoresSectionProps> = ({
  redditSentiments,
  finvizSentiments,
  yahooSentiments,
  combinedSentiments,
  isLoading,
  loadingProgress = 0,
  loadingStage = 'Loading...',
  error,
  isRateLimited = false,
  hasRedditAccess = true,
  hasRedditTierAccess,
  redditApiKeysConfigured,
  className = '',
  isCheckingAccess = false,
  isFreshUnlock = false
}) => {
  const [dataSource, setDataSource] = useState<DataSource>('combined');
  
  // Infinite scroll state
  const [displayedItems, setDisplayedItems] = useState<SentimentData[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Infinite scroll refs
  const loadingRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(false);
  const lastLoadTimeRef = useRef(0);
  
  // Constants for infinite scroll
  const ITEMS_PER_PAGE = 4;
  const THROTTLE_MS = 500;
  
  // Temporary cache clearing function for debugging
  const clearTickerSentimentCache = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('❌ No auth token found for cache clearing');
        alert('No authentication token found. Please log in again.');
        return;
      }
      
      console.log('🧹 Starting cache clear process...');
      console.log('🔑 Using auth token:', token.substring(0, 20) + '...');
      
      const response = await fetch(`http://localhost:3001/api/sentiment-unified/cache`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Cache clear response status:', response.status);
      console.log('📡 Cache clear response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Cache clear result:', result);
        console.log('🔄 Cache cleared successfully! Refresh the page to reload with fresh data.');
        alert('✅ Cache cleared! Please refresh the page to see fresh sentiment data.\n\nWatch the console for enhanced logging during fresh data processing.');
      } else {
        const errorText = await response.text();
        console.error('❌ Cache clear failed:', response.status, errorText);
        alert(`❌ Failed to clear cache: ${response.status}\n${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error during cache clear:', error);
      alert(`❌ Error clearing cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Theme-specific styling using ThemeContext
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';

  // Prevent Reddit selection for free users and switch away from Reddit if they lose access
  React.useEffect(() => {
    if (!hasRedditAccess && dataSource === 'reddit') {
      setDataSource('combined');
    }
  }, [hasRedditAccess, dataSource]);

  // Custom setDataSource function that checks Reddit access
  const handleDataSourceChange = (source: DataSource) => {
    if (source === 'reddit' && !hasRedditAccess) {
      return; // Prevent changing to Reddit for free users
    }
    setDataSource(source);
  };

  // Get the appropriate sentiment data based on the selected source
  const getSentimentData = () => {
    switch (dataSource) {
      case 'reddit':
        return redditSentiments;
      case 'finviz':
        return finvizSentiments;
      case 'yahoo':
        return yahooSentiments;
      case 'combined':
        // If combined data is empty but we have individual source data, show Reddit first
        if (combinedSentiments.length === 0 && redditSentiments.length > 0) {
          console.log('[CARD RENDER] Combined empty, falling back to Reddit data:', redditSentiments.length);
          return redditSentiments;
        }
        return combinedSentiments;
      default:
        return [];
    }
  };

  const currentSentiments = getSentimentData();

  // Handle loading more items for infinite scroll
  const handleLoadMore = useCallback(() => {
    // Don't load if already loading, no more items, or too soon since last load
    if (isLoadingMoreRef.current || !hasMore || isLoadingMore) {
      return;
    }

    const now = Date.now();
    if (now - lastLoadTimeRef.current < THROTTLE_MS) {
      return;
    }

    isLoadingMoreRef.current = true;
    lastLoadTimeRef.current = now;
    setIsLoadingMore(true);

    // Calculate next batch of items
    const startIndex = displayedItems.length;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const nextItems = currentSentiments.slice(startIndex, endIndex);

    // Simulate a small delay for better UX
    setTimeout(() => {
      if (nextItems.length > 0) {
        setDisplayedItems(prev => [...prev, ...nextItems]);
        setHasMore(endIndex < currentSentiments.length);
      } else {
        setHasMore(false);
      }
      
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
    }, 300);
  }, [currentSentiments, displayedItems.length, hasMore, isLoadingMore]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (!loadingRef.current || isLoadingMore || !hasMore || currentSentiments.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoadingMoreRef.current) {
          handleLoadMore();
        }
      },
      { rootMargin: '50px' }
    );

    observer.observe(loadingRef.current);

    return () => {
      if (loadingRef.current) observer.unobserve(loadingRef.current);
    };
  }, [handleLoadMore, isLoadingMore, hasMore, currentSentiments.length]);

  // Reset displayed items when data source or sentiments change
  useEffect(() => {
    const sentiments = getSentimentData();
    console.log('[CARD RENDER] Resetting for dataSource:', dataSource, 'length:', sentiments.length);
    
    const initialItems = sentiments.slice(0, ITEMS_PER_PAGE);
    console.log('[CARD RENDER] Initial items:', initialItems.length, 'from total:', sentiments.length);
    
    setDisplayedItems(initialItems);
    setHasMore(ITEMS_PER_PAGE < sentiments.length);
    setIsLoadingMore(false);
    isLoadingMoreRef.current = false;
  }, [dataSource, redditSentiments, finvizSentiments, yahooSentiments, combinedSentiments]);

  // Debug conditional rendering
  useEffect(() => {
    console.log('[CARD RENDER] Conditional check:', {
      currentSentimentsLength: currentSentiments?.length || 0,
      displayedItemsLength: displayedItems.length,
      dataSource,
      shouldShowCards: currentSentiments?.length > 0,
      isLoading,
      isRateLimited,
      error
    });
  }, [currentSentiments, displayedItems, dataSource, isLoading, isRateLimited, error]);

  // Use hard-coded values to match the chart percentages
  const getSourceDistribution = () => {
    // For individual sources, return 100% for the selected source
    if (dataSource === 'reddit') return { reddit: hasRedditAccess ? 100 : 0, finviz: 0, yahoo: 0 };
    if (dataSource === 'finviz') return { reddit: 0, finviz: 100, yahoo: 0 };
    if (dataSource === 'yahoo') return { reddit: 0, finviz: 0, yahoo: 100 };
    
    // For combined view, calculate actual percentages from the real data
    if (dataSource === 'combined') {
      if (hasRedditAccess && combinedSentiments.length > 0) {
        // Calculate actual source distribution from combined sentiment data
        const sourceCounts = { reddit: 0, finviz: 0, yahoo: 0 };
        
        combinedSentiments.forEach(item => {
          if (item.source === 'reddit') sourceCounts.reddit++;
          else if (item.source === 'finviz') sourceCounts.finviz++;
          else if (item.source === 'yahoo') sourceCounts.yahoo++;
        });
        
        const total = sourceCounts.reddit + sourceCounts.finviz + sourceCounts.yahoo;
        
        if (total > 0) {
          return {
            reddit: Math.round((sourceCounts.reddit / total) * 100),
            finviz: Math.round((sourceCounts.finviz / total) * 100),
            yahoo: Math.round((sourceCounts.yahoo / total) * 100)
          };
        }
      }
      
      // Fallback for free users or when no data
      if (!hasRedditAccess) {
        // Calculate from FinViz and Yahoo only
        const finvizCount = finvizSentiments.length;
        const yahooCount = yahooSentiments.length;
        const total = finvizCount + yahooCount;
        
        if (total > 0) {
          return {
            reddit: 0,
            finviz: Math.round((finvizCount / total) * 100),
            yahoo: Math.round((yahooCount / total) * 100)
          };
        }
        
        return { reddit: 0, finviz: 60, yahoo: 40 }; // Default fallback
      }
      
      // Default fallback when no data available
      return { reddit: 72, finviz: 16, yahoo: 12 };
    }
    
    console.log('Unknown data source:', dataSource);
    return { reddit: 0, finviz: 0, yahoo: 0 };
  };

  const distribution = getSourceDistribution();

  return (
    <div className={`${cardBgColor} rounded-lg p-4 lg:p-5 border ${borderColor} ${className} flex flex-col`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className={`text-lg font-medium ${textColor}`}>Sentiment Scores</h3>
        <div className="flex items-center space-x-2">
        <div className={`flex space-x-1 ${cardBgColor} rounded-full p-1`}>
            <button
              className={`p-1.5 rounded-full transition-all relative ${
                dataSource === 'reddit' 
                  ? hasRedditAccess 
                    ? 'bg-orange-100 text-orange-500' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : hasRedditAccess
                    ? 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    : hasRedditTierAccess
                      ? 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                      : 'text-gray-400 cursor-not-allowed'
              }`}
              onClick={() => handleDataSourceChange('reddit')}
              disabled={!hasRedditAccess}
              title={
                hasRedditAccess 
                  ? "Reddit" 
                  : hasRedditTierAccess
                    ? "Reddit (API keys required)"
                    : "Reddit (Pro feature)"
              }
            >
              <MessageSquare size={18} />
              {!hasRedditTierAccess ? (
                <span className="text-xs absolute -top-1 -right-1">🔒</span>
              ) : !redditApiKeysConfigured ? (
                <span className="text-xs absolute -top-1 -right-1">⚙️</span>
              ) : null}
            </button>
            <button
              className={`p-1.5 rounded-full transition-all ${dataSource === 'finviz' ? 'bg-amber-100 text-amber-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => handleDataSourceChange('finviz')}
              title="FinViz"
            >
              <TrendingUp size={18} />
            </button>
            <button
              className={`p-1.5 rounded-full transition-all ${dataSource === 'yahoo' ? 'bg-blue-100 text-blue-500' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => handleDataSourceChange('yahoo')}
              title="Yahoo Finance"
            >
              <Globe size={18} />
            </button>
            <button
              className={`p-1.5 rounded-full transition-all ${dataSource === 'combined' ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => handleDataSourceChange('combined')}
              title="All Sources"
            >
              <Layers size={18} />
            </button>
          </div>
        </div>
      </div>
      
      {!isLoading && !isRateLimited && !error && (
        <div className="flex items-center mb-3 px-1 text-xs">
          <span className={mutedTextColor}>Data sources:</span>
          <div className="flex ml-2 space-x-2">
            {dataSource === 'reddit' || dataSource === 'combined' ? (
              <span className={`flex items-center space-x-1 rounded-full px-2 py-0.5 ${
                hasRedditAccess 
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  : hasRedditTierAccess
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-400 opacity-60'
              }`}>
                <MessageSquare size={12} className={
                  hasRedditAccess 
                    ? "text-orange-500" 
                    : hasRedditTierAccess 
                      ? "text-yellow-600" 
                      : "text-gray-400"
                } />
                <span>{dataSource === 'reddit' ? '100%' : `${Math.round(distribution.reddit)}%`}</span>
                {!hasRedditTierAccess ? (
                  <span className="text-xs">🔒</span>
                ) : !redditApiKeysConfigured ? (
                  <span className="text-xs">⚙️</span>
                ) : null}
              </span>
            ) : null}
            {dataSource === 'finviz' || dataSource === 'combined' ? (
              <span className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5 text-gray-700 dark:text-gray-300">
                <TrendingUp size={12} className="text-amber-500" />
                <span>{dataSource === 'finviz' ? '100%' : `${Math.round(distribution.finviz)}%`}</span>
              </span>
            ) : null}
            {dataSource === 'yahoo' || dataSource === 'combined' ? (
              <span className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5 text-gray-700 dark:text-gray-300">
                <Globe size={12} className="text-blue-500" />
                <span>{dataSource === 'yahoo' ? '100%' : `${Math.round(distribution.yahoo)}%`}</span>
              </span>
            ) : null}
          </div>
        </div>
      )}
      
      {/* Show checking access state first */}
      {isCheckingAccess ? (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <Loader2 className="text-blue-500 animate-spin mb-4" size={32} />
          <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
            Checking Access...
          </h3>
          <p className={`text-sm ${mutedTextColor} mb-4`}>
            Verifying component access...
          </p>
          <div className="w-full max-w-md">
            <ProgressBar progress={50} />
            <div className={`text-xs ${mutedTextColor} mt-2 text-center`}>
              Checking access...
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          {isFreshUnlock ? (
            // Fresh unlock with harvest loading
            <>
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-6 mb-4">
                <Loader2 className="text-white animate-spin" size={40} />
              </div>
              <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                Harvesting Sentiment Data
              </h3>
              <p className={`text-sm ${mutedTextColor} mb-4`}>
                {loadingStage}
              </p>
              <div className="w-full max-w-md">
                <ProgressBar progress={loadingProgress} />
                <div className={`text-xs ${mutedTextColor} mt-2 text-center`}>
                  {loadingProgress}% complete
                </div>
              </div>
            </>
          ) : (
            // Regular loading for cache loads
            <>
              <Loader2 className="mb-2 text-blue-500 animate-spin" size={32} />
              <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                Loading Sentiment Scores
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
            </>
          )}
        </div>
      ) : currentSentiments?.length > 0 ? (
        <div 
          ref={containerRef}
          className="flex flex-col space-y-4 max-h-[700px] overflow-y-auto pr-2"
        >
          {(() => {
            console.log('[CARD RENDER] About to render', displayedItems.length, 'cards');
            
            return (
              <>
                {displayedItems.map((data, index) => {
                  // Ensure unique key even if ticker is undefined
                  const uniqueKey = `${dataSource}-${data?.ticker || 'unknown'}-${index}`;
                  
                  console.log(`[CARD RENDER] Item ${index}:`, {
                    ticker: data?.ticker,
                    hasData: !!data,
                    willRender: !!(data && data.ticker)
                  });
                  
                  // Skip rendering if data is invalid
                  if (!data || !data.ticker) {
                    console.log(`[CARD RENDER] Skipping item ${index} - invalid data`);
                    return null;
                  }

                  return (
                    <SentimentCard 
                      key={uniqueKey} 
                      data={data}
                    />
                  );
                })}
              </>
            );
          })()}
          
          {/* Infinite scroll loading indicator */}
          <div 
            ref={loadingRef}
            className="w-full h-[80px] flex justify-center items-center"
            style={{ contain: 'layout size' }}
          >
            {isLoadingMore && hasMore ? (
              <div className="flex flex-col items-center">
                <Loader2 className="mb-2 text-blue-500 animate-spin" size={20} />
                <p className={`text-sm ${mutedTextColor}`}>Loading more sentiment data...</p>
              </div>
            ) : hasMore ? (
              <div className="h-[60px] opacity-0" /> // Invisible spacer when not loading
            ) : displayedItems.length > ITEMS_PER_PAGE ? (
              <div className={`text-sm ${mutedTextColor} text-center py-4`}>
                All {currentSentiments.length} sentiment scores loaded
              </div>
            ) : null}
          </div>
          
        </div>
      ) : isRateLimited ? (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <AlertTriangle className="mb-2 text-red-500" size={32} />
          <p className={`text-lg font-semibold ${textColor}`}>Rate Limit Exceeded</p>
          <p className={`mt-2 ${mutedTextColor}`}>The Reddit API is currently rate limiting requests. Please wait a moment and try again later.</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <AlertTriangle className="mb-2 text-yellow-500" size={32} />
          <p className={textColor}>{error}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <Info className={`mb-2 ${mutedTextColor}`} size={32} />
          {dataSource === 'yahoo' ? (
            <>
              <p className={`${textColor} font-medium mb-2`}>Yahoo Finance data unavailable</p>
              <p className={mutedTextColor}>The Yahoo Finance API integration is not currently returning data.</p>
              <p className={mutedTextColor}>Please use the Reddit, Finviz, or All tabs for available sentiment data.</p>
            </>
          ) : (
            <>
              <p className={`${textColor} font-medium mb-2`}>No sentiment data available</p>
              <p className={`${mutedTextColor} mb-4`}>Add stocks to your watchlist to see sentiment analysis from {dataSource === 'combined' ? 'FinViz, Yahoo Finance' + (hasRedditAccess ? ', and Reddit' : '') : dataSource}.</p>
              <button
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors mb-2"
                onClick={clearTickerSentimentCache}
              >
                🧹 Clear Cache & Retry
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SentimentScoresSection;
