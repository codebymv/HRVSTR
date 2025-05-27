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
    const proxyUrl = getProxyUrl();
    const response = await fetch(`${proxyUrl}/api/reddit/ticker-sentiment?timeRange=${timeRange}`, { signal });

    if (!response.ok) {
      throw new Error(`Proxy server returned error: ${response.status}`);
    }

    const data = await response.json();
    
    // Check if sentimentData exists and is an array
    if (!data || !data.sentimentData || !Array.isArray(data.sentimentData)) {
      console.warn('Unexpected response format from ticker sentiment API:', data);
      return []; // Return empty array instead of throwing
    }
    
    // Debug log to see what data is coming from the API
    console.log('DEBUG - API Response Data:', data.sentimentData);
    data.sentimentData.forEach((item: {ticker: string, confidence?: number}) => {
      console.log(`TICKER ${item.ticker} - confidence: ${item.confidence}, typeof: ${typeof item.confidence}`);
    });
    
    return data.sentimentData as SentimentData[];
  } catch (error) {
    console.error('Ticker sentiment API error:', error);
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
    
    const response = await fetch(`${proxyUrl}/api/sentiment/reddit/market?timeRange=${timeRange}`, { signal });
    
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
      
      const sentimentData: SentimentData[] = [];
      
      // Create a sentiment data point for each timestamp
      data.timestamps.forEach((timestamp: string, index: number) => {
        sentimentData.push({
          timestamp,
          bullish: data.bullish[index] || 0,
          bearish: data.bearish[index] || 0,
          neutral: data.neutral[index] || 0,
          // Add required fields with default values
          ticker: 'MARKET',
          source: 'reddit',
          score: 0, // Calculate an average score if needed
          sentiment: 'neutral',
          confidence: 0.5,
          postCount: 0,
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
      const response = await fetch(`${proxyUrl}/api/reddit/subreddit/wallstreetbets?limit=25`, { signal });
      
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
    const response = await fetch(`${proxyUrl}/api/sec/institutional-holdings?timeRange=${timeRange}${refreshParam}`, { signal });
    
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