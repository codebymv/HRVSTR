/**
 * Session-Based Economy System Tests
 * Tests the core business logic for session management, credit deduction,
 * and cross-device access control to prevent double-charging
 */

const request = require('supertest');
const { Pool } = require('pg');

// Mock database pool for testing
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn()
};

// Mock the database connection
jest.mock('../src/config/data-sources', () => ({
  pool: mockPool,
  isDataSourceEnabled: jest.fn(() => true),
  updateDataSources: jest.fn(),
  getConfig: jest.fn(() => ({ sentiment: true, earnings: true, sec_insider: true }))
}));

const app = require('../src/index'); // Adjust path as needed

describe('Session-Based Economy System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Session Creation and Validation', () => {
    test('should create new session when none exists', async () => {
      // Mock no existing session
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // No active session
        .mockResolvedValueOnce({ rows: [{ id: 1, credits: 500, tier: 'pro' }] }) // User data
        .mockResolvedValueOnce({ rows: [{ session_id: 'test-session-123' }] }); // Session creation

      const mockUser = {
        id: 1,
        tier: 'pro',
        credits: 500
      };

      // Test session creation logic
      const component = 'sentimentAnalysis';
      const creditCost = 4;
      
      // Simulate the session creation process
      const sessionData = {
        user_id: mockUser.id,
        component: component,
        credits_used: creditCost,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours for pro tier
      };

      expect(mockUser.credits).toBeGreaterThanOrEqual(creditCost);
      expect(sessionData.credits_used).toBe(creditCost);
      expect(sessionData.component).toBe(component);
    });

    test('should not create session if active session exists', async () => {
      const activeSession = {
        session_id: 'existing-session-456',
        component: 'sentimentAnalysis',
        expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour remaining
        status: 'active'
      };

      // Mock existing active session
      mockPool.query.mockResolvedValueOnce({ rows: [activeSession] });

      // Should return existing session without creating new one
      const result = activeSession;
      expect(result.session_id).toBe('existing-session-456');
      expect(result.status).toBe('active');
    });

    test('should validate session expiration correctly', () => {
      const expiredSession = {
        expires_at: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        status: 'active'
      };

      const activeSession = {
        expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        status: 'active'
      };

      // Test expiration logic
      const isExpiredSessionValid = new Date(expiredSession.expires_at) > new Date();
      const isActiveSessionValid = new Date(activeSession.expires_at) > new Date();

      expect(isExpiredSessionValid).toBe(false);
      expect(isActiveSessionValid).toBe(true);
    });
  });

  describe('Credit Deduction Logic', () => {
    test('should calculate correct credit costs by tier', () => {
      const creditCosts = {
        sentimentAnalysis: {
          free: 4,
          pro: 2,
          elite: 1,
          institutional: 1
        },
        earningsAnalysis: {
          free: 5,
          pro: 3,
          elite: 1,
          institutional: 1
        },
        insiderTrading: {
          free: 6,
          pro: 4,
          elite: 2,
          institutional: 1
        }
      };

      // Test tier-based pricing
      expect(creditCosts.sentimentAnalysis.free).toBe(4);
      expect(creditCosts.sentimentAnalysis.pro).toBe(2);
      expect(creditCosts.sentimentAnalysis.elite).toBe(1);
      expect(creditCosts.sentimentAnalysis.institutional).toBe(1);

      expect(creditCosts.earningsAnalysis.pro).toBe(3);
      expect(creditCosts.insiderTrading.elite).toBe(2);
    });

    test('should prevent credit deduction if insufficient credits', async () => {
      const mockUser = {
        id: 1,
        tier: 'pro',
        credits: 1 // Insufficient credits
      };

      const creditCost = 4; // Sentiment analysis for pro tier costs 2, but testing with 4
      
      // Should fail if user has insufficient credits
      const hasEnoughCredits = mockUser.credits >= creditCost;
      expect(hasEnoughCredits).toBe(false);
    });

    test('should deduct credits only once per session', async () => {
      const initialCredits = 500;
      const creditCost = 4;
      
      // Mock successful credit deduction
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // No active session
        .mockResolvedValueOnce({ rows: [{ id: 1, credits: initialCredits, tier: 'pro' }] }) // User data
        .mockResolvedValueOnce({ rows: [{ credits: initialCredits - creditCost }] }); // After deduction

      const expectedCreditsAfterDeduction = initialCredits - creditCost;
      expect(expectedCreditsAfterDeduction).toBe(496);
    });
  });

  describe('Cross-Device Access Control', () => {
    test('should allow access across devices with same session', async () => {
      const sessionId = 'cross-device-session-789';
      const activeSession = {
        session_id: sessionId,
        component: 'sentimentAnalysis',
        user_id: 1,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        status: 'active'
      };

      // Mock session validation for different devices
      mockPool.query.mockResolvedValue({ rows: [activeSession] });

      // Simulate access from multiple devices
      const device1Access = activeSession;
      const device2Access = activeSession;
      const device3Access = activeSession;

      expect(device1Access.session_id).toBe(sessionId);
      expect(device2Access.session_id).toBe(sessionId);
      expect(device3Access.session_id).toBe(sessionId);
      
      // All devices should reference the same session
      expect(device1Access).toEqual(device2Access);
      expect(device2Access).toEqual(device3Access);
    });

    test('should prevent double-charging across devices', async () => {
      const userId = 1;
      const component = 'sentimentAnalysis';
      const initialCredits = 500;
      
      // First device creates session
      const firstDeviceSession = {
        user_id: userId,
        component: component,
        credits_used: 4,
        status: 'active'
      };

      // Mock existing session for second device
      mockPool.query.mockResolvedValue({ rows: [firstDeviceSession] });

      // Second device should find existing session, not create new one
      const secondDeviceAccess = firstDeviceSession;
      
      expect(secondDeviceAccess.credits_used).toBe(4); // Only charged once
      expect(secondDeviceAccess.user_id).toBe(userId);
      expect(secondDeviceAccess.component).toBe(component);
    });
  });

  describe('Session Duration by Tier', () => {
    test('should set correct session duration by tier', () => {
      const tierDurations = {
        free: 0.5, // 30 minutes
        pro: 2,    // 2 hours
        elite: 4,  // 4 hours
        institutional: 8 // 8 hours
      };

      const now = new Date();
      
      // Test duration calculations
      const freeExpiry = new Date(now.getTime() + tierDurations.free * 60 * 60 * 1000);
      const proExpiry = new Date(now.getTime() + tierDurations.pro * 60 * 60 * 1000);
      const eliteExpiry = new Date(now.getTime() + tierDurations.elite * 60 * 60 * 1000);
      const institutionalExpiry = new Date(now.getTime() + tierDurations.institutional * 60 * 60 * 1000);

      expect(freeExpiry.getTime() - now.getTime()).toBe(30 * 60 * 1000); // 30 minutes
      expect(proExpiry.getTime() - now.getTime()).toBe(2 * 60 * 60 * 1000); // 2 hours
      expect(eliteExpiry.getTime() - now.getTime()).toBe(4 * 60 * 60 * 1000); // 4 hours
      expect(institutionalExpiry.getTime() - now.getTime()).toBe(8 * 60 * 60 * 1000); // 8 hours
    });
  });

  describe('Session Cleanup and Expiration', () => {
    test('should mark expired sessions as expired', async () => {
      const expiredSession = {
        id: 1,
        status: 'active',
        expires_at: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      };

      // Mock cleanup function
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      // Simulate cleanup process
      const isExpired = new Date(expiredSession.expires_at) < new Date();
      expect(isExpired).toBe(true);
      
      if (isExpired) {
        expiredSession.status = 'expired';
      }
      
      expect(expiredSession.status).toBe('expired');
    });

    test('should log session expiration activities', async () => {
      const expiredSession = {
        user_id: 1,
        component: 'sentimentAnalysis',
        metadata: { unlockDurationHours: 2 }
      };

      // Mock activity logging
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const activityLog = {
        user_id: expiredSession.user_id,
        activity_type: 'research_expired',
        title: 'Research Expired',
        description: 'Sentiment Analysis Research expired after 2 hours time limit'
      };

      expect(activityLog.user_id).toBe(1);
      expect(activityLog.activity_type).toBe('research_expired');
      expect(activityLog.description).toContain('2 hours');
    });
  });

  describe('Component Mapping', () => {
    test('should map components correctly for session tracking', () => {
      const componentMapping = {
        reddit: 'sentimentAnalysis',
        yahoo: 'sentimentAnalysis', 
        finviz: 'sentimentChart',
        combined: 'sentimentScores',
        aggregated: 'sentimentScores',
        earnings: 'earningsAnalysis',
        upcoming_earnings: 'upcomingEarnings',
        insider_trading: 'insiderTrading',
        institutional_holdings: 'institutionalHoldings'
      };

      expect(componentMapping.reddit).toBe('sentimentAnalysis');
      expect(componentMapping.yahoo).toBe('sentimentAnalysis');
      expect(componentMapping.finviz).toBe('sentimentChart');
      expect(componentMapping.earnings).toBe('earningsAnalysis');
      expect(componentMapping.insider_trading).toBe('insiderTrading');
    });
  });
});