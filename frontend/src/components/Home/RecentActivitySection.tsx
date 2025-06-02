import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ActivityItem {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  symbol: string | null;
  created_at: string;
}

interface RecentActivitySectionProps {
  activities: ActivityItem[];
  isLoading: boolean;
  loadingProgress: number;
  loadingStage: string;
  error: string | null;
  className?: string;
  hasMore: boolean;
  onLoadMore: () => void;
}

const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({
  activities,
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
  
  // Add container styling to match upcoming events
  const itemContainerBg = isLight ? 'bg-stone-200' : 'bg-gray-700';
  const itemContainerBorder = isLight ? 'border-stone-300' : 'border-gray-600';

  // Refs for infinite scroll
  const loadingRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(false);
  const lastLoadTimeRef = useRef(0);
  
  // Track if container is scrollable
  const [isScrollable, setIsScrollable] = useState(false);

  // Handle loading more activities
  const handleLoadMore = useCallback(() => {
    // Don't load if already loading, no more activities, or too soon since last load
    if (isLoadingMoreRef.current || !hasMore || isLoading) {
      return;
    }

    const now = Date.now();
    if (now - lastLoadTimeRef.current < 300) { // Reduced from 500ms to 300ms
      return;
    }

    isLoadingMoreRef.current = true;
    lastLoadTimeRef.current = now;

    onLoadMore();

    // Reset loading state after a shorter delay
    setTimeout(() => {
      isLoadingMoreRef.current = false;
    }, 300);
  }, [onLoadMore, isLoading, hasMore]);

  // Reset throttle when loading completes
  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => {
        isLoadingMoreRef.current = false;
      }, 100);
    }
  }, [isLoading]);

  // Direct scroll detection - more reliable than intersection observer
  useEffect(() => {
    if (!containerRef.current || !hasMore || isLoading) return;

    const container = containerRef.current;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      const containerIsScrollable = scrollHeight > clientHeight;
      
      // Update scrollable state
      setIsScrollable(containerIsScrollable);
      
      // If container isn't scrollable and we have more content, auto-load
      if (!containerIsScrollable && hasMore && !isLoading && !isLoadingMoreRef.current) {
        handleLoadMore();
        return;
      }
      
      // For scrollable containers: trigger when within 200px of bottom OR when 85% scrolled
      if (containerIsScrollable && (distanceFromBottom < 200 || scrollPercentage > 0.85) && hasMore && !isLoading && !isLoadingMoreRef.current) {
        handleLoadMore();
      }
    };

    // Initial check in case we're already at the bottom or container isn't scrollable
    handleScroll();

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleLoadMore, hasMore, isLoading, activities.length]); // Added activities.length to re-check when content changes

  // Helper function to format activity time
  const formatActivityTime = (timestamp: string) => {
    const date = new Date(timestamp);
    
    // Always show MM/DD/YY + time for all dates
    return date.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: '2-digit' }) + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get activity type icon/color
  const getActivityTypeIndicator = (activityType: string) => {
    switch (activityType.toLowerCase()) {
      case 'watchlist_add':
        return 'bg-green-500';
      case 'watchlist_remove':
        return 'bg-red-500';
      case 'tier_upgrade':
        return 'bg-blue-500';
      case 'tier_downgrade':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} h-96 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
          <Activity className="w-5 h-5 mr-2 text-blue-500" />
          Recent Activity
        </h2>
      </div>
      
      {isLoading && activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <Loader2 className="mb-2 text-blue-500 animate-spin" size={32} />
          <p className={`text-lg font-semibold ${textColor}`}>{loadingStage}</p>
          {loadingProgress > 0 && (
            <>
              <div className="w-full max-w-sm mt-4 mb-2">
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${loadingProgress}%` }}
                  ></div>
                </div>
              </div>
              <div className={`text-xs ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>{loadingProgress}% complete</div>
            </>
          )}
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
      ) : activities.length > 0 ? (
        <div ref={containerRef} className="space-y-4 overflow-y-auto h-72 pr-2">
          {activities.map((activity) => (
            <div key={activity.id} className={`${itemContainerBg} rounded-lg border ${itemContainerBorder} p-4`}>
              <div className="flex items-start space-x-3">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getActivityTypeIndicator(activity.activity_type)}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className={`font-medium ${textColor} truncate`}>{activity.title || 'No title'}</p>
                    {activity.symbol && (
                      <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ml-2 ${
                        isLight 
                          ? 'bg-blue-200 text-blue-800' 
                          : 'bg-blue-900 text-blue-300'
                      }`}>
                        {activity.symbol}
                      </span>
                    )}
                  </div>
                  {activity.description && (
                    <p className={`text-sm ${mutedTextColor} truncate mb-1`}>{activity.description}</p>
                  )}
                  <p className={`text-xs ${mutedTextColor}`}>{formatActivityTime(activity.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
          <div 
            ref={loadingRef}
            className="w-full h-[120px] flex justify-center items-center"
          >
            {isLoading && hasMore ? (
              <div className="flex flex-col items-center">
                <Loader2 className="mb-2 text-blue-500 animate-spin" size={24} />
                <p className={`text-sm ${mutedTextColor}`}>Loading more activities...</p>
              </div>
            ) : hasMore ? (
              <div className="h-[80px] w-full flex items-center justify-center">
                {isScrollable ? (
                  <div className={`text-xs ${mutedTextColor} opacity-50`}>Scroll to load more</div>
                ) : (
                  <div className={`text-xs ${mutedTextColor} opacity-50`}>Loading more...</div>
                )}
              </div>
            ) : (
              <div className={`text-sm ${mutedTextColor} fade-in`}>No more activities to show</div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <Info className={`mb-2 ${mutedTextColor}`} size={32} />
          <p className={mutedTextColor}>No recent activity.</p>
        </div>
      )}
    </div>
  );
};

export default RecentActivitySection;