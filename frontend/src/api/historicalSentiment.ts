import { HistoricalSentimentData, SentimentTrends, SentimentSummary, ComparativeSentiment, HistoricalTimeRange } from '../types';

const API_BASE_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// API response interfaces
interface HistoricalSentimentResponse {
  success: boolean;
  data: {
    ticker: string;
    historicalSentiment: HistoricalSentimentData[];
    timeframe: string;
    dataPoints: number;
    generatedAt: string;
  };
}

interface SentimentTrendsResponse {
  success: boolean;
  data: {
    ticker: string;
    trends: SentimentTrends;
    timeframe: string;
    generatedAt: string;
  };
}

interface SentimentSummaryResponse {
  success: boolean;
  data: {
    ticker: string;
    summary: SentimentSummary;
    timeframe: string;
    generatedAt: string;
  };
}

interface ComparativeSentimentResponse {
  success: boolean;
  data: {
    comparison: ComparativeSentiment[];
    timeframe: string;
    tickers: string[];
    generatedAt: string;
  };
}

// API Functions
export const historicalSentimentAPI = {
  // Get historical sentiment data for a ticker
  async getHistoricalSentiment(ticker: string, days: HistoricalTimeRange = '30'): Promise<HistoricalSentimentData[]> {
    try {
      console.log(`🔍 API: Fetching historical sentiment for ${ticker} (${days} days)`);
      const response = await fetch(
        `${API_BASE_URL}/api/sentiment/historical/${ticker}?days=${days}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: any = await response.json();
      console.log(`🔍 API: Raw response for ${ticker}:`, data);
      
      // Check different possible response formats
      if (data.success && data.data && data.data.historicalSentiment) {
        console.log(`🔍 API: Found historicalSentiment array with ${data.data.historicalSentiment.length} items`);
        return data.data.historicalSentiment;
      } else if (data.success && data.data && Array.isArray(data.data)) {
        console.log(`🔍 API: Found direct data array with ${data.data.length} items`);
        return data.data;
      } else if (Array.isArray(data)) {
        console.log(`🔍 API: Found root level array with ${data.length} items`);
        return data;
      } else {
        console.log(`🔍 API: Unexpected response format for ${ticker}:`, data);
        return [];
      }
    } catch (error) {
      console.error('Error fetching historical sentiment:', error);
      throw error;
    }
  },

  // Get sentiment trends for a ticker
  async getSentimentTrends(ticker: string, days: HistoricalTimeRange = '30'): Promise<SentimentTrends> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/sentiment/trends/${ticker}?days=${days}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SentimentTrendsResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to fetch sentiment trends');
      }

      return data.data.trends;
    } catch (error) {
      console.error('Error fetching sentiment trends:', error);
      throw error;
    }
  },

  // Get sentiment summary for a ticker
  async getSentimentSummary(ticker: string, days: HistoricalTimeRange = '30'): Promise<SentimentSummary> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/sentiment/summary/${ticker}?days=${days}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SentimentSummaryResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to fetch sentiment summary');
      }

      return data.data.summary;
    } catch (error) {
      console.error('Error fetching sentiment summary:', error);
      throw error;
    }
  },

  // Get comparative sentiment analysis
  async getComparativeSentiment(tickers: string[], days: HistoricalTimeRange = '30'): Promise<ComparativeSentiment[]> {
    try {
      const tickersParam = tickers.join(',');
      const response = await fetch(
        `${API_BASE_URL}/api/sentiment/comparative?tickers=${tickersParam}&days=${days}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ComparativeSentimentResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to fetch comparative sentiment');
      }

      return data.data.comparison;
    } catch (error) {
      console.error('Error fetching comparative sentiment:', error);
      throw error;
    }
  },

  // Manual aggregation for testing (development only)
  async triggerManualAggregation(tickers: string[] = ['AAPL', 'TSLA', 'MSFT']): Promise<any> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/sentiment/test/manual-aggregation`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ tickers }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to trigger manual aggregation');
      }

      return data;
    } catch (error) {
      console.error('Error triggering manual aggregation:', error);
      throw error;
    }
  }
}; 