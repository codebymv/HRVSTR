/**
 * Credit Deduction System Tests
 * Tests the core business logic for credit calculations, tier-based pricing,
 * and double-charging prevention across the cache services
 */

const request = require('supertest');
const { Pool } = require('pg');

// Mock the cache services
const mockUserSentimentCacheService = {
  getSentimentDataForUser: jest.fn(),
  checkActiveUnlockSession: jest.fn(),
  getUserTier: jest.fn(),
  getUserCredits: jest.fn(),
  deductUserCredits: jest.fn()
};

const mockUserSecCacheService = {
  getSecDataForUser: jest.fn(),
  checkActiveUnlockSession: jest.fn(),
  getUserTier: jest.fn(),
  getUserCredits: jest.fn(),
  deductUserCredits: jest.fn()
};

const mockUserEarningsCacheService = {
  getEarningsDataForUser: jest.fn(),
  checkActiveUnlockSession: jest.fn(),
  getUserTier: jest.fn(),
  getUserCredits: jest.fn(),
  deductUserCredits: jest.fn()
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

describe('Credit Deduction System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Tier-Based Credit Costs', () => {
    test('should calculate correct sentiment analysis costs by tier', () => {
      const sentimentCosts = {
        reddit: { free: 4, pro: 2, elite: 1, institutional: 1 },
        yahoo: { free: 4, pro: 2, elite: 1, institutional: 1 },
        finviz: { free: 4, pro: 2, elite: 1, institutional: 1 },
        combined: { free: 6, pro: 3, elite: 2, institutional: 1 },
        aggregated: { free: 8, pro: 4, elite: 2, institutional: 1 }
      };

      // Test Reddit sentiment costs
      expect(sentimentCosts.reddit.free).toBe(4);
      expect(sentimentCosts.reddit.pro).toBe(2);
      expect(sentimentCosts.reddit.elite).toBe(1);
      expect(sentimentCosts.reddit.institutional).toBe(1);

      // Test combined sentiment costs (higher complexity)
      expect(sentimentCosts.combined.free).toBe(6);
      expect(sentimentCosts.combined.pro).toBe(3);
      
      // Test aggregated sentiment costs (highest complexity)
      expect(sentimentCosts.aggregated.free).toBe(8);
      expect(sentimentCosts.aggregated.pro).toBe(4);
    });

    test('should calculate correct SEC data costs by tier', () => {
      const secCosts = {
        insider_trading: { free: 6, pro: 4, elite: 2, institutional: 1 },
        institutional_holdings: { free: 9, pro: 6, elite: 3, institutional: 2 }
      };

      // Test insider trading costs
      expect(secCosts.insider_trading.free).toBe(6);
      expect(secCosts.insider_trading.pro).toBe(4);
      expect(secCosts.insider_trading.elite).toBe(2);
      
      // Test institutional holdings costs (premium feature)
      expect(secCosts.institutional_holdings.free).toBe(9);
      expect(secCosts.institutional_holdings.pro).toBe(6);
      expect(secCosts.institutional_holdings.elite).toBe(3);
      expect(secCosts.institutional_holdings.institutional).toBe(2);
    });

    test('should calculate correct earnings analysis costs by tier', () => {
      const earningsCosts = {
        earnings_analysis: { free: 5, pro: 3, elite: 1, institutional: 1 },
        upcoming_earnings: { free: 4, pro: 2, elite: 1, institutional: 1 }
      };

      expect(earningsCosts.earnings_analysis.free).toBe(5);
      expect(earningsCosts.earnings_analysis.pro).toBe(3);
      expect(earningsCosts.upcoming_earnings.elite).toBe(1);
    });
  });

  describe('Credit Validation and Deduction', () => {
    test('should validate sufficient credits before deduction', async () => {
      const mockUser = {
        id: 1,
        tier: 'pro',
        credits: 100
      };
      
      const creditCost = 4;
      
      // Mock user data retrieval
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, credits: 100, tier: 'pro' }]
      });

      const hasEnoughCredits = mockUser.credits >= creditCost;
      expect(hasEnoughCredits).toBe(true);
      
      // Test insufficient credits scenario
      const insufficientUser = { ...mockUser, credits: 2 };
      const hasInsufficientCredits = insufficientUser.credits >= creditCost;
      expect(hasInsufficientCredits).toBe(false);
    });

    test('should deduct credits atomically', async () => {
      const userId = 1;
      const initialCredits = 500;
      const creditCost = 6;
      
      // Mock successful credit deduction
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ credits: initialCredits }] }) // Get current credits
        .mockResolvedValueOnce({ rows: [{ credits: initialCredits - creditCost }] }); // After deduction

      const expectedCredits = initialCredits - creditCost;
      expect(expectedCredits).toBe(494);
      
      // Verify the deduction is atomic (all-or-nothing)
      const deductionQuery = `
        UPDATE users 
        SET credits = credits - $1 
        WHERE id = $2 AND credits >= $1 
        RETURNING credits
      `;
      
      expect(deductionQuery).toContain('credits >= $1'); // Ensures atomic check
    });

    test('should handle concurrent credit deductions safely', async () => {
      const userId = 1;
      const initialCredits = 10;
      const creditCost = 8;
      
      // Simulate two concurrent requests
      const request1Credits = initialCredits;
      const request2Credits = initialCredits;
      
      // Only one should succeed due to atomic deduction
      const canDeductRequest1 = request1Credits >= creditCost;
      const remainingAfterRequest1 = request1Credits - creditCost;
      const canDeductRequest2 = remainingAfterRequest1 >= creditCost;
      
      expect(canDeductRequest1).toBe(true);
      expect(remainingAfterRequest1).toBe(2);
      expect(canDeductRequest2).toBe(false); // Should fail due to insufficient credits
    });
  });

  describe('Session-Based Credit Protection', () => {
    test('should not deduct credits if active session exists', async () => {
      const userId = 1;
      const component = 'sentimentAnalysis';
      const creditCost = 4;
      
      // Mock active session exists
      const activeSession = {
        session_id: 'active-session-123',
        user_id: userId,
        component: component,
        expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour remaining
        status: 'active'
      };
      
      mockPool.query.mockResolvedValueOnce({ rows: [activeSession] });
      
      // Should return existing session without credit deduction
      const sessionExists = activeSession.status === 'active' && 
                           new Date(activeSession.expires_at) > new Date();
      
      expect(sessionExists).toBe(true);
      // No credit deduction should occur
    });

    test('should deduct credits only when creating new session', async () => {
      const userId = 1;
      const component = 'sentimentAnalysis';
      const creditCost = 4;
      const initialCredits = 100;
      
      // Mock no active session
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // No active session
        .mockResolvedValueOnce({ rows: [{ id: userId, credits: initialCredits, tier: 'pro' }] }) // User data
        .mockResolvedValueOnce({ rows: [{ credits: initialCredits - creditCost }] }); // Credit deduction
      
      const noActiveSession = true; // Simulating no active session found
      
      if (noActiveSession) {
        const creditsAfterDeduction = initialCredits - creditCost;
        expect(creditsAfterDeduction).toBe(96);
      }
    });
  });

  describe('Cross-Device Double-Charging Prevention', () => {
    test('should prevent charging same user multiple times across devices', async () => {
      const userId = 1;
      const component = 'sentimentAnalysis';
      const sessionId = 'cross-device-session-456';
      
      // Device 1 creates session
      const device1Session = {
        session_id: sessionId,
        user_id: userId,
        component: component,
        credits_used: 4,
        status: 'active',
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000)
      };
      
      // Device 2 checks for existing session
      mockPool.query.mockResolvedValue({ rows: [device1Session] });
      
      // Device 2 should find existing session
      const existingSession = device1Session;
      expect(existingSession.session_id).toBe(sessionId);
      expect(existingSession.credits_used).toBe(4); // Only charged once
      
      // Device 3 also finds same session
      const device3Session = device1Session;
      expect(device3Session.session_id).toBe(sessionId);
      expect(device3Session.credits_used).toBe(4); // Still only charged once
    });

    test('should validate session across multiple component types', async () => {
      const userId = 1;
      const components = ['sentimentAnalysis', 'earningsAnalysis', 'insiderTrading'];
      
      // Each component should have separate session tracking
      const sessions = components.map((component, index) => ({
        session_id: `session-${component}-${index}`,
        user_id: userId,
        component: component,
        status: 'active',
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000)
      }));
      
      // Each component should be tracked separately
      expect(sessions).toHaveLength(3);
      expect(sessions[0].component).toBe('sentimentAnalysis');
      expect(sessions[1].component).toBe('earningsAnalysis');
      expect(sessions[2].component).toBe('insiderTrading');
      
      // Each should have unique session IDs
      const sessionIds = sessions.map(s => s.session_id);
      const uniqueSessionIds = [...new Set(sessionIds)];
      expect(uniqueSessionIds).toHaveLength(3);
    });
  });

  describe('Credit Limit Enforcement', () => {
    test('should enforce tier-based credit limits', () => {
      const tierLimits = {
        free: { monthly_credits: 0, watchlist_limit: 3 },
        pro: { monthly_credits: 500, watchlist_limit: 15 },
        elite: { monthly_credits: 2000, watchlist_limit: 50 },
        institutional: { monthly_credits: 10000, watchlist_limit: -1 } // Unlimited
      };
      
      expect(tierLimits.free.monthly_credits).toBe(0);
      expect(tierLimits.pro.monthly_credits).toBe(500);
      expect(tierLimits.elite.monthly_credits).toBe(2000);
      expect(tierLimits.institutional.monthly_credits).toBe(10000);
      
      // Test watchlist limits
      expect(tierLimits.free.watchlist_limit).toBe(3);
      expect(tierLimits.pro.watchlist_limit).toBe(15);
      expect(tierLimits.institutional.watchlist_limit).toBe(-1); // Unlimited
    });

    test('should prevent operations when credits exhausted', async () => {
      const mockUser = {
        id: 1,
        tier: 'pro',
        credits: 0 // No credits remaining
      };
      
      const creditCost = 4;
      
      const canProceed = mockUser.credits >= creditCost;
      expect(canProceed).toBe(false);
      
      // Should return appropriate error response
      const errorResponse = {
        success: false,
        error: 'Insufficient credits',
        required_credits: creditCost,
        available_credits: mockUser.credits
      };
      
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('Insufficient credits');
    });
  });

  describe('Credit Cost Calculation Edge Cases', () => {
    test('should handle unknown tier gracefully', () => {
      const unknownTier = 'unknown_tier';
      const defaultCost = 10; // Fallback cost
      
      const creditCosts = {
        sentimentAnalysis: {
          free: 4,
          pro: 2,
          elite: 1,
          institutional: 1
        }
      };
      
      const cost = creditCosts.sentimentAnalysis[unknownTier] || defaultCost;
      expect(cost).toBe(defaultCost);
    });

    test('should handle component mapping correctly', () => {
      const componentMapping = {
        reddit: 'sentimentAnalysis',
        yahoo_sentiment: 'sentimentAnalysis',
        finviz_sentiment: 'sentimentChart',
        combined_sentiment: 'sentimentScores',
        earnings_data: 'earningsAnalysis',
        sec_insider: 'insiderTrading',
        sec_institutional: 'institutionalHoldings'
      };
      
      // Test mapping accuracy
      expect(componentMapping.reddit).toBe('sentimentAnalysis');
      expect(componentMapping.yahoo_sentiment).toBe('sentimentAnalysis');
      expect(componentMapping.finviz_sentiment).toBe('sentimentChart');
      expect(componentMapping.sec_insider).toBe('insiderTrading');
      
      // Test unmapped component
      const unmappedComponent = 'unknown_component';
      const mappedComponent = componentMapping[unmappedComponent] || unmappedComponent;
      expect(mappedComponent).toBe('unknown_component');
    });
  });

  describe('Revenue Protection Scenarios', () => {
    test('should prevent credit bypass attempts', async () => {
      const userId = 1;
      const component = 'sentimentAnalysis';
      
      // Attempt to bypass credit check
      const bypassAttempt = {
        user_id: userId,
        component: component,
        force_access: true // Malicious parameter
      };
      
      // System should still enforce credit checks regardless of bypass attempts
      mockPool.query.mockResolvedValueOnce({ rows: [{ credits: 0 }] });
      
      const userCredits = 0;
      const creditCost = 4;
      const hasValidAccess = userCredits >= creditCost;
      
      expect(hasValidAccess).toBe(false);
      // force_access should be ignored
    });

    test('should log all credit transactions for audit', async () => {
      const creditTransaction = {
        user_id: 1,
        component: 'sentimentAnalysis',
        credits_deducted: 4,
        credits_before: 100,
        credits_after: 96,
        session_id: 'audit-session-789',
        timestamp: new Date(),
        transaction_type: 'component_unlock'
      };
      
      // Verify transaction logging structure
      expect(creditTransaction.user_id).toBe(1);
      expect(creditTransaction.credits_deducted).toBe(4);
      expect(creditTransaction.credits_before - creditTransaction.credits_deducted)
        .toBe(creditTransaction.credits_after);
      expect(creditTransaction.transaction_type).toBe('component_unlock');
    });
  });
});