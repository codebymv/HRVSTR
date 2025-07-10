import axios from 'axios';
import { SentimentData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Credit information interface
interface CreditInfo {
  used: number;
  remaining: number;
  operation: string;
  tier: string;
}

// Enhanced response interface
interface FinvizResponse {
  sentimentData: any[];
  credits?: CreditInfo;
}

// Credit error interface
interface CreditError {
  error: string;
  code: string;
  required?: number;
  remaining?: number;
  tier?: string;
  operation?: string;
}

/**
 * Custom error class for credit-related issues
 */
export class InsufficientCreditsError extends Error {
  public required: number;
  public remaining: number;
  public tier: string;
  public operation: string;

  constructor(creditError: CreditError) {
    super(creditError.error);
    this.name = 'InsufficientCreditsError';
    this.required = creditError.required || 0;
    this.remaining = creditError.remaining || 0;
    this.tier = creditError.tier || 'unknown';
    this.operation = creditError.operation || 'unknown';
  }
}

/**
 * Show credit usage notification to user
 */
const showCreditUsage = (creditInfo: CreditInfo) => {
  console.log(`💳 Credits Used: ${creditInfo.used} | Remaining: ${creditInfo.remaining} | Tier: ${creditInfo.tier}`);
  
  // You can enhance this with toast notifications later
  if (creditInfo.remaining <= 5) {
    console.warn(`⚠️ Low credits warning: Only ${creditInfo.remaining} credits remaining!`);
  }
};

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

    // Parse and validate score - should be in -1 to 1 range (not 0 to 1)
    const rawScore = Number(item.score);
    const normalizedScore = isNaN(rawScore) ? 0 : Math.min(1, Math.max(-1, rawScore));

    // Normalize and validate data
    return {
      ticker: String(item.ticker).toUpperCase().trim(),
      score: normalizedScore, // Correct range: -1 to 1
      sentiment: item.sentiment || getSentimentFromScore(normalizedScore),
      source: 'finviz' as const,
      timestamp: item.timestamp || new Date().toISOString(),
      confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0)),
      postCount: Math.max(0, Number(item.postCount) || 0),
      commentCount: Math.max(0, Number(item.commentCount) || 0),
      upvotes: Math.max(0, Number(item.upvotes) || 0)
    };
  });
}

/**
 * Determine sentiment from numerical score
 */
function getSentimentFromScore(score: number): 'bullish' | 'bearish' | 'neutral' {
  if (score > 0.15) return 'bullish';
  if (score < -0.15) return 'bearish';
  return 'neutral';
}

/**
 * Fetch sentiment data from FinViz API with credit handling
 * @param tickers Array of ticker symbols
 * @param signal AbortSignal for request cancellation
 * @returns Promise<SentimentData[]>
 */
export async function fetchFinvizSentiment(
  tickers: string[], 
  signal?: AbortSignal
): Promise<SentimentData[]> {
  // Return early if no tickers provided
  if (!tickers || tickers.length === 0) {
    console.log('No tickers provided to FinViz API, returning empty array');
    return [];
  }

  try {
    console.log('FinViz API call starting for tickers:', tickers);
    
    // Get auth token from localStorage
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication required. Please log in to access sentiment data.');
    }

    const response = await axios.get<FinvizResponse>(`${API_BASE_URL}/api/finviz/ticker-sentiment`, {
      params: { 
        tickers: tickers.join(',')
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal,
      timeout: 30000,
    });

    console.log('FinViz API Response:', response.data);

    // Handle credit information
    if (response.data.credits) {
      showCreditUsage(response.data.credits);
    }

    // Extract sentiment data
    const sentimentData = response.data.sentimentData || [];
    
    if (sentimentData.length === 0) {
      console.warn('FinViz API returned no sentiment data');
      return [];
    }

    const validatedData = validateFinvizData(sentimentData);
    console.log('FinViz validated data:', validatedData.length, 'items');
    
    return validatedData;

  } catch (error: any) {
    // Handle different types of errors
    if (error.name === 'AbortError' || signal?.aborted) {
      console.log('FinViz request was aborted');
      throw error;
    }
    
    // Handle credit-related errors
    if (error.response?.status === 402) {
      const creditError = error.response.data as CreditError;
      throw new InsufficientCreditsError(creditError);
    }
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please log in again.');
    }
    
    // Handle tier limit errors
    if (error.response?.status === 400 && error.response.data?.code === 'TICKER_LIMIT_EXCEEDED') {
      const limitError = error.response.data;
      throw new Error(`Too many tickers requested. Your ${limitError.tier || 'current'} tier allows maximum ${limitError.limit} tickers per request. You requested ${limitError.requested}.`);
    }
    
    // Handle rate limiting
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again in a few minutes.');
    }

    console.error('FinViz API Error:', error);
    
    // Check for network/timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('FinViz service is currently slow to respond. Please try again.');
    }
    
    if (error.code === 'ERR_NETWORK' || !error.response) {
      throw new Error('Unable to connect to FinViz service. Please check your connection.');
    }

    // Fallback error message
    const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch FinViz sentiment data';
    throw new Error(`FinViz Error: ${errorMessage}`);
  }
}