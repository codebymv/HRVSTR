import { useState, useEffect, useCallback } from 'react';
import { TimeRange, RedditPost as RedditPostType } from '../types';

interface UseRedditPaginationReturn {
  redditPosts: RedditPostType[];
  redditPage: number;
  hasMorePosts: boolean;
  handleLoadMorePosts: () => void;
  resetPagination: () => void;
}

export function useRedditPagination(
  cachedRedditPosts: RedditPostType[],
  timeRange: TimeRange,
  postsPerPage: number = 10,
  onLoadingStateChange?: (loading: boolean) => void
): UseRedditPaginationReturn {
  const [redditPosts, setRedditPosts] = useState<RedditPostType[]>([]);
  const [redditPage, setRedditPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  
  // Helper function to calculate cutoff date based on time range
  const getCutoffDate = useCallback((timeRange: TimeRange): Date => {
    const now = new Date();
    
    switch (timeRange) {
      case '1d':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '1w':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '1m':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '3m':
      default:
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }
  }, []);
  
  // Helper function to filter posts by time range
  const filterPostsByTimeRange = useCallback((
    posts: RedditPostType[], 
    timeRange: TimeRange
  ): RedditPostType[] => {
    const cutoffDate = getCutoffDate(timeRange);
    
    return posts.filter(post => {
      const postDate = new Date(post.created);
      return postDate >= cutoffDate;
    });
  }, [getCutoffDate]);
  
  // Load more posts handler
  const handleLoadMorePosts = useCallback(() => {
    if (!hasMorePosts || !cachedRedditPosts.length) {
      return;
    }

    // Set loading state if callback provided
    if (onLoadingStateChange) {
      onLoadingStateChange(true);
    }

    try {
      const nextPage = redditPage + 1;
      const startIndex = (nextPage - 1) * postsPerPage;
      const endIndex = startIndex + postsPerPage;
      
      // Filter posts based on current time range
      const filteredPosts = filterPostsByTimeRange(cachedRedditPosts, timeRange);
      
      // Get the next page of filtered posts
      const newPosts = filteredPosts.slice(startIndex, endIndex);
      
      if (newPosts.length > 0) {
        setRedditPosts(prev => [...prev, ...newPosts]);
        setRedditPage(nextPage);
        setHasMorePosts(endIndex < filteredPosts.length);
      } else {
        setHasMorePosts(false);
      }
    } finally {
      // Always reset loading state
      if (onLoadingStateChange) {
        onLoadingStateChange(false);
      }
    }
  }, [
    redditPage, 
    hasMorePosts, 
    cachedRedditPosts, 
    timeRange, 
    postsPerPage, 
    filterPostsByTimeRange, 
    onLoadingStateChange
  ]);
  
  // Reset pagination state
  const resetPagination = useCallback(() => {
    setRedditPage(1);
    setRedditPosts([]);
    setHasMorePosts(true);
  }, []);
  
  // Effect to filter and display Reddit posts whenever cached posts or timeRange changes
  useEffect(() => {
    if (cachedRedditPosts.length > 0) {
      console.log('Filtering cached Reddit posts based on current time range:', timeRange);
      
      // Filter posts based on time range
      const filteredPosts = filterPostsByTimeRange(cachedRedditPosts, timeRange);
      
      // Reset pagination when time range changes
      setRedditPage(1);
      setRedditPosts(filteredPosts.slice(0, postsPerPage));
      setHasMorePosts(filteredPosts.length > postsPerPage);
      
      console.log(`Displaying ${filteredPosts.length} Reddit posts for ${timeRange} time range`);
    } else {
      // Reset when no cached posts
      resetPagination();
    }
  }, [cachedRedditPosts, timeRange, postsPerPage, filterPostsByTimeRange, resetPagination]);
  
  return {
    redditPosts,
    redditPage,
    hasMorePosts,
    handleLoadMorePosts,
    resetPagination,
  };
} 