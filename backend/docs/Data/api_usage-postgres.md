# API Usage Table

## Overview
The `api_usage` table tracks daily API consumption for each user to enforce tier-based rate limits. It monitors search queries, price updates, and other API-dependent operations to ensure fair usage and prevent abuse.

## Schema

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Unique usage record identifier |
| `user_id` | UUID | NOT NULL, FOREIGN KEY | - | References `users(id)` |
| `usage_date` | DATE | NOT NULL | - | Date of API usage (YYYY-MM-DD) |
| `daily_searches` | INTEGER | - | `0` | Number of stock searches performed |
| `daily_price_updates` | INTEGER | - | `0` | Number of price update operations |
| `created_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | Record creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | Last update timestamp |

## Constraints

### Primary Key
- `id` (UUID): Unique identifier for each usage record

### Foreign Keys
- `user_id` → `users(id)` ON DELETE CASCADE

### Unique Constraints
- `(user_id, usage_date)`: One record per user per day

## Indexes

### Performance Indexes
```sql
-- Already created in schema
CREATE INDEX idx_api_usage_user_date ON api_usage(user_id, usage_date);
```

### Recommended Additional Indexes
```sql
-- For date-based analytics
CREATE INDEX idx_api_usage_date ON api_usage(usage_date);

-- For finding high usage patterns
CREATE INDEX idx_api_usage_searches ON api_usage(daily_searches DESC);
CREATE INDEX idx_api_usage_updates ON api_usage(daily_price_updates DESC);
```

## Tier Limits

### Rate Limiting by Tier
Different user tiers have different daily limits:

```javascript
const TIER_LIMITS = {
  free: { 
    daily_searches: 25, 
    daily_price_updates: 25 
  },
  pro: { 
    daily_searches: null,    // unlimited
    daily_price_updates: null // unlimited
  },
  elite: { 
    daily_searches: null,    // unlimited
    daily_price_updates: null // unlimited
  },
  institutional: { 
    daily_searches: null,    // unlimited
    daily_price_updates: null // unlimited
  }
};
```

### Limit Enforcement
- `null` values indicate unlimited access
- Limits are checked before API operations
- Users are blocked when limits are exceeded

## Common Queries

### Get Today's Usage for User
```sql
SELECT daily_searches, daily_price_updates 
FROM api_usage 
WHERE user_id = $1 AND usage_date = CURRENT_DATE;
```

### Increment Search Count
```sql
INSERT INTO api_usage (user_id, usage_date, daily_searches) 
VALUES ($1, CURRENT_DATE, 1)
ON CONFLICT (user_id, usage_date) 
DO UPDATE SET 
  daily_searches = api_usage.daily_searches + 1,
  updated_at = CURRENT_TIMESTAMP;
```

### Increment Price Update Count
```sql
INSERT INTO api_usage (user_id, usage_date, daily_price_updates) 
VALUES ($1, CURRENT_DATE, 1)
ON CONFLICT (user_id, usage_date) 
DO UPDATE SET 
  daily_price_updates = api_usage.daily_price_updates + 1,
  updated_at = CURRENT_TIMESTAMP;
```

### Check if User Can Perform Operation
```sql
-- For search operation
SELECT 
  COALESCE(daily_searches, 0) as current_usage,
  CASE 
    WHEN u.tier = 'free' THEN 25
    ELSE NULL 
  END as daily_limit
FROM users u
LEFT JOIN api_usage au ON u.id = au.user_id AND au.usage_date = CURRENT_DATE
WHERE u.id = $1;
```

### Get Usage Statistics
```sql
-- Weekly usage summary
SELECT 
  DATE_TRUNC('week', usage_date) as week,
  SUM(daily_searches) as total_searches,
  SUM(daily_price_updates) as total_updates,
  COUNT(DISTINCT user_id) as active_users
FROM api_usage 
WHERE usage_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('week', usage_date)
ORDER BY week DESC;
```

## Usage Patterns

### Tracked Operations

#### Daily Searches (`daily_searches`)
- Stock symbol searches via `/api/stocks/search`
- Company name lookups
- Symbol validation requests
- Autocomplete suggestions

#### Daily Price Updates (`daily_price_updates`)
- Individual stock price fetches
- Bulk watchlist price updates
- Real-time price refreshes
- Historical data requests

### Future Expansions
Additional usage types can be added:
```sql
ALTER TABLE api_usage ADD COLUMN daily_news_requests INTEGER DEFAULT 0;
ALTER TABLE api_usage ADD COLUMN daily_sec_requests INTEGER DEFAULT 0;
ALTER TABLE api_usage ADD COLUMN daily_earnings_requests INTEGER DEFAULT 0;
```

## Business Logic

### Usage Tracking Function
```javascript
async function checkAndIncrementUsage(userId, usageType, userTier) {
  try {
    // Get current usage
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(
      'SELECT * FROM api_usage WHERE user_id = $1 AND usage_date = $2',
      [userId, today]
    );

    const currentUsage = result.rows[0] || { daily_searches: 0, daily_price_updates: 0 };
    const limits = TIER_LIMITS[userTier] || TIER_LIMITS.free;

    // Check limit
    const currentCount = currentUsage[usageType] || 0;
    const limit = limits[usageType];

    if (limit !== null && currentCount >= limit) {
      throw new Error(`Daily ${usageType} limit exceeded (${limit})`);
    }

    // Increment usage
    const incrementField = usageType === 'daily_searches' ? 'daily_searches' : 'daily_price_updates';
    await pool.query(`
      INSERT INTO api_usage (user_id, usage_date, ${incrementField}) 
      VALUES ($1, CURRENT_DATE, 1)
      ON CONFLICT (user_id, usage_date) 
      DO UPDATE SET 
        ${incrementField} = api_usage.${incrementField} + 1,
        updated_at = CURRENT_TIMESTAMP
    `, [userId]);

    return true;
  } catch (error) {
    console.error('Usage tracking error:', error);
    throw error;
  }
}
```

### Rate Limiting Middleware
```javascript
const rateLimitMiddleware = (usageType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userTier = req.user.tier || 'free';

      await checkAndIncrementUsage(userId, usageType, userTier);
      next();
    } catch (error) {
      res.status(429).json({ 
        message: error.message,
        type: 'RATE_LIMIT_EXCEEDED' 
      });
    }
  };
};
```

## Data Retention

### Cleanup Strategy
- Keep detailed daily records for 1 year
- Archive to monthly summaries after 1 year
- Permanent deletion after 3 years

```sql
-- Monthly cleanup job
DELETE FROM api_usage 
WHERE usage_date < CURRENT_DATE - INTERVAL '1 year';

-- Archive to monthly summary table
INSERT INTO api_usage_monthly_archive (user_id, year_month, total_searches, total_updates)
SELECT 
  user_id,
  DATE_TRUNC('month', usage_date) as year_month,
  SUM(daily_searches) as total_searches,
  SUM(daily_price_updates) as total_updates
FROM api_usage 
WHERE usage_date < CURRENT_DATE - INTERVAL '11 months'
GROUP BY user_id, DATE_TRUNC('month', usage_date);
```

## Analytics

### Usage Metrics
- Daily active users by tier
- Average API calls per user
- Peak usage times and patterns
- Tier upgrade triggers (hitting limits)

### Performance Insights
- Most popular search terms
- Heaviest API consumers
- Geographic usage patterns
- Feature adoption by tier

### Example Analytics Queries
```sql
-- Users hitting their limits
SELECT u.email, u.tier, au.daily_searches, au.daily_price_updates
FROM api_usage au
JOIN users u ON au.user_id = u.id
WHERE au.usage_date = CURRENT_DATE
  AND (
    (u.tier = 'free' AND au.daily_searches >= 25) OR
    (u.tier = 'free' AND au.daily_price_updates >= 25)
  );

-- Top API consumers
SELECT u.email, u.tier, SUM(au.daily_searches + au.daily_price_updates) as total_calls
FROM api_usage au
JOIN users u ON au.user_id = u.id
WHERE au.usage_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY u.id, u.email, u.tier
ORDER BY total_calls DESC
LIMIT 20;
```

## Monitoring & Alerting

### Key Metrics to Monitor
- Daily API usage volumes
- Tier limit hit rates
- Unusual usage spikes
- Error rates in usage tracking

### Alert Thresholds
- Free tier users hitting limits > 80%
- Overall API usage growing > 50% week-over-week
- Usage tracking failures
- Database performance degradation

### Monitoring Queries
```sql
-- Daily usage summary
SELECT 
  usage_date,
  COUNT(DISTINCT user_id) as active_users,
  SUM(daily_searches) as total_searches,
  SUM(daily_price_updates) as total_updates,
  AVG(daily_searches + daily_price_updates) as avg_per_user
FROM api_usage 
WHERE usage_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY usage_date
ORDER BY usage_date DESC;
```

## Example Data

```sql
INSERT INTO api_usage (user_id, usage_date, daily_searches, daily_price_updates) 
VALUES 
  ('123e4567-e89b-12d3-a456-426614174000', '2024-01-15', 15, 8),
  ('123e4567-e89b-12d3-a456-426614174000', '2024-01-16', 22, 12),
  ('789e4567-e89b-12d3-a456-426614174001', '2024-01-15', 5, 3),
  ('789e4567-e89b-12d3-a456-426614174001', '2024-01-16', 8, 5);
```

## Security Considerations

### Rate Limit Bypass Prevention
- Server-side validation only
- No client-side limit checking
- Cryptographic request signing (future)
- IP-based secondary limits (future)

### Data Privacy
- Usage data is user-specific
- Aggregate analytics only for business intelligence
- GDPR compliance for data export/deletion
- No sharing of individual usage patterns

## Performance Optimization

### Caching Strategy
- Cache current day's usage in Redis
- Batch database updates
- Lazy loading for historical data
- Precomputed daily summaries

### Database Optimization
- Partition by date for large datasets
- Regular VACUUM and ANALYZE
- Connection pooling for high concurrency
- Read replicas for analytics queries

## Migration Notes

### Schema Evolution
The table has evolved from simpler tracking:
```sql
-- Original schema (simplified)
CREATE TABLE api_usage (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  usage_date DATE NOT NULL,
  daily_searches INTEGER DEFAULT 0,
  daily_price_updates INTEGER DEFAULT 0
);

-- Migration to UUID primary keys
ALTER TABLE api_usage ALTER COLUMN id SET DATA TYPE UUID USING uuid_generate_v4();
```

## Related Files

- `backend/src/middleware/tierMiddleware.js` - Rate limiting implementation
- `backend/src/routes/stocks.js` - Search endpoint with usage tracking
- `backend/src/routes/watchlist.js` - Price update tracking
- `backend/create_api_usage_table.sql` - Table creation script
- `backend/migrate_api_usage.js` - Migration script 