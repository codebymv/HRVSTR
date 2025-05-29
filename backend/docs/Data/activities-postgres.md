# Activities Table

## Overview
The `activities` table logs user actions and system events for audit trails, analytics, and user activity tracking. It provides a comprehensive history of user interactions with the HRVSTR platform.

## Schema

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Unique activity identifier |
| `user_id` | UUID | NOT NULL, FOREIGN KEY | - | References `users(id)` |
| `activity_type` | VARCHAR(50) | NOT NULL | - | Type/category of activity |
| `title` | VARCHAR(255) | NOT NULL | - | Human-readable activity title |
| `description` | TEXT | - | NULL | Detailed activity description |
| `symbol` | VARCHAR(10) | - | NULL | Related stock symbol (if applicable) |
| `created_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | When activity occurred |

## Constraints

### Primary Key
- `id` (UUID): Unique identifier for each activity

### Foreign Keys
- `user_id` → `users(id)` ON DELETE CASCADE

## Indexes

### Performance Indexes
```sql
CREATE INDEX idx_activities_user_id ON activities(user_id);
```

- **idx_activities_user_id**: Optimizes user-specific activity queries

### Recommended Additional Indexes
```sql
-- For activity type filtering
CREATE INDEX idx_activities_type ON activities(activity_type);

-- For time-based queries
CREATE INDEX idx_activities_created_at ON activities(created_at);

-- Composite for user + time queries
CREATE INDEX idx_activities_user_time ON activities(user_id, created_at DESC);
```

## Activity Types

### User Actions
- `login` - User signed in
- `logout` - User signed out
- `search` - Stock search performed
- `watchlist_add` - Stock added to watchlist
- `watchlist_remove` - Stock removed from watchlist
- `profile_update` - User profile updated
- `tier_upgrade` - Subscription tier upgraded
- `tier_downgrade` - Subscription tier downgraded

### System Events
- `price_update` - Stock price updated
- `credit_deduction` - Credits deducted from account
- `credit_reset` - Monthly credits reset
- `api_call` - External API call made
- `error` - System error occurred

### Data Events
- `sec_filing` - SEC filing processed
- `earnings_announcement` - Earnings data updated
- `dividend_announcement` - Dividend data updated
- `news_update` - News article processed

## Relationships

### Many-to-One
- `activities` → `users` (via `user_id`)

### Optional References
- `symbol` may reference stocks in `watchlist` or `companies` tables
- Activities may relate to `events` table entries

## Common Queries

### Get User Activity History
```sql
SELECT activity_type, title, description, symbol, created_at 
FROM activities 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 50;
```

### Log New Activity
```sql
INSERT INTO activities (user_id, activity_type, title, description, symbol) 
VALUES ($1, $2, $3, $4, $5);
```

### Get Activities by Type
```sql
SELECT * FROM activities 
WHERE user_id = $1 AND activity_type = $2 
ORDER BY created_at DESC;
```

### Get Recent Activities (Last 24 Hours)
```sql
SELECT * FROM activities 
WHERE user_id = $1 
  AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Count Activities by Type
```sql
SELECT activity_type, COUNT(*) as count
FROM activities 
WHERE user_id = $1 
GROUP BY activity_type 
ORDER BY count DESC;
```

## Data Retention

### Cleanup Policies
- Keep activities for 1 year by default
- Archive old activities for analytics
- Implement periodic cleanup jobs

```sql
-- Example cleanup query (run as scheduled job)
DELETE FROM activities 
WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 year';
```

## Example Data

```sql
INSERT INTO activities (user_id, activity_type, title, description, symbol) 
VALUES 
  ('123e4567-e89b-12d3-a456-426614174000', 'login', 'User logged in', 'Successful authentication via Google OAuth', NULL),
  ('123e4567-e89b-12d3-a456-426614174000', 'search', 'Stock search', 'Searched for "Apple"', NULL),
  ('123e4567-e89b-12d3-a456-426614174000', 'watchlist_add', 'Added to watchlist', 'Added Apple Inc. to watchlist', 'AAPL'),
  ('123e4567-e89b-12d3-a456-426614174000', 'price_update', 'Price updated', 'Updated price for Apple Inc.', 'AAPL');
```

## Analytics Use Cases

### User Engagement
- Track login frequency
- Monitor feature usage patterns
- Identify most searched stocks
- Analyze watchlist management behavior

### System Monitoring
- Error rate tracking
- API usage patterns
- Performance monitoring
- Data quality metrics

### Business Intelligence
- User journey analysis
- Feature adoption rates
- Conversion funnel analysis
- Retention metrics

## Privacy Considerations

### Data Sensitivity
- Activities contain user behavior data
- Ensure GDPR/privacy compliance
- Implement data anonymization for analytics
- Provide user data export capabilities

### Access Control
- Only show user their own activities
- Admin access requires proper authorization
- Audit access to activity logs
- Implement data retention policies

## Performance Optimization

### Partitioning Strategy
Consider partitioning by date for large datasets:
```sql
-- Example monthly partitioning
CREATE TABLE activities_2024_01 PARTITION OF activities
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Query Optimization
- Use appropriate indexes for common query patterns
- Limit result sets with pagination
- Cache frequent activity summaries
- Archive old data to separate tables

## Integration Patterns

### Logging Activities
```javascript
// Example activity logging function
async function logActivity(userId, activityType, title, description = null, symbol = null) {
  try {
    await pool.query(
      'INSERT INTO activities (user_id, activity_type, title, description, symbol) VALUES ($1, $2, $3, $4, $5)',
      [userId, activityType, title, description, symbol]
    );
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - activity logging should not break main functionality
  }
}
```

### Middleware Integration
```javascript
// Express middleware to log route access
const logRouteAccess = (req, res, next) => {
  if (req.user) {
    logActivity(req.user.id, 'api_call', `${req.method} ${req.path}`, 
               `API call to ${req.originalUrl}`);
  }
  next();
};
```

## Security Considerations

### Input Validation
- Sanitize activity descriptions
- Validate activity types against allowed list
- Prevent SQL injection in custom queries
- Limit description length to prevent abuse

### Audit Trail
- Activities themselves serve as audit trail
- Critical actions should always be logged
- Include relevant context in descriptions
- Implement tamper detection if needed

## Related Files

- `backend/src/routes/activities.js` - API endpoints
- `backend/src/middleware/activityLogger.js` - Activity logging middleware
- `backend/src/services/analytics.js` - Analytics processing
- `frontend/src/components/ActivityFeed.tsx` - UI component

## Monitoring & Alerting

### Key Metrics
- Activities per user per day
- Error activity frequency
- Popular activity types
- Activity volume trends

### Alert Conditions
- Unusual activity spikes
- High error rates
- Failed activity logging
- Suspicious user behavior patterns

## Migration Notes

### Schema Evolution
When adding new activity types:
1. Update application code first
2. Deploy new activity types gradually
3. Monitor for unexpected activity patterns
4. Update analytics queries for new types

### Data Migration
- Preserve historical activity data
- Handle activity type renames gracefully
- Maintain referential integrity during user migrations
- Consider data format changes for descriptions 