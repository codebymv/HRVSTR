# Earnings Caching Implementation

This document examines the caching implementation for the Earnings Monitor feature in the HRVSTR application.

## 1. Earnings Component-Level Caching

The `EarningsMonitor` component implements localStorage-based caching for optimal performance and data persistence:

```typescript
// Cached data state with localStorage persistence
const [upcomingEarnings, setUpcomingEarnings] = useState<EarningsEvent[]>(() => {
  try {
    const cached = localStorage.getItem('earnings_upcomingEarnings');
    return cached ? JSON.parse(cached) : [];
  } catch (e) {
    console.error('Error loading cached earnings:', e);
    return [];
  }
});

// Track the last fetch time
const [lastFetchTime, setLastFetchTime] = useState<number | null>(() => {
  try {
    const cached = localStorage.getItem('earnings_lastFetchTime');
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.error('Error loading cached fetch time:', e);
    return null;
  }
});
```

This approach provides:
1. Immediate data display on component mount using cached data
2. Persistence across browser sessions and page reloads
3. Error-resilient loading with fallback to empty arrays

## 2. Cache Freshness Management

The earnings system implements a 30-minute staleness threshold consistent with other HRVSTR components:

```typescript
// Helper function to check if data is stale (older than 30 minutes)
const isDataStale = (timestamp: number | null): boolean => {
  if (!timestamp) return true;
  const thirtyMinutesInMs = 30 * 60 * 1000;
  return Date.now() - timestamp > thirtyMinutesInMs;
};

// Calculate initial loading state based on cache freshness
useEffect(() => {
  console.log('🔄 EARNINGS: Component mounted, checking if initial loading is needed');
  
  const hasData = upcomingEarnings.length > 0;
  const dataIsStale = isDataStale(lastFetchTime);
  const needsRefresh = !hasData || dataIsStale;
  
  console.log('🔄 EARNINGS: Initial state calculation:', {
    hasData,
    dataLength: upcomingEarnings.length,
    lastFetchTime: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
    dataIsStale,
    needsRefresh,
    unlockedEarningsTable: unlockedComponents.earningsTable
  });
  
  // Set initial loading state based on cache freshness and unlock status
  if (unlockedComponents.earningsTable && needsRefresh) {
    console.log('📊 EARNINGS: Initial loading needed - data is stale or missing');
    setLoading(prev => ({ ...prev, upcomingEarnings: true }));
  } else if (unlockedComponents.earningsTable && !needsRefresh) {
    console.log('📊 EARNINGS: Using cached data, no initial loading needed');
    setLoading(prev => ({ ...prev, upcomingEarnings: false }));
  }
}, []); // Only run on mount
```

Key features:
- Automatic staleness detection using 30-minute threshold
- Initial loading state calculation based on cache freshness
- Integration with session-based component unlocking

## 3. Intelligent Data Loading

The earnings component implements smart data loading that respects cache freshness:

```typescript
const loadData = async () => {
  // Only load if earnings table is unlocked
  if (!unlockedComponents.earningsTable) {
    console.log('📊 Earnings table locked - skipping data load');
    return;
  }

  // Check if we have fresh cached data
  const hasData = upcomingEarnings.length > 0;
  const dataIsStale = isDataStale(lastFetchTime);
  
  console.log('📊 EARNINGS: Cache check:', {
    hasData,
    dataLength: upcomingEarnings.length,
    lastFetchTime: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
    dataIsStale,
    timeRange
  });

  // If we have fresh data, no need to fetch
  if (hasData && !dataIsStale) {
    console.log('📊 EARNINGS: Using cached data, no fetch needed');
    setLoading(prev => ({ ...prev, upcomingEarnings: false }));
    return;
  }

  console.log('📊 EARNINGS: Fetching fresh data...');
  // ... proceed with API fetch
};
```

This approach:
- Checks cache freshness before making API calls
- Respects component unlock status
- Provides detailed logging for debugging
- Prevents unnecessary API requests

## 4. Automatic Data Persistence

The earnings component automatically saves data to localStorage whenever it changes:

```typescript
// Save data to localStorage whenever it changes
useEffect(() => {
  if (upcomingEarnings.length > 0) {
    localStorage.setItem('earnings_upcomingEarnings', JSON.stringify(upcomingEarnings));
  }
}, [upcomingEarnings]);

// Save last fetch time to localStorage
useEffect(() => {
  if (lastFetchTime) {
    localStorage.setItem('earnings_lastFetchTime', JSON.stringify(lastFetchTime));
  }
}, [lastFetchTime]);
```

This ensures data persistence without manual intervention.

## 5. Time Range-Based Cache Invalidation

The earnings system implements intelligent cache clearing when time ranges change:

```typescript
// Handle time range changes
const handleTimeRangeChange = (range: TimeRange) => {
  console.log(`⏰ EARNINGS: Changing time range from ${timeRange} to ${range}`);
  
  // Update the time range state
  setTimeRange(range);
  
  // Clear cached data when time range changes to force fresh fetch
  console.log('⏰ EARNINGS: Clearing cache for new time range');
  localStorage.removeItem('earnings_upcomingEarnings');
  localStorage.removeItem('earnings_lastFetchTime');
  
  // Reset cached data in state
  setUpcomingEarnings([]);
  setLastFetchTime(null);
  
  // Clear any existing errors
  setErrors({
    upcomingEarnings: null,
    analysis: null
  });
  
  // Trigger fresh data loading if unlocked
  if (unlockedComponents.earningsTable) {
    console.log('⏰ EARNINGS: Triggering fresh data load for new time range');
    loadData();
  }
};
```

This ensures users get appropriate earnings data for their selected time frame.

## 6. Cache Refresh Functionality

The earnings component provides comprehensive cache clearing capabilities:

```typescript
const refreshData = () => {
  console.log('🔄 EARNINGS: Refresh triggered - clearing cache and fetching fresh data');
  
  // Clear cached data to force fresh fetch
  localStorage.removeItem('earnings_upcomingEarnings');
  localStorage.removeItem('earnings_lastFetchTime');
  
  // Reset cached data in state
  setUpcomingEarnings([]);
  setLastFetchTime(null);
  
  // Clear any existing errors
  setErrors({
    upcomingEarnings: null,
    analysis: null
  });
  
  // Force fresh data load
  loadData();
  
  if (selectedTicker && unlockedComponents.earningsAnalysis) {
    loadAnalysis(selectedTicker);
  }
};
```

Key features:
- Clears both localStorage and component state
- Forces fresh API fetch
- Maintains error state hygiene
- Reloads analysis for selected ticker if applicable

## 7. Debug and Development Tools

The earnings implementation includes developer debugging tools:

```typescript
// Debug function to clear all earnings cache - available in browser console
useEffect(() => {
  (window as any).clearEarningsCache = () => {
    console.log('🧹 DEBUG: Clearing all earnings cache...');
    localStorage.removeItem('earnings_upcomingEarnings');
    localStorage.removeItem('earnings_lastFetchTime');
    
    setUpcomingEarnings([]);
    setLastFetchTime(null);
    setErrors({ upcomingEarnings: null, analysis: null });
    setLoading({ upcomingEarnings: false, analysis: false });
    
    console.log('🧹 DEBUG: Earnings cache cleared! Reload the page to see fresh data.');
  };
}, []);
```

This provides developers with easy cache clearing via browser console: `clearEarningsCache()`.

## 8. Progressive Loading with Cache

The earnings caching implementation includes detailed progress tracking using the new real-time progress system:

```typescript
const earnings = await fetchUpcomingEarningsWithProgress(
  timeRange,
  (progress: ProgressUpdate) => {
    // Update progress with real-time information from backend
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
```

This provides:
- Real-time progress updates during data scraping
- Visual feedback during cache miss loads
- Better user experience during cache refreshes

## 9. Analysis Caching Strategy

The earnings analysis caching follows an on-demand pattern:

```typescript
const loadAnalysis = async (ticker: string) => {
  // Only load if earnings analysis is unlocked
  if (!unlockedComponents.earningsAnalysis) {
    console.log('📊 Earnings analysis locked - skipping analysis load');
    return;
  }
  
  setLoading(prev => ({ ...prev, analysis: true }));
  setErrors(prev => ({ ...prev, analysis: null }));
  
  // ... loading logic with progress tracking ...
  
  try {
    const analysis = await analyzeEarningsSurprise(ticker);
    setEarningsAnalysis(analysis);
    setLoading(prev => ({ ...prev, analysis: false }));
  } catch (error) {
    // ... error handling ...
  }
};
```

This approach:
- Loads analysis data on-demand when a ticker is selected
- Caches the result in component state
- Respects component unlock status
- Provides progress feedback

## 10. Consistent Architecture

The earnings caching system provides:

1. **Cross-Session Persistence**: Data persists across browser sessions using localStorage
2. **Consistent Staleness Threshold**: 30-minute cache window matching other components
3. **Intelligent Loading States**: Calculates initial loading based on cache freshness
4. **Automatic Cache Invalidation**: Clears cache when time ranges change
5. **Session-Based Component Access**: Integrates with credit-based unlock system
6. **Real-Time Progress Tracking**: Provides detailed progress feedback during data loads
7. **Developer Debugging**: Console-accessible cache clearing functions
8. **Comprehensive Refresh**: Both state and localStorage clearing capabilities

This architecture ensures consistent performance and user experience across all HRVSTR premium features while maintaining optimal API usage and response times.
