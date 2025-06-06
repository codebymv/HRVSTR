# Earnings Caching Implementation

This document examines the sophisticated caching implementation for the Earnings Monitor feature in the HRVSTR application.

## 1. Architecture Overview

The HRVSTR earnings system implements a **database-only session-based caching architecture** (aligned with SEC filings approach):

1. **Database Layer**: PostgreSQL-backed user-specific cache with session management
2. **Session Layer**: `research_sessions` table tracks component unlocks and prevents double-charging
3. **Frontend Layer**: No localStorage dependency - pure database-driven state management

## 2. Alignment with SEC Filings Architecture

The earnings components now follow the **exact same patterns** as SEC filings:

### Unified Loading State Management
```typescript
// Structured loading states matching SEC filings
const [loadingState, setLoadingState] = useState({
  upcomingEarnings: { isLoading: false, needsRefresh: false },
  earningsAnalysis: { isLoading: false, needsRefresh: false }
});

// Refresh state management
const [isRefreshing, setIsRefreshing] = useState(false);
```

### Loading Handlers Pattern
```typescript
// Handle loading updates from upcoming earnings tab
const handleUpcomingEarningsLoading = (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => {
  setLoadingState(prev => ({
    ...prev,
    upcomingEarnings: { 
      isLoading, 
      needsRefresh: false
    }
  }));
  
  // When loading completes successfully, update data
  if (!isLoading && data) {
    setUpcomingEarnings(data);
  }
  
  // Update error state if provided
  if (error !== undefined) {
    setErrors(prev => ({ ...prev, upcomingEarnings: error }));
  }
  
  // Only update overall progress if this is the active tab
  if (activeTab === 'upcoming' || !isLoading) {
    setLoadingProgress(progress);
    setLoadingStage(stage);
    
    // Propagate to parent component
    if (onLoadingProgressChange) {
      onLoadingProgressChange(progress, stage);
    }
  }

  // Clear refresh state when loading completes
  if (!isLoading && isRefreshing) {
    const analysisComplete = !hasEarningsAnalysisAccess || !loadingState.earningsAnalysis.isLoading;
    if (analysisComplete) {
      setIsRefreshing(false);
    }
  }
};
```

### Database-Only Caching (No localStorage)
```typescript
// Data states - no longer stored in localStorage (matching SEC filings approach)
const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
const [earningsAnalysis, setEarningsAnalysis] = useState<EarningsAnalysis | null>(null);
const [upcomingEarnings, setUpcomingEarnings] = useState<EarningsEvent[]>([]);

// REMOVED: All localStorage persistence logic
// REMOVED: localStorage.getItem('earnings_upcomingEarnings')
// REMOVED: localStorage.setItem() calls
// REMOVED: isDataStale() timestamp checking
```

### Refresh Management Pattern
```typescript
// Refresh data function - updated to match SEC filings pattern
const refreshData = async () => {
  // Check if any components are actually unlocked
  const hasUnlockedComponents = unlockedComponents.earningsAnalysis || unlockedComponents.upcomingEarnings;
  
  if (!hasUnlockedComponents) {
    info('Please unlock at least one component before refreshing');
    return;
  }

  setIsRefreshing(true);
  setLoadingProgress(0);
  setLoadingStage('Clearing cache...');
  
  try {
    // Clear user's specific cache (using appropriate API)
    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
    const token = localStorage.getItem('auth_token');
    
    await fetch(`${proxyUrl}/api/earnings/clear-cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    // Reset errors and clear existing data
    setErrors({ upcomingEarnings: null, analysis: null });
    setUpcomingEarnings([]);
    setEarningsAnalysis(null);
    
    // Trigger refresh for unlocked components only
    if (unlockedComponents.upcomingEarnings) {
      setLoadingState(prev => ({
        ...prev,
        upcomingEarnings: { 
          isLoading: false, 
          needsRefresh: true 
        }
      }));
    }
    
    if (unlockedComponents.earningsAnalysis && selectedTicker) {
      setLoadingState(prev => ({
        ...prev,
        earningsAnalysis: { 
          isLoading: false, 
          needsRefresh: true 
        }
      }));
    }
  } catch (error) {
    console.error('Error during refresh:', error);
    info('Error refreshing data. Please try again.');
  } finally {
    setIsRefreshing(false);
  }
};
```

## 3. Core Components

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

### Session-Based Component Access (Database-Only)

The earnings system integrates with the sophisticated session management:

```typescript
// Frontend component access checking - DATABASE ONLY
const checkExistingSessions = async () => {
  try {
    // Database-only checking - no localStorage fallback
    const earningsAnalysisSession = await checkComponentAccess('earningsAnalysis', currentTier);
    const upcomingEarningsSession = await checkComponentAccess('upcomingEarnings', currentTier);

    const newUnlockedState = {
      earningsAnalysis: !!earningsAnalysisSession,
      upcomingEarnings: !!upcomingEarningsSession
    };

    setUnlockedComponents(newUnlockedState);

    const sessions = await getAllUnlockSessions(currentTier);
    setActiveSessions(sessions);
    
    console.log('🔍 EARNINGS MONITOR TABBED - Component access check:', {
      earningsAnalysis: !!earningsAnalysisSession,
      upcomingEarnings: !!upcomingEarningsSession,
      currentTier,
      databaseSessions: sessions.length
    });
  } catch (error) {
    console.warn('Database session check failed:', error);
    // No more localStorage fallback - just set to false if database fails
    setUnlockedComponents({
      earningsAnalysis: false,
      upcomingEarnings: false
    });
    setActiveSessions([]);
  }
};
```

## 4. Cross-Device Session Synchronization

The system ensures users can access unlocked components across all devices:

### Session Unlock Flow
```javascript
const handleUnlockComponent = async (component, cost) => {
  // 1. Check existing session (prevents double-charging)
  const existingSession = await checkComponentAccess(component, currentTier);
  if (existingSession) {
    const timeRemaining = getSessionTimeRemainingFormatted(existingSession);
    info(`${component} already unlocked (${timeRemaining}h remaining)`);
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
    
    // 4. Store in localStorage for backward compatibility only
    storeUnlockSession(component, {
      sessionId: data.sessionId,
      expiresAt: data.expiresAt,
      creditsUsed: data.creditsUsed,
      tier: tierInfo?.tier || 'free'
    });
    
    // 5. Update active sessions by querying database
    const sessions = await getAllUnlockSessions();
    setActiveSessions(sessions);
    
    // 6. Trigger immediate data loading if needed
    if (component === 'earningsAnalysis' && selectedTicker) {
      loadAnalysis(selectedTicker);
    }
    
    if (component === 'upcomingEarnings') {
      loadData(true);
    }
  }
};
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
