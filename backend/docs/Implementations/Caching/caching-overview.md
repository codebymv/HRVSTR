# HRVSTR Caching Architecture Overview

## Executive Summary

HRVSTR implements a **sophisticated session-based caching architecture** that combines user account tracking, credit management, and database-backed caching. This system has evolved from device-centric localStorage caching to a cross-device, user-centric approach that prevents double-charging and ensures consistent data access across all user devices.

## Architectural Evolution

### Previous Approach: Device-Centric localStorage
❌ **Problems with localStorage-only caching:**
- Device-specific storage (no cross-device synchronization)
- No user isolation or account tracking
- Fixed expiration times regardless of user tier
- Memory limitations and storage constraints
- No integration with credit/billing system
- Potential for users to be charged multiple times for same data

### Current Approach: Session-Based Database Caching
✅ **Sophisticated database-backed system:**
- **Cross-device user account tracking** via PostgreSQL
- **Session-based component unlocking** prevents double-charging
- **Tier-based cache expiration** optimizes cost and performance
- **Database layer caching** with user-specific isolation
- **Automatic cleanup** and maintenance
- **Credit system integration** with audit trails

## Core Architecture Components

### 1. Session Management (`research_sessions` table)

The foundation of the caching system is sophisticated session tracking:

```sql
-- Core session tracking for component access
CREATE TABLE research_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  component VARCHAR(100) NOT NULL, -- 'earningsAnalysis', 'insiderTrading', etc.
  credits_used INTEGER NOT NULL DEFAULT 0,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,   -- Tier-based duration
  status VARCHAR(20) DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key Features:**
- **Cross-device access**: Sessions stored in PostgreSQL, accessible from any device
- **Prevents double-charging**: Active session check before credit deduction
- **Tier-based expiration**: Session duration varies by user tier
- **Component granularity**: Individual tracking per feature (earnings, SEC filings, etc.)

### 2. User-Specific Cache Storage

Each feature implements dedicated cache tables with user isolation:

#### SEC Filings Cache
```sql
-- Main SEC cache with user isolation
CREATE TABLE user_sec_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_type sec_data_type_enum NOT NULL, -- 'insider_trades', 'institutional_holdings'
    time_range VARCHAR(10) NOT NULL,
    data_json JSONB NOT NULL,
    metadata JSONB,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    credits_used INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, data_type, time_range) -- One cache per user per data type per range
);

-- Detailed insider trades storage
CREATE TABLE user_sec_insider_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_id UUID NOT NULL REFERENCES user_sec_cache(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    insider_name VARCHAR(255) NOT NULL,
    trade_type VARCHAR(20) NOT NULL,
    shares BIGINT NOT NULL,
    price DECIMAL(12,4),
    value DECIMAL(15,2),
    filing_date TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_data JSONB
);

-- Institutional holdings storage  
CREATE TABLE user_sec_institutional_holdings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_id UUID NOT NULL REFERENCES user_sec_cache(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    institution_name VARCHAR(255) NOT NULL,
    shares_held BIGINT NOT NULL,
    value_held DECIMAL(15,2),
    percentage_ownership DECIMAL(8,4),
    filing_date TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_data JSONB
);
```

#### Earnings Cache
```sql
-- User-specific earnings cache (inferred structure)
CREATE TABLE user_earnings_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_type earnings_data_type_enum NOT NULL, -- 'upcoming_earnings', 'earnings_analysis'
    time_range VARCHAR(10) NOT NULL,
    ticker VARCHAR(20), -- For analysis-specific data
    data_json JSONB NOT NULL,
    metadata JSONB,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    credits_used INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, data_type, time_range, ticker)
);
```

#### Sentiment Research Cache
```sql
-- Session-based sentiment data cache
CREATE TABLE sentiment_research_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL REFERENCES research_sessions(session_id),
    query_type VARCHAR(50) NOT NULL, -- 'reddit_sentiment', 'finviz_sentiment', etc.
    tickers TEXT[] NOT NULL,
    time_range VARCHAR(10) NOT NULL,
    sentiment_data JSONB NOT NULL,
    api_metadata JSONB,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    credits_consumed INTEGER DEFAULT 0
);
```

## Three-Tier Access Pattern

All caching services implement a sophisticated three-tier access pattern:

### Tier 1: Active Session Check
```javascript
// Check for active unlock session first
const componentName = getComponentName(dataType);
const sessionQuery = `
  SELECT session_id, expires_at, credits_used, metadata
  FROM research_sessions 
  WHERE user_id = $1 
    AND component = $2 
    AND status = 'active' 
    AND expires_at > CURRENT_TIMESTAMP
  ORDER BY unlocked_at DESC 
  LIMIT 1
`;

const hasActiveSession = (await db.query(sessionQuery, [userId, componentName])).rows.length > 0;

if (hasActiveSession) {
  // User has paid for access - check cache first, fetch fresh if needed
  // NO CREDITS CHARGED during active session
  const cachedData = await getCachedData(userId, dataType, timeRange);
  if (cachedData && !forceRefresh) {
    return { success: true, data: cachedData.data, fromCache: true, creditsUsed: 0 };
  }
  
  // No cache but has session - fetch fresh data without charging
  const freshData = await fetchFreshData(dataType, timeRange);
  await cacheData(userId, dataType, timeRange, freshData, 0, userTier);
  return { success: true, data: freshData, creditsUsed: 0, freshlyFetched: true };
}
```

### Tier 2: Cache Check (No Active Session)
```javascript
// No active session - check cache
if (!forceRefresh) {
  const cachedData = await getCachedData(userId, dataType, timeRange);
  if (cachedData) {
    return { success: true, data: cachedData.data, fromCache: true, hasActiveSession: false };
  }
}
```

### Tier 3: Credit Deduction and Fresh Fetch
```javascript
// No cache - charge credits and fetch fresh data
const creditsRequired = await calculateCreditsCost(userTier, dataType, timeRange);
const userCredits = await checkUserCredits(userId);

if (userCredits < creditsRequired) {
  return { success: false, error: 'INSUFFICIENT_CREDITS', creditsRequired, creditsAvailable: userCredits };
}

// Deduct credits and fetch fresh data
await deductCredits(userId, creditsRequired);
const freshData = await fetchFreshData(dataType, timeRange);
await cacheData(userId, dataType, timeRange, freshData, creditsRequired, userTier);

return { success: true, data: freshData, creditsUsed: creditsRequired, freshlyFetched: true };
```

## Tier-Based Configuration

### Session Duration by User Tier
```javascript
const getSessionDuration = (tier) => {
  const tierSessionDurations = {
    free: 30 * 60 * 1000,        // 30 minutes
    pro: 2 * 60 * 60 * 1000,     // 2 hours
    elite: 4 * 60 * 60 * 1000,   // 4 hours
    institutional: 8 * 60 * 60 * 1000 // 8 hours
  };
  return tierSessionDurations[tier.toLowerCase()] || tierSessionDurations.free;
};
```

### Cache Expiration by User Tier
```sql
-- Function to get cache expiration based on tier and data type
CREATE OR REPLACE FUNCTION get_cache_expiration(
  user_tier user_tier_enum,
  data_type VARCHAR
) RETURNS INTERVAL AS $$
BEGIN
  RETURN CASE user_tier
    WHEN 'free' THEN INTERVAL '30 minutes' -- Encourages upgrades
    WHEN 'pro' THEN INTERVAL '2 hours'     -- Good balance
    WHEN 'elite' THEN INTERVAL '4 hours'   -- Premium experience  
    WHEN 'institutional' THEN INTERVAL '30 minutes' -- Ultra-fresh data for institutions
    ELSE INTERVAL '30 minutes'
  END;
END;
$$ LANGUAGE plpgsql;
```

### Credit Costs by Tier
```sql
-- Dynamic credit costs based on user tier and data complexity
CREATE OR REPLACE FUNCTION get_data_credits_cost(
  user_tier user_tier_enum,
  data_type VARCHAR,
  time_range VARCHAR
) RETURNS INTEGER AS $$
BEGIN
  RETURN CASE user_tier
    WHEN 'free' THEN
      CASE data_type
        WHEN 'insider_trades' THEN 15 -- Standard cost for free tier
        WHEN 'institutional_holdings' THEN 999999 -- Effectively blocked
        WHEN 'earnings_analysis' THEN 8
        ELSE 10
      END
    WHEN 'pro' THEN
      CASE data_type
        WHEN 'insider_trades' THEN 6 -- Discounted for pro
        WHEN 'institutional_holdings' THEN 9
        WHEN 'earnings_analysis' THEN 5
        ELSE 4
      END
    WHEN 'elite', 'institutional' THEN
      -- Minimal costs for premium tiers
      CASE data_type
        WHEN 'insider_trades' THEN 1
        WHEN 'institutional_holdings' THEN 2
        WHEN 'earnings_analysis' THEN 1
        ELSE 1
      END
    ELSE 10 -- Default fallback
  END;
END;
$$ LANGUAGE plpgsql;
```

## Cross-Device Synchronization

### Frontend Session Checking
```typescript
// Check sessions across devices via API calls
const checkExistingSessions = async () => {
  try {
    // Primary: Check database sessions via API
    const earningsSession = await checkComponentAccess('earningsAnalysis');
    const insiderSession = await checkComponentAccess('insiderTrading');
    const institutionalSession = await checkComponentAccess('institutionalHoldings');

    setUnlockedComponents({
      earningsAnalysis: !!earningsSession,
      insiderTrading: !!insiderSession,
      institutionalHoldings: !!institutionalSession
    });

    console.log('🔍 Active sessions found:', {
      earningsAnalysis: earningsSession?.sessionId,
      insiderTrading: insiderSession?.sessionId,
      institutionalHoldings: institutionalSession?.sessionId
    });
  } catch (error) {
    // Fallback to localStorage for offline scenarios only
    console.warn('Database session check failed, using localStorage fallback');
    // ... fallback logic
  }
};
```

### Component Unlock Process
```typescript
const handleUnlockComponent = async (component: string, cost: number) => {
  // 1. Check for existing session (prevents double-charging)
  const existingSession = await checkComponentAccess(component);
  if (existingSession) {
    const timeRemaining = getSessionTimeRemainingFormatted(existingSession);
    showMessage(`${component} already unlocked (${timeRemaining})`);
    return;
  }
  
  // 2. Create new session in database
  const response = await fetch('/api/credits/unlock-component', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ component, cost })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // 3. Update UI state immediately (all devices will see this)
    setUnlockedComponents(prev => ({ ...prev, [component]: true }));
    
    // 4. Store in localStorage for offline fallback only
    storeUnlockSession(component, {
      sessionId: data.sessionId,
      expiresAt: data.expiresAt,
      creditsUsed: data.creditsUsed,
      tier: tierInfo?.tier
    });
    
    // 5. Session is now active across ALL user devices
    // Any device can now access cached data or fetch fresh data without charges
  }
};
```

## Automatic Cache Cleanup & Maintenance

### Scheduled Cleanup Functions
```sql
-- Cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    total_cleaned INTEGER := 0;
    sec_cleaned INTEGER;
    earnings_cleaned INTEGER;
    sentiment_cleaned INTEGER;
BEGIN
    -- SEC cache cleanup
    DELETE FROM user_sec_cache WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS sec_cleaned = ROW_COUNT;
    
    -- Earnings cache cleanup
    DELETE FROM user_earnings_cache WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS earnings_cleaned = ROW_COUNT;
    
    -- Sentiment cache cleanup
    DELETE FROM sentiment_research_data WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS sentiment_cleaned = ROW_COUNT;
    
    -- Session cleanup
    UPDATE research_sessions 
    SET status = 'expired' 
    WHERE status = 'active' AND expires_at < CURRENT_TIMESTAMP;
    
    total_cleaned := sec_cleaned + earnings_cleaned + sentiment_cleaned;
    RETURN total_cleaned;
END;
$$ LANGUAGE plpgsql;
```

### Automated Maintenance Scheduler
```javascript
// Backend cleanup scheduler
class CacheCleanupScheduler {
  constructor() {
    this.isRunning = false;
    this.intervals = new Map();
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Main cache cleanup every 15 minutes
    const mainCleanup = setInterval(async () => {
      try {
        const result = await db.query('SELECT cleanup_expired_cache()');
        const cleaned = result.rows[0].cleanup_expired_cache;
        
        if (cleaned > 0) {
          console.log(`✅ Cache cleanup: ${cleaned} records removed`);
        }
      } catch (error) {
        console.error('❌ Cache cleanup failed:', error);
      }
    }, 15 * 60 * 1000);
    
    // Session cleanup every 5 minutes
    const sessionCleanup = setInterval(async () => {
      try {
        const result = await db.query('SELECT cleanup_expired_sessions()');
        const cleaned = result.rows[0].cleanup_expired_sessions;
        
        if (cleaned > 0) {
          console.log(`✅ Session cleanup: ${cleaned} sessions expired`);
        }
      } catch (error) {
        console.error('❌ Session cleanup failed:', error);
      }
    }, 5 * 60 * 1000);
    
    this.intervals.set('main', mainCleanup);
    this.intervals.set('sessions', sessionCleanup);
    
    console.log('🚀 Cache cleanup scheduler started');
  }
}

// Auto-start cleanup
const cleanupScheduler = new CacheCleanupScheduler();
cleanupScheduler.start();
```

## Performance Optimizations

### Strategic Database Indexing
```sql
-- Primary performance indexes for all cache tables
CREATE INDEX IF NOT EXISTS idx_user_sec_cache_user_id ON user_sec_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sec_cache_expires_at ON user_sec_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sec_cache_user_type_range ON user_sec_cache(user_id, data_type, time_range);

CREATE INDEX IF NOT EXISTS idx_user_earnings_cache_user_id ON user_earnings_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_user_earnings_cache_expires_at ON user_earnings_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_sentiment_research_data_user_id ON sentiment_research_data(user_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_research_data_session_id ON sentiment_research_data(session_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_research_data_expires_at ON sentiment_research_data(expires_at);

-- Session-related indexes
CREATE INDEX IF NOT EXISTS idx_research_sessions_user_component ON research_sessions(user_id, component);
CREATE INDEX IF NOT EXISTS idx_research_sessions_active ON research_sessions(user_id, status) WHERE status = 'active';
```

### Efficient Query Patterns
```javascript
// Single query to check cache with expiration
async function getCachedData(userId, dataType, timeRange) {
  const query = `
    SELECT 
      data_json,
      metadata,
      expires_at,
      credits_used,
      EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)) as seconds_until_expiry
    FROM user_cache_table 
    WHERE user_id = $1 
      AND data_type = $2 
      AND time_range = $3
      AND expires_at > CURRENT_TIMESTAMP
    ORDER BY created_at DESC 
    LIMIT 1
  `;
  
  const result = await db.query(query, [userId, dataType, timeRange]);
  
  if (result.rows.length === 0) return null;
  
  const cached = result.rows[0];
  return {
    data: cached.data_json,
    metadata: cached.metadata,
    expiresAt: cached.expires_at,
    secondsUntilExpiry: Math.round(cached.seconds_until_expiry),
    fromCache: true
  };
}
```

## Security & Data Isolation

### Complete User Data Separation
- All cache queries include `user_id` filter for complete data isolation
- No cross-user data access possible through any API endpoint
- Session validation prevents unauthorized access attempts
- Automatic cleanup removes expired data to minimize storage exposure

### Credit System Integration
- Credits checked before any expensive operations
- Session validation prevents double-charging users
- Complete audit trail in `credit_transactions` table
- Tier restrictions enforced at database level

### Audit Trail
```sql
-- Complete transaction logging
INSERT INTO credit_transactions (
  user_id, 
  action, 
  credits_used, 
  credits_remaining, 
  metadata,
  created_at
) VALUES (
  $1, 
  $2, -- 'sec_insider_trades', 'earnings_analysis', etc.
  $3, -- credits deducted
  $4, -- remaining balance
  $5, -- detailed metadata
  CURRENT_TIMESTAMP
);
```

## System Benefits

The sophisticated session-based caching architecture provides:

### 1. Cross-Device Consistency
- **Same user, any device**: Sessions work identically across desktop, mobile, tablet
- **Real-time synchronization**: Component unlocks immediately available on all devices
- **No device limitations**: No localStorage size restrictions or device-specific issues

### 2. Cost Efficiency & Fair Billing
- **Prevents double-charging**: Active session checks before any credit deduction
- **Tier-based optimization**: Cache duration and costs adjust per user tier
- **Credit transparency**: Complete audit trail for all transactions

### 3. Performance Excellence
- **Sub-millisecond cache lookups**: Strategic database indexing
- **Intelligent loading**: Three-tier access pattern minimizes API calls
- **Automatic maintenance**: Background cleanup ensures optimal performance

### 4. Developer Experience
- **Unified patterns**: Consistent implementation across all features
- **Comprehensive debugging**: Database-backed debugging and monitoring
- **Maintainable code**: Clear separation of concerns and well-documented APIs

### 5. Scalability & Reliability
- **PostgreSQL backing**: Enterprise-grade database storage
- **Automatic cleanup**: Prevents database bloat and ensures consistency
- **Error resilience**: Graceful fallbacks and comprehensive error handling

## Migration from localStorage

### Breaking Changes
1. **Authentication required**: Users must be logged in for all caching functionality
2. **Database dependency**: Cache functionality requires active database connection
3. **Credit integration**: Failed credit checks prevent data access
4. **Session management**: Component access now requires session unlocking

### Backward Compatibility
The system maintains localStorage as a fallback for offline scenarios:

```typescript
// Graceful fallback pattern
try {
  // Primary: Check database sessions
  const session = await checkComponentAccess(component);
  return session;
} catch (error) {
  // Fallback: Check localStorage for offline scenarios
  console.warn('Database unavailable, using localStorage fallback');
  return checkUnlockSession(component);
}
```

## Future Enhancements

### Planned Features
1. **Global Cache Warming**: Pre-load popular data combinations across users
2. **Smart Expiration**: AI-driven cache duration based on data freshness patterns
3. **Regional Distribution**: Geographic caching for global user base
4. **Team Sharing**: Optional cache sharing between team members
5. **Predictive Loading**: ML-based prediction of likely user requests

### Performance Targets
- **Cache Hit Rate**: >85% for repeat requests within session windows
- **Response Time**: <150ms for cached data retrieval
- **Cross-Device Sync**: <500ms for session state synchronization
- **Credit Efficiency**: >70% reduction in API costs through intelligent caching

This sophisticated session-based caching architecture represents a significant advancement in financial data management, providing users with a seamless, cost-effective, and highly performant experience across all their devices while maintaining strict data security and billing transparency. 