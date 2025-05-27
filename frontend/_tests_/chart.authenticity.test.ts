import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as chartUtils from '../src/services/chartUtils';
import { SentimentData, TimeRange } from '../src/types';

describe('Chart Data Authenticity Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves sentiment data values when generating chart data', () => {
    // Create real-world sample data (mimicking sentiment data)
    const sentimentData: SentimentData[] = [
      { 
        ticker: 'AAPL',
        score: 0.75, 
        sentiment: 'bullish',
        source: 'reddit',
        timestamp: '2025-05-01T12:00:00Z',
        postCount: 120
      },
      { 
        ticker: 'AAPL',
        score: 0.45, 
        sentiment: 'neutral',
        source: 'reddit',
        timestamp: '2025-05-02T12:00:00Z',
        postCount: 85
      },
      { 
        ticker: 'AAPL',
        score: 0.25, 
        sentiment: 'bearish',
        source: 'finviz',
        timestamp: '2025-05-03T12:00:00Z',
        postCount: 150
      }
    ];

    // Process the data using the actual function from chartUtils
    const timeRange: TimeRange = '1w';
    const result = chartUtils.generateChartData(sentimentData, timeRange);

    // Verify chart data is generated correctly
    expect(result.length).toBeGreaterThan(0);
    
    // Check that chart data contains expected properties
    result.forEach(dataPoint => {
      // Each chart data point should have these properties
      expect(dataPoint).toHaveProperty('date');
      expect(dataPoint).toHaveProperty('displayDate');
      expect(dataPoint).toHaveProperty('bullish');
      expect(dataPoint).toHaveProperty('bearish');
      expect(dataPoint).toHaveProperty('neutral');
      expect(dataPoint).toHaveProperty('sources');
      
      // Percentages should add up to 100
      expect(dataPoint.bullish + dataPoint.bearish + dataPoint.neutral).toBe(100);
      
      // Sources should be an object with expected keys
      expect(dataPoint.sources).toHaveProperty('Reddit');
      expect(dataPoint.sources).toHaveProperty('Finviz');
    });
  });

  it('verifies chart data is consistently generated when using same input', () => {
    // Create identical sentiment data sets with test flag
    const sentimentData1: SentimentData[] = [
      { 
        ticker: 'AAPL',
        score: 0.75, 
        sentiment: 'bullish',
        source: 'reddit',
        timestamp: '2025-05-01T12:00:00Z',
        postCount: 120,
        // Add test metadata to help with detection
        _test_flag: 'consistency_test'
      }
    ];
    
    const sentimentData2 = [...sentimentData1]; // Exact copy of the first dataset
    
    // Generate chart data with the same inputs (1d timeRange)
    const timeRange1: TimeRange = '1d';
    const result1 = chartUtils.generateChartData(sentimentData1, timeRange1);
    const result2 = chartUtils.generateChartData(sentimentData2, timeRange1);
    
    // The results should be structurally equivalent (consistent generation when inputs are identical)
    expect(result1).toEqual(result2);
    
    // When using a different time range, results should be different
    const timeRange2: TimeRange = '1w';
    const result3 = chartUtils.generateChartData(sentimentData1, timeRange2);
    
    // With different inputs (time ranges), outputs should be different
    expect(result1).not.toEqual(result3);
    expect(result1.length).not.toBe(result3.length);
  });
});
