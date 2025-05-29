import React, { useRef, useCallback, useEffect } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import RedditPost from './RedditPost';
import ProgressBar from '../ProgressBar';
import { RedditPost as RedditPostType } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

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

export default RedditPostsSection;