# Stripe Webhook Integration

## Overview

Stripe webhooks automatically synchronize subscription and payment data between Stripe and the HRVSTR database. The webhook system handles all subscription lifecycle events and credit purchases.

## Webhook Endpoint

```
POST /api/billing/webhook
```

**Security**: All webhooks verified using Stripe signature validation.

## Handled Events

### 1. `customer.subscription.created`
**Triggers**: New subscription created  
**Action**: Sets user tier and allocates monthly credits

```javascript
// Example: Free → Pro upgrade
{
  tier: 'free' → 'pro',
  monthly_credits: 50 → 500,
  credits_used: reset to 0,
  credits_reset_date: new monthly reset date
}
```

### 2. `customer.subscription.updated`
**Triggers**: Subscription plan changes, renewals  
**Action**: Updates tier and credit allocation if price ID changed

```javascript
// Detects tier changes and adjusts credits accordingly
if (newTier !== currentTier) {
  updateTierAndCredits(newTier);
  resetCreditsUsed();
}
```

### 3. `customer.subscription.deleted`
**Triggers**: Subscription canceled  
**Action**: Downgrades user to free tier

```javascript
{
  tier: 'pro/elite/institutional' → 'free',
  monthly_credits: current → 0,
  credits_used: reset to 0,
  stripe_subscription_id: null
}
```

### 4. `checkout.session.completed`
**Triggers**: Successful payment completion  
**Action**: Handles both subscriptions and credit purchases

```javascript
// For credit purchases (mode: 'payment')
if (session.mode === 'payment') {
  addCreditsToUser(250); // Add purchased credits
  logActivity('credits_purchased');
}

// For subscriptions (mode: 'subscription')
if (session.mode === 'subscription') {
  linkSubscriptionToUser();
}
```

## Price ID Mapping

The webhook system uses Stripe price IDs to determine tier assignments:

```javascript
const PRICE_TO_TIER_MAP = {
  // Pro Monthly/Yearly
  'price_1RUNHLRxBJaRlFvtQCqF8123': 'pro',
  'price_1RUNHLRxBJaRlFvtABC123': 'pro',
  
  // Elite Monthly/Yearly  
  'price_1RUNHMRxBJaRlFvtDEF456': 'elite',
  'price_1RUNHMRxBJaRlFvtGHI456': 'elite',
  
  // Institutional Monthly/Yearly
  'price_1RUNHNRxBJaRlFvtJKL789': 'institutional',
  'price_1RUNHNRxBJaRlFvtMNO789': 'institutional',
  
  // Credit Bundle
  'price_1RUNOmRxBJaRlFvtFDsOkRGL': 'credits'
};
```

## Credit Allocation Logic

### Monthly Credit Limits by Tier
```javascript
const TIER_CREDITS = {
  free: 0,
  pro: 500,
  elite: 2000,
  institutional: 5000 // Custom, configurable
};
```

### Tier Change Behavior
1. **Upgrade**: Credits reset to 0, new monthly limit applied
2. **Downgrade**: Credits reset to 0, lower monthly limit applied  
3. **Same Tier**: No credit changes (renewal)

## Database Operations

### User Table Updates
```sql
-- Subscription event processing
UPDATE users SET 
  tier = $1,
  monthly_credits = $2,
  credits_used = 0,
  credits_reset_date = $3,
  stripe_subscription_id = $4,
  updated_at = NOW()
WHERE id = $5;
```

### Credit Purchase Processing
```sql
-- Credit bundle purchase
UPDATE users SET 
  credits_purchased = credits_purchased + $1,
  updated_at = NOW()
WHERE id = $2;

-- Activity logging
INSERT INTO activities (user_id, activity_type, details, created_at)
VALUES ($1, 'credits_purchased', $2, NOW());
```

## Error Handling

### Webhook Validation
```javascript
// Stripe signature verification
const sig = request.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
```

### Duplicate Event Protection
```javascript
// Idempotency using Stripe event IDs
const processedEventIds = new Set();
if (processedEventIds.has(event.id)) {
  return; // Skip duplicate processing
}
```

### Failure Recovery
- Automatic retries by Stripe (up to 3 days)
- Detailed error logging for debugging
- Manual event replay capability via Stripe dashboard

## Testing Webhooks

### Development Setup
1. **ngrok tunnel**: `ngrok http 5000`
2. **Webhook URL**: `https://abc123.ngrok.io/api/billing/webhook`
3. **Test events**: Use Stripe CLI or dashboard webhook testing

### Test Event Simulation
```bash
# Test subscription creation
stripe trigger customer.subscription.created

# Test successful payment
stripe trigger checkout.session.completed

# Test subscription cancellation  
stripe trigger customer.subscription.deleted
```

### Verification
- Check database updates after webhook processing
- Verify user tier and credit changes
- Confirm activity log entries

## Monitoring & Debugging

### Webhook Logs
```javascript
console.log(`Processing webhook: ${event.type}`);
console.log(`User: ${userId}, Tier: ${oldTier} → ${newTier}`);
console.log(`Credits: ${oldCredits} → ${newCredits}`);
```

### Stripe Dashboard
- View webhook delivery attempts and responses
- Replay failed webhooks
- Monitor webhook endpoint health

### Common Issues
1. **Signature Mismatch**: Check webhook endpoint secret
2. **Database Errors**: Verify user exists before updating
3. **Network Issues**: Ensure webhook endpoint is accessible

## Webhook Flow Diagrams

### Subscription Creation Flow
```
User Subscribes → Stripe Checkout → subscription.created → updateUserTierFromSubscription → Database Update
```

### Credit Purchase Flow
```
User Purchases → Stripe Checkout → checkout.session.completed → handleCreditPurchase → Database Update
```

### Subscription Update Flow
```
Plan Change → subscription.updated → Price ID Match → Tier Change Detection → Credit Reset
```

## Security Considerations

### Webhook Signature Verification
- All webhook events verified using Stripe signature
- Raw body content preserved for signature validation
- Different webhook secrets for test vs live environments

### Environment Isolation
- Separate webhook endpoints for development and production
- Test webhook events only affect test database
- Live webhook events require production Stripe keys

### Rate Limiting
- Webhook endpoint protected against abuse
- Failed webhook processing logged for analysis
- Automatic retry handling for transient failures

## Related Documentation

- [**Credit System Details**](/help/Implementations/Stripe/stripe-credits) - How credits are calculated and managed
- [**Testing Webhooks**](/help/Implementations/Stripe/stripe-testing) - Complete webhook testing procedures
- [**Troubleshooting Webhooks**](/help/Implementations/Stripe/stripe-troubleshooting) - Common webhook issues
- [**Architecture Overview**](/help/Implementations/Stripe/stripe-architecture) - System design context 