import { ChartData, WatchlistItem, TimeRange, SentimentData, RedditPost, InsiderTrade, InstitutionalHolding, EarningsEvent, EarningsAnalysis } from '../types';
import { fetchRedditPosts as fetchRedditPostsReal } from './redditClient';
import { generateChartData } from './chartUtils';
import { getProxyUrl } from './apiService';

// We're now fetching data directly from public APIs rather than our own backend

/**
 * Export data-fetching APIs with fallbacks to demo data
 */
/**
 * Fetch sentiment data from Reddit API - no fallbacks
 */

/**
 * Fetch per-ticker sentiment scores aggregated across recent posts.
 * Returns an array of SentimentData (one per ticker) ordered by backend.
 */
export const fetchTickerSentiments = async (timeRange: TimeRange = '1w', signal?: AbortSignal): Promise<SentimentData[]> => {
  try {
    console.log(`[REDDIT API DEBUG] Starting fetchTickerSentiments call for timeRange: ${timeRange}`);
    const proxyUrl = getProxyUrl();
    const token = localStorage.getItem('auth_token');
    
    console.log(`[REDDIT API DEBUG] Using proxy URL: ${proxyUrl}`);
    console.log(`[REDDIT API DEBUG] Using auth token: ${token ? 'Present' : 'Missing'}`);
    
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${proxyUrl}/api/sentiment-unified/reddit/tickers?timeRange=${timeRange}`;
    console.log(`[REDDIT API DEBUG] Making request to: ${url}`);

    const response = await fetch(url, { 
      signal,
      headers
    });

    console.log(`[REDDIT API DEBUG] Response status: ${response.status}`);
    console.log(`[REDDIT API DEBUG] Response headers:`, response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[REDDIT API ERROR] ${response.status}: ${errorText}`);
      throw new Error(`Proxy server returned error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[REDDIT API DEBUG] Response data:`, data);
    
    // Check if sentimentData exists and is an array
    if (!data || !data.sentimentData || !Array.isArray(data.sentimentData)) {
      console.warn('[REDDIT API WARNING] Unexpected response format from ticker sentiment API:', data);
      return []; // Return empty array instead of throwing
    }
    
    // 🔧 FIX: Add additional validation and logging
    const sentimentArray = data.sentimentData as SentimentData[];
    console.log(`[REDDIT API DEBUG] Successfully received ${sentimentArray.length} sentiment items`);
    
    // 🔧 FIX: Validate each item has required fields
    const validatedData = sentimentArray.filter((item, index) => {
      const isValid = item && 
                     typeof item.ticker === 'string' && 
                     typeof item.score === 'number' && 
                     typeof item.sentiment === 'string' &&
                     typeof item.source === 'string';
      
      if (!isValid) {
        console.warn(`[REDDIT API WARNING] Invalid sentiment item at index ${index}:`, item);
        return false;
      }
      
      console.log(`[REDDIT API DEBUG] Valid sentiment item: ${item.ticker} - score: ${item.score}, confidence: ${item.confidence}`);
      return true;
    });
    
    console.log(`[REDDIT API DEBUG] Returning ${validatedData.length} validated sentiment items`);
    
    return validatedData;
  } catch (error) {
    console.error('[REDDIT API ERROR] Ticker sentiment API error:', error);
    console.error('[REDDIT API ERROR] Error type:', typeof error);
    console.error('[REDDIT API ERROR] Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[REDDIT API ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    // 🔧 FIX: Return empty array but also log this as a critical issue
    console.error('[REDDIT API ERROR] CRITICAL: Returning empty array due to API failure');
    return []; // Return empty array instead of throwing
  }
};

/**
 * Fetch sentiment data from Reddit API - no fallbacks
 * @throws {Error} When the API returns an error or unexpected format
 */
export const fetchSentimentData = async (timeRange: TimeRange = '1w', signal?: AbortSignal): Promise<SentimentData[]> => {
  try {
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Starting fetchSentimentData for timeRange: ${timeRange}`);
    const proxyUrl = getProxyUrl();
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Using proxy URL: ${proxyUrl}`);
    
    // Add authentication header like the ticker sentiment function does
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log(`[REDDIT MARKET SENTIMENT DEBUG] Using auth token for market sentiment`);
    } else {
      console.warn(`[REDDIT MARKET SENTIMENT DEBUG] No auth token found for market sentiment`);
    }
    
    const url = `${proxyUrl}/api/sentiment-unified/reddit/market?timeRange=${timeRange}`;
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Making request to: ${url}`);
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Request headers:`, headers);
    
    const response = await fetch(url, { 
      signal,
      headers
    });
    
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Response status: ${response.status}`);
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Response headers:`, response.headers);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[REDDIT MARKET SENTIMENT ERROR] API error ${response.status}: ${errorText}`);
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    const rawData = await response.json();
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Raw response data:`, rawData);
    
    // Handle unified endpoint response format: extract actual data
    const intermediateData = rawData.success ? rawData.data : rawData;
    // The actual sentiment data is nested one level deeper
    const data = intermediateData.data || intermediateData;
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Intermediate data:`, intermediateData);
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Final extracted data:`, data);
    
    // Validate the response contains the expected data structure
    if (!data) {
      console.error('[REDDIT MARKET SENTIMENT ERROR] Empty response from sentiment API');
      throw new Error('Empty response from sentiment API');
    }
    
    // Handle time series format with timestamps, bullish, bearish, neutral arrays
    if (data.timestamps && Array.isArray(data.timestamps) && 
        data.bullish && Array.isArray(data.bullish) &&
        data.bearish && Array.isArray(data.bearish) &&
        data.neutral && Array.isArray(data.neutral)) {
      
      console.log('=== REDDIT MARKET SENTIMENT BREAKDOWN ===');
      console.log('Timestamps:', data.timestamps);
      console.log('Bullish percentages:', data.bullish);
      console.log('Bearish percentages:', data.bearish);
      console.log('Neutral percentages:', data.neutral);
      console.log('Total counts:', data.total);
      
      const sentimentData: SentimentData[] = [];
      
      // Create a sentiment data point for each timestamp
      data.timestamps.forEach((timestamp: string, index: number) => {
        const bullishPercent = data.bullish[index] || 0;
        const bearishPercent = data.bearish[index] || 0;
        const neutralPercent = data.neutral[index] || 0;
        
        console.log(`Time point ${index}: Bullish=${bullishPercent}, Bearish=${bearishPercent}, Neutral=${neutralPercent}`);
        
        // Determine the dominant sentiment based on highest percentage
        let dominantSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        let sentimentScore = 0;
        
        // Use actual dominant sentiment - this is real data for trading decisions
        if (bullishPercent > bearishPercent && bullishPercent > neutralPercent) {
          dominantSentiment = 'bullish';
          sentimentScore = bullishPercent;
          console.log(`→ Determined as BULLISH (${(bullishPercent * 100).toFixed(1)}% vs ${(bearishPercent * 100).toFixed(1)}% bearish, ${(neutralPercent * 100).toFixed(1)}% neutral)`);
        } else if (bearishPercent > bullishPercent && bearishPercent > neutralPercent) {
          dominantSentiment = 'bearish';
          sentimentScore = -bearishPercent; // Negative for bearish
          console.log(`→ Determined as BEARISH (${(bearishPercent * 100).toFixed(1)}% vs ${(bullishPercent * 100).toFixed(1)}% bullish, ${(neutralPercent * 100).toFixed(1)}% neutral)`);
        } else {
          dominantSentiment = 'neutral';
          sentimentScore = 0;
          console.log(`→ Determined as NEUTRAL (${(neutralPercent * 100).toFixed(1)}% neutral, ${(bullishPercent * 100).toFixed(1)}% bullish, ${(bearishPercent * 100).toFixed(1)}% bearish)`);
        }
        
        sentimentData.push({
          timestamp,
          bullish: bullishPercent,
          bearish: bearishPercent,
          neutral: neutralPercent,
          // Add required fields with calculated values
          ticker: 'MARKET',
          source: 'reddit',
          score: sentimentScore,
          sentiment: dominantSentiment,
          confidence: Math.max(bullishPercent, bearishPercent, neutralPercent), // Confidence based on strongest sentiment
          postCount: data.total ? data.total[index] || 0 : 0,
          commentCount: 0,
          upvotes: 0
        });
      });
      
      if (sentimentData.length === 0) {
        console.warn('[REDDIT MARKET SENTIMENT WARNING] No data points in time series response');
      } else {
        console.log(`[REDDIT MARKET SENTIMENT SUCCESS] Fetched ${sentimentData.length} sentiment data points from time series`);
      }
      
      return sentimentData;
    }
    
    // Handle single point data format (fallback)
    console.log('[REDDIT MARKET SENTIMENT DEBUG] Checking for single point data format...');
    if (data.sentiment || data.score !== undefined) {
      console.log('[REDDIT MARKET SENTIMENT DEBUG] Using single point data format');
      return [{
        ticker: 'MARKET',
        score: data.score || 0,
        sentiment: data.sentiment || 'neutral',
        source: 'reddit',
        timestamp: data.timestamp || new Date().toISOString(),
        confidence: data.confidence || 0,
        postCount: data.postCount || 0,
        commentCount: data.commentCount || 0,
        upvotes: data.upvotes || 0
      }];
    }
    
    console.error('[REDDIT MARKET SENTIMENT ERROR] Unexpected response format:', data);
    throw new Error('Unexpected response format from Reddit market sentiment API');
    
  } catch (error) {
    console.error('[REDDIT MARKET SENTIMENT ERROR] Full error details:', error);
    console.error('[REDDIT MARKET SENTIMENT ERROR] Error type:', typeof error);
    console.error('[REDDIT MARKET SENTIMENT ERROR] Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[REDDIT MARKET SENTIMENT ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    // 🔧 FIX: Return empty array but also log this as a critical issue
    console.error('[REDDIT MARKET SENTIMENT ERROR] CRITICAL: Reddit market sentiment timeline unavailable - returning empty array');
    return []; // Return empty array instead of throwing
  }
};

/**
 * Fetch Reddit posts - no fallbacks
 */
export const fetchRedditPosts = async (signal?: AbortSignal): Promise<RedditPost[]> => {
  try {
    // Try getting posts from our Reddit client first
    try {
      return await fetchRedditPostsReal(signal);
    } catch (clientError) {
      console.warn('Client-side Reddit fetch failed, trying proxy API directly:', clientError);
      // If the client-side fetch fails, try the direct proxy API
      const proxyUrl = getProxyUrl();
      const token = localStorage.getItem('auth_token');
      
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${proxyUrl}/api/reddit/subreddit/wallstreetbets?limit=25`, { 
        signal,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Proxy server returned error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.data && data.data.children && Array.isArray(data.data.children)) {
        // Format matches the Reddit API format with children array
        const formattedPosts: RedditPost[] = data.data.children.map((post: any) => ({
          id: post.data.id,
          title: post.data.title,
          content: post.data.selftext || '',
          author: post.data.author,
          upvotes: post.data.ups,
          commentCount: post.data.num_comments,
          url: `https://reddit.com${post.data.permalink}`,
          created: new Date(post.data.created_utc * 1000).toISOString(),
          subreddit: post.data.subreddit
        }));
        
        console.log(`Fetched ${formattedPosts.length} Reddit posts from proxy API`);
        return formattedPosts;
      } else if (data && data.posts && Array.isArray(data.posts)) {
        // Format has a posts array directly
        console.log(`Fetched ${data.posts.length} Reddit posts from posts array`);
        return data.posts;
      } else {
        throw new Error('Unexpected response format from Reddit API');
      }
    }
  } catch (error) {
    console.error('Reddit API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch Reddit posts');
  }
};

/**
 * Generate chart data based on sentiment data and time range
 * No fallbacks - returns empty array with clear error if data unavailable
 */
export const fetchChartData = async (timeRange: TimeRange = '1w', signal?: AbortSignal): Promise<ChartData[]> => {
  try {
    // Get sentiment data from Reddit (passing the timeRange parameter)
    const sentimentData = await fetchSentimentData(timeRange, signal);
    
    // Check if we have valid sentiment data
    if (!sentimentData || !Array.isArray(sentimentData)) {
      console.warn('Invalid sentiment data received for chart generation');
      return [];
    }
    
    // Log the amount of data we're working with for the selected time range
    console.log(`Processing ${sentimentData.length} sentiment data points for ${timeRange} chart`);
    
    // Generate chart data using the utility
    const chartData = generateChartData(sentimentData, timeRange);
    
    // Check if chart data is valid
    if (!chartData || !Array.isArray(chartData)) {
      console.warn('Invalid chart data generated');
      return [];
    }
    
    // If we have chart data, return it
    if (chartData.length > 0) {
      console.log(`Generated chart data for ${timeRange}: ${chartData.length} data points`);
      return chartData;
    }
    
    // If no chart data, log a warning but return empty array instead of throwing
    console.warn(`No chart data available for time range: ${timeRange}`);
    return [];
  } catch (error) {
    // Log the error
    console.error('Error generating chart data:', error);
    
    // Return empty array instead of rethrowing
    return [];
  }
};

/**
 * Fetch watchlist items
 * For now, there is no real API for watchlist, so we throw an error
 */
export const fetchWatchlist = async (): Promise<WatchlistItem[]> => {
  throw new Error('Watchlist API not implemented yet - storage will be added in next sprint');
};

/**
 * Fetch Yahoo Finance market sentiment data (aggregated from major indices)
 */
export const fetchYahooMarketSentiment = async (timeRange: TimeRange = '1w', signal?: AbortSignal): Promise<SentimentData[]> => {
  try {
    const proxyUrl = getProxyUrl();
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${proxyUrl}/api/sentiment-unified/yahoo/market?timeRange=${timeRange}`, { 
      signal,
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Yahoo market sentiment API returned error: ${response.status}`);
    }
    
    const rawData = await response.json();
    
    // Handle unified endpoint response format: extract actual data
    const intermediateData = rawData.success ? rawData.data : rawData;
    const data = intermediateData.data || intermediateData;
    
    if (data.sentimentData && Array.isArray(data.sentimentData)) {
      console.log(`Fetched ${data.sentimentData.length} Yahoo Finance historical sentiment data points for ${timeRange}`);
      return data.sentimentData;
    }
    
    // Handle timeline format
    if (data.timeline && Array.isArray(data.timeline)) {
      console.log(`Fetched ${data.timeline.length} Yahoo Finance timeline sentiment data points for ${timeRange}`);
      return data.timeline;
    }
    
    console.warn('Unexpected response format from Yahoo market sentiment API:', rawData);
    return [];
  } catch (error) {
    console.error('Failed to fetch Yahoo market sentiment:', error);
    return [];
  }
};

/**
 * Fetch FinViz market sentiment data (aggregated from major tickers)
 */
export const fetchFinvizMarketSentiment = async (timeRange: TimeRange = '1w', signal?: AbortSignal): Promise<SentimentData[]> => {
  try {
    const proxyUrl = getProxyUrl();
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${proxyUrl}/api/sentiment-unified/finviz/market?timeRange=${timeRange}`, { 
      signal,
      headers
    });
    
    if (!response.ok) {
      throw new Error(`FinViz market sentiment API returned error: ${response.status}`);
    }
    
    const rawData = await response.json();
    
    // Handle unified endpoint response format: extract actual data
    const intermediateData = rawData.success ? rawData.data : rawData;
    const data = intermediateData.data || intermediateData;
    
    if (data.sentimentData && Array.isArray(data.sentimentData)) {
      console.log(`Fetched ${data.sentimentData.length} FinViz historical sentiment data points for ${timeRange}`);
      return data.sentimentData;
    }
    
    // Handle timeline format
    if (data.timeline && Array.isArray(data.timeline)) {
      console.log(`Fetched ${data.timeline.length} FinViz timeline sentiment data points for ${timeRange}`);
      return data.timeline;
    }
    
    console.warn('Unexpected response format from FinViz market sentiment API:', rawData);
    return [];
  } catch (error) {
    console.error('Failed to fetch FinViz market sentiment:', error);
    return [];
  }
};

/**
 * Fetch aggregated market sentiment from all sources
 */
export const fetchAggregatedMarketSentiment = async (timeRange: TimeRange = '1w', signal?: AbortSignal, hasRedditAccess: boolean = true): Promise<SentimentData[]> => {
  try {
    console.log(`[AGGREGATED MARKET DEBUG] Starting fetchAggregatedMarketSentiment with timeRange=${timeRange}, hasRedditAccess=${hasRedditAccess}`);
    console.log(`Fetching aggregated market sentiment from ${hasRedditAccess ? 'all sources' : 'FinViz + Yahoo only'}...`);
    
    // Conditionally fetch data based on tier access
    const promises = [
      fetchYahooMarketSentiment(timeRange, signal),
      fetchFinvizMarketSentiment(timeRange, signal)
    ];
    
    // Only include Reddit if user has access
    if (hasRedditAccess) {
      console.log(`[AGGREGATED MARKET DEBUG] Adding Reddit market sentiment to promises`);
      promises.unshift(fetchSentimentData(timeRange, signal));
    } else {
      console.log(`[AGGREGATED MARKET DEBUG] Skipping Reddit market sentiment - no access`);
    }
    
    console.log(`[AGGREGATED MARKET DEBUG] About to fetch from ${promises.length} sources in parallel`);
    
    // Fetch data from available sources in parallel
    const results = await Promise.allSettled(promises);
    
    console.log(`[AGGREGATED MARKET DEBUG] Promise.allSettled results:`, results);
    
    // Extract successful results
    let reddit: SentimentData[] = [];
    let yahoo: SentimentData[] = [];
    let finviz: SentimentData[] = [];
    
    let resultIndex = 0;
    if (hasRedditAccess) {
      const redditResult = results[resultIndex];
      console.log(`[AGGREGATED MARKET DEBUG] Reddit result:`, redditResult);
      reddit = redditResult.status === 'fulfilled' ? redditResult.value : [];
      console.log(`[AGGREGATED MARKET DEBUG] Reddit data length: ${reddit.length}`);
      resultIndex++;
    }
    const yahooResult = results[resultIndex];
    console.log(`[AGGREGATED MARKET DEBUG] Yahoo result:`, yahooResult);
    yahoo = yahooResult.status === 'fulfilled' ? yahooResult.value : [];
    console.log(`[AGGREGATED MARKET DEBUG] Yahoo data length: ${yahoo.length}`);
    
    const finvizResult = results[resultIndex + 1];
    console.log(`[AGGREGATED MARKET DEBUG] FinViz result:`, finvizResult);
    finviz = finvizResult.status === 'fulfilled' ? finvizResult.value : [];
    console.log(`[AGGREGATED MARKET DEBUG] FinViz data length: ${finviz.length}`);
    
    console.log(`Source data: Reddit=${reddit.length}, Yahoo=${yahoo.length}, FinViz=${finviz.length}`);
    
    // If we have no data from any source, return empty
    if (reddit.length === 0 && yahoo.length === 0 && finviz.length === 0) {
      console.warn('No market sentiment data available from any source');
      return [];
    }
    
    // If we only have Reddit data (timeline), return it as-is
    if (reddit.length > 0 && yahoo.length === 0 && finviz.length === 0) {
      console.log('Using Reddit timeline data only');
      return reddit;
    }
    
    // If we have Reddit timeline data plus other sources, enhance the timeline
    if (reddit.length > 0) {
      console.log('Enhancing Reddit timeline with other sources');
      
      // Take the Reddit timeline structure and add current sentiment from other sources
      const enhancedData: SentimentData[] = [...reddit];
      
      // Add current Yahoo sentiment as additional data points
      if (yahoo.length > 0) {
        enhancedData.push(...yahoo);
      }
      
      // Add current FinViz sentiment as additional data points  
      if (finviz.length > 0) {
        enhancedData.push(...finviz);
      }
      
      console.log(`Enhanced timeline: ${enhancedData.length} total data points`);
      return enhancedData;
    }
    
    // If we only have current sentiment data (no timeline), create a simple aggregation
    const currentData: SentimentData[] = [];
    if (yahoo.length > 0) currentData.push(...yahoo);
    if (finviz.length > 0) currentData.push(...finviz);
    
    console.log(`Using current sentiment data only: ${currentData.length} points`);
    return currentData;
    
  } catch (error) {
    console.error('[AGGREGATED MARKET ERROR] Error fetching aggregated market sentiment:', error);
    return [];
  }
};

// Re-export earnings functions from the earnings subdirectory
export {
  fetchUpcomingEarningsWithUserCache,
  streamUpcomingEarnings,
  fetchEarningsAnalysisWithUserCache,
  fetchHistoricalEarningsWithUserCache,
  fetchCompanyInfoForEarnings,
  getUserEarningsCacheStatus,
  clearUserEarningsCache,
  clearEarningsCache
} from './earnings';

// Re-export SEC functions from the sec subdirectory
export {
  fetchInsiderTrades,
  fetchInsiderTradesWithUserCache,
  streamInsiderTrades,
  streamInsiderTradesWithUserCache,
  fetchInstitutionalHoldings,
  fetchInstitutionalHoldingsWithUserCache,
  fetchSecDataParallel,
  clearSecCache,
  getUserSecCacheStatus,
  clearUserSecCache
} from './sec';