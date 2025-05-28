# Infinite Scroll Implementation Guide

## Introduction

Infinite scroll provides a seamless user experience by automatically loading more content as users scroll through a list, eliminating the need for traditional pagination controls. HRVSTR implements infinite scroll primarily in the Reddit Posts section, serving as a reference implementation for other components.

## Current Implementation Analysis

### Reddit Posts Infinite Scroll

**Location:** `src/components/SentimentScraper/RedditPostsSection.tsx`

The Reddit Posts component demonstrates a complete infinite scroll implementation using the Intersection Observer API with the following architecture:

```typescript
// Core infinite scroll implementation
const RedditPostsSection: React.FC<RedditPostsSectionProps> = ({
  posts,
  isLoading,
  hasMore,
  onLoadMore
}) => {
  // Refs for infinite scroll
  const loadingRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(false);
  const lastLoadTimeRef = useRef(0);
  
  // Intersection Observer setup
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
};
```

## Core Concepts

### 1. Intersection Observer API

The modern, performant way to detect when elements enter the viewport:

```typescript
const observer = new IntersectionObserver(
  (entries) => {
    // Callback when target element intersects with root
    if (entries[0].isIntersecting) {
      loadMoreContent();
    }
  },
  {
    // Options
    root: null,           // Use viewport as root
    rootMargin: '100px',  // Load content 100px before reaching bottom
    threshold: 0.1        // Trigger when 10% of target is visible
  }
);
```

### 2. Load Prevention Mechanisms

Prevent duplicate requests and rapid-fire loading:

```typescript
// Ref-based loading prevention
const isLoadingMoreRef = useRef(false);
const lastLoadTimeRef = useRef(0);

const handleLoadMore = useCallback(() => {
  // Prevent duplicate requests
  if (isLoadingMoreRef.current || !hasMore || isLoading) {
    return;
  }

  // Throttle requests (minimum 1 second between loads)
  const now = Date.now();
  if (now - lastLoadTimeRef.current < 1000) {
    return;
  }

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

A dedicated element at the bottom of the list to trigger loading:

```typescript
<div 
  ref={loadingRef}
  className="w-full h-[120px] flex justify-center items-center"
  style={{ contain: 'layout size' }}
>
  {isLoading && hasMore ? (
    <div className="flex flex-col items-center">
      <Loader2 className="mb-2 text-blue-500 animate-spin" size={24} />
      <p className="text-sm text-gray-400">Loading more posts...</p>
    </div>
  ) : hasMore ? (
    <div className="h-[80px] opacity-0" /> // Invisible spacer
  ) : (
    <div className="text-sm text-gray-400">No more posts to show</div>
  )}
</div>
```

## Implementation Guide

### Step 1: Basic Hook Setup

Create a reusable infinite scroll hook:

```typescript
// hooks/useInfiniteScroll.ts
import { useRef, useEffect, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
  threshold?: number;
  throttleMs?: number;
}

export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = '100px',
  threshold = 0.1,
  throttleMs = 1000
}: UseInfiniteScrollOptions) {
  const loadingRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);
  const lastLoadTimeRef = useRef(0);

  const handleLoadMore = useCallback(() => {
    // Prevent duplicate requests
    if (isLoadingMoreRef.current || !hasMore || isLoading) {
      return;
    }

    // Throttle requests
    const now = Date.now();
    if (now - lastLoadTimeRef.current < throttleMs) {
      return;
    }

    isLoadingMoreRef.current = true;
    lastLoadTimeRef.current = now;

    onLoadMore();

    // Reset loading state
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
      { rootMargin, threshold }
    );

    observer.observe(loadingRef.current);

    return () => {
      if (loadingRef.current) observer.unobserve(loadingRef.current);
    };
  }, [handleLoadMore, isLoading, hasMore, rootMargin, threshold]);

  return { loadingRef };
}
```

### Step 2: Data Management Pattern

Implement the data fetching and pagination logic:

```typescript
// Component implementation
const InfiniteListComponent: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const ITEMS_PER_PAGE = 20;

  const loadMoreItems = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const newItems = await fetchItems({
        page,
        limit: ITEMS_PER_PAGE
      });

      if (newItems.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }

      setItems(prev => [...prev, ...newItems]);
      setPage(prev => prev + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load items');
    } finally {
      setIsLoading(false);
    }
  }, [page, isLoading, hasMore]);

  // Use the infinite scroll hook
  const { loadingRef } = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: loadMoreItems
  });

  return (
    <div className="space-y-4">
      {items.map(item => (
        <ItemComponent key={item.id} item={item} />
      ))}
      
      <div ref={loadingRef} className="loading-sentinel">
        {/* Loading indicator */}
      </div>
    </div>
  );
};
```

### Step 3: Enhanced Loading States

Implement comprehensive loading and error states:

```typescript
// Loading sentinel component
const LoadingSentinel: React.FC<{
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  onRetry: () => void;
}> = ({ isLoading, hasMore, error, onRetry }) => {
  if (error) {
    return (
      <div className="flex flex-col items-center p-4">
        <AlertTriangle className="text-red-500 mb-2" size={24} />
        <p className="text-red-500 mb-2">{error}</p>
        <button 
          onClick={onRetry}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading && hasMore) {
    return (
      <div className="flex flex-col items-center p-4">
        <Loader2 className="animate-spin text-blue-500 mb-2" size={24} />
        <p className="text-gray-400">Loading more items...</p>
      </div>
    );
  }

  if (!hasMore) {
    return (
      <div className="flex items-center justify-center p-4">
        <p className="text-gray-400">No more items to show</p>
      </div>
    );
  }

  return <div className="h-20 opacity-0" />; // Invisible spacer
};
```

## Advanced Patterns

### 1. Cached Infinite Scroll (Reddit Posts Pattern)

For data that can be filtered and cached:

```typescript
const CachedInfiniteList: React.FC = () => {
  // Cache all data
  const [cachedItems, setCachedItems] = useState<Item[]>([]);
  
  // Display filtered subset
  const [displayedItems, setDisplayedItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const ITEMS_PER_PAGE = 10;

  // Filter cached items based on criteria
  const filteredItems = useMemo(() => {
    return cachedItems.filter(item => {
      // Apply filters (time range, search, etc.)
      return matchesFilter(item, filters);
    });
  }, [cachedItems, filters]);

  // Load more from filtered cache
  const loadMoreFromCache = useCallback(() => {
    const startIndex = page * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const newItems = filteredItems.slice(startIndex, endIndex);

    if (newItems.length > 0) {
      setDisplayedItems(prev => [...prev, ...newItems]);
      setPage(prev => prev + 1);
      setHasMore(endIndex < filteredItems.length);
    } else {
      setHasMore(false);
    }
  }, [page, filteredItems]);

  // Reset when filters change
  useEffect(() => {
    setDisplayedItems(filteredItems.slice(0, ITEMS_PER_PAGE));
    setPage(1);
    setHasMore(filteredItems.length > ITEMS_PER_PAGE);
  }, [filteredItems]);
};
```

### 2. Bidirectional Infinite Scroll

Load content in both directions:

```typescript
const useBidirectionalScroll = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [hasMoreUp, setHasMoreUp] = useState(true);
  const [hasMoreDown, setHasMoreDown] = useState(true);
  const [pageUp, setPageUp] = useState(0);
  const [pageDown, setPageDown] = useState(1);

  const loadMore = useCallback(async (direction: 'up' | 'down') => {
    const page = direction === 'up' ? pageUp : pageDown;
    const newItems = await fetchItems({ page, direction });

    if (direction === 'up') {
      setItems(prev => [...newItems, ...prev]);
      setPageUp(prev => prev + 1);
      setHasMoreUp(newItems.length > 0);
    } else {
      setItems(prev => [...prev, ...newItems]);
      setPageDown(prev => prev + 1);
      setHasMoreDown(newItems.length > 0);
    }
  }, [pageUp, pageDown]);

  return { items, hasMoreUp, hasMoreDown, loadMore };
};
```

### 3. Virtual Infinite Scroll

For performance with large datasets:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const VirtualInfiniteList: React.FC = () => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated item height
    overscan: 5
  });

  // Load more when scrolled near bottom
  useEffect(() => {
    const [lastItem] = [...virtualizer.getVirtualItems()].reverse();

    if (!lastItem) return;

    if (
      lastItem.index >= items.length - 1 &&
      hasMore &&
      !isLoading
    ) {
      loadMoreItems();
    }
  }, [virtualizer.getVirtualItems(), items.length, hasMore, isLoading]);

  return (
    <div ref={parentRef} className="h-96 overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            <ItemComponent item={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Performance Considerations

### 1. Memory Management

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

### 2. Request Deduplication

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

### 3. Optimistic Updates

```typescript
// Add optimistic updates for better UX
const addItemOptimistically = useCallback((newItem: Item) => {
  const optimisticItem = { ...newItem, _optimistic: true };
  setItems(prev => [optimisticItem, ...prev]);

  // Make API call and update with real data
  createItem(newItem).then(realItem => {
    setItems(prev => 
      prev.map(item => 
        item._optimistic && item.id === newItem.id 
          ? realItem 
          : item
      )
    );
  }).catch(() => {
    // Remove optimistic item on error
    setItems(prev => prev.filter(item => !item._optimistic));
  });
}, []);
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
});
```

## Common Pitfalls and Solutions

### 1. Multiple Rapid Calls

**Problem:** Intersection Observer fires multiple times rapidly.

**Solution:** Implement throttling and loading state checks.

### 2. Memory Leaks

**Problem:** Intersection Observer not cleaned up properly.

**Solution:** Always clean up observers in useEffect cleanup.

```typescript
useEffect(() => {
  const observer = new IntersectionObserver(callback);
  if (targetRef.current) observer.observe(targetRef.current);
  
  return () => {
    if (targetRef.current) observer.unobserve(targetRef.current);
  };
}, []);
```

### 3. Layout Shifts

**Problem:** Content jumping when new items load.

**Solution:** Use consistent item heights and skeleton placeholders.

## Browser Support

- **Intersection Observer**: Supported in all modern browsers
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

This infinite scroll implementation guide provides the foundation for creating smooth, performant infinite scrolling experiences throughout the HRVSTR platform, ensuring optimal user experience and efficient resource utilization. 