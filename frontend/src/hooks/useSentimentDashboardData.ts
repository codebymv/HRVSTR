import { useState, useEffect, useRef, useCallback } from 'react';
import { SentimentData, ChartData, TimeRange, RedditPost } from '../types';
import { fetchSentimentData, fetchRedditPosts, fetchTickerSentiments } from '../services/api';
import { 
  fetchWatchlistFinvizSentiment, 
  fetchWatchlistYahooSentiment,
  fetchWatchlistRedditSentiment 
} from '../services/watchlistSentimentClient';
import { mergeSentimentData, aggregateByTicker } from '../services/sentimentMerger';
import { ensureTickerDiversity } from '../services/tickerUtils';
import { generateChartData } from '../services/chartUtils';

// Simple logger with environment check
const isDev = process.env.NODE_ENV === 'development';
const logger = {
  log: (...args: any[]) => isDev && console.log(...args),
  error: (...args: any[]) => console.error(...args)
};

interface LoadingStates {
  sentiment: boolean;
  posts: boolean;
  chart: boolean;
}

interface ErrorStates {
  sentiment: string | null;
  posts: string | null;
  chart: string | null;
  rateLimited: boolean;
}

interface UseSentimentDashboardDataReturn {
  // Data
  redditPosts: RedditPost[];
  chartData: ChartData[];
  topSentiments: SentimentData[];
  finvizSentiments: SentimentData[];
  yahooSentiments: SentimentData[];
  combinedSentiments: SentimentData[];
  
  // Loading states
  loading: LoadingStates;
  loadingProgress: number;
  loadingStage: string;
  isDataLoading: boolean;
  isTransitioning: boolean;
  
  // Error states
  errors: ErrorStates;
  
  // Actions
  loadData: () => Promise<void>;
  refreshData: () => void;
  
  // Pagination
  redditPage: number;
  hasMorePosts: boolean;
  handleLoadMorePosts: () => void;
}

export const useSentimentDashboardData = (timeRange: TimeRange): UseSentimentDashboardDataReturn => {
  // Cache expiration time - 5 minutes
  const CACHE_EXPIRY = 5 * 60 * 1000;
  const POSTS_PER_PAGE = 10;

  // Request management
  const requestManagerRef = useRef<{
    controllers: Map<string, AbortController>;
    abort: (key?: string) => void;
    getSignal: (key: string) => AbortSignal;
  }>({
    controllers: new Map(),
    abort: (key?: string) => {
      if (key) {
        const controller = requestManagerRef.current.controllers.get(key);
        if (controller) {
          controller.abort();
          requestManagerRef.current.controllers.delete(key);
          logger.log(`Aborted request: ${key}`);
        }
      } else {
        // Abort all requests when no key is provided
        requestManagerRef.current.controllers.forEach((controller, key) => {
          controller.abort();
          logger.log(`Aborted request: ${key}`);
        });
        requestManagerRef.current.controllers.clear();
      }
    },
    getSignal: (key: string) => {
      // Abort any existing request with the same key
      requestManagerRef.current.abort(key);
      
      // Create a new controller for this request
      const controller = new AbortController();
      requestManagerRef.current.controllers.set(key, controller);
      return controller.signal;
    }
  });

  // Loading states - Always start with loading = true to prevent empty state flash
  const [loading, setLoading] = useState<LoadingStates>({
    sentiment: true,
    posts: true,
    chart: true
  });

  // Unified loading progress tracking
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...');

  // Error states
  const [errors, setErrors] = useState<ErrorStates>({
    sentiment: null,
    posts: null,
    chart: null,
    rateLimited: false,
  });

  // Data states
  const [redditPosts, setRedditPosts] = useState<RedditPost[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [topSentiments, setTopSentiments] = useState<SentimentData[]>([]);
  const [finvizSentiments, setFinvizSentiments] = useState<SentimentData[]>([]);
  const [yahooSentiments, setYahooSentiments] = useState<SentimentData[]>([]);
  const [combinedSentiments, setCombinedSentiments] = useState<SentimentData[]>([]);

  // Cached datasets (fetched once for the longest range)
  const [allSentiments, setAllSentiments] = useState<SentimentData[]>([]);
  const [allTickerSentiments, setAllTickerSentiments] = useState<SentimentData[]>([]);
  const [cachedRedditPosts, setCachedRedditPosts] = useState<RedditPost[]>([]);
  const [cacheTimestamp, setCacheTimestamp] = useState<number>(0);

  // Pagination state for Reddit posts
  const [redditPage, setRedditPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);

  // Helper function to update loading states consistently
  const updateLoadingState = useCallback((states: Partial<LoadingStates>) => {
    setLoading(prev => {
      const newState = { ...prev, ...states };
      
      // If all states are false, reset global loading
      const allComplete = Object.values(newState).every(state => state === false);
      if (allComplete) {
        setIsDataLoading(false);
        setIsTransitioning(false);
      }
      
      return newState;
    });
  }, []);

  const loadData = useCallback(async () => {
    // Cancel all pending requests
    requestManagerRef.current.abort();
    
    // Request keys for different data fetching operations
    const REQUEST_KEYS = {
      sentimentData: 'sentiment-data',
      redditPosts: 'reddit-posts',
      tickerSentiment: 'ticker-sentiment',
      finviz: 'finviz-sentiment',
      yahoo: 'yahoo-sentiment'
    };

    // Reset all states - ensure everything shows as loading
    updateLoadingState({
      sentiment: true,
      posts: true,
      chart: true
    });
    
    setErrors({
      sentiment: null,
      posts: null,
      chart: null,
      rateLimited: false
    });
    
    // Reset loading progress and start loading
    setLoadingProgress(0);
    setIsDataLoading(true);
    
    // Helper function to update progress
    const updateProgress = (progress: number, stage: string) => {
      // Ensure progress is always between 0-100
      const safeProgress = Math.min(Math.max(0, progress), 100);
      logger.log(`Loading progress: ${safeProgress}%, Stage: ${stage}`);
      setLoadingProgress(safeProgress);
      setLoadingStage(stage);
    };
    
    try {
      // Step 1: Fetch Reddit sentiment timeline data
      if (allSentiments.length === 0 || Date.now() - cacheTimestamp > CACHE_EXPIRY) {
        updateProgress(15, 'Downloading sentiment timeline...');
        const sentimentSignal = requestManagerRef.current.getSignal(REQUEST_KEYS.sentimentData);
        
        let sentimentData = await fetchSentimentData(timeRange, sentimentSignal);
        logger.log(`First fetch: ${sentimentData.length} sentiment data points from Reddit`);
        
        // If we only got a single data point, try again with a different timeframe
        if (sentimentData.length <= 1) {
          logger.log('Initial fetch returned minimal data, trying alternate timeframes...');
          try {
            const sentimentSignal2 = requestManagerRef.current.getSignal(REQUEST_KEYS.sentimentData + '-alt');
            const alternateData = await fetchSentimentData('1w', sentimentSignal2);
            if (alternateData.length > sentimentData.length) {
              logger.log(`Found more data with alternate timeframe: ${alternateData.length} points`);
              sentimentData = alternateData;
            }
          } catch (retryError) {
            logger.error('Error in data fetch retry:', retryError);
          }
        }
        
        setAllSentiments(sentimentData);
        setCacheTimestamp(Date.now());
      } else {
        updateProgress(15, 'Using cached Reddit sentiment data...');
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      logger.error('Sentiment error:', error);
      setErrors(prev => ({ ...prev, sentiment: error instanceof Error ? error.message : 'Failed to fetch sentiment data' }));
    }
    
    try {
      // Step 2: Fetch Reddit posts with pagination
      if (cachedRedditPosts.length === 0 || Date.now() - cacheTimestamp > CACHE_EXPIRY) {
        updateProgress(30, 'Fetching Reddit posts...');
        const postsSignal = requestManagerRef.current.getSignal(REQUEST_KEYS.redditPosts);
        
        try {
          const posts = await fetchRedditPosts(postsSignal);
          setCachedRedditPosts(posts);
          setRedditPosts(posts.slice(0, POSTS_PER_PAGE));
          setHasMorePosts(posts.length > POSTS_PER_PAGE);
          setRedditPage(1);
        } catch (error: any) {
          logger.error('Error fetching Reddit posts:', error);
          setErrors(prev => ({
            ...prev,
            posts: error.message || 'Failed to fetch Reddit posts'
          }));
        }
      } else {
        // Use cached posts
        setRedditPosts(cachedRedditPosts.slice(0, POSTS_PER_PAGE));
        setHasMorePosts(cachedRedditPosts.length > POSTS_PER_PAGE);
        setRedditPage(1);
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      logger.error('Reddit posts error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Reddit posts';
      const isRateLimited = error instanceof Error && 
        (error.message.includes('429') || 
         error.message.toLowerCase().includes('rate limit') || 
         error.message.toLowerCase().includes('too many requests'));
        
      setErrors(prev => ({ 
        ...prev, 
        posts: errorMessage,
        rateLimited: isRateLimited || prev.rateLimited
      }));
      updateLoadingState({ posts: false });
    }
    
    try {
      // Step 3: Fetch Reddit ticker sentiment data
      let redditTickerData: SentimentData[] = allTickerSentiments;
      if (allTickerSentiments.length === 0) {
        updateProgress(45, `Fetching ${timeRange} ticker sentiment data...`);
        const tickerSignal = requestManagerRef.current.getSignal(REQUEST_KEYS.tickerSentiment);
        // Use watchlist-based Reddit sentiment instead of generic fetchTickerSentiments
        redditTickerData = await fetchWatchlistRedditSentiment(timeRange, tickerSignal);
        setAllTickerSentiments(redditTickerData);
      }
      
      // Only process if we have sentiment data
      if (redditTickerData.length > 0) {
        // Get diverse set of tickers from Reddit data
        const diverseSentiments = ensureTickerDiversity(redditTickerData, 10);
        setTopSentiments(diverseSentiments);
        
        // Now fetch FinViz sentiment data using watchlist-based API
        let finvizData: SentimentData[] = [];
        try {
          updateProgress(60, 'Fetching FinViz sentiment data from your watchlist...');
          
          const finvizSignal = requestManagerRef.current.getSignal(REQUEST_KEYS.finviz);
          // Use watchlist-based FinViz sentiment instead of hardcoded tickers
          finvizData = await fetchWatchlistFinvizSentiment(finvizSignal);
          
          setFinvizSentiments(finvizData);
        } catch (finvizError) {
          logger.error('FinViz data error:', finvizError);
        }
        
        // Fetch Yahoo Finance sentiment using watchlist-based API
        let yahooData: SentimentData[] = [];
        try {
          updateProgress(75, 'Fetching Yahoo Finance sentiment data from your watchlist...');
          
          const yahooSignal = requestManagerRef.current.getSignal(REQUEST_KEYS.yahoo);
          // Use watchlist-based Yahoo sentiment instead of hardcoded tickers
          yahooData = await fetchWatchlistYahooSentiment(yahooSignal);
          
          setYahooSentiments(yahooData);
        } catch (yahooError) {
          logger.error('Yahoo Finance data error:', yahooError);
        }
        
        // Merge sentiment data from all three sources
        const mergedData = mergeSentimentData(diverseSentiments, finvizData, yahooData);
        const aggregatedData = aggregateByTicker(mergedData);
        
        // Ensure we maintain ticker diversity in the final output
        const finalSentiments = ensureTickerDiversity(aggregatedData, 8);
        setCombinedSentiments(finalSentiments);
      }
      
      updateLoadingState({ sentiment: false });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      logger.error('Ticker sentiment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch ticker sentiment data';
      const isRateLimited = error instanceof Error && 
        (error.message.includes('429') || 
         error.message.toLowerCase().includes('rate limit') || 
         error.message.toLowerCase().includes('too many requests'));
        
      setErrors(prev => ({ 
        ...prev, 
        sentiment: isRateLimited ? 'Rate limit exceeded. Please try again later.' : errorMessage,
        rateLimited: isRateLimited || prev.rateLimited
      }));
      updateLoadingState({ sentiment: false });
    }
    
    try {
      // Step 4: Generate chart data locally (no new API calls)
      updateProgress(85, 'Generating sentiment charts...');
      
      logger.log('Before chart generation, allSentiments:', allSentiments);
      
      // Directly create sentiment data if we have no data from the API fetch above
      if (allSentiments.length === 0) {
        logger.log('No sentiment data in state, attempting comprehensive direct fetch...');
        try {
          const directSentimentSignal = requestManagerRef.current.getSignal(REQUEST_KEYS.sentimentData + '-direct');
          let directSentimentData = await fetchSentimentData(timeRange, directSentimentSignal);
          logger.log(`Direct fetch returned ${directSentimentData.length} data points`);
          
          if (directSentimentData.length > 0) {
            setAllSentiments(directSentimentData);
            const chartData = generateChartData(directSentimentData, timeRange);
            setChartData(chartData);
          }
        } catch (directError) {
          logger.error('Direct sentiment fetch error:', directError);
          setErrors(prev => ({ ...prev, chart: 'Failed to generate chart data' }));
        }
      } else {
        // Generate chart data from cached sentiment data
        const chartData = generateChartData(allSentiments, timeRange);
        setChartData(chartData);
      }
      
      updateProgress(100, 'Complete!');
      updateLoadingState({ chart: false, posts: false });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      logger.error('Chart generation error:', error);
      setErrors(prev => ({ ...prev, chart: error instanceof Error ? error.message : 'Failed to generate chart data' }));
      updateLoadingState({ chart: false });
    }
  }, [timeRange, allSentiments, allTickerSentiments, cachedRedditPosts, cacheTimestamp, updateLoadingState]);

  // Filter Reddit posts based on time range
  useEffect(() => {
    if (cachedRedditPosts.length > 0) {
      const now = new Date();
      let cutoffDate: Date;
      
      switch (timeRange) {
        case '1d':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '3d':
          cutoffDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
          break;
        case '1w':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
      }
      
      // Filter cached posts
      const filteredPosts = cachedRedditPosts.filter(post => {
        const postDate = new Date(post.created);
        return postDate >= cutoffDate;
      });
      
      // Reset pagination when time range changes
      setRedditPage(1);
      setRedditPosts(filteredPosts.slice(0, POSTS_PER_PAGE));
      setHasMorePosts(filteredPosts.length > POSTS_PER_PAGE);
      
      console.log(`Displaying ${filteredPosts.length} Reddit posts for ${timeRange} time range`);
    }
  }, [cachedRedditPosts, timeRange]);

  // Load more posts handler
  const handleLoadMorePosts = useCallback(() => {
    // Don't load if already loading or no more posts
    if (!hasMorePosts || loading.posts) {
      return;
    }

    // Set loading state for posts
    updateLoadingState({ posts: true });

    try {
      const nextPage = redditPage + 1;
      const startIndex = (nextPage - 1) * POSTS_PER_PAGE;
      const endIndex = startIndex + POSTS_PER_PAGE;
      
      // Calculate cutoff date based on current time range
      const now = new Date();
      let cutoffDate: Date;
      
      switch (timeRange) {
        case '1d':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '3d':
          cutoffDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
          break;
        case '1w':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
      }
      
      // Filter posts based on time range
      const filteredPosts = cachedRedditPosts.filter(post => {
        const postDate = new Date(post.created);
        return postDate >= cutoffDate;
      });
      
      // Get the next page of filtered posts
      const newPosts = filteredPosts.slice(startIndex, endIndex);
      
      // Only update if we have new posts
      if (newPosts.length > 0) {
        setRedditPosts(prev => [...prev, ...newPosts]);
        setRedditPage(nextPage);
        setHasMorePosts(endIndex < filteredPosts.length);
      } else {
        setHasMorePosts(false);
      }
    } finally {
      // Always reset loading state
      updateLoadingState({ posts: false });
    }
  }, [redditPage, hasMorePosts, loading.posts, cachedRedditPosts, timeRange, updateLoadingState]);

  const refreshData = useCallback(() => {
    // Clear cache to force fresh data
    setAllSentiments([]);
    setAllTickerSentiments([]);
    setCachedRedditPosts([]);
    setCacheTimestamp(0);
    
    // Reset pagination
    setRedditPage(1);
    setHasMorePosts(true);
    
    // Reload data
    loadData();
  }, [loadData]);

  // Initial data load
  useEffect(() => {
    loadData();
  }, [timeRange]);

  // Regenerate chart data when time range changes (using cached sentiment data)
  useEffect(() => {
    if (allSentiments.length > 0) {
      logger.log(`Regenerating chart data for time range: ${timeRange}`);
      logger.log(`Using ${allSentiments.length} cached sentiment data points`);
      
      try {
        const chartData = generateChartData(allSentiments, timeRange);
        setChartData(chartData);
        logger.log(`Generated ${chartData.length} chart data points for ${timeRange}`);
      } catch (error) {
        logger.error('Error regenerating chart data:', error);
        setErrors(prev => ({ ...prev, chart: 'Failed to generate chart data for time range' }));
      }
    }
  }, [timeRange, allSentiments]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      requestManagerRef.current.abort();
    };
  }, []);

  return {
    // Data
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
    isTransitioning,
    
    // Error states
    errors,
    
    // Actions
    loadData,
    refreshData,
    
    // Pagination
    redditPage,
    hasMorePosts,
    handleLoadMorePosts
  };
}; 