import { TimeRange } from '../types';

// Get proxy URL for API calls - matches other services
const getProxyUrl = (): string => {
  return import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
};

// Response types for chart analysis
export interface ChartAnalysisResponse {
  success: boolean;
  data: {
    analysis: string;
    timeRange: string;
    dataPoints: number;
    model: string;
    timestamp: string;
    tickers?: string[];
  };
  creditInfo: {
    used: number;
    remaining: number;
  };
}

export interface ChartAnalysisError {
  success: false;
  error: string;
  message: string;
  userMessage?: string;
  creditInfo?: {
    required: number;
    available: number;
    action: string;
  };
  upgradeRequired?: boolean;
  feature?: string;
}

/**
 * Analyze market sentiment chart data with AI
 */
export async function analyzeMarketSentimentChart(
  chartData: any[],
  timeRange: TimeRange,
  sentimentContext?: any
): Promise<ChartAnalysisResponse> {
  try {
    console.log(`🤖 Analyzing market sentiment chart for ${timeRange} with ${chartData.length} data points`);
    
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${getProxyUrl()}/api/sentiment-unified/chart/market/analyze`, {
      method: 'POST',
      headers,
            body: JSON.stringify({
        chartData,
        timeRange,
        sentimentContext: sentimentContext || {
          source: 'market_overview',
          analysisType: 'trend_analysis'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    if (responseData.success) {
      console.log(`✅ Market chart analysis completed for ${timeRange}`);
      return responseData;
    } else {
      throw new Error(responseData.message || 'Market analysis failed');
    }
  } catch (error: any) {
    console.error('❌ Market chart analysis error:', error);
    
    // Handle specific error types
    if (error.response?.status === 402) {
      throw {
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        message: 'Insufficient credits for market analysis',
        creditInfo: error.response.data.creditInfo,
        userMessage: 'You need more credits to analyze this market chart.'
      } as ChartAnalysisError;
    }
    
    if (error.response?.status === 403) {
      throw {
        success: false,
        error: 'FEATURE_NOT_AVAILABLE',
        message: 'Market chart analysis not available in your tier',
        upgradeRequired: true,
        feature: 'ai_market_analysis',
        userMessage: 'Upgrade to access AI market analysis.'
      } as ChartAnalysisError;
    }
    
    throw {
      success: false,
      error: 'ANALYSIS_ERROR',
      message: error.response?.data?.message || error.message || 'Analysis failed',
      userMessage: 'Unable to analyze the market chart. Please try again.'
    } as ChartAnalysisError;
  }
}

/**
 * Analyze ticker sentiment chart data with AI
 */
export async function analyzeTickerSentimentChart(
  chartData: any[],
  selectedTickers: string[],
  timeRange: TimeRange,
  sentimentContext?: any
): Promise<ChartAnalysisResponse> {
  try {
    console.log(`🤖 Analyzing ticker sentiment chart for ${selectedTickers.join(', ')} over ${timeRange} with ${chartData.length} data points`);
    
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${getProxyUrl()}/api/sentiment-unified/chart/ticker/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        chartData,
        selectedTickers,
        timeRange,
        sentimentContext: sentimentContext || {
          source: 'ticker_overview',
          analysisType: 'comparative_analysis'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    
    if (responseData.success) {
      console.log(`✅ Ticker chart analysis completed for ${selectedTickers.join(', ')}`);
      return responseData;
    } else {
      throw new Error(responseData.message || 'Ticker analysis failed');
    }
  } catch (error: any) {
    console.error('❌ Ticker chart analysis error:', error);
    
    // Handle specific error types
    if (error.response?.status === 402) {
      throw {
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        message: 'Insufficient credits for ticker analysis',
        creditInfo: error.response.data.creditInfo,
        userMessage: `You need more credits to analyze ${selectedTickers.length} ticker${selectedTickers.length === 1 ? '' : 's'}.`
      } as ChartAnalysisError;
    }
    
    if (error.response?.status === 403) {
      throw {
        success: false,
        error: 'FEATURE_NOT_AVAILABLE',
        message: 'Ticker chart analysis not available in your tier',
        upgradeRequired: true,
        feature: 'ai_ticker_chart_analysis',
        userMessage: 'Upgrade to access AI ticker analysis.'
      } as ChartAnalysisError;
    }
    
    throw {
      success: false,
      error: 'ANALYSIS_ERROR',
      message: error.response?.data?.message || error.message || 'Analysis failed',
      userMessage: 'Unable to analyze the ticker chart. Please try again.'
    } as ChartAnalysisError;
  }
}

/**
 * Get formatted time range description for user display
 */
export function getTimeRangeDescription(timeRange: TimeRange): string {
  const descriptions = {
    '1d': 'past day',
    '3d': 'past 3 days', 
    '1w': 'past week',
    '1m': 'past month',
    '3m': 'past 3 months',
    '6m': 'past 6 months'
  };
  
  return descriptions[timeRange] || timeRange;
}

/**
 * Calculate estimated credit cost for chart analysis
 */
export function getEstimatedCreditCost(analysisType: 'market' | 'ticker', tickerCount: number = 1): number {
  if (analysisType === 'market') {
    return 1; // Base cost for market analysis
  } else {
    // Ticker analysis: 1 credit per ticker (capped at 5 tickers)
    return Math.min(tickerCount, 5);
  }
}

export default {
  analyzeMarketSentimentChart,
  analyzeTickerSentimentChart,
  getTimeRangeDescription,
  getEstimatedCreditCost
}; 