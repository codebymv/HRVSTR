# SEC Filings Caching Implementation

## Overview

The SEC filings caching system implements a **sophisticated session-based architecture** that integrates user account tracking, credit management, and database-backed caching. This system works identically across devices and prevents users from being charged multiple times for the same data access.

## Core Architecture

### 1. Session-Based Access Control

The system uses the `research_sessions` table to track component unlocks:

```sql
-- Active session check for SEC filings access
SELECT session_id, expires_at, credits_used, metadata
FROM research_sessions 
WHERE user_id = $1 
  AND component = $2  -- 'insiderTrading' or 'institutionalHoldings'
  AND status = 'active' 
  AND expires_at > CURRENT_TIMESTAMP
ORDER BY unlocked_at DESC 
LIMIT 1
```

**Key Features:**
- **Cross-device access**: Sessions stored in PostgreSQL, accessible from any device
- **Prevents double-charging**: Active session check before credit deduction
- **Tier-based expiration**: Session duration varies by user tier
- **Automatic cleanup**: Expired sessions cleaned up automatically

### 2. Sophisticated Cache Flow

The `userSecCacheService.js` implements a three-tier access pattern:

```javascript
async function getSecDataForUser(userId, userTier, dataType, timeRange, forceRefresh = false) {
  // TIER 1: Check for active unlock session
  const componentName = dataType === 'insider_trades' ? 'insiderTrading' : 'institutionalHoldings';
  const sessionResult = await db.query(sessionQuery, [userId, componentName]);
  const hasActiveSession = sessionResult.rows.length > 0;
  
  if (hasActiveSession) {
    // User has paid for access - check cache first
    const cachedData = await getCachedSecData(userId, dataType, timeRange);
    if (cachedData && !forceRefresh) {
      return {
        success: true,
        data: cachedData.data,
        fromCache: true,
        hasActiveSession: true,
        creditsUsed: 0 // No credits charged during active session
      };
    }
    
    // No cache but has session - fetch fresh data without charging
    const freshData = await secService.getSecData(dataType, timeRange);
    await cacheSecData(userId, dataType, timeRange, freshData, 0, userTier);
    
    return {
      success: true,
      data: freshData,
      creditsUsed: 0,
      hasActiveSession: true,
      freshlyFetched: true
    };
  }
  
  // TIER 2: No active session - check cache
  if (!forceRefresh) {
    const cachedData = await getCachedSecData(userId, dataType, timeRange);
    if (cachedData) {
      return {
        success: true,
        data: cachedData.data,
        fromCache: true,
        hasActiveSession: false
      };
    }
  }
  
  // TIER 3: No cache - charge credits and fetch
  const creditsRequired = await getSecDataCreditsCost(userTier, dataType, timeRange);
  const userCredits = await checkUserCredits(userId);
  
  if (userCredits < creditsRequired) {
    return {
      success: false,
      error: 'INSUFFICIENT_CREDITS',
      creditsRequired,
      creditsAvailable: userCredits
    };
  }
  
  // Deduct credits and fetch fresh data
  await deductCredits(userId, creditsRequired);
  const freshData = await secService.getSecData(dataType, timeRange);
  await cacheSecData(userId, dataType, timeRange, freshData, creditsRequired, userTier);
  
  return {
    success: true,
    data: freshData,
    creditsUsed: creditsRequired,
    freshlyFetched: true
  };
}
```

## Database Schema Implementation

### Core Cache Tables

**1. `user_sec_cache` - Main cache storage:**
```sql
CREATE TABLE user_sec_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_type sec_data_type_enum NOT NULL, -- 'insider_trades', 'institutional_holdings'
    time_range VARCHAR(10) NOT NULL,       -- '1d', '3d', '1w', '1m', '3m', '6m'
    data_json JSONB NOT NULL,              -- Complete API response
    metadata JSONB,                        -- Fetch info, counts, etc.
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    credits_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one cache entry per user per data type per time range
    UNIQUE(user_id, data_type, time_range)
);
```

**2. `user_sec_insider_trades` - Optimized insider trade storage:**
```sql
CREATE TABLE user_sec_insider_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_id UUID NOT NULL REFERENCES user_sec_cache(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    insider_name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    trade_type VARCHAR(20) NOT NULL, -- 'BUY', 'SELL'
    shares BIGINT NOT NULL,
    price DECIMAL(12,4),
    value DECIMAL(15,2),
    filing_date TIMESTAMP WITH TIME ZONE NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE,
    form_type VARCHAR(20),
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**3. `user_sec_institutional_holdings` - 13F filings storage:**
```sql
CREATE TABLE user_sec_institutional_holdings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_id UUID NOT NULL REFERENCES user_sec_cache(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    institution_name VARCHAR(255) NOT NULL,
    shares_held BIGINT NOT NULL,
    value_held DECIMAL(15,2),
    percent_change DECIMAL(8,4),
    percentage_ownership DECIMAL(8,4),
    quarterly_change DECIMAL(15,2),
    filing_date TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## User Account & Session Integration

### Cross-Device Session Management

The system ensures consistent access across all user devices:

```javascript
// Frontend session checking (works on any device)
const checkExistingSessions = async () => {
  try {
    // Primary: Check database sessions via API
    const insiderSession = await checkComponentAccess('insiderTrading');
    const institutionalSession = await checkComponentAccess('institutionalHoldings');

    setUnlockedComponents({
      insiderTrading: !!insiderSession,
      institutionalHoldings: !!institutionalSession
    });

    console.log('🔍 SEC FILINGS - Active sessions:', {
      insiderTrading: insiderSession?.sessionId,
      institutionalHoldings: institutionalSession?.sessionId
    });
  } catch (error) {
    // Fallback to localStorage for offline scenarios
    console.warn('Database session check failed, using localStorage fallback');
    const insiderSession = checkUnlockSession('insiderTrading');
    const institutionalSession = checkUnlockSession('institutionalHoldings');
    
    setUnlockedComponents({
      insiderTrading: !!insiderSession,
      institutionalHoldings: !!institutionalSession
    });
  }
};
```

### Component Unlock Process

When users unlock SEC filings components:

```javascript
const handleUnlockComponent = async (component, cost) => {
  // 1. Check for existing session (prevents double-charging)
  const existingSession = await checkComponentAccess(component);
  if (existingSession) {
    const timeRemaining = getSessionTimeRemainingFormatted(existingSession);
    info(`${component} already unlocked (${timeRemaining})`);
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
    // 3. Update UI state immediately
    setUnlockedComponents(prev => ({ ...prev, [component]: true }));
    
    // 4. Store in localStorage for offline fallback
    storeUnlockSession(component, {
      sessionId: data.sessionId,
      expiresAt: data.expiresAt,
      creditsUsed: data.creditsUsed,
      tier: tierInfo?.tier
    });
    
    // 5. Trigger data loading for unlocked component
    if (component === 'institutionalHoldings') {
      setLoadingState(prev => ({
        ...prev,
        institutionalHoldings: { isLoading: false, needsRefresh: true }
      }));
    } else if (component === 'insiderTrading') {
      setLoadingState(prev => ({
        ...prev,
        insiderTrades: { isLoading: false, needsRefresh: true }
      }));
    }
    
    // 6. Update session list
    const sessions = getAllUnlockSessions();
    setActiveSessions(sessions);
    
    // 7. Refresh tier info for credit usage display
    if (refreshTierInfo) {
      await refreshTierInfo();
    }
  }
};
```

## Tier-Based Expiration & Credits

### Dynamic Cache Expiration

Cache duration adjusts based on user tier:

```sql
-- Function to get cache expiration based on tier and data type
CREATE OR REPLACE FUNCTION get_sec_cache_expiration(
  user_tier user_tier_enum,
  data_type sec_data_type_enum
) RETURNS INTERVAL AS $$
BEGIN
  RETURN CASE user_tier
    WHEN 'free' THEN INTERVAL '1 hour'        -- Encourages upgrades
    WHEN 'pro' THEN INTERVAL '6 hours'        -- Good balance
    WHEN 'elite' THEN INTERVAL '12 hours'     -- Premium experience  
    WHEN 'institutional' THEN INTERVAL '24 hours' -- Enterprise level
    ELSE INTERVAL '1 hour'
  END;
END;
$$ LANGUAGE plpgsql;
```

### Credit Cost Calculation

Credits vary by tier and data complexity:

```sql
-- Function to calculate credit costs
CREATE OR REPLACE FUNCTION get_sec_data_credits_cost(
  user_tier user_tier_enum,
  data_type sec_data_type_enum,
  time_range VARCHAR
) RETURNS INTEGER AS $$
BEGIN
  RETURN CASE user_tier
    WHEN 'free' THEN
      CASE data_type
        WHEN 'insider_trades' THEN
          CASE time_range
            WHEN '1d' THEN 5
            WHEN '3d' THEN 10
            WHEN '1w' THEN 15
            WHEN '1m' THEN 25
            WHEN '3m' THEN 40
            WHEN '6m' THEN 60
            ELSE 15
          END
        WHEN 'institutional_holdings' THEN 999999 -- Effectively blocked
      END
    WHEN 'pro' THEN
      CASE data_type
        WHEN 'insider_trades' THEN
          CASE time_range
            WHEN '1d' THEN 2
            WHEN '3d' THEN 4
            WHEN '1w' THEN 6
            WHEN '1m' THEN 10
            WHEN '3m' THEN 15
            WHEN '6m' THEN 20
            ELSE 6
          END
        WHEN 'institutional_holdings' THEN
          CASE time_range
            WHEN '1d' THEN 3
            WHEN '3d' THEN 6
            WHEN '1w' THEN 9
            WHEN '1m' THEN 15
            WHEN '3m' THEN 25
            WHEN '6m' THEN 35
            ELSE 9
          END
      END
    WHEN 'elite', 'institutional' THEN
      -- Minimal costs for premium tiers
      CASE data_type
        WHEN 'insider_trades' THEN 1
        WHEN 'institutional_holdings' THEN 2
      END
    ELSE 15 -- Default fallback
  END;
END;
$$ LANGUAGE plpgsql;
```

## Cache Cleanup & Maintenance

### Automatic Cleanup Functions

```sql
-- Main cleanup function for SEC cache
CREATE OR REPLACE FUNCTION cleanup_expired_sec_cache()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Delete expired cache entries
    DELETE FROM user_sec_cache 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Cleanup orphaned detail records
    DELETE FROM user_sec_insider_trades 
    WHERE cache_id NOT IN (SELECT id FROM user_sec_cache);
    
    DELETE FROM user_sec_institutional_holdings 
    WHERE cache_id NOT IN (SELECT id FROM user_sec_cache);
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;
```

### Scheduled Maintenance

```javascript
// Backend cleanup scheduler
class SecCacheCleanupScheduler {
  constructor() {
    this.isRunning = false;
    this.intervals = new Map();
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Main cleanup every 15 minutes
    const mainCleanup = setInterval(async () => {
      try {
        const result = await db.query('SELECT cleanup_expired_sec_cache()');
        const cleaned = result.rows[0].cleanup_expired_sec_cache;
        
        if (cleaned > 0) {
          console.log(`✅ SEC cache cleanup: ${cleaned} records removed`);
        }
      } catch (error) {
        console.error('❌ SEC cache cleanup failed:', error);
      }
    }, 15 * 60 * 1000);
    
    this.intervals.set('main', mainCleanup);
    
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
    
    this.intervals.set('sessions', sessionCleanup);
    
    console.log('🚀 SEC cache cleanup scheduler started');
  }

  stop() {
    this.intervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.intervals.clear();
    this.isRunning = false;
    
    console.log('⏹️ SEC cache cleanup scheduler stopped');
  }
}

// Auto-start cleanup scheduler
const cleanupScheduler = new SecCacheCleanupScheduler();
cleanupScheduler.start();
```

## API Integration & Endpoints

### Updated Controller Implementation

```javascript
// secController.js - Database-backed caching
exports.getInsiderTrades = async (req, res) => {
  const { timeRange, refresh } = req.query;
  const userId = req.user?.id;
  const tier = req.user?.tier || 'free';
  
  try {
    const result = await userSecCacheService.getSecDataForUser(
      userId, 
      tier,
      'insider_trades', 
      timeRange, 
      refresh === 'true'
    );
    
    if (!result.success) {
      if (result.error === 'INSUFFICIENT_CREDITS') {
        return res.status(402).json({
          success: false,
          error: result.error,
          message: result.userMessage,
          creditsRequired: result.creditsRequired,
          creditsAvailable: result.creditsAvailable
        });
      }
      
      if (result.error === 'TIER_RESTRICTION') {
        return res.status(403).json({
          success: false,
          error: result.error,
          message: result.userMessage,
          tierRequired: result.tierRequired
        });
      }
      
      return res.status(500).json({ success: false, error: result.message });
    }
    
    res.json({
      success: true,
      data: result.data,
      metadata: {
        fromCache: result.fromCache,
        hasActiveSession: result.hasActiveSession,
        creditsUsed: result.creditsUsed,
        expiresAt: result.expiresAt,
        freshlyFetched: result.freshlyFetched || false
      }
    });
    
  } catch (error) {
    console.error('SEC Controller Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch insider trades data' 
    });
  }
};

exports.getInstitutionalHoldings = async (req, res) => {
  // Similar implementation for institutional holdings
  const { timeRange, refresh } = req.query;
  const userId = req.user?.id;
  const tier = req.user?.tier || 'free';
  
  try {
    const result = await userSecCacheService.getSecDataForUser(
      userId,
      tier, 
      'institutional_holdings', 
      timeRange, 
      refresh === 'true'
    );
    
    // Handle result same as insider trades...
    
  } catch (error) {
    console.error('SEC Controller Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch institutional holdings data' 
    });
  }
};

exports.clearUserSecCache = async (req, res) => {
  const userId = req.user?.id;
  
  try {
    // Clear user's SEC cache
    await db.query('DELETE FROM user_sec_cache WHERE user_id = $1', [userId]);
    
    console.log(`🧹 Cleared SEC cache for user ${userId}`);
    
    res.json({ 
      success: true, 
      message: 'SEC cache cleared successfully' 
    });
  } catch (error) {
    console.error('Error clearing SEC cache:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear SEC cache' 
    });
  }
};
```

### API Endpoints

```
GET  /api/sec/insider-trades?timeRange=1m&refresh=false
     - Returns insider trades with automatic session/cache checking
     - Charges credits only if no active session and no cache

GET  /api/sec/institutional-holdings?timeRange=1m&refresh=false  
     - Returns institutional holdings (Pro+ tier required)
     - Same session/cache logic as insider trades

GET  /api/sec/insider-trades/stream?timeRange=1m&refresh=true
     - Streaming endpoint with progress callbacks
     - Bypasses cache if refresh=true

POST /api/sec/clear-user-cache
     - Clears user's SEC cache manually
     - Useful for debugging and force refresh scenarios

GET  /api/debug/sec-cache/:userId
     - Debug endpoint for cache inspection
     - Returns cache status and session info
```

## Frontend Integration Updates

### Removed localStorage Dependencies

The frontend has been updated to rely on database sessions:

```typescript
// OLD APPROACH (removed): localStorage management
// const [data, setData] = useState(() => {
//   try {
//     const cached = localStorage.getItem('secFilings_data');
//     return cached ? JSON.parse(cached) : [];
//   } catch (e) {
//     return [];
//   }
// });

// NEW APPROACH: Simple state, backend handles caching
const [insiderTradesData, setInsiderTradesData] = useState<any[]>([]);
const [institutionalHoldingsData, setInstitutionalHoldingsData] = useState<any[]>([]);

// Cache refresh now clears backend cache
const handleRefresh = async () => {
  try {
    await clearUserSecCache(); // Clear server-side cache
    // Trigger fresh data fetch
    loadInsiderTrades(timeRange, true);
    if (unlockedComponents.institutionalHoldings) {
      loadInstitutionalHoldings(timeRange, true);
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};
```

### Updated API Service

```typescript
// frontend/src/services/api.ts - Database-backed API calls
export const fetchInsiderTradesWithUserCache = async (
  timeRange: TimeRange, 
  refresh: boolean = false
): Promise<{ success: boolean; data?: any; error?: string; metadata?: any }> => {
  try {
    const params = new URLSearchParams({
      timeRange,
      refresh: refresh.toString()
    });
    
    const response = await apiClient.get(`/sec/insider-trades?${params}`);
    
    return {
      success: true,
      data: response.data.data,
      metadata: response.data.metadata
    };
  } catch (error) {
    console.error('Error fetching insider trades:', error);
    
    if (error.response?.status === 402) {
      return {
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        message: error.response.data.message
      };
    }
    
    if (error.response?.status === 403) {
      return {
        success: false,
        error: 'TIER_RESTRICTION',
        message: error.response.data.message
      };
    }
    
    return {
      success: false,
      error: 'FETCH_ERROR',
      message: 'Failed to fetch insider trades data'
    };
  }
};

export const clearUserSecCache = async (): Promise<void> => {
  await apiClient.post('/sec/clear-user-cache');
};

export const getUserSecCacheStatus = async (): Promise<any> => {
  const response = await apiClient.get('/sec/cache-status');
  return response.data;
};
```

## Performance & Monitoring

### Database Indexes

Strategic indexes for optimal performance:

```sql
-- Primary performance indexes
CREATE INDEX IF NOT EXISTS idx_user_sec_cache_user_id 
ON user_sec_cache(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sec_cache_expires_at 
ON user_sec_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_sec_cache_user_type_range 
ON user_sec_cache(user_id, data_type, time_range);

-- Detail table indexes
CREATE INDEX IF NOT EXISTS idx_user_sec_insider_trades_ticker 
ON user_sec_insider_trades(ticker);

CREATE INDEX IF NOT EXISTS idx_user_sec_insider_trades_user_id 
ON user_sec_insider_trades(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sec_institutional_holdings_ticker 
ON user_sec_institutional_holdings(ticker);

CREATE INDEX IF NOT EXISTS idx_user_sec_institutional_holdings_user_id 
ON user_sec_institutional_holdings(user_id);

-- Session-related indexes
CREATE INDEX IF NOT EXISTS idx_research_sessions_user_component 
ON research_sessions(user_id, component);

CREATE INDEX IF NOT EXISTS idx_research_sessions_active 
ON research_sessions(user_id, status) 
WHERE status = 'active';
```

### Monitoring & Analytics

```javascript
// Cache performance monitoring
const getCacheAnalytics = async () => {
  const result = await db.query(`
    SELECT 
      data_type,
      COUNT(*) as total_entries,
      COUNT(*) FILTER (WHERE expires_at > CURRENT_TIMESTAMP) as active_entries,
      COUNT(*) FILTER (WHERE expires_at <= CURRENT_TIMESTAMP) as expired_entries,
      AVG(EXTRACT(EPOCH FROM (expires_at - created_at))/3600) as avg_cache_duration_hours,
      SUM(CASE WHEN metadata->>'dataCount' IS NOT NULL 
          THEN (metadata->>'dataCount')::INTEGER ELSE 0 END) as total_records_cached
    FROM user_sec_cache
    GROUP BY data_type
  `);
  
  return result.rows;
};

// Session analytics
const getSessionAnalytics = async () => {
  const result = await db.query(`
    SELECT 
      component,
      COUNT(*) as total_sessions,
      COUNT(*) FILTER (WHERE status = 'active' AND expires_at > CURRENT_TIMESTAMP) as active_sessions,
      AVG(credits_used) as avg_credits_per_session,
      AVG(EXTRACT(EPOCH FROM (expires_at - unlocked_at))/3600) as avg_session_duration_hours
    FROM research_sessions
    WHERE component IN ('insiderTrading', 'institutionalHoldings')
    GROUP BY component
  `);
  
  return result.rows;
};
```

## Security & Data Isolation

### User Data Protection

- All cache queries include `user_id` filter for complete data isolation
- No cross-user data access possible through any API endpoint
- Session validation prevents unauthorized access attempts
- Automatic cleanup removes expired data to minimize storage exposure

### Credit Validation

- Credits checked before any expensive operations
- Session validation prevents double-charging
- Complete audit trail in `credit_transactions` table
- Tier restrictions enforced at database level

## System Summary

The HRVSTR SEC filings caching system successfully implements:

1. **✅ Cross-Device User Account Tracking**: PostgreSQL sessions accessible from any device
2. **✅ Credit-Based Session Management**: Prevents double-charging with active session checks
3. **✅ Database Layer Caching**: User-specific cache with tier-based expiration policies
4. **✅ Automatic Cache Cleanup**: Scheduled maintenance and orphan record cleanup
5. **✅ Session Validation**: Active session verification before credit deduction
6. **✅ Performance Optimization**: Strategic indexing and efficient query patterns
7. **✅ Developer Tools**: Comprehensive debugging and monitoring capabilities
8. **✅ Security & Isolation**: Complete user data separation and audit trails

This sophisticated architecture ensures optimal performance, cost efficiency, and user experience while maintaining strict data security and preventing credit system abuse across all HRVSTR premium features.
