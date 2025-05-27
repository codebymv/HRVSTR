import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { SentimentData, ChartData, TimeRange, RedditPost as RedditPostType } from '../../types';
import { fetchSentimentData, fetchRedditPosts, fetchTickerSentiments } from '../../services/api';
import { fetchFinvizSentiment } from '../../services/finvizClient';
import { fetchYahooSentiment } from '../../services/yahooFinanceClient';
import { mergeSentimentData, aggregateByTicker } from '../../services/sentimentMerger';
import { ensureTickerDiversity } from '../../services/tickerUtils';
import { generateChartData } from '../../services/chartUtils';
import { RefreshCw, AlertTriangle, Info, Loader2 } from 'lucide-react';
import SentimentChart from './SentimentChart';
import ProgressBar from '../ProgressBar';
import TimeRangeSelector from './TimeRangeSelector';
import SentimentScoresSection from './SentimentScoresSection';
import RedditPostsSection from './RedditPostsSection';

// Simple logger with environment check
const isDev = process.env.NODE_ENV === 'development';
const logger = {
  log: (...args: any[]) => isDev && console.log(...args),
  error: (...args: any[]) => console.error(...args)
};

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T, 
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}


const SentimentDashboard: React.FC = () => {
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
  
  // Cache expiration time - 5 minutes
  const CACHE_EXPIRY = 5 * 60 * 1000;
  // Get theme context
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const activeButtonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';
  // Time range for data fetching
  const [timeRange, setTimeRange] = useState<TimeRange>('1w');
  
  // Helper function to update loading states consistently
  const updateLoadingState = (states: Partial<typeof loading>) => {
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
  };
  
  // Debounced time range change handler with proper dependencies
  const debouncedTimeRangeChange = useCallback(
    debounce((range: TimeRange) => {
      logger.log(`Executing debounced time range change to: ${range}`);
      setTimeRange(range);
      // loadData will be called by the useEffect that has timeRange as dependency
    }, 300),
    // No dependencies needed since this is just setting state
    []
  );
  
  // Handle time range change
  const handleTimeRangeChange = (range: TimeRange) => {
    logger.log(`Time range changed to: ${range}`);
    
    // Set transitioning state to true to prevent chart flickering
    setIsTransitioning(true);
    
    // Show loading state immediately to prevent flickering for both chart and posts
    updateLoadingState({ chart: true, posts: true });
    setLoadingStage(`Loading ${range.toUpperCase()} sentiment data...`);
    setLoadingProgress(10);
    
    // Only clear UI displayed data (not the cached data)
    // This forces the UI to show loading state while we filter our cached data
    setChartData([]);
    setRedditPosts([]);
    
    // Use debounced handler instead of setTimeout
    debouncedTimeRangeChange(range);
  };
  
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
  
  // Cached datasets (fetched once for the longest range)
  const [allSentiments, setAllSentiments] = useState<SentimentData[]>([]); // 3 M Reddit timeline
  const [allTickerSentiments, setAllTickerSentiments] = useState<SentimentData[]>([]); // 3 M aggregated per-ticker
  const [cachedRedditPosts, setCachedRedditPosts] = useState<RedditPostType[]>([]);
  const [cachedFinvizSentiments, setCachedFinvizSentiments] = useState<SentimentData[]>([]);
  const [cacheTimestamp, setCacheTimestamp] = useState<number>(0);

  // Special state to track time range transitions - prevents flickering
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  // Pagination state for Reddit posts
  const [redditPage, setRedditPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const POSTS_PER_PAGE = 10;

  const loadData = async () => {
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
        // First load or cache expired – fetch 3M data for caching (ensure full dataset)
        updateProgress(15, 'Downloading sentiment timeline...');
        const sentimentSignal = requestManagerRef.current.getSignal(REQUEST_KEYS.sentimentData);
        
        // Make multiple attempts if needed to ensure we get comprehensive data
        let sentimentData = await fetchSentimentData('3m', sentimentSignal);
        logger.log(`First fetch: ${sentimentData.length} 3M sentiment data points from Reddit`);
        
        // If we only got a single data point, try again with a different timeframe
        if (sentimentData.length <= 1) {
          logger.log('Initial fetch returned minimal data, trying alternate timeframes...');
          try {
            // Try other time ranges to collect more data points
            const sentimentSignal2 = requestManagerRef.current.getSignal(REQUEST_KEYS.sentimentData + '-alt');
            const alternateData = await fetchSentimentData('1m', sentimentSignal2);
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
    // Ignore aborted request errors
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
    // Ignore aborted request errors
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
      // Step 3: Fetch Reddit ticker sentiment data
      let redditTickerData: SentimentData[] = allTickerSentiments;
      if (allTickerSentiments.length === 0) {
        updateProgress(45, `Fetching ${timeRange} ticker sentiment data...`);
        const tickerSignal = requestManagerRef.current.getSignal(REQUEST_KEYS.tickerSentiment);
        redditTickerData = await fetchTickerSentiments(timeRange, tickerSignal);
        setAllTickerSentiments(redditTickerData);
      }
      
      // Only process if we have sentiment data
      if (redditTickerData.length > 0) {
        // Get diverse set of tickers from Reddit data
        const diverseSentiments = ensureTickerDiversity(redditTickerData, 10);
        setTopSentiments(diverseSentiments);
        
        // Extract just the ticker symbols for other sources
        const tickersToFetch = diverseSentiments.map(item => item.ticker);
        
        // Now fetch FinViz sentiment data using just the ticker symbols
        let finvizData: SentimentData[] = [];
        try {
          updateProgress(60, 'Fetching FinViz sentiment data...');
          
          const finvizSignal = requestManagerRef.current.getSignal(REQUEST_KEYS.finviz);
          finvizData = await fetchFinvizSentiment(tickersToFetch, finvizSignal);
          
          setFinvizSentiments(finvizData);
        } catch (finvizError) {
          logger.error('FinViz data error:', finvizError);
        }
        
        // Fetch Yahoo Finance sentiment for the same tickers
        let yahooData: SentimentData[] = [];
        try {
          updateProgress(75, 'Fetching Yahoo Finance sentiment data...');
          
          const yahooSignal = requestManagerRef.current.getSignal(REQUEST_KEYS.yahoo);
          yahooData = await fetchYahooSentiment(tickersToFetch, yahooSignal);
          
          setYahooSentiments(yahooData);
        } catch (yahooError) {
          logger.error('Yahoo Finance data error:', yahooError);
        }
        
        // Merge sentiment data from all three sources
        // Note: Any empty arrays will just be ignored in the merge
        const mergedData = mergeSentimentData(diverseSentiments, finvizData, yahooData);
        const aggregatedData = aggregateByTicker(mergedData);
        
        // Ensure we maintain ticker diversity in the final output
        const finalSentiments = ensureTickerDiversity(aggregatedData, 8);
        setCombinedSentiments(finalSentiments);
      }
      
      setLoading(prev => ({ ...prev, sentiment: false }));
    } catch (error: unknown) {
    // Ignore aborted request errors
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
      setLoading(prev => ({ ...prev, sentiment: false }));
    }
    
    try {
      // Step 5: Generate chart data locally (no new API calls)
      updateProgress(75, 'Generating sentiment charts...');
      
      // IMPORTANT: First, log and verify we have the data we fetched earlier
      logger.log('Before chart generation, allSentiments:', allSentiments);
      logger.log('Yahoo sentiments:', yahooSentiments);
      logger.log('Finviz sentiments:', finvizSentiments);
      
      // Directly create sentiment data if we have no data from the API fetch above
      // This ensures that we have something to display, especially during the first app load
      if (allSentiments.length === 0) {
        // Make multiple attempts to fetch comprehensive data
        logger.log('No sentiment data in state, attempting comprehensive direct fetch...');
        try {
          // First, fetch the full 3-month dataset
          const directSentimentSignal = requestManagerRef.current.getSignal(REQUEST_KEYS.sentimentData + '-direct');
          let directSentimentData = await fetchSentimentData('3m', directSentimentSignal);
          logger.log(`Direct fetch (3m) returned ${directSentimentData.length} data points`);
          
          // If we didn't get much data, try other time ranges
          if (directSentimentData.length <= 1) {
            // Try 1m data
            const directSentimentSignal1m = requestManagerRef.current.getSignal(REQUEST_KEYS.sentimentData + '-direct-1m');
            const monthData = await fetchSentimentData('1m', directSentimentSignal1m);
            logger.log(`Direct fetch (1m) returned ${monthData.length} data points`);
            
            // Try 1w data
            const directSentimentSignal1w = requestManagerRef.current.getSignal(REQUEST_KEYS.sentimentData + '-direct-1w');
            const weekData = await fetchSentimentData('1w', directSentimentSignal1w);
            logger.log(`Direct fetch (1w) returned ${weekData.length} data points`);
            
            // Use the dataset with the most points
            if (monthData.length > directSentimentData.length) {
              directSentimentData = monthData;
              logger.log('Using 1m data as it has more points');
            }
            if (weekData.length > directSentimentData.length) {
              directSentimentData = weekData;
              logger.log('Using 1w data as it has more points');
            }
          }
          
          if (directSentimentData.length > 0) {
            // Cache this data for future use
            setAllSentiments(directSentimentData);
            logger.log('Using directly fetched data for charts');
            
            // Create chart data immediately using filtered data based on selected timeRange
            // First filter the data based on the current timeRange
            const now = Date.now();
            let cutoffDate;
            
            switch (timeRange) {
              case '1d': cutoffDate = new Date(now - 1 * 24 * 60 * 60 * 1000); break;
              case '1w': cutoffDate = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
              case '1m': cutoffDate = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
              case '3m':
              default:   cutoffDate = new Date(now - 90 * 24 * 60 * 60 * 1000); break;
            }
            
            // Filter the data to match the selected time range
            // Use all data if we have very few points (3 or less)
            const filteredData = directSentimentData.length <= 3 ? 
              directSentimentData : 
              directSentimentData.filter(d => new Date(d.timestamp) >= cutoffDate);
            
            logger.log(`Filtered direct data to ${filteredData.length} points for ${timeRange}`);
            
            // Generate chart data with the filtered dataset
            // Explicitly pass the two required arguments to avoid TypeScript errors
const directChartData = generateChartData(filteredData, timeRange);
            setChartData(directChartData);
            
            // CRITICAL: Make sure ALL loading states are reset properly
            updateLoadingState({ chart: false, sentiment: false });
            
            // Complete the loading process
            updateProgress(100, 'Completed!');
            logger.log('Direct fetch path: Chart generation complete, all states reset');
            return;
          }
        } catch (error: unknown) {
          // Ignore aborted request errors
          if (error instanceof DOMException && error.name === 'AbortError') return;
          logger.error('Direct fetch error:', error);
        }
      }
      
      // Determine cutoff date for the selected time range
      // Create cutoff date based on selected time range
      const cutoffDate = (() => {
        const now = Date.now();
        switch (timeRange) {
          case '1d': return new Date(now - 1 * 24 * 60 * 60 * 1000);
          case '1w': return new Date(now - 7 * 24 * 60 * 60 * 1000);
          case '1m': return new Date(now - 30 * 24 * 60 * 60 * 1000);
          case '3m':
          default:   return new Date(now - 90 * 24 * 60 * 60 * 1000);
        }
      })();
      
      let filteredRedditTimeline;
      
      // If we have very few data points (3 or less), skip filtering by date to ensure we have something to show
      if (allSentiments.length <= 3) {
        logger.log(`Only ${allSentiments.length} sentiment points available, skipping date filtering`);
        filteredRedditTimeline = allSentiments; // Use all available data points
      } else {
        // Normal filtering for when we have more data points
        filteredRedditTimeline = allSentiments.filter(d => new Date(d.timestamp) >= cutoffDate);
      }
      
      logger.log(`After date filtering: ${filteredRedditTimeline.length} data points available`);
      
      // Check if we have Reddit sentiment data to work with
      let combinedSentimentLocal = filteredRedditTimeline;
      
      // If no Reddit data was filtered, check if we have at least one market sentiment point
      if (filteredRedditTimeline.length === 0 && allSentiments.length > 0) {
        logger.log('No filtered data for the selected time range, using market sentiment data');
        // Find any MARKET ticker data point to use
        const marketDataPoints = allSentiments.filter(d => d.ticker === 'MARKET');
        if (marketDataPoints.length > 0) {
          logger.log('Using MARKET sentiment data point');
          combinedSentimentLocal = marketDataPoints;
        }
      }
      
      // Debug logging to trace sentiment data flow
      logger.log('Before FinViz merge - combinedSentimentLocal:', combinedSentimentLocal);
      logger.log('cachedFinvizSentiments:', cachedFinvizSentiments);

      // Merge with cached FinViz and Yahoo data
      combinedSentimentLocal = mergeSentimentData(combinedSentimentLocal, cachedFinvizSentiments, yahooSentiments);
      
      // Apply the correct source distribution (30% Reddit, 40% Finviz, 30% Yahoo)
      // First, separate data by source
      const redditData = combinedSentimentLocal.filter(item => item.source === 'reddit');
      const finvizData = combinedSentimentLocal.filter(item => item.source === 'finviz');
      const yahooData = combinedSentimentLocal.filter(item => item.source === 'yahoo');
      
      logger.log(`Source breakdown - Reddit: ${redditData.length}, Finviz: ${finvizData.length}, Yahoo: ${yahooData.length}`);
      
      // If we have data from all sources, apply the correct distribution
      if (redditData.length > 0 && finvizData.length > 0 && yahooData.length > 0) {
        // Create a new combined dataset with the right proportions
        const totalPoints = Math.min(redditData.length * (100/30), finvizData.length * (100/40), yahooData.length * (100/30));
        
        if (totalPoints > 0) {
          const redditCount = Math.round(totalPoints * 0.3);
          const finvizCount = Math.round(totalPoints * 0.4);
          const yahooCount = Math.round(totalPoints * 0.3);
          
          // Sample from each source based on the desired distribution
          const sampledReddit = redditData.slice(0, redditCount);
          const sampledFinviz = finvizData.slice(0, finvizCount);
          const sampledYahoo = yahooData.slice(0, yahooCount);
          
          // Create the balanced dataset
          combinedSentimentLocal = [...sampledReddit, ...sampledFinviz, ...sampledYahoo];
          logger.log(`Created balanced dataset with ${combinedSentimentLocal.length} points`);
        }
      }
      
      logger.log('After all merges - combinedSentimentLocal:', combinedSentimentLocal);
      logger.log(`Generating chart data from ${combinedSentimentLocal.length} data points`);
      // Explicitly pass both arguments to match the function signature
const chartDataResult = generateChartData(combinedSentimentLocal, timeRange);
      
      // Log chart data result for debugging
      logger.log(`Chart data generated: ${chartDataResult.length} points`);
      
      // If no chart data was generated but we have data, assign directly to chartData
      if (chartDataResult.length === 0) {
        logger.log('No chart data after processing, checking all available data sources');
        // First log what we have
        logger.log('All sentiment data available:', allSentiments);
        
        // Create a simple data point directly from any available sentiment data
        if (allSentiments.length > 0 && allSentiments[0]) {
          const fallbackPoint = allSentiments[0];
          const timestamp = new Date(fallbackPoint.timestamp);
          const displayDate = timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          const isPositive = fallbackPoint.sentiment === 'bullish' || 
                           (typeof fallbackPoint.score === 'number' && fallbackPoint.score > 0.2);
          const isNegative = fallbackPoint.sentiment === 'bearish' || 
                           (typeof fallbackPoint.score === 'number' && fallbackPoint.score < -0.2);
                           
          const chartPoint: ChartData = {
            date: fallbackPoint.timestamp,
            displayDate,
            bullish: isPositive ? 60 : 10,
            bearish: isNegative ? 60 : 10,
            neutral: 100 - (isPositive ? 60 : 10) - (isNegative ? 60 : 10),
            sources: { 'Reddit': fallbackPoint.source === 'reddit' ? 100 : 0, 'Finviz': fallbackPoint.source === 'finviz' ? 100 : 0 }
          };
          
          logger.log('Created fallback chart point:', chartPoint);
          setChartData([chartPoint]);
          // Skip the rest of the chart processing
          updateLoadingState({ chart: false });
          return;
        }
      }
      
      // Update progress before setting chart data
      updateProgress(6, 'Rendering charts...');
      
      // Remove artificial delay and just update progress
      updateProgress(6, 'Rendering charts...');
      
      // Set the source breakdown and chart data
      const tickers = Array.from(new Set(filteredRedditTimeline.map(d => d.ticker)));
      const diverseTickers = ensureTickerDiversity(tickers, 10);
      // Fetch sentiment data for tickers
      const finalFinvizSignal = requestManagerRef.current.getSignal(REQUEST_KEYS.finviz + '-final');
      const finvizSentiment = await fetchFinvizSentiment(diverseTickers, finalFinvizSignal);
      // Merge with existing data
      const combinedSentiment = mergeSentimentData(filteredRedditTimeline, finvizSentiment);
      
      const breakdown: Record<string, number> = {};
      const sources = combinedSentiment.map(item => item.source);
      const total = sources.length;
      
      if (total > 0) {
        // Count each source occurrence
        sources.forEach(source => {
          breakdown[source] = (breakdown[source] || 0) + 1;
        });
        
        // Convert counts to percentages
        Object.keys(breakdown).forEach(key => {
          breakdown[key] = Math.round((breakdown[key] / total) * 100);
        });
      }
      
      // Set the chart data
      setChartData(chartDataResult);
      logger.log('Main path: Chart data set with', chartDataResult.length, 'points');
      
      // CRITICAL: Make sure ALL loading states are properly reset
      updateLoadingState({
        sentiment: false,
        posts: false,
        chart: false,
      });
    } catch (error: unknown) {
      // Ignore aborted request errors
      if (error instanceof DOMException && error.name === 'AbortError') return;
      logger.error('Chart data error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate chart data';
      const isRateLimited = error instanceof Error && 
        (error.message.includes('429') || 
         error.message.toLowerCase().includes('rate limit') || 
         error.message.toLowerCase().includes('too many requests'));
      
      setErrors(prev => ({ 
        ...prev, 
        chart: isRateLimited ? 'Rate limit exceeded. Please try again later.' : errorMessage,
        rateLimited: isRateLimited || prev.rateLimited
      }));
      
      // Ensure ALL loading states are properly reset in error cases too
      updateLoadingState({ 
        chart: false,
        sentiment: false,
        posts: false
      });
    }
    
    // Finally complete the loading process
    setLoadingProgress(100);
    setLoadingStage('Completed!');
    setIsDataLoading(false);
    
    // End the transition state
    setIsTransitioning(false);
  };

  const refreshData = () => {
    // Clear caches then reload
    setAllSentiments([]);
    setAllTickerSentiments([]);
    setCachedFinvizSentiments([]);
    setCachedRedditPosts([]);
    loadData();
  };

  useEffect(() => {
    logger.log(`Time range changed to: ${timeRange}, triggering data load`);
    
    // Cancel any in-flight requests before starting new ones
    requestManagerRef.current.abort();
    
    // Small delay to ensure UI updates before starting potentially heavy operations
    const timeoutId = setTimeout(() => {
      loadData();
    }, 50);
    
    // Cleanup when component unmounts or timeRange changes again
    return () => {
      clearTimeout(timeoutId);
    };
  }, [timeRange]);
  
  // One-time initialization effect to ensure complete data on first load
  useEffect(() => {
    logger.log('Component mounted - initializing with complete data refresh');
    
    // Force a complete refresh on cold start to ensure we get all data
    // This addresses the issue where initial load shows different data than view switching
    refreshData();
    
    // Add listener for SEC filings loading progress
    const handleSecLoadingProgress = (event: CustomEvent<{progress: number, stage: string}>) => {
      const { progress, stage } = event.detail;
      logger.log(`Received SEC progress update: ${progress}%, Stage: ${stage}`);
      
      // Map the SEC progress (0-100%) to our loading progress scale (20-100%)
      // This ensures smooth progress updates instead of freezing at 20%
      const mappedProgress = 20 + Math.round((progress * 0.8));
      
      setLoadingProgress(mappedProgress);
      setLoadingStage(stage);
      
      // If progress is complete, update loading states
      if (progress >= 100) {
        // Mark loading as complete if needed
        updateLoadingState({
          sentiment: false,
          posts: false,
          chart: false
        });
      }
    };
    
    // Register the event listener
    document.addEventListener('sec-loading-progress', handleSecLoadingProgress as EventListener);
    
    // Cleanup function that runs when component unmounts
    return () => {
      // Cancel all pending requests
      requestManagerRef.current.abort();
      logger.log('Component unmounted - all pending requests cancelled');
      
      // Remove event listeners
      document.removeEventListener('sec-loading-progress', handleSecLoadingProgress as EventListener);
    };
    
    // This is intentionally an empty dependency array to only run once on mount
  }, []);
  
  // Effect to check when all data is loaded
  useEffect(() => {
    if (!loading.sentiment && !loading.posts && !loading.chart) {
      setIsDataLoading(false);
    }
  }, [loading.sentiment, loading.posts, loading.chart]);
  
  // Effect to filter and display Reddit posts whenever the cached posts change
  useEffect(() => {
    // Only run if we have cached posts
    if (cachedRedditPosts.length > 0) {
      console.log('Filtering cached Reddit posts based on current time range:', timeRange);
      
      // Calculate cutoff date based on current time range
      const now = new Date();
      let cutoffDate: Date;
      
      switch (timeRange) {
        case '1d':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '1w':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '1m':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3m':
        default:
          cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
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

  // Add load more posts handler
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
        case '1w':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '1m':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3m':
        default:
          cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
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
  }, [redditPage, hasMorePosts, loading.posts, cachedRedditPosts, timeRange]);

  return (
    <div className={`flex-1 ${isLight ? 'bg-stone-200' : 'bg-gray-950'} pb-8`}>
      <div className="container mx-auto p-4 lg:p-6 max-w-7xl">
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
          <div className="flex-1 space-y-6">
            {/* Sentiment Overview Chart */}
            <div className={`${cardBgColor} rounded-lg p-4 lg:p-5 border ${borderColor}`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h2 className={`text-lg font-semibold ${textColor}`}>Sentiment Overview</h2>
                <TimeRangeSelector 
                  currentRange={timeRange}
                  onRangeChange={handleTimeRangeChange}
                  isDisabled={isDataLoading}
                />
              </div>
              {/* Show loading state during chart loading or time range transitions */}
              {(loading.chart || isTransitioning) && !errors.rateLimited && !errors.chart ? (
                <div className="flex flex-col items-center justify-center p-10 text-center">
                  <Loader2 className="mb-2 text-blue-500 animate-spin" size={32} />
                  <p className={`text-lg font-semibold ${textColor}`}>{loadingStage}</p>
                  <div className="w-full max-w-sm mt-4 mb-2">
                    <ProgressBar progress={loadingProgress} />
                  </div>
                  <div className={`text-xs ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>{loadingProgress}% complete</div>
                </div>
              ) : errors.rateLimited ? (
                <div className="flex flex-col items-center justify-center p-10 text-center">
                  <AlertTriangle className="mb-2 text-red-500" size={32} />
                  <p className={`text-lg font-semibold ${textColor}`}>Rate Limit Exceeded</p>
                  <p className={`mt-2 ${mutedTextColor}`}>The Reddit API is currently rate limiting requests. Please wait a moment and try again later.</p>
                  <button 
                    onClick={refreshData} 
                    className={`mt-4 px-4 py-2 ${activeButtonBgColor} text-white rounded-md transition-colors`}
                    disabled={isDataLoading}
                  >
                    Try Again
                  </button>
                </div>
              ) : errors.chart ? (
                <div className="flex flex-col items-center justify-center p-10 text-center">
                  <AlertTriangle className="mb-2 text-yellow-500" size={32} />
                  <p className={textColor}>{errors.chart}</p>
                </div>
              ) : chartData.length > 0 ? (
                <>
                  {/* Debug output for chart data */}
                  {console.log('Current chart data state:', chartData)}
                  <SentimentChart 
                    data={chartData} 
                    isLoading={loading.chart}
                    loadingProgress={loadingProgress}
                    loadingStage={loadingStage}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-10 text-center">
                  <Info className={`mb-2 ${mutedTextColor}`} size={32} />
                  <p className={mutedTextColor}>No chart data available for the selected time period</p>
                </div>
              )}
            </div>
            
            {/* Top Reddit Posts */}
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
          
          <div className="xl:w-1/3 space-y-6">
            {/* Top Sentiment Scores */}
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
            
            {/* Watchlist section removed */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentimentDashboard;
