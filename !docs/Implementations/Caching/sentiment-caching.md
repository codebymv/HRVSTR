# Sentiment Analysis Caching Implementation

This document examines the caching implementation for the Sentiment Analysis feature in the HRVSTR application.

## 1. Sentiment Data Hook Implementation

The primary caching mechanism for sentiment data is implemented in the `useSentimentData` hook with an in-memory Map cache:

```typescript
interface CacheEntry {
  data: SentimentResponse;
  timestamp: number;
  expiresAt: number;
}

// In-memory cache for client-side
const cache = new Map<string, CacheEntry>();

/**
 * Hook for fetching and caching sentiment data
 * Coordinates with backend caching to avoid unnecessary reloads
 */
export function useSentimentData(
  endpoint: string,
  options: UseSentimentDataOptions = {}
) {
  const { 
    timeRange = '1w', 
    refreshInterval = 0, // 0 means no auto-refresh
    forceRefresh = false 
  } = options;
  
  // ...
}
```

This approach creates a sophisticated in-memory caching system that persists during the application's lifecycle.

## 2. Time-Based Cache Expiration

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

## 3. Cache Key Generation

The caching system uses logical cache keys based on endpoint and parameters:

```typescript
// Create a cache key based on endpoint and parameters
const cacheKey = `${endpoint}:${timeRange}`;
```

This key structure:
- Segments cache by endpoint for different data types
- Includes time range to separate different data views
- Creates unique identifiers for each API request

## 4. Cache Validation Logic

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

## 5. Cache-Busting Options

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

## 6. Progressive Loading with Cache

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

## 7. Error Handling with Cache Fallback

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

## 8. Proxy Server Integration

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

## 9. Cache Visibility for Users

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

## 10. Reddit Client Implementation

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

## 11. Future Improvements

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
