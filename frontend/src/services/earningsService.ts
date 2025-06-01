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
  surprisePercentage: number | null;
  magnitude: number | null;
  direction: 'positive' | 'negative';
  
  // Company information
  companyName?: string;
  sector?: string;
  industry?: string;
  
  // Current financial metrics
  currentPrice: number | null;
  marketCap: number | null;
  eps: number | null;
  pe: number | null;
  
  // Price movement data
  priceChange: number | null;
  priceChangePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  
  // Analysis indicators
  analysisScore?: number;
  riskLevel?: string;
  earningsDate: string | null;
  
  // Historical patterns (may be null if no data available)
  historicalPattern: {
    averageSurprise: number | null;
    consistency: number | null;
    postEarningsDrift: number | null;
    beatFrequency: number | null;
  };
  
  // Market reaction data
  marketReaction: {
    immediateReaction: number | null;
    weekAfterReaction: number | null;
  };
  
  // Data metadata
  dataSources?: string[];
  dataLimitations?: string[];
  historicalEarningsCount?: number;
}

export interface BackendEarningsAnalysis {
  ticker: string;
  analysis: {
    // Historical earnings metrics (scraped data)
    beatFrequency: number | null;
    averageSurprise: number | null;
    consistency: number | null;
    postEarningsDrift: number | null;
    
    // Real company and financial data (from FMP APIs)
    companyName: string;
    sector: string;
    industry: string;
    currentPrice: number | null;
    marketCap: number | null;
    eps: number | null;
    pe: number | null;
    
    // Price data
    priceChange: number | null;
    priceChangePercent: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    yearHigh: number | null;
    yearLow: number | null;
    
    // Analysis indicators
    analysisScore: number;
    riskLevel: string;
    earningsDate: string | null;
    
    // Latest earnings
    latestEarnings: {
      surprise: number | null;
      magnitude: number | null;
      marketReaction: number | null;
    };
    
    // Data metadata
    dataSources: string[];
    dataLimitations: string[];
    historicalEarningsCount: number;
  };
  timestamp: string;
  isPlaceholder: boolean;
}

export interface ProgressUpdate {
  percent: number;
  message: string;
  currentDate?: string;
  results?: EarningsEvent[];
  timestamp: string;
}

/**
 * Fetch upcoming earnings events from Yahoo Finance via our backend
 */
export async function fetchUpcomingEarnings(timeRange: TimeRange = '1m'): Promise<EarningsEvent[]> {
  try {
    console.log(`📊 Fetching upcoming earnings for timeRange: ${timeRange}`);
    
    const proxyUrl = getProxyUrl();
    const response = await fetch(`${proxyUrl}/api/earnings/upcoming?timeRange=${timeRange}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Raw API response:', data);

    if (data.success && data.data && Array.isArray(data.data)) {
      console.log(`📊 Received ${data.data.length} earnings events from API`);
      
      // Pre-filter validation - remove any obviously invalid entries
      const preFilteredData = data.data.filter((item: any, index: number) => {
        const ticker = item.symbol || item.ticker;
        if (!ticker || typeof ticker !== 'string' || ticker.trim() === '') {
          console.warn(`🚨 FRONTEND PRE-FILTER: Removing invalid item at index ${index}:`, item);
          return false;
        }
        return true;
      });
      
      console.log(`🔍 Pre-filtered: ${data.data.length} -> ${preFilteredData.length} items`);
      
      const mappedData = preFilteredData.map((item: any, index: number) => {
        const mappedItem = {
          ticker: (item.symbol || item.ticker || '').toString().toUpperCase().trim(),
          companyName: item.companyName || item.company || item.symbol || 'Unknown',
          reportDate: item.date || item.reportDate,
          estimatedEPS: item.estimatedEPS || item.expectedEPS || 0,
          estEPS: item.estimatedEPS || item.expectedEPS || 0,
          actualEPS: item.actualEPS || item.reportedEPS || null,
          time: item.time || 'Unknown',
          source: item.source || 'Yahoo Finance'
        };
        
        // Debug log if ticker is still somehow undefined after mapping
        if (!mappedItem.ticker || mappedItem.ticker === '') {
          console.error('🚨 FRONTEND CRITICAL: Mapped item still has invalid ticker!', { 
            index,
            originalItem: item, 
            mappedItem: mappedItem 
          });
        }
        
        return mappedItem;
      });
      
      // Final validation pass - comprehensive frontend validation
      const finalValidatedData = validateFrontendEarningsData(mappedData);
      
      console.log(`🔍 Final frontend validation: ${mappedData.length} -> ${finalValidatedData.length} valid earnings`);
      console.log('📋 Sample of validated data:', finalValidatedData.slice(0, 3));
      
      return finalValidatedData;
    } else if (Array.isArray(data)) {
      // Fallback for direct array response
      console.log('📊 Processing direct array response');
      return validateFrontendEarningsData(data as EarningsEvent[]);
    } else {
      // Return empty array if no data
      console.log('⚠️ No earnings data found:', data);
      return [];
    }
  } catch (error) {
    console.error('❌ Earnings API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch earnings data');
  }
}

/**
 * Frontend validation function to ensure no invalid ticker data reaches the UI
 * @param {EarningsEvent[]} earningsData - Array of earnings events
 * @returns {EarningsEvent[]} Filtered array of valid earnings events
 */
function validateFrontendEarningsData(earningsData: EarningsEvent[]): EarningsEvent[] {
  if (!Array.isArray(earningsData)) {
    console.warn('🚨 FRONTEND VALIDATION: Expected array but received:', typeof earningsData);
    return [];
  }

  let invalidCount = 0;
  const validEarnings = earningsData.filter((earning: EarningsEvent, index: number) => {
    // Comprehensive ticker validation
    if (!earning.ticker || 
        typeof earning.ticker !== 'string' || 
        earning.ticker.trim() === '' ||
        earning.ticker === 'undefined' ||
        earning.ticker === 'null' ||
        earning.ticker === 'Symbol' ||
        earning.ticker === 'N/A' ||
        earning.ticker === '-' ||
        earning.ticker.toLowerCase() === 'company' ||
        earning.ticker.length > 10 ||
        earning.ticker.length < 1) {
      
      console.warn(`🚨 FRONTEND VALIDATION: Filtering out earnings at index ${index} with invalid ticker:`, {
        ticker: earning.ticker,
        type: typeof earning.ticker,
        companyName: earning.companyName,
        fullEarning: earning
      });
      invalidCount++;
      return false;
    }

    // Validate ticker pattern
    const tickerPattern = /^[A-Z]{1,10}(\.[A-Z]{1,3})?$/i;
    if (!tickerPattern.test(earning.ticker)) {
      console.warn(`🚨 FRONTEND VALIDATION: Filtering out earnings with invalid ticker pattern: "${earning.ticker}"`);
      invalidCount++;
      return false;
    }

    // Validate company name
    if (!earning.companyName || 
        typeof earning.companyName !== 'string' || 
        earning.companyName.trim() === '' ||
        earning.companyName === 'Company' ||
        earning.companyName === 'N/A') {
      console.warn(`🚨 FRONTEND VALIDATION: Filtering out earnings with invalid company name: "${earning.companyName}" for ticker: "${earning.ticker}"`);
      invalidCount++;
      return false;
    }

    return true;
  });

  if (invalidCount > 0) {
    console.log(`🔍 FRONTEND VALIDATION: Filtered out ${invalidCount} invalid earnings. ${validEarnings.length} valid earnings remaining.`);
  }

  return validEarnings;
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
      
      // No fallback - throw error if real data unavailable
      throw new Error(`Real earnings data not available for ${ticker}`);
    }
    
    const data: BackendEarningsAnalysis = await response.json();
    console.log(`Earnings analysis data received:`, data);
    
    if (!data.analysis) {
      console.error('Unexpected response format:', data);
      throw new Error('Invalid response format from server');
    }
    
    // Handle real scraped data - use actual values instead of 0.0 fallbacks
    const analysis = data.analysis;
    
    return {
      ticker,
      surprisePercentage: analysis.latestEarnings?.surprise ?? null,
      magnitude: analysis.latestEarnings?.magnitude ?? null,
      direction: (analysis.latestEarnings?.surprise ?? 0) >= 0 ? 'positive' : 'negative',
      historicalPattern: {
        averageSurprise: analysis.averageSurprise ?? null,
        consistency: analysis.consistency ?? null,
        postEarningsDrift: analysis.postEarningsDrift ?? null,
        beatFrequency: analysis.beatFrequency ?? null
      },
      marketReaction: {
        immediateReaction: analysis.latestEarnings?.marketReaction ?? null,
        weekAfterReaction: analysis.postEarningsDrift ?? null
      },
      companyName: analysis.companyName,
      sector: analysis.sector,
      industry: analysis.industry,
      currentPrice: analysis.currentPrice,
      marketCap: analysis.marketCap,
      eps: analysis.eps,
      pe: analysis.pe,
      priceChange: analysis.priceChange,
      priceChangePercent: analysis.priceChangePercent,
      dayHigh: analysis.dayHigh,
      dayLow: analysis.dayLow,
      yearHigh: analysis.yearHigh,
      yearLow: analysis.yearLow,
      analysisScore: analysis.analysisScore,
      riskLevel: analysis.riskLevel,
      earningsDate: analysis.earningsDate,
      dataSources: analysis.dataSources,
      dataLimitations: analysis.dataLimitations,
      historicalEarningsCount: analysis.historicalEarningsCount
    };
  } catch (error) {
    console.error('Earnings analysis error:', error);
    // No local fallback - real data only
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch real earnings analysis');
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
      },
      companyName: ticker, // Use ticker as fallback
      sector: 'Unknown',
      industry: 'Unknown',
      currentPrice: null,
      marketCap: null,
      eps: null,
      pe: null,
      priceChange: null,
      priceChangePercent: null,
      dayHigh: null,
      dayLow: null,
      yearHigh: null,
      yearLow: null,
      analysisScore: 0,
      riskLevel: 'Unknown',
      earningsDate: latestEarnings.reportDate || null,
      dataSources: ['Local Calculation'],
      dataLimitations: ['Limited to historical EPS data only'],
      historicalEarningsCount: historicalEarnings.length
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

/**
 * Start earnings scraping with progress tracking
 */
export async function startEarningsScrapingWithProgress(timeRange: TimeRange = '1m'): Promise<string> {
  try {
    const proxyUrl = getProxyUrl();
    const response = await fetch(`${proxyUrl}/api/earnings/upcoming?timeRange=${timeRange}&withProgress=true`);
    
    if (!response.ok) {
      throw new Error(`Failed to start scraping: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.sessionId) {
      throw new Error('Failed to get session ID for progress tracking');
    }
    
    return data.sessionId;
  } catch (error) {
    console.error('Error starting earnings scraping:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to start earnings scraping');
  }
}

/**
 * Get progress for a scraping operation
 */
export async function getScrapingProgress(sessionId: string): Promise<ProgressUpdate> {
  try {
    const proxyUrl = getProxyUrl();
    const response = await fetch(`${proxyUrl}/api/earnings/progress/${sessionId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Progress session not found or expired');
      }
      throw new Error(`Failed to get progress: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.progress) {
      throw new Error('Invalid progress response');
    }
    
    return data.progress;
  } catch (error) {
    console.error('Error getting scraping progress:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to get scraping progress');
  }
}

/**
 * Poll for progress updates until completion
 */
export async function pollForProgress(
  sessionId: string, 
  onProgress: (progress: ProgressUpdate) => void,
  interval: number = 2000
): Promise<EarningsEvent[]> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 150; // 5 minutes max (150 * 2 seconds)
    
    const poll = async () => {
      try {
        attempts++;
        const progress = await getScrapingProgress(sessionId);
        onProgress(progress);
        
        // If completed and has results, return them
        if (progress.percent >= 100) {
          if (progress.results && Array.isArray(progress.results)) {
            resolve(progress.results);
          } else if (progress.message.includes('Error:')) {
            reject(new Error(progress.message));
          } else {
            // Completed but no results yet, try once more
            setTimeout(poll, 1000);
          }
          return;
        }
        
        // Continue polling
        setTimeout(poll, interval);
      } catch (error) {
        // Handle 404 errors gracefully for the first few attempts
        if (error instanceof Error && error.message.includes('Progress session not found') && attempts <= 3) {
          console.log(`⏳ Session not ready yet, retrying... (attempt ${attempts}/3)`);
          setTimeout(poll, 1000); // Retry faster initially
          return;
        }
        
        // After max attempts or other errors, give up
        if (attempts >= maxAttempts) {
          reject(new Error('Progress tracking timed out after 5 minutes'));
        } else {
          reject(error);
        }
      }
    };
    
    // Add small delay before first poll to let backend set initial progress
    setTimeout(poll, 500);
  });
}

/**
 * Fetch upcoming earnings with enhanced progress tracking
 */
export async function fetchUpcomingEarningsWithProgress(
  timeRange: TimeRange = '1m',
  onProgress?: (progress: ProgressUpdate) => void
): Promise<EarningsEvent[]> {
  try {
    // Start scraping with progress tracking
    const sessionId = await startEarningsScrapingWithProgress(timeRange);
    
    if (!onProgress) {
      // If no progress callback, fall back to regular polling
      return await pollForProgress(sessionId, () => {});
    }
    
    // Poll for progress with callback
    return await pollForProgress(sessionId, onProgress);
    
  } catch (error) {
    console.error('Error fetching earnings with progress:', error);
    
    // Fallback to regular fetch if progress tracking fails
    console.log('Falling back to regular earnings fetch...');
    return await fetchUpcomingEarnings(timeRange);
  }
} 