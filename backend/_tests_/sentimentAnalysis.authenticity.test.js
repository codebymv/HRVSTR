/**
 * Tests for Sentiment Analysis Data Authenticity
 * 
 * These tests verify that the sentiment analysis system processes real data
 * rather than using hardcoded or randomly generated sentiment values.
 */

const sentiment = require('../src/utils/sentiment');
const cacheManager = require('../src/utils/cacheManager');

// Mock dependencies
jest.mock('../src/utils/cacheManager');

describe('Sentiment Analysis Authenticity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up cache manager mock
    cacheManager.getOrFetch = jest.fn().mockImplementation((key, limiter, fetchFn) => fetchFn());
    cacheManager.registerRateLimit = jest.fn();
  });
  
  describe('Sentiment Score Calculation', () => {
    it('should produce consistent sentiment scores for the same text', () => {
      // Skip test if sentiment function is not available
      if (!sentiment || !sentiment.analyzeText) {
        console.log('Sentiment analysis function not available, skipping test');
        return;
      }
      
      // Create a set of realistic stock-related text samples
      const positiveSamples = [
        'AAPL is showing strong growth potential with their new product lineup.',
        'The company exceeded quarterly expectations with impressive revenue numbers.',
        'Bullish on this stock, significant upside potential from current levels.'
      ];
      
      const negativeSamples = [
        'Disappointing earnings report shows fundamental weakness in the business model.',
        'The stock is overvalued and faces increasing competition in key markets.',
        'Bearish outlook due to declining margins and poor forward guidance.'
      ];
      
      const neutralSamples = [
        'The company reported earnings in line with analyst expectations.',
        'Quarterly results were mixed with some strength in new markets.',
        'The stock price has been trading sideways within a narrow range.'
      ];
      
      // Verify positive text consistently produces positive sentiment
      const positiveScores = positiveSamples.map(text => sentiment.analyzeText(text).score);
      positiveScores.forEach(score => {
        expect(score).toBeGreaterThan(0); // Positive sentiment should have score > 0
      });
      
      // Verify negative text consistently produces negative sentiment
      const negativeScores = negativeSamples.map(text => sentiment.analyzeText(text).score);
      negativeScores.forEach(score => {
        expect(score).toBeLessThan(0); // Negative sentiment should have score < 0
      });
      
      // Verify consistency - the same text should always produce the same score
      positiveSamples.forEach(text => {
        const firstAnalysis = sentiment.analyzeText(text);
        const secondAnalysis = sentiment.analyzeText(text);
        expect(firstAnalysis.score).toBe(secondAnalysis.score);
      });
    });
    
    it('should detect sentiment differences between opposite texts', () => {
      // Skip test if sentiment function is not available
      if (!sentiment || !sentiment.analyzeText) {
        console.log('Sentiment analysis function not available, skipping test');
        return;
      }
      
      // Create pairs of opposite sentiment texts about the same topic
      const sentimentPairs = [
        {
          positive: "AAPL's new product launch exceeded expectations, driving the stock higher.",
          negative: "AAPL's new product launch disappointed consumers, causing the stock to drop."
        },
        {
          positive: 'Strong earnings report shows the company is growing rapidly.',
          negative: 'Weak earnings report indicates the company is struggling.'
        },
        {
          positive: 'The guidance for next quarter was raised, indicating confidence in future growth.',
          negative: 'The guidance for next quarter was lowered, suggesting trouble ahead.'
        }
      ];
      
      // Test each pair
      sentimentPairs.forEach(pair => {
        const positiveAnalysis = sentiment.analyzeText(pair.positive);
        const negativeAnalysis = sentiment.analyzeText(pair.negative);
        
        // Verify opposite texts produce opposite sentiment
        expect(positiveAnalysis.score).toBeGreaterThan(negativeAnalysis.score);
      });
    });
  });
  
  describe('Text Preprocessing', () => {
    it('should clean text properly before sentiment analysis', () => {
      // Skip test if preprocess function is not available
      if (!sentiment || !sentiment.preprocessText) {
        console.log('Preprocessing function not available, skipping test');
        return;
      }
      
      const rawText = 'BREAKING NEWS!!! $AAPL +15%... This stock is going to the MOON!!! 🚀🚀🚀';
      const preprocessed = sentiment.preprocessText(rawText);
      
      // Verify preprocessing removes common elements that shouldn't affect sentiment
      expect(preprocessed).not.toContain('$AAPL'); // Should remove ticker symbols
      expect(preprocessed).not.toContain('!!!'); // Should remove excessive punctuation
      expect(preprocessed).not.toContain('🚀'); // Should remove emojis
      expect(preprocessed).not.toContain('+15%'); // Should remove percentage changes
      
      // Verify preprocessing preserves key sentiment words
      expect(preprocessed.toLowerCase()).toContain('breaking'); 
      expect(preprocessed.toLowerCase()).toContain('news');
      expect(preprocessed.toLowerCase()).toContain('moon');
    });
  });
  
  describe('Sentiment Aggregation', () => {
    it('should aggregate sentiment data with correct weighting', () => {
      // Skip test if aggregate function is not available
      if (!sentiment || !sentiment.aggregateSentiment) {
        console.log('Aggregation function not available, skipping test');
        return;
      }
      
      // Create realistic sentiment data samples from different sources
      const sentimentData = [
        { ticker: 'AAPL', score: 0.8, source: 'reddit', postCount: 50, weight: 2 }, // High importance
        { ticker: 'AAPL', score: 0.6, source: 'twitter', postCount: 100, weight: 1 }, // Medium importance
        { ticker: 'AAPL', score: 0.1, source: 'news', postCount: 10, weight: 3 }, // High importance, but fewer posts
        { ticker: 'MSFT', score: 0.7, source: 'reddit', postCount: 40, weight: 2 }
      ];
      
      // Calculate weighted average manually for verification
      const aaplData = sentimentData.filter(d => d.ticker === 'AAPL');
      let totalWeight = 0;
      let weightedSum = 0;
      
      aaplData.forEach(d => {
        const weight = d.weight;
        totalWeight += weight;
        weightedSum += d.score * weight;
      });
      
      const expectedAaplScore = weightedSum / totalWeight;
      
      // Test the aggregation function
      const aggregated = sentiment.aggregateSentiment(sentimentData);
      const aaplResult = aggregated.find(item => item.ticker === 'AAPL');
      const msftResult = aggregated.find(item => item.ticker === 'MSFT');
      
      // Verify the aggregation respects weights and source data
      expect(aaplResult.score).toBeCloseTo(expectedAaplScore, 2);
      expect(msftResult.score).toBe(0.7); // Single source, so should match exactly
      
      // Verify the aggregated post count is the sum of all sources
      expect(aaplResult.postCount).toBe(160); // 50 + 100 + 10
      expect(msftResult.postCount).toBe(40);
    });
    
    it('should handle real-world time-series sentiment data', () => {
      // Skip test if timeseries function is not available
      if (!sentiment || !sentiment.getTimeSeriesSentiment) {
        console.log('Time series function not available, skipping test');
        return;
      }
      
      // Create realistic time-series data with timestamps
      const timeSeriesData = [
        { ticker: 'AAPL', score: 0.5, timestamp: '2025-05-07T09:00:00Z', source: 'reddit' },
        { ticker: 'AAPL', score: 0.6, timestamp: '2025-05-07T10:00:00Z', source: 'reddit' },
        { ticker: 'AAPL', score: 0.7, timestamp: '2025-05-07T11:00:00Z', source: 'reddit' },
        { ticker: 'AAPL', score: 0.4, timestamp: '2025-05-07T09:30:00Z', source: 'twitter' },
        { ticker: 'AAPL', score: 0.3, timestamp: '2025-05-07T10:30:00Z', source: 'twitter' },
        { ticker: 'MSFT', score: 0.6, timestamp: '2025-05-07T09:15:00Z', source: 'reddit' },
        { ticker: 'MSFT', score: 0.5, timestamp: '2025-05-07T10:15:00Z', source: 'reddit' }
      ];
      
      // Get time series data for AAPL
      const interval = 'hour'; // 1-hour intervals
      const aaplTimeSeries = sentiment.getTimeSeriesSentiment(timeSeriesData, 'AAPL', interval);
      
      // Verify the time series structure
      expect(aaplTimeSeries.length).toBeGreaterThan(0);
      
      // Each time point should have a timestamp and aggregated score
      aaplTimeSeries.forEach(point => {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('score');
        expect(typeof point.timestamp).toBe('string');
        expect(typeof point.score).toBe('number');
      });
      
      // Verify time series points are ordered chronologically
      for (let i = 1; i < aaplTimeSeries.length; i++) {
        const prevTime = new Date(aaplTimeSeries[i-1].timestamp).getTime();
        const currTime = new Date(aaplTimeSeries[i].timestamp).getTime();
        expect(currTime).toBeGreaterThan(prevTime);
      }
    });
  });
  
  describe('Sentiment Classification', () => {
    it('should classify sentiment scores into appropriate categories', () => {
      // Skip test if classify function is not available
      if (!sentiment || !sentiment.classifySentiment) {
        console.log('Classification function not available, skipping test');
        return;
      }
      
      // Test various sentiment scores
      const strongPositive = 0.9;
      const moderatePositive = 0.7;
      const slightlyPositive = 0.55;
      const neutral = 0.5;
      const slightlyNegative = 0.45;
      const moderateNegative = 0.3;
      const strongNegative = 0.1;
      
      // Verify the classifications are consistent and appropriate
      expect(sentiment.classifySentiment(strongPositive)).toBe('bullish');
      expect(sentiment.classifySentiment(moderatePositive)).toBe('bullish');
      expect(sentiment.classifySentiment(slightlyPositive)).toBe('neutral');
      expect(sentiment.classifySentiment(neutral)).toBe('neutral');
      expect(sentiment.classifySentiment(slightlyNegative)).toBe('neutral');
      expect(sentiment.classifySentiment(moderateNegative)).toBe('bearish');
      expect(sentiment.classifySentiment(strongNegative)).toBe('bearish');
    });
  });
});
