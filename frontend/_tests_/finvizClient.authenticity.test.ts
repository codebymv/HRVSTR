import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { fetchFinvizSentiment } from '../src/services/finvizClient';
import * as redditClient from '../src/services/redditClient';
import { SentimentData } from '../src/types';

// Define a type for partial mock Response
type PartialMockResponse = Partial<Response> & {
  json: () => Promise<any>;
  ok: boolean;
};

// Mock fetch API
global.fetch = vi.fn().mockImplementation(() => {
  return Promise.resolve({
    ok: true,
    json: async () => ({}),
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => ({} as Response),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    text: async () => ''
  } as Response);
});

const mockFetch = vi.mocked(global.fetch);

// Mock the redditClient's getProxyUrl function
vi.mock('../src/services/redditClient', () => ({
  getProxyUrl: vi.fn()
}));

describe('FinViz Client Data Authenticity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redditClient.getProxyUrl).mockReturnValue('http://test-proxy:3001');
  });

  afterEach(() => {
    vi.resetAllMocks();
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
        sentiment: "bullish"  // Use string enum value instead of number
      },
      {
        ticker: 'MSFT',
        score: 0.6,
        source: 'finviz',
        timestamp: new Date().toISOString(),
        postCount: 8,
        sentiment: "bullish"  // Use string enum value instead of number
      }
    ];

    // Set up the fetch mock response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sentimentData: mockSentimentData }),
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => ({} as Response),
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
      text: async () => ''
    } as Response);

    // Call the function with multiple tickers to test comma-separated format
    const tickers = ['AAPL', 'MSFT', 'GOOG'];
    const result = await fetchFinvizSentiment(tickers);

    // Verify the API was called with the right URL including all tickers
    expect(mockFetch).toHaveBeenCalledWith(
      'http://test-proxy:3001/api/finviz/ticker-sentiment?tickers=AAPL,MSFT,GOOG',
      expect.any(Object)
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
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should throw error when API returns non-ok response', async () => {
    // Mock error response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429, // Too Many Requests
      statusText: 'Too Many Requests',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => ({} as Response),
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
      text: async () => '',
      json: async () => ({})
    } as Response);

    // Call with valid tickers
    const tickers = ['AAPL', 'MSFT'];
    
    // Should throw an error with status code
    await expect(fetchFinvizSentiment(tickers)).rejects.toThrow('FinViz API error: 429');
  });

  it('should support abort signal for request cancellation', async () => {
    // Create an abort controller and signal
    const controller = new AbortController();
    const signal = controller.signal;
    
    // Mock a successful response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sentimentData: [] }),
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => ({} as Response),
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
      text: async () => ''
    } as Response);
    
    // Start the request with the signal
    const requestPromise = fetchFinvizSentiment(['AAPL'], signal);
    
    // Verify fetch was called with the signal
    expect(mockFetch).toHaveBeenCalledWith(
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
    
    // Mock the fetch response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => realisticAPIResponse,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      clone: () => ({} as Response),
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
      text: async () => ''
    } as Response);
    
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
