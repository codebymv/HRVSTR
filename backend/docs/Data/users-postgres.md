# Users Table

## Overview
The `users` table is the core authentication and user management table in HRVSTR. It stores user profile information, subscription tiers, credit limits, and Stripe integration data.

## Schema

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Unique user identifier |
| `email` | VARCHAR(255) | UNIQUE NOT NULL | - | User's email address (login identifier) |
| `name` | VARCHAR(255) | NOT NULL | - | User's display name |
| `tier` | user_tier_enum | NOT NULL | `'free'` | User's subscription tier |
| `credits_remaining` | INTEGER | NOT NULL | `50` | Current available credits |
| `credits_monthly_limit` | INTEGER | NOT NULL | `50` | Monthly credit limit based on tier |
| `credits_reset_date` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP + INTERVAL '1 month'` | When credits reset |
| `subscription_status` | VARCHAR(50) | - | `'active'` | Stripe subscription status |
| `stripe_customer_id` | VARCHAR(255) | - | NULL | Stripe customer identifier |
| `stripe_subscription_id` | VARCHAR(255) | - | NULL | Stripe subscription identifier |
| `created_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | Record creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | Last update timestamp |

## Enums

### user_tier_enum
```sql
CREATE TYPE user_tier_enum AS ENUM ('free', 'pro', 'elite', 'institutional');
```

| Value | Description | Typical Limits |
|-------|-------------|----------------|
| `free` | Free tier users | 50 credits/month, limited features |
| `pro` | Professional subscribers | Higher limits, more features |
| `elite` | Premium subscribers | Even higher limits, advanced features |
| `institutional` | Enterprise clients | Unlimited or very high limits |

## Indexes

- **Primary Key**: `id` (UUID)
- **Unique**: `email` (for authentication)

## Triggers

### Auto-Update Timestamp
```sql
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

This trigger automatically updates the `updated_at` field whenever a record is modified.

## Relationships

### One-to-Many
- `users` → `watchlist` (via `user_id`)
- `users` → `activities` (via `user_id`)
- `users` → `api_usage` (via `user_id`)
- `users` → `user_api_keys` (via `user_id`)

### CASCADE DELETE
All related records are deleted when a user is deleted:
- Watchlist entries
- Activity logs
- API usage records
- User API keys

## Credit System

### Credit Management
- **credits_remaining**: Current available credits
- **credits_monthly_limit**: Maximum credits per billing cycle
- **credits_reset_date**: When the credit counter resets

### Tier-Based Limits
Different tiers have different credit allocations and feature access:

```javascript
const TIER_LIMITS = {
  free: { daily_searches: 25, daily_price_updates: 25 },
  pro: { daily_searches: null, daily_price_updates: null }, // unlimited
  elite: { daily_searches: null, daily_price_updates: null }, // unlimited
  institutional: { daily_searches: null, daily_price_updates: null } // unlimited
};
```

## Stripe Integration

### Payment Processing
- **stripe_customer_id**: Links to Stripe customer object
- **stripe_subscription_id**: Links to Stripe subscription object
- **subscription_status**: Tracks subscription state

### Status Values
Common `subscription_status` values:
- `active`: Active subscription
- `canceled`: Subscription canceled
- `past_due`: Payment failed
- `trialing`: In trial period

## Common Queries

### Get User by Email
```sql
SELECT * FROM users WHERE email = $1;
```

### Update User Tier
```sql
UPDATE users 
SET tier = $1, credits_monthly_limit = $2, updated_at = CURRENT_TIMESTAMP 
WHERE id = $3;
```

### Deduct Credits
```sql
UPDATE users 
SET credits_remaining = credits_remaining - $1, updated_at = CURRENT_TIMESTAMP 
WHERE id = $2 AND credits_remaining >= $1;
```

### Reset Monthly Credits
```sql
UPDATE users 
SET credits_remaining = credits_monthly_limit, 
    credits_reset_date = CURRENT_TIMESTAMP + INTERVAL '1 month',
    updated_at = CURRENT_TIMESTAMP
WHERE credits_reset_date <= CURRENT_TIMESTAMP;
```

## Example Data

```sql
INSERT INTO users (email, name, tier, credits_remaining, credits_monthly_limit) 
VALUES 
  ('john@example.com', 'John Doe', 'free', 50, 50),
  ('jane@example.com', 'Jane Smith', 'pro', 1000, 1000),
  ('admin@example.com', 'Admin User', 'institutional', 999999, 999999);
```

## Security Considerations

### Data Protection
- Email addresses are unique and used for authentication
- No passwords stored (OAuth-only authentication)
- Stripe IDs are sensitive and should be handled securely

### Access Patterns
- Most queries filter by `id` (UUID) for user-specific data
- Email lookups only during authentication
- Tier checks for feature access control

## Migration Notes

### Adding New Tiers
When adding new tiers to the enum:
```sql
ALTER TYPE user_tier_enum ADD VALUE 'new_tier_name';
```

### Credit System Changes
The credit system can be disabled by setting limits to NULL or very high values for unlimited access.

## Related Files

- `backend/src/middleware/tierMiddleware.js` - Tier limit enforcement
- `backend/src/routes/auth.js` - User authentication
- `backend/src/routes/subscription.js` - Subscription management
- `backend/add-user-tiers.js` - Migration script for tiers 