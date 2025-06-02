import { useState, useEffect, useRef, useCallback } from 'react';
import { SentimentData, ChartData, TimeRange, RedditPost as RedditPostType } from '../types';
import { fetchSentimentData, fetchRedditPosts, fetchTickerSentiments, fetchAggregatedMarketSentiment } from '../services/api';
import { mergeSentimentData, aggregateByTicker } from '../services/sentimentMerger';
import { ensureTickerDiversity } from '../services/tickerUtils';
import { generateChartData } from '../services/chartUtils';
import { 
  fetchWatchlistFinvizSentiment, 
  fetchWatchlistYahooSentiment,
  fetchWatchlistRedditSentiment 
} from '../services/watchlistSentimentClient';
import { useTier } from '../contexts/TierContext';

// Simple logger with environment check
const isDev = process.env.NODE_ENV === 'development';
const logger = {
  log: (...args: any[]) => isDev && console.log(...args),
  error: (...args: any[]) => console.error(...args)
};

interface SentimentDataHookReturn {
  // Data states
  redditPosts: RedditPostType[];
  chartData: ChartData[];
  topSentiments: SentimentData[];
  finvizSentiments: SentimentData[];
  yahooSentiments: SentimentData[];
  combinedSentiments: SentimentData[];
  
  // Loading states
  loading: {
    sentiment: boolean;
    posts: boolean;
    chart: boolean;
  };
  loadingProgress: number;
  loadingStage: string;
  isDataLoading: boolean;
  isTransitioning: boolean;
  
  // Error states
  errors: {
    sentiment: string | null;
    posts: string | null;
    chart: string | null;
    rateLimited: boolean;
  };
  
  // Pagination
  redditPage: number;
  hasMorePosts: boolean;
  
  // Actions
  refreshData: () => void;
  handleLoadMorePosts: () => void;
}

interface UseAbortableRequests {
  controllers: Map<string, AbortController>;
  abort: (key?: string) => void;
  getSignal: (key: string) => AbortSignal;
}

function useAbortableRequests(): UseAbortableRequests {
  const requestManagerRef = useRef<UseAbortableRequests>({
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
  
  return requestManagerRef.current;
}

export function useSentimentData(timeRange: TimeRange, hasRedditAccess: boolean = true, apiKeysReady: boolean = true): SentimentDataHookReturn {
  const requestManager = useAbortableRequests();
  const { tierInfo } = useTier();
  
  // Cache expiration time - 5 minutes
  const CACHE_EXPIRY = 5 * 60 * 1000;
  const POSTS_PER_PAGE = 10;
  
  // Ref to prevent double loading in React StrictMode
  const loadingRef = useRef(false);
  
  // Refs to access current cached data without triggering re-renders
  const allSentimentsRef = useRef<SentimentData[]>([]);
  const allTickerSentimentsRef = useRef<SentimentData[]>([]);
  const cachedRedditPostsRef = useRef<RedditPostType[]>([]);
  const cacheTimestampRef = useRef<number>(0);
  
  // Loading states
  const [loading, setLoading] = useState({
    sentiment: true,
    posts: true,
    chart: true
  });
  
  // Unified loading progress tracking
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...');
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  
  // Error states
  const [errors, setErrors] = useState<{
    sentiment: string | null;
    posts: string | null;
    chart: string | null;
    rateLimited: boolean;
  }>({
    sentiment: null,
    posts: null,
    chart: null,
    rateLimited: false,
  });
  
  // Data states
  const [redditPosts, setRedditPosts] = useState<RedditPostType[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [topSentiments, setTopSentiments] = useState<SentimentData[]>([]);
  const [finvizSentiments, setFinvizSentiments] = useState<SentimentData[]>([]);
  const [yahooSentiments, setYahooSentiments] = useState<SentimentData[]>([]);
  const [combinedSentiments, setCombinedSentiments] = useState<SentimentData[]>([]);
  
  // Cached datasets (also stored as state for UI access)
  const [allSentiments, setAllSentiments] = useState<SentimentData[]>([]);
  const [allTickerSentiments, setAllTickerSentiments] = useState<SentimentData[]>([]);
  const [cachedRedditPosts, setCachedRedditPosts] = useState<RedditPostType[]>([]);
  const [cacheTimestamp, setCacheTimestamp] = useState<number>(0);
  
  // Pagination state for Reddit posts
  const [redditPage, setRedditPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  
  // Helper function to update loading states consistently
  const updateLoadingState = useCallback((states: Partial<typeof loading>) => {
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
  
  // Helper function to update progress
  const updateProgress = useCallback((progress: number, stage: string) => {
    const safeProgress = Math.min(Math.max(0, progress), 100);
    logger.log(`Loading progress: ${safeProgress}%, Stage: ${stage}`);
    setLoadingProgress(safeProgress);
    setLoadingStage(stage);
  }, []);
  
  const loadData = useCallback(async () => {
    // Prevent double loading in React StrictMode
    if (loadingRef.current) {
      logger.log('Load already in progress, skipping duplicate request');
      return;
    }
    loadingRef.current = true;
    
    try {
      // Cancel all pending requests
      requestManager.abort();
      
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
      
      try {
        // Step 1: Fetch market sentiment timeline data for chart visualization
        if (allSentimentsRef.current.length === 0 || Date.now() - cacheTimestampRef.current > CACHE_EXPIRY) {
          updateProgress(15, hasRedditAccess ? 'Downloading sentiment timeline from all sources...' : 'Downloading sentiment timeline (FinViz + Yahoo)...');
          const sentimentSignal = requestManager.getSignal(REQUEST_KEYS.sentimentData);
          
          // Use market sentiment data for chart (provides time-series data)
          let sentimentData = await fetchAggregatedMarketSentiment(timeRange, sentimentSignal, hasRedditAccess);
          logger.log(`Aggregated market sentiment: ${sentimentData.length} data points from ${hasRedditAccess ? 'all sources' : 'FinViz + Yahoo only'}`);
          
          // 🔧 FIX: Fallback handling with proper time range
          if (!sentimentData || sentimentData.length === 0) {
            console.log('Primary market sentiment data not available, trying fallback...');
            const sentimentSignal2 = requestManager.getSignal(REQUEST_KEYS.sentimentData + '-alt');
            const alternateData = await fetchAggregatedMarketSentiment('1w', sentimentSignal2, hasRedditAccess);
            if (alternateData.length > sentimentData.length) {
              logger.log(`Found more data with alternate timeframe: ${alternateData.length} points`);
              sentimentData = alternateData;
            }
          }
          
          allSentimentsRef.current = sentimentData;
          setAllSentiments(sentimentData);
          cacheTimestampRef.current = Date.now();
          setCacheTimestamp(Date.now());
        } else {
          updateProgress(15, 'Using cached sentiment timeline data...');
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        logger.error('Market sentiment error for chart:', error);
        setErrors(prev => ({ ...prev, sentiment: error instanceof Error ? error.message : 'Failed to fetch market sentiment timeline' }));
      }
      
      try {
        // Step 2: Fetch Reddit posts with pagination (only for Pro+ users)
        if (hasRedditAccess) {
          if (cachedRedditPostsRef.current.length === 0 || Date.now() - cacheTimestampRef.current > CACHE_EXPIRY) {
            updateProgress(30, 'Fetching Reddit posts...');
            const postsSignal = requestManager.getSignal(REQUEST_KEYS.redditPosts);
            
            try {
              const posts = await fetchRedditPosts(postsSignal);
              cachedRedditPostsRef.current = posts;
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
            setRedditPosts(cachedRedditPostsRef.current.slice(0, POSTS_PER_PAGE));
            setHasMorePosts(cachedRedditPostsRef.current.length > POSTS_PER_PAGE);
            setRedditPage(1);
          }
        } else {
          // Free tier: set empty Reddit posts and no loading
          setRedditPosts([]);
          setHasMorePosts(false);
          setRedditPage(1);
          updateProgress(30, 'Skipping Reddit posts (Pro feature)...');
        }
        updateLoadingState({ posts: false });
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
          setLoading(prev => ({ ...prev, posts: false }));
      }
      
      try {
        // Step 3: Fetch ticker sentiment data (Reddit for Pro+ users, FinViz/Yahoo for all)
        let tickerSentimentData: SentimentData[] = allTickerSentimentsRef.current;
        
        // Check if we need to fetch Reddit ticker sentiment data
        const hasRealRedditData = allTickerSentimentsRef.current.length > 0 && 
          allTickerSentimentsRef.current.some(item => item.source === 'reddit');
        const needsRedditData = hasRedditAccess && !hasRealRedditData;
        const needsDefaultData = !hasRedditAccess && allTickerSentimentsRef.current.length === 0;
        
        console.log('[REDDIT TICKER DEBUG] Data check:', {
          currentDataLength: allTickerSentimentsRef.current.length,
          hasRedditAccess,
          hasRealRedditData,
          needsRedditData,
          needsDefaultData,
          firstItemSource: allTickerSentimentsRef.current[0]?.source || 'none'
        });
        
        if (needsRedditData) {
          console.log('[REDDIT TICKER DEBUG] Fetching Reddit ticker sentiment data...');
          updateProgress(45, `Fetching ${timeRange} Reddit ticker sentiment data...`);
          const tickerSignal = requestManager.getSignal(REQUEST_KEYS.tickerSentiment);
          tickerSentimentData = await fetchWatchlistRedditSentiment(timeRange, tickerSignal);
          allTickerSentimentsRef.current = tickerSentimentData;
          setAllTickerSentiments(tickerSentimentData);
        } else if (needsDefaultData) {
          console.log('[REDDIT TICKER DEBUG] Creating default ticker data - fetching user watchlist...');
          // For users without Reddit data, fetch their watchlist tickers instead of using hardcoded ones
          updateProgress(45, 'Preparing market sentiment data using your watchlist...');
          
          try {
            // Fetch user's actual watchlist tickers
            const watchlistSignal = requestManager.getSignal(REQUEST_KEYS.tickerSentiment + '-watchlist');
            const watchlistTickers = await fetchWatchlistFinvizSentiment(watchlistSignal);
            
            if (watchlistTickers.length > 0) {
              // Use the user's actual watchlist tickers for default sentiment data
              console.log('[REDDIT TICKER DEBUG] Using user watchlist tickers for default data:', watchlistTickers.map(t => t.ticker));
              tickerSentimentData = watchlistTickers.map(ticker => ({
                ticker: ticker.ticker,
                score: 0.5, // Neutral baseline
                sentiment: 'neutral' as const,
                source: 'finviz' as const, // Use finviz as valid source type
                timestamp: new Date().toISOString(),
                confidence: 0,
                postCount: 0,
                commentCount: 0,
                upvotes: 0
              }));
            } else {
              // If watchlist is truly empty, create minimal default data
              console.log('[REDDIT TICKER DEBUG] Watchlist is empty, creating minimal default data');
              tickerSentimentData = [];
            }
          } catch (watchlistError) {
            console.error('[REDDIT TICKER DEBUG] Failed to fetch watchlist, creating minimal default data:', watchlistError);
            tickerSentimentData = [];
          }
          
          allTickerSentimentsRef.current = tickerSentimentData;
          setAllTickerSentiments(tickerSentimentData);
        } else {
          console.log('[REDDIT TICKER DEBUG] Using existing ticker sentiment data:', {
            length: allTickerSentimentsRef.current.length,
            sources: allTickerSentimentsRef.current.map(item => item.source)
          });
        }
        
        if (tickerSentimentData.length > 0) {
          const diverseSentiments = ensureTickerDiversity(tickerSentimentData, 10);
          setTopSentiments(diverseSentiments);
          
          // 🔧 FIX: Ensure Reddit data is immediately available even if other sources fail
          console.log('[SENTIMENT DEBUG] Setting Reddit data immediately:', diverseSentiments);
          
          // ONLY use watchlist APIs - NO fallback to hardcoded tickers
          console.log('[SENTIMENT DEBUG] Using ONLY watchlist-based APIs for FinViz and Yahoo sentiment');
          
          // Fetch FinViz sentiment data using ONLY watchlist API
          let finvizData: SentimentData[] = [];
          try {
            updateProgress(60, 'Fetching FinViz sentiment data from your watchlist...');
            const finvizSignal = requestManager.getSignal(REQUEST_KEYS.finviz);
            
            finvizData = await fetchWatchlistFinvizSentiment(finvizSignal);
            
            setFinvizSentiments(finvizData);
            console.log(`[SENTIMENT DEBUG] Watchlist FinViz data collected: ${finvizData.length} items`);
          } catch (finvizError) {
            logger.error('FinViz watchlist data error:', finvizError);
            console.log('[SENTIMENT DEBUG] FinViz watchlist API failed - no fallback, setting empty array');
            setFinvizSentiments([]);
          }
          
          // Fetch Yahoo Finance sentiment using ONLY watchlist API
          let yahooData: SentimentData[] = [];
          try {
            updateProgress(75, 'Fetching Yahoo Finance sentiment data from your watchlist...');
            const yahooSignal = requestManager.getSignal(REQUEST_KEYS.yahoo);
            
            yahooData = await fetchWatchlistYahooSentiment(yahooSignal);
            
            setYahooSentiments(yahooData);
            console.log(`[SENTIMENT DEBUG] Watchlist Yahoo data collected: ${yahooData.length} items`);
          } catch (yahooError) {
            logger.error('Yahoo Finance watchlist data error:', yahooError);
            console.log('[SENTIMENT DEBUG] Yahoo watchlist API failed - no fallback, setting empty array');
            setYahooSentiments([]);
          }
          
          // Build combined data with available results (no fallback data)
          const sourcesToMerge: SentimentData[][] = [];
          if (diverseSentiments.length > 0) sourcesToMerge.push(diverseSentiments);
          if (finvizData.length > 0) sourcesToMerge.push(finvizData);
          if (yahooData.length > 0) sourcesToMerge.push(yahooData);
          
          console.log(`[SENTIMENT DEBUG] Merging ${sourcesToMerge.length} watchlist data sources (NO FALLBACK)`);
          const mergedSentimentData = mergeSentimentData(...sourcesToMerge);
          const combinedSentiments = aggregateByTicker(mergedSentimentData);
          setCombinedSentiments(combinedSentiments);
          
          // 🔧 NEW: Generate chart data immediately after we have combined sentiment data
          try {
            updateProgress(85, 'Generating sentiment charts from market data...');
            
            console.log('[CHART DEBUG] Using market sentiment timeline data for chart generation');
            console.log('[CHART DEBUG] Market sentiment timeline length:', allSentimentsRef.current.length);
            
            // Use market sentiment timeline data as the primary source for chart (provides time-series data)
            if (allSentimentsRef.current.length > 0) {
              console.log(`[CHART DEBUG] Generating chart from ${allSentimentsRef.current.length} market sentiment timeline data points`);
              const chartDataResult = generateChartData(allSentimentsRef.current, timeRange);
              setChartData(chartDataResult);
              console.log(`[CHART DEBUG] Generated ${chartDataResult.length} chart data points from market timeline`);
            } else {
              console.warn('[CHART DEBUG] No market sentiment timeline data available for chart generation');
              setChartData([]);
            }
          } catch (chartError) {
            console.error('[CHART DEBUG] Error generating chart from market timeline data:', chartError);
            setChartData([]);
          }
        } else {
          // 🔧 FIX: If no ticker data at all, set all arrays to empty
          console.warn('[SENTIMENT DEBUG] No ticker sentiment data available');
          setTopSentiments([]);
          setFinvizSentiments([]);
          setYahooSentiments([]);
          setCombinedSentiments([]);
          setChartData([]);
        }
        
        updateLoadingState({
          sentiment: false,
          posts: false,
          chart: false,
        });
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
          updateLoadingState({
            sentiment: false,
            posts: false,
            chart: false,
          });
      }
      
      // Complete the loading process
      setLoadingProgress(100);
      setLoadingStage('Completed!');
      setIsDataLoading(false);
      setIsTransitioning(false);
    } finally {
      loadingRef.current = false;
    }
  }, [timeRange, hasRedditAccess, apiKeysReady, requestManager, updateProgress, updateLoadingState]);
  
  const refreshData = useCallback(() => {
    // Clear ALL caches then reload - including market timeline data
    allSentimentsRef.current = [];
    setAllSentiments([]);
    allTickerSentimentsRef.current = [];
    setAllTickerSentiments([]);
    cachedRedditPostsRef.current = [];
    setCachedRedditPosts([]);
    cacheTimestampRef.current = 0;
    setCacheTimestamp(0);
    
    // Force reload of data with current access level
    loadData();
  }, [loadData]);
  
  const handleLoadMorePosts = useCallback(() => {
    if (!hasMorePosts || loading.posts) {
      return;
    }

    updateLoadingState({ posts: true });

    // Add a minimum loading duration for better UX
    const minimumLoadingTime = 500; // 500ms minimum loading time
    const startTime = Date.now();

    try {
      const nextPage = redditPage + 1;
      const startIndex = (nextPage - 1) * POSTS_PER_PAGE;
      const endIndex = startIndex + POSTS_PER_PAGE;
      
      // Calculate cutoff date based on current time range
      const now = new Date();
      let cutoffDate: Date;
      
      switch (timeRange as string) {
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
      
      // Ensure minimum loading time has passed before updating state
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minimumLoadingTime - elapsedTime);
      
      setTimeout(() => {
        if (newPosts.length > 0) {
          setRedditPosts(prev => [...prev, ...newPosts]);
          setRedditPage(nextPage);
          setHasMorePosts(endIndex < filteredPosts.length);
        } else {
          setHasMorePosts(false);
        }
        
        updateLoadingState({ posts: false });
      }, remainingTime);
      
    } catch (error) {
      // In case of error, still respect minimum loading time
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minimumLoadingTime - elapsedTime);
      
      setTimeout(() => {
        updateLoadingState({ posts: false });
      }, remainingTime);
    }
  }, [redditPage, hasMorePosts, loading.posts, cachedRedditPosts, timeRange, updateLoadingState]);
  
  // Effect to load data when timeRange or Reddit access changes
  useEffect(() => {
    // Don't start loading until API key check is complete
    if (!apiKeysReady) {
      logger.log('Waiting for API key check to complete before loading data...');
      return;
    }
    
    logger.log(`Time range changed to: ${timeRange}, triggering data load (hasRedditAccess: ${hasRedditAccess})`);
    
    // Cancel all pending requests
    requestManager.abort();
    
    // Small delay to allow for UI updates and debounce rapid changes
    const timeoutId = setTimeout(() => {
      loadData();
    }, 100); // Increased from 50ms to 100ms for better debouncing
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [timeRange, hasRedditAccess, apiKeysReady]); // Added apiKeysReady to dependencies
  
  // Effect to clear fake data when Reddit access changes
  useEffect(() => {
    // If the user gained Reddit access, clear any existing fake ticker data
    // so that real Reddit ticker sentiment data gets fetched
    if (hasRedditAccess && allTickerSentimentsRef.current.length > 0) {
      const hasFakeData = allTickerSentimentsRef.current.some(item => 
        item.source === 'finviz' && item.confidence === 0 && item.postCount === 0
      );
      
      if (hasFakeData) {
        console.log('[REDDIT TICKER DEBUG] Reddit access gained - clearing fake ticker data to fetch real Reddit data');
        allTickerSentimentsRef.current = [];
        setAllTickerSentiments([]);
        // Don't need to call loadData() here as the previous useEffect will handle it
      }
    }
  }, [hasRedditAccess]);
  
  // Effect to filter Reddit posts when cached posts or timeRange changes
  useEffect(() => {
    if (cachedRedditPosts.length > 0) {
      const now = new Date();
      let cutoffDate: Date;
      
      switch (timeRange as string) {
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
      
      const filteredPosts = cachedRedditPosts.filter(post => {
        const postDate = new Date(post.created);
        return postDate >= cutoffDate;
      });
      
      setRedditPage(1);
      setRedditPosts(filteredPosts.slice(0, POSTS_PER_PAGE));
      setHasMorePosts(filteredPosts.length > POSTS_PER_PAGE);
    }
  }, [cachedRedditPosts, timeRange]); // Need to depend on cachedRedditPosts for the UI
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      requestManager.abort();
      logger.log('Component unmounted - all pending requests cancelled');
    };
  }, [requestManager]);
  
  return {
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
    isTransitioning,
    
    // Error states
    errors,
    
    // Pagination
    redditPage,
    hasMorePosts,
    
    // Actions
    refreshData,
    handleLoadMorePosts,
  };
}
