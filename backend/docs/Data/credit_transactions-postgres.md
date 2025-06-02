# Credit Transactions Table

## Overview
The `credit_transactions` table logs all credit-related operations for audit trails, billing transparency, and usage analytics. It tracks credit deductions for API usage, credit purchases, tier allocations, and refunds.

## Schema

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Unique transaction identifier |
| `user_id` | UUID | NOT NULL, FOREIGN KEY | - | References `users(id)` |
| `action` | VARCHAR(50) | NOT NULL | - | Type of credit transaction |
| `credits_used` | INTEGER | NOT NULL | - | Credits consumed (negative for purchases/refunds) |
| `credits_remaining` | INTEGER | NOT NULL | - | User's credit balance after transaction |
| `metadata` | JSONB | - | `'{}'` | Additional transaction details |
| `created_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | Transaction timestamp |

## Constraints

### Primary Key
- `id` (UUID): Unique identifier for each transaction

### Foreign Keys
- `user_id` → `users(id)` ON DELETE CASCADE

## Indexes

### Performance Indexes
```sql
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at);
```

### Recommended Additional Indexes
```sql
-- For action-based analytics
CREATE INDEX idx_credit_transactions_action ON credit_transactions(action);

-- For user activity analysis
CREATE INDEX idx_credit_transactions_user_time ON credit_transactions(user_id, created_at DESC);

-- For billing reports
CREATE INDEX idx_credit_transactions_purchases ON credit_transactions(action, created_at) 
WHERE action = 'credit_purchase';
```

## Transaction Types

### Credit Usage Actions
- `reddit_sentiment` - Reddit sentiment analysis (5 credits)
- `finviz_sentiment` - Finviz data fetch (3 credits)
- `yahoo_sentiment` - Yahoo sentiment analysis (2 credits)
- `research_bundle` - Combined research package (12 credits)
- `deep_analysis` - Advanced analytics (8 credits)
- `historical_data` - Historical data request (4 credits)

### System Actions
- `credit_purchase` - User purchased additional credits (negative value)
- `tier_allocation` - Monthly tier credit allocation (negative value)
- `tier_upgrade` - Credit adjustment for tier upgrade
- `tier_downgrade` - Credit adjustment for tier downgrade
- `refund` - Credit refund (negative value)
- `admin_adjustment` - Manual admin credit adjustment

### Free Actions (0 credits)
- `refresh_data` - Page/data refresh
- `page_load` - Page navigation
- `pagination` - Data pagination
- `filter` - Data filtering

## Metadata Structure

### Standard Fields
```json
{
  "tier": "pro",
  "original_cost": 5,
  "final_cost": 4,
  "discount_applied": true,
  "discount_rate": 0.2,
  "symbol": "AAPL",
  "session_id": "session_123456",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Purchase Metadata
```json
{
  "purchase_amount": 100,
  "payment_intent_id": "pi_stripe_12345",
  "tier": "pro",
  "payment_method": "card",
  "currency": "USD",
  "amount_paid": 9.99
}
```

### Research Session Metadata
```json
{
  "session_id": "session_20240115_123456",
  "symbol": "AAPL",
  "queries_in_session": 3,
  "session_duration_minutes": 15,
  "data_sources": ["reddit", "finviz", "yahoo"]
}
```

## Common Queries

### Get User Transaction History
```sql
SELECT action, credits_used, credits_remaining, metadata, created_at 
FROM credit_transactions 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 50;
```

### Log New Transaction
```sql
INSERT INTO credit_transactions (user_id, action, credits_used, credits_remaining, metadata) 
VALUES ($1, $2, $3, $4, $5);
```

### Get Credit Usage by Action Type
```sql
SELECT 
  action,
  COUNT(*) as transaction_count,
  SUM(credits_used) as total_credits_used,
  AVG(credits_used) as avg_credits_per_transaction
FROM credit_transactions 
WHERE user_id = $1 
  AND credits_used > 0 
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY action 
ORDER BY total_credits_used DESC;
```

### Monthly Credit Usage Report
```sql
SELECT 
  DATE_TRUNC('month', created_at) as month,
  SUM(CASE WHEN credits_used > 0 THEN credits_used ELSE 0 END) as credits_spent,
  SUM(CASE WHEN credits_used < 0 THEN ABS(credits_used) ELSE 0 END) as credits_purchased,
  COUNT(CASE WHEN action = 'credit_purchase' THEN 1 END) as purchase_count
FROM credit_transactions 
WHERE user_id = $1 
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
```

### Top Spenders (Admin Query)
```sql
SELECT 
  u.email,
  u.tier,
  SUM(CASE WHEN ct.credits_used > 0 THEN ct.credits_used ELSE 0 END) as total_credits_used,
  COUNT(CASE WHEN ct.action = 'credit_purchase' THEN 1 END) as purchases_made
FROM users u
JOIN credit_transactions ct ON u.id = ct.user_id
WHERE ct.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.id, u.email, u.tier
ORDER BY total_credits_used DESC
LIMIT 20;
```

## Business Logic

### Credit Deduction Flow
```javascript
async function deductCredits(userId, action, creditCost, metadata = {}) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get current user balance
    const userResult = await client.query(
      'SELECT monthly_credits, credits_used, credits_purchased FROM users WHERE id = $1',
      [userId]
    );
    
    const user = userResult.rows[0];
    const totalCredits = user.monthly_credits + (user.credits_purchased || 0);
    const remainingCredits = totalCredits - user.credits_used;
    
    if (remainingCredits < creditCost) {
      throw new Error('Insufficient credits');
    }
    
    // Update user credits
    await client.query(
      'UPDATE users SET credits_used = credits_used + $1 WHERE id = $2',
      [creditCost, userId]
    );
    
    // Log transaction
    await client.query(`
      INSERT INTO credit_transactions (user_id, action, credits_used, credits_remaining, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      userId,
      action,
      creditCost,
      remainingCredits - creditCost,
      JSON.stringify(metadata)
    ]);
    
    await client.query('COMMIT');
    return true;
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

## Analytics Queries

### Usage Patterns by Time
```sql
-- Hourly usage patterns
SELECT 
  EXTRACT(hour FROM created_at) as hour,
  COUNT(*) as transactions,
  SUM(credits_used) as credits_consumed
FROM credit_transactions 
WHERE credits_used > 0 
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY EXTRACT(hour FROM created_at)
ORDER BY hour;
```

### Popular Actions Analysis
```sql
-- Most popular credit-consuming actions
SELECT 
  action,
  COUNT(*) as usage_count,
  SUM(credits_used) as total_credits,
  AVG(credits_used) as avg_credits,
  COUNT(DISTINCT user_id) as unique_users
FROM credit_transactions 
WHERE credits_used > 0 
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY action
ORDER BY usage_count DESC;
```

### Revenue Attribution
```sql
-- Link credit purchases to usage
WITH purchases AS (
  SELECT user_id, SUM(ABS(credits_used)) as credits_bought
  FROM credit_transactions 
  WHERE action = 'credit_purchase'
    AND created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY user_id
),
usage AS (
  SELECT user_id, SUM(credits_used) as credits_spent
  FROM credit_transactions 
  WHERE credits_used > 0
    AND created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY user_id
)
SELECT 
  u.tier,
  COUNT(*) as users,
  AVG(COALESCE(p.credits_bought, 0)) as avg_credits_bought,
  AVG(COALESCE(u.credits_spent, 0)) as avg_credits_spent
FROM users usr
LEFT JOIN purchases p ON usr.id = p.user_id
LEFT JOIN usage u ON usr.id = u.user_id
GROUP BY usr.tier;
```

## Data Retention

### Cleanup Policy
- Keep detailed transactions for 2 years
- Archive to cold storage after 1 year
- Summarize for analytics before archival

```sql
-- Example archival query
CREATE TABLE credit_transactions_archive AS 
SELECT * FROM credit_transactions 
WHERE created_at < CURRENT_DATE - INTERVAL '1 year';

DELETE FROM credit_transactions 
WHERE created_at < CURRENT_DATE - INTERVAL '1 year';
```

## Security Considerations

### Data Protection
- Credit transactions contain financial information
- Ensure proper audit trails
- Implement access controls for transaction logs
- Encrypt sensitive metadata fields

### Fraud Prevention
- Monitor unusual credit usage patterns
- Implement rate limiting on high-cost actions
- Alert on bulk credit purchases
- Track IP addresses for security analysis

## Related Files

- `backend/src/middleware/premiumCreditMiddleware.js` - Credit checking and deduction
- `backend/src/routes/credits.js` - Credit management API
- `frontend/src/hooks/useCreditBalance.ts` - Frontend credit state management
- `frontend/src/components/SentimentScraper/PremiumCreditControls.tsx` - Credit UI component 