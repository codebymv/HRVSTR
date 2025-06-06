# HRVSTR Pricing & Session Management Implementation

## Overview

This document outlines the implementation of HRVSTR's sophisticated pricing system integrated with cross-device session management and database-backed caching. The pricing system monetizes the platform through a credit-based economy with tier-specific session durations and cross-device component unlocking, providing clear value propositions for different user segments.

## Session-Based Access Architecture

### Core Innovation: Cross-Device Session Management

HRVSTR's pricing system is built on a sophisticated session-based architecture that provides:

- **Cross-Device Component Access**: Unlocked components work seamlessly across desktop, mobile, and tablet
- **Session-Based Credit Efficiency**: Credits unlock components for tier-specific durations, not single uses
- **No Double-Charging Protection**: Active session validation prevents charging users multiple times for the same data
- **Database-Backed Persistence**: Sessions stored in PostgreSQL for reliability and cross-device sync
- **Real-Time Synchronization**: Component unlocks instantly available on all logged-in devices

*For technical implementation details, see [Caching Architecture Documentation](/help/Implementations/Caching)*

## Current Tier Structure Analysis

### Session Duration by User Tier

**Core Session Benefits:**
- **Free**: 30-minute component sessions
- **Pro**: 2-hour component sessions  
- **Elite**: 4-hour component sessions
- **Institutional**: 8-hour component sessions

### Implemented Backend Structure

**Current Backend Implementation:**
- **Free**: 3 watchlist stocks, 0 credits/month (30-min sessions)
- **Pro**: 15 watchlist stocks, 500 credits/month (2-hour sessions)
- **Elite**: 50 watchlist stocks, 2,000 credits/month (4-hour sessions)
- **Institutional**: Unlimited watchlist, 10,000 credits/month (8-hour sessions)

## 1. Pricing Structure with Session Benefits

### Free Tier - $0/forever
**Target Audience:** Getting started users, casual investors

**Core Features:**
- ✅ 3 watchlist stocks
- ✅ 0 credits/month (trial access only)
- ✅ Basic sentiment (FinViz)
- ✅ SEC insider trades preview
- ✅ SEC institutional holdings preview
- ✅ Basic earnings calendar
- ✅ 1-day historical data
- ✅ Basic stock search

**Session Management:**
- ✅ 30-minute component sessions
- ✅ Cross-device session sync
- ✅ Fair billing protection
- ✅ Session recovery on app restart

**Limitations:**
- ❌ No monthly credit allocation
- ❌ Limited historical data access
- ❌ No Reddit sentiment access
- ❌ Short session duration
- ❌ No premium analytics

### Pro Tier - $19/month (Most Popular)
**Target Audience:** Active traders, retail investors

**Core Features:**
- ✅ 15 watchlist stocks
- ✅ 500 credits/month
- ✅ Reddit sentiment access
- ✅ All sentiment sources (Reddit, FinViz, Yahoo)
- ✅ Full SEC filings access
- ✅ Complete earnings analysis
- ✅ Up to 1-month historical data
- ✅ Advanced stock search
- ✅ Theme customization
- ✅ Real-time data refresh

**Session Management:**
- ✅ 2-hour component sessions
- ✅ Cross-device persistence
- ✅ Extended analysis time
- ✅ Session-based credit efficiency
- ✅ Multi-device workflow support

**Cross-Device Benefits:**
- ✅ Start research on mobile, continue on desktop
- ✅ Unlock once, access everywhere
- ✅ Real-time session synchronization
- ✅ Seamless device switching

### Elite Tier - $49/month
**Target Audience:** Serious analysts, professional traders

**Core Features:**
- ✅ 50 watchlist stocks
- ✅ 2,000 credits/month
- ✅ All data sources
- ✅ Reddit + Alpha Vantage integration
- ✅ 3+ month historical data
- ✅ Advanced time range options
- ✅ Enhanced data refresh rates
- ✅ Advanced stock search & filters
- ✅ Usage analytics dashboard
- ✅ Priority data processing

**Session Management:**
- ✅ 4-hour component sessions
- ✅ Professional workflow support
- ✅ Extended deep-dive analysis
- ✅ Cross-device collaboration
- ✅ Session-based cost optimization

**Professional Benefits:**
- ✅ Extended uninterrupted research sessions
- ✅ Premium data refresh rates
- ✅ Advanced analytics and insights
- ✅ Priority customer support

### Institutional Tier - $199/month
**Target Audience:** Teams & businesses, hedge funds

**Core Features:**
- ✅ Unlimited watchlist
- ✅ 10,000 credits/month
- ✅ All premium data sources
- ✅ Bulk data operations
- ✅ Extended historical data
- ✅ Multiple API key management
- ✅ Advanced usage monitoring
- ✅ Priority data processing
- ✅ Extended data retention
- ✅ Team collaboration features
- ✅ White-label options

**Session Management:**
- ✅ 8-hour enterprise sessions
- ✅ Team session sharing
- ✅ Multi-user coordination
- ✅ Enterprise-grade persistence
- ✅ Advanced session analytics

**Enterprise Benefits:**
- ✅ All-day uninterrupted access
- ✅ Team collaboration tools
- ✅ Enterprise support and SLA
- ✅ Custom integration options

## 2. Session-Based Credit System

### Credit Costs with Session Benefits

```javascript
const SESSION_CREDIT_COSTS = {
  // Component unlock costs (session-based)
  'earnings-analysis': {
    free: 0,      // No credits, trial only
    pro: 5,       // 5 credits for 2-hour session
    elite: 3,     // Discounted for 4-hour session
    institutional: 1  // Minimal cost for 8-hour session
  },
  'sec-insider-trading': {
    free: 0,      // Preview only
    pro: 6,       // 6 credits for 2-hour session
    elite: 4,     // Discounted for 4-hour session
    institutional: 2  // Minimal cost for 8-hour session
  },
  'sec-institutional-holdings': {
    free: 0,      // Not accessible
    pro: 9,       // 9 credits for 2-hour session
    elite: 6,     // Discounted for 4-hour session
    institutional: 3  // Minimal cost for 8-hour session
  },
  'sentiment-research': {
    free: 0,      // FinViz only, no credits
    pro: 4,       // 4 credits for 2-hour session
    elite: 2,     // Discounted for 4-hour session
    institutional: 1  // Minimal cost for 8-hour session
  }
};
```

### Session Value Proposition

**Credit Efficiency Examples:**
- **Pro Tier**: 6 credits = 2 hours of SEC insider data access across all devices
- **Elite Tier**: 4 credits = 4 hours of the same data with priority processing
- **Institutional**: 2 credits = 8 hours of enterprise-grade access with team features

### Cross-Device Session Benefits

✅ **HRVSTR Session Model**: Pay once for time-based component access
- Mobile unlock: 5 credits for 2-hour session
- Desktop continuation: 0 additional credits (same session)
- Tablet review: 0 additional credits (same session)
- **Total**: 5 credits for complete cross-device research

## 3. Technical Implementation Plan

### Phase 1: Session-Based Backend Architecture (Week 1)

#### 3.1 Update Session-Aware Tier Middleware
**File:** `backend/src/middleware/sessionTierMiddleware.js`

```javascript
const TIER_SESSION_LIMITS = {
  free: {
    watchlistLimit: 3,
    monthlyCredits: 50,         // 50 credits per month
    sessionDuration: 30 * 60 * 1000,  // 30 minutes
    features: ['FinViz', 'SEC-Preview', 'Earnings-Basic'],
    crossDeviceSync: true,
    historyDays: 1,
    maxConcurrentSessions: 1
  },
  pro: {
    watchlistLimit: 15,
    monthlyCredits: 500,
    sessionDuration: 2 * 60 * 60 * 1000,  // 2 hours
    features: ['FinViz', 'SEC-Full', 'Earnings-Full', 'Reddit', 'Yahoo'],
    crossDeviceSync: true,
    historyDays: 30,
    maxConcurrentSessions: 3,
    themeCustomization: true,
    realTimeRefresh: true
  },
  elite: {
    watchlistLimit: 50,
    monthlyCredits: 2000,
    sessionDuration: 4 * 60 * 60 * 1000,  // 4 hours
    features: ['FinViz', 'SEC-Full', 'Earnings-Full', 'Reddit', 'Yahoo', 'AlphaVantage'],
    crossDeviceSync: true,
    historyDays: 90,
    maxConcurrentSessions: 5,
    advancedAnalytics: true,
    priorityProcessing: true,
    usageAnalytics: true
  },
  institutional: {
    watchlistLimit: -1,         // unlimited
    monthlyCredits: 10000,
    sessionDuration: 8 * 60 * 60 * 1000,  // 8 hours
    features: ['All'],
    crossDeviceSync: true,
    historyDays: 365,
    maxConcurrentSessions: -1,  // unlimited
    bulkOperations: true,
    teamCollaboration: true,
    whiteLabel: true,
    extendedRetention: true,
    multipleApiKeys: true
  }
};
```

#### 3.2 Session-Based Credit System
```javascript
const SESSION_COMPONENT_COSTS = {
  'earningsAnalysis': { free: 0, pro: 5, elite: 3, institutional: 1 },
  'insiderTrading': { free: 0, pro: 6, elite: 4, institutional: 2 },
  'institutionalHoldings': { free: 0, pro: 9, elite: 6, institutional: 3 },
  'sentimentResearch': { free: 0, pro: 4, elite: 2, institutional: 1 }
};

// Session validation prevents double-charging
const validateActiveSession = async (userId, component) => {
  const activeSession = await db.query(`
    SELECT session_id, expires_at, credits_used
    FROM research_sessions 
    WHERE user_id = $1 AND component = $2 
      AND status = 'active' AND expires_at > CURRENT_TIMESTAMP
  `, [userId, component]);
  
  return activeSession.rows.length > 0 ? activeSession.rows[0] : null;
};
```

### Phase 2: Cross-Device Frontend Components (Week 2)

#### 3.3 Session-Aware Pricing Component
**File:** `frontend/src/pages/SessionPricing.tsx`

```typescript
interface SessionPricingTier {
  id: string;
  name: string;
  price: number;
  sessionDuration: string;
  monthlyCredits: number;
  crossDeviceAccess: boolean;
  features: string[];
  sessionBenefits: string[];
  isPopular?: boolean;
}

const sessionPricingTiers: SessionPricingTier[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: 19,
    sessionDuration: '2 hours',
    monthlyCredits: 500,
    crossDeviceAccess: true,
    features: [
      '15 watchlist stocks',
      '500 credits/month',
      'Reddit sentiment access',
      'Full SEC filings access',
      'Cross-device synchronization'
    ],
    sessionBenefits: [
      'Unlock once, access everywhere',
      '2-hour uninterrupted sessions',
      'Start on mobile, continue on desktop',
      'No double-charging protection',
      'Real-time session sync'
    ],
    isPopular: true
  },
  // ... other tiers
];
```

#### 3.4 Session Status Component
**File:** `frontend/src/components/session/SessionStatus.tsx`

Features:
- Real-time session countdown
- Cross-device session indicators
- Session extension options
- Active device list
- Session renewal prompts

#### 3.5 Cross-Device Access Component
**File:** `frontend/src/components/session/CrossDeviceAccess.tsx`

Features:
- Device-specific access status
- Session sync indicators
- Device management
- Session transfer options

### Phase 3: Session-Based Billing Integration (Week 3)

#### 3.6 Session-Aware Stripe Integration
**File:** `backend/src/routes/sessionBilling.js`

Updated pricing with session benefits:
```javascript
const sessionPricingPlans = [
  {
    id: 'price_pro_monthly',
    tier: 'pro',
    name: 'Pro Monthly - Cross-Device Access',
    amount: 1900, // $19.00
    currency: 'usd',
    interval: 'month',
    sessionDuration: '2 hours',
    features: {
      watchlist: 15,
      credits: 500,
      devices: 'unlimited',
      session: '2-hour',
      crossDevice: true
    }
  },
  {
    id: 'price_elite_monthly', 
    tier: 'elite',
    name: 'Elite Monthly - Extended Sessions',
    amount: 4900, // $49.00
    currency: 'usd',
    interval: 'month',
    sessionDuration: '4 hours',
    features: {
      watchlist: 50,
      credits: 2000,
      devices: 'unlimited',
      session: '4-hour',
      analytics: true,
      priority: true
    }
  },
  {
    id: 'price_institutional_monthly',
    tier: 'institutional', 
    name: 'Institutional Monthly - Enterprise Sessions',
    amount: 19900, // $199.00
    currency: 'usd',
    interval: 'month',
    sessionDuration: '8 hours',
    features: {
      watchlist: 'unlimited',
      credits: 10000,
      devices: 'unlimited',
      session: '8-hour',
      team: true,
      whitelabel: true
    }
  }
];
```

#### 3.7 Session-Based Subscription Management
- Session-aware upgrade/downgrade flow
- Session duration adjustment on tier changes
- Credit adjustment with session context
- Cross-device session migration

### Phase 4: Session Analytics Dashboard (Week 4)

#### 3.8 Session Usage Analytics
**File:** `frontend/src/components/analytics/SessionAnalytics.tsx`

Features:
- Session duration utilization
- Cross-device usage patterns
- Credit efficiency per session
- Session renewal patterns
- Device usage distribution

#### 3.9 Session Analytics Backend
**File:** `backend/src/routes/sessionAnalytics.js`

Endpoints:
- `GET /api/analytics/session-utilization`
- `GET /api/analytics/cross-device-usage`
- `GET /api/analytics/session-efficiency`
- `GET /api/analytics/device-distribution`

## 4. UI/UX Implementation

### 4.1 Session-Aware Design System

#### Session Status Indicators
```css
:root {
  --session-active: #10b981;     /* Green - Active session */
  --session-expiring: #f59e0b;   /* Yellow - Expiring soon */
  --session-expired: #ef4444;    /* Red - Expired */
  --session-sync: #3b82f6;       /* Blue - Syncing */
}
```

#### Cross-Device Visual Language
- Device icons for session status
- Sync indicators and animations
- Session time remaining displays
- Cross-device consistency badges

### 4.2 Session-Responsive Design
- Session status in navigation
- Cross-device access indicators
- Real-time session countdown
- Device-specific optimizations

### 4.3 Interactive Session Elements
- Session extension options
- Device management panels
- Session sharing controls
- Cross-device notifications

## 5. Session-Based Feature Gating

### 5.1 Frontend Session Gating
**File:** `frontend/src/hooks/useSessionAccess.ts`

```typescript
interface SessionAccess {
  hasActiveSession: (component: string) => boolean;
  getSessionTimeRemaining: (component: string) => number;
  canAccessAcrossDevices: () => boolean;
  showSessionUpgrade: (component: string) => void;
  extendSession: (component: string) => Promise<boolean>;
}

export const useSessionAccess = (): SessionAccess => {
  const { user, tier, sessions } = useAuth();
  
  const hasActiveSession = (component: string) => {
    const session = sessions.find(s => 
      s.component === component && 
      s.status === 'active' && 
      new Date(s.expiresAt) > new Date()
    );
    return !!session;
  };
  
  const canAccessAcrossDevices = () => {
    return tier !== 'free'; // All paid tiers support cross-device
  };
  
  // ... implementation
};
```

### 5.2 Session-Aware Upgrade Prompts
**File:** `frontend/src/components/session/SessionUpgradePrompt.tsx`

Features:
- Session duration comparison
- Cross-device benefit highlighting
- Credit efficiency calculators
- Session value demonstrations

### 5.3 Progressive Session Disclosure
- Show session benefits prominently
- Preview cross-device capabilities
- Session duration comparisons
- Clear upgrade paths with session focus

## 6. Session Credit System Enhancement

### 6.1 Session-Based Credit Management
- Session unlock credit deduction
- Cross-device session validation
- Session-based credit efficiency tracking
- Automatic session renewal options

### 6.2 Session Credit Monitoring
- Credit-per-session analytics
- Session value optimization
- Cross-device cost analysis
- Session-based tier recommendations

### 6.3 Session Credit Optimization
- Session duration vs. credit cost analysis
- Cross-device usage efficiency
- Session renewal pattern optimization
- Credit allocation recommendations

## 7. Implementation Timeline

### Week 1: Session Backend Foundation
- [ ] Update session-aware tier middleware
- [ ] Implement cross-device session storage
- [ ] Build session validation system
- [ ] Test session credit deduction

### Week 2: Cross-Device Frontend Components
- [ ] Create session-aware pricing page
- [ ] Build session status components
- [ ] Implement cross-device indicators
- [ ] Add session management UI

### Week 3: Session Billing Integration
- [ ] Update Stripe with session benefits
- [ ] Build session-aware subscription flows
- [ ] Handle session-based tier transitions
- [ ] Test cross-device billing

### Week 4: Session Analytics & Polish
- [ ] Build session analytics dashboard
- [ ] Add cross-device usage tracking
- [ ] Session performance optimization
- [ ] User acceptance testing

## 8. Success Metrics

### Session-Specific KPIs
- **Session Utilization Rate**: Percentage of purchased session time actually used
- **Cross-Device Adoption**: Percentage of users accessing from multiple devices
- **Session Renewal Rate**: Percentage of users who extend or renew sessions
- **Credit Efficiency**: Average credits spent per hour of session time
- **Cross-Device Satisfaction**: User satisfaction with multi-device experience

### Target Session Metrics (3 months)
- 75% session utilization rate across all tiers
- 60% cross-device adoption for paid users
- 40% session renewal rate
- 85% user satisfaction with cross-device experience
- 30% reduction in credit waste through session efficiency

### Business Impact Metrics
- 20% increase in conversion due to session value proposition
- 25% increase in customer lifetime value through cross-device stickiness
- 15% reduction in churn due to session convenience
- 35% increase in feature adoption across devices

This comprehensive session-based pricing implementation transforms HRVSTR from a traditional pay-per-use model to a sophisticated time-based, cross-device access system that provides exceptional value while optimizing revenue and user experience. 