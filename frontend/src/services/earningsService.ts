import { TimeRange } from '../types';
import { getProxyUrl } from './redditClient';

export interface EarningsEvent {
  ticker: string;
  companyName: string;
  reportDate: string;
  estimatedEPS: number;
  estEPS?: number; // Adding this property as an alias for estimatedEPS
  actualEPS?: number;
  surprisePercentage?: number;
  consensusEstimate?: number;
  previousEPS?: number;
  yearAgoEPS?: number;
  revenueEstimate?: number;
  actualRevenue?: number;
  revenueSurprise?: number;
}

export interface EarningsAnalysis {
  ticker: string;
  surprisePercentage: number;
  magnitude: number;
  direction: 'positive' | 'negative';
  historicalPattern: {
    averageSurprise: number;
    consistency: number;
    postEarningsDrift: number;
    beatFrequency: number;
  };
  marketReaction: {
    immediateReaction: number;
    weekAfterReaction: number;
  };
}

export interface BackendEarningsAnalysis {
  ticker: string;
  analysis: {
    beatFrequency: number;
    averageSurprise: number;
    consistency: number;
    postEarningsDrift: number;
    latestEarnings: {
      surprise: number;
      magnitude: number;
      marketReaction: number;
    }
  };
  timestamp: string;
  isPlaceholder: boolean;
}

/**
 * Fetch upcoming earnings events from Alpha Vantage
 */
export async function fetchUpcomingEarnings(timeRange: TimeRange = '1m'): Promise<EarningsEvent[]> {
  try {
    const proxyUrl = getProxyUrl();
    const response = await fetch(`${proxyUrl}/api/earnings/upcoming?timeRange=${timeRange}`);
    
    if (!response.ok) {
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.earningsEvents as EarningsEvent[];
  } catch (error) {
    console.error('Earnings API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch earnings data');
  }
}

/**
 * Fetch historical earnings data for a specific ticker
 */
export async function fetchHistoricalEarnings(ticker: string): Promise<EarningsEvent[]> {
  try {
    console.log(`Fetching historical earnings for ticker: ${ticker}`);
    const proxyUrl = getProxyUrl();
    const url = `${proxyUrl}/api/earnings/historical/${ticker}`;
    console.log(`Request URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`HTTP error ${response.status}: ${response.statusText}`);
      const errorText = await response.text().catch(() => 'No error text available');
      console.error(`Error response: ${errorText}`);
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Historical earnings data received:`, data);
    
    if (!data.historicalEarnings || !Array.isArray(data.historicalEarnings)) {
      console.error('Unexpected response format:', data);
      throw new Error('Invalid response format from server');
    }
    
    return data.historicalEarnings as EarningsEvent[];
  } catch (error) {
    console.error('Historical earnings API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch historical earnings data');
  }
}

/**
 * Analyze earnings surprise patterns and predict post-earnings drift
 */
export async function analyzeEarningsSurprise(ticker: string): Promise<EarningsAnalysis> {
  try {
    console.log(`Fetching earnings analysis for ticker: ${ticker}`);
    const proxyUrl = getProxyUrl();
    const url = `${proxyUrl}/api/earnings/analysis/${ticker}`;
    console.log(`Request URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`HTTP error ${response.status}: ${response.statusText}`);
      const errorText = await response.text().catch(() => 'No error text available');
      console.error(`Error response: ${errorText}`);
      
      // Fall back to local calculation if the API fails
      console.log('Falling back to local earnings analysis calculation');
      return calculateLocalEarningsAnalysis(ticker);
    }
    
    const data: BackendEarningsAnalysis = await response.json();
    console.log(`Earnings analysis data received:`, data);
    
    if (!data.analysis) {
      console.error('Unexpected response format:', data);
      throw new Error('Invalid response format from server');
    }
    
    // Convert backend analysis format to frontend format
    return {
      ticker,
      surprisePercentage: data.analysis.latestEarnings.surprise,
      magnitude: data.analysis.latestEarnings.magnitude,
      direction: data.analysis.latestEarnings.surprise >= 0 ? 'positive' : 'negative',
      historicalPattern: {
        averageSurprise: data.analysis.averageSurprise,
        consistency: data.analysis.consistency,
        postEarningsDrift: data.analysis.postEarningsDrift,
        beatFrequency: data.analysis.beatFrequency
      },
      marketReaction: {
        immediateReaction: data.analysis.latestEarnings.marketReaction,
        weekAfterReaction: data.analysis.postEarningsDrift
      }
    };
  } catch (error) {
    console.error('Earnings analysis error:', error);
    // Fall back to local calculation if the API fails
    console.log('Falling back to local earnings analysis calculation due to error');
    return calculateLocalEarningsAnalysis(ticker);
  }
}

/**
 * Calculate earnings analysis locally as a fallback
 */
async function calculateLocalEarningsAnalysis(ticker: string): Promise<EarningsAnalysis> {
  try {
    const historicalEarnings = await fetchHistoricalEarnings(ticker);
    
    if (historicalEarnings.length === 0) {
      throw new Error('No historical earnings data available');
    }
    
    // Calculate average surprise
    const surprises = historicalEarnings
      .filter(e => e.surprisePercentage !== undefined)
      .map(e => e.surprisePercentage!);
    
    const averageSurprise = surprises.reduce((a, b) => a + b, 0) / surprises.length;
    
    // Calculate consistency (percentage of beats)
    const beats = surprises.filter(s => s > 0).length;
    const consistency = (beats / surprises.length) * 100;
    
    // Calculate historical post-earnings drift
    const postEarningsDrift = calculatePostEarningsDrift(historicalEarnings);
    
    // Get latest earnings event
    const latestEarnings = historicalEarnings[0];
    
    return {
      ticker,
      surprisePercentage: latestEarnings.surprisePercentage || 0,
      magnitude: Math.abs(latestEarnings.surprisePercentage || 0),
      direction: (latestEarnings.surprisePercentage || 0) > 0 ? 'positive' : 'negative',
      historicalPattern: {
        averageSurprise,
        consistency,
        postEarningsDrift,
        beatFrequency: consistency // Adding beatFrequency, using the same value as consistency
      },
      marketReaction: {
        immediateReaction: 0, // This would be calculated from price data
        weekAfterReaction: 0 // This would be calculated from price data
      }
    };
  } catch (error) {
    console.error('Local earnings analysis error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to analyze earnings data locally');
  }
}

/**
 * Calculate historical post-earnings drift
 * This is a simplified version - in production, you'd want to use actual price data
 */
function calculatePostEarningsDrift(earnings: EarningsEvent[]): number {
  // This is a placeholder - in reality, you'd need to:
  // 1. Get historical price data for each earnings date
  // 2. Calculate price changes from day before to day after
  // 3. Calculate price changes from day after to 5 days after
  // 4. Average these changes based on surprise magnitude
  
  // For now, return a simple average of surprise percentages
  const surprises = earnings
    .filter(e => e.surprisePercentage !== undefined)
    .map(e => e.surprisePercentage!);
  
  return surprises.reduce((a, b) => a + b, 0) / surprises.length;
} 