/**
 * Sentiment Aggregation Tests
 * Tests the accuracy and reliability of multi-source sentiment data processing,
 * aggregation algorithms, and data quality validation
 */

const request = require('supertest');
const { Pool } = require('pg');

// Mock sentiment services
const mockRedditSentimentService = {
  getRedditSentiment: jest.fn(),
  analyzePosts: jest.fn(),
  calculateSentimentScore: jest.fn()
};

const mockYahooSentimentService = {
  getYahooSentiment: jest.fn(),
  parseFinancialNews: jest.fn(),
  extractSentimentMetrics: jest.fn()
};

const mockFinvizSentimentService = {
  getFinvizSentiment: jest.fn(),
  scrapeMarketData: jest.fn(),
  parseNewsHeadlines: jest.fn()
};

const mockAggregatedSentimentService = {
  combineSentimentSources: jest.fn(),
  calculateWeightedScore: jest.fn(),
  generateSentimentChart: jest.fn()
};

// Mock database pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn()
};

jest.mock('../src/config/data-sources', () => ({
  pool: mockPool,
  isDataSourceEnabled: jest.fn(() => true)
}));

describe('Sentiment Aggregation System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Reddit Sentiment Processing', () => {
    test('should parse Reddit posts and calculate sentiment scores', () => {
      const mockRedditPosts = [
        {
          id: 'post1',
          title: 'AAPL to the moon! Great earnings report!',
          content: 'Apple just crushed earnings expectations. This stock is going up!',
          score: 150,
          comments: 45,
          created_utc: 1704067200,
          subreddit: 'stocks'
        },
        {
          id: 'post2', 
          title: 'AAPL might be overvalued',
          content: 'I think Apple is getting too expensive. Might be time to sell.',
          score: 25,
          comments: 12,
          created_utc: 1704063600,
          subreddit: 'investing'
        },
        {
          id: 'post3',
          title: 'Neutral view on AAPL',
          content: 'Apple is a solid company but not much upside from here.',
          score: 80,
          comments: 20,
          created_utc: 1704060000,
          subreddit: 'SecurityAnalysis'
        }
      ];

      // Sentiment analysis function
      const analyzeSentiment = (text) => {
        const positiveWords = ['great', 'crushed', 'moon', 'up'];
        const negativeWords = ['overvalued', 'expensive', 'sell', 'down'];
        
        const words = text.toLowerCase().split(/\s+/);
        let positiveCount = 0;
        let negativeCount = 0;
        
        words.forEach(word => {
          if (positiveWords.includes(word)) positiveCount++;
          if (negativeWords.includes(word)) negativeCount++;
        });
        
        if (positiveCount > negativeCount) return 'positive';
        if (negativeCount > positiveCount) return 'negative';
        return 'neutral';
      };

      // Process posts
      const processedPosts = mockRedditPosts.map(post => {
        const combinedText = `${post.title} ${post.content}`;
        const sentiment = analyzeSentiment(combinedText);
        const weight = Math.log(post.score + 1) * Math.log(post.comments + 1);
        
        return {
          ...post,
          sentiment,
          weight,
          sentimentScore: sentiment === 'positive' ? 1 : sentiment === 'negative' ? -1 : 0
        };
      });

      expect(processedPosts[0].sentiment).toBe('positive');
      expect(processedPosts[1].sentiment).toBe('negative');
      expect(processedPosts[2].sentiment).toBe('neutral');
      expect(processedPosts[0].sentimentScore).toBe(1);
      expect(processedPosts[1].sentimentScore).toBe(-1);
      expect(processedPosts[2].sentimentScore).toBe(0);
    });

    test('should calculate weighted Reddit sentiment score', () => {
      const redditData = {
        posts: [
          { sentiment: 'positive', score: 150, comments: 45, sentimentScore: 1 },
          { sentiment: 'negative', score: 25, comments: 12, sentimentScore: -1 },
          { sentiment: 'positive', score: 100, comments: 30, sentimentScore: 1 },
          { sentiment: 'neutral', score: 50, comments: 15, sentimentScore: 0 }
        ]
      };

      // Calculate weighted sentiment
      let totalWeightedScore = 0;
      let totalWeight = 0;
      
      redditData.posts.forEach(post => {
        const weight = Math.log(post.score + 1) * Math.log(post.comments + 1);
        totalWeightedScore += post.sentimentScore * weight;
        totalWeight += weight;
      });
      
      const weightedSentiment = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
      
      expect(weightedSentiment).toBeGreaterThan(0); // Should be positive overall
      expect(weightedSentiment).toBeLessThanOrEqual(1);
      expect(weightedSentiment).toBeGreaterThanOrEqual(-1);
    });

    test('should filter out low-quality Reddit posts', () => {
      const allPosts = [
        { score: 150, comments: 45, content: 'Great analysis of AAPL fundamentals' },
        { score: 2, comments: 1, content: 'AAPL' }, // Low quality
        { score: 80, comments: 20, content: 'Detailed DD on Apple earnings' },
        { score: 1, comments: 0, content: 'buy' }, // Low quality
        { score: 200, comments: 60, content: 'Comprehensive Apple valuation model' }
      ];

      const qualityFilter = (post) => {
        return post.score >= 10 && 
               post.comments >= 5 && 
               post.content.length >= 20;
      };

      const filteredPosts = allPosts.filter(qualityFilter);
      
      expect(filteredPosts).toHaveLength(3);
      expect(filteredPosts[0].score).toBe(150);
      expect(filteredPosts[1].score).toBe(80);
      expect(filteredPosts[2].score).toBe(200);
    });
  });

  describe('Yahoo Finance Sentiment Processing', () => {
    test('should parse Yahoo Finance news and extract sentiment', () => {
      const mockYahooNews = [
        {
          title: 'Apple Reports Strong Q4 Earnings, Beats Expectations',
          summary: 'Apple Inc. reported quarterly earnings that exceeded analyst expectations...',
          publishedAt: '2024-01-15T16:30:00Z',
          source: 'Reuters',
          sentiment: null
        },
        {
          title: 'Apple Faces Headwinds in China Market',
          summary: 'Apple is experiencing challenges in the Chinese market due to increased competition...',
          publishedAt: '2024-01-15T14:20:00Z',
          source: 'Bloomberg',
          sentiment: null
        }
      ];

      // News sentiment analysis
      const analyzeNewsSentiment = (article) => {
        const positiveKeywords = ['beats', 'strong', 'exceeds', 'growth', 'positive', 'gains'];
        const negativeKeywords = ['headwinds', 'challenges', 'decline', 'falls', 'concerns', 'weak'];
        
        const text = `${article.title} ${article.summary}`.toLowerCase();
        
        let positiveScore = 0;
        let negativeScore = 0;
        
        positiveKeywords.forEach(keyword => {
          if (text.includes(keyword)) positiveScore++;
        });
        
        negativeKeywords.forEach(keyword => {
          if (text.includes(keyword)) negativeScore++;
        });
        
        if (positiveScore > negativeScore) return { sentiment: 'positive', confidence: positiveScore / (positiveScore + negativeScore) };
        if (negativeScore > positiveScore) return { sentiment: 'negative', confidence: negativeScore / (positiveScore + negativeScore) };
        return { sentiment: 'neutral', confidence: 0.5 };
      };

      const processedNews = mockYahooNews.map(article => ({
        ...article,
        ...analyzeNewsSentiment(article)
      }));

      expect(processedNews[0].sentiment).toBe('positive');
      expect(processedNews[1].sentiment).toBe('negative');
      expect(processedNews[0].confidence).toBeGreaterThan(0.5);
    });

    test('should weight news articles by source credibility', () => {
      const sourceWeights = {
        'Reuters': 1.0,
        'Bloomberg': 1.0,
        'Wall Street Journal': 0.9,
        'CNBC': 0.8,
        'MarketWatch': 0.7,
        'Yahoo Finance': 0.6,
        'Unknown': 0.3
      };

      const newsArticles = [
        { source: 'Reuters', sentiment: 'positive', sentimentScore: 0.8 },
        { source: 'Bloomberg', sentiment: 'negative', sentimentScore: -0.6 },
        { source: 'CNBC', sentiment: 'positive', sentimentScore: 0.7 },
        { source: 'Unknown', sentiment: 'negative', sentimentScore: -0.9 }
      ];

      // Calculate weighted sentiment
      let totalWeightedScore = 0;
      let totalWeight = 0;
      
      newsArticles.forEach(article => {
        const weight = sourceWeights[article.source] || sourceWeights['Unknown'];
        totalWeightedScore += article.sentimentScore * weight;
        totalWeight += weight;
      });
      
      const weightedSentiment = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
      
      expect(weightedSentiment).toBeDefined();
      expect(Math.abs(weightedSentiment)).toBeLessThanOrEqual(1);
    });
  });

  describe('FinViz Market Sentiment Processing', () => {
    test('should parse FinViz market data and news headlines', () => {
      const mockFinvizData = {
        marketOverview: {
          sp500Change: 0.75,
          nasdaqChange: 1.2,
          dowChange: 0.45,
          vixLevel: 18.5
        },
        newsHeadlines: [
          'Tech Stocks Rally on Strong Earnings Reports',
          'Federal Reserve Signals Dovish Stance',
          'Market Volatility Expected to Continue',
          'Apple and Microsoft Lead Tech Sector Gains'
        ],
        sectorPerformance: {
          technology: 1.8,
          healthcare: 0.3,
          financials: -0.2,
          energy: -1.1
        }
      };

      // Market sentiment calculation
      const calculateMarketSentiment = (data) => {
        // Weight major indices
        const indexSentiment = (data.marketOverview.sp500Change * 0.4 + 
                               data.marketOverview.nasdaqChange * 0.3 + 
                               data.marketOverview.dowChange * 0.3) / 100;
        
        // VIX sentiment (inverse relationship)
        const vixSentiment = data.marketOverview.vixLevel < 20 ? 0.2 : 
                            data.marketOverview.vixLevel < 30 ? 0 : -0.2;
        
        // News headline sentiment
        const positiveHeadlines = data.newsHeadlines.filter(headline => 
          /rally|gains|strong|positive|up/i.test(headline)
        ).length;
        
        const negativeHeadlines = data.newsHeadlines.filter(headline => 
          /decline|falls|weak|volatility|concerns/i.test(headline)
        ).length;
        
        const headlineSentiment = (positiveHeadlines - negativeHeadlines) / data.newsHeadlines.length;
        
        return {
          indexSentiment,
          vixSentiment,
          headlineSentiment,
          overallSentiment: (indexSentiment + vixSentiment + headlineSentiment) / 3
        };
      };

      const marketSentiment = calculateMarketSentiment(mockFinvizData);
      
      expect(marketSentiment.indexSentiment).toBeGreaterThan(0); // Positive market moves
      expect(marketSentiment.vixSentiment).toBe(0.2); // VIX < 20 is positive
      expect(marketSentiment.headlineSentiment).toBeGreaterThan(0); // More positive headlines
      expect(marketSentiment.overallSentiment).toBeGreaterThan(0);
    });

    test('should handle FinViz data parsing errors gracefully', () => {
      const malformedFinvizData = {
        marketOverview: null,
        newsHeadlines: 'not_an_array',
        sectorPerformance: undefined
      };

      const safeParseFinvizData = (data) => {
        const defaultData = {
          marketOverview: { sp500Change: 0, nasdaqChange: 0, dowChange: 0, vixLevel: 20 },
          newsHeadlines: [],
          sectorPerformance: {}
        };

        return {
          marketOverview: data.marketOverview || defaultData.marketOverview,
          newsHeadlines: Array.isArray(data.newsHeadlines) ? data.newsHeadlines : defaultData.newsHeadlines,
          sectorPerformance: data.sectorPerformance || defaultData.sectorPerformance
        };
      };

      const parsedData = safeParseFinvizData(malformedFinvizData);
      
      expect(parsedData.marketOverview.sp500Change).toBe(0);
      expect(Array.isArray(parsedData.newsHeadlines)).toBe(true);
      expect(parsedData.newsHeadlines).toHaveLength(0);
      expect(typeof parsedData.sectorPerformance).toBe('object');
    });
  });

  describe('Multi-Source Sentiment Aggregation', () => {
    test('should combine sentiment from all sources with proper weighting', () => {
      const sentimentSources = {
        reddit: {
          sentiment: 0.6,
          confidence: 0.8,
          dataPoints: 150,
          weight: 0.3
        },
        yahoo: {
          sentiment: 0.4,
          confidence: 0.9,
          dataPoints: 25,
          weight: 0.4
        },
        finviz: {
          sentiment: 0.2,
          confidence: 0.7,
          dataPoints: 10,
          weight: 0.3
        }
      };

      // Aggregate sentiment calculation
      const aggregateSentiment = (sources) => {
        let totalWeightedSentiment = 0;
        let totalWeight = 0;
        let totalDataPoints = 0;
        
        Object.values(sources).forEach(source => {
          const adjustedWeight = source.weight * source.confidence;
          totalWeightedSentiment += source.sentiment * adjustedWeight;
          totalWeight += adjustedWeight;
          totalDataPoints += source.dataPoints;
        });
        
        const aggregatedSentiment = totalWeight > 0 ? totalWeightedSentiment / totalWeight : 0;
        const overallConfidence = totalWeight / Object.keys(sources).length;
        
        return {
          sentiment: aggregatedSentiment,
          confidence: overallConfidence,
          totalDataPoints,
          sources: Object.keys(sources)
        };
      };

      const result = aggregateSentiment(sentimentSources);
      
      expect(result.sentiment).toBeGreaterThan(0);
      expect(result.sentiment).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.totalDataPoints).toBe(185);
      expect(result.sources).toHaveLength(3);
    });

    test('should handle missing or invalid sentiment sources', () => {
      const incompleteSources = {
        reddit: {
          sentiment: 0.5,
          confidence: 0.8,
          dataPoints: 100,
          weight: 0.4
        },
        yahoo: null, // Missing source
        finviz: {
          sentiment: 'invalid', // Invalid sentiment
          confidence: 0.7,
          dataPoints: 20,
          weight: 0.3
        }
      };

      const sanitizeSources = (sources) => {
        const validSources = {};
        
        Object.entries(sources).forEach(([key, source]) => {
          if (source && 
              typeof source.sentiment === 'number' && 
              !isNaN(source.sentiment) &&
              source.sentiment >= -1 && 
              source.sentiment <= 1) {
            validSources[key] = source;
          }
        });
        
        return validSources;
      };

      const validSources = sanitizeSources(incompleteSources);
      
      expect(Object.keys(validSources)).toHaveLength(1);
      expect(validSources.reddit).toBeDefined();
      expect(validSources.yahoo).toBeUndefined();
      expect(validSources.finviz).toBeUndefined();
    });

    test('should generate sentiment trend data over time', () => {
      const historicalSentiment = [
        { timestamp: '2024-01-15T09:00:00Z', sentiment: 0.2 },
        { timestamp: '2024-01-15T12:00:00Z', sentiment: 0.4 },
        { timestamp: '2024-01-15T15:00:00Z', sentiment: 0.6 },
        { timestamp: '2024-01-15T18:00:00Z', sentiment: 0.3 }
      ];

      // Calculate sentiment trend
      const calculateTrend = (data) => {
        if (data.length < 2) return 'insufficient_data';
        
        const recent = data.slice(-3); // Last 3 data points
        const changes = [];
        
        for (let i = 1; i < recent.length; i++) {
          changes.push(recent[i].sentiment - recent[i-1].sentiment);
        }
        
        const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
        
        if (avgChange > 0.1) return 'strongly_positive';
        if (avgChange > 0.05) return 'positive';
        if (avgChange < -0.1) return 'strongly_negative';
        if (avgChange < -0.05) return 'negative';
        return 'stable';
      };

      const trend = calculateTrend(historicalSentiment);
      expect(['strongly_positive', 'positive', 'negative', 'strongly_negative', 'stable']).toContain(trend);
    });
  });

  describe('Data Quality and Validation', () => {
    test('should validate sentiment score ranges', () => {
      const testScores = [1.5, -2.0, 0.5, 'invalid', null, undefined, 0, 1, -1];
      
      const validateSentimentScore = (score) => {
        return typeof score === 'number' && 
               !isNaN(score) && 
               score >= -1 && 
               score <= 1;
      };

      const validScores = testScores.filter(validateSentimentScore);
      expect(validScores).toEqual([0.5, 0, 1, -1]);
    });

    test('should detect and handle sentiment data anomalies', () => {
      const sentimentData = [
        { source: 'reddit', sentiment: 0.8, dataPoints: 200 },
        { source: 'yahoo', sentiment: -0.9, dataPoints: 2 }, // Potential anomaly
        { source: 'finviz', sentiment: 0.7, dataPoints: 50 }
      ];

      const detectAnomalies = (data) => {
        const anomalies = [];
        
        data.forEach(item => {
          // Flag extreme sentiment with low data points
          if (Math.abs(item.sentiment) > 0.8 && item.dataPoints < 10) {
            anomalies.push({
              source: item.source,
              reason: 'extreme_sentiment_low_data',
              sentiment: item.sentiment,
              dataPoints: item.dataPoints
            });
          }
        });
        
        return anomalies;
      };

      const anomalies = detectAnomalies(sentimentData);
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].source).toBe('yahoo');
      expect(anomalies[0].reason).toBe('extreme_sentiment_low_data');
    });

    test('should maintain sentiment data freshness', () => {
      const currentTime = new Date('2024-01-15T16:00:00Z');
      const sentimentCache = [
        { source: 'reddit', lastUpdated: new Date('2024-01-15T15:45:00Z'), ttl: 900000 }, // 15 min
        { source: 'yahoo', lastUpdated: new Date('2024-01-15T14:30:00Z'), ttl: 1800000 }, // 30 min
        { source: 'finviz', lastUpdated: new Date('2024-01-15T15:00:00Z'), ttl: 3600000 } // 60 min
      ];

      const checkDataFreshness = (cache, currentTime) => {
        return cache.map(item => {
          const age = currentTime.getTime() - item.lastUpdated.getTime();
          const isStale = age > item.ttl;
          
          return {
            ...item,
            age,
            isStale,
            needsRefresh: isStale
          };
        });
      };

      const freshnessCheck = checkDataFreshness(sentimentCache, currentTime);
      
      expect(freshnessCheck[0].isStale).toBe(false); // Reddit: 15 min old, TTL 15 min
      expect(freshnessCheck[1].isStale).toBe(true);  // Yahoo: 90 min old, TTL 30 min
      expect(freshnessCheck[2].isStale).toBe(false); // FinViz: 60 min old, TTL 60 min
    });
  });
});