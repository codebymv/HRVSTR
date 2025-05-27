import { describe, it, expect } from 'vitest';
import { 
  calculateAverageSentiment, 
  getSentimentCategory, 
  getSentimentColor,
  getSentimentTextColor,
  formatNumber,
  formatDate
} from '../src/components/SentimentScraper/sentimentUtils';
import { SentimentData } from '../src/types';

describe('Sentiment Utils Data Authenticity', () => {
  describe('calculateAverageSentiment', () => {
    it('calculates correct averages from real data samples', () => {
      // Create test data that mimics real API responses
      const sampleData: SentimentData[] = [
        { ticker: 'AAPL', score: 0.8, source: 'reddit', timestamp: '2025-05-06T12:00:00Z', postCount: 120, sentiment: "bullish" },
        { ticker: 'AAPL', score: 0.6, source: 'finviz', timestamp: '2025-05-06T12:30:00Z', postCount: 80, sentiment: "bullish" },
        { ticker: 'AAPL', score: 0.7, source: 'reddit', timestamp: '2025-05-06T13:00:00Z', postCount: 90, sentiment: "bullish" },
        { ticker: 'MSFT', score: 0.4, source: 'reddit', timestamp: '2025-05-06T12:15:00Z', postCount: 75, sentiment: "neutral" },
        { ticker: 'MSFT', score: 0.3, source: 'finviz', timestamp: '2025-05-06T12:45:00Z', postCount: 65, sentiment: "neutral" }
      ];

      // Test with AAPL data - should average the 3 AAPL entries
      const aaplSentiment = calculateAverageSentiment(sampleData, 'AAPL');
      expect(aaplSentiment).toBeCloseTo(0.7, 1); // 0.7 is (0.8 + 0.6 + 0.7) / 3

      // Test with MSFT data - should average the 2 MSFT entries
      const msftSentiment = calculateAverageSentiment(sampleData, 'MSFT');
      expect(msftSentiment).toBeCloseTo(0.35, 2); // 0.35 is (0.4 + 0.3) / 2

      // Test with a ticker not in the data
      const tslaResult = calculateAverageSentiment(sampleData, 'TSLA');
      expect(tslaResult).toBe(0); // Should return 0 for non-existent ticker
    });

    it('handles empty data sets properly', () => {
      // Empty data set should return 0
      expect(calculateAverageSentiment([], 'AAPL')).toBe(0);
    });
  });

  describe('sentiment classification', () => {
    it('correctly categorizes sentiment scores from real data range', () => {
      // Test bullish threshold
      expect(getSentimentCategory(0.8)).toBe('bullish');
      expect(getSentimentCategory(0.6)).toBe('bullish');
      
      // Test bearish threshold
      expect(getSentimentCategory(0.3)).toBe('bearish');
      expect(getSentimentCategory(0.4)).toBe('bearish');
      
      // Test neutral range
      expect(getSentimentCategory(0.5)).toBe('neutral');
      expect(getSentimentCategory(0.59)).toBe('neutral');
      expect(getSentimentCategory(0.41)).toBe('neutral');
    });

    it('provides consistent visual indicators for sentiment ranges', () => {
      // Test bullish colors
      expect(getSentimentColor(0.7)).toBe('bg-green-500');
      expect(getSentimentTextColor(0.7)).toBe('text-green-500');
      
      // Test bearish colors
      expect(getSentimentColor(0.3)).toBe('bg-red-500');
      expect(getSentimentTextColor(0.3)).toBe('text-red-500');
      
      // Test neutral colors
      expect(getSentimentColor(0.5)).toBe('bg-yellow-500');
      expect(getSentimentTextColor(0.5)).toBe('text-yellow-500');
      
      // Verify color consistency across the entire range
      for (let i = 0; i <= 10; i++) {
        const score = i / 10;
        if (score >= 0.6) {
          expect(getSentimentColor(score)).toBe('bg-green-500');
          expect(getSentimentTextColor(score)).toBe('text-green-500');
        } else if (score <= 0.4) {
          expect(getSentimentColor(score)).toBe('bg-red-500');
          expect(getSentimentTextColor(score)).toBe('text-red-500');
        } else {
          expect(getSentimentColor(score)).toBe('bg-yellow-500');
          expect(getSentimentTextColor(score)).toBe('text-yellow-500');
        }
      }
    });
  });

  describe('data formatting', () => {
    it('formats real-world post counts correctly', () => {
      // Test realistic post counts
      expect(formatNumber(150)).toBe('150');
      expect(formatNumber(1500)).toBe('1.5k');
      expect(formatNumber(15000)).toBe('15.0k');
      expect(formatNumber(1500000)).toBe('1.5m');
      
      // Test edge cases
      expect(formatNumber(999)).toBe('999');
      expect(formatNumber(1000)).toBe('1.0k');
      expect(formatNumber(999999)).toBe('1000.0k');
      expect(formatNumber(1000000)).toBe('1.0m');
      
      // Test null/undefined handling
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber(undefined)).toBe('0');
    });

    it('formats timestamps into human-readable dates', () => {
      // Create a fixed reference date for testing
      const testDate = new Date('2025-05-06T15:30:00Z');
      const formattedDate = formatDate(testDate.toISOString());
      
      // Check that the formatted date contains expected components
      // The exact format may vary by locale, so we check for key parts
      expect(formattedDate).toContain('May'); // Month name
      expect(formattedDate).toContain('6'); // Day number
      
      // Test that different dates produce different results
      const anotherDate = new Date('2025-05-07T15:30:00Z');
      const anotherFormatted = formatDate(anotherDate.toISOString());
      expect(anotherFormatted).toContain('May');
      expect(anotherFormatted).toContain('7'); // Different day
      expect(anotherFormatted).not.toBe(formattedDate); // Should be different overall
    });
  });
});
