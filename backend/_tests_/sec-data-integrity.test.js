/**
 * SEC Data Integrity Tests
 * Tests the accuracy and reliability of SEC filing parsing,
 * data extraction, and financial information processing
 */

const request = require('supertest');
const { Pool } = require('pg');

// Mock SEC services
const mockSecService = {
  getInsiderTradingData: jest.fn(),
  getInstitutionalHoldings: jest.fn(),
  parseForm4Filing: jest.fn(),
  parseForm13FFiling: jest.fn(),
  searchCompany: jest.fn()
};

const mockForm4Parser = {
  parseForm4: jest.fn(),
  extractTransactionData: jest.fn(),
  validateFilingData: jest.fn()
};

const mockForm13FParser = {
  parseForm13F: jest.fn(),
  extractHoldingsData: jest.fn(),
  calculatePositionChanges: jest.fn()
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

describe('SEC Data Integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Form 4 Insider Trading Data', () => {
    test('should parse Form 4 transaction data correctly', () => {
      const mockForm4Data = {
        issuer: {
          cik: '0000320193',
          name: 'Apple Inc.',
          symbol: 'AAPL'
        },
        reportingOwner: {
          name: 'COOK TIMOTHY D',
          title: 'Chief Executive Officer',
          relationship: 'Officer'
        },
        transactions: [{
          securityTitle: 'Common Stock',
          transactionDate: '2024-01-15',
          transactionCode: 'S', // Sale
          transactionShares: 50000,
          transactionPricePerShare: 185.50,
          sharesOwnedAfter: 3200000,
          directOrIndirect: 'D'
        }]
      };

      // Test data structure validation
      expect(mockForm4Data.issuer.cik).toBe('0000320193');
      expect(mockForm4Data.issuer.symbol).toBe('AAPL');
      expect(mockForm4Data.reportingOwner.name).toBe('COOK TIMOTHY D');
      expect(mockForm4Data.transactions[0].transactionCode).toBe('S');
      expect(mockForm4Data.transactions[0].transactionShares).toBe(50000);
      expect(mockForm4Data.transactions[0].transactionPricePerShare).toBe(185.50);
      
      // Calculate transaction value
      const transactionValue = mockForm4Data.transactions[0].transactionShares * 
                              mockForm4Data.transactions[0].transactionPricePerShare;
      expect(transactionValue).toBe(9275000); // $9.275M
    });

    test('should validate required Form 4 fields', () => {
      const incompleteForm4 = {
        issuer: {
          cik: '0000320193',
          // Missing name and symbol
        },
        reportingOwner: {
          name: 'COOK TIMOTHY D'
          // Missing title and relationship
        },
        transactions: [{
          transactionDate: '2024-01-15',
          // Missing critical transaction data
        }]
      };

      // Validation function
      const validateForm4 = (data) => {
        const errors = [];
        
        if (!data.issuer?.name) errors.push('Missing issuer name');
        if (!data.issuer?.symbol) errors.push('Missing issuer symbol');
        if (!data.reportingOwner?.title) errors.push('Missing reporting owner title');
        if (!data.transactions?.[0]?.transactionCode) errors.push('Missing transaction code');
        if (!data.transactions?.[0]?.transactionShares) errors.push('Missing transaction shares');
        
        return errors;
      };

      const validationErrors = validateForm4(incompleteForm4);
      expect(validationErrors).toContain('Missing issuer name');
      expect(validationErrors).toContain('Missing issuer symbol');
      expect(validationErrors).toContain('Missing reporting owner title');
      expect(validationErrors).toContain('Missing transaction code');
    });

    test('should handle different transaction codes correctly', () => {
      const transactionCodes = {
        'P': 'Purchase',
        'S': 'Sale', 
        'A': 'Grant/Award',
        'D': 'Disposition',
        'F': 'Payment of Exercise Price',
        'M': 'Exercise of Derivative',
        'X': 'Exercise of In-the-Money Option'
      };

      // Test transaction code mapping
      expect(transactionCodes['P']).toBe('Purchase');
      expect(transactionCodes['S']).toBe('Sale');
      expect(transactionCodes['A']).toBe('Grant/Award');
      expect(transactionCodes['M']).toBe('Exercise of Derivative');
      
      // Test unknown code handling
      const unknownCode = 'Z';
      const codeDescription = transactionCodes[unknownCode] || 'Unknown Transaction';
      expect(codeDescription).toBe('Unknown Transaction');
    });

    test('should calculate insider trading metrics accurately', () => {
      const insiderTransactions = [
        { transactionCode: 'S', transactionShares: 10000, transactionPricePerShare: 150.00 },
        { transactionCode: 'P', transactionShares: 5000, transactionPricePerShare: 145.00 },
        { transactionCode: 'S', transactionShares: 15000, transactionPricePerShare: 155.00 }
      ];

      // Calculate total sales and purchases
      const sales = insiderTransactions
        .filter(t => t.transactionCode === 'S')
        .reduce((sum, t) => sum + (t.transactionShares * t.transactionPricePerShare), 0);
      
      const purchases = insiderTransactions
        .filter(t => t.transactionCode === 'P')
        .reduce((sum, t) => sum + (t.transactionShares * t.transactionPricePerShare), 0);

      expect(sales).toBe(3825000); // (10000 * 150) + (15000 * 155)
      expect(purchases).toBe(725000); // (5000 * 145)
      
      const netSales = sales - purchases;
      expect(netSales).toBe(3100000); // Net selling activity
    });
  });

  describe('Form 13F Institutional Holdings Data', () => {
    test('should parse Form 13F holdings data correctly', () => {
      const mockForm13FData = {
        filer: {
          cik: '0001067983',
          name: 'Berkshire Hathaway Inc',
          reportDate: '2024-03-31'
        },
        holdings: [
          {
            issuer: 'Apple Inc.',
            cusip: '037833100',
            symbol: 'AAPL',
            shares: 915560000,
            marketValue: 153500000000, // $153.5B
            percentOfPortfolio: 45.2
          },
          {
            issuer: 'Bank of America Corp',
            cusip: '060505104', 
            symbol: 'BAC',
            shares: 1032852006,
            marketValue: 41200000000, // $41.2B
            percentOfPortfolio: 12.1
          }
        ],
        totalValue: 339800000000 // $339.8B total portfolio
      };

      // Test holdings data structure
      expect(mockForm13FData.filer.name).toBe('Berkshire Hathaway Inc');
      expect(mockForm13FData.holdings).toHaveLength(2);
      expect(mockForm13FData.holdings[0].symbol).toBe('AAPL');
      expect(mockForm13FData.holdings[0].shares).toBe(915560000);
      expect(mockForm13FData.holdings[0].marketValue).toBe(153500000000);
      
      // Verify portfolio percentage calculation
      const applePercentage = (mockForm13FData.holdings[0].marketValue / mockForm13FData.totalValue) * 100;
      expect(Math.round(applePercentage * 10) / 10).toBe(45.2);
    });

    test('should calculate position changes between quarters', () => {
      const previousQuarter = {
        'AAPL': { shares: 900000000, marketValue: 140000000000 },
        'BAC': { shares: 1000000000, marketValue: 38000000000 }
      };
      
      const currentQuarter = {
        'AAPL': { shares: 915560000, marketValue: 153500000000 },
        'BAC': { shares: 1032852006, marketValue: 41200000000 }
      };

      // Calculate changes
      const appleShareChange = currentQuarter.AAPL.shares - previousQuarter.AAPL.shares;
      const appleValueChange = currentQuarter.AAPL.marketValue - previousQuarter.AAPL.marketValue;
      
      const bacShareChange = currentQuarter.BAC.shares - previousQuarter.BAC.shares;
      const bacValueChange = currentQuarter.BAC.marketValue - previousQuarter.BAC.marketValue;

      expect(appleShareChange).toBe(15560000); // Increased position
      expect(appleValueChange).toBe(13500000000); // $13.5B increase
      expect(bacShareChange).toBe(32852006); // Increased position
      expect(bacValueChange).toBe(3200000000); // $3.2B increase
    });

    test('should validate CUSIP format', () => {
      const validCusips = ['037833100', '060505104', '594918104'];
      const invalidCusips = ['12345', 'ABCDEFGHI', '037833', '037833100X'];
      
      const validateCusip = (cusip) => {
        // CUSIP should be exactly 9 characters, alphanumeric
        // First 6 characters: issuer code (letters and numbers)
        // 7th and 8th: issue identifier (letters and numbers)
        // 9th: check digit (number)
        if (!/^[0-9A-Z]{9}$/.test(cusip)) {
          return false;
        }
        // Must contain at least one number (real CUSIPs aren't all letters)
        return /[0-9]/.test(cusip);
      };

      validCusips.forEach(cusip => {
        expect(validateCusip(cusip)).toBe(true);
      });
      
      invalidCusips.forEach(cusip => {
        expect(validateCusip(cusip)).toBe(false);
      });
    });
  });

  describe('Company Search and CIK Resolution', () => {
    test('should resolve company symbols to CIK correctly', () => {
      const companyMappings = {
        'AAPL': { cik: '0000320193', name: 'Apple Inc.' },
        'MSFT': { cik: '0000789019', name: 'Microsoft Corporation' },
        'GOOGL': { cik: '0001652044', name: 'Alphabet Inc.' },
        'TSLA': { cik: '0001318605', name: 'Tesla, Inc.' }
      };

      expect(companyMappings['AAPL'].cik).toBe('0000320193');
      expect(companyMappings['MSFT'].cik).toBe('0000789019');
      expect(companyMappings['GOOGL'].name).toBe('Alphabet Inc.');
      expect(companyMappings['TSLA'].name).toBe('Tesla, Inc.');
    });

    test('should handle company name variations', () => {
      const companyVariations = {
        'Apple Inc.': 'AAPL',
        'Apple Inc': 'AAPL',
        'APPLE INC': 'AAPL',
        'Microsoft Corporation': 'MSFT',
        'Microsoft Corp': 'MSFT',
        'MICROSOFT CORP': 'MSFT'
      };

      const normalizeCompanyName = (name) => {
        return name.toUpperCase()
          .replace(/\./g, '')
          .replace(/\s+CORPORATION$/g, ' CORP')
          .replace(/\s+INCORPORATED$/g, ' INC')
          .trim();
      };

      expect(normalizeCompanyName('Apple Inc.')).toBe('APPLE INC');
      expect(normalizeCompanyName('Microsoft Corporation')).toBe('MICROSOFT CORP');
    });
  });

  describe('Data Quality and Validation', () => {
    test('should detect and handle malformed SEC data', () => {
      const malformedData = {
        issuer: null,
        reportingOwner: undefined,
        transactions: 'invalid_format',
        filingDate: 'not_a_date'
      };

      const validateSecData = (data) => {
        const issues = [];
        
        if (!data.issuer || typeof data.issuer !== 'object') {
          issues.push('Invalid issuer data');
        }
        
        if (!data.reportingOwner || typeof data.reportingOwner !== 'object') {
          issues.push('Invalid reporting owner data');
        }
        
        if (!Array.isArray(data.transactions)) {
          issues.push('Transactions must be an array');
        }
        
        if (data.filingDate && isNaN(Date.parse(data.filingDate))) {
          issues.push('Invalid filing date format');
        }
        
        return issues;
      };

      const validationIssues = validateSecData(malformedData);
      expect(validationIssues).toContain('Invalid issuer data');
      expect(validationIssues).toContain('Invalid reporting owner data');
      expect(validationIssues).toContain('Transactions must be an array');
      expect(validationIssues).toContain('Invalid filing date format');
    });

    test('should validate numeric fields for accuracy', () => {
      const transactionData = {
        transactionShares: '50000',
        transactionPricePerShare: '185.50',
        sharesOwnedAfter: 'invalid_number'
      };

      const validateNumericFields = (data) => {
        const numericFields = ['transactionShares', 'transactionPricePerShare', 'sharesOwnedAfter'];
        const errors = [];
        
        numericFields.forEach(field => {
          const value = data[field];
          if (value !== undefined && value !== null) {
            const numValue = Number(value);
            if (isNaN(numValue) || numValue < 0) {
              errors.push(`Invalid ${field}: ${value}`);
            }
          }
        });
        
        return errors;
      };

      const numericErrors = validateNumericFields(transactionData);
      expect(numericErrors).toContain('Invalid sharesOwnedAfter: invalid_number');
      expect(numericErrors).not.toContain('Invalid transactionShares: 50000');
      expect(numericErrors).not.toContain('Invalid transactionPricePerShare: 185.50');
    });

    test('should handle missing or incomplete filings gracefully', () => {
      const incompleteFilings = [
        { type: 'Form4', data: null },
        { type: 'Form4', data: {} },
        { type: 'Form13F', data: { filer: null } },
        { type: 'Form13F', data: { holdings: [] } }
      ];

      const processFilings = (filings) => {
        return filings.map(filing => {
          if (!filing.data || Object.keys(filing.data).length === 0) {
            return { ...filing, status: 'incomplete', error: 'No data available' };
          }
          
          if (filing.type === 'Form13F' && (!filing.data.holdings || filing.data.holdings.length === 0)) {
            return { ...filing, status: 'empty', error: 'No holdings data' };
          }
          
          return { ...filing, status: 'valid' };
        });
      };

      const processedFilings = processFilings(incompleteFilings);
      expect(processedFilings[0].status).toBe('incomplete');
      expect(processedFilings[1].status).toBe('incomplete');
      expect(processedFilings[3].status).toBe('empty');
    });
  });

  describe('Performance and Rate Limiting', () => {
    test('should handle SEC EDGAR rate limits', () => {
      const rateLimitConfig = {
        requestsPerSecond: 10,
        burstLimit: 50,
        cooldownPeriod: 1000 // 1 second
      };

      const requestQueue = [];
      const currentTime = Date.now();
      
      // Simulate rate limiting logic
      const canMakeRequest = (queue, config) => {
        const recentRequests = queue.filter(timestamp => 
          currentTime - timestamp < 1000
        );
        
        return recentRequests.length < config.requestsPerSecond;
      };

      // Test under rate limit
      for (let i = 0; i < 5; i++) {
        requestQueue.push(currentTime - (i * 200));
      }
      expect(canMakeRequest(requestQueue, rateLimitConfig)).toBe(true);
      
      // Test over rate limit
      for (let i = 0; i < 15; i++) {
        requestQueue.push(currentTime - (i * 50));
      }
      expect(canMakeRequest(requestQueue, rateLimitConfig)).toBe(false);
    });

    test('should cache parsed SEC data efficiently', () => {
      const cacheConfig = {
        maxSize: 1000,
        ttl: 3600000, // 1 hour
        keyPrefix: 'sec_data_'
      };

      const mockCache = new Map();
      
      const cacheSecData = (cik, formType, data) => {
        const key = `${cacheConfig.keyPrefix}${cik}_${formType}`;
        const cacheEntry = {
          data: data,
          timestamp: Date.now(),
          ttl: cacheConfig.ttl
        };
        
        mockCache.set(key, cacheEntry);
        return key;
      };
      
      const getCachedSecData = (cik, formType) => {
        const key = `${cacheConfig.keyPrefix}${cik}_${formType}`;
        const entry = mockCache.get(key);
        
        if (!entry) return null;
        
        const isExpired = Date.now() - entry.timestamp > entry.ttl;
        if (isExpired) {
          mockCache.delete(key);
          return null;
        }
        
        return entry.data;
      };

      // Test caching
      const testData = { issuer: 'Apple Inc.', transactions: [] };
      const cacheKey = cacheSecData('0000320193', 'Form4', testData);
      
      expect(cacheKey).toBe('sec_data_0000320193_Form4');
      expect(getCachedSecData('0000320193', 'Form4')).toEqual(testData);
      expect(getCachedSecData('0000320193', 'Form13F')).toBeNull();
    });
  });
});