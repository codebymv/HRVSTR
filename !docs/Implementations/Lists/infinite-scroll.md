# Infinite Scroll Implementation Guide

## Introduction

Infinite scroll provides a seamless user experience by automatically loading more content as users scroll through a list, eliminating the need for traditional pagination controls. HRVSTR implements infinite scroll primarily in the Reddit Posts section, serving as a reference implementation for other components.

## Current Implementation Analysis

### Reddit Posts Infinite Scroll

**Location:** `src/components/SentimentScraper/RedditPostsSection.tsx`

The Reddit Posts component demonstrates a complete infinite scroll implementation using the Intersection Observer API with the following architecture:

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

  // Handle loading more posts
  const handleLoadMore = useCallback(() => {
    // Don't load if already loading, no more posts, or too soon since last load
    if (isLoadingMoreRef.current || !hasMore || isLoading) {
      return;
    }

    const now = Date.now();
    if (now - lastLoadTimeRef.current < 1000) {
      return;
    }

    isLoadingMoreRef.current = true;
    lastLoadTimeRef.current = now;

    onLoadMore();

    // Reset loading state after a delay
    setTimeout(() => {
      isLoadingMoreRef.current = false;
    }, 1000);
  }, [onLoadMore, isLoading, hasMore]);

  // Set up intersection observer
  useEffect(() => {
    if (!loadingRef.current || isLoading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMoreRef.current) {
          handleLoadMore();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(loadingRef.current);

    return () => {
      if (loadingRef.current) observer.unobserve(loadingRef.current);
    };
  }, [handleLoadMore, isLoading, hasMore]);

  return (
    <div className={`${cardBgColor} rounded-lg p-4 lg:p-5 border ${borderColor} ${className}`}>
      <h2 className={`text-lg font-semibold mb-2 ${textColor}`}>Latest Reddit Posts</h2>
      
      {isLoading && posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <Loader2 className="mb-2 text-blue-500 animate-spin" size={32} />
          <p className={`text-lg font-semibold ${textColor}`}>{loadingStage}</p>
          <div className="w-full max-w-sm mt-4 mb-2">
            <ProgressBar progress={loadingProgress} />
          </div>
          <div className={`text-xs ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>{loadingProgress}% complete</div>
        </div>
      ) : error ? (
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
      ) : posts.length > 0 ? (
        <div ref={containerRef} className="grid gap-4 max-h-[600px] overflow-y-auto pr-2">
          {posts.map(post => (
            <RedditPost key={post.id} post={post} />
          ))}
          <div 
            ref={loadingRef}
            className="w-full h-[120px] flex justify-center items-center"
            style={{ contain: 'layout size' }}
          >
            {isLoading && hasMore ? (
              <div className="flex flex-col items-center">
                <Loader2 className="mb-2 text-blue-500 animate-spin" size={24} />
                <p className={`text-sm ${mutedTextColor}`}>Loading more posts...</p>
              </div>
            ) : hasMore ? (
              <div className="h-[80px] opacity-0" /> // Invisible spacer when not loading
            ) : (
              <div className={`text-sm ${mutedTextColor} fade-in`}>No more posts to show</div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <Info className={`mb-2 ${mutedTextColor}`} size={32} />
          <p className={mutedTextColor}>No Reddit posts available</p>
        </div>
      )}
    </div>
  );
};
```

## Core Concepts

### 1. Intersection Observer API

The modern, performant way to detect when elements enter the viewport:

```typescript
const observer = new IntersectionObserver(
  (entries) => {
    // Callback when target element intersects with root
    if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMoreRef.current) {
      handleLoadMore();
    }
  },
  {
    rootMargin: '100px'  // Load content 100px before reaching bottom
  }
);
```

### 2. Load Prevention Mechanisms

Prevent duplicate requests and rapid-fire loading using multiple protection layers:

```typescript
// Ref-based loading prevention
const isLoadingMoreRef = useRef(false);
const lastLoadTimeRef = useRef(0);

const handleLoadMore = useCallback(() => {
  // Layer 1: Prevent duplicate requests
  if (isLoadingMoreRef.current || !hasMore || isLoading) {
    return;
  }

  // Layer 2: Throttle requests (minimum 1 second between loads)
  const now = Date.now();
  if (now - lastLoadTimeRef.current < 1000) {
    return;
  }

  // Layer 3: Set loading flags
  isLoadingMoreRef.current = true;
  lastLoadTimeRef.current = now;

  onLoadMore();

  // Reset loading state after delay
  setTimeout(() => {
    isLoadingMoreRef.current = false;
  }, 1000);
}, [onLoadMore, isLoading, hasMore]);
```

### 3. Sentinel Element Pattern

A dedicated element at the bottom of the list to trigger loading with proper CSS containment:

```typescript
<div 
  ref={loadingRef}
  className="w-full h-[120px] flex justify-center items-center"
  style={{ contain: 'layout size' }}
>
  {isLoading && hasMore ? (
    <div className="flex flex-col items-center">
      <Loader2 className="mb-2 text-blue-500 animate-spin" size={24} />
      <p className={`text-sm ${mutedTextColor}`}>Loading more posts...</p>
    </div>
  ) : hasMore ? (
    <div className="h-[80px] opacity-0" /> // Invisible spacer when not loading
  ) : (
    <div className={`text-sm ${mutedTextColor} fade-in`}>No more posts to show</div>
  )}
</div>
```

### 4. Enhanced Error Handling

The implementation includes specialized error handling for different error types:

```typescript
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

### 5. Theme Integration

Full theme-aware styling using the HRVSTR theme context:

```typescript
// Theme-specific styling using ThemeContext
const { theme } = useTheme();
const isLight = theme === 'light';
const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
const textColor = isLight ? 'text-stone-800' : 'text-white';
const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
const activeButtonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';
```

## Parent Component Data Management

The infinite scroll component works with a parent that implements the **Cached Infinite Scroll Pattern**:

```typescript
// Parent component data management (from useSentimentDashboardData hook)
const POSTS_PER_PAGE = 10;
const [redditPosts, setRedditPosts] = useState<RedditPostType[]>([]);
const [cachedRedditPosts, setCachedRedditPosts] = useState<RedditPostType[]>([]);
const [redditPage, setRedditPage] = useState(1);
const [hasMorePosts, setHasMorePosts] = useState(true);

// Load more posts handler
const handleLoadMorePosts = useCallback(() => {
  // Don't load if already loading or no more posts
  if (!hasMorePosts || loading.posts) {
    return;
  }

  // Set loading state for posts
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

## Implementation Guide

### Step 1: Basic Hook Setup

Create a reusable infinite scroll hook based on the actual implementation:

```typescript
// hooks/useInfiniteScroll.ts
import { useRef, useEffect, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
  throttleMs?: number;
}

export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = '100px',
  throttleMs = 1000
}: UseInfiniteScrollOptions) {
  const loadingRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(false);
  const lastLoadTimeRef = useRef(0);

  const handleLoadMore = useCallback(() => {
    // Don't load if already loading, no more posts, or too soon since last load
    if (isLoadingMoreRef.current || !hasMore || isLoading) {
      return;
    }

    const now = Date.now();
    if (now - lastLoadTimeRef.current < throttleMs) {
      return;
    }

    isLoadingMoreRef.current = true;
    lastLoadTimeRef.current = now;

    onLoadMore();

    // Reset loading state after a delay
    setTimeout(() => {
      isLoadingMoreRef.current = false;
    }, throttleMs);
  }, [onLoadMore, isLoading, hasMore, throttleMs]);

  useEffect(() => {
    if (!loadingRef.current || isLoading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMoreRef.current) {
          handleLoadMore();
        }
      },
      { rootMargin }
    );

    observer.observe(loadingRef.current);

    return () => {
      if (loadingRef.current) observer.unobserve(loadingRef.current);
    };
  }, [handleLoadMore, isLoading, hasMore, rootMargin]);

  return { loadingRef, containerRef };
}
```

### Step 2: Complete Component Implementation

Full implementation pattern matching the Reddit posts component:

```typescript
import React, { useRef, useCallback, useEffect } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface InfiniteListProps<T> {
  items: T[];
  isLoading: boolean;
  loadingProgress: number;
  loadingStage: string;
  error: string | null;
  className?: string;
  hasMore: boolean;
  onLoadMore: () => void;
  renderItem: (item: T) => React.ReactNode;
  title: string;
  emptyMessage: string;
}

const InfiniteList = <T,>({
  items,
  isLoading,
  loadingProgress,
  loadingStage,
  error,
  className = '',
  hasMore,
  onLoadMore,
  renderItem,
  title,
  emptyMessage
}: InfiniteListProps<T>) => {
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

  // Handle loading more items
  const handleLoadMore = useCallback(() => {
    // Don't load if already loading, no more items, or too soon since last load
    if (isLoadingMoreRef.current || !hasMore || isLoading) {
      return;
    }

    const now = Date.now();
    if (now - lastLoadTimeRef.current < 1000) {
      return;
    }

    isLoadingMoreRef.current = true;
    lastLoadTimeRef.current = now;

    onLoadMore();

    // Reset loading state after a delay
    setTimeout(() => {
      isLoadingMoreRef.current = false;
    }, 1000);
  }, [onLoadMore, isLoading, hasMore]);

  // Set up intersection observer
  useEffect(() => {
    if (!loadingRef.current || isLoading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMoreRef.current) {
          handleLoadMore();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(loadingRef.current);

    return () => {
      if (loadingRef.current) observer.unobserve(loadingRef.current);
    };
  }, [handleLoadMore, isLoading, hasMore]);

  return (
    <div className={`${cardBgColor} rounded-lg p-4 lg:p-5 border ${borderColor} ${className}`}>
      <h2 className={`text-lg font-semibold mb-2 ${textColor}`}>{title}</h2>
      
      {isLoading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <Loader2 className="mb-2 text-blue-500 animate-spin" size={32} />
          <p className={`text-lg font-semibold ${textColor}`}>{loadingStage}</p>
          <div className="w-full max-w-sm mt-4 mb-2">
            <ProgressBar progress={loadingProgress} />
          </div>
          <div className={`text-xs ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>{loadingProgress}% complete</div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          {error.toLowerCase().includes('rate limit') ? (
            <>
              <AlertTriangle className="mb-2 text-red-500" size={32} />
              <p className={`text-lg font-semibold ${textColor}`}>Rate Limit Exceeded</p>
              <p className={`mt-2 ${mutedTextColor}`}>The API is currently rate limiting requests. Please wait a moment and try again later.</p>
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
      ) : items.length > 0 ? (
        <div ref={containerRef} className="grid gap-4 max-h-[600px] overflow-y-auto pr-2">
          {items.map((item, index) => (
            <div key={index}>{renderItem(item)}</div>
          ))}
          <div 
            ref={loadingRef}
            className="w-full h-[120px] flex justify-center items-center"
            style={{ contain: 'layout size' }}
          >
            {isLoading && hasMore ? (
              <div className="flex flex-col items-center">
                <Loader2 className="mb-2 text-blue-500 animate-spin" size={24} />
                <p className={`text-sm ${mutedTextColor}`}>Loading more items...</p>
              </div>
            ) : hasMore ? (
              <div className="h-[80px] opacity-0" /> // Invisible spacer when not loading
            ) : (
              <div className={`text-sm ${mutedTextColor} fade-in`}>No more items to show</div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <Info className={`mb-2 ${mutedTextColor}`} size={32} />
          <p className={mutedTextColor}>{emptyMessage}</p>
        </div>
      )}
    </div>
  );
};

export default InfiniteList;
```

## Advanced Patterns

### 1. Cached Infinite Scroll (Reddit Posts Pattern)

For data that can be filtered and cached (exact implementation from HRVSTR):

```typescript
const CachedInfiniteList: React.FC = () => {
  // Constants
  const ITEMS_PER_PAGE = 10;
  
  // Cache all data
  const [cachedItems, setCachedItems] = useState<Item[]>([]);
  
  // Display filtered subset
  const [displayedItems, setDisplayedItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Loading states
  const [loading, setLoading] = useState({ items: false });
  const updateLoadingState = (updates: Partial<typeof loading>) => {
    setLoading(prev => ({ ...prev, ...updates }));
  };

  // Filter cached items based on criteria
  const filteredItems = useMemo(() => {
    return cachedItems.filter(item => {
      // Apply filters (time range, search, etc.)
      return matchesFilter(item, filters);
    });
  }, [cachedItems, filters]);

  // Load more from filtered cache
  const handleLoadMore = useCallback(() => {
    if (!hasMore || loading.items) {
      return;
    }

    updateLoadingState({ items: true });

    try {
      const nextPage = page + 1;
      const startIndex = (nextPage - 1) * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      
      // Get the next page of filtered items
      const newItems = filteredItems.slice(startIndex, endIndex);
      
      // Only update if we have new items
      if (newItems.length > 0) {
        setDisplayedItems(prev => [...prev, ...newItems]);
        setPage(nextPage);
        setHasMore(endIndex < filteredItems.length);
      } else {
        setHasMore(false);
      }
    } finally {
      // Always reset loading state
      updateLoadingState({ items: false });
    }
  }, [page, hasMore, loading.items, filteredItems]);

  // Reset when filters change
  useEffect(() => {
    setDisplayedItems(filteredItems.slice(0, ITEMS_PER_PAGE));
    setPage(1);
    setHasMore(filteredItems.length > ITEMS_PER_PAGE);
  }, [filteredItems]);

  return (
    <InfiniteList
      items={displayedItems}
      isLoading={loading.items}
      hasMore={hasMore}
      onLoadMore={handleLoadMore}
      // ... other props
    />
  );
};
```

## Performance Considerations

### 1. CSS Containment

Always use CSS containment on the sentinel element:

```typescript
<div 
  ref={loadingRef}
  className="w-full h-[120px] flex justify-center items-center"
  style={{ contain: 'layout size' }}
>
```

### 2. Memory Management

```typescript
// Implement cleanup for very long lists
const MAX_ITEMS = 1000;

const cleanupOldItems = useCallback(() => {
  if (items.length > MAX_ITEMS) {
    const itemsToKeep = items.slice(-MAX_ITEMS);
    setItems(itemsToKeep);
    // Adjust pagination counters accordingly
  }
}, [items]);

useEffect(() => {
  cleanupOldItems();
}, [cleanupOldItems]);
```

### 3. Request Deduplication

```typescript
// Prevent duplicate API calls
const pendingRequestRef = useRef<Promise<any> | null>(null);

const loadMoreItems = useCallback(async () => {
  if (pendingRequestRef.current) {
    return pendingRequestRef.current;
  }

  const request = fetchItems(page);
  pendingRequestRef.current = request;

  try {
    const result = await request;
    setItems(prev => [...prev, ...result]);
    return result;
  } finally {
    pendingRequestRef.current = null;
  }
}, [page]);
```

## Testing Infinite Scroll

### Unit Tests

```typescript
// Test infinite scroll hook
describe('useInfiniteScroll', () => {
  it('should call onLoadMore when sentinel is intersecting', () => {
    const onLoadMore = jest.fn();
    const mockObserver = createMockObserver();
    
    renderHook(() => useInfiniteScroll({
      hasMore: true,
      isLoading: false,
      onLoadMore
    }));

    // Simulate intersection
    mockObserver.triggerIntersection();
    
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('should not call onLoadMore when already loading', () => {
    const onLoadMore = jest.fn();
    
    renderHook(() => useInfiniteScroll({
      hasMore: true,
      isLoading: true, // Already loading
      onLoadMore
    }));

    // Should not call onLoadMore
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('should throttle rapid requests', () => {
    const onLoadMore = jest.fn();
    
    const { rerender } = renderHook(() => useInfiniteScroll({
      hasMore: true,
      isLoading: false,
      onLoadMore,
      throttleMs: 1000
    }));

    // First call should work
    // Simulate intersection
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    
    // Second call within 1000ms should be throttled
    // Simulate intersection again immediately
    expect(onLoadMore).toHaveBeenCalledTimes(1); // Still only called once
  });
});
```

### Integration Tests

```typescript
describe('InfiniteListComponent', () => {
  it('should load more items when scrolled to bottom', async () => {
    const mockItems = [{ id: 1, name: 'Item 1' }];
    const fetchMoreItems = jest.fn().mockResolvedValue(mockItems);
    
    render(<InfiniteListComponent fetchItems={fetchMoreItems} />);
    
    // Scroll to bottom
    fireEvent.scroll(screen.getByTestId('list-container'));
    
    await waitFor(() => {
      expect(fetchMoreItems).toHaveBeenCalled();
    });
    
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('should handle rate limit errors properly', async () => {
    const error = 'Rate limit exceeded';
    
    render(
      <InfiniteList
        items={[]}
        isLoading={false}
        error={error}
        hasMore={false}
        onLoadMore={() => {}}
        // ... other props
      />
    );
    
    expect(screen.getByText('Rate Limit Exceeded')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });
});
```

## Common Pitfalls and Solutions

### 1. Multiple Rapid Calls

**Problem:** Intersection Observer fires multiple times rapidly.

**Solution:** Implement comprehensive throttling with multiple protection layers:

```typescript
// Layer 1: Ref-based protection
if (isLoadingMoreRef.current || !hasMore || isLoading) return;

// Layer 2: Time-based throttling
if (now - lastLoadTimeRef.current < 1000) return;

// Layer 3: State flags
isLoadingMoreRef.current = true;
lastLoadTimeRef.current = now;
```

### 2. Memory Leaks

**Problem:** Intersection Observer not cleaned up properly.

**Solution:** Always clean up observers in useEffect cleanup:

```typescript
useEffect(() => {
  if (!loadingRef.current || isLoading || !hasMore) return;

  const observer = new IntersectionObserver(callback);
  observer.observe(loadingRef.current);
  
  return () => {
    if (loadingRef.current) observer.unobserve(loadingRef.current);
  };
}, [handleLoadMore, isLoading, hasMore]);
```

### 3. Layout Shifts

**Problem:** Content jumping when new items load.

**Solution:** Use consistent heights and CSS containment:

```typescript
// Fixed height sentinel with CSS containment
<div 
  ref={loadingRef}
  className="w-full h-[120px] flex justify-center items-center"
  style={{ contain: 'layout size' }}
>
  {/* Consistent height spacer when not loading */}
  {hasMore && !isLoading && <div className="h-[80px] opacity-0" />}
</div>
```

### 4. Theme Integration

**Problem:** Hard-coded colors that don't respect theme changes.

**Solution:** Use the theme context for all styling:

```typescript
const { theme } = useTheme();
const isLight = theme === 'light';
const dynamicStyles = {
  cardBg: isLight ? 'bg-stone-300' : 'bg-gray-800',
  border: isLight ? 'border-stone-400' : 'border-gray-700',
  text: isLight ? 'text-stone-800' : 'text-white',
  muted: isLight ? 'text-stone-600' : 'text-gray-400',
  button: isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'
};
```

## Browser Support

- **Intersection Observer**: Supported in all modern browsers
- **CSS Containment**: Supported in modern browsers, degrades gracefully
- **Fallback**: For older browsers, use scroll event listeners with throttling

```typescript
// Fallback for older browsers
const useScrollBasedInfiniteScroll = () => {
  useEffect(() => {
    const handleScroll = throttle(() => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        loadMore();
      }
    }, 100);

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);
};
```

This infinite scroll implementation guide provides the exact foundation used in HRVSTR's Reddit posts component, ensuring consistent implementation patterns throughout the platform for optimal user experience and efficient resource utilization. 