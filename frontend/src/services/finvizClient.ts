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
const RETRY_DELAY = 1000;

/**
 * Validates and normalizes FinViz sentiment data
 */
function validateFinvizData(data: any): SentimentData[] {
  if (!Array.isArray(data)) {
    throw new Error('Invalid FinViz data: expected an array');
  }

  return data.map(item => {
    // Ensure required fields exist
    if (!item.ticker) {
      throw new Error('Missing required field: ticker');
    }

    // Normalize and validate data
    return {
      ticker: String(item.ticker).toUpperCase().trim(),
      score: Math.min(1, Math.max(0, Number(item.score) || 0.5)), // Clamp between 0-1
      sentiment: item.sentiment || 'neutral',
      source: 'finviz',
      timestamp: item.timestamp || new Date().toISOString(),
      confidence: Math.min(100, Math.max(0, Number(item.confidence) || 50)), // Clamp between 0-100
      postCount: Math.max(0, Number(item.postCount) || 0),
      commentCount: Math.max(0, Number(item.commentCount) || 0),
      newsCount: Math.max(0, Number(item.newsCount) || 0),
      price: item.price ? Number(item.price) : undefined,
      changePercent: item.changePercent ? Number(item.changePercent) : undefined,
      analystRating: item.analystRating,
      // Add any additional FinViz specific fields here
      ...(item.volume && { volume: Number(item.volume) }),
      ...(item.marketCap && { marketCap: String(item.marketCap) })
    };
  });
}

/**
 * Fetch sentiment data from FinViz with retry logic and error handling
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
        throw new Error(`FinViz API error: ${response.status} ${response.statusText}`);
      }
      
      // If we have retries left, wait and try again
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return fetchWithRetry(url, signal, retryCount + 1);
      }
      
      throw new Error(`FinViz API error after ${MAX_RETRIES} retries: ${response.status} ${response.statusText}`);
    }
    
    return response;
  } catch (error: unknown) {
    if (retryCount < MAX_RETRIES) {
      console.warn(`[FinViz] Attempt ${retryCount + 1} failed, retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, signal, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Fetch sentiment data scraped from FinViz headlines for the given tickers.
 * The backend proxy scrapes headlines and returns SentimentData[] with source = 'finviz'.
 * Includes retry logic, error handling, and data validation.
 */
export async function fetchFinvizSentiment(tickers: string[], signal?: AbortSignal): Promise<SentimentData[]> {
  if (!Array.isArray(tickers) || tickers.length === 0) {
    console.warn('No tickers provided to fetchFinvizSentiment');
    return [];
  }

  // Clean and validate tickers
  const validTickers = tickers
    .filter(ticker => typeof ticker === 'string' && ticker.trim().length > 0)
    .map(ticker => ticker.trim().toUpperCase());

  if (validTickers.length === 0) {
    console.warn('No valid tickers provided to fetchFinvizSentiment');
    return [];
  }

  // Process in chunks to avoid URL length issues
  const CHUNK_SIZE = 10;
  const results: SentimentData[] = [];
  
  for (let i = 0; i < validTickers.length; i += CHUNK_SIZE) {
    const chunk = validTickers.slice(i, i + CHUNK_SIZE);
    const proxy = getProxyUrl();
    const url = `${proxy}/api/finviz/ticker-sentiment?tickers=${chunk.join(',')}`;
    
    try {
      const response = await fetchWithRetry(url, signal);
      const data = await response.json();
      
      if (!data || !Array.isArray(data.sentimentData)) {
        console.error('Invalid response format from FinViz API:', data);
        continue;
      }
      
      const validatedData = validateFinvizData(data.sentimentData);
      results.push(...validatedData);
    } catch (error) {
      console.error(`Error fetching FinViz data for chunk ${i / CHUNK_SIZE + 1}:`, error);
      // Continue with next chunk even if one fails
    }
  }
  
  console.log(`Fetched FinViz sentiment data for ${results.length} tickers`);
  return results;
}