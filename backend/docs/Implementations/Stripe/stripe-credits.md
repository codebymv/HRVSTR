# Stripe Credit System

## Overview

HRVSTR uses a credit-based system to manage API usage across different subscription tiers. Credits combine monthly tier allocations with purchasable bundles for flexible usage management.

## Credit Structure

### Database Schema
```sql
-- User credit fields
tier VARCHAR(50) DEFAULT 'free',
monthly_credits INTEGER DEFAULT 0,
credits_used INTEGER DEFAULT 0,
credits_purchased INTEGER DEFAULT 0,
credits_reset_date TIMESTAMP,
stripe_subscription_id VARCHAR(255)
```

### Credit Calculation
```javascript
const creditInfo = {
  monthly: user.monthly_credits,        // Tier-based monthly allocation
  purchased: user.credits_purchased,    // Bought credit bundles
  used: user.credits_used,             // Total credits consumed
  total: monthly + purchased,           // Total available credits
  remaining: total - used,              // Credits left to use
  resetDate: user.credits_reset_date    // When monthly credits reset
};
```

## Tier-Based Allocations

### Monthly Credit Limits
```javascript
const TIER_MONTHLY_CREDITS = {
  free: 0,           // No monthly allocation
  pro: 500,          // 500 credits per month
  elite: 2000,       // 2000 credits per month
  institutional: 5000 // Custom allocation
};
```

### Credit Reset Behavior
- **Monthly Reset**: Credits reset on subscription anniversary
- **Tier Changes**: Immediate reset when upgrading/downgrading
- **Purchased Credits**: Never expire, persist across resets

## Credit Purchase System

### Bundle Configuration
```javascript
const CREDIT_BUNDLES = {
  standard: {
    credits: 250,
    price: 10.00,
    priceId: 'price_1RUNOmRxBJaRlFvtFDsOkRGL'
  }
  // Future: Additional bundle sizes
};
```

### Purchase Flow
1. User clicks "250 Credits for $10.00" button
2. Frontend calls `handleAddCredits(250)`
3. Backend creates Stripe checkout session
4. User completes payment via Stripe
5. Webhook processes `checkout.session.completed`
6. Credits added to `credits_purchased` field

## Usage Tracking

### Credit Consumption
```javascript
// When user performs API-consuming action
const consumeCredits = async (userId, amount, action) => {
  const user = await getUserById(userId);
  const totalAvailable = user.monthly_credits + user.credits_purchased;
  
  if (user.credits_used + amount > totalAvailable) {
    throw new Error('Insufficient credits');
  }
  
  // Update usage
  await updateUserCredits(userId, {
    credits_used: user.credits_used + amount
  });
  
  // Log activity
  await logActivity(userId, 'credit_usage', {
    action,
    amount,
    remaining: totalAvailable - (user.credits_used + amount)
  });
};
```

### Usage Examples
```javascript
// Different actions consume different amounts
const CREDIT_COSTS = {
  sentiment_analysis: 1,
  earnings_data: 2,
  sec_filing: 3,
  bulk_analysis: 5
};
```

## Frontend Integration

### TierContext Credit Data
```javascript
const TierContext = createContext({
  tierInfo: {
    tier: 'pro',
    credits: {
      monthly: 500,
      purchased: 250,
      used: 150,
      total: 750,
      remaining: 600,
      resetDate: '2025-02-05',
      daysUntilReset: 30
    }
  }
});
```

### Credit Display Formatting

#### Free Users
```javascript
// Simple format: "0 / 50"
const displayText = `${used} / ${monthly}`;
```

#### Pro/Elite Users
```javascript
// Enhanced format: "0 / 500 Used (+ 250 additional)"
const displayText = `${used} / ${monthly} Used${
  purchased > 0 ? ` (+ ${purchased} additional)` : ''
}`;
```

### Usage Meter Component
```javascript
const usagePercentage = total > 0 ? (used / total) * 100 : 0;

<div className="progress-bar">
  <div 
    className={`progress-fill ${getProgressColor(remaining, total)}`}
    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
  />
</div>
```

## Credit Management Logic

### Tier Upgrade Behavior
```javascript
// When user upgrades from Free to Pro
const handleTierUpgrade = (oldTier, newTier) => {
  if (oldTier === 'free' && newTier === 'pro') {
    return {
      monthly_credits: 500,  // New monthly allocation
      credits_used: 0,       // Reset usage counter
      credits_purchased: 0,  // Keep purchased credits
      credits_reset_date: getNextMonthlyReset()
    };
  }
};
```

### Credit Purchase Addition
```javascript
// When user buys 250 credit bundle
const handleCreditPurchase = (userId, bundleSize) => {
  return {
    credits_purchased: currentPurchased + bundleSize,
    // Keep all other credit fields unchanged
  };
};
```

## Validation & Limits

### Credit Validation
```javascript
const validateCreditUsage = (user, requiredCredits) => {
  const totalAvailable = user.monthly_credits + user.credits_purchased;
  const availableCredits = totalAvailable - user.credits_used;
  
  if (availableCredits < requiredCredits) {
    return {
      valid: false,
      error: 'INSUFFICIENT_CREDITS',
      available: availableCredits,
      required: requiredCredits
    };
  }
  
  return { valid: true };
};
```

### Purchase Restrictions
- **Free Users**: Cannot purchase additional credits
- **Pro/Elite Users**: No purchase limits
- **Rate Limiting**: Prevent rapid successive purchases

## Reporting & Analytics

### Credit Usage Tracking
```sql
-- Activity log for credit consumption
INSERT INTO activities (user_id, activity_type, details, created_at)
VALUES ($1, 'credit_usage', $2, NOW());

-- Example details JSON
{
  "action": "sentiment_analysis",
  "credits_consumed": 1,
  "credits_remaining": 599,
  "symbol": "AAPL"
}
```

### Usage Analytics
- Daily/monthly credit consumption patterns
- Feature usage breakdown by credit cost
- Tier upgrade correlation with usage patterns
- Purchase behavior analysis

## Edge Cases & Considerations

### Monthly Reset Timing
- Resets occur on subscription anniversary date
- Handles timezone differences properly
- Accounts for leap years and month-end dates

### Concurrent Usage
- Database transactions prevent race conditions
- Proper locking for credit deduction operations
- Handles high-concurrency scenarios

### Negative Credit Scenarios
- Prevents usage when credits would go negative
- Graceful error handling for insufficient credits
- Clear user messaging for credit limitations

## Integration with HRVSTR Features

### Feature Credit Costs
- **Sentiment Scraper**: 1 credit per symbol analysis
- **Earnings Monitor**: 2 credits per earnings event
- **SEC Filings**: 3 credits per filing retrieval
- **Bulk Operations**: Variable based on scope

### Tier-Based Feature Access
- **Free**: Basic features only, no API access
- **Pro**: Full API access with 500 monthly credits
- **Elite**: Enhanced limits and priority processing
- **Institutional**: Custom limits and dedicated support

## Related Documentation

- [**Webhook Integration**](/help/Implementations/Stripe/stripe-webhooks) - How credits are added via webhooks
- [**Testing Credit Flows**](/help/Implementations/Stripe/stripe-testing) - Testing credit purchase and usage
- [**Troubleshooting Credits**](/help/Implementations/Stripe/stripe-troubleshooting) - Common credit-related issues
- [**Architecture Overview**](/help/Implementations/Stripe/stripe-architecture) - System design context 