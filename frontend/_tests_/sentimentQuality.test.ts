import { describe, it, expect } from 'vitest';
import { calculateSentimentQuality, getQualityGradeColor } from '../src/components/SentimentScraper/sentimentUtils';
import { SentimentData } from '../src/types';

describe('Sentiment Quality Score', () => {
  it('should calculate high quality score for high-volume, multi-source, recent data', () => {
    const highQualityData: SentimentData = {
      ticker: 'AAPL',
      score: 0.65,
      sentiment: 'bullish',
      source: 'combined',
      timestamp: new Date().toISOString(), // Recent timestamp
      postCount: 45,
      commentCount: 200,
      newsCount: 8,
      confidence: 85,
      sources: {
        reddit: 45,
        finviz: 8,
        yahoo: 3
      }
    };

    const quality = calculateSentimentQuality(highQualityData);
    
    expect(quality.qualityScore).toBeGreaterThan(75);
    expect(quality.grade).toBe('A');
    expect(quality.recommendation).toContain('High-confidence');
    expect(quality.factors).toHaveLength(4);
    expect(quality.details.volumeScore).toBeGreaterThan(80);
    expect(quality.details.diversityScore).toBeGreaterThan(90); // 3 sources
    expect(quality.details.confidenceScore).toBe(85);
    expect(quality.details.freshnessScore).toBeGreaterThan(95); // Very recent
  });

  it('should calculate low quality score for low-volume, single-source, old data', () => {
    const lowQualityData: SentimentData = {
      ticker: 'XYZ',
      score: 0.25,
      sentiment: 'bullish',
      source: 'reddit',
      timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours old
      postCount: 2,
      commentCount: 5,
      newsCount: 0,
      confidence: 35
    };

    const quality = calculateSentimentQuality(lowQualityData);
    
    expect(quality.qualityScore).toBeLessThan(45);
    expect(quality.grade).toBe('D');
    expect(quality.recommendation).toContain('Low quality');
    expect(quality.details.volumeScore).toBeLessThan(20);
    expect(quality.details.diversityScore).toBeLessThan(40); // Single source
    expect(quality.details.confidenceScore).toBe(35);
    expect(quality.details.freshnessScore).toBe(0); // Too old
  });

  it('should calculate moderate quality score for medium data', () => {
    const mediumQualityData: SentimentData = {
      ticker: 'TSLA',
      score: 0.45,
      sentiment: 'bullish',
      source: 'combined',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours old
      postCount: 15,
      commentCount: 80,
      newsCount: 3,
      confidence: 62,
      sources: {
        reddit: 15,
        finviz: 3
      }
    };

    const quality = calculateSentimentQuality(mediumQualityData);
    
    expect(quality.qualityScore).toBeGreaterThan(45);
    expect(quality.qualityScore).toBeLessThan(80);
    expect(['B', 'C']).toContain(quality.grade);
    expect(quality.recommendation).toContain('caution');
    expect(quality.details.diversityScore).toBe(67); // 2 sources out of 3 max
    expect(quality.details.freshnessScore).toBe(75); // 6 hours = 75% freshness
  });

  it('should handle missing data gracefully', () => {
    const sparseData: SentimentData = {
      ticker: 'MINIMAL',
      score: 0.3,
      sentiment: 'bullish',
      source: 'reddit',
      timestamp: new Date().toISOString()
      // No postCount, commentCount, confidence, etc.
    };

    const quality = calculateSentimentQuality(sparseData);
    
    expect(quality.qualityScore).toBeDefined();
    expect(quality.grade).toBeDefined();
    expect(quality.recommendation).toBeDefined();
    expect(quality.factors).toHaveLength(4);
    
    // Should use defaults for missing data
    expect(quality.details.volumeScore).toBe(0); // No data points
    expect(quality.details.confidenceScore).toBe(50); // Default confidence
  });

  it('should weight news articles higher than social posts', () => {
    const newsHeavyData: SentimentData = {
      ticker: 'NEWS',
      score: 0.4,
      sentiment: 'bullish',
      source: 'finviz',
      timestamp: new Date().toISOString(),
      postCount: 0,
      commentCount: 0,
      newsCount: 10, // High news count
      confidence: 70
    };

    const socialHeavyData: SentimentData = {
      ticker: 'SOCIAL',
      score: 0.4,
      sentiment: 'bullish',
      source: 'reddit',
      timestamp: new Date().toISOString(),
      postCount: 10, // Same count but social posts
      commentCount: 0,
      newsCount: 0,
      confidence: 70
    };

    const newsQuality = calculateSentimentQuality(newsHeavyData);
    const socialQuality = calculateSentimentQuality(socialHeavyData);
    
    // News should have higher volume score due to 2x weighting
    expect(newsQuality.details.volumeScore).toBeGreaterThan(socialQuality.details.volumeScore);
  });

  it('should provide correct color classes for quality grades', () => {
    expect(getQualityGradeColor('A')).toContain('green');
    expect(getQualityGradeColor('B')).toContain('blue');
    expect(getQualityGradeColor('C')).toContain('yellow');
    expect(getQualityGradeColor('D')).toContain('red');
  });

  it('should calculate freshness decay correctly', () => {
    const now = new Date();
    
    // Test data at different ages
    const testAges = [
      { hours: 0, expectedFreshness: 100 },    // Brand new
      { hours: 6, expectedFreshness: 75 },     // 6 hours = 75%
      { hours: 12, expectedFreshness: 50 },    // 12 hours = 50%
      { hours: 18, expectedFreshness: 25 },    // 18 hours = 25%
      { hours: 24, expectedFreshness: 0 },     // 24 hours = 0%
      { hours: 30, expectedFreshness: 0 }      // Beyond 24 hours = 0%
    ];

    testAges.forEach(({ hours, expectedFreshness }) => {
      const testData: SentimentData = {
        ticker: 'TEST',
        score: 0.5,
        sentiment: 'bullish',
        source: 'reddit',
        timestamp: new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString(),
        postCount: 10,
        confidence: 70
      };

      const quality = calculateSentimentQuality(testData);
      expect(quality.details.freshnessScore).toBe(expectedFreshness);
    });
  });
}); 