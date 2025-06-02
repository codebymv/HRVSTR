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
    
    console.log('🔄 SENTIMENT: Initial state calculation:', {
      hasData,
      dataLength: allSentiments.length,
      lastFetchTime: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
      dataIsStale,
      needsRefresh
    });
    
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
      
      // Check if we have fresh cached data - matching earnings approach
      const hasData = allSentiments.length > 0;
      const dataIsStale = isDataStale(lastFetchTime);
      const timeRangeChanged = lastTimeRange !== timeRange;
      
      console.log('📊 SENTIMENT: Cache check:', {
        hasData,
        dataLength: allSentiments.length,
        lastFetchTime: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
        dataIsStale,
        timeRangeChanged,
        timeRange,
        lastTimeRange
      });

      // If we have fresh data and time range hasn't changed, use cached data
      if (hasData && !dataIsStale && !timeRangeChanged) {
        console.log('📊 SENTIMENT: Using cached data, no fetch needed');
        setLoading({
          sentiment: false,
          posts: false,
          chart: false
        });
        setIsDataLoading(false);
        loadingRef.current = false;
        return;
      }

      console.log('📊 SENTIMENT: Fetching fresh data...');
      
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
          
          setAllSentiments(sentimentData);
        setLastFetchTime(Date.now());
        setLastTimeRange(timeRange);
        
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        logger.error('Market sentiment error for chart:', error);
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
        let tickerSentimentData: SentimentData[] = allTickerSentiments;
        
        // Check if we need to fetch Reddit ticker sentiment data
        const hasRealRedditData = allTickerSentiments.length > 0 && 
          allTickerSentiments.some(item => item.source === 'reddit');
        const needsRedditData = hasRedditAccess && !hasRealRedditData;
        const needsDefaultData = !hasRedditAccess && allTickerSentiments.length === 0;
        
        console.log('[REDDIT TICKER DEBUG] Data check:', {
          currentDataLength: allTickerSentiments.length,
          hasRedditAccess,
          hasRealRedditData,
          needsRedditData,
          needsDefaultData,
          firstItemSource: allTickerSentiments[0]?.source || 'none'
        });
        
        if (needsRedditData) {
          console.log('[REDDIT TICKER DEBUG] Fetching Reddit ticker sentiment data...');
          updateProgress(45, `Fetching ${timeRange} Reddit ticker sentiment data...`);
          const tickerSignal = requestManager.getSignal(REQUEST_KEYS.tickerSentiment);
          tickerSentimentData = await fetchWatchlistRedditSentiment(timeRange, tickerSignal);
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
          
          setAllTickerSentiments(tickerSentimentData);
        } else {
          console.log('[REDDIT TICKER DEBUG] Using existing ticker sentiment data:', {
            length: allTickerSentiments.length,
            sources: allTickerSentiments.map(item => item.source)
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
            console.log('[CHART DEBUG] Market sentiment timeline length:', allSentiments.length);
            
            // Use market sentiment timeline data as the primary source for chart (provides time-series data)
            if (allSentiments.length > 0) {
              console.log(`[CHART DEBUG] Generating chart from ${allSentiments.length} market sentiment timeline data points`);
              const chartDataResult = generateChartData(allSentiments, timeRange);
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
      console.log('🧹 DEBUG: Clearing all sentiment cache...');
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
      
      console.log('🧹 DEBUG: Sentiment cache cleared! Reload the page to see fresh data.');
    };
  }, []);

  // Handle time range changes - clear cache when time range changes
  useEffect(() => {
    if (lastTimeRange !== timeRange) {
      console.log(`⏰ SENTIMENT: Changing time range from ${lastTimeRange} to ${timeRange}`);
      
      // Clear cached data when time range changes to force fresh fetch
      console.log('⏰ SENTIMENT: Clearing cache for new time range');
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
      
      console.log('⏰ SENTIMENT: Triggering fresh data load for new time range');
      loadData();
    }
  }, [timeRange, lastTimeRange, loadData]);

  // Load data when component mounts or when access changes
  useEffect(() => {
    if (apiKeysReady) {
      loadData();
    }
  }, [loadData, apiKeysReady, hasRedditAccess]);
  
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
