# Lists Overview - HRVSTR List Components and Patterns

## Introduction

HRVSTR implements sophisticated list management patterns throughout the application, with the Reddit Posts section serving as the primary example of advanced list functionality. This document covers the current implementation patterns, component architecture, and best practices for list management in the HRVSTR platform.

## Current List Implementations

### 1. Reddit Posts List (Primary Implementation)

**Location:** `src/components/SentimentScraper/RedditPostsSection.tsx`

The Reddit Posts section demonstrates the most complete list implementation with:
- Infinite scroll functionality using Intersection Observer API
- Client-side pagination with cached data filtering
- Enhanced error handling with rate limit detection
- Comprehensive loading states and progress tracking
- Full theme-aware styling integration

#### Component Architecture
```typescript
interface RedditPostsSectionProps {
  posts: RedditPostType[];
  isLoading: boolean;
  loadingProgress: number;
  loadingStage: string;
  error: string | null;
  className?: string;
  hasMore: boolean;
  onLoadMore: () => void;
}

const RedditPostsSection: React.FC<RedditPostsSectionProps> = ({
  posts,
  isLoading,
  loadingProgress,
  loadingStage,
  error,
  className = '',
  hasMore,
  onLoadMore
}) => {
  // Theme-specific styling using ThemeContext
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const activeButtonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

  // Refs for infinite scroll
  const loadingRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(false);
  const lastLoadTimeRef = useRef(0);
  
  // Implementation details...
};
```

#### Key Features
- **Intersection Observer**: Automatic loading when user scrolls near bottom with 100px rootMargin
- **Multi-layer Throttling**: 1-second minimum between requests with ref-based duplicate prevention
- **Enhanced Error States**: Specialized handling for rate limits with retry buttons
- **Theme Integration**: Complete light/dark theme support using useTheme context
- **CSS Performance**: Uses `contain: 'layout size'` for optimal rendering performance
- **Loading States**: Three-state system (loading, has more, end of list) with proper visual feedback

### 2. SEC Filings Tables

**Location:** `src/components/SECFilings/`

Two table-based list implementations:
- `InsiderTradesTab.tsx` - Insider trading data with sortable columns
- `InstitutionalHoldingsTab.tsx` - Institutional holdings data

#### Features
- **Sortable Columns**: Click-to-sort functionality with visual indicators
- **Data Caching**: Persistent localStorage caching with cache invalidation
- **Loading Management**: Coordinated loading states with progress tracking
- **Time Range Filtering**: Dynamic data filtering based on user selection
- **Data Processing**: Advanced data sanitization and validation

### 3. Watchlist Components

**Location:** `src/components/Watchlist/` and `src/components/Home/UserHome.tsx`

Simple list implementations for user watchlists:
- Add/remove ticker functionality with validation
- Real-time price display integration
- Responsive design with mobile optimization

## Data Flow Architecture

### Reddit Posts Data Flow
```
API Layer → Caching → Filtering → Pagination → Display
    ↓           ↓         ↓          ↓         ↓
fetchRedditPosts → cachedRedditPosts → filteredPosts → redditPosts → RedditPost components
```

#### State Management Pattern (from useSentimentDashboardData hook)
```typescript
// Constants
const POSTS_PER_PAGE = 10;

// Cached data (fetched once for longest time range)
const [cachedRedditPosts, setCachedRedditPosts] = useState<RedditPostType[]>([]);

// Displayed data (paginated subset)
const [redditPosts, setRedditPosts] = useState<RedditPostType[]>([]);

// Pagination state
const [redditPage, setRedditPage] = useState(1);
const [hasMorePosts, setHasMorePosts] = useState(true);

// Loading states
const [loading, setLoading] = useState({
  sentiment: true,
  posts: true,
  chart: true
});

// Progress tracking
const [loadingProgress, setLoadingProgress] = useState(0);
const [loadingStage, setLoadingStage] = useState<string>('Initializing...');

// Load more implementation
const handleLoadMorePosts = useCallback(() => {
  if (!hasMorePosts || loading.posts) {
    return;
  }

  updateLoadingState({ posts: true });

  try {
    const nextPage = redditPage + 1;
    const startIndex = (nextPage - 1) * POSTS_PER_PAGE;
    const endIndex = startIndex + POSTS_PER_PAGE;
    
    // Calculate cutoff date based on current time range
    const now = new Date();
    let cutoffDate: Date;
    
    switch (timeRange) {
      case '1d':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '1w':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1m':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
      default:
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
    }
    
    // Filter posts based on time range
    const filteredPosts = cachedRedditPosts.filter(post => {
      const postDate = new Date(post.created);
      return postDate >= cutoffDate;
    });
    
    // Get the next page of filtered posts
    const newPosts = filteredPosts.slice(startIndex, endIndex);
    
    // Only update if we have new posts
    if (newPosts.length > 0) {
      setRedditPosts(prev => [...prev, ...newPosts]);
      setRedditPage(nextPage);
      setHasMorePosts(endIndex < filteredPosts.length);
    } else {
      setHasMorePosts(false);
    }
  } finally {
    // Always reset loading state
    updateLoadingState({ posts: false });
  }
}, [redditPage, hasMorePosts, loading.posts, cachedRedditPosts, timeRange, updateLoadingState]);
```

## List Component Patterns

### 1. Container-Presentation Pattern

**Container Component** (`RedditPostsSection`):
- Manages infinite scroll logic with Intersection Observer
- Handles user interactions and callbacks
- Implements business logic for loading and error states
- Provides theme-aware styling

**Presentation Component** (`RedditPost`):
- Pure rendering component for individual posts
- Accepts data via props
- Handles theme styling consistently

### 2. Loading State Management

```typescript
// Multi-level loading states with granular control
const [loading, setLoading] = useState({
  sentiment: true,
  posts: true,
  chart: true
});

// Update helper function
const updateLoadingState = (updates: Partial<typeof loading>) => {
  setLoading(prev => ({ ...prev, ...updates }));
};

// Progress tracking with stages
const [loadingProgress, setLoadingProgress] = useState(0);
const [loadingStage, setLoadingStage] = useState<string>('Initializing...');

// Usage in components
onLoadingChange(true, 25, 'Fetching Reddit posts...');
```

### 3. Enhanced Error Handling Pattern

```typescript
// Centralized error state with specific error types
const [errors, setErrors] = useState<{
  sentiment: string | null;
  posts: string | null;
  chart: string | null;
  rateLimited: boolean;
}>({
  sentiment: null,
  posts: null,
  chart: null,
  rateLimited: false,
});

// Error handling in components
{error ? (
  <div className="flex flex-col items-center justify-center p-10 text-center">
    {error.toLowerCase().includes('rate limit') ? (
      <>
        <AlertTriangle className="mb-2 text-red-500" size={32} />
        <p className={`text-lg font-semibold ${textColor}`}>Rate Limit Exceeded</p>
        <p className={`mt-2 ${mutedTextColor}`}>The Reddit API is currently rate limiting requests. Please wait a moment and try again later.</p>
        <button 
          className={`mt-4 px-4 py-2 ${activeButtonBgColor} text-white rounded-md transition-colors`}
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </>
    ) : (
      <>
        <AlertTriangle className="mb-2 text-yellow-500" size={32} />
        <p className={textColor}>{error}</p>
      </>
    )}
  </div>
) : (
  // ... rest of component
)}
```

### 4. Theme Integration Pattern

```typescript
// Complete theme integration using useTheme context
const { theme } = useTheme();
const isLight = theme === 'light';

// Comprehensive color system
const themeStyles = {
  cardBg: isLight ? 'bg-stone-300' : 'bg-gray-800',
  border: isLight ? 'border-stone-400' : 'border-gray-700',
  text: isLight ? 'text-stone-800' : 'text-white',
  muted: isLight ? 'text-stone-600' : 'text-gray-400',
  button: isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700',
  progress: isLight ? 'text-blue-600' : 'text-blue-400'
};
```

## Data Types and Interfaces

### Reddit Post Interface
```typescript
export interface RedditPost {
  id: string;
  title: string;
  content: string;
  author: string;
  upvotes: number;
  commentCount: number;
  url: string;
  created: string;
  subreddit: string;
}
```

### Common List Props Pattern
```typescript
interface ListComponentProps<T> {
  items: T[];
  isLoading: boolean;
  loadingProgress: number;
  loadingStage: string;
  error: string | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}
```

### Infinite Scroll Hook Interface
```typescript
interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
  throttleMs?: number;
}
```

## Caching Strategy

### Client-Side Caching (Reddit Posts)
```typescript
// Cache with timestamp tracking for invalidation
const [cachedRedditPosts, setCachedRedditPosts] = useState<RedditPostType[]>([]);
const [cacheTimestamp, setCacheTimestamp] = useState<number>(0);
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Cache validation logic
const isCacheValid = Date.now() - cacheTimestamp < CACHE_EXPIRY;

if (!isCacheValid || forceReload) {
  // Fetch fresh data
  const newData = await fetchRedditPosts(timeRange);
  setCachedRedditPosts(newData);
  setCacheTimestamp(Date.now());
}
```

### localStorage Persistence (SEC Filings)
```typescript
// Save to localStorage with error handling
useEffect(() => {
  if (data.length > 0) {
    try {
      localStorage.setItem('insiderTrades', JSON.stringify(data));
      localStorage.setItem('insiderTradesTimestamp', Date.now().toString());
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }
}, [data]);

// Load from localStorage with validation
const [data, setData] = useState<T[]>(() => {
  try {
    const cached = localStorage.getItem('insiderTrades');
    const timestamp = localStorage.getItem('insiderTradesTimestamp');
    
    if (cached && timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age < CACHE_EXPIRY) {
        return JSON.parse(cached);
      }
    }
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
  }
  return [];
});
```

## Filtering and Sorting

### Time-Based Filtering (Reddit Posts)
```typescript
// Filter cached data by time range
const filterPostsByTimeRange = (posts: RedditPostType[], range: TimeRange): RedditPostType[] => {
  const now = new Date();
  let cutoffDate: Date;
  
  switch (range) {
    case '1d':
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '1w':
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '1m':
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '3m':
    default:
      cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
  }
  
  return posts.filter(post => {
    const postDate = new Date(post.created);
    return postDate >= cutoffDate;
  });
};
```

### Sortable Columns (SEC Tables)
```typescript
// Sort configuration state
const [sortConfig, setSortConfig] = useState<{
  key: string;
  direction: 'ascending' | 'descending';
}>({
  key: 'filingDate',
  direction: 'descending'
});

// Sort implementation
const sortData = (data: T[]): T[] => {
  return [...data].sort((a, b) => {
    switch (sortConfig.key) {
      case 'filingDate':
        const dateA = new Date(a.filingDate).getTime();
        const dateB = new Date(b.filingDate).getTime();
        return sortConfig.direction === 'ascending' ? dateA - dateB : dateB - dateA;
        
      case 'value':
        const valueA = a.value || 0;
        const valueB = b.value || 0;
        return sortConfig.direction === 'ascending' ? valueA - valueB : valueB - valueA;
        
      default:
        return 0;
    }
  });
};

// Click handler for column headers
const handleSort = (key: string) => {
  setSortConfig({
    key,
    direction: 
      sortConfig.key === key && sortConfig.direction === 'ascending' 
        ? 'descending' 
        : 'ascending'
  });
};
```

## Performance Optimizations

### Intersection Observer Configuration
```typescript
// Optimized observer setup
const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMoreRef.current) {
      handleLoadMore();
    }
  },
  { 
    rootMargin: '100px' // Load 100px before reaching bottom
  }
);
```

### CSS Containment
```typescript
// Sentinel element with performance optimization
<div 
  ref={loadingRef}
  className="w-full h-[120px] flex justify-center items-center"
  style={{ contain: 'layout size' }}
>
```

### Memory Management
```typescript
// Cleanup for very long lists
const MAX_ITEMS = 1000;

const cleanupOldItems = useCallback(() => {
  if (items.length > MAX_ITEMS) {
    const itemsToKeep = items.slice(-MAX_ITEMS);
    setItems(itemsToKeep);
    // Adjust pagination counters accordingly
    setPage(Math.ceil(itemsToKeep.length / ITEMS_PER_PAGE));
  }
}, [items]);
```

## Testing Patterns

### Component Testing
```typescript
describe('RedditPostsSection', () => {
  it('should render loading state correctly', () => {
    render(
      <RedditPostsSection
        posts={[]}
        isLoading={true}
        loadingProgress={50}
        loadingStage="Loading posts..."
        error={null}
        hasMore={true}
        onLoadMore={() => {}}
      />
    );
    
    expect(screen.getByText('Loading posts...')).toBeInTheDocument();
    expect(screen.getByText('50% complete')).toBeInTheDocument();
  });

  it('should handle rate limit errors', () => {
    render(
      <RedditPostsSection
        posts={[]}
        isLoading={false}
        loadingProgress={0}
        loadingStage=""
        error="Rate limit exceeded"
        hasMore={false}
        onLoadMore={() => {}}
      />
    );
    
    expect(screen.getByText('Rate Limit Exceeded')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });
});
```

### Infinite Scroll Testing
```typescript
describe('Infinite Scroll', () => {
  it('should load more items when scrolled to bottom', async () => {
    const onLoadMore = jest.fn();
    
    render(
      <RedditPostsSection
        posts={mockPosts}
        isLoading={false}
        hasMore={true}
        onLoadMore={onLoadMore}
        // ... other props
      />
    );
    
    // Simulate intersection
    const sentinel = screen.getByTestId('loading-sentinel');
    mockIntersectionObserver.triggerIntersection(sentinel);
    
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
```

## Common Patterns and Best Practices

### 1. Consistent Error Handling
- Always provide user-friendly error messages
- Handle specific error types (rate limits, network errors)
- Include retry mechanisms where appropriate
- Use consistent error UI patterns across components

### 2. Loading State Management
- Provide visual feedback for all loading states
- Use progress indicators for long-running operations
- Implement skeleton loading for better perceived performance
- Handle edge cases (empty states, connection issues)

### 3. Performance Considerations
- Use CSS containment for list elements
- Implement proper cleanup in useEffect hooks
- Consider virtualization for very large lists
- Cache data appropriately to reduce API calls

### 4. Accessibility
- Ensure proper ARIA labels for loading states
- Make sortable columns keyboard accessible
- Provide alternative text for loading indicators
- Support screen readers with proper semantic markup

### 5. Theme Integration
- Use the theme context consistently
- Provide comprehensive color systems
- Ensure proper contrast ratios
- Test both light and dark themes

This comprehensive list implementation guide provides the exact patterns and practices used throughout HRVSTR, ensuring consistent, performant, and accessible list components across the platform. 