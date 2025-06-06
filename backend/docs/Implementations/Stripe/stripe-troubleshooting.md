# Stripe Troubleshooting Guide

## Common Issues & Solutions

### 1. Infinite Loop in TierContext

#### Symptoms
- Browser console shows rapid-fire API requests to `/api/subscription/tier-info`
- Application becomes unresponsive
- High CPU usage and network activity

#### Root Cause
Missing `useCallback` and incorrect dependency arrays in `useEffect` hooks causing function recreation on every render.

#### Solution
```javascript
// ✅ Correct implementation
const refreshTierInfo = useCallback(async () => {
  if (!isAuthenticated || !token) return;
  // ... refresh logic
}, [isAuthenticated, token]); // Proper dependencies

useEffect(() => {
  refreshTierInfo();
}, [refreshTierInfo]); // Include callback in dependencies
```

#### Prevention
- Always use `useCallback` for functions used in `useEffect` dependencies
- Include ALL dependencies in dependency arrays
- Use ESLint plugin `exhaustive-deps` for warnings

### 2. Webhook Signature Verification Failures

#### Symptoms
- Webhook endpoints returning 400/401 errors
- Stripe Dashboard shows failed webhook deliveries
- Error: "No signatures found matching the expected signature"

#### Debugging Steps
1. **Check Webhook Secret**:
   ```javascript
   console.log('Webhook secret configured:', !!process.env.STRIPE_WEBHOOK_SECRET);
   ```

2. **Verify Raw Body**:
   ```javascript
   // Ensure raw body is preserved
   app.use('/api/billing/webhook', express.raw({type: 'application/json'}));
   ```

3. **Log Signature Headers**:
   ```javascript
   const sig = req.headers['stripe-signature'];
   console.log('Stripe signature header:', sig);
   ```

#### Solutions
- **Missing Secret**: Add correct `STRIPE_WEBHOOK_SECRET` to environment
- **Body Parsing**: Use `express.raw()` for webhook endpoint
- **URL Mismatch**: Ensure webhook URL matches configured endpoint
- **Multiple Secrets**: Use different secrets for test vs live mode

### 3. Credit Display Showing Incorrect Values

#### Symptoms
- Frontend shows old credit values after purchases
- Credit totals don't match database values
- Purchased credits not reflected in UI

#### Root Cause Analysis
1. **Check TierContext State**:
   ```javascript
   console.log('TierContext state:', tierInfo.credits);
   ```

2. **Verify API Response**:
   ```javascript
   // Check /api/subscription/tier-info response
   const response = await fetch('/api/subscription/tier-info');
   const data = await response.json();
   console.log('API credits data:', data.credits);
   ```

3. **Database Verification**:
   ```sql
   SELECT monthly_credits, credits_used, credits_purchased 
   FROM users WHERE id = [USER_ID];
   ```

#### Solutions
- **Missing Fields**: Ensure TierContext interface includes all credit fields
- **Calculation Error**: Fix frontend credit calculation logic
- **Stale Data**: Call `refreshTierInfo()` after credit purchases
- **Database Sync**: Verify webhook properly updates credit fields

### 4. Tier Upgrades Not Updating Credits

#### Symptoms
- User upgrades from Free to Pro but still shows 0 credits
- Database tier updated but monthly_credits unchanged
- Webhook processes but credit allocation missing

#### Debugging Process
1. **Check Webhook Logs**:
   ```javascript
   console.log('Subscription webhook:', {
     event: event.type,
     priceId: subscription.items.data[0].price.id
   });
   ```

2. **Verify Price ID Mapping**:
   ```javascript
   const PRICE_TO_TIER_MAP = {
     'price_1RUNHLRxBJaRlFvt...': 'pro'
   };
   console.log('Mapped tier:', PRICE_TO_TIER_MAP[priceId]);
   ```

3. **Check Database Update**:
   ```sql
   SELECT tier, monthly_credits, updated_at 
   FROM users 
   WHERE stripe_subscription_id = '[SUBSCRIPTION_ID]';
   ```

#### Solutions
- **Missing Price ID**: Add price ID to tier mapping
- **Webhook Handler**: Ensure `updateUserTierFromSubscription` updates both tier and credits
- **Credit Reset**: Verify credits_used reset to 0 on tier changes
- **Manual Fix**: Update user credits manually if webhook failed

### 5. ngrok Tunnel Issues During Development

#### Symptoms
- Webhooks failing intermittently
- "Connection refused" errors
- Stripe events not reaching local server

#### Common Problems & Fixes

1. **Tunnel Expired**:
   ```bash
   # Check tunnel status
   curl -s localhost:4040/api/tunnels | jq
   
   # Restart ngrok
   ngrok http 5000
   ```

2. **Port Mismatch**:
   ```bash
   # Ensure backend runs on correct port
   npm run dev # Should start on port 5000
   ngrok http 5000 # Must match backend port
   ```

3. **Webhook URL Update**:
   - Update Stripe webhook endpoint with new ngrok URL
   - Copy new webhook secret to environment variables

4. **Firewall/Network Issues**:
   ```bash
   # Test ngrok tunnel directly
   curl https://abc123.ngrok.io/api/billing/webhook
   ```

### 6. Payment Processing Errors

#### Test Card Issues

**Problem**: Test payments failing with real card numbers
```javascript
// ❌ Wrong - using real card in test mode
cardNumber: '4111111111111111'

// ✅ Correct - using Stripe test card
cardNumber: '4242424242424242'
```

**Problem**: 3D Secure authentication loops
```javascript
// Use authentication-required test card
cardNumber: '4000002500003155'
// Follow Stripe's test authentication flow
```

#### Checkout Session Problems

1. **Invalid Price ID**:
   ```javascript
   // Verify price ID exists in Stripe dashboard
   const priceId = 'price_1RUNOmRxBJaRlFvt...';
   console.log('Using price ID:', priceId);
   ```

2. **Success/Cancel URL Issues**:
   ```javascript
   // Ensure URLs are absolute and accessible
   successUrl: `${window.location.origin}/settings/usage?success=true`
   cancelUrl: `${window.location.origin}/settings/usage?cancelled=true`
   ```

3. **Customer Creation Errors**:
   ```javascript
   // Handle missing customer gracefully
   customer: existingCustomerId || await createStripeCustomer(user)
   ```

### 7. Database Constraint Violations

#### Credit Field Constraints

**Problem**: Negative credits causing database errors
```sql
-- Add constraints to prevent negative values
ALTER TABLE users ADD CONSTRAINT credits_non_negative 
CHECK (credits_used >= 0 AND credits_purchased >= 0);
```

**Problem**: Invalid tier values
```sql
-- Ensure tier values are valid
ALTER TABLE users ADD CONSTRAINT valid_tier 
CHECK (tier IN ('free', 'pro', 'elite', 'institutional'));
```

#### Foreign Key Issues
```sql
-- Verify subscription ID references
SELECT COUNT(*) FROM users 
WHERE stripe_subscription_id IS NOT NULL 
AND stripe_subscription_id NOT IN (
  SELECT id FROM stripe_subscriptions
);
```

### 8. Frontend State Management Issues

#### TierContext Not Updating

1. **Check Context Provider**:
   ```javascript
   // Ensure TierProvider wraps application
   <TierProvider>
     <App />
   </TierProvider>
   ```

2. **Verify Hook Usage**:
   ```javascript
   // Must be used within TierProvider
   const { tierInfo, refreshTierInfo } = useTier();
   ```

3. **Debug State Updates**:
   ```javascript
   useEffect(() => {
     console.log('TierInfo updated:', tierInfo);
   }, [tierInfo]);
   ```

#### Component Re-rendering Issues

**Problem**: Components not reflecting credit changes
```javascript
// Force refresh after credit purchase
const handleCreditPurchase = async () => {
  await purchaseCredits();
  await refreshTierInfo(); // Explicitly refresh
};
```

### 9. Environment Configuration Issues

#### Missing Environment Variables

**Checklist**:
```bash
# Required environment variables
STRIPE_PUBLIC_KEY_TEST=pk_test_...
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_WEBHOOK_SECRET_TEST=whsec_...
VITE_STRIPE_PRICE_CREDITS_250=price_...
```

**Verification**:
```javascript
// Check if all required env vars are set
const requiredEnvVars = [
  'STRIPE_SECRET_KEY_TEST',
  'STRIPE_WEBHOOK_SECRET_TEST'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Missing environment variable: ${varName}`);
  }
});
```

#### Test vs Live Mode Confusion

**Problem**: Using live keys in development
```javascript
// ✅ Correct - check environment
const stripeSecretKey = process.env.NODE_ENV === 'production' 
  ? process.env.STRIPE_SECRET_KEY_LIVE 
  : process.env.STRIPE_SECRET_KEY_TEST;
```

### 10. Performance & Scaling Issues

#### Too Many API Calls

**Problem**: TierContext making excessive requests
```javascript
// ✅ Solution - implement caching
const [lastFetch, setLastFetch] = useState(0);
const CACHE_DURATION = 30000; // 30 seconds

const refreshTierInfo = useCallback(async () => {
  const now = Date.now();
  if (now - lastFetch < CACHE_DURATION) {
    return; // Use cached data
  }
  // ... fetch logic
  setLastFetch(now);
}, [lastFetch]);
```

#### Database Connection Issues

**Problem**: Connection pool exhaustion
```javascript
// Monitor connection usage
console.log('Active connections:', pool.totalCount);
console.log('Idle connections:', pool.idleCount);

// Implement connection pooling limits
const pool = new Pool({
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

## Debugging Tools & Commands

### Database Queries

```sql
-- Check recent webhook activity
SELECT created_at, activity_type, details 
FROM activities 
WHERE activity_type IN ('subscription_created', 'credits_purchased')
ORDER BY created_at DESC 
LIMIT 20;

-- Verify credit calculations
SELECT 
  email,
  tier,
  monthly_credits,
  credits_purchased,
  credits_used,
  (monthly_credits + credits_purchased - credits_used) as calculated_remaining
FROM users 
WHERE tier != 'free';
```

### API Testing

```bash
# Test tier info endpoint
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  http://localhost:5000/api/subscription/tier-info

# Test webhook endpoint
curl -X POST http://localhost:5000/api/billing/webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "test"}'
```

### Stripe CLI Commands

```bash
# Listen to all webhook events
stripe listen --forward-to localhost:5000/api/billing/webhook

# Trigger specific events
stripe trigger customer.subscription.created
stripe trigger checkout.session.completed

# View recent events
stripe events list --limit 10
```

## When to Contact Support

### Stripe Issues
- Webhook delivery failures persisting > 24 hours
- Payment processing errors in production
- Account configuration problems

### Database Issues
- Constraint violations in production
- Data inconsistency between Stripe and database
- Performance degradation

### Application Issues
- Memory leaks or infinite loops
- Authentication/authorization failures
- Critical functionality broken in production

## Prevention Best Practices

1. **Comprehensive Testing**: Test all scenarios before deployment
2. **Environment Separation**: Keep test/live environments isolated
3. **Error Monitoring**: Implement proper logging and alerting
4. **Database Backups**: Regular backups before major changes
5. **Webhook Monitoring**: Monitor webhook delivery success rates
6. **Performance Monitoring**: Track API response times and database queries

## Quick Fix Commands

### Reset User Credits (Emergency)
```sql
-- Reset user to Pro tier with 500 credits
UPDATE users SET 
  tier = 'pro',
  monthly_credits = 500,
  credits_used = 0,
  credits_reset_date = DATE_ADD(NOW(), INTERVAL 1 MONTH)
WHERE email = 'user@example.com';
```

### Manual Credit Addition
```sql
-- Add 250 purchased credits to user
UPDATE users SET 
  credits_purchased = credits_purchased + 250
WHERE email = 'user@example.com';
```

### Force Webhook Replay
1. Go to Stripe Dashboard → Webhooks
2. Find failed webhook event
3. Click "Resend" to retry processing

## Related Documentation

- [**Testing Procedures**](/help/Implementations/Stripe/stripe-testing) - Comprehensive testing guide
- [**Webhook Integration**](/help/Implementations/Stripe/stripe-webhooks) - Webhook event handling
- [**Credit System**](/help/Implementations/Stripe/stripe-credits) - Credit management details
- [**Architecture Overview**](/help/Implementations/Stripe/stripe-architecture) - System design context 