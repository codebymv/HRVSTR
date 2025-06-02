# Research Sessions Table

## Overview
The `research_sessions` table tracks user research sessions, enabling bundled credit pricing and session-based analytics. It groups related API calls and provides context for user research patterns and credit optimization.

## Schema

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | UUID | PRIMARY KEY | `uuid_generate_v4()` | Unique session identifier |
| `user_id` | UUID | NOT NULL, FOREIGN KEY | - | References `users(id)` |
| `session_id` | VARCHAR(100) | NOT NULL | - | Client-generated session identifier |
| `symbol` | VARCHAR(10) | NOT NULL | - | Primary stock symbol for research |
| `start_time` | TIMESTAMP WITH TIME ZONE | NOT NULL | - | Session start timestamp |
| `end_time` | TIMESTAMP WITH TIME ZONE | - | NULL | Session end timestamp |
| `credits_used` | INTEGER | NOT NULL | `0` | Total credits consumed in session |
| `queries_count` | INTEGER | NOT NULL | `0` | Number of API queries in session |
| `status` | VARCHAR(20) | NOT NULL | `'active'` | Session status |
| `metadata` | JSONB | - | `'{}'` | Session details and configurations |
| `created_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | Record creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | Last update timestamp |

## Constraints

### Primary Key
- `id` (UUID): Unique identifier for each session

### Foreign Keys
- `user_id` → `users(id)` ON DELETE CASCADE

## Indexes

### Performance Indexes
```sql
CREATE INDEX idx_research_sessions_user_id ON research_sessions(user_id);
CREATE INDEX idx_research_sessions_session_id ON research_sessions(session_id);
CREATE INDEX idx_research_sessions_status ON research_sessions(status);
```

### Recommended Additional Indexes
```sql
-- For active session lookups
CREATE INDEX idx_research_sessions_active ON research_sessions(user_id, status) 
WHERE status = 'active';

-- For time-based analysis
CREATE INDEX idx_research_sessions_time ON research_sessions(start_time, end_time);

-- For symbol-based analytics
CREATE INDEX idx_research_sessions_symbol ON research_sessions(symbol, created_at);
```

## Session Statuses

### Active States
- `active` - Session is currently running
- `paused` - Session temporarily suspended
- `completed` - Session finished successfully
- `timeout` - Session ended due to inactivity
- `error` - Session ended due to error
- `cancelled` - Session manually cancelled by user

## Triggers

### Auto-Update Timestamp
```sql
CREATE TRIGGER update_research_sessions_updated_at
    BEFORE UPDATE ON research_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## Metadata Structure

### Session Configuration
```json
{
  "tier": "pro",
  "bundle_type": "research_bundle",
  "data_sources": ["reddit", "finviz", "yahoo"],
  "filters": {
    "time_range": "1w",
    "sentiment_threshold": 0.5,
    "include_historical": true
  },
  "ui_context": {
    "page": "sentiment_scraper",
    "view_mode": "detailed",
    "auto_refresh": false
  }
}
```

### Session Results
```json
{
  "queries_breakdown": {
    "reddit_sentiment": 2,
    "finviz_sentiment": 1,
    "yahoo_sentiment": 1
  },
  "credits_breakdown": {
    "reddit_sentiment": 10,
    "finviz_sentiment": 3,
    "yahoo_sentiment": 2,
    "bundle_discount": -3
  },
  "data_quality": {
    "reddit_posts_found": 150,
    "finviz_data_age_hours": 2,
    "yahoo_sentiment_confidence": 0.85
  },
  "performance": {
    "total_duration_ms": 2500,
    "cache_hit_rate": 0.4,
    "rate_limited": false
  }
}
```

### Error Tracking
```json
{
  "error_type": "rate_limit_exceeded",
  "error_source": "reddit_api",
  "error_message": "Reddit API rate limit exceeded",
  "retry_count": 3,
  "fallback_used": true,
  "user_notified": true
}
```

## Common Queries

### Start New Research Session
```sql
INSERT INTO research_sessions (user_id, session_id, symbol, start_time, metadata) 
VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4) 
RETURNING id;
```

### Update Session Progress
```sql
UPDATE research_sessions 
SET credits_used = $1, 
    queries_count = $2, 
    metadata = $3,
    updated_at = CURRENT_TIMESTAMP
WHERE session_id = $4 AND user_id = $5;
```

### Complete Session
```sql
UPDATE research_sessions 
SET status = 'completed', 
    end_time = CURRENT_TIMESTAMP,
    credits_used = $1,
    queries_count = $2,
    metadata = $3,
    updated_at = CURRENT_TIMESTAMP
WHERE session_id = $4 AND user_id = $5;
```

### Get Active Sessions for User
```sql
SELECT session_id, symbol, start_time, credits_used, queries_count, metadata
FROM research_sessions 
WHERE user_id = $1 AND status = 'active'
ORDER BY start_time DESC;
```

### Get Session History
```sql
SELECT 
  session_id,
  symbol,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (COALESCE(end_time, CURRENT_TIMESTAMP) - start_time))/60 as duration_minutes,
  credits_used,
  queries_count,
  status,
  metadata
FROM research_sessions 
WHERE user_id = $1 
ORDER BY start_time DESC 
LIMIT 20;
```

### Session Analytics
```sql
-- Average session metrics by tier
SELECT 
  u.tier,
  COUNT(*) as session_count,
  AVG(rs.credits_used) as avg_credits_per_session,
  AVG(rs.queries_count) as avg_queries_per_session,
  AVG(EXTRACT(EPOCH FROM (COALESCE(rs.end_time, CURRENT_TIMESTAMP) - rs.start_time))/60) as avg_duration_minutes
FROM research_sessions rs
JOIN users u ON rs.user_id = u.id
WHERE rs.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.tier
ORDER BY avg_credits_per_session DESC;
```

## Business Logic

### Session Management
```javascript
class ResearchSessionManager {
  async startSession(userId, symbol, options = {}) {
    const sessionId = `session_${Date.now()}_${userId}`;
    const metadata = {
      tier: options.tier || 'free',
      bundle_type: options.bundleType || 'individual',
      data_sources: options.dataSources || [],
      ui_context: options.uiContext || {}
    };

    const result = await pool.query(`
      INSERT INTO research_sessions (user_id, session_id, symbol, start_time, metadata) 
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4) 
      RETURNING id
    `, [userId, sessionId, symbol, JSON.stringify(metadata)]);

    return { sessionId, id: result.rows[0].id };
  }

  async updateProgress(sessionId, creditsUsed, queriesCount, additionalMetadata = {}) {
    await pool.query(`
      UPDATE research_sessions 
      SET credits_used = $1, 
          queries_count = $2, 
          metadata = metadata || $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = $4
    `, [creditsUsed, queriesCount, JSON.stringify(additionalMetadata), sessionId]);
  }

  async completeSession(sessionId, finalMetadata = {}) {
    await pool.query(`
      UPDATE research_sessions 
      SET status = 'completed', 
          end_time = CURRENT_TIMESTAMP,
          metadata = metadata || $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = $2
    `, [JSON.stringify(finalMetadata), sessionId]);
  }
}
```

### Bundle Pricing Logic
```javascript
function calculateSessionCost(queries, tier, bundleType) {
  const CREDIT_COSTS = {
    reddit_sentiment: 5,
    finviz_sentiment: 3,
    yahoo_sentiment: 2
  };

  const BUNDLE_DISCOUNTS = {
    pro: { research_bundle: 0.2 },        // 20% discount
    elite: { research_bundle: 0.25 },     // 25% discount
    institutional: { research_bundle: 0.33 } // 33% discount
  };

  let totalCost = 0;
  for (const [queryType, count] of Object.entries(queries)) {
    totalCost += (CREDIT_COSTS[queryType] || 0) * count;
  }

  // Apply bundle discount
  const discount = BUNDLE_DISCOUNTS[tier]?.[bundleType] || 0;
  const discountedCost = Math.ceil(totalCost * (1 - discount));

  return {
    originalCost: totalCost,
    discountedCost,
    discount: totalCost - discountedCost,
    discountRate: discount
  };
}
```

## Analytics Queries

### Session Conversion Analysis
```sql
-- Conversion from session start to completion
SELECT 
  status,
  COUNT(*) as session_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM research_sessions 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY status
ORDER BY session_count DESC;
```

### Popular Research Symbols
```sql
-- Most researched symbols
SELECT 
  symbol,
  COUNT(*) as session_count,
  AVG(credits_used) as avg_credits_per_session,
  SUM(credits_used) as total_credits_spent
FROM research_sessions 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND status = 'completed'
GROUP BY symbol
ORDER BY session_count DESC
LIMIT 20;
```

### Session Duration Analysis
```sql
-- Session duration patterns
SELECT 
  CASE 
    WHEN duration_minutes < 5 THEN 'Under 5 min'
    WHEN duration_minutes < 15 THEN '5-15 min'
    WHEN duration_minutes < 30 THEN '15-30 min'
    WHEN duration_minutes < 60 THEN '30-60 min'
    ELSE 'Over 1 hour'
  END as duration_bucket,
  COUNT(*) as session_count,
  AVG(credits_used) as avg_credits
FROM (
  SELECT 
    EXTRACT(EPOCH FROM (COALESCE(end_time, CURRENT_TIMESTAMP) - start_time))/60 as duration_minutes,
    credits_used
  FROM research_sessions 
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
) t
GROUP BY duration_bucket
ORDER BY 
  CASE duration_bucket
    WHEN 'Under 5 min' THEN 1
    WHEN '5-15 min' THEN 2
    WHEN '15-30 min' THEN 3
    WHEN '30-60 min' THEN 4
    ELSE 5
  END;
```

## Session Cleanup

### Automatic Session Management
```sql
-- Auto-complete stale active sessions (over 1 hour old)
UPDATE research_sessions 
SET status = 'timeout', 
    end_time = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'active' 
  AND start_time < CURRENT_TIMESTAMP - INTERVAL '1 hour';

-- Clean up old sessions (keep last 6 months)
DELETE FROM research_sessions 
WHERE created_at < CURRENT_DATE - INTERVAL '6 months';
```

## Integration Patterns

### Frontend Session Tracking
```typescript
interface ResearchSession {
  id: string;
  symbol: string;
  startTime: string;
  creditsUsed: number;
  queries: number;
  status: 'active' | 'paused' | 'completed';
}

// Hook for managing research sessions
const useResearchSession = (symbol: string) => {
  const [session, setSession] = useState<ResearchSession | null>(null);
  
  const startSession = async () => {
    const response = await fetch('/api/credits/research-session', {
      method: 'POST',
      body: JSON.stringify({ action: 'start', symbol })
    });
    const data = await response.json();
    setSession(data.session);
  };
  
  const completeSession = async () => {
    if (session) {
      await fetch('/api/credits/research-session', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'complete', 
          sessionId: session.id 
        })
      });
      setSession(null);
    }
  };
  
  return { session, startSession, completeSession };
};
```

## Related Files

- `backend/src/routes/credits.js` - Session management endpoints
- `frontend/src/components/SentimentScraper/PremiumCreditControls.tsx` - Session UI
- `backend/src/middleware/premiumCreditMiddleware.js` - Credit deduction logic
- `frontend/src/hooks/useCreditBalance.ts` - Credit state management 