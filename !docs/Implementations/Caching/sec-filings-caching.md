# SEC Filings Caching Implementation

This document examines the caching implementation for the SEC Filings feature in the HRVSTR application.

## 1. SEC Filings Dashboard Architecture

The SEC Filings feature implements a comprehensive caching strategy using both localStorage and server-side caching mechanisms.

### Dashboard-Level Caching

The central component managing SEC filing data is the `SECFilingsDashboard`, which implements:

```typescript
// Cached data state with localStorage persistence
const [insiderTradesData, setInsiderTradesData] = useState<any[]>(() => {
  try {
    const cached = localStorage.getItem('secFilings_insiderTrades');
    return cached ? JSON.parse(cached) : [];
  } catch (e) {
    console.error('Error loading cached insider trades:', e);
    return [];
  }
});

const [institutionalHoldingsData, setInstitutionalHoldingsData] = useState<any[]>(() => {
  try {
    const cached = localStorage.getItem('secFilings_institutionalHoldings');
    return cached ? JSON.parse(cached) : [];
  } catch (e) {
    console.error('Error loading cached institutional holdings:', e);
    return [];
  }
});
```

The dashboard loads cached data from localStorage on initialization, providing immediate data display without waiting for API responses.

## 2. Cache Freshness Management

The SEC Filings dashboard implements sophisticated cache freshness management:

```typescript
// Helper function to check if data is stale (older than 30 minutes)
const isDataStale = (timestamp: number | null): boolean => {
  if (!timestamp) return true;
  const thirtyMinutesInMs = 30 * 60 * 1000;
  return Date.now() - timestamp > thirtyMinutesInMs;
};

// Track the last fetch time for each data type
const [lastFetchTime, setLastFetchTime] = useState<{
  insiderTrades: number | null,
  institutionalHoldings: number | null
}>(() => {
  try {
    const cached = localStorage.getItem('secFilings_lastFetchTime');
    return cached ? JSON.parse(cached) : { insiderTrades: null, institutionalHoldings: null };
  } catch (e) {
    console.error('Error loading cached fetch times:', e);
    return { insiderTrades: null, institutionalHoldings: null };
  }
});
```

Key features:
- Tracks last fetch time for different data types
- Uses a 30-minute staleness threshold
- Automatically triggers reload for stale data
- Persists timestamps in localStorage for persistence across sessions

## 3. User Preferences Caching

The SEC Filings page also caches user preferences for a consistent experience:

```typescript
const [timeRange, setTimeRange] = useState<TimeRange>(() => {
  try {
    return (localStorage.getItem('secFilings_timeRange') as TimeRange) || '1m';
  } catch (e) {
    return '1m';
  }
});

const [activeTab, setActiveTab] = useState<'insider' | 'institutional'>(() => {
  try {
    return (localStorage.getItem('secFilings_activeTab') as 'insider' | 'institutional') || 'insider';
  } catch (e) {
    return 'insider';
  }
});
```

This ensures the user's selected time range and active tab are preserved across sessions.

## 4. API-Level Caching

The SEC filing data is fetched through the application's API service, which implements caching control parameters:

```typescript
export async function fetchInsiderTrades(timeRange: TimeRange = '1m', refresh: boolean = false, signal?: AbortSignal): Promise<InsiderTrade[]> {
  try {
    const proxyUrl = getProxyUrl();
    const refreshParam = refresh ? '&refresh=true' : '';
    const response = await fetch(`${proxyUrl}/api/sec/insider-trades?timeRange=${timeRange}${refreshParam}`, { signal });
    
    if (!response.ok) {
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.insiderTrades as InsiderTrade[];
  } catch (error) {
    console.error('Insider trades API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch insider trades data');
  }
}
```

Key features:
- `refresh` parameter to force server-side cache refresh
- Signal support for request cancellation
- Error handling with specific error messages

## 5. Cache Clearing Functionality

The SEC Filings feature provides explicit cache clearing functionality:

```typescript
export const clearSecCache = async (signal?: AbortSignal): Promise<{success: boolean, message: string}> => {
  try {
    const proxyUrl = getProxyUrl();
    const response = await fetch(`${proxyUrl}/api/sec/clear-cache`, { signal });
    
    if (!response.ok) {
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error clearing SEC cache:', error);
    throw error;
  }
};
```

This allows users to explicitly clear the server-side cache to ensure they get the freshest data when needed.

## 6. User Interface Cache Controls

The SEC Filings dashboard exposes cache management to users through UI controls:

```typescript
<button
  onClick={handleClearCache}
  disabled={isClearingCache}
  className={`p-2 rounded-full ${isLight ? 'hover:bg-stone-400' : 'hover:bg-gray-800'} ${isClearingCache ? 'opacity-50' : ''}`}
  title="Clear SEC data cache"
>
  {isClearingCache ? (
    <Loader2 size={18} className={`${textColor} animate-spin`} />
  ) : (
    <Trash2 size={18} className={textColor} />
  )}
</button>

<button
  onClick={() => {
    // Trigger reload by setting loading states and reload flags
    setLoading({
      insiderTrades: true,
      institutionalHoldings: true
    });
    // Also set reload flags
    setShouldReload({
      insiderTrades: true,
      institutionalHoldings: true
    });
    // Clear cached last fetch time to force fresh data
    setLastFetchTime({
      insiderTrades: null,
      institutionalHoldings: null
    });
    localStorage.removeItem('secFilings_lastFetchTime');
  }}
  disabled={loading.insiderTrades || loading.institutionalHoldings}
  className={`p-2 rounded-full ${isLight ? 'hover:bg-stone-400' : 'hover:bg-gray-800'} ${(loading.insiderTrades || loading.institutionalHoldings) ? 'opacity-50' : ''}`}
  title="Refresh data"
>
  {(loading.insiderTrades || loading.institutionalHoldings) ? (
    <Loader2 size={18} className={`${textColor} animate-spin`} />
  ) : (
    <RefreshCw size={18} className={textColor} />
  )}
</button>
```

These controls provide:
- Visual feedback during cache operations
- Explicit refresh and cache clearing options
- Status indicators for in-progress operations

## 7. Caching Lifecycle

The SEC Filings caching follows a well-defined lifecycle:

1. **Initialization**:
   - Load cached data from localStorage
   - Check cache freshness
   - Display cached data immediately

2. **Auto Refresh**:
   - Check if cached data is stale (>30 minutes)
   - Trigger refresh for stale data
   - Update cache with fresh data

3. **Manual Operations**:
   - Refresh: Force reload data while preserving cache
   - Clear: Remove server-side cache and reload

4. **Persistence**:
   - Save data to localStorage after fetching
   - Update last fetch timestamps
   - Persist user preferences

## 8. Future Improvements

Potential improvements to the SEC Filings caching implementation could include:

1. **IndexedDB Integration**:
   - Move from localStorage to IndexedDB for larger datasets
   - Better handle large institutional holdings data
   - Implement structured queries for filtered access

2. **Progressive Caching**:
   - Implement incremental updates
   - Cache only changes since last fetch
   - Reduce data transfer volume

3. **Cross-Tab Synchronization**:
   - Add BroadcastChannel API support
   - Synchronize cache operations across tabs
   - Prevent duplicate API calls

4. **Offline Support**:
   - Add ServiceWorker caching
   - Enable complete offline access
   - Implement background sync for deferred updates
