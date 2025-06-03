# Earnings Session-Based Caching Implementation

This document outlines the complete implementation of session-based caching for earnings data, following the same architecture pattern as the SEC filings system.

## Overview

The earnings caching system provides:
- **User-specific caching** with database backend
- **Tier-based data limits** and cache TTL
- **Real-time progress updates** via Server-Sent Events (SSE)
- **Session-based data persistence** (data survives page refreshes during session)
- **Automatic cache management** with cleanup
- **Fallback support** for unauthenticated users

## Architecture Components

### 1. Service Layer (`earningsService.js`)

Main service handling external API calls and data processing:

```javascript
// Enhanced error handling similar to SEC service
function handleEarningsServiceError(error, operation) {
  // Rate limiting, server errors, network errors
  return standardizedErrorResponse;
}

// Core data fetching functions
async function getUpcomingEarnings(timeRange, limit, progressCallback)
async function getEarningsAnalysis(ticker)
async function getHistoricalEarnings(ticker, limit)
async function getCompanyInfo(ticker)
```

### 2. User Cache Service (`userEarningsCacheService.js`)

Manages user-specific database-backed caching:

```javascript
// Cache configuration by tier
const EARNINGS_CACHE_CONFIG = {
  FREE_TIER_TTL: 24 * 60 * 60,      // 24 hours
  PRO_TIER_TTL: 12 * 60 * 60,       // 12 hours
  ELITE_TIER_TTL: 6 * 60 * 60,      // 6 hours
  INSTITUTIONAL_TIER_TTL: 1 * 60 * 60, // 1 hour
  
  LIMITS: {
    FREE: { upcoming_earnings: 25, earnings_analysis: 5 },
    PRO: { upcoming_earnings: 100, earnings_analysis: 25 },
    ELITE: { upcoming_earnings: 500, earnings_analysis: 100 },
    INSTITUTIONAL: { upcoming_earnings: 1000, earnings_analysis: 500 }
  }
};

// Main caching function
async function getEarningsData(userId, dataType, timeRange, tier, forceRefresh, options)
```

### 3. Database Schema

```sql
CREATE TABLE user_earnings_cache (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  data_type VARCHAR(50) NOT NULL,
  cache_key VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  tier VARCHAR(20) DEFAULT 'free',
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, data_type, cache_key)
);

CREATE INDEX idx_user_earnings_cache_lookup 
ON user_earnings_cache(user_id, data_type, cache_key, expires_at);
```

### 4. Controller Layer (`earningsController.js`)

Updated to use the new caching system:

```javascript
// Authenticated users get user-specific caching
async function getUpcomingEarnings(req, res, next) {
  const userId = req.user?.id;
  const tier = req.user?.tier || 'free';
  
  if (!userId) {
    return await getUpcomingEarningsUnauthenticated(req, res, next);
  }
  
  const data = await userEarningsCacheService.getEarningsData(
    userId, 'upcoming_earnings', timeRange, tier, refresh === 'true', options
  );
  
  res.json(data);
}

// Unauthenticated users get simple memory caching
async function getUpcomingEarningsUnauthenticated(req, res, next) {
  // Simple cache check and fetch with free tier limits
}
```

### 5. API Routes (`earnings.js`)

Enhanced with new endpoints:

```javascript
// Core data endpoints
router.get('/upcoming', earningsController.getUpcomingEarnings);
router.get('/upcoming/stream', /* SSE streaming */);
router.get('/analysis/:ticker', earningsController.getEarningsAnalysis);
router.get('/historical/:ticker', authenticateToken, earningsController.getHistoricalEarnings);

// Cache management endpoints
router.get('/cache/status', authenticateToken, earningsController.getUserEarningsCacheStatus);
router.delete('/cache/clear', authenticateToken, earningsController.clearUserEarningsCache);
router.get('/clear-cache', earningsController.clearEarningsCache);
```

### 6. Frontend API Functions (`api.ts`)

New functions following SEC filings pattern:

```typescript
// User-specific caching functions
export const fetchUpcomingEarningsWithUserCache = async (timeRange, refresh, limit, signal)
export const fetchEarningsAnalysisWithUserCache = async (ticker, timeRange, refresh, signal)
export const fetchHistoricalEarningsWithUserCache = async (ticker, timeRange, refresh, limit, signal)

// Real-time streaming
export const streamUpcomingEarnings = (timeRange, refresh, onProgress, onComplete, onError, signal)

// Cache management
export const getUserEarningsCacheStatus = async (signal)
export const clearUserEarningsCache = async (dataType, timeRange, signal)
export const clearEarningsCache = async (signal)
```

### 7. Component Integration (`EarningsMonitor.tsx`)

Updated to use session-based caching:

```typescript
const EarningsMonitor: React.FC = ({ onLoadingProgressChange }) => {
  const { user } = useAuth();
  const { tierInfo } = useTier();
  
  // Use streaming API for real-time updates
  const loadData = async (forceRefresh: boolean = false) => {
    const streamSource = streamUpcomingEarnings(
      timeRange,
      forceRefresh,
      onProgress,
      onComplete,
      onError
    );
  };
  
  // Handle refresh with cache clearing
  const handleRefresh = async () => {
    if (user) {
      await clearUserEarningsCache('upcoming_earnings', timeRange);
    } else {
      await clearEarningsCache();
    }
    await loadData(true);
  };
};
```

## Data Flow Sequence

### Initial Request Flow:

1. **Frontend Component** (`EarningsMonitor`) → `streamUpcomingEarnings()`
2. **Frontend API** (`api.ts`) → Server-Sent Events to `/api/earnings/upcoming/stream`
3. **Route Handler** (`earnings.js`) → `earningsController.getUpcomingEarnings()`
4. **Controller** (`earningsController.js`) → `userEarningsCacheService.getEarningsData()`
5. **Cache Service** checks database cache → if miss, calls `earningsService.getUpcomingEarnings()`
6. **Earnings Service** → External APIs (Yahoo Finance, etc.)
7. **Response Chain**: Service → Cache → Controller → Route → SSE → Frontend

### Cache Hit Flow:

1. **Frontend** → API call
2. **Cache Service** → Database lookup
3. **Cache Hit** → Return cached data immediately
4. **Frontend** → Display data instantly

### Refresh Flow:

1. **User clicks refresh** → `handleRefresh()`
2. **Clear cache** → `clearUserEarningsCache()` or `clearEarningsCache()`
3. **Force refresh** → `loadData(true)`
4. **Fresh fetch** → Bypass cache, fetch from external APIs
5. **Update cache** → Store fresh data in database
6. **Display data** → Show updated results

## Benefits vs Previous Implementation

### Before (Component-Level Caching):
- ❌ Data lost on page refresh
- ❌ No user-specific limits
- ❌ Simple localStorage only
- ❌ No real-time progress
- ❌ No tier-based features

### After (Session-Based Caching):
- ✅ Data persists during session
- ✅ User-specific database caching
- ✅ Tier-based limits and TTL
- ✅ Real-time SSE progress updates
- ✅ Advanced cache management
- ✅ Authenticated vs unauthenticated handling
- ✅ Automatic cleanup of expired data

## Tier-Based Features

| Tier | Upcoming Earnings | Analysis | Historical | Cache TTL |
|------|------------------|----------|------------|-----------|
| Free | 25 events | 5 analyses | Not available | 1 hour |
| Pro | 100 events | 25 analyses | 50 records | 2 hours |
| Elite | 500 events | 100 analyses | 200 records | 4 hours |
| Institutional | 1000 events | 500 analyses | 1000 records | 30 minutes |

## Cache Management

### Automatic Cleanup:
- Expired entries removed during scheduled cleanup
- Cache size limits enforced per user
- TTL varies by user tier

### Manual Cache Control:
- Users can clear their own cache
- Admins can clear global cache
- Specific data types can be cleared individually

### Cache Keys:
```
upcoming_earnings_1w
upcoming_earnings_1m_limit50
earnings_analysis_1m_AAPL
historical_earnings_3m_MSFT_limit100
```

## Error Handling

### Rate Limiting:
```javascript
if (error.isRateLimit || error.message.includes('429')) {
  return {
    error: 'EARNINGS_RATE_LIMITED',
    userMessage: 'Earnings servers are busy. Please wait...',
    retryAfter: 60
  };
}
```

### Server Errors:
```javascript
if (error.isServerError) {
  return {
    error: 'EARNINGS_SERVER_ERROR',
    userMessage: 'Earnings servers are experiencing issues.',
    retryAfter: 300
  };
}
```

## Integration Points

### With Authentication System:
- User ID for cache isolation
- Tier information for limits
- Token-based API access

### With Tier Management:
- Dynamic limits based on user tier
- TTL adjustment by tier
- Feature access control

### With Real-time Updates:
- Server-Sent Events for progress
- WebSocket-like experience
- Graceful error handling

This implementation provides the same robust, session-based caching architecture for earnings data as the SEC filings system, ensuring consistent user experience and optimal performance across the platform. 