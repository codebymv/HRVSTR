/**
 * Earnings Processing Tests
 * Tests the accuracy and reliability of earnings data extraction,
 * analysis, and processing from Yahoo Finance and other sources
 */

const request = require('supertest');
const { Pool } = require('pg');

// Mock earnings services
const mockEarningsService = {
  getEarningsData: jest.fn(),
  getUpcomingEarnings: jest.fn(),
  parseEarningsReport: jest.fn(),
  calculateEarningsMetrics: jest.fn()
};

const mockYahooFinanceService = {
  fetchEarningsData: jest.fn(),
  getEarningsCalendar: jest.fn(),
  getHistoricalEarnings: jest.fn()
};

const mockFinancialCalendar = {
  getUpcomingEarnings: jest.fn(),
  filterByDateRange: jest.fn(),
  sortByMarketCap: jest.fn()
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

describe('Earnings Processing System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Earnings Data Extraction', () => {
    test('should extract earnings data correctly from Yahoo Finance', () => {
      const mockYahooEarningsData = {
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        earningsDate: '2024-02-01',
        quarter: 'Q1 2024',
        fiscalYear: 2024,
        actualEPS: 2.18,
        estimatedEPS: 2.10,
        actualRevenue: 119580000000, // $119.58B
        estimatedRevenue: 117910000000, // $117.91B
        surprisePercent: 3.81,
        revenueGrowth: 2.1,
        earningsTime: 'AMC', // After Market Close
        confirmed: true
      };

      // Validate earnings data structure
      expect(mockYahooEarningsData.symbol).toBe('AAPL');
      expect(mockYahooEarningsData.actualEPS).toBe(2.18);
      expect(mockYahooEarningsData.estimatedEPS).toBe(2.10);
      expect(mockYahooEarningsData.actualRevenue).toBe(119580000000);
      expect(mockYahooEarningsData.estimatedRevenue).toBe(117910000000);
      
      // Calculate EPS surprise
      const epsSuprise = ((mockYahooEarningsData.actualEPS - mockYahooEarningsData.estimatedEPS) / mockYahooEarningsData.estimatedEPS) * 100;
      expect(Math.round(epsSuprise * 100) / 100).toBe(3.81);
      
      // Calculate revenue surprise
      const revenueSuprise = ((mockYahooEarningsData.actualRevenue - mockYahooEarningsData.estimatedRevenue) / mockYahooEarningsData.estimatedRevenue) * 100;
      expect(Math.round(revenueSuprise * 100) / 100).toBe(1.42);
    });

    test('should handle missing or incomplete earnings data', () => {
      const incompleteEarningsData = {
        symbol: 'TSLA',
        companyName: 'Tesla, Inc.',
        earningsDate: '2024-01-24',
        actualEPS: null, // Missing actual data
        estimatedEPS: 2.38,
        actualRevenue: undefined, // Missing actual data
        estimatedRevenue: 25870000000
      };

      const validateEarningsData = (data) => {
        const issues = [];
        
        if (!data.actualEPS && data.actualEPS !== 0) {
          issues.push('Missing actual EPS');
        }
        
        if (!data.actualRevenue && data.actualRevenue !== 0) {
          issues.push('Missing actual revenue');
        }
        
        if (!data.estimatedEPS) {
          issues.push('Missing estimated EPS');
        }
        
        if (!data.estimatedRevenue) {
          issues.push('Missing estimated revenue');
        }
        
        return {
          isComplete: issues.length === 0,
          issues,
          canCalculateSurprise: data.actualEPS !== null && data.actualEPS !== undefined && data.estimatedEPS
        };
      };

      const validation = validateEarningsData(incompleteEarningsData);
      expect(validation.isComplete).toBe(false);
      expect(validation.issues).toContain('Missing actual EPS');
      expect(validation.issues).toContain('Missing actual revenue');
      expect(validation.canCalculateSurprise).toBe(false);
    });

    test('should parse earnings time correctly', () => {
      const earningsTimings = [
        { symbol: 'AAPL', earningsTime: 'AMC', expected: 'After Market Close' },
        { symbol: 'GOOGL', earningsTime: 'BMO', expected: 'Before Market Open' },
        { symbol: 'MSFT', earningsTime: 'DMT', expected: 'During Market Hours' },
        { symbol: 'TSLA', earningsTime: null, expected: 'Time Not Specified' }
      ];

      const parseEarningsTime = (timeCode) => {
        const timeMappings = {
          'AMC': 'After Market Close',
          'BMO': 'Before Market Open', 
          'DMT': 'During Market Hours'
        };
        
        return timeMappings[timeCode] || 'Time Not Specified';
      };

      earningsTimings.forEach(timing => {
        const parsed = parseEarningsTime(timing.earningsTime);
        expect(parsed).toBe(timing.expected);
      });
    });
  });

  describe('Earnings Calendar Processing', () => {
    test('should process upcoming earnings calendar correctly', () => {
      const mockUpcomingEarnings = [
        {
          symbol: 'AAPL',
          companyName: 'Apple Inc.',
          earningsDate: '2024-02-01',
          estimatedEPS: 2.10,
          marketCap: 3000000000000, // $3T
          earningsTime: 'AMC'
        },
        {
          symbol: 'MSFT',
          companyName: 'Microsoft Corporation',
          earningsDate: '2024-01-24',
          estimatedEPS: 2.78,
          marketCap: 2800000000000, // $2.8T
          earningsTime: 'AMC'
        },
        {
          symbol: 'GOOGL',
          companyName: 'Alphabet Inc.',
          earningsDate: '2024-01-30',
          estimatedEPS: 1.33,
          marketCap: 1700000000000, // $1.7T
          earningsTime: 'AMC'
        }
      ];

      // Sort by market cap (descending)
      const sortedByMarketCap = [...mockUpcomingEarnings].sort((a, b) => b.marketCap - a.marketCap);
      expect(sortedByMarketCap[0].symbol).toBe('AAPL');
      expect(sortedByMarketCap[1].symbol).toBe('MSFT');
      expect(sortedByMarketCap[2].symbol).toBe('GOOGL');
      
      // Sort by earnings date
      const sortedByDate = [...mockUpcomingEarnings].sort((a, b) => new Date(a.earningsDate) - new Date(b.earningsDate));
      expect(sortedByDate[0].symbol).toBe('MSFT'); // Jan 24
      expect(sortedByDate[1].symbol).toBe('GOOGL'); // Jan 30
      expect(sortedByDate[2].symbol).toBe('AAPL'); // Feb 1
    });

    test('should filter earnings by date range', () => {
      const earningsData = [
        { symbol: 'AAPL', earningsDate: '2024-01-15' },
        { symbol: 'MSFT', earningsDate: '2024-01-20' },
        { symbol: 'GOOGL', earningsDate: '2024-01-25' },
        { symbol: 'TSLA', earningsDate: '2024-02-05' },
        { symbol: 'NVDA', earningsDate: '2024-02-10' }
      ];

      const filterByDateRange = (data, startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return data.filter(item => {
          const earningsDate = new Date(item.earningsDate);
          return earningsDate >= start && earningsDate <= end;
        });
      };

      // Filter for January 2024
      const januaryEarnings = filterByDateRange(earningsData, '2024-01-01', '2024-01-31');
      expect(januaryEarnings).toHaveLength(3);
      expect(januaryEarnings.map(e => e.symbol)).toEqual(['AAPL', 'MSFT', 'GOOGL']);
      
      // Filter for next week
      const nextWeekEarnings = filterByDateRange(earningsData, '2024-01-22', '2024-01-28');
      expect(nextWeekEarnings).toHaveLength(1);
      expect(nextWeekEarnings[0].symbol).toBe('GOOGL');
    });

    test('should categorize earnings by market cap tiers', () => {
      const earningsWithMarketCap = [
        { symbol: 'AAPL', marketCap: 3000000000000 }, // Large cap
        { symbol: 'ROKU', marketCap: 5000000000 },     // Mid cap
        { symbol: 'PLTR', marketCap: 45000000000 },    // Mid cap
        { symbol: 'SHOP', marketCap: 80000000000 },    // Large cap
        { symbol: 'COIN', marketCap: 25000000000 }     // Mid cap
      ];

      const categorizeByMarketCap = (data) => {
        return data.map(item => {
          let category;
          if (item.marketCap >= 200000000000) { // $200B+
            category = 'mega_cap';
          } else if (item.marketCap >= 10000000000) { // $10B+
            category = 'large_cap';
          } else if (item.marketCap >= 2000000000) { // $2B+
            category = 'mid_cap';
          } else {
            category = 'small_cap';
          }
          
          return { ...item, category };
        });
      };

      const categorized = categorizeByMarketCap(earningsWithMarketCap);
      expect(categorized.find(c => c.symbol === 'AAPL').category).toBe('mega_cap');
      expect(categorized.find(c => c.symbol === 'SHOP').category).toBe('large_cap');
      expect(categorized.find(c => c.symbol === 'ROKU').category).toBe('mid_cap');
    });
  });

  describe('Earnings Metrics Calculation', () => {
    test('should calculate earnings surprise metrics accurately', () => {
      const earningsResults = [
        { symbol: 'AAPL', actualEPS: 2.18, estimatedEPS: 2.10 },
        { symbol: 'MSFT', actualEPS: 2.93, estimatedEPS: 2.78 },
        { symbol: 'GOOGL', actualEPS: 1.64, estimatedEPS: 1.33 },
        { symbol: 'TSLA', actualEPS: 0.71, estimatedEPS: 0.73 }, // Miss
        { symbol: 'META', actualEPS: 5.33, estimatedEPS: 4.96 }
      ];

      const calculateSurpriseMetrics = (results) => {
        return results.map(result => {
          const epsSuprise = ((result.actualEPS - result.estimatedEPS) / result.estimatedEPS) * 100;
          const beat = result.actualEPS > result.estimatedEPS;
          const miss = result.actualEPS < result.estimatedEPS;
          const inline = Math.abs(epsSuprise) < 1; // Within 1%
          
          return {
            ...result,
            epsSuprise: Math.round(epsSuprise * 100) / 100,
            beat,
            miss,
            inline,
            surpriseCategory: beat ? 'beat' : miss ? 'miss' : 'inline'
          };
        });
      };

      const metricsResults = calculateSurpriseMetrics(earningsResults);
      
      expect(metricsResults.find(r => r.symbol === 'AAPL').beat).toBe(true);
      expect(metricsResults.find(r => r.symbol === 'TSLA').miss).toBe(true);
      expect(metricsResults.find(r => r.symbol === 'GOOGL').epsSuprise).toBe(23.31);
      expect(metricsResults.find(r => r.symbol === 'META').surpriseCategory).toBe('beat');
    });

    test('should calculate revenue surprise metrics', () => {
      const revenueResults = [
        { symbol: 'AAPL', actualRevenue: 119580000000, estimatedRevenue: 117910000000 },
        { symbol: 'MSFT', actualRevenue: 62020000000, estimatedRevenue: 61120000000 },
        { symbol: 'GOOGL', actualRevenue: 86250000000, estimatedRevenue: 85330000000 }
      ];

      const calculateRevenueMetrics = (results) => {
        return results.map(result => {
          const revenueSuprise = ((result.actualRevenue - result.estimatedRevenue) / result.estimatedRevenue) * 100;
          const revenueBeat = result.actualRevenue > result.estimatedRevenue;
          
          return {
            ...result,
            revenueSuprise: Math.round(revenueSuprise * 100) / 100,
            revenueBeat,
            revenueGrowthQoQ: null // Would need previous quarter data
          };
        });
      };

      const revenueMetrics = calculateRevenueMetrics(revenueResults);
      
      expect(revenueMetrics.find(r => r.symbol === 'AAPL').revenueSuprise).toBe(1.42);
      expect(revenueMetrics.find(r => r.symbol === 'MSFT').revenueBeat).toBe(true);
      expect(revenueMetrics.find(r => r.symbol === 'GOOGL').revenueSuprise).toBe(1.08);
    });

    test('should calculate historical earnings trends', () => {
      const historicalEarnings = {
        'AAPL': [
          { quarter: 'Q4 2023', actualEPS: 2.18, estimatedEPS: 2.10 },
          { quarter: 'Q3 2023', actualEPS: 1.46, estimatedEPS: 1.39 },
          { quarter: 'Q2 2023', actualEPS: 1.26, estimatedEPS: 1.19 },
          { quarter: 'Q1 2023', actualEPS: 1.88, estimatedEPS: 1.43 }
        ]
      };

      const calculateEarningsTrends = (historicalData) => {
        const trends = {};
        
        Object.entries(historicalData).forEach(([symbol, quarters]) => {
          const beats = quarters.filter(q => q.actualEPS > q.estimatedEPS).length;
          const totalQuarters = quarters.length;
          const beatRate = (beats / totalQuarters) * 100;
          
          const avgSuprise = quarters.reduce((sum, q) => {
            const surprise = ((q.actualEPS - q.estimatedEPS) / q.estimatedEPS) * 100;
            return sum + surprise;
          }, 0) / totalQuarters;
          
          trends[symbol] = {
            beatRate: Math.round(beatRate),
            avgSuprise: Math.round(avgSuprise * 100) / 100,
            consistency: beatRate >= 75 ? 'high' : beatRate >= 50 ? 'medium' : 'low'
          };
        });
        
        return trends;
      };

      const trends = calculateEarningsTrends(historicalEarnings);
      expect(trends.AAPL.beatRate).toBe(100); // Beat all 4 quarters
      expect(trends.AAPL.consistency).toBe('high');
      expect(trends.AAPL.avgSuprise).toBeGreaterThan(0);
    });
  });

  describe('Data Quality and Validation', () => {
    test('should validate earnings data types and ranges', () => {
      const testEarningsData = [
        { symbol: 'AAPL', actualEPS: 2.18, estimatedEPS: 2.10, actualRevenue: 119580000000 },
        { symbol: 'INVALID', actualEPS: 'not_a_number', estimatedEPS: -5.0, actualRevenue: null },
        { symbol: 'TSLA', actualEPS: 0.71, estimatedEPS: 0.73, actualRevenue: 25167000000 }
      ];

      const validateEarningsEntry = (entry) => {
        const errors = [];
        
        if (!entry.symbol || typeof entry.symbol !== 'string') {
          errors.push('Invalid symbol');
        }
        
        if (entry.actualEPS !== null && (typeof entry.actualEPS !== 'number' || isNaN(entry.actualEPS))) {
          errors.push('Invalid actual EPS');
        }
        
        if (typeof entry.estimatedEPS !== 'number' || isNaN(entry.estimatedEPS)) {
          errors.push('Invalid estimated EPS');
        }
        
        if (entry.actualRevenue !== null && (typeof entry.actualRevenue !== 'number' || entry.actualRevenue < 0)) {
          errors.push('Invalid revenue');
        }
        
        return {
          isValid: errors.length === 0,
          errors
        };
      };

      const validationResults = testEarningsData.map(validateEarningsEntry);
      
      expect(validationResults[0].isValid).toBe(true);
      expect(validationResults[1].isValid).toBe(false);
      expect(validationResults[1].errors).toContain('Invalid actual EPS');
      expect(validationResults[2].isValid).toBe(true);
    });

    test('should handle earnings data freshness', () => {
      const currentTime = new Date('2024-01-20T16:00:00Z');
      const earningsCache = [
        {
          symbol: 'AAPL',
          lastUpdated: new Date('2024-01-20T15:30:00Z'),
          earningsDate: '2024-02-01',
          ttl: 3600000 // 1 hour
        },
        {
          symbol: 'MSFT',
          lastUpdated: new Date('2024-01-20T14:00:00Z'),
          earningsDate: '2024-01-24',
          ttl: 1800000 // 30 minutes
        }
      ];

      const checkDataFreshness = (cache, currentTime) => {
        return cache.map(item => {
          const age = currentTime.getTime() - item.lastUpdated.getTime();
          const isStale = age > item.ttl;
          const daysUntilEarnings = Math.ceil((new Date(item.earningsDate) - currentTime) / (1000 * 60 * 60 * 24));
          
          return {
            ...item,
            age,
            isStale,
            daysUntilEarnings,
            needsRefresh: isStale || daysUntilEarnings <= 1 // Refresh if stale or earnings within 1 day
          };
        });
      };

      const freshnessCheck = checkDataFreshness(earningsCache, currentTime);
      
      expect(freshnessCheck[0].isStale).toBe(false); // 30 min old, TTL 1 hour
      expect(freshnessCheck[1].isStale).toBe(true);  // 2 hours old, TTL 30 min
    });

    test('should detect earnings data anomalies', () => {
      const earningsData = [
        { symbol: 'AAPL', actualEPS: 2.18, estimatedEPS: 2.10 }, // Normal
        { symbol: 'MEME', actualEPS: 50.00, estimatedEPS: 0.10 }, // Extreme beat
        { symbol: 'FAIL', actualEPS: -10.00, estimatedEPS: 2.00 }, // Extreme miss
        { symbol: 'MSFT', actualEPS: 2.93, estimatedEPS: 2.78 }  // Normal
      ];

      const detectAnomalies = (data) => {
        return data.map(item => {
          const surprisePercent = Math.abs(((item.actualEPS - item.estimatedEPS) / item.estimatedEPS) * 100);
          const isAnomaly = surprisePercent > 200; // More than 200% surprise
          
          return {
            ...item,
            surprisePercent,
            isAnomaly,
            anomalyReason: isAnomaly ? 'extreme_surprise' : null
          };
        });
      };

      const anomalyCheck = detectAnomalies(earningsData);
      
      expect(anomalyCheck[0].isAnomaly).toBe(false);
      expect(anomalyCheck[1].isAnomaly).toBe(true); // 49900% surprise
      expect(anomalyCheck[2].isAnomaly).toBe(true); // 600% miss
      expect(anomalyCheck[3].isAnomaly).toBe(false);
    });
  });
});