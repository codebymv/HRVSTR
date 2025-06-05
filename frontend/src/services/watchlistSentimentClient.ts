import axios from 'axios';
import { SentimentData, TimeRange } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Credit information interface
interface CreditInfo {
  used: number;
  remaining: number;
  operation: string;
  tier: string;
}

interface WatchlistSentimentResponse {
  success: boolean;
  data?: {
    sentimentData: SentimentData[];
    meta?: any;
  };
  sentimentData?: SentimentData[]; // For backward compatibility
  creditsUsed?: number;
  fromCache?: boolean;
  freshlyFetched?: boolean;
  credits?: CreditInfo;
  tier?: string;
  message?: string;
}

/**
 * Show credit usage notification
 */
function showCreditUsage(credits: CreditInfo) {
  console.log(`💳 Credit Usage: Used ${credits.used}, Remaining: ${credits.remaining} (Operation: ${credits.operation}, Tier: ${credits.tier})`);
}

/**
 * Fetch Reddit sentiment data from user's watchlist
 * @param timeRange Time range for sentiment analysis
 * @param signal AbortSignal for request cancellation
 * @returns Promise<SentimentData[]>
 */
export async function fetchWatchlistRedditSentiment(
  timeRange: TimeRange = '1w',
  signal?: AbortSignal
): Promise<SentimentData[]> {
  try {
    console.log('Watchlist Reddit sentiment API call starting for timeRange:', timeRange);
    
    // Get auth token from localStorage
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication required. Please log in to access sentiment data.');
    }

    const response = await axios.get<WatchlistSentimentResponse>(`${API_BASE_URL}/api/sentiment-unified/reddit/tickers`, {
      params: { 
        timeRange,
        // Add cache busting to avoid 304 responses that don't include data
        _t: Date.now(),
        _r: Math.random()
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Disable caching to ensure we get fresh data
        'Cache-Control': 'no-cache'
      },
      signal,
      timeout: 30000,
    });

    console.log('Watchlist Reddit sentiment API Response:', response.data);

    // Handle credit information
    if (response.data.creditsUsed) {
      showCreditUsage({
        used: response.data.creditsUsed,
        remaining: 0, // Will be updated from tier info
        operation: 'reddit_sentiment',
        tier: 'pro'
      });
    }
      
    // Extract sentiment data from unified response format
    const actualData = response.data.data || response.data;
    const sentimentData = actualData.sentimentData || [];
    
    if (sentimentData.length === 0) {
      console.warn('Watchlist Reddit sentiment API returned no sentiment data');
      return [];
    }

    console.log('Watchlist Reddit sentiment validated data:', sentimentData.length, 'items');
    
    return sentimentData;

  } catch (error) {
    console.error('Error fetching watchlist Reddit sentiment:', error);
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (status === 403) {
        throw new Error('Access denied. This feature requires a Pro subscription.');
      } else if (status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`Sentiment API error: ${message}`);
      }
    }
    throw error;
  }
}

/**
 * Fetch FinViz sentiment data from user's watchlist
 * @param timeRange Time range for sentiment analysis
 * @param signal AbortSignal for request cancellation
 * @returns Promise<SentimentData[]>
 */
export async function fetchWatchlistFinvizSentiment(
  timeRange: TimeRange = '1w',
  signal?: AbortSignal
): Promise<SentimentData[]> {
  try {
    console.log('Watchlist FinViz sentiment API call starting for timeRange:', timeRange);
    
    // Get auth token from localStorage
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication required. Please log in to access sentiment data.');
    }

    const response = await axios.get<WatchlistSentimentResponse>(`${API_BASE_URL}/api/sentiment-unified/finviz/tickers`, {
      params: {
        timeRange,
        // Add cache busting to avoid 304 responses that don't include data
        _t: Date.now(),
        _r: Math.random()
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Disable caching to ensure we get fresh data
        'Cache-Control': 'no-cache'
      },
      signal,
      timeout: 30000,
    });

    console.log('Watchlist FinViz sentiment API Response:', response.data);

    // Handle credit information
    if (response.data.creditsUsed) {
      showCreditUsage({
        used: response.data.creditsUsed,
        remaining: 0,
        operation: 'finviz_sentiment',
        tier: 'pro'
      });
    }

    // Extract sentiment data from unified response format
    const actualData = response.data.data || response.data;
    const sentimentData = actualData.sentimentData || [];
    
    if (sentimentData.length === 0) {
      console.warn('Watchlist FinViz sentiment API returned no sentiment data');
      return [];
    }

    console.log('Watchlist FinViz sentiment validated data:', sentimentData.length, 'items');
    
    return sentimentData;

  } catch (error) {
    console.error('Error fetching watchlist FinViz sentiment:', error);
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (status === 403) {
        throw new Error('Access denied. This feature requires a Pro subscription.');
      } else if (status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`FinViz API error: ${message}`);
      }
    }
    throw error;
  }
}

/**
 * Fetch Yahoo Finance sentiment data from user's watchlist
 * @param timeRange Time range for sentiment analysis
 * @param signal AbortSignal for request cancellation
 * @returns Promise<SentimentData[]>
 */
export async function fetchWatchlistYahooSentiment(
  timeRange: TimeRange = '1w',
  signal?: AbortSignal
): Promise<SentimentData[]> {
  try {
    console.log('Watchlist Yahoo sentiment API call starting for timeRange:', timeRange);
    
    // Get auth token from localStorage
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication required. Please log in to access sentiment data.');
    }

    const response = await axios.get<WatchlistSentimentResponse>(`${API_BASE_URL}/api/sentiment-unified/yahoo/tickers`, {
      params: {
        timeRange,
        // Add cache busting to avoid 304 responses that don't include data
        _t: Date.now(),
        _r: Math.random()
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Disable caching to ensure we get fresh data
        'Cache-Control': 'no-cache'
      },
      signal,
      timeout: 30000,
    });

    console.log('Watchlist Yahoo sentiment API Response:', response.data);

    // Handle credit information
    if (response.data.creditsUsed) {
      showCreditUsage({
        used: response.data.creditsUsed,
        remaining: 0,
        operation: 'yahoo_sentiment',
        tier: 'pro'
      });
    }

    // Extract sentiment data from unified response format
    const actualData = response.data.data || response.data;
    const sentimentData = actualData.sentimentData || [];
    
    if (sentimentData.length === 0) {
      console.warn('Watchlist Yahoo sentiment API returned no sentiment data');
      return [];
    }

    console.log('Watchlist Yahoo sentiment validated data:', sentimentData.length, 'items');
    
    return sentimentData;

  } catch (error) {
    console.error('Error fetching watchlist Yahoo sentiment:', error);
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (status === 403) {
        throw new Error('Access denied. This feature requires a Pro subscription.');
      } else if (status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`Yahoo Finance API error: ${message}`);
      }
    }
    throw error;
  }
}

/**
 * Fetch combined sentiment data from user's watchlist across all sources
 * @param timeRange Time range for sentiment analysis  
 * @param signal AbortSignal for request cancellation
 * @returns Promise<SentimentData[]>
 */
export async function fetchWatchlistCombinedSentiment(
  timeRange: TimeRange = '1w',
  signal?: AbortSignal
): Promise<SentimentData[]> {
  try {
    console.log('Watchlist combined sentiment API call starting for timeRange:', timeRange);
    
    // Get auth token from localStorage
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication required. Please log in to access sentiment data.');
    }

    const response = await axios.get<WatchlistSentimentResponse>(`${API_BASE_URL}/api/sentiment-unified/combined/tickers`, {
      params: { 
        timeRange,
        // Add cache busting to avoid 304 responses that don't include data
        _t: Date.now(),
        _r: Math.random()
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Disable caching to ensure we get fresh data
        'Cache-Control': 'no-cache'
      },
      signal,
      timeout: 30000,
    });

    console.log('Watchlist combined sentiment API Response:', response.data);

    // Handle credit information
    if (response.data.credits) {
      showCreditUsage(response.data.credits);
    }

    // Extract sentiment data
    const sentimentData = response.data.sentimentData || [];
    
    if (sentimentData.length === 0) {
      console.warn('Watchlist combined sentiment API returned no sentiment data');
      return [];
    }

    console.log('Watchlist combined sentiment validated data:', sentimentData.length, 'items');
    
    return sentimentData;

  } catch (error) {
    console.error('Error fetching watchlist combined sentiment:', error);
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (status === 403) {
        throw new Error('Access denied. This feature requires a Pro subscription.');
      } else if (status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`Combined sentiment API error: ${message}`);
      }
    }
    throw error;
  }
} 