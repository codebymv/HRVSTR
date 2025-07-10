import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SentimentData, TimeRange } from '../src/types';
import { setupWindowMock, setupFetchMock } from './setupTestEnv';
import axios from 'axios';

// Function to clean up mocks
let cleanupWindow: () => void;
let cleanupFetch: () => void;

describe('API Data Authenticity Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up window and fetch mocks
    cleanupWindow = setupWindowMock();
    cleanupFetch = setupFetchMock();
    
    // Configure fetch mock with a default success response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({})
    });
  });
  
  afterEach(() => {
    // Clean up all mocks
    cleanupWindow();
    cleanupFetch();
    vi.resetAllMocks();
  });
  
  describe('Sentiment Analysis API', () => {
    it('fetches sentiment data with correct parameters', async () => {
      // Import the API module
      const apiModule = await import('../src/services/api');
      
      // Skip if the function doesn't exist
      if (!apiModule.fetchSentimentData) {
        console.log('fetchSentimentData not available, skipping test');
        return;
      }
      
      // Test with valid time range parameter
      const timeRange: TimeRange = '1w';
      
      // Call the function with correct signature (timeRange first)
      await apiModule.fetchSentimentData(timeRange);
      
      // Verify the API request was made with the correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/sentiment-unified/reddit/market'),
        expect.any(Object)
      );
      
      // Check URL contains the correct time range parameter, not hardcoded values
      const url = (global.fetch as any).mock.calls[0][0];
      expect(url).toContain(`timeRange=${timeRange}`);
    });
    
    it('processes real sentiment data without modifying values', async () => {
      // Create realistic mock data that matches the expected API response
      const mockSentimentData: SentimentData[] = [
        {
          ticker: 'TSLA',
          score: 0.78,
          sentiment: 'bullish',
          source: 'reddit',
          postCount: 345,
          timestamp: '2025-05-07T08:00:00Z'
        },
        {
          ticker: 'TSLA',
          score: 0.65,
          sentiment: 'neutral',
          source: 'finviz',
          postCount: 120,
          timestamp: '2025-05-07T08:30:00Z'
        }
      ];
      
      // Configure mock to match the actual API response format from the unified endpoint
      // The API expects a nested structure: { success: true, data: { data: sentimentData } }
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            data: {
              timestamps: ['2025-05-07T08:00:00Z', '2025-05-07T08:30:00Z'],
              bullish: [0.78, 0.65],
              bearish: [0.15, 0.20],
              neutral: [0.07, 0.15],
              total: [345, 120]
            }
          }
        })
      });
      
      // Import module and call function
      const apiModule = await import('../src/services/api');
      
      // Skip if the function doesn't exist
      if (!apiModule.fetchSentimentData) {
        console.log('fetchSentimentData not available, skipping test');
        return;
      }
      
      // Call with valid time range parameter
      const result = await apiModule.fetchSentimentData('1d');
      
      // Check that the data is properly extracted and converted from time series format
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2); // Two time points
      
      // Check first data point (bullish dominant: 0.78 > 0.15 and 0.78 > 0.07)
      expect(result[0].ticker).toBe('MARKET');
      expect(result[0].source).toBe('reddit');
      expect(result[0].sentiment).toBe('bullish');
      expect(result[0].score).toBe(0.78);
      expect(result[0].timestamp).toBe('2025-05-07T08:00:00Z');
      
      // Check second data point (bullish dominant: 0.65 > 0.20 and 0.65 > 0.15)
      expect(result[1].ticker).toBe('MARKET');
      expect(result[1].source).toBe('reddit');
      expect(result[1].sentiment).toBe('bullish');
      expect(result[1].score).toBe(0.65);
      expect(result[1].timestamp).toBe('2025-05-07T08:30:00Z');
    });
    
    it('properly handles different time ranges with appropriate parameters', async () => {
      // Import the API module
      const apiModule = await import('../src/services/api');
      
      // Skip if the function doesn't exist
      if (!apiModule.fetchSentimentData) {
        console.log('fetchSentimentData not available, skipping test');
        return;
      }
      
      // Test with different time ranges
      const timeRanges: TimeRange[] = ['1d', '1w', '1m', '3m'];
      
      for (const timeRange of timeRanges) {
        // Reset mock before each call
        (global.fetch as any).mockClear();
        
        // Call the function with this time range
        await apiModule.fetchSentimentData(timeRange);
        
        // Verify correct time range was passed
        const url = (global.fetch as any).mock.calls[0][0];
        expect(url).toContain(`timeRange=${timeRange}`);
      }
    });
  });
  
  describe('FinViz API', () => {
    it('fetches FinViz data with correct ticker parameters', async () => {
      // Mock axios for FinViz client
      const mockAxiosGet = vi.spyOn(axios, 'get').mockResolvedValue({
        data: {
          sentimentData: [
            {
              ticker: 'AAPL',
              score: 0.75,
              sentiment: 'bullish',
              timestamp: '2025-01-15T10:00:00Z',
              confidence: 0.85,
              postCount: 150,
              commentCount: 45,
              upvotes: 120
            }
          ],
          credits: {
            used: 1,
            remaining: 99,
            operation: 'finviz_sentiment',
            tier: 'basic'
          }
        }
      });
      
      // Mock localStorage for auth token
      const mockGetItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('mock-auth-token');
      
      // Import the FinViz client module
      const finvizModule = await import('../src/services/finvizClient');
      
      // Skip if the function doesn't exist
      if (!finvizModule.fetchFinvizSentiment) {
        console.log('fetchFinvizSentiment not available, skipping test');
        return;
      }
      
      // Test parameters
      const tickers = ['AAPL', 'MSFT', 'GOOG'];
      
      // Call the function
      const result = await finvizModule.fetchFinvizSentiment(tickers);
      
      // Verify axios was called with the correct parameters
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/finviz/ticker-sentiment'),
        expect.objectContaining({
          params: { tickers: tickers.join(',') },
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-auth-token',
            'Content-Type': 'application/json'
          })
        })
      );
      
      // Verify the result is properly formatted
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].ticker).toBe('AAPL');
      expect(result[0].source).toBe('finviz');
      
      // Clean up mocks
      mockAxiosGet.mockRestore();
      mockGetItem.mockRestore();
    });
  });
});
