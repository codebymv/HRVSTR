# Sentiment Analysis Caching Implementation

This document examines the caching implementation for the Sentiment Analysis feature in the HRVSTR application.

## 1. Sentiment Data Hook Implementation

The sentiment caching system has been updated to use localStorage persistence, matching the approach used by earnings and SEC filings components:

```typescript
// Cached data state with localStorage persistence - matching earnings approach
const [allSentiments, setAllSentiments] = useState<SentimentData[]>(() => {
  try {
    const cached = localStorage.getItem('sentiment_allSentiments');
    return cached ? JSON.parse(cached) : [];
  } catch (e) {
    console.error('Error loading cached sentiments:', e);
    return [];
  }
});

const [allTickerSentiments, setAllTickerSentiments] = useState<SentimentData[]>(() => {
  try {
    const cached = localStorage.getItem('sentiment_allTickerSentiments');
    return cached ? JSON.parse(cached) : [];
  } catch (e) {
    console.error('Error loading cached ticker sentiments:', e);
    return [];
  }
});

const [cachedRedditPosts, setCachedRedditPosts] = useState<RedditPostType[]>(() => {
  try {
    const cached = localStorage.getItem('sentiment_cachedRedditPosts');
    return cached ? JSON.parse(cached) : [];
  } catch (e) {
    console.error('Error loading cached Reddit posts:', e);
    return [];
  }
});
```

This approach creates a persistent caching system that survives browser sessions and page reloads.

## 2. Cache Freshness Management

The sentiment caching system now implements a 30-minute staleness threshold, consistent with other components:

```typescript
// Helper function to check if data is stale (older than 30 minutes) - matching earnings/SEC approach
const isDataStale = (timestamp: number | null): boolean => {
  if (!timestamp) return true;
  const thirtyMinutesInMs = 30 * 60 * 1000;
  return Date.now() - timestamp > thirtyMinutesInMs;
};

// Track the last fetch time - matching earnings approach
const [lastFetchTime, setLastFetchTime] = useState<number | null>(() => {
  try {
    const cached = localStorage.getItem('sentiment_lastFetchTime');
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.error('Error loading cached fetch time:', e);
    return null;
  }
});
```

Key features:
- Uses consistent 30-minute cache window across all components
- Automatically triggers reload for stale data
- Persists timestamps in localStorage for cross-session persistence

## 3. Cache Storage and Persistence

The sentiment system now automatically saves data to localStorage whenever it changes:

```typescript
// Save data to localStorage whenever it changes - matching earnings approach
useEffect(() => {
  if (allSentiments.length > 0) {
    localStorage.setItem('sentiment_allSentiments', JSON.stringify(allSentiments));
  }
}, [allSentiments]);

useEffect(() => {
  if (allTickerSentiments.length > 0) {
    localStorage.setItem('sentiment_allTickerSentiments', JSON.stringify(allTickerSentiments));
  }
}, [allTickerSentiments]);

useEffect(() => {
  if (cachedRedditPosts.length > 0) {
    localStorage.setItem('sentiment_cachedRedditPosts', JSON.stringify(cachedRedditPosts));
  }
}, [cachedRedditPosts]);

// Save last fetch time to localStorage
useEffect(() => {
  if (lastFetchTime) {
    localStorage.setItem('sentiment_lastFetchTime', JSON.stringify(lastFetchTime));
  }
}, [lastFetchTime]);
```

This ensures data persistence without manual intervention.

## 4. Time Range-Based Cache Invalidation

The sentiment system implements intelligent cache invalidation when time ranges change:

```typescript
// Handle time range changes - clear cache when time range changes
useEffect(() => {
  if (lastTimeRange !== timeRange) {
    console.log(`⏰ SENTIMENT: Changing time range from ${lastTimeRange} to ${timeRange}`);
    
    // Clear cached data when time range changes to force fresh fetch
    console.log('⏰ SENTIMENT: Clearing cache for new time range');
    localStorage.removeItem('sentiment_allSentiments');
    localStorage.removeItem('sentiment_allTickerSentiments');
    localStorage.removeItem('sentiment_cachedRedditPosts');
    localStorage.removeItem('sentiment_lastFetchTime');
    
    // Reset cached data in state
    setAllSentiments([]);
    setAllTickerSentiments([]);
    setCachedRedditPosts([]);
    setLastFetchTime(null);
    
    console.log('⏰ SENTIMENT: Triggering fresh data load for new time range');
    loadData();
  }
}, [timeRange, lastTimeRange, loadData]);
```

This ensures users get appropriate data for their selected time range.

## 5. Cache Validation and Loading Logic

The hook implements explicit cache validation logic to determine initial loading states:

```typescript
// Calculate initial loading state based on cache freshness
const hasData = allSentiments.length > 0;
const dataIsStale = isDataStale(lastFetchTime);
const needsRefresh = !hasData || dataIsStale;

console.log('🔄 SENTIMENT: Initial state calculation:', {
  hasData,
  dataLength: allSentiments.length,
  lastFetchTime: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
  dataIsStale,
  needsRefresh
});

// Check if we have fresh cached data - matching earnings approach
const hasData = allSentiments.length > 0;
const dataIsStale = isDataStale(lastFetchTime);
const timeRangeChanged = lastTimeRange !== timeRange;

// If we have fresh data and time range hasn't changed, use cached data
if (hasData && !dataIsStale && !timeRangeChanged) {
  console.log('📊 SENTIMENT: Using cached data, no fetch needed');
  setLoading({ sentiment: false, posts: false, chart: false });
  setIsDataLoading(false);
  return;
}
```

This ensures that expired cache entries are bypassed automatically while providing immediate data display for fresh cache.

## 6. Cache Refresh Functionality

The hook provides comprehensive cache clearing functionality:

```typescript
const refreshData = useCallback(() => {
  // Clear ALL caches then reload - including market timeline data
  setAllSentiments([]);
  setAllTickerSentiments([]);
  setCachedRedditPosts([]);
  setLastFetchTime(null);
  
  // Clear localStorage cache to force fresh fetch - matching earnings approach
  localStorage.removeItem('sentiment_allSentiments');
  localStorage.removeItem('sentiment_allTickerSentiments');
  localStorage.removeItem('sentiment_cachedRedditPosts');
  localStorage.removeItem('sentiment_lastFetchTime');
  
  // Force reload of data with current access level
  loadData();
}, [loadData]);
```

Key features:
- Clears both state and localStorage
- Forces fresh data fetch
- Maintains user access level settings

## 7. Debug and Development Tools

The sentiment caching implementation includes developer debugging tools:

```typescript
// Debug function to clear all sentiment cache - available in browser console
useEffect(() => {
  (window as any).clearSentimentCache = () => {
    console.log('🧹 DEBUG: Clearing all sentiment cache...');
    localStorage.removeItem('sentiment_allSentiments');
    localStorage.removeItem('sentiment_allTickerSentiments');
    localStorage.removeItem('sentiment_cachedRedditPosts');
    localStorage.removeItem('sentiment_lastFetchTime');
    
    setAllSentiments([]);
    setAllTickerSentiments([]);
    setCachedRedditPosts([]);
    setLastFetchTime(null);
    setErrors({ sentiment: null, posts: null, chart: null, rateLimited: false });
    setLoading({ sentiment: false, posts: false, chart: false });
    
    console.log('🧹 DEBUG: Sentiment cache cleared! Reload the page to see fresh data.');
  };
}, []);
```

This provides developers with easy cache clearing via browser console: `clearSentimentCache()`.

## 8. Consistent Architecture

The updated sentiment caching now provides:

1. **Cross-Session Persistence**: Data persists across browser sessions using localStorage
2. **Consistent Staleness Threshold**: 30-minute cache window matching other components
3. **Intelligent Loading States**: Calculates initial loading based on cache freshness
4. **Automatic Cache Invalidation**: Clears cache when time ranges change
5. **Comprehensive Refresh**: Both state and localStorage clearing capabilities
6. **Developer Debugging**: Console-accessible cache clearing functions

This architecture ensures consistent performance and user experience across all HRVSTR premium features while maintaining optimal API usage and response times.

## 9. Time-Based Cache Expiration

The sentiment caching system implements variable TTL (Time-To-Live) based on the selected time range:

```typescript
// Determine cache TTL based on timeRange
let cacheTTL = 5 * 60 * 1000; // Default: 5 minutes
switch (timeRange) {
  case '1d': cacheTTL = 2 * 60 * 1000; break;  // 2 minutes for 1-day data
  case '1w': cacheTTL = 5 * 60 * 1000; break;  // 5 minutes for 1-week data
  case '1m': cacheTTL = 15 * 60 * 1000; break; // 15 minutes for 1-month data
  case '3m': cacheTTL = 30 * 60 * 1000; break; // 30 minutes for 3-month data
}
```

This intelligent approach:
- Provides shorter expiration for more volatile short-term data (1-day)
- Allows longer caching for more stable historical data (3-month)
- Balances freshness with performance optimization

## 10. Cache Key Generation

The caching system uses logical cache keys based on endpoint and parameters:

```typescript
// Create a cache key based on endpoint and parameters
const cacheKey = `${endpoint}:${timeRange}`;
```

This key structure:
- Segments cache by endpoint for different data types
- Includes time range to separate different data views
- Creates unique identifiers for each API request

## 11. Cache Validation Logic

The hook implements explicit cache validation logic:

```typescript
// Function to check if cache is valid
const isCacheValid = useCallback((entry: CacheEntry | undefined): boolean => {
  if (!entry) return false;
  return Date.now() < entry.expiresAt;
}, []);

// Check cache first if not skipping
if (!skipCache) {
  const cachedData = cache.get(cacheKey);
  if (cachedData && isCacheValid(cachedData)) {
    setData(cachedData.data);
    setLoading(false);
    setError(null);
    setLastUpdated(new Date(cachedData.timestamp));
    setProgress(100);
    return;
  }
}
```

This ensures that expired cache entries are bypassed automatically.

## 12. Cache-Busting Options

The hook provides several mechanisms to bypass or refresh cache:

```typescript
// Add cache-busting parameter if forcing refresh
if (forceRefresh) {
  url.searchParams.append('_t', Date.now().toString());
}

// Set up auto-refresh if interval is provided
let intervalId: NodeJS.Timeout | undefined;
if (refreshInterval > 0) {
  intervalId = setInterval(() => {
    fetchData(true);
  }, refreshInterval);
}
```

Key features:
- `forceRefresh` parameter for immediate cache bypass
- Cache-busting URL parameter
- Auto-refresh interval for background updates
- Manual refresh function for user-triggered updates

## 13. Progressive Loading with Cache

The sentiment caching implementation includes detailed progress tracking:

```typescript
// Start loading sequence
setLoading(true);
setError(null);
setProgress(10);

// Update through loading steps
setProgress(30);
setProgress(70);
setProgress(90);
setProgress(100);
```

This provides:
- Visual feedback during cache missed loads
- Granular progress updates for data-intensive operations
- Better user experience during cache refreshes

## 14. Error Handling with Cache Fallback

The caching system implements fallback to cached data during API failures:

```typescript
try {
  // API request logic
} catch (err) {
  setError(err instanceof Error ? err : new Error('Unknown error'));
  
  // If error and we have cached data, use it as fallback
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    setData(cachedData.data);
    setLastUpdated(new Date(cachedData.timestamp));
  }
}
```

This approach:
- Prevents UI disruption during API failures
- Uses cached data as a fallback
- Prioritizes showing some data over showing none
- Informs users about the cached state

## 15. Proxy Server Integration

The sentiment caching coordinates with a proxy server for additional server-side caching:

```typescript
const proxyUrl = getProxyUrl();
console.log(`Using proxy URL: ${proxyUrl}`);

// Use the correct API endpoint for Reddit market sentiment
const response = await fetch(`${proxyUrl}/api/sentiment/reddit/market?timeRange=${timeRange}`, { signal });
```

This multi-layered approach:
- Reduces direct calls to the Reddit API
- Provides server-side caching for all users
- Centralizes rate limiting and error handling
- Creates a coordinated client-server caching architecture

## 16. Cache Visibility for Users

The hook exposes cache-related information to the user interface:

```typescript
// Calculate time until next refresh
const timeUntilRefresh = useCallback(() => {
  const cachedData = cache.get(cacheKey);
  if (!cachedData) return 0;
  
  const timeRemaining = Math.max(0, cachedData.expiresAt - Date.now());
  return Math.floor(timeRemaining / 1000); // Return seconds
}, [cacheKey]);

// Return data and control functions
return {
  data: data?.sentimentData || [],
  loading,
  error,
  progress,
  lastUpdated,
  refresh,
  timeUntilRefresh,
  isStale: lastUpdated ? (Date.now() - lastUpdated.getTime() > 5 * 60 * 1000) : false
};
```

The UI can display:
- When data was last updated
- Whether the cache is stale
- Time until automatic refresh
- Loading progress during cache misses

## 17. Reddit Client Implementation

The sentiment caching is supported by the Reddit client implementation, which fetches and processes Reddit posts:

```typescript
export async function fetchRedditPosts(signal?: AbortSignal): Promise<RedditPost[]> {
  try {
    const responses = await Promise.all(
      SUBS.map((sub) => fetchSubreddit(sub, LIMIT, signal))
    );

    const posts: RedditPost[] = responses.flatMap((json) => {
      return json.data.children.map((post: any) => {
        const data = post.data;
        
        return {
          id: data.id,
          title: data.title,
          content: data.selftext || '',
          author: data.author,
          upvotes: data.ups,
          commentCount: data.num_comments,
          url: `https://reddit.com${data.permalink}`,
          created: new Date(data.created_utc * 1000).toISOString(),
          subreddit: data.subreddit
        };
      });
    });

    // Sort by newest
    posts.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    return posts;
  } catch (error: any) {
    console.error('Failed to fetch from Reddit API:', error);
    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error fetching Reddit posts', 
      'reddit'
    );
  }
}
```

This implementation focuses on efficient data retrieval and transformation.

## 18. Future Improvements

The sentiment caching system could be enhanced with:

1. **Persistent Storage**:
   - Add IndexedDB or localStorage for cache persistence
   - Preserve cache across page reloads
   - Implement cache version tracking

2. **Partial Updates**:
   - Add delta updates for incremental data changes
   - Reduce bandwidth by only fetching new posts
   - Implement smarter update approach

3. **Background Sync**:
   - Add service worker for offline support
   - Implement background fetch for updates
   - Provide offline sentiment analysis

4. **Cache Compression**:
   - Compress larger datasets before storage
   - Implement binary storage format
   - Reduce memory footprint of cached data

5. **Structured Cache Management**:
   - Create a dedicated caching service
   - Implement a cache manager class
   - Standardize caching across components
