# Stripe Testing Guide

## Test Environment Setup

### Required Tools
- **ngrok**: For webhook testing (`npm install -g ngrok`)
- **Stripe CLI**: For event simulation (`stripe login`)
- **Test Credit Cards**: Stripe-provided test card numbers

### Environment Configuration

#### 1. Stripe Test Keys
```bash
# .env file
STRIPE_PUBLIC_KEY_TEST=pk_test_...
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_WEBHOOK_SECRET_TEST=whsec_...
```

#### 2. ngrok Tunnel Setup
```bash
# Terminal 1: Start your backend server
npm run dev

# Terminal 2: Create ngrok tunnel
ngrok http 5000

# Note the forwarding URL: https://abc123.ngrok.io
```

#### 3. Stripe Webhook Configuration
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://abc123.ngrok.io/api/billing/webhook`
3. Select events: `customer.subscription.*`, `checkout.session.completed`
4. Copy webhook signing secret to `.env`

## Test Credit Cards

### Successful Payments
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/25)
CVC: Any 3-digit number (e.g., 123)
ZIP: Any 5-digit number (e.g., 12345)
```

### Declined Payments
```
Card Number: 4000 0000 0000 0002
Expiry: Any future date
CVC: Any 3-digit number
```

### Authentication Required
```
Card Number: 4000 0025 0000 3155
Expiry: Any future date
CVC: Any 3-digit number
```

## Test Scenarios

### 1. New Subscription Flow

#### Test: Free → Pro Upgrade
1. **Setup**: User with free account (0 credits)
2. **Action**: Click "Upgrade Plan" → Select Pro Monthly
3. **Payment**: Use test card 4242 4242 4242 4242
4. **Expected Results**:
   - Stripe checkout succeeds
   - Webhook `customer.subscription.created` fired
   - User tier updated to 'pro'
   - Monthly credits set to 500
   - Credits used reset to 0
   - Success redirect to `/settings/billing?success=true`

#### Verification Checklist
- [ ] Database: `tier = 'pro'`, `monthly_credits = 500`
- [ ] Frontend: TierManagement shows "Pro" tier
- [ ] Credits display: "0 / 500 Used"
- [ ] Total credits shown: "500 left"

### 2. Credit Purchase Flow

#### Test: Buy 250 Credit Bundle
1. **Setup**: Pro user with 140 credits remaining
2. **Action**: Click "250 Credits for $10.00"
3. **Payment**: Complete Stripe checkout
4. **Expected Results**:
   - Checkout session mode: 'payment'
   - Webhook `checkout.session.completed` fired
   - Credits purchased increased by 250
   - Total credits: 500 (monthly) + 250 (purchased) = 750

#### Verification Checklist
- [ ] Database: `credits_purchased = credits_purchased + 250`
- [ ] Frontend: Display "0 / 500 Used (+ 250 additional)"
- [ ] Total credits: "750 left"
- [ ] Activity log: Credits purchase recorded

### 3. Tier Upgrade with Existing Credits

#### Test: Pro → Elite Upgrade
1. **Setup**: Pro user with 200 credits used, 250 purchased
2. **Action**: Upgrade to Elite subscription
3. **Expected Results**:
   - Tier updated to 'elite'
   - Monthly credits: 500 → 2000
   - Credits used: 200 → 0 (reset)
   - Purchased credits: preserved (250)
   - Total available: 2000 + 250 = 2250

#### Verification Checklist
- [ ] Database: `tier = 'elite'`, `monthly_credits = 2000`, `credits_used = 0`
- [ ] Frontend: "0 / 2000 Used (+ 250 additional)"
- [ ] Total credits: "2250 left"

### 4. Subscription Cancellation

#### Test: Cancel Pro Subscription
1. **Setup**: Active Pro subscription
2. **Action**: Cancel via Stripe Dashboard (simulates user cancellation)
3. **Expected Results**:
   - Webhook `customer.subscription.deleted` fired
   - Tier downgraded to 'free'
   - Monthly credits set to 0
   - Credits used reset to 0
   - Purchased credits preserved

#### Verification Checklist
- [ ] Database: `tier = 'free'`, `monthly_credits = 0`
- [ ] Frontend: Shows "Free" tier
- [ ] Purchase button: Hidden for free users
- [ ] Upgrade prompt: Visible

## Webhook Testing

### Manual Event Simulation

#### Using Stripe CLI
```bash
# Test subscription creation
stripe trigger customer.subscription.created

# Test successful payment
stripe trigger checkout.session.completed --add checkout_session:mode=payment

# Test subscription deletion
stripe trigger customer.subscription.deleted
```

#### Using Stripe Dashboard
1. Go to Developers → Webhooks
2. Select your webhook endpoint
3. Click "Send test webhook"
4. Choose event type and send

### Webhook Verification

#### Check Webhook Delivery
1. Stripe Dashboard → Webhooks → [Your Endpoint]
2. View recent deliveries and response codes
3. Verify 200 OK responses
4. Check payload and response details

#### Debug Failed Webhooks
```javascript
// Backend webhook handler logging
console.log('Webhook received:', {
  type: event.type,
  id: event.id,
  timestamp: new Date().toISOString()
});

console.log('Processing result:', {
  userId: user.id,
  oldTier: user.tier,
  newTier: newTier,
  creditsUpdated: true
});
```

## Database Verification

### SQL Queries for Testing

#### Check User Tier and Credits
```sql
SELECT 
  id, email, tier, 
  monthly_credits, credits_used, credits_purchased,
  stripe_subscription_id, credits_reset_date
FROM users 
WHERE email = 'test@example.com';
```

#### Check Recent Activities
```sql
SELECT 
  activity_type, details, created_at
FROM activities 
WHERE user_id = [USER_ID]
ORDER BY created_at DESC 
LIMIT 10;
```

#### Verify Credit Calculations
```sql
SELECT 
  email,
  monthly_credits,
  credits_purchased,
  credits_used,
  (monthly_credits + credits_purchased - credits_used) as remaining_credits
FROM users 
WHERE tier != 'free';
```

## Frontend Testing

### TierContext State Verification

#### Check Context Updates
```javascript
// Add to TierContext for debugging
useEffect(() => {
  console.log('TierContext updated:', {
    tier: tierInfo.tier,
    credits: tierInfo.credits,
    timestamp: new Date().toISOString()
  });
}, [tierInfo]);
```

#### Test UI Updates
1. **Credit Display**: Verify format changes based on tier
2. **Purchase Button**: Hidden for free users
3. **Progress Bar**: Reflects correct credit usage percentage
4. **Total Credits**: Shows combined monthly + purchased credits

### User Flow Testing

#### Complete User Journey
1. Start with free account
2. Upgrade to Pro subscription
3. Use some credits (simulate API calls)
4. Purchase additional credit bundle
5. Upgrade to Elite tier
6. Verify all UI updates correctly

## Error Scenarios

### Payment Failures

#### Test Declined Card
1. Use declined test card: 4000 0000 0000 0002
2. Verify error handling in checkout
3. Check no database changes occurred
4. Confirm user redirected to cancel URL

#### Test Network Issues
1. Stop ngrok tunnel during payment
2. Verify Stripe retries webhook delivery
3. Restart tunnel and confirm delayed processing

### Database Errors

#### Test User Not Found
1. Process webhook for non-existent user
2. Verify graceful error handling
3. Check error logs for debugging info

#### Test Constraint Violations
1. Attempt to set negative credits
2. Verify database constraints prevent invalid data
3. Check application error responses

## Automated Testing

### Jest Test Examples

#### Credit Calculation Tests
```javascript
describe('Credit Calculations', () => {
  test('should calculate total credits correctly', () => {
    const user = {
      monthly_credits: 500,
      credits_purchased: 250,
      credits_used: 100
    };
    
    const result = calculateCreditInfo(user);
    
    expect(result.total).toBe(750);
    expect(result.remaining).toBe(650);
  });
});
```

#### Tier Upgrade Tests
```javascript
describe('Tier Upgrades', () => {
  test('should reset credits on tier upgrade', () => {
    const result = handleTierUpgrade('free', 'pro');
    
    expect(result.monthly_credits).toBe(500);
    expect(result.credits_used).toBe(0);
  });
});
```

## Performance Testing

### Load Testing Webhooks
```bash
# Use artillery or similar tool
artillery quick --count 10 --num 2 https://abc123.ngrok.io/api/billing/webhook
```

### Concurrent Payment Testing
1. Simulate multiple users purchasing credits simultaneously
2. Verify database consistency
3. Check for race conditions in credit updates

## Production Testing Checklist

Before deploying to production:

- [ ] All test scenarios pass
- [ ] Webhook delivery successful (200 OK responses)
- [ ] Database constraints working properly
- [ ] Error handling covers edge cases
- [ ] Frontend UI updates correctly
- [ ] Performance acceptable under load
- [ ] Security measures (webhook signature verification)
- [ ] Environment variables configured correctly
- [ ] Monitoring and logging in place

## Integration Testing

### End-to-End Scenarios
1. **Complete subscription flow**: Free signup → Pro upgrade → Credit purchase → Feature usage
2. **Cancellation flow**: Active subscription → Cancellation → Downgrade verification
3. **Tier migration**: Pro → Elite → Institutional upgrade paths

### Cross-Browser Testing
- Test Stripe checkout on different browsers
- Verify webhook handling across environments
- Check responsive design on mobile devices

## Related Documentation

- [**Webhook Integration**](/help/Implementations/Stripe/stripe-webhooks) - Understanding webhook events
- [**Credit System**](/help/Implementations/Stripe/stripe-credits) - Credit calculation and management
- [**Troubleshooting**](/help/Implementations/Stripe/stripe-troubleshooting) - Debugging failed tests
- [**Architecture Overview**](/help/Implementations/Stripe/stripe-architecture) - System design context 