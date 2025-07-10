import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchFinvizSentiment } from '../src/services/finvizClient';
import { SentimentData } from '../src/types';
import axios from 'axios';

// We'll use vi.spyOn for better TypeScript support instead of vi.mock

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(() => 'mock-auth-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

describe('FinViz Client Data Authenticity', () => {
  let mockAxiosGet: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a fresh spy for each test
    mockAxiosGet = vi.spyOn(axios, 'get');
  });

  afterEach(() => {
    vi.resetAllMocks();
    // Restore the spy
    if (mockAxiosGet) {
      mockAxiosGet.mockRestore();
    }
  });

  it('should make real API requests with correct tickers', async () => {
    // Mock a successful response with realistic data structure
    const mockSentimentData: SentimentData[] = [
      {
        ticker: 'AAPL',
        score: 0.75,
        source: 'finviz',
        timestamp: new Date().toISOString(),
        postCount: 12,
        sentiment: "bullish",
        commentCount: 0,
        confidence: 0,
        upvotes: 0
      },
      {
        ticker: 'MSFT',
        score: 0.6,
        source: 'finviz',
        timestamp: new Date().toISOString(),
        postCount: 8,
        sentiment: "bullish",
        commentCount: 0,
        confidence: 0,
        upvotes: 0
      }
    ];

    // Set up the axios mock response
    mockAxiosGet.mockResolvedValueOnce({
      data: { sentimentData: mockSentimentData },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
      request: {}
    });

    // Call the function with multiple tickers to test comma-separated format
    const tickers = ['AAPL', 'MSFT', 'GOOG'];
    const result = await fetchFinvizSentiment(tickers);

    // Verify the API was called with the right parameters
    expect(mockAxiosGet).toHaveBeenCalledWith(
      'http://localhost:3001/api/finviz/ticker-sentiment',
      expect.objectContaining({
        params: { tickers: 'AAPL,MSFT,GOOG' },
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock-auth-token'
        })
      })
    );

    // Verify the result is the mock data
    expect(result).toEqual(mockSentimentData);
    expect(result.length).toBe(2);
  });

  it('should handle empty ticker array correctly', async () => {
    // Test with empty ticker array
    const result = await fetchFinvizSentiment([]);
    
    // Should return empty array without making API call
    expect(result).toEqual([]);
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it('should throw error when API returns non-ok response', async () => {
    // Mock error response
    mockAxiosGet.mockRejectedValueOnce({
      response: {
        status: 429,
        statusText: 'Too Many Requests',
        data: { error: 'Rate limit exceeded' }
      }
    });

    // Call with valid tickers
    const tickers = ['AAPL', 'MSFT'];
    
    // Should throw an error with rate limiting message
    await expect(fetchFinvizSentiment(tickers)).rejects.toThrow('Rate limit exceeded');
  });

  it('should support abort signal for request cancellation', async () => {
    // Create an abort controller and signal
    const controller = new AbortController();
    const signal = controller.signal;
    
    // Mock a successful response
    mockAxiosGet.mockResolvedValueOnce({
      data: { sentimentData: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
      request: {}
    });
    
    // Start the request with the signal
    const requestPromise = fetchFinvizSentiment(['AAPL'], signal);
    
    // Verify axios was called with the signal
    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal })
    );
    
    // Complete the request
    await requestPromise;
  });

  it('should parse authentic response structure correctly', async () => {
    // Create realistic FinViz sentiment data format that matches backend API
    const realisticAPIResponse = {
      sentimentData: [
        {
          ticker: 'AAPL',
          score: 0.82,
          source: 'finviz',
          timestamp: '2025-05-07T12:30:45Z',
          postCount: 15,
          headlines: [
            "Apple's New M3 Chip Shows Strong Performance Gains",
            "Analysts Raise AAPL Price Target After Earnings Beat"
          ]
        },
        {
          ticker: 'GOOG',
          score: 0.65,
          source: 'finviz',
          timestamp: '2025-05-07T12:31:22Z',
          postCount: 10,
          headlines: [
            "Google's AI Investments Starting to Pay Off, Says Analyst"
          ]
        }
      ]
    };
    
    // Mock the axios response
    mockAxiosGet.mockResolvedValueOnce({
      data: realisticAPIResponse,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
      request: {}
    });
    
    // Call the function
    const result = await fetchFinvizSentiment(['AAPL', 'GOOG']);
    
    // Verify data structure is preserved
    expect(result.length).toBe(2);
    expect(result[0].ticker).toBe('AAPL');
    expect(result[0].score).toBe(0.82);
    expect(result[0].source).toBe('finviz');
    expect(result[0].postCount).toBe(15);
    expect(result[0].timestamp).toBe('2025-05-07T12:30:45Z');
    
    // Verify the second ticker data
    expect(result[1].ticker).toBe('GOOG');
    expect(result[1].score).toBe(0.65);
  });
});
