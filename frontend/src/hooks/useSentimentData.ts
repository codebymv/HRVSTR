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
  
  // Helper function to check if data is stale (older than 30 minutes) - matching earnings/SEC approach
  const isDataStale = (timestamp: number | null): boolean => {
    if (!timestamp) return true;
    const thirtyMinutesInMs = 30 * 60 * 1000;
    return Date.now() - timestamp > thirtyMinutesInMs;
  };
  
  const POSTS_PER_PAGE = 10;
  
  // Ref to prevent double loading in React StrictMode
  const loadingRef = useRef(false);
  
  // Cached data state with localStorage persistence - matching earnings approach
  const [allSentiments, setAllSentiments] = useState<SentimentData[]>(() => {
    try {
      const cached = localStorage.getItem('sentiment_allSentiments');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.error('Error loading cached sentiments:', e);
      return [];
    }
  });
  
  const [allTickerSentiments, setAllTickerSentiments] = useState<SentimentData[]>(() => {
    try {
      const cached = localStorage.getItem('sentiment_allTickerSentiments');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.error('Error loading cached ticker sentiments:', e);
      return [];
    }
  });
  
  const [cachedRedditPosts, setCachedRedditPosts] = useState<RedditPostType[]>(() => {
    try {
      const cached = localStorage.getItem('sentiment_cachedRedditPosts');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.error('Error loading cached Reddit posts:', e);
      return [];
    }
  });
  
  // Track the last fetch time - matching earnings approach
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(() => {
    try {
      const cached = localStorage.getItem('sentiment_lastFetchTime');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.error('Error loading cached fetch time:', e);
      return null;
    }
  });
  
  // Save data to localStorage whenever it changes - matching earnings approach
  useEffect(() => {
    if (allSentiments.length > 0) {
      localStorage.setItem('sentiment_allSentiments', JSON.stringify(allSentiments));
    }
  }, [allSentiments]);
  
  useEffect(() => {
    if (allTickerSentiments.length > 0) {
      localStorage.setItem('sentiment_allTickerSentiments', JSON.stringify(allTickerSentiments));
    }
  }, [allTickerSentiments]);
  
  useEffect(() => {
    if (cachedRedditPosts.length > 0) {
      localStorage.setItem('sentiment_cachedRedditPosts', JSON.stringify(cachedRedditPosts));
    }
  }, [cachedRedditPosts]);
  
  // Save last fetch time to localStorage
  useEffect(() => {
    if (lastFetchTime) {
      localStorage.setItem('sentiment_lastFetchTime', JSON.stringify(lastFetchTime));
    }
  }, [lastFetchTime]);
  
  // Loading states
  const [loading, setLoading] = useState(() => {
    // Calculate initial loading state based on cache freshness
    const hasData = allSentiments.length > 0;
    const dataIsStale = isDataStale(lastFetchTime);
    const needsRefresh = !hasData || dataIsStale;
    
    return {
      sentiment: needsRefresh,
      posts: needsRefresh,
      chart: needsRefresh
    };
  });
  
  // Unified loading progress tracking
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(() => {
    const hasData = allSentiments.length > 0;
    const dataIsStale = isDataStale(lastFetchTime);
    return !hasData || dataIsStale;
  });
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
  
  // Track the last time range used for cache invalidation
  const [lastTimeRange, setLastTimeRange] = useState<TimeRange>(timeRange);
  
  // Track last Reddit access state to detect changes
  const [lastRedditAccess, setLastRedditAccess] = useState<boolean | null>(null);
  
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
    
    console.log('🔄 LOAD DATA START:', { timeRange, hasRedditAccess, apiKeysReady });
    
    try {
      // Cancel all pending requests
      requestManager.abort();
      
      // Check if we have fresh cached data - matching earnings approach
      const hasData = allSentiments.length > 0;
      const dataIsStale = isDataStale(lastFetchTime);
      const timeRangeChanged = lastTimeRange !== timeRange;
      
      // 🔧 FIX: Check if cached data matches current tier access level
      // If Reddit access changed, cached data might not be appropriate for current tier
      const accessLevelChanged = lastRedditAccess !== null && lastRedditAccess !== hasRedditAccess;
      const needsTierSpecificData = !hasRedditAccess && (finvizSentiments.length === 0 || yahooSentiments.length === 0);
      
      console.log('🔄 CACHE CHECK:', { 
        hasData, 
        dataIsStale, 
        timeRangeChanged, 
        accessLevelChanged,
        needsTierSpecificData,
        lastRedditAccess,
        currentRedditAccess: hasRedditAccess,
        finvizCount: finvizSentiments.length,
        yahooCount: yahooSentiments.length,
        lastFetchTime 
      });
      
      // If we have fresh data and time range hasn't changed AND access level matches, use cached data
      if (hasData && !dataIsStale && !timeRangeChanged && !accessLevelChanged && !needsTierSpecificData) {
        console.log('🔄 USING CACHED DATA - skipping fresh fetch');
        // 🔧 FIX: Generate chart data from cached sentiment data
        try {
          if (allSentiments && allSentiments.length > 0) {
            const chartDataResult = generateChartData(allSentiments, timeRange, hasRedditAccess);
            setChartData(chartDataResult);
          } else {
            setChartData([]);
          }
        } catch (chartError) {
          console.error('Error generating chart from cached data:', chartError);
          setChartData([]);
        }
        
        setLoading({
          sentiment: false,
          posts: false,
          chart: false
        });
        setIsDataLoading(false);
        loadingRef.current = false;
        return;
      }

      console.log('🔧 [SENTIMENT HOOK DEBUG] Cache check passed, proceeding with fresh data fetch');

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
        updateProgress(15, hasRedditAccess ? 'Downloading sentiment timeline from all sources...' : 'Downloading sentiment timeline (FinViz + Yahoo)...');
        const sentimentSignal = requestManager.getSignal(REQUEST_KEYS.sentimentData);
        
        // Use market sentiment data for chart (provides time-series data)
        const sentimentData = await fetchAggregatedMarketSentiment(timeRange, sentimentSignal, hasRedditAccess);
        logger.log(`Aggregated market sentiment: ${sentimentData.length} data points from ${hasRedditAccess ? 'all sources' : 'FinViz + Yahoo only'}`);
        
        setAllSentiments(sentimentData);
        setLastFetchTime(Date.now());
        setLastTimeRange(timeRange);
        
        // Generate chart data using real data from available sources
        updateProgress(20, 'Generating sentiment charts from real market data...');
        if (sentimentData && sentimentData.length > 0) {
          const chartDataResult = generateChartData(sentimentData, timeRange, hasRedditAccess);
          setChartData(chartDataResult);
          logger.log(`[CHART DEBUG] Generated chart data from ${sentimentData.length} real market sentiment points`);
        } else {
          console.warn('[CHART DEBUG] No market sentiment data available');
          setChartData([]);
        }
        
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        logger.error('Market sentiment error:', error);
        setErrors(prev => ({ ...prev, sentiment: error instanceof Error ? error.message : 'Failed to fetch market sentiment timeline' }));
      }
      
      try {
        // Step 2: Fetch Reddit posts with pagination (only for Pro+ users)
        if (hasRedditAccess) {
          if (cachedRedditPosts.length === 0 || (lastFetchTime && Date.now() - lastFetchTime > 30 * 60 * 1000)) {
            updateProgress(30, 'Fetching Reddit posts...');
            const postsSignal = requestManager.getSignal(REQUEST_KEYS.redditPosts);
            
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
            setRedditPosts(cachedRedditPosts.slice(0, POSTS_PER_PAGE));
            setHasMorePosts(cachedRedditPosts.length > POSTS_PER_PAGE);
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
        console.log('🔄 STARTING TICKER SENTIMENT FETCH SECTION');
        let tickerSentimentData: SentimentData[] = allTickerSentiments;
        
        // Check if we need to fetch Reddit ticker sentiment data
        const hasRealRedditData = allTickerSentiments.length > 0 && 
          allTickerSentiments.some(item => item.source === 'reddit');
        const needsRedditData = hasRedditAccess && !hasRealRedditData;
        const needsDefaultData = !hasRedditAccess && allTickerSentiments.length === 0;
        
        console.log('🔄 TICKER SENTIMENT LOGIC:', { 
          hasRealRedditData, 
          needsRedditData, 
          needsDefaultData,
          allTickerSentimentsLength: allTickerSentiments.length,
          hasRedditAccess 
        });
        
        if (needsRedditData) {
          updateProgress(45, `Fetching ${timeRange} Reddit ticker sentiment data...`);
          const tickerSignal = requestManager.getSignal(REQUEST_KEYS.tickerSentiment);
          tickerSentimentData = await fetchWatchlistRedditSentiment(timeRange, tickerSignal);
          setAllTickerSentiments(tickerSentimentData);
        } else if (needsDefaultData) {
          // For users without Reddit data, fetch their watchlist tickers instead of using hardcoded ones
          updateProgress(45, 'Preparing market sentiment data using your watchlist...');
          
          try {
            // Fetch user's actual watchlist tickers
            const watchlistSignal = requestManager.getSignal(REQUEST_KEYS.tickerSentiment + '-watchlist');
            const watchlistTickers = await fetchWatchlistFinvizSentiment(timeRange, watchlistSignal);
            
            if (watchlistTickers.length > 0) {
              // Use the user's actual watchlist tickers for default sentiment data
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
              tickerSentimentData = [];
            }
          } catch (watchlistError) {
            console.error('[REDDIT TICKER DEBUG] Failed to fetch watchlist, creating minimal default data:', watchlistError);
            tickerSentimentData = [];
          }
          
          setAllTickerSentiments(tickerSentimentData);
        } else {
          // Using existing ticker sentiment data
        }
        
        // Always fetch FinViz and Yahoo data regardless of ticker sentiment availability
        // This ensures free users get sentiment scores even without Reddit access
        
        console.log('🔄 STARTING FINVIZ/YAHOO WATCHLIST SECTION');
        
        // Set topSentiments from available ticker data (could be empty for free users)
        if (tickerSentimentData.length > 0) {
          const diverseSentiments = ensureTickerDiversity(tickerSentimentData, 10);
          setTopSentiments(diverseSentiments);
        } else {
          setTopSentiments([]);
        }
        
        // 🔧 FIX: Use watchlist APIs for all users - backend handles tier limits
        updateProgress(60, 'Fetching FinViz sentiment data from your watchlist...');
        
        // Fetch FinViz data using watchlist API for all users
        let finvizData: SentimentData[] = [];
        try {
          console.log('🔍 FETCHING FinViz watchlist sentiment...');
          const finvizSignal = requestManager.getSignal(REQUEST_KEYS.finviz);
          finvizData = await fetchWatchlistFinvizSentiment(timeRange, finvizSignal);
          console.log(`🔍 FinViz sentiment result: ${finvizData.length} items`, finvizData.slice(0, 3));
          setFinvizSentiments(finvizData);
        } catch (finvizError) {
          console.error('❌ FinViz sentiment API error:', finvizError);
          logger.error('FinViz sentiment data error:', finvizError);
          setFinvizSentiments([]);
        }
        
        // Fetch Yahoo data using watchlist API for all users
        updateProgress(75, 'Fetching Yahoo sentiment data from your watchlist...');
        let yahooData: SentimentData[] = [];
        try {
          console.log('🔍 FETCHING Yahoo watchlist sentiment...');
          const yahooSignal = requestManager.getSignal(REQUEST_KEYS.yahoo);
          yahooData = await fetchWatchlistYahooSentiment(timeRange, yahooSignal);
          console.log(`🔍 Yahoo sentiment result: ${yahooData.length} items`, yahooData.slice(0, 3));
          setYahooSentiments(yahooData);
        } catch (yahooError) {
          console.error('❌ Yahoo sentiment API error:', yahooError);
          logger.error('Yahoo Finance sentiment data error:', yahooError);
          setYahooSentiments([]);
        }
        
        // Build combined data with available results (no fallback data)
        const sourcesToMerge: SentimentData[][] = [];
        if (tickerSentimentData.length > 0) {
          const diverseSentiments = ensureTickerDiversity(tickerSentimentData, 10);
          sourcesToMerge.push(diverseSentiments);
        }
        if (finvizData.length > 0) sourcesToMerge.push(finvizData);
        if (yahooData.length > 0) sourcesToMerge.push(yahooData);
        
        const mergedSentimentData = mergeSentimentData(...sourcesToMerge);
        const combinedSentiments = aggregateByTicker(mergedSentimentData);
        setCombinedSentiments(combinedSentiments);
        
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
    setAllSentiments([]);
    setAllTickerSentiments([]);
    setCachedRedditPosts([]);
    setLastFetchTime(null);
    
    // Clear localStorage cache to force fresh fetch - matching earnings approach
    localStorage.removeItem('sentiment_allSentiments');
    localStorage.removeItem('sentiment_allTickerSentiments');
    localStorage.removeItem('sentiment_cachedRedditPosts');
    localStorage.removeItem('sentiment_lastFetchTime');
    
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
  
  // Debug function to clear all sentiment cache - available in browser console
  useEffect(() => {
    (window as any).clearSentimentCache = () => {
      localStorage.removeItem('sentiment_allSentiments');
      localStorage.removeItem('sentiment_allTickerSentiments');
      localStorage.removeItem('sentiment_cachedRedditPosts');
      localStorage.removeItem('sentiment_lastFetchTime');
      
      setAllSentiments([]);
      setAllTickerSentiments([]);
      setCachedRedditPosts([]);
      setLastFetchTime(null);
      setErrors({ sentiment: null, posts: null, chart: null, rateLimited: false });
      setLoading({ sentiment: false, posts: false, chart: false });
    };
  }, []);

  // Handle time range changes - clear cache when time range changes
  useEffect(() => {
    if (lastTimeRange !== timeRange) {
      // Clear cached data when time range changes to force fresh fetch
      localStorage.removeItem('sentiment_allSentiments');
      localStorage.removeItem('sentiment_allTickerSentiments');
      localStorage.removeItem('sentiment_cachedRedditPosts');
      localStorage.removeItem('sentiment_lastFetchTime');
      
      // Reset cached data in state
      setAllSentiments([]);
        setAllTickerSentiments([]);
      setCachedRedditPosts([]);
      setLastFetchTime(null);
  
      // Clear any existing errors
      setErrors({
        sentiment: null,
        posts: null,
        chart: null,
        rateLimited: false
      });
      
      loadData();
    }
  }, [timeRange, lastTimeRange, loadData]);

  // Handle Reddit access changes - clear cache when access level changes
  useEffect(() => {
    // Force refresh when real hasRedditAccess value becomes available (from null)
    // or when access level actually changes
    const shouldRefresh = (lastRedditAccess === null) || (lastRedditAccess !== hasRedditAccess);
    
    if (shouldRefresh && apiKeysReady) {
      console.log(`🔄 SENTIMENT HOOK: Reddit access ${lastRedditAccess === null ? 'initialized' : 'changed from ' + lastRedditAccess} to ${hasRedditAccess}, refreshing data...`);
      
      // Cancel any in-progress loads since we need to restart with new access level
      requestManager.abort();
      loadingRef.current = false; // Reset loading ref to allow new load
      
      // Only clear cache if this is an actual change (not initialization)
      if (lastRedditAccess !== null) {
        // Clear cached data when Reddit access changes to force fresh fetch
        localStorage.removeItem('sentiment_allSentiments');
        localStorage.removeItem('sentiment_allTickerSentiments');
        localStorage.removeItem('sentiment_cachedRedditPosts');
        localStorage.removeItem('sentiment_lastFetchTime');
        
        // Reset cached data in state
        setAllSentiments([]);
        setAllTickerSentiments([]);
        setCachedRedditPosts([]);
        setLastFetchTime(null);
      }
      
      // Update last known Reddit access state
      setLastRedditAccess(hasRedditAccess);
      
      // Clear any existing errors
      setErrors({
        sentiment: null,
        posts: null,
        chart: null,
        rateLimited: false
      });
      
      // Trigger fresh data load with new access level
      loadData();
    }
  }, [hasRedditAccess, lastRedditAccess, apiKeysReady, loadData, requestManager]);

  // Load data when component mounts or when access changes
  // Note: Initial load is now handled by the Reddit access change effect above
  // to ensure proper access level is used from the start
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      requestManager.abort();
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
