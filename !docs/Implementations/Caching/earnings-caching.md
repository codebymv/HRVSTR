# Earnings Caching Implementation

This document examines the sophisticated caching implementation for the Earnings Monitor feature in the HRVSTR application.

## 1. Architecture Overview

The HRVSTR earnings system implements a **dual-layer session-based caching architecture**:

1. **Database Layer**: PostgreSQL-backed user-specific cache with session management
2. **Frontend Layer**: localStorage for immediate UI responsiveness (fallback only)
3. **Session Layer**: `research_sessions` table tracks component unlocks and prevents double-charging

## 2. Core Components

### Database-Backed User Cache System

The earnings system uses sophisticated database caching via `userEarningsCacheService.js`:

```typescript
/**
 * Get earnings data with sophisticated session and cache management
 * @param {string} userId - User UUID
 * @param {string} dataType - 'upcoming_earnings' or 'earnings_analysis'  
 * @param {string} timeRange - Time range
 * @param {string} tier - User tier
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 * @returns {Promise<Object>} Earnings data with metadata
 */
async function getEarningsData(userId, dataType, timeRange, tier, forceRefresh = false) {
  // STEP 1: Check for active unlock session first
  const componentName = dataType === 'earnings_analysis' ? 'earningsAnalysis' : 'upcomingEarnings';
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
  
  const sessionResult = await db.query(sessionQuery, [userId, componentName]);
  const hasActiveSession = sessionResult.rows.length > 0;
  
  if (hasActiveSession) {
    // User has active session - free access to fresh data and cache
    const cachedData = await getCachedEarningsData(userId, dataType, timeRange);
    if (cachedData && !forceRefresh) {
      return {
        success: true,
        data: cachedData.data,
        fromCache: true,
        hasActiveSession: true,
        creditsUsed: 0 // No credits charged during active session
      };
    }
    
    // Fetch fresh data without charging credits
    const freshData = await fetchFreshEarningsData(dataType, timeRange);
    await cacheEarningsData(userId, dataType, timeRange, freshData, 0, tier);
    
    return {
      success: true,
      data: freshData,
      creditsUsed: 0,
      hasActiveSession: true,
      freshlyFetched: true
    };
  }
  
  // STEP 2: No active session - check cache first
  if (!forceRefresh) {
    const cachedData = await getCachedEarningsData(userId, dataType, timeRange);
    if (cachedData) {
      return {
        success: true,
        data: cachedData.data,
        fromCache: true,
        hasActiveSession: false
      };
    }
  }
  
  // STEP 3: No cache - charge credits and fetch fresh data
  const creditsRequired = getEarningsCreditsRequired(tier, dataType, timeRange);
  const userCredits = await checkUserCredits(userId);
  
  if (userCredits < creditsRequired) {
    return {
      success: false,
      error: 'INSUFFICIENT_CREDITS',
      creditsRequired,
      creditsAvailable: userCredits
    };
  }
  
  // Deduct credits and fetch
  await deductCredits(userId, creditsRequired);
  const freshData = await fetchFreshEarningsData(dataType, timeRange);
  await cacheEarningsData(userId, dataType, timeRange, freshData, creditsRequired, tier);
  
  return {
    success: true,
    data: freshData,
    creditsUsed: creditsRequired,
    freshlyFetched: true
  };
}
```

### Session-Based Component Access

The earnings system integrates with the sophisticated session management:

```typescript
// Frontend component access checking
const checkExistingSessions = async () => {
  try {
    // Primary: Check database sessions via API
    const analysisSession = await checkComponentAccess('earningsAnalysis');
    
    setUnlockedComponents({
      earningsAnalysis: !!analysisSession
    });
    
    if (analysisSession) {
      console.log('🔍 EARNINGS - Active session found:', {
        sessionId: analysisSession.sessionId,
        expiresAt: analysisSession.expiresAt,
        timeRemaining: analysisSession.timeRemaining
      });
    }
  } catch (error) {
    // Fallback to localStorage for offline scenarios
    console.warn('Database session check failed, using localStorage fallback');
    const localSession = checkUnlockSession('earningsAnalysis');
    setUnlockedComponents({
      earningsAnalysis: !!localSession
    });
  }
};
```

## 3. Cross-Device Session Synchronization

The system ensures users can access unlocked components across all devices:

### Session Unlock Flow
```javascript
const handleUnlockComponent = async (component, cost) => {
  // 1. Check existing session (prevents double-charging)
  const existingSession = await checkComponentAccess(component);
  if (existingSession) {
    const timeRemaining = getSessionTimeRemainingFormatted(existingSession);
    info(`${component} already unlocked (${timeRemaining})`);
    return;
  }
  
  // 2. Call backend to create new session
  const response = await fetch('/api/credits/unlock-component', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ component, cost })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // 3. Update UI immediately
    setUnlockedComponents(prev => ({ ...prev, [component]: true }));
    
    // 4. Store in localStorage for offline fallback
    storeUnlockSession(component, {
      sessionId: data.sessionId,
      expiresAt: data.expiresAt,
      creditsUsed: data.creditsUsed,
      tier: tierInfo?.tier
    });
    
    // 5. Trigger immediate data loading if needed
    if (component === 'earningsAnalysis' && selectedTicker) {
      loadAnalysis(selectedTicker);
    }
  }
};
```

### Database Session Management

Backend session creation with automatic expiration:

```sql
-- Create new research session with tier-based duration
INSERT INTO research_sessions (
  user_id, 
  session_id, 
  component, 
  credits_used, 
  expires_at,
  metadata
) VALUES (
  $1, -- user_id
  $2, -- session_id
  $3, -- component ('earningsAnalysis', 'upcomingEarnings')
  $4, -- credits_used
  CURRENT_TIMESTAMP + (
    CASE 
      WHEN $5 = 'free' THEN INTERVAL '30 minutes'
      WHEN $5 = 'pro' THEN INTERVAL '2 hours'  
      WHEN $5 = 'elite' THEN INTERVAL '4 hours'
      WHEN $5 = 'institutional' THEN INTERVAL '8 hours'
    END
  ), -- expires_at (tier-based)
  $6 -- metadata
);
```

## 4. Sophisticated Cache Management

### Tier-Based Cache Expiration

Cache duration varies by user tier to optimize cost and performance:

```javascript
const EARNINGS_CACHE_CONFIG = {
  FREE_TIER_TTL: 30 * 60,      // 30 minutes - encourages upgrades
  PRO_TIER_TTL: 2 * 60 * 60,   // 2 hours - good balance
  ELITE_TIER_TTL: 4 * 60 * 60, // 4 hours - premium experience
  INSTITUTIONAL_TIER_TTL: 30 * 60 // 30 minutes - ultra-fresh data for institutions
};

// Calculate expiration based on tier
const getEarningsCacheExpiration = (tier, dataType) => {
  const baseTTL = EARNINGS_CACHE_CONFIG[`${tier.toUpperCase()}_TIER_TTL`] || 
                  EARNINGS_CACHE_CONFIG.FREE_TIER_TTL;
  
  // Earnings analysis gets longer cache (more expensive to compute)
  const multiplier = dataType === 'earnings_analysis' ? 2 : 1;
  
  return `${baseTTL * multiplier} seconds`;
};
```

### Intelligent Cache Storage

The system stores earnings data with rich metadata for optimal retrieval:

```javascript
async function cacheEarningsData(userId, dataType, timeRange, data, creditsUsed, userTier) {
  // Calculate tier-based expiration
  const expirationInterval = getEarningsCacheExpiration(userTier, dataType);
  
  // Prepare rich metadata
  const metadata = {
    dataCount: Array.isArray(data.earnings) ? data.earnings.length : 1,
    fetchedAt: new Date().toISOString(),
    userTier,
    timeRange,
    source: data.source || 'earnings-api',
    analysisDepth: dataType === 'earnings_analysis' ? 'detailed' : 'summary'
  };
  
  // Store in user-specific cache table
  const cacheQuery = `
    INSERT INTO user_earnings_cache (
      user_id, data_type, time_range, data_json, metadata, 
      expires_at, credits_used
    ) VALUES (
      $1, $2, $3, $4, $5, 
      CURRENT_TIMESTAMP + $6::INTERVAL, $7
    )
    ON CONFLICT (user_id, data_type, time_range)
    DO UPDATE SET
      data_json = EXCLUDED.data_json,
      metadata = EXCLUDED.metadata,
      expires_at = EXCLUDED.expires_at,
      credits_used = EXCLUDED.credits_used,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, expires_at
  `;
  
  const result = await db.query(cacheQuery, [
    userId, dataType, timeRange, 
    JSON.stringify(data), JSON.stringify(metadata), 
    expirationInterval, creditsUsed
  ]);
  
  console.log(`✅ Cached earnings data for user ${userId}, expires: ${result.rows[0].expires_at}`);
}
```

## 5. Progressive Data Loading with Real-Time Progress

The earnings system provides detailed progress feedback during data fetching:

```typescript
const loadEarningsWithProgress = async (timeRange: TimeRange) => {
  try {
    setLoading(true);
    setLoadingProgress(0);
    setLoadingStage('Initializing earnings data fetch...');
    
    // Use backend service with progress callbacks
    const earnings = await fetchUpcomingEarningsWithProgress(
      timeRange,
      (progress: ProgressUpdate) => {
        setLoadingProgress(progress.percent);
        setLoadingStage(progress.message);
        
        if (onLoadingProgressChange) {
          onLoadingProgressChange(progress.percent, progress.message);
        }
        
        console.log(`📊 Real-time progress: ${progress.percent}% - ${progress.message}`);
        if (progress.currentDate) {
          console.log(`📅 Currently processing: ${progress.currentDate}`);
        }
      }
    );
    
    setUpcomingEarnings(earnings);
    setLoading(false);
    
  } catch (error) {
    setError('Failed to load earnings data');
    setLoading(false);
  }
};
```

## 6. Cache Cleanup and Maintenance

### Automatic Cleanup System

```sql
-- Cleanup expired earnings cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_earnings_cache()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    DELETE FROM user_earnings_cache 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Also cleanup orphaned individual earnings records
    DELETE FROM user_earnings_individual 
    WHERE cache_id NOT IN (SELECT id FROM user_earnings_cache);
    
    RETURN expired_count;
END;
$$ language 'plpgsql';
```

### Scheduled Maintenance

```javascript
// Backend scheduled cleanup (runs every 15 minutes)
const cleanupScheduler = {
  async runCleanup() {
    try {
      const earningsResult = await db.query('SELECT cleanup_expired_earnings_cache()');
      const cleaned = earningsResult.rows[0].cleanup_expired_earnings_cache;
      
      console.log(`✅ Earnings cache cleanup: ${cleaned} records removed`);
      
      return { success: true, recordsCleaned: cleaned };
    } catch (error) {
      console.error('❌ Earnings cache cleanup failed:', error);
      return { success: false, error: error.message };
    }
  }
};

// Schedule cleanup every 15 minutes
setInterval(() => {
  cleanupScheduler.runCleanup();
}, 15 * 60 * 1000);
```

## 7. Debug and Monitoring Tools

### Developer Cache Debugging

```javascript
// Backend API endpoint for cache debugging
app.get('/api/debug/earnings-cache/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const cacheStatus = await db.query(`
      SELECT 
        data_type,
        time_range,
        expires_at,
        credits_used,
        metadata,
        EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)) as seconds_until_expiry,
        CASE WHEN expires_at > CURRENT_TIMESTAMP THEN true ELSE false END as is_active
      FROM user_earnings_cache
      WHERE user_id = $1
      ORDER BY data_type, time_range
    `, [userId]);
    
    const sessionStatus = await db.query(`
      SELECT 
        component,
        session_id,
        status,
        expires_at,
        EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))/3600 as hours_remaining
      FROM research_sessions
      WHERE user_id = $1 AND component LIKE '%earnings%'
      ORDER BY unlocked_at DESC
    `, [userId]);
    
    res.json({
      success: true,
      cache: cacheStatus.rows,
      sessions: sessionStatus.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Frontend Debugging Tools

```typescript
// Browser console debugging function
useEffect(() => {
  (window as any).debugEarningsCache = () => {
    console.log('🔍 EARNINGS CACHE DEBUG INFO');
    console.log('Component unlock status:', unlockedComponents);
    console.log('Active sessions:', activeSessions);
    console.log('Current earnings data:', upcomingEarnings);
    console.log('Loading states:', loading);
    console.log('Error states:', errors);
  };
}, [unlockedComponents, activeSessions, upcomingEarnings, loading, errors]);
```

## 8. Performance Optimizations

### Database Indexing Strategy

```sql
-- Optimized indexes for earnings cache performance
CREATE INDEX IF NOT EXISTS idx_user_earnings_cache_user_id 
ON user_earnings_cache(user_id);

CREATE INDEX IF NOT EXISTS idx_user_earnings_cache_expires_at 
ON user_earnings_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_earnings_cache_user_type_range 
ON user_earnings_cache(user_id, data_type, time_range);

-- Session-related indexes
CREATE INDEX IF NOT EXISTS idx_research_sessions_user_component 
ON research_sessions(user_id, component);

CREATE INDEX IF NOT EXISTS idx_research_sessions_active 
ON research_sessions(user_id, status) 
WHERE status = 'active';
```

### Query Optimization

```javascript
// Efficient cache lookup with single query
async function getCachedEarningsData(userId, dataType, timeRange) {
  const query = `
    SELECT 
      data_json,
      metadata,
      expires_at,
      credits_used,
      EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)) as seconds_until_expiry
    FROM user_earnings_cache 
    WHERE user_id = $1 
      AND data_type = $2 
      AND time_range = $3
      AND expires_at > CURRENT_TIMESTAMP
    ORDER BY created_at DESC 
    LIMIT 1
  `;
  
  const result = await db.query(query, [userId, dataType, timeRange]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
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

## 9. System Architecture Summary

The HRVSTR earnings caching system provides:

1. **✅ Cross-Device User Account Tracking**: PostgreSQL-backed sessions accessible from any device
2. **✅ Credit-Based Session Management**: Sophisticated unlock system prevents double-charging  
3. **✅ Database Layer Caching**: User-specific cache with tier-based expiration
4. **✅ Automatic Cache Cleanup**: Scheduled maintenance and orphan cleanup
5. **✅ Session Validation**: Active session checks before credit deduction
6. **✅ Real-Time Progress Tracking**: Detailed feedback during data loading
7. **✅ Performance Optimization**: Strategic indexing and query optimization
8. **✅ Developer Tools**: Comprehensive debugging and monitoring capabilities

This architecture ensures optimal performance, cost efficiency, and user experience across all HRVSTR premium features while maintaining data consistency and preventing credit misuse.

## 10. Integration with Component Access System

The earnings system seamlessly integrates with the broader HRVSTR session management:

```typescript
// Complete integration flow
const EarningsMonitor: React.FC = () => {
  // 1. Check session status on mount
  useEffect(() => {
    const checkAccess = async () => {
      const session = await checkComponentAccess('earningsAnalysis');
      setUnlockedComponents({
        earningsAnalysis: !!session
      });
    };
    checkAccess();
  }, []);
  
  // 2. Handle component unlock with session creation
  const unlockEarningsAnalysis = async () => {
    const cost = COMPONENT_COSTS.earningsAnalysis;
    
    try {
      const response = await unlockComponent('earningsAnalysis', cost);
      
      if (response.success) {
        // Session created in database
        // Cache access granted
        // Component unlocked across all devices
        setUnlockedComponents(prev => ({
          ...prev, 
          earningsAnalysis: true
        }));
      }
    } catch (error) {
      console.error('Failed to unlock earnings analysis:', error);
    }
  };
  
  // 3. Load data with session validation
  const loadAnalysis = async (ticker: string) => {
    if (!unlockedComponents.earningsAnalysis) {
      return; // Component not unlocked
    }
    
    // Backend automatically checks session and cache
    const result = await fetchEarningsAnalysisWithUserCache(ticker);
    
    if (result.success) {
      setEarningsAnalysis(result.data);
      // Data served from cache or fresh (with session validation)
      console.log(`Credits used: ${result.creditsUsed || 0}`);
    }
  };
};
```

This sophisticated system ensures users get consistent, fast access to earnings data while maintaining cost efficiency and preventing abuse of the credit system.
