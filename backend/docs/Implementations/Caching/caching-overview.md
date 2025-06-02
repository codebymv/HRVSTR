# Data Management & Caching Strategy

## Overview

HRVSTR employs a sophisticated multi-layered caching strategy to optimize performance when dealing with financial data from multiple external sources. The system uses a combination of client-side localStorage caching, server-side Redis caching, and intelligent staleness management to reduce API calls, improve response times, and handle rate limiting effectively.

## Unified Client-Side Caching Architecture

All premium features in HRVSTR now implement a consistent localStorage-based caching approach with standardized staleness management:

### Core Caching Principles

1. **30-Minute Staleness Threshold**: All components use a consistent 30-minute cache window
2. **localStorage Persistence**: Data persists across browser sessions and page reloads
3. **Automatic Cache Invalidation**: Clears cache when parameters (time range, etc.) change
4. **Session-Based Access**: Integrates with credit-based component unlocking
5. **Debug Tools**: Console-accessible cache clearing functions for development

### Implementation Pattern

```typescript
// Consistent pattern across all components
const [data, setData] = useState<DataType[]>(() => {
  try {
    const cached = localStorage.getItem('component_data');
    return cached ? JSON.parse(cached) : [];
  } catch (e) {
    console.error('Error loading cached data:', e);
    return [];
  }
});

const [lastFetchTime, setLastFetchTime] = useState<number | null>(() => {
  try {
    const cached = localStorage.getItem('component_lastFetchTime');
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.error('Error loading cached fetch time:', e);
    return null;
  }
});

// Helper function to check if data is stale (older than 30 minutes)
const isDataStale = (timestamp: number | null): boolean => {
  if (!timestamp) return true;
  const thirtyMinutesInMs = 30 * 60 * 1000;
  return Date.now() - timestamp > thirtyMinutesInMs;
};
```

## Component-Specific Implementations

### 1. Sentiment Analysis Caching

**Cache Keys:**
- `sentiment_allSentiments` - Market sentiment timeline data
- `sentiment_allTickerSentiments` - Ticker-specific sentiment data
- `sentiment_cachedRedditPosts` - Reddit posts for Pro+ users
- `sentiment_lastFetchTime` - Timestamp of last successful fetch

**Features:**
- Multi-source sentiment aggregation (Reddit, FinViz, Yahoo Finance)
- Tier-based access control for Reddit data
- Time range-based cache invalidation
- Console debug function: `clearSentimentCache()`

### 2. Earnings Monitor Caching

**Cache Keys:**
- `earnings_upcomingEarnings` - Upcoming earnings events data
- `earnings_lastFetchTime` - Timestamp of last successful fetch

**Features:**
- Real-time progress tracking during data scraping
- Integration with session-based component unlocking
- On-demand analysis loading for selected tickers
- Console debug function: `clearEarningsCache()`

### 3. SEC Filings Caching

**Cache Keys:**
- `secFilings_insiderTrades` - Insider trading data (Form 4)
- `secFilings_institutionalHoldings` - Institutional holdings (13F)
- `secFilings_lastFetchTime` - Timestamps for both data types
- `secFilings_timeRange` - User preference persistence
- `secFilings_activeTab` - User preference persistence

**Features:**
- Dual data source management (insider trades + institutional holdings)
- User preference persistence (time range, active tab)
- Explicit server-side cache clearing functionality
- Tier-based access control for institutional data

## Data Sources

### External APIs
1. **SEC EDGAR**: Insider trading (Form 4) and institutional holdings (13F)
2. **Reddit API**: Social sentiment from financial subreddits
3. **FinViz**: Market news, analyst ratings, technical indicators
4. **Yahoo Finance**: Stock prices and earnings data

### Data Characteristics
- **Volume**: High-frequency data updates for popular tickers
- **Latency**: Real-time to daily update frequencies
- **Reliability**: External dependencies with potential rate limits
- **Cost**: API call limitations and potential quotas

## Server-Side Redis Caching Architecture

### Cache Layers

#### L1 Cache: Client-Side localStorage
- **Purpose**: Persistent user-specific data across sessions
- **TTL**: 30 minutes (consistent staleness threshold)
- **Implementation**: Browser localStorage with JSON serialization
- **Use Cases**: API responses, user preferences, component states

#### L2 Cache: Application Memory
- **Purpose**: Frequently accessed, small datasets
- **TTL**: 5-10 minutes
- **Implementation**: Node.js in-memory cache
- **Use Cases**: API responses for current server session

#### L3 Cache: Redis
- **Purpose**: Shared cache across multiple instances
- **TTL**: Variable based on data type (15 minutes to 24 hours)
- **Implementation**: Redis with configurable TTL
- **Use Cases**: External API responses, processed data

### Cache Key Strategy

```typescript
// Cache key patterns
const CACHE_KEYS = {
  // Client-side keys (localStorage)
  SENTIMENT_DATA: (source: string) => `sentiment_${source}`,
  EARNINGS_DATA: () => 'earnings_upcomingEarnings',
  SEC_INSIDER: () => 'secFilings_insiderTrades',
  SEC_HOLDINGS: () => 'secFilings_institutionalHoldings',
  
  // Server-side keys (Redis)
  SEC_INSIDER_API: (ticker: string) => `sec:insider:${ticker.toUpperCase()}`,
  SEC_HOLDINGS_API: (ticker: string) => `sec:holdings:${ticker.toUpperCase()}`,
  REDDIT_SENTIMENT_API: (ticker: string) => `reddit:sentiment:${ticker.toUpperCase()}`,
  FINVIZ_NEWS_API: (ticker: string) => `finviz:news:${ticker.toUpperCase()}`,
  EARNINGS_DATA_API: (ticker: string) => `earnings:${ticker.toUpperCase()}`,
  MARKET_SENTIMENT_API: () => `market:sentiment:${getCurrentDate()}`,
  TRENDING_TICKERS_API: () => `trending:tickers:${getCurrentHour()}`
};

// Helper functions
const getCurrentDate = () => new Date().toISOString().split('T')[0];
const getCurrentHour = () => new Date().toISOString().slice(0, 13);
```

## Cache TTL Strategy

### Client-Side TTL (Consistent)
```typescript
export const CLIENT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for all components

export const isDataStale = (timestamp: number | null): boolean => {
  if (!timestamp) return true;
  return Date.now() - timestamp > CLIENT_CACHE_TTL;
};
```

### Server-Side TTL (Variable)
```typescript
export const SERVER_CACHE_TTL = {
  // Real-time data (frequent updates)
  REDDIT_POSTS: 15 * 60,        // 15 minutes
  FINVIZ_NEWS: 15 * 60,         // 15 minutes
  MARKET_SENTIMENT: 30 * 60,    // 30 minutes
  
  // Semi-static data (daily updates)
  SEC_INSIDER: 60 * 60,         // 1 hour
  SEC_HOLDINGS: 4 * 60 * 60,    // 4 hours
  EARNINGS_DATA: 2 * 60 * 60,   // 2 hours
  
  // Static data (infrequent updates)
  TICKER_INFO: 24 * 60 * 60,    // 24 hours
  COMPANY_PROFILE: 24 * 60 * 60, // 24 hours
  
  // Processed/computed data
  SENTIMENT_ANALYSIS: 30 * 60,   // 30 minutes
  TREND_ANALYSIS: 60 * 60       // 1 hour
};
```

### Dynamic TTL Based on Market Hours
```typescript
export const getDynamicTTL = (dataType: string): number => {
  const now = new Date();
  const isMarketHours = isMarketOpen(now);
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  
  if (isWeekend) {
    // Longer TTL on weekends
    return SERVER_CACHE_TTL[dataType] * 4;
  }
  
  if (isMarketHours) {
    // Shorter TTL during market hours
    return SERVER_CACHE_TTL[dataType] * 0.5;
  }
  
  // Standard TTL after hours
  return SERVER_CACHE_TTL[dataType];
};
```

## Intelligent Loading States

All components now implement consistent loading state calculation:

```typescript
// Pattern used across all components
const [loading, setLoading] = useState(() => {
  // Calculate initial loading state based on cache freshness
  const hasData = data.length > 0;
  const dataIsStale = isDataStale(lastFetchTime);
  const needsRefresh = !hasData || dataIsStale;
  
  console.log('🔄 COMPONENT: Initial state calculation:', {
    hasData,
    dataLength: data.length,
    lastFetchTime: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
    dataIsStale,
    needsRefresh
  });
  
  return needsRefresh;
});
```

## Cache Invalidation Strategies

### 1. Time-Based Invalidation
```typescript
// Automatic invalidation based on staleness
if (isDataStale(lastFetchTime)) {
  console.log('Cache is stale, fetching fresh data...');
  loadData();
}
```

### 2. Parameter-Based Invalidation
```typescript
// Clear cache when critical parameters change
useEffect(() => {
  if (lastTimeRange !== timeRange) {
    console.log(`Time range changed from ${lastTimeRange} to ${timeRange}`);
    clearCacheAndRefresh();
  }
}, [timeRange, lastTimeRange]);
```

### 3. Manual Invalidation
```typescript
// User-triggered refresh
const refreshData = () => {
  localStorage.removeItem('component_data');
  localStorage.removeItem('component_lastFetchTime');
  setData([]);
  setLastFetchTime(null);
  loadData();
};
```

## Debug and Development Tools

Each component provides console-accessible debugging:

```typescript
// Available in browser console for all components
window.clearSentimentCache();
window.clearEarningsCache();
window.clearSecCache(); // Future implementation
```

## Performance Benefits

The unified caching architecture provides:

1. **Reduced API Calls**: 30-minute cache window prevents redundant requests
2. **Instant Loading**: Cached data displays immediately on component mount
3. **Cross-Session Persistence**: Data survives browser restarts
4. **Intelligent Refresh**: Only fetches when data is stale or parameters change
5. **User Experience**: Consistent loading behavior across all premium features
6. **Development Efficiency**: Standardized debugging and cache management

## Monitoring and Analytics

The caching system includes comprehensive logging:

```typescript
// Example logging pattern
console.log('📊 COMPONENT: Cache check:', {
  hasData,
  dataLength: data.length,
  lastFetchTime: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
  dataIsStale,
  action: hasData && !dataIsStale ? 'Using cache' : 'Fetching fresh'
});
```

This enables easy monitoring of cache hit rates and performance optimization.

## Future Enhancements

1. **Cache Size Management**: Implement LRU eviction for localStorage
2. **Offline Support**: Service worker integration for offline data access
3. **Predictive Caching**: Pre-fetch likely-to-be-requested data
4. **Cache Versioning**: Handle API schema changes gracefully
5. **Compression**: Implement data compression for large cache entries
6. **Cross-Tab Synchronization**: Sync cache updates across browser tabs

This caching strategy ensures HRVSTR can handle high-frequency financial data requests efficiently while maintaining data freshness and system reliability. 