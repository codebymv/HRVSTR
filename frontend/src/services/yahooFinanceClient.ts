import { SentimentData } from '../types';

/**
 * Get the proxy URL for API requests
 * Uses Vite's import.meta.env for environment variables in development
 */
function getProxyUrl(): string {
  // For Vite/React apps, use import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
  }
  
  // Fallback for other environments
  return 'http://localhost:3001';
}

// Maximum number of retry attempts for failed requests
const MAX_RETRIES = 2;
// Delay between retries in milliseconds
const RETRY_DELAY = 1500; // Slightly longer delay for Yahoo Finance
// Maximum number of tickers to process in a single request
const MAX_TICKERS_PER_REQUEST = 5;

/**
 * Validates and normalizes Yahoo Finance sentiment data
 */
function validateYahooData(data: any): SentimentData[] {
  if (!Array.isArray(data)) {
    throw new Error('Invalid Yahoo Finance data: expected an array');
  }

  return data.map(item => {
    // Ensure required fields exist
    if (!item.ticker) {
      throw new Error('Missing required field: ticker');
    }

    // Default to neutral if no score is provided
    const rawScore = item.score !== undefined ? Number(item.score) : 0.5;
    const normalizedScore = Math.min(1, Math.max(0, isNaN(rawScore) ? 0.5 : rawScore));
    
    // Determine sentiment based on score if not provided
    let sentiment = item.sentiment;
    if (!sentiment) {
      if (normalizedScore >= 0.6) sentiment = 'bullish';
      else if (normalizedScore <= 0.4) sentiment = 'bearish';
      else sentiment = 'neutral';
    }

    // Normalize and validate data
    return {
      ticker: String(item.ticker).toUpperCase().trim(),
      score: normalizedScore,
      sentiment,
      source: 'yahoo',
      timestamp: item.timestamp || new Date().toISOString(),
      confidence: Math.min(100, Math.max(0, Number(item.confidence) || 40)), // Slightly lower default confidence than FinViz
      postCount: Math.max(0, Number(item.postCount) || 0),
      commentCount: Math.max(0, Number(item.commentCount) || 0),
      newsCount: Math.max(0, Number(item.newsCount) || 0),
      price: item.price ? Number(item.price) : undefined,
      changePercent: item.changePercent ? Number(item.changePercent) : undefined,
      analystRating: item.analystRating,
      // Add any additional Yahoo Finance specific fields here
      ...(item.volume && { volume: Number(item.volume) }),
      ...(item.marketCap && { marketCap: String(item.marketCap) })
    };
  });
}

/**
 * Fetch data from Yahoo Finance with retry logic and error handling
 */
async function fetchWithRetry(url: string, signal?: AbortSignal, retryCount = 0): Promise<Response> {
  try {
    const response = await fetch(url, { 
      signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    if (!response.ok) {
      // Don't retry on 4xx errors (except 429 - Too Many Requests)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`);
      }
      
      // If we have retries left, wait and try again
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return fetchWithRetry(url, signal, retryCount + 1);
      }
      
      throw new Error(`Yahoo Finance API error after ${MAX_RETRIES} retries: ${response.status} ${response.statusText}`);
    }
    
    return response;
  } catch (error: unknown) {
    if (retryCount < MAX_RETRIES) {
      console.warn(`[Yahoo] Attempt ${retryCount + 1} failed, retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return fetchWithRetry(url, signal, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Fetch sentiment data from Yahoo Finance
 * @param tickers List of tickers to fetch sentiment for
 * @param signal AbortSignal for request cancellation
 * @param retryCount Internal counter for retry attempts
 * @returns Promise with array of sentiment data
 */
export const fetchYahooSentiment = async (
  tickers: string[] = [],
  signal?: AbortSignal,
  retryCount = 0
): Promise<SentimentData[]> => {
  // Input validation
  if (!Array.isArray(tickers)) {
    console.warn('Invalid tickers parameter: expected array, got', typeof tickers);
    return [];
  }

  // Clean and validate tickers
  const validTickers = Array.from(new Set(tickers
    .filter(ticker => typeof ticker === 'string' && ticker.trim().length > 0)
    .map(ticker => ticker.trim().toUpperCase())
  ));

  if (validTickers.length === 0) {
    console.warn('No valid tickers provided to fetchYahooSentiment');
    return [];
  }

  // Process in chunks to avoid URL length issues and rate limiting
  const results: SentimentData[] = [];
  
  try {
    for (let i = 0; i < validTickers.length; i += MAX_TICKERS_PER_REQUEST) {
      const chunk = validTickers.slice(i, i + MAX_TICKERS_PER_REQUEST);
      const proxyUrl = getProxyUrl();
      const url = `${proxyUrl}/api/yahoo/ticker-sentiment?tickers=${chunk.join(',')}`;
      
      try {
        const response = await fetchWithRetry(url, signal);
        const data = await response.json();
        
        if (!data || !Array.isArray(data.sentimentData)) {
          console.error('Invalid response format from Yahoo Finance API:', data);
          continue;
        }
        
        const validatedData = validateYahooData(data.sentimentData);
        results.push(...validatedData);
      } catch (error) {
        console.error(`Error fetching Yahoo Finance data for chunk ${i / MAX_TICKERS_PER_REQUEST + 1}:`, error);
        // Continue with next chunk even if one fails
      }
    }
    
    console.log(`Fetched Yahoo Finance sentiment data for ${results.length} tickers`);
    return results;
  } catch (error: unknown) {
    console.error('Error in fetchYahooSentiment:', error);
    
    // If we have retries left and this isn't an abort error, retry
    if (retryCount < MAX_RETRIES && (!error || (error as Error)?.name !== 'AbortError')) {
      console.log(`Retrying Yahoo Finance API call (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return fetchYahooSentiment(tickers, signal, retryCount + 1);
    }
    
    // If we've exhausted retries or this is an abort error, return empty array
    return [];
  }
};