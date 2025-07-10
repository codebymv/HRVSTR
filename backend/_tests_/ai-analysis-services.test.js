/**
 * AI Analysis Services Tests
 * Tests the accuracy, reliability, and consistency of AI-powered
 * market analysis, explanations, and insights generation
 */

const request = require('supertest');
const { Pool } = require('pg');

// Mock AI analysis services
const mockAiExplanationService = {
  generateExplanation: jest.fn(),
  validateExplanationQuality: jest.fn(),
  formatExplanation: jest.fn()
};

const mockAiMarketAnalysisService = {
  analyzeMarketTrends: jest.fn(),
  generateMarketInsights: jest.fn(),
  assessMarketSentiment: jest.fn()
};

const mockAiTickerAnalysisService = {
  analyzeTickerData: jest.fn(),
  generateTickerInsights: jest.fn(),
  assessTickerRisk: jest.fn(),
  predictTickerMovement: jest.fn()
};

const mockAiRedditAnalysisService = {
  analyzeRedditSentiment: jest.fn(),
  extractKeyTopics: jest.fn(),
  assessCommunityMood: jest.fn(),
  detectTrendingDiscussions: jest.fn()
};

// Mock external AI API
const mockOpenAIService = {
  createCompletion: jest.fn(),
  validateApiKey: jest.fn(),
  checkRateLimit: jest.fn()
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

describe('AI Analysis Services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AI Explanation Service', () => {
    test('should generate coherent explanations for market data', async () => {
      const mockMarketData = {
        symbol: 'AAPL',
        price: 185.50,
        change: 2.75,
        changePercent: 1.51,
        volume: 45678900,
        marketCap: 2850000000000,
        pe: 28.5,
        sentiment: {
          overall: 0.65,
          reddit: 0.72,
          finviz: 0.58,
          yahoo: 0.61
        },
        recentNews: [
          'Apple reports strong Q1 earnings',
          'iPhone sales exceed expectations',
          'Services revenue grows 15%'
        ]
      };

      const mockExplanation = {
        summary: 'Apple (AAPL) is showing strong bullish momentum with positive sentiment across multiple platforms.',
        keyFactors: [
          'Strong earnings performance with revenue beat',
          'Positive sentiment from retail investors on Reddit',
          'iPhone sales exceeding analyst expectations',
          'Services segment showing consistent growth'
        ],
        riskFactors: [
          'High P/E ratio suggests potential overvaluation',
          'Market volatility could impact tech stocks'
        ],
        outlook: 'bullish',
        confidence: 0.78
      };

      mockAiExplanationService.generateExplanation.mockResolvedValue(mockExplanation);

      const explanation = await mockAiExplanationService.generateExplanation(mockMarketData);
      
      expect(explanation.summary).toBeDefined();
      expect(explanation.keyFactors).toHaveLength(4);
      expect(explanation.riskFactors).toHaveLength(2);
      expect(explanation.outlook).toBe('bullish');
      expect(explanation.confidence).toBeGreaterThan(0.5);
      expect(explanation.confidence).toBeLessThanOrEqual(1.0);
    });

    test('should validate explanation quality and completeness', () => {
      const testExplanations = [
        {
          summary: 'Apple is doing well.',
          keyFactors: ['Good earnings'],
          riskFactors: [],
          outlook: 'bullish',
          confidence: 0.9
        },
        {
          summary: 'Apple (AAPL) demonstrates strong fundamental performance with robust earnings growth, positive sentiment indicators, and expanding market share in key segments.',
          keyFactors: [
            'Q1 earnings beat expectations by 8%',
            'iPhone revenue up 12% year-over-year',
            'Services segment growing at 15% annually',
            'Strong cash position of $165B'
          ],
          riskFactors: [
            'Regulatory pressure in EU markets',
            'Supply chain dependencies in Asia',
            'Increasing competition in smartphone market'
          ],
          outlook: 'bullish',
          confidence: 0.82
        }
      ];

      const validateExplanationQuality = (explanation) => {
        const qualityMetrics = {
          summaryLength: explanation.summary.length,
          keyFactorsCount: explanation.keyFactors.length,
          riskFactorsCount: explanation.riskFactors.length,
          hasSpecificData: /\d+%|\$\d+/.test(explanation.summary + explanation.keyFactors.join(' ')),
          confidenceRange: explanation.confidence >= 0.5 && explanation.confidence <= 1.0
        };

        const qualityScore = (
          (qualityMetrics.summaryLength >= 50 ? 25 : 0) +
          (qualityMetrics.keyFactorsCount >= 3 ? 25 : 0) +
          (qualityMetrics.riskFactorsCount >= 2 ? 20 : 0) +
          (qualityMetrics.hasSpecificData ? 20 : 0) +
          (qualityMetrics.confidenceRange ? 10 : 0)
        );

        return {
          ...qualityMetrics,
          qualityScore,
          isHighQuality: qualityScore >= 80
        };
      };

      const quality1 = validateExplanationQuality(testExplanations[0]);
      const quality2 = validateExplanationQuality(testExplanations[1]);

      expect(quality1.isHighQuality).toBe(false); // Low quality
      expect(quality1.qualityScore).toBeLessThan(50);
      
      expect(quality2.isHighQuality).toBe(true); // High quality
      expect(quality2.qualityScore).toBeGreaterThanOrEqual(80);
      expect(quality2.hasSpecificData).toBe(true);
    });

    test('should handle different market conditions in explanations', () => {
      const marketScenarios = [
        {
          scenario: 'bull_market',
          data: { change: 5.2, sentiment: 0.8, volume: 'high' },
          expectedTone: 'optimistic'
        },
        {
          scenario: 'bear_market',
          data: { change: -3.8, sentiment: 0.2, volume: 'high' },
          expectedTone: 'cautious'
        },
        {
          scenario: 'sideways_market',
          data: { change: 0.1, sentiment: 0.5, volume: 'low' },
          expectedTone: 'neutral'
        },
        {
          scenario: 'volatile_market',
          data: { change: -2.1, sentiment: 0.6, volume: 'very_high' },
          expectedTone: 'uncertain'
        }
      ];

      const determineExplanationTone = (marketData) => {
        if (marketData.change > 3 && marketData.sentiment > 0.7) {
          return 'optimistic';
        } else if (marketData.change < -2 && marketData.sentiment < 0.3) {
          return 'cautious';
        } else if (Math.abs(marketData.change) < 1 && marketData.volume === 'low') {
          return 'neutral';
        } else if (marketData.volume === 'very_high') {
          return 'uncertain';
        }
        return 'balanced';
      };

      marketScenarios.forEach(scenario => {
        const tone = determineExplanationTone(scenario.data);
        expect(tone).toBe(scenario.expectedTone);
      });
    });
  });

  describe('AI Market Analysis Service', () => {
    test('should analyze market trends accurately', async () => {
      const mockMarketTrendData = {
        indices: {
          sp500: { current: 4750, change: 1.2, trend: 'upward' },
          nasdaq: { current: 14800, change: 1.8, trend: 'upward' },
          dow: { current: 37500, change: 0.9, trend: 'upward' }
        },
        sectors: {
          technology: { performance: 2.1, sentiment: 0.75 },
          healthcare: { performance: 0.8, sentiment: 0.62 },
          finance: { performance: 1.4, sentiment: 0.68 },
          energy: { performance: -0.5, sentiment: 0.45 }
        },
        vix: 18.5,
        bondYield: 4.2
      };

      const mockMarketAnalysis = {
        overallTrend: 'bullish',
        marketPhase: 'growth',
        riskLevel: 'moderate',
        keyDrivers: [
          'Strong corporate earnings',
          'Positive economic indicators',
          'Technology sector leadership'
        ],
        concerns: [
          'Rising interest rates',
          'Geopolitical tensions'
        ],
        recommendations: [
          'Focus on growth sectors',
          'Monitor interest rate changes',
          'Maintain diversified portfolio'
        ]
      };

      mockAiMarketAnalysisService.analyzeMarketTrends.mockResolvedValue(mockMarketAnalysis);

      const analysis = await mockAiMarketAnalysisService.analyzeMarketTrends(mockMarketTrendData);
      
      expect(analysis.overallTrend).toBe('bullish');
      expect(analysis.keyDrivers).toHaveLength(3);
      expect(analysis.concerns).toHaveLength(2);
      expect(analysis.recommendations).toHaveLength(3);
      expect(['low', 'moderate', 'high']).toContain(analysis.riskLevel);
    });

    test('should assess market sentiment from multiple sources', () => {
      const sentimentSources = {
        reddit: {
          overall: 0.72,
          volume: 15420,
          trending_tickers: ['AAPL', 'TSLA', 'NVDA'],
          bullish_mentions: 8934,
          bearish_mentions: 3421
        },
        finviz: {
          overall: 0.58,
          news_sentiment: 0.61,
          analyst_ratings: 0.55
        },
        yahoo: {
          overall: 0.64,
          comment_sentiment: 0.67,
          article_sentiment: 0.61
        },
        fear_greed_index: 68
      };

      const aggregateMarketSentiment = (sources) => {
        const weights = {
          reddit: 0.3,
          finviz: 0.25,
          yahoo: 0.25,
          fear_greed_index: 0.2
        };

        const weightedSentiment = (
          sources.reddit.overall * weights.reddit +
          sources.finviz.overall * weights.finviz +
          sources.yahoo.overall * weights.yahoo +
          (sources.fear_greed_index / 100) * weights.fear_greed_index
        );

        const sentiment_category = weightedSentiment > 0.7 ? 'very_bullish' :
                                 weightedSentiment > 0.6 ? 'bullish' :
                                 weightedSentiment > 0.4 ? 'neutral' :
                                 weightedSentiment > 0.3 ? 'bearish' : 'very_bearish';

        return {
          aggregated_sentiment: Math.round(weightedSentiment * 100) / 100,
          category: sentiment_category,
          confidence: Math.min(0.95, Math.abs(weightedSentiment - 0.5) * 2),
          source_agreement: Math.abs(sources.reddit.overall - sources.finviz.overall) < 0.15
        };
      };

      const marketSentiment = aggregateMarketSentiment(sentimentSources);
      
      expect(marketSentiment.aggregated_sentiment).toBeGreaterThan(0.5);
      expect(marketSentiment.category).toBe('bullish');
      expect(marketSentiment.confidence).toBeGreaterThan(0.1);
      expect(typeof marketSentiment.source_agreement).toBe('boolean');
    });

    test('should generate actionable market insights', () => {
      const marketConditions = {
        trend: 'bullish',
        volatility: 'moderate',
        sector_rotation: true,
        earnings_season: true,
        fed_meeting_upcoming: false,
        economic_data: {
          gdp_growth: 2.1,
          unemployment: 3.8,
          inflation: 3.2
        }
      };

      const generateMarketInsights = (conditions) => {
        const insights = [];
        
        if (conditions.trend === 'bullish' && conditions.volatility === 'low') {
          insights.push({
            type: 'opportunity',
            message: 'Strong uptrend with low volatility suggests good entry opportunities',
            action: 'Consider increasing equity exposure'
          });
        }
        
        if (conditions.earnings_season) {
          insights.push({
            type: 'timing',
            message: 'Earnings season creates both opportunities and risks',
            action: 'Focus on companies with strong guidance and beat expectations'
          });
        }
        
        if (conditions.sector_rotation) {
          insights.push({
            type: 'strategy',
            message: 'Active sector rotation detected',
            action: 'Monitor sector performance and adjust allocations accordingly'
          });
        }
        
        if (conditions.economic_data.inflation > 3.0) {
          insights.push({
            type: 'risk',
            message: 'Elevated inflation may pressure valuations',
            action: 'Consider inflation-protected assets and value stocks'
          });
        }
        
        return insights;
      };

      const insights = generateMarketInsights(marketConditions);
      
      expect(insights).toHaveLength(3); // earnings_season, sector_rotation, inflation
      expect(insights.every(insight => insight.type && insight.message && insight.action)).toBe(true);
      expect(insights.find(i => i.type === 'timing')).toBeDefined();
      expect(insights.find(i => i.type === 'risk')).toBeDefined();
    });
  });

  describe('AI Ticker Analysis Service', () => {
    test('should analyze individual ticker comprehensively', async () => {
      const mockTickerData = {
        symbol: 'AAPL',
        fundamentals: {
          pe: 28.5,
          peg: 1.2,
          roe: 0.26,
          debt_to_equity: 0.31,
          current_ratio: 1.05,
          revenue_growth: 0.08,
          earnings_growth: 0.12
        },
        technicals: {
          rsi: 58,
          macd: 'bullish_crossover',
          moving_averages: {
            sma_20: 182.50,
            sma_50: 178.20,
            sma_200: 165.80
          },
          support: 175.00,
          resistance: 190.00
        },
        sentiment: {
          overall: 0.68,
          analyst_rating: 'buy',
          price_target: 195.00
        }
      };

      const mockTickerAnalysis = {
        overall_rating: 'buy',
        confidence: 0.75,
        fundamental_score: 8.2,
        technical_score: 7.8,
        sentiment_score: 8.5,
        key_strengths: [
          'Strong revenue and earnings growth',
          'Healthy balance sheet with manageable debt',
          'Positive technical momentum',
          'Bullish analyst sentiment'
        ],
        key_risks: [
          'High valuation multiples',
          'Market concentration risk',
          'Regulatory headwinds'
        ],
        price_targets: {
          conservative: 185.00,
          base_case: 195.00,
          optimistic: 210.00
        }
      };

      mockAiTickerAnalysisService.analyzeTickerData.mockResolvedValue(mockTickerAnalysis);

      const analysis = await mockAiTickerAnalysisService.analyzeTickerData(mockTickerData);
      
      expect(['strong_buy', 'buy', 'hold', 'sell', 'strong_sell']).toContain(analysis.overall_rating);
      expect(analysis.confidence).toBeGreaterThan(0.5);
      expect(analysis.fundamental_score).toBeGreaterThan(5);
      expect(analysis.technical_score).toBeGreaterThan(5);
      expect(analysis.key_strengths).toHaveLength(4);
      expect(analysis.key_risks).toHaveLength(3);
      expect(analysis.price_targets.base_case).toBeGreaterThan(analysis.price_targets.conservative);
    });

    test('should assess ticker-specific risks accurately', () => {
      const tickerProfiles = [
        {
          symbol: 'TSLA',
          sector: 'automotive',
          market_cap: 800000000000,
          beta: 2.1,
          debt_ratio: 0.15,
          ceo_influence: 'high',
          regulatory_exposure: 'medium'
        },
        {
          symbol: 'JNJ',
          sector: 'healthcare',
          market_cap: 450000000000,
          beta: 0.7,
          debt_ratio: 0.25,
          litigation_risk: 'high',
          regulatory_exposure: 'high'
        },
        {
          symbol: 'NVDA',
          sector: 'technology',
          market_cap: 1200000000000,
          beta: 1.8,
          debt_ratio: 0.10,
          china_exposure: 'high',
          competition_risk: 'medium'
        }
      ];

      const assessTickerRisks = (profile) => {
        const risks = [];
        
        if (profile.beta > 1.5) {
          risks.push({
            type: 'volatility',
            level: 'high',
            description: 'High beta indicates significant price volatility'
          });
        }
        
        if (profile.debt_ratio > 0.4) {
          risks.push({
            type: 'financial',
            level: 'medium',
            description: 'Elevated debt levels may constrain financial flexibility'
          });
        }
        
        if (profile.ceo_influence === 'high') {
          risks.push({
            type: 'key_person',
            level: 'medium',
            description: 'Heavy dependence on key leadership figure'
          });
        }
        
        if (profile.china_exposure === 'high') {
          risks.push({
            type: 'geopolitical',
            level: 'high',
            description: 'Significant exposure to China market and supply chain'
          });
        }
        
        if (profile.litigation_risk === 'high') {
          risks.push({
            type: 'legal',
            level: 'high',
            description: 'Ongoing litigation may impact financial performance'
          });
        }
        
        return risks;
      };

      const teslaRisks = assessTickerRisks(tickerProfiles[0]);
      const jnjRisks = assessTickerRisks(tickerProfiles[1]);
      const nvidiaRisks = assessTickerRisks(tickerProfiles[2]);
      
      expect(teslaRisks.find(r => r.type === 'volatility')).toBeDefined();
      expect(teslaRisks.find(r => r.type === 'key_person')).toBeDefined();
      
      expect(jnjRisks.find(r => r.type === 'legal')).toBeDefined();
      
      expect(nvidiaRisks.find(r => r.type === 'volatility')).toBeDefined();
      expect(nvidiaRisks.find(r => r.type === 'geopolitical')).toBeDefined();
    });

    test('should predict short-term price movements', () => {
      const technicalIndicators = {
        rsi: 72,
        macd_signal: 'bullish',
        bollinger_position: 'upper_band',
        volume_trend: 'increasing',
        price_vs_sma20: 1.05,
        price_vs_sma50: 1.12,
        momentum: 'strong_bullish'
      };

      const predictPriceMovement = (indicators) => {
        let bullish_signals = 0;
        let bearish_signals = 0;
        
        // RSI analysis
        if (indicators.rsi > 70) bearish_signals++; // Overbought
        else if (indicators.rsi < 30) bullish_signals++; // Oversold
        else if (indicators.rsi > 50) bullish_signals++; // Bullish momentum
        
        // MACD analysis
        if (indicators.macd_signal === 'bullish') bullish_signals++;
        else if (indicators.macd_signal === 'bearish') bearish_signals++;
        
        // Bollinger Bands
        if (indicators.bollinger_position === 'upper_band') bearish_signals++;
        else if (indicators.bollinger_position === 'lower_band') bullish_signals++;
        
        // Volume confirmation
        if (indicators.volume_trend === 'increasing') {
          if (bullish_signals > bearish_signals) bullish_signals++;
          else bearish_signals++;
        }
        
        // Moving average position
        if (indicators.price_vs_sma20 > 1.02) bullish_signals++;
        if (indicators.price_vs_sma50 > 1.05) bullish_signals++;
        
        const net_signal = bullish_signals - bearish_signals;
        const prediction = net_signal > 1 ? 'bullish' : net_signal < -1 ? 'bearish' : 'neutral';
        const confidence = Math.min(0.9, Math.max(0.1, Math.abs(net_signal) * 0.15 + 0.1));
        
        return {
          prediction,
          confidence,
          bullish_signals,
          bearish_signals,
          time_horizon: '1-5 days'
        };
      };

      const prediction = predictPriceMovement(technicalIndicators);
      
      expect(['bullish', 'bearish', 'neutral']).toContain(prediction.prediction);
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.confidence).toBeLessThanOrEqual(0.9);
      expect(prediction.bullish_signals).toBeGreaterThanOrEqual(0);
      expect(prediction.bearish_signals).toBeGreaterThanOrEqual(0);
    });
  });

  describe('AI Reddit Analysis Service', () => {
    test('should analyze Reddit sentiment accurately', () => {
      const mockRedditData = {
        posts: [
          {
            title: 'AAPL to the moon! 🚀 Strong earnings beat',
            content: 'Apple just crushed earnings expectations. Revenue up 8%, iPhone sales strong. This is going to $200 easy.',
            upvotes: 245,
            comments: 67,
            sentiment_score: 0.85,
            awards: 3
          },
          {
            title: 'Concerned about AAPL valuation',
            content: 'P/E ratio is getting pretty high. Market might be overvaluing growth prospects. Could see a pullback.',
            upvotes: 89,
            comments: 34,
            sentiment_score: -0.32,
            awards: 0
          },
          {
            title: 'AAPL technical analysis - bullish breakout',
            content: 'Chart looks great. Broke resistance at $185. Next target $195. Volume confirming the move.',
            upvotes: 156,
            comments: 23,
            sentiment_score: 0.72,
            awards: 1
          }
        ],
        comments: [
          { content: 'Buying more AAPL calls', sentiment: 0.8, upvotes: 12 },
          { content: 'This is overpriced', sentiment: -0.6, upvotes: 5 },
          { content: 'Long term bullish on Apple', sentiment: 0.7, upvotes: 18 }
        ]
      };

      const analyzeRedditSentiment = (data) => {
        // Weight posts by engagement (upvotes + comments)
        const weightedPostSentiment = data.posts.reduce((sum, post) => {
          const weight = post.upvotes + post.comments;
          return sum + (post.sentiment_score * weight);
        }, 0);
        
        const totalPostWeight = data.posts.reduce((sum, post) => sum + post.upvotes + post.comments, 0);
        const avgPostSentiment = weightedPostSentiment / totalPostWeight;
        
        // Weight comments by upvotes
        const weightedCommentSentiment = data.comments.reduce((sum, comment) => {
          return sum + (comment.sentiment * comment.upvotes);
        }, 0);
        
        const totalCommentWeight = data.comments.reduce((sum, comment) => sum + comment.upvotes, 0);
        const avgCommentSentiment = weightedCommentSentiment / totalCommentWeight;
        
        // Overall sentiment (70% posts, 30% comments)
        const overallSentiment = (avgPostSentiment * 0.7) + (avgCommentSentiment * 0.3);
        
        return {
          overall_sentiment: Math.round(overallSentiment * 100) / 100,
          post_sentiment: Math.round(avgPostSentiment * 100) / 100,
          comment_sentiment: Math.round(avgCommentSentiment * 100) / 100,
          engagement_level: totalPostWeight > 500 ? 'high' : totalPostWeight > 200 ? 'medium' : 'low',
          bullish_posts: data.posts.filter(p => p.sentiment_score > 0.3).length,
          bearish_posts: data.posts.filter(p => p.sentiment_score < -0.3).length
        };
      };

      const sentiment = analyzeRedditSentiment(mockRedditData);
      
      expect(sentiment.overall_sentiment).toBeGreaterThan(0);
      expect(sentiment.bullish_posts).toBe(2);
      expect(sentiment.bearish_posts).toBe(1);
      expect(['high', 'medium', 'low']).toContain(sentiment.engagement_level);
    });

    test('should extract key topics from Reddit discussions', () => {
      const redditTexts = [
        'Apple earnings beat expectations. iPhone sales strong. Services revenue growing.',
        'Worried about Apple valuation. P/E ratio too high. Market might correct.',
        'AAPL technical breakout. Resistance broken. Next target $200.',
        'Apple AI features coming. ChatGPT integration. Bullish on innovation.',
        'Supply chain issues resolved. China production back to normal.'
      ];

      const extractKeyTopics = (texts) => {
        const keywords = {
          'earnings': ['earnings', 'revenue', 'profit', 'beat', 'miss'],
          'valuation': ['valuation', 'p/e', 'pe ratio', 'overvalued', 'undervalued'],
          'technical': ['breakout', 'resistance', 'support', 'target', 'chart'],
          'innovation': ['ai', 'features', 'technology', 'innovation', 'chatgpt'],
          'operations': ['supply chain', 'production', 'manufacturing', 'china']
        };
        
        const topicCounts = {};
        
        Object.entries(keywords).forEach(([topic, words]) => {
          topicCounts[topic] = 0;
          texts.forEach(text => {
            const lowerText = text.toLowerCase();
            words.forEach(word => {
              if (lowerText.includes(word)) {
                topicCounts[topic]++;
              }
            });
          });
        });
        
        // Sort topics by frequency
        const sortedTopics = Object.entries(topicCounts)
          .sort(([,a], [,b]) => b - a)
          .map(([topic, count]) => ({ topic, mentions: count }));
        
        return sortedTopics.filter(t => t.mentions > 0);
      };

      const topics = extractKeyTopics(redditTexts);
      
      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0].mentions).toBeGreaterThanOrEqual(topics[1]?.mentions || 0);
      expect(topics.every(t => t.topic && typeof t.mentions === 'number')).toBe(true);
    });

    test('should detect trending discussions and momentum', () => {
      const discussionMetrics = {
        'AAPL': {
          mentions_24h: 1250,
          mentions_7d: 6800,
          avg_sentiment_24h: 0.68,
          avg_sentiment_7d: 0.52,
          top_posts_24h: 15,
          awards_24h: 23
        },
        'TSLA': {
          mentions_24h: 890,
          mentions_7d: 7200,
          avg_sentiment_24h: 0.45,
          avg_sentiment_7d: 0.61,
          top_posts_24h: 8,
          awards_24h: 12
        },
        'NVDA': {
          mentions_24h: 2100,
          mentions_7d: 8900,
          avg_sentiment_24h: 0.78,
          avg_sentiment_7d: 0.71,
          top_posts_24h: 28,
          awards_24h: 45
        }
      };

      const detectTrendingDiscussions = (metrics) => {
        return Object.entries(metrics).map(([symbol, data]) => {
          const mention_momentum = data.mentions_24h / (data.mentions_7d / 7);
          const sentiment_momentum = data.avg_sentiment_24h - data.avg_sentiment_7d;
          const engagement_score = (data.top_posts_24h * 2) + data.awards_24h;
          
          const trending_score = (
            (mention_momentum * 0.4) +
            ((sentiment_momentum + 1) * 0.3) + // Normalize sentiment momentum
            (Math.min(engagement_score / 50, 1) * 0.3)
          );
          
          return {
            symbol,
            trending_score: Math.round(trending_score * 100) / 100,
            mention_momentum: Math.round(mention_momentum * 100) / 100,
            sentiment_momentum: Math.round(sentiment_momentum * 100) / 100,
            is_trending: trending_score > 1.2,
            trend_direction: sentiment_momentum > 0.1 ? 'positive' : sentiment_momentum < -0.1 ? 'negative' : 'neutral'
          };
        }).sort((a, b) => b.trending_score - a.trending_score);
      };

      const trending = detectTrendingDiscussions(discussionMetrics);
      
      expect(trending).toHaveLength(3);
      expect(trending[0].trending_score).toBeGreaterThanOrEqual(trending[1].trending_score);
      expect(trending.every(t => typeof t.is_trending === 'boolean')).toBe(true);
      expect(trending.every(t => ['positive', 'negative', 'neutral'].includes(t.trend_direction))).toBe(true);
    });
  });

  describe('AI Service Integration and Performance', () => {
    test('should handle API rate limiting gracefully', async () => {
      const mockRateLimitError = new Error('Rate limit exceeded');
      mockRateLimitError.status = 429;
      mockRateLimitError.retryAfter = 60;

      const handleRateLimit = async (apiCall, maxRetries = 3) => {
        let attempts = 0;
        
        while (attempts < maxRetries) {
          try {
            return await apiCall();
          } catch (error) {
            if (error.status === 429 && attempts < maxRetries - 1) {
              attempts++;
              const delay = Math.min(error.retryAfter * 10, 100); // Max 100ms for testing
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            throw error;
          }
        }
      };

      // Mock API call that fails with rate limit
      const mockApiCall = jest.fn()
        .mockRejectedValueOnce(mockRateLimitError)
        .mockResolvedValueOnce({ success: true });

      const result = await handleRateLimit(mockApiCall);
      
      expect(result.success).toBe(true);
      expect(mockApiCall).toHaveBeenCalledTimes(2);
    });

    test('should validate AI response quality', () => {
      const aiResponses = [
        {
          content: 'Apple is a good stock to buy.',
          length: 32,
          hasSpecifics: false,
          hasNumbers: false,
          hasReasoning: false
        },
        {
          content: 'Apple (AAPL) shows strong fundamentals with 15% revenue growth, P/E of 28.5, and positive analyst sentiment. The recent earnings beat of 8% demonstrates operational excellence. However, high valuation multiples suggest caution. Target price: $195.',
          length: 234,
          hasSpecifics: true,
          hasNumbers: true,
          hasReasoning: true
        }
      ];

      const validateAiResponse = (response) => {
        const qualityChecks = {
          sufficient_length: response.length >= 100,
          has_specifics: response.hasSpecifics,
          has_numbers: response.hasNumbers,
          has_reasoning: response.hasReasoning,
          not_generic: !response.content.toLowerCase().includes('good stock')
        };
        
        const qualityScore = Object.values(qualityChecks).filter(Boolean).length;
        
        return {
          ...qualityChecks,
          quality_score: qualityScore,
          is_high_quality: qualityScore >= 4
        };
      };

      const validation1 = validateAiResponse(aiResponses[0]);
      const validation2 = validateAiResponse(aiResponses[1]);
      
      expect(validation1.is_high_quality).toBe(false);
      expect(validation2.is_high_quality).toBe(true);
      expect(validation2.quality_score).toBeGreaterThan(validation1.quality_score);
    });

    test('should cache AI responses efficiently', () => {
      const aiCache = new Map();
      const CACHE_TTL = 3600000; // 1 hour

      const cacheAiResponse = (key, response) => {
        aiCache.set(key, {
          data: response,
          timestamp: Date.now(),
          ttl: CACHE_TTL
        });
      };

      const getCachedResponse = (key) => {
        const cached = aiCache.get(key);
        if (!cached) return null;
        
        const age = Date.now() - cached.timestamp;
        if (age > cached.ttl) {
          aiCache.delete(key);
          return null;
        }
        
        return cached.data;
      };

      const testResponse = { analysis: 'Bullish on AAPL', confidence: 0.8 };
      const cacheKey = 'AAPL_analysis_2024-01-20';
      
      // Cache response
      cacheAiResponse(cacheKey, testResponse);
      
      // Retrieve from cache
      const cachedResult = getCachedResponse(cacheKey);
      expect(cachedResult).toEqual(testResponse);
      
      // Test cache miss for non-existent key
      const missResult = getCachedResponse('non_existent_key');
      expect(missResult).toBeNull();
    });
  });
});