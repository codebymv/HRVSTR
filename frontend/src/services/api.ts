import { ChartData, WatchlistItem, TimeRange, SentimentData, RedditPost, InsiderTrade, InstitutionalHolding } from '../types';
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

    const url = `${proxyUrl}/api/sentiment/reddit/tickers?timeRange=${timeRange}`;
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
    
    console.log(`[REDDIT API DEBUG] Successfully received ${data.sentimentData.length} sentiment items`);
    
    // Debug log to see what data is coming from the API
    data.sentimentData.forEach((item: {ticker: string, confidence?: number}) => {
      console.log(`[REDDIT API DEBUG] TICKER ${item.ticker} - confidence: ${item.confidence}, typeof: ${typeof item.confidence}`);
    });
    
    return data.sentimentData as SentimentData[];
  } catch (error) {
    console.error('[REDDIT API ERROR] Ticker sentiment API error:', error);
    console.error('[REDDIT API ERROR] Error type:', typeof error);
    console.error('[REDDIT API ERROR] Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[REDDIT API ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return []; // Return empty array instead of throwing
  }
};

/**
 * Fetch sentiment data from Reddit API - no fallbacks
 * @throws {Error} When the API returns an error or unexpected format
 */
export const fetchSentimentData = async (timeRange: TimeRange = '1w', signal?: AbortSignal): Promise<SentimentData[]> => {
  try {
    console.log(`Fetching Reddit sentiment data for timeRange: ${timeRange}`);
    const proxyUrl = getProxyUrl();
    console.log(`Using proxy URL: ${proxyUrl}`);
    
    // Add authentication header like the ticker sentiment function does
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log(`[REDDIT MARKET DEBUG] Using auth token for market sentiment`);
    } else {
      console.warn(`[REDDIT MARKET DEBUG] No auth token found for market sentiment`);
    }
    
    const response = await fetch(`${proxyUrl}/api/sentiment/reddit/market?timeRange=${timeRange}`, { 
      signal,
      headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error ${response.status}: ${errorText}`);
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Validate the response contains the expected data structure
    if (!data) {
      throw new Error('Empty response from sentiment API');
    }
    
    // Handle time series format with timestamps, bullish, bearish, neutral arrays
    if (data.timestamps && Array.isArray(data.timestamps) && 
        data.bullish && Array.isArray(data.bullish) &&
        data.bearish && Array.isArray(data.bearish) &&
        data.neutral && Array.isArray(data.neutral)) {
      
      console.log('=== REDDIT SENTIMENT BREAKDOWN ===');
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
        console.warn('No data points in time series response');
      } else {
        console.log(`Fetched ${sentimentData.length} sentiment data points from time series`);
      }
      
      return sentimentData;
    }
    
    // Handle the preferred response format with sentimentData array
    if (data.sentimentData && Array.isArray(data.sentimentData)) {
      if (data.sentimentData.length === 0) {
        console.warn('Received empty sentiment data array from API');
      } else {
        console.log(`Fetched ${data.sentimentData.length} sentiment data points`);
      }
      return data.sentimentData;
    }
    
    // Handle direct array response (legacy format)
    if (Array.isArray(data)) {
      if (data.length === 0) {
        console.warn('Received empty array from sentiment API');
      } else {
        console.log(`Fetched ${data.length} sentiment data points (legacy format)`);
      }
      return data;
    }
    
    // If we get a single sentiment object, it's not what we expect
    if (data.sentiment !== undefined) {
      throw new Error('Received single sentiment point instead of time series. Backend should always return full timeline.');
    }
    
    // If we get here, the response format is unexpected
    console.error('Unexpected response format from sentiment API:', data);
    throw new Error('Unexpected response format from API');
    
  } catch (error) {
    console.error('Failed to fetch sentiment data:', error);
    throw error; // Re-throw to let the caller handle it
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
 * Fetch insider trades from SEC Form 4 filings
 * Returns insider trading data for the specified time range
 */
export const fetchInsiderTrades = async (timeRange: TimeRange = '1m', refresh: boolean = false, signal?: AbortSignal): Promise<InsiderTrade[]> => {
  try {
    const proxyUrl = getProxyUrl();
    const refreshParam = refresh ? '&refresh=true' : '';
    const response = await fetch(`${proxyUrl}/api/sec/insider-trades?timeRange=${timeRange}${refreshParam}`, { signal });
    
    if (!response.ok) {
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Raw insider trades data:', data);
    
    // Ensure we have valid data with all required fields
    if (!data.insiderTrades || !Array.isArray(data.insiderTrades)) {
      throw new Error('Invalid insider trades data format');
    }
    
    // Helper function to clean insider names
    const cleanInsiderName = (rawName: string): string => {
      if (!rawName) return 'Unknown';
      
      // If it contains "Insider (Name Not Available)", return a better placeholder
      if (rawName.includes('Insider (Name Not Available)')) {
        return 'Insider';
      }

      // Remove any HTML tags
      let clean = rawName.replace(/<[^>]*>/g, '');
      
      // Remove CIK numbers and other metadata
      clean = clean.replace(/\(\d{10}\)/g, '');
      clean = clean.replace(/\(\d+\)/g, '');
      clean = clean.replace(/\(Reporting\)/g, '');
      clean = clean.replace(/\(Issuer\)/g, '');
      clean = clean.replace(/\(Filer\)/g, '');
      
      // If string contains AccNo metadata, chop off at AccNo:
      if (clean.includes('AccNo:')) {
        clean = clean.split('AccNo:')[0].trim();
      }
      
      // Extract the actual name from the filing data if possible
      const reportingPersonMatch = clean.match(/Reporting Person:\s*([^\n(]+)/i);
      if (reportingPersonMatch && reportingPersonMatch[1]) {
        clean = reportingPersonMatch[1].trim();
      }
      
      // Check if this is likely a company name rather than a person
      const companyIndicators = ['Inc', 'Corp', 'LLC', 'Ltd', 'LP', 'REIT', 'Group', 'Fund', 'Trust', 'Solutions', 'Investment', 'Financial'];
      const isLikelyCompany = companyIndicators.some(indicator => 
        clean.includes(indicator) || 
        clean.includes(indicator.toUpperCase()) || 
        clean.includes(indicator.toLowerCase())
      );
      
      // If it's a company, just ensure proper capitalization but don't format as a person name
      if (!isLikelyCompany) {
        // Ensure proper capitalization for person names
        if (clean.toUpperCase() === clean || clean.toLowerCase() === clean) {
          clean = clean.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        }
      }
      
      return clean;
    };
    
    // Process each trade to ensure it matches our interface
    const processedTrades = data.insiderTrades.map((trade: any): InsiderTrade => {
      // Clean the insider name
      const cleanedName = cleanInsiderName(trade.insiderName);
      
      // Clean the ticker if it's malformed
      let ticker = trade.ticker || '-';
      if (ticker === '-' || !ticker) {
        // Try to extract ticker from the filing data
        const tickerMatch = trade.insiderName?.match(/\b([A-Z]{1,5})\b/);
        if (tickerMatch && tickerMatch[1]) {
          ticker = tickerMatch[1];
        }
      }
      
      // Ensure all required fields are present with correct types
      return {
        id: trade.id || `trade-${Date.now()}-${Math.random()}`,
        ticker: ticker,
        insiderName: cleanedName,
        title: trade.title || 'Executive',
        tradeType: trade.tradeType || 'BUY',
        shares: typeof trade.shares === 'number' ? trade.shares : 0,
        price: typeof trade.price === 'number' ? trade.price : 0,
        value: typeof trade.value === 'number' ? trade.value : 0,
        filingDate: trade.filingDate || new Date().toISOString(),
        transactionDate: trade.transactionDate || new Date().toISOString(),
        formType: trade.formType || 'Form 4'
      };
    });
    
    // Calculate values if missing but we have shares and price
    processedTrades.forEach((trade: InsiderTrade) => {
      if (trade.value === 0 && trade.shares > 0 && trade.price > 0) {
        trade.value = trade.shares * trade.price;
      }
    });
    
    console.log(`Processed ${processedTrades.length} insider trades`);
    return processedTrades;
  } catch (error) {
    console.error('Insider trades API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch insider trades data');
  }
};

/**
 * Fetch institutional holdings from SEC 13F filings
 * Returns institutional holdings data for the specified time range
 */
export const fetchInstitutionalHoldings = async (timeRange: TimeRange = '1m', refresh: boolean = false, signal?: AbortSignal): Promise<InstitutionalHolding[]> => {
  try {
    const proxyUrl = getProxyUrl();
    const refreshParam = refresh ? '&refresh=true' : '';
    
    // Get authentication token and prepare headers
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${proxyUrl}/api/sec/institutional-holdings?timeRange=${timeRange}${refreshParam}`, { 
      signal,
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.institutionalHoldings as InstitutionalHolding[];
  } catch (error) {
    console.error('Institutional holdings API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch institutional holdings data');
  }
};

/**
 * Clear the SEC data cache on the server
 * This forces the next data fetch to get fresh data from the SEC
 */
export const clearSecCache = async (signal?: AbortSignal): Promise<{success: boolean, message: string}> => {
  try {
    const proxyUrl = getProxyUrl();
    const response = await fetch(`${proxyUrl}/api/sec/clear-cache`, { signal });
    
    if (!response.ok) {
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error clearing SEC cache:', error);
    throw error;
  }
};

/**
 * Fetch Yahoo Finance market sentiment data
 */
export const fetchYahooMarketSentiment = async (signal?: AbortSignal): Promise<SentimentData[]> => {
  try {
    const proxyUrl = getProxyUrl();
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${proxyUrl}/api/sentiment/yahoo/market`, { 
      signal,
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Yahoo market sentiment API returned error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.sentimentData && Array.isArray(data.sentimentData)) {
      console.log(`Fetched ${data.sentimentData.length} Yahoo market sentiment data points`);
      return data.sentimentData;
    }
    
    console.warn('Unexpected response format from Yahoo market sentiment API:', data);
    return [];
  } catch (error) {
    console.error('Failed to fetch Yahoo market sentiment:', error);
    return [];
  }
};

/**
 * Fetch FinViz market sentiment data (aggregated from major tickers)
 */
export const fetchFinvizMarketSentiment = async (signal?: AbortSignal): Promise<SentimentData[]> => {
  try {
    const proxyUrl = getProxyUrl();
    // Use major market ETFs to represent overall market sentiment
    // Note: Free tier allows max 3 tickers, so we use SPY,QQQ,IWM (removed VIX)
    const marketTickers = 'SPY,QQQ,IWM';
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${proxyUrl}/api/finviz/ticker-sentiment?tickers=${marketTickers}`, { 
      signal,
      headers
    });
    
    if (!response.ok) {
      throw new Error(`FinViz market sentiment API returned error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.sentimentData && Array.isArray(data.sentimentData)) {
      // Calculate average market sentiment from major ETFs
      const avgScore = data.sentimentData.reduce((sum: number, item: any) => sum + (item.score || 0), 0) / data.sentimentData.length;
      const avgConfidence = Math.round(data.sentimentData.reduce((sum: number, item: any) => sum + (item.confidence || 0), 0) / data.sentimentData.length);
      
      // Determine overall sentiment
      let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (avgScore > 0.15) sentiment = 'bullish';
      else if (avgScore < -0.15) sentiment = 'bearish';
      
      const marketSentiment: SentimentData[] = [{
        ticker: 'MARKET',
        score: avgScore,
        sentiment,
        source: 'finviz' as const,
        timestamp: new Date().toISOString(),
        confidence: avgConfidence,
        postCount: data.sentimentData.length,
        commentCount: 0,
        upvotes: 0
      }];
      
      console.log(`Aggregated FinViz market sentiment from ${data.sentimentData.length} ETFs:`, marketSentiment[0]);
      return marketSentiment;
    }
    
    console.warn('Unexpected response format from FinViz sentiment API:', data);
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
    console.log(`Fetching aggregated market sentiment from ${hasRedditAccess ? 'all sources' : 'FinViz + Yahoo only'}...`);
    
    // Conditionally fetch data based on tier access
    const promises = [
      fetchYahooMarketSentiment(signal),
      fetchFinvizMarketSentiment(signal)
    ];
    
    // Only include Reddit if user has access
    if (hasRedditAccess) {
      promises.unshift(fetchSentimentData(timeRange, signal));
    }
    
    // Fetch data from available sources in parallel
    const results = await Promise.allSettled(promises);
    
    // Extract successful results
    let reddit: SentimentData[] = [];
    let yahoo: SentimentData[] = [];
    let finviz: SentimentData[] = [];
    
    let resultIndex = 0;
    if (hasRedditAccess) {
      const redditResult = results[resultIndex];
      reddit = redditResult.status === 'fulfilled' ? redditResult.value : [];
      resultIndex++;
    }
    const yahooResult = results[resultIndex];
    yahoo = yahooResult.status === 'fulfilled' ? yahooResult.value : [];
    const finvizResult = results[resultIndex + 1];
    finviz = finvizResult.status === 'fulfilled' ? finvizResult.value : [];
    
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
    console.error('Error fetching aggregated market sentiment:', error);
    return [];
  }
};

/**
 * Fetch both insider trades and institutional holdings in parallel for optimal loading
 * This reduces the number of API calls and improves overall loading performance
 */
export const fetchSecDataParallel = async (timeRange: TimeRange = '1m', refresh: boolean = false, signal?: AbortSignal): Promise<{
  insiderTrades: InsiderTrade[];
  institutionalHoldings: InstitutionalHolding[];
  metadata: { fetchedAt: string; refreshed: boolean };
}> => {
  try {
    const proxyUrl = getProxyUrl();
    const refreshParam = refresh ? '&refresh=true' : '';
    const response = await fetch(`${proxyUrl}/api/sec/parallel?timeRange=${timeRange}${refreshParam}`, { signal });
    
    if (!response.ok) {
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Parallel SEC data response:', data);
    
    // Process insider trades with the same cleaning logic
    const processedInsiderTrades = data.insiderTrades?.data ? 
      data.insiderTrades.data.map((trade: any): InsiderTrade => {
        // Apply the same cleaning logic as the individual endpoint
        const cleanedName = cleanInsiderName(trade.insiderName || 'Unknown');
        let ticker = trade.ticker || '-';
        
        return {
          id: trade.id || `trade-${Date.now()}-${Math.random()}`,
          ticker: ticker,
          insiderName: cleanedName,
          title: trade.title || 'Executive',
          tradeType: trade.tradeType || 'BUY',
          shares: typeof trade.shares === 'number' ? trade.shares : 0,
          price: typeof trade.price === 'number' ? trade.price : 0,
          value: typeof trade.value === 'number' ? trade.value : 0,
          filingDate: trade.filingDate || new Date().toISOString(),
          transactionDate: trade.transactionDate || new Date().toISOString(),
          formType: trade.formType || 'Form 4'
        };
      }) : [];
    
    // Institutional holdings need minimal processing
    const processedInstitutionalHoldings = data.institutionalHoldings?.data || [];
    
    console.log(`Processed ${processedInsiderTrades.length} insider trades and ${processedInstitutionalHoldings.length} institutional holdings in parallel`);
    
    return {
      insiderTrades: processedInsiderTrades,
      institutionalHoldings: processedInstitutionalHoldings,
      metadata: {
        fetchedAt: data.fetchedAt,
        refreshed: data.refreshed
      }
    };
  } catch (error) {
    console.error('Parallel SEC data API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch SEC data');
  }
};

/**
 * Stream insider trades with real-time progress updates using Server-Sent Events
 */
export const streamInsiderTrades = (
  timeRange: TimeRange = '1m', 
  refresh: boolean = false,
  onProgress: (progressData: {
    stage: string;
    progress: number;
    total: number;
    current: number;
    error?: string;
    data?: any;
    completed?: boolean;
    timestamp: string;
  }) => void,
  onComplete: (data: any) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): EventSource => {
  const proxyUrl = getProxyUrl();
  const refreshParam = refresh ? '&refresh=true' : '';
  const streamUrl = `${proxyUrl}/api/sec/insider-trades/stream?timeRange=${timeRange}${refreshParam}`;
  
  console.log('Starting SSE stream for insider trades:', streamUrl);
  
  const eventSource = new EventSource(streamUrl);
  
  eventSource.onmessage = (event) => {
    try {
      const progressData = JSON.parse(event.data);
      console.log('SSE Progress:', progressData);
      
      // Call progress callback
      onProgress(progressData);
      
      // If this is the completion event, call onComplete and close
      if (progressData.completed) {
        if (progressData.error) {
          onError(progressData.error);
        } else if (progressData.data) {
          onComplete(progressData.data);
        }
        eventSource.close();
      }
    } catch (error) {
      console.error('Error parsing SSE data:', error);
      onError('Error parsing server response');
      eventSource.close();
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('SSE Error:', error);
    onError('Connection error during streaming');
    eventSource.close();
  };
  
  // Handle abort signal
  if (signal) {
    signal.addEventListener('abort', () => {
      eventSource.close();
    });
  }
  
  return eventSource;
};

// Helper function for cleaning insider names (extracted for reuse)
const cleanInsiderName = (rawName: string): string => {
  if (!rawName) return 'Unknown';
  
  // If it contains "Insider (Name Not Available)", return a better placeholder
  if (rawName.includes('Insider (Name Not Available)')) {
    return 'Insider';
  }

  // Remove any HTML tags
  let clean = rawName.replace(/<[^>]*>/g, '');
  
  // Remove CIK numbers and other metadata
  clean = clean.replace(/\(\d{10}\)/g, '');
  clean = clean.replace(/\(\d+\)/g, '');
  clean = clean.replace(/\(Reporting\)/g, '');
  clean = clean.replace(/\(Issuer\)/g, '');
  clean = clean.replace(/\(Filer\)/g, '');
  
  // If string contains AccNo metadata, chop off at AccNo:
  if (clean.includes('AccNo:')) {
    clean = clean.split('AccNo:')[0].trim();
  }
  
  // Extract the actual name from the filing data if possible
  const reportingPersonMatch = clean.match(/Reporting Person:\s*([^\n(]+)/i);
  if (reportingPersonMatch && reportingPersonMatch[1]) {
    clean = reportingPersonMatch[1].trim();
  }
  
  // Check if this is likely a company name rather than a person
  const companyIndicators = ['Inc', 'Corp', 'LLC', 'Ltd', 'LP', 'REIT', 'Group', 'Fund', 'Trust', 'Solutions', 'Investment', 'Financial'];
  const isLikelyCompany = companyIndicators.some(indicator => 
    clean.includes(indicator) || 
    clean.includes(indicator.toUpperCase()) || 
    clean.includes(indicator.toLowerCase())
  );
  
  // If it's a company, just ensure proper capitalization but don't format as a person name
  if (!isLikelyCompany) {
    // Ensure proper capitalization for person names
    if (clean.toUpperCase() === clean || clean.toLowerCase() === clean) {
      clean = clean.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }
  
  return clean;
};