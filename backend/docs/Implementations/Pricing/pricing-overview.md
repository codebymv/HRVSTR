# HRVSTR Pricing Prototype Implementation Outline

## Overview

This document outlines the implementation plan for the HRVSTR pricing prototype, including tier structure, feature mapping, UI components, and backend integration. The pricing system is designed to monetize the platform while providing clear value propositions for different user segments.

## Current Tier Structure Analysis

### Implemented vs UI Discrepancies

**Current Backend Implementation:**
- Free: 5 watchlist stocks, 50 credits/month
- Pro: 25 watchlist stocks, 500 credits/month  
- Elite: Unlimited watchlist, 2000 credits/month
- Institutional: Unlimited watchlist, 10000 credits/month

**UI Design Requirements:**
- Free: 3 watchlist stocks, 50 scrape credits/month
- Pro: 15 watchlist stocks, 500 scrape credits/month
- Elite: 50 watchlist stocks, 2000 scrape credits/month
- Institutional: Unlimited watchlist, 10000 scrape credits/month

## 1. Pricing Structure

### Free Tier - $0/forever
**Target Audience:** Getting started users, casual investors

**Features:**
- ✅ 3 watchlist stocks
- ✅ 50 scrape credits/month
- ✅ Basic sentiment (FinViz)
- ✅ SEC insider trades
- ✅ SEC institutional holdings
- ✅ Basic earnings calendar
- ✅ 1-day historical data
- ✅ Basic stock search

**Limitations:**
- ❌ No Reddit sentiment access
- ❌ Limited historical data
- ❌ Limited watchlist capacity
- ❌ Basic search functionality
- ❌ No advanced analytics

### Pro Tier - $19/month (Most Popular)
**Target Audience:** Active traders, retail investors

**Features:**
- ✅ 15 watchlist stocks
- ✅ 500 scrape credits/month
- ✅ Reddit sentiment access
- ✅ All sentiment sources
- ✅ Reddit sentiment (with your API keys)
- ✅ Full SEC filings access
- ✅ Complete earnings analysis
- ✅ Up to 1-month historical data
- ✅ Advanced stock search
- ✅ Theme customization
- ✅ Real-time data refresh

### Elite Tier - $49/month
**Target Audience:** Serious analysts, professional traders

**Features:**
- ✅ 50 watchlist stocks
- ✅ 2000 scrape credits/month
- ✅ All data sources
- ✅ Reddit + Alpha Vantage integration
- ✅ 3+ month historical data
- ✅ Advanced time range options
- ✅ Enhanced data refresh rates
- ✅ Advanced stock search & filters
- ✅ Usage analytics dashboard
- ✅ Priority data processing

### Institutional Tier - $199/month
**Target Audience:** Teams & businesses, hedge funds

**Features:**
- ✅ Unlimited watchlist
- ✅ 10,000 scrape credits/month
- ✅ All premium data sources
- ✅ Bulk data operations
- ✅ Extended historical data
- ✅ Multiple API key management
- ✅ Advanced usage monitoring
- ✅ Priority data processing
- ✅ Extended data retention
- ✅ Team collaboration features
- ✅ White-label options

## 2. Technical Implementation Plan

### Phase 1: Backend Tier Alignment (Week 1)

#### 2.1 Update Tier Middleware
**File:** `backend/src/middleware/tierMiddleware.js`

```javascript
const TIER_LIMITS = {
  free: {
    watchlistLimit: 3,          // Updated from 5 to 3
    monthlyCredits: 50,
    features: ['FinViz', 'SEC-Insider', 'SEC-Institutional', 'Earnings'],
    historyDays: 1,
    dailySearches: 25,
    dailyPriceUpdates: 25
  },
  pro: {
    watchlistLimit: 15,         // Updated from 25 to 15
    monthlyCredits: 500,
    features: ['FinViz', 'SEC-Insider', 'SEC-Institutional', 'Earnings', 'Reddit', 'Yahoo'],
    historyDays: 30,
    dailySearches: -1,          // unlimited
    dailyPriceUpdates: -1,      // unlimited
    themeCustomization: true,
    realTimeRefresh: true
  },
  elite: {
    watchlistLimit: 50,         // Updated from -1 to 50
    monthlyCredits: 2000,
    features: ['FinViz', 'SEC-Insider', 'SEC-Institutional', 'Earnings', 'Reddit', 'Yahoo', 'AlphaVantage'],
    historyDays: 90,
    dailySearches: -1,
    dailyPriceUpdates: -1,
    advancedAnalytics: true,
    priorityProcessing: true,
    usageAnalytics: true
  },
  institutional: {
    watchlistLimit: -1,         // unlimited
    monthlyCredits: 10000,
    features: ['FinViz', 'SEC-Insider', 'SEC-Institutional', 'Earnings', 'Reddit', 'Yahoo', 'AlphaVantage'],
    historyDays: 365,
    dailySearches: -1,
    dailyPriceUpdates: -1,
    bulkOperations: true,
    teamCollaboration: true,
    whiteLabel: true,
    extendedRetention: true,
    multipleApiKeys: true
  }
};
```

#### 2.2 Update Credit Cost Structure
```javascript
const CREDIT_COSTS = {
  'sentiment-basic': 1,         // FinViz sentiment
  'sentiment-reddit': 3,        // Reddit sentiment analysis
  'sentiment-aggregate': 5,     // Multi-source sentiment
  'sec-insider-trades': 2,      // SEC insider trading data
  'sec-institutional': 3,       // SEC institutional holdings
  'earnings-upcoming': 1,       // Upcoming earnings
  'earnings-historical': 2,     // Historical earnings
  'earnings-analysis': 5,       // Advanced earnings analysis
  'real-time-refresh': 1,       // Real-time data refresh
  'historical-data': 5,         // Historical data access
  'advanced-search': 2,         // Advanced stock search
  'bulk-operation': 10          // Bulk data operations
};
```

### Phase 2: Frontend Pricing Component (Week 2)

#### 2.3 Pricing Page Component
**File:** `frontend/src/pages/Pricing.tsx`

```typescript
interface PricingTier {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  limitations: string[];
  isPopular?: boolean;
  buttonText: string;
  buttonVariant: 'default' | 'primary' | 'secondary';
}

const pricingTiers: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    description: 'Perfect for getting started',
    features: [
      '3 watchlist stocks',
      '50 scrape credits/month',
      'Basic sentiment (FinViz)',
      'SEC insider trades',
      'SEC institutional holdings',
      'Basic earnings calendar',
      '1-day historical data',
      'Basic stock search'
    ],
    limitations: [
      'No Reddit sentiment access',
      'Limited historical data',
      'Limited watchlist capacity',
      'Basic search functionality',
      'No advanced analytics'
    ],
    buttonText: 'Get Started',
    buttonVariant: 'default'
  },
  // ... other tiers
];
```

#### 2.4 Pricing Card Component
**File:** `frontend/src/components/pricing/PricingCard.tsx`

Key features:
- Responsive design with tier highlighting
- Feature list with checkmarks and X marks
- Upgrade/downgrade buttons
- Current tier indication
- Usage progress bars for current users

#### 2.5 Tier Comparison Component
**File:** `frontend/src/components/pricing/TierComparison.tsx`

Features:
- Side-by-side feature comparison
- Feature category groupings
- Responsive mobile view
- Interactive feature tooltips

### Phase 3: Billing Integration (Week 3)

#### 2.6 Stripe Integration Updates
**File:** `backend/src/routes/billing.js`

Update pricing structure:
```javascript
const pricingPlans = [
  {
    id: 'price_pro_monthly',
    tier: 'pro',
    name: 'Pro Monthly',
    amount: 1900, // $19.00
    currency: 'usd',
    interval: 'month',
    features: [15, 500, 'reddit', 'theme']
  },
  {
    id: 'price_elite_monthly', 
    tier: 'elite',
    name: 'Elite Monthly',
    amount: 4900, // $49.00
    currency: 'usd',
    interval: 'month',
    features: [50, 2000, 'analytics', 'priority']
  },
  {
    id: 'price_institutional_monthly',
    tier: 'institutional', 
    name: 'Institutional Monthly',
    amount: 19900, // $199.00
    currency: 'usd',
    interval: 'month',
    features: ['unlimited', 10000, 'team', 'whitelabel']
  }
];
```

#### 2.7 Subscription Management
- Upgrade/downgrade flow
- Proration handling
- Credit adjustment on tier changes
- Usage reset logic

### Phase 4: Usage Analytics Dashboard (Week 4)

#### 2.8 Usage Tracking Components
**File:** `frontend/src/components/analytics/UsageDashboard.tsx`

Features:
- Credit usage over time
- Feature usage breakdown
- Tier recommendation engine
- Usage prediction and alerts
- Cost-benefit analysis

#### 2.9 Analytics Backend
**File:** `backend/src/routes/analytics.js`

Endpoints:
- `GET /api/analytics/usage-summary`
- `GET /api/analytics/usage-history`
- `GET /api/analytics/tier-recommendations`
- `GET /api/analytics/cost-optimization`

## 3. UI/UX Implementation

### 3.1 Design System Updates

#### Color Scheme by Tier
```css
:root {
  --tier-free: #6b7280;      /* Gray */
  --tier-pro: #3b82f6;       /* Blue */
  --tier-elite: #8b5cf6;     /* Purple */
  --tier-institutional: #10b981; /* Green */
}
```

#### Component Variants
- Card highlighting for current tier
- Gradient overlays for premium tiers
- Icon systems for features
- Progress indicators for usage

### 3.2 Responsive Design
- Mobile-first pricing cards
- Collapsible feature comparisons
- Touch-friendly upgrade buttons
- Simplified mobile feature lists

### 3.3 Interactive Elements
- Feature tooltips with explanations
- Usage calculators
- Tier recommendation wizard
- Savings calculators for annual plans

## 4. Feature Gating System

### 4.1 Frontend Gating
**File:** `frontend/src/hooks/useTierAccess.ts`

```typescript
interface TierAccess {
  hasFeature: (feature: string) => boolean;
  hasCredits: (cost: number) => boolean;
  canAddToWatchlist: () => boolean;
  showUpgradePrompt: (feature: string) => void;
}

export const useTierAccess = (): TierAccess => {
  const { user, tier } = useAuth();
  
  const hasFeature = (feature: string) => {
    return TIER_LIMITS[tier]?.features?.includes(feature) ?? false;
  };
  
  // ... implementation
};
```

### 4.2 Upgrade Prompts
**File:** `frontend/src/components/common/UpgradePrompt.tsx`

Features:
- Contextual upgrade messages
- Feature-specific upgrade paths
- Usage limit warnings
- Credit exhaustion notices

### 4.3 Progressive Disclosure
- Show premium features as "locked"
- Preview mode for premium data
- Teaser content for higher tiers
- Clear upgrade paths

## 5. Credit System Enhancement

### 5.1 Credit Management
- Real-time credit deduction
- Credit purchase options
- Add-on credit packs
- Credit rollover policies

### 5.2 Credit Monitoring
- Usage predictions
- Low credit warnings
- Automatic tier recommendations
- Credit efficiency tracking

### 5.3 Credit Optimization
- Feature usage analytics
- Cost-per-feature analysis
- Tier optimization suggestions
- Usage pattern insights

## 6. A/B Testing Framework

### 6.1 Pricing Experiments
- Price point testing
- Feature bundling tests
- Upgrade flow optimization
- Tier naming experiments

### 6.2 Conversion Optimization
- Upgrade prompt placement
- Feature highlighting tests
- Social proof elements
- Urgency messaging

### 6.3 Metrics Tracking
- Conversion rates by tier
- Feature adoption rates
- Churn analysis
- Revenue per user

## 7. Implementation Timeline

### Week 1: Backend Foundation
- [ ] Update tier limits in middleware
- [ ] Adjust credit cost structure
- [ ] Update database constraints
- [ ] Test tier enforcement

### Week 2: Frontend Components
- [ ] Create pricing page
- [ ] Build pricing cards
- [ ] Implement feature gating
- [ ] Add upgrade prompts

### Week 3: Billing Integration
- [ ] Update Stripe integration
- [ ] Build subscription flows
- [ ] Handle tier transitions
- [ ] Test payment processing

### Week 4: Analytics & Polish
- [ ] Build usage dashboard
- [ ] Add analytics tracking
- [ ] Performance optimization
- [ ] User acceptance testing

## 8. Success Metrics

### Key Performance Indicators
- **Conversion Rate**: Free to paid tier conversion
- **Average Revenue Per User (ARPU)**: Monthly revenue per active user
- **Customer Lifetime Value (CLV)**: Total revenue per customer
- **Churn Rate**: Monthly subscription cancellation rate
- **Feature Adoption**: Usage of premium features by tier

### Target Metrics (3 months)
- 15% free-to-paid conversion rate
- $32 average monthly revenue per user
- <5% monthly churn rate
- 80% feature adoption in paid tiers
- 25% year-over-year growth

### User Experience Metrics
- Time to upgrade decision
- Feature discovery rate
- Support ticket volume
- User satisfaction scores
- Net Promoter Score (NPS)

## 9. Risk Mitigation

### Technical Risks
- **Credit System Bugs**: Comprehensive testing of credit deduction
- **Billing Integration**: Extensive Stripe testing and monitoring
- **Performance Impact**: Load testing with tier checks
- **Data Consistency**: Ensure tier changes don't corrupt user data

### Business Risks
- **Price Sensitivity**: A/B test pricing before full rollout
- **Feature Cannibalization**: Monitor free tier usage limits
- **Competitive Response**: Monitor competitor pricing changes
- **Customer Satisfaction**: Regular user feedback collection

### Mitigation Strategies
- Gradual rollout with feature flags
- Comprehensive error monitoring
- Regular user feedback sessions
- Competitor analysis and benchmarking
- Emergency rollback procedures

## 10. Post-Launch Optimization

### Continuous Improvement
- Monthly pricing analysis
- Feature usage optimization
- Tier boundary adjustments
- Credit cost refinement

### Future Enhancements
- Enterprise tier for large organizations
- Usage-based pricing options
- Team collaboration features
- API access tiers
- White-label solutions

This comprehensive outline provides a roadmap for implementing a robust, scalable pricing system that aligns with business goals while providing clear value to users across all tiers. 