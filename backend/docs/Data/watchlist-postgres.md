# Watchlist Table

## Overview
The `watchlist` table stores user-specific lists of stocks they want to monitor. Each user can track multiple stocks with real-time price data and track price changes.

## Schema

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Unique watchlist entry identifier |
| `user_id` | UUID | NOT NULL, FOREIGN KEY | - | References `users(id)` |
| `symbol` | VARCHAR(10) | NOT NULL | - | Stock ticker symbol (e.g., 'AAPL') |
| `company_name` | VARCHAR(255) | NOT NULL | - | Full company name |
| `last_price` | DECIMAL(10,2) | - | NULL | Last known stock price |
| `price_change` | DECIMAL(5,2) | - | NULL | Price change percentage |
| `created_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | When stock was added to watchlist |
| `updated_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | Last price update timestamp |

## Constraints

### Primary Key
- `id` (UUID): Unique identifier for each watchlist entry

### Foreign Keys
- `user_id` → `users(id)` ON DELETE CASCADE

### Unique Constraints
- `(user_id, symbol)`: Prevents duplicate stocks in same user's watchlist

## Indexes

### Performance Indexes
```sql
CREATE INDEX idx_watchlist_user_id ON watchlist(user_id);
```

- **idx_watchlist_user_id**: Optimizes user-specific watchlist queries

## Triggers

### Auto-Update Timestamp
```sql
CREATE TRIGGER update_watchlist_updated_at
    BEFORE UPDATE ON watchlist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

This trigger updates `updated_at` whenever price data is refreshed.

## Relationships

### Many-to-One
- `watchlist` → `users` (via `user_id`)

### Data Sources
- Company data may reference `companies` table
- Price data fetched from external APIs (Alpha Vantage, etc.)

## Tier Limits

### Watchlist Size Limits
Different user tiers have different watchlist limits:

```javascript
const WATCHLIST_LIMITS = {
  free: 10,        // 10 stocks maximum
  pro: 50,         // 50 stocks maximum
  elite: 100,      // 100 stocks maximum
  institutional: -1 // Unlimited
};
```

## Common Queries

### Get User's Watchlist
```sql
SELECT id, symbol, company_name, last_price, price_change, created_at 
FROM watchlist 
WHERE user_id = $1 
ORDER BY symbol;
```

### Add Stock to Watchlist
```sql
INSERT INTO watchlist (user_id, symbol, company_name, last_price, price_change) 
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, symbol) DO NOTHING;
```

### Update Stock Price
```sql
UPDATE watchlist 
SET last_price = $1, price_change = $2, updated_at = CURRENT_TIMESTAMP 
WHERE user_id = $3 AND symbol = $4;
```

### Remove Stock from Watchlist
```sql
DELETE FROM watchlist 
WHERE user_id = $1 AND symbol = $2;
```

### Count Watchlist Size
```sql
SELECT COUNT(*) 
FROM watchlist 
WHERE user_id = $1;
```

## API Integration

### Price Data Sources
- **Alpha Vantage**: Real-time and historical price data
- **Internal Cache**: Cached price data to reduce API calls
- **Manual Updates**: Admin can manually update prices

### Update Frequency
- Real-time updates when user views watchlist
- Batch updates during off-hours
- Rate limited by tier and API quotas

## Data Validation

### Symbol Format
- Uppercase letters only
- Maximum 10 characters
- Valid stock ticker symbols

### Price Constraints
- `last_price`: Must be positive decimal
- `price_change`: Can be positive or negative percentage

## Example Data

```sql
INSERT INTO watchlist (user_id, symbol, company_name, last_price, price_change) 
VALUES 
  ('123e4567-e89b-12d3-a456-426614174000', 'AAPL', 'Apple Inc.', 150.25, 2.35),
  ('123e4567-e89b-12d3-a456-426614174000', 'GOOGL', 'Alphabet Inc.', 2750.80, -1.20),
  ('123e4567-e89b-12d3-a456-426614174000', 'TSLA', 'Tesla, Inc.', 890.50, 5.67);
```

## Business Logic

### Adding Stocks
1. Validate user tier limits
2. Check if stock already exists in watchlist
3. Fetch company data from external APIs
4. Store in `companies` table if new
5. Add to user's watchlist

### Price Updates
1. Batch process all watchlist stocks
2. Fetch latest prices from APIs
3. Calculate price change percentages
4. Update watchlist records
5. Trigger notifications if configured

## Security Considerations

### User Isolation
- All queries must filter by `user_id`
- Prevent cross-user data access
- Validate user ownership before modifications

### Data Privacy
- Watchlist data is private to each user
- No sharing between users unless explicitly configured
- Audit trail through `created_at` and `updated_at`

## Performance Considerations

### Indexing Strategy
- Primary index on `user_id` for fast user queries
- Consider composite index on `(user_id, symbol)` for frequent lookups

### Caching
- Cache frequently accessed watchlists
- Cache price data to reduce API calls
- Implement Redis for real-time price updates

## Migration Notes

### Schema Changes
When adding new columns:
```sql
ALTER TABLE watchlist ADD COLUMN new_column_name data_type DEFAULT default_value;
```

### Data Migration
- Preserve existing watchlist data during updates
- Handle price data format changes gracefully
- Maintain referential integrity during user migrations

## Related Files

- `backend/src/routes/watchlist.js` - API endpoints
- `backend/src/routes/stocks.js` - Stock data integration
- `backend/src/middleware/tierMiddleware.js` - Tier limit enforcement
- `backend/src/services/financialCalendar.js` - Price update service

## Monitoring

### Key Metrics
- Average watchlist size per user
- Price update frequency and success rate
- API quota usage per tier
- User engagement with watchlist features

### Alerts
- Failed price updates
- API quota exceeded
- Tier limit violations
- Database performance issues 