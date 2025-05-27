import { describe, it, expect } from 'vitest';
import { 
  deduplicateSentiments, 
  ensureTickerDiversity, 
  getDiverseSentimentData 
} from '../src/services/tickerUtils';
import { mergeSentimentData, aggregateByTicker } from '../src/services/sentimentMerger';
import { SentimentData } from '../src/types';

describe('Sentiment Data Processing', () => {
  // Test data
  const mockRedditSentiment: SentimentData[] = [
    {
      ticker: 'AAPL',
      score: 0.6,
      sentiment: 'bullish',
      source: 'reddit',
      timestamp: '2025-05-01T12:00:00Z',
      postCount: 15,
      commentCount: 120
    },
    {
      ticker: 'AAPL',
      score: 0.4,
      sentiment: 'bullish',
      source: 'reddit',
      timestamp: '2025-05-02T12:00:00Z',
      postCount: 10,
      commentCount: 80
    },
    {
      ticker: 'TSLA',
      score: -0.3,
      sentiment: 'bearish',
      source: 'reddit',
      timestamp: '2025-05-01T12:00:00Z',
      postCount: 20,
      commentCount: 200
    },
    {
      ticker: 'MARKET',
      score: 0.1,
      sentiment: 'neutral',
      source: 'reddit',
      timestamp: '2025-05-01T12:00:00Z',
      postCount: 50,
      commentCount: 500
    }
  ];

  const mockFinvizSentiment: SentimentData[] = [
    {
      ticker: 'AAPL',
      score: 0.5,
      sentiment: 'bullish',
      source: 'finviz',
      timestamp: '2025-05-01T12:00:00Z',
      postCount: 0,
      commentCount: 0
    },
    {
      ticker: 'MSFT',
      score: 0.7,
      sentiment: 'bullish',
      source: 'finviz',
      timestamp: '2025-05-01T12:00:00Z',
      postCount: 0,
      commentCount: 0
    }
  ];

  describe('Sentiment Data Deduplication', () => {
    it('should remove duplicate sentiments for the same ticker', () => {
      const result = deduplicateSentiments(mockRedditSentiment);
      
      // Should have 3 unique tickers, not 4 entries
      expect(result.length).toBe(3);
      
      // Check that we get one entry per ticker
      const tickers = result.map(s => s.ticker);
      expect(tickers).toContain('AAPL');
      expect(tickers).toContain('TSLA');
      expect(tickers).toContain('MARKET');
      
      // Check that the most recent AAPL entry was kept
      const aaplEntry = result.find(s => s.ticker === 'AAPL');
      expect(aaplEntry?.timestamp).toBe('2025-05-02T12:00:00Z');
    });
  });

  describe('Ticker Diversity Functions', () => {
    it('should ensure ticker diversity by limiting number of similar tickers', () => {
      const inputTickers = ['AAPL', 'AAPL', 'TSLA', 'MSFT', 'AMZN', 'GOOGL', 'SPY', 'QQQ', 'MARKET'];
      const result = ensureTickerDiversity(inputTickers, 5);
      
      // Should limit to 5 tickers with no duplicates
      expect(result.length).toBe(5);
      expect(new Set(result).size).toBe(5);
    });

    it('should get diverse sentiment data across different tickers', () => {
      const allSentiments = [...mockRedditSentiment, ...mockFinvizSentiment];
      
      // Test getting 2 of 4 tickers, with 1 entry per ticker
      const result = getDiverseSentimentData(allSentiments, 1, 2);
      
      // Should have 2 entries for different tickers
      expect(result.length).toBe(2);
      expect(new Set(result.map(s => s.ticker)).size).toBe(2);
    });
  });

  describe('Sentiment Data Merging', () => {
    it('should merge sentiment data from multiple sources', () => {
      const result = mergeSentimentData(mockRedditSentiment, mockFinvizSentiment);
      
      // Should have 6 entries in total (4 Reddit + 2 Finviz)
      expect(result.length).toBe(6);
      
      // Check that both sources are represented
      const sources = new Set(result.map(s => s.source));
      expect(sources.size).toBe(2);
      expect(sources.has('reddit')).toBe(true);
      expect(sources.has('finviz')).toBe(true);
    });

    it('should aggregate sentiment data by ticker', () => {
      const mergedData = mergeSentimentData(mockRedditSentiment, mockFinvizSentiment);
      const result = aggregateByTicker(mergedData);
      
      // Should have 4 unique tickers after aggregation
      expect(result.length).toBe(4);
      
      // Verify tickers present
      const tickers = result.map(s => s.ticker);
      expect(tickers).toContain('AAPL');
      expect(tickers).toContain('TSLA');
      expect(tickers).toContain('MSFT');
      expect(tickers).toContain('MARKET');
      
      // Check AAPL sentiment is averaged from both sources
      const aaplEntry = result.find(s => s.ticker === 'AAPL');
      
      // Approximate due to potential floating point issues
      expect(aaplEntry?.score).toBeCloseTo((0.6 + 0.4 + 0.5) / 3, 1);
    });
  });
});
