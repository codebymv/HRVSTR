# Events Table

## Overview
The `events` table stores financial calendar events for stocks, including earnings announcements, dividend payments, stock splits, and other market-moving events. This data helps users track important dates for their watchlist stocks.

## Schema

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Unique event identifier |
| `symbol` | VARCHAR(10) | NOT NULL | - | Stock ticker symbol |
| `event_type` | VARCHAR(50) | NOT NULL | - | Type of financial event |
| `scheduled_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | - | When the event is scheduled |
| `status` | VARCHAR(20) | - | `'scheduled'` | Current status of the event |
| `title` | VARCHAR(255) | - | NULL | Event title/headline |
| `description` | TEXT | - | NULL | Detailed event description |
| `importance` | INTEGER | - | `1` | Event importance level (1-5) |
| `created_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | Record creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | Last update timestamp |

## Constraints

### Primary Key
- `id` (UUID): Unique identifier for each event

### Unique Constraints
Based on event type, some events have unique constraints:

```sql
-- Prevent duplicate earnings events for same symbol/date
ALTER TABLE events 
ADD CONSTRAINT unique_earnings_event 
UNIQUE (symbol, event_type, scheduled_at)
WHERE event_type = 'earnings';

-- Prevent duplicate dividend events for same symbol/date
ALTER TABLE events 
ADD CONSTRAINT unique_dividend_event 
UNIQUE (symbol, event_type, scheduled_at)
WHERE event_type = 'dividend';
```

## Indexes

### Performance Indexes
```sql
CREATE INDEX idx_events_symbol ON events(symbol);
CREATE INDEX idx_events_scheduled_at ON events(scheduled_at);
```

### Recommended Additional Indexes
```sql
-- For event type queries
CREATE INDEX idx_events_type ON events(event_type);

-- For status filtering
CREATE INDEX idx_events_status ON events(status);

-- Composite for symbol + date range queries
CREATE INDEX idx_events_symbol_date ON events(symbol, scheduled_at);

-- For importance-based filtering
CREATE INDEX idx_events_importance ON events(importance DESC);
```

## Triggers

### Auto-Update Timestamp
```sql
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## Event Types

### Core Financial Events
- `earnings` - Quarterly/annual earnings announcements
- `dividend` - Dividend payment dates
- `ex_dividend` - Ex-dividend dates
- `stock_split` - Stock split announcements
- `merger` - Merger and acquisition events
- `ipo` - Initial public offering dates

### Market Events
- `conference` - Investor conferences and presentations
- `analyst_day` - Company analyst days
- `product_launch` - Major product announcements
- `fda_approval` - FDA drug approvals (pharma companies)
- `clinical_trial` - Clinical trial results

### Corporate Actions
- `shareholder_meeting` - Annual/special shareholder meetings
- `spin_off` - Corporate spin-offs
- `delisting` - Stock delisting announcements
- `bankruptcy` - Bankruptcy filings
- `name_change` - Company name changes

## Event Status

### Status Values
- `scheduled` - Event is planned/scheduled
- `confirmed` - Event confirmed by company
- `cancelled` - Event has been cancelled
- `completed` - Event has occurred
- `postponed` - Event has been delayed
- `tentative` - Event date is tentative

### Status Transitions
```sql
-- Update event status
UPDATE events 
SET status = $1, updated_at = CURRENT_TIMESTAMP 
WHERE id = $2;
```

## Importance Levels

### Importance Scale (1-5)
- `1` - Low impact (minor announcements)
- `2` - Moderate impact (regular updates)
- `3` - Significant impact (earnings, dividends)
- `4` - High impact (major announcements)
- `5` - Critical impact (mergers, major events)

## Common Queries

### Get Upcoming Events for Symbol
```sql
SELECT * FROM events 
WHERE symbol = $1 
  AND scheduled_at >= CURRENT_TIMESTAMP 
  AND status IN ('scheduled', 'confirmed')
ORDER BY scheduled_at ASC;
```

### Get Events by Date Range
```sql
SELECT * FROM events 
WHERE scheduled_at BETWEEN $1 AND $2 
ORDER BY scheduled_at ASC, importance DESC;
```

### Get High-Importance Events
```sql
SELECT * FROM events 
WHERE importance >= 4 
  AND scheduled_at >= CURRENT_TIMESTAMP
  AND status = 'scheduled'
ORDER BY scheduled_at ASC;
```

### Get Events by Type
```sql
SELECT * FROM events 
WHERE event_type = $1 
  AND scheduled_at >= CURRENT_TIMESTAMP
ORDER BY scheduled_at ASC;
```

### Update Event Status
```sql
UPDATE events 
SET status = $1, updated_at = CURRENT_TIMESTAMP 
WHERE id = $2;
```

## Data Sources

### External APIs
- **Alpha Vantage**: Earnings calendar
- **IEX Cloud**: Corporate events
- **Quandl**: Financial calendar data
- **Company Websites**: Official announcements
- **SEC Filings**: Regulatory announcements

### Data Refresh
- Hourly updates for upcoming events
- Daily batch processing for new events
- Real-time updates for critical events
- Manual updates for special situations

## Example Data

```sql
INSERT INTO events (symbol, event_type, scheduled_at, status, title, description, importance) 
VALUES 
  ('AAPL', 'earnings', '2024-01-25 16:30:00+00', 'scheduled', 'Q1 2024 Earnings', 'Apple Inc. Q1 2024 earnings announcement', 4),
  ('MSFT', 'dividend', '2024-02-15 00:00:00+00', 'confirmed', 'Quarterly Dividend', 'Microsoft quarterly dividend payment', 3),
  ('TSLA', 'product_launch', '2024-03-01 18:00:00+00', 'tentative', 'Model Y Refresh', 'Tesla Model Y refresh announcement', 3),
  ('GOOGL', 'shareholder_meeting', '2024-05-20 14:00:00+00', 'scheduled', 'Annual Meeting', 'Alphabet annual shareholder meeting', 2);
```

## Business Logic

### Event Processing Pipeline
1. **Data Ingestion**: Fetch events from external sources
2. **Deduplication**: Check for existing events
3. **Validation**: Validate event data format
4. **Enrichment**: Add additional context/details
5. **Notification**: Alert users about relevant events

### Watchlist Integration
```javascript
// Get events for user's watchlist
async function getWatchlistEvents(userId) {
  const query = `
    SELECT e.* FROM events e
    INNER JOIN watchlist w ON e.symbol = w.symbol
    WHERE w.user_id = $1 
      AND e.scheduled_at >= CURRENT_TIMESTAMP
      AND e.status IN ('scheduled', 'confirmed')
    ORDER BY e.scheduled_at ASC, e.importance DESC
  `;
  return await pool.query(query, [userId]);
}
```

## Analytics & Reporting

### Event Metrics
- Events per symbol
- Event type distribution
- Importance level analysis
- Status change tracking

### User Engagement
- Most viewed event types
- Events driving watchlist additions
- Notification click-through rates
- Event impact on user activity

## Data Quality

### Validation Rules
- `scheduled_at` must be in the future for new events
- `event_type` must be from approved list
- `importance` must be between 1 and 5
- `symbol` must be valid stock ticker

### Data Cleanup
```sql
-- Remove old completed events
DELETE FROM events 
WHERE status = 'completed' 
  AND scheduled_at < CURRENT_TIMESTAMP - INTERVAL '6 months';

-- Update past events to completed
UPDATE events 
SET status = 'completed', updated_at = CURRENT_TIMESTAMP
WHERE scheduled_at < CURRENT_TIMESTAMP 
  AND status IN ('scheduled', 'confirmed');
```

## Notifications

### Event Alerts
- Email notifications for high-importance events
- Push notifications for mobile app
- In-app notifications for upcoming events
- SMS alerts for critical events (premium feature)

### Notification Timing
- 1 week before: Major events (importance 4-5)
- 1 day before: All scheduled events
- 1 hour before: High-importance events
- Real-time: Event status changes

## Performance Considerations

### Indexing Strategy
- Index on `symbol` for watchlist queries
- Index on `scheduled_at` for date range queries
- Composite indexes for common query patterns

### Caching
- Cache upcoming events by symbol
- Cache high-importance events
- Invalidate cache when events are updated

### Partitioning
For large datasets, consider date-based partitioning:
```sql
-- Partition by month for better performance
CREATE TABLE events_2024_01 PARTITION OF events
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Security Considerations

### Data Access
- Events are generally public information
- No user-specific access controls needed
- Rate limiting on event API endpoints

### Data Integrity
- Validate event sources
- Implement checksum verification
- Monitor for suspicious data changes

## Related Files

- `backend/src/services/financialCalendar.js` - Event processing service
- `backend/src/routes/events.js` - API endpoints
- `backend/src/scripts/create-events-table.js` - Table creation script
- `backend/alter-events.js` - Schema migration script
- `frontend/src/components/EventsCalendar.tsx` - UI component

## Migration Notes

### Schema Changes
The events table has evolved over time:
- Originally used `SERIAL` primary key, migrated to UUID
- Added importance field for better event prioritization
- Added unique constraints for duplicate prevention

### Data Migration
```sql
-- Example migration for importance field
UPDATE events SET importance = 3 WHERE event_type = 'earnings';
UPDATE events SET importance = 2 WHERE event_type = 'dividend';
UPDATE events SET importance = 4 WHERE event_type = 'merger';
```

## Monitoring & Alerting

### Key Metrics
- Event ingestion rate
- Data source reliability
- Event accuracy (actual vs scheduled)
- User engagement with events

### Alert Conditions
- Missing events for major stocks
- Duplicate event detection
- Data source failures
- Event date/time discrepancies 