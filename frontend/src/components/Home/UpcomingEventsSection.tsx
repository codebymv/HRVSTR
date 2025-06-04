import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Clock, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Loader2,
  ChevronDown
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface EventItem {
  id: string;
  symbol: string;
  event_type: string;
  scheduled_at: string;
  status: string;
}

interface UpcomingEventsSectionProps {
  events: EventItem[];
  isLoading: boolean;
  error: string | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

// Utility functions for formatting (recreated from original)
const formatEventRelativeTime = (timestamp: string): string | null => {
  const now = new Date();
  const eventDate = new Date(timestamp);
  const diffMs = eventDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.ceil(diffDays / 7);
  const diffMonths = Math.ceil(diffDays / 30);

  if (diffDays < 0) {
    return null; // Past events
  } else if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else if (diffDays < 7) {
    return `${diffDays} days`;
  } else if (diffWeeks === 1) {
    return '~1 week away';
  } else if (diffWeeks < 4) {
    return `~${diffWeeks} weeks away`;
  } else if (diffMonths === 1) {
    return '~1 month away';
  } else {
    return `~${diffMonths} months away`;
  }
};

const getRelativeTimeBadgeStyle = (relativeTime: string) => {
  if (relativeTime === 'Today') {
    return { className: 'bg-red-500 text-white font-medium' };
  } else if (relativeTime === 'Tomorrow') {
    return { className: 'bg-orange-500 text-white font-medium' };
  } else if (relativeTime.includes('days') || relativeTime.includes('week')) {
    return { className: 'bg-blue-500 text-white font-medium' };
  } else {
    return { className: 'bg-gray-500 text-white font-medium' };
  }
};

const UpcomingEventsSection: React.FC<UpcomingEventsSectionProps> = ({
  events,
  isLoading,
  error,
  hasMore = false,
  onLoadMore,
  className = ''
}) => {
  const { theme } = useTheme();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Theme-specific styling - exactly matching other sections
  const isLight = theme === 'light';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const companyContainerBg = isLight ? 'bg-stone-200' : 'bg-gray-700';
  const companyContainerBorder = isLight ? 'border-stone-300' : 'border-gray-600';

  // Helper function to get event icon
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'Earnings':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'Dividend':
        return <DollarSign className="w-4 h-4 text-blue-500" />;
      default:
        return <Calendar className="w-4 h-4 text-blue-500" />;
    }
  };

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Helper function to format time
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper function to format date
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: '2-digit' });
  };

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!hasMore || !onLoadMore || isLoading || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, onLoadMore, isLoading, isLoadingMore]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !onLoadMore) return;
    
    setIsLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, onLoadMore]);

  // Group events by symbol
  const eventsBySymbol = events.reduce((acc, event) => {
    const symbol = event.symbol || 'Unknown';
    if (!acc[symbol]) {
      acc[symbol] = [];
    }
    acc[symbol].push(event);
    return acc;
  }, {} as { [key: string]: EventItem[] });

  if (isLoading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className={`w-6 h-6 animate-spin ${mutedTextColor}`} />
        <span className={`ml-2 ${mutedTextColor}`}>Loading upcoming events...</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500">Error: {error}</p>;
  }

  if (events.length === 0) {
    return <p className={mutedTextColor}>No upcoming events.</p>;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Render events grouped by symbol with containers */}
      {Object.entries(eventsBySymbol).map(([symbol, symbolEvents]) => (
        <div key={symbol} className={`${companyContainerBg} rounded-lg border ${companyContainerBorder} p-4`}>
          {/* Company Header - simple text, no additional background */}
          <div className="flex items-center mb-3">
            <span className={`text-lg font-semibold ${textColor}`}>{symbol}</span>
            <span className={`text-sm ${mutedTextColor} ml-2`}>
              ({symbolEvents.length} event{symbolEvents.length !== 1 ? 's' : ''})
            </span>
          </div>
          
          {/* Events List - simple vertical layout */}
          <div className="space-y-3">
            {symbolEvents.map((event) => (
              <div key={event.id || Math.random()} className={`py-3 border-b ${borderColor} last:border-b-0`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getEventIcon(event.event_type)}
                    <div>
                      <p className={`font-medium ${textColor}`}>
                        {capitalizeFirstLetter(event.event_type || 'event')}
                      </p>
                      <div className={`text-sm ${mutedTextColor}`}>
                        <span className="block sm:inline">{formatDate(event.scheduled_at)}</span>
                        <span className="block sm:inline sm:ml-1">at {formatTime(event.scheduled_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {(() => {
                      const relativeTime = formatEventRelativeTime(event.scheduled_at);
                      if (!relativeTime) {
                        return (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            event.status === 'scheduled' 
                              ? 'bg-blue-500 text-white'
                              : 'bg-green-500 text-white'
                          }`}>
                            {event.status || 'unknown'}
                          </span>
                        );
                      }
                      
                      const badgeStyle = getRelativeTimeBadgeStyle(relativeTime);
                      return (
                        <span className={`text-xs px-2 py-1 rounded-full ${badgeStyle.className}`}>
                          {relativeTime}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Infinite scroll loading indicator */}
      {hasMore && (
        <div 
          ref={loadMoreRef}
          className="flex items-center justify-center py-4"
        >
          {isLoadingMore ? (
            <>
              <Loader2 className={`w-5 h-5 animate-spin ${mutedTextColor} mr-2`} />
              <span className={mutedTextColor}>Loading more events...</span>
            </>
          ) : (
            <div className={`flex items-center space-x-2 text-sm ${mutedTextColor}`}>
              <ChevronDown className="w-4 h-4" />
              <span>Scroll for more events</span>
            </div>
          )}
        </div>
      )}

      {/* End of results indicator */}
      {!hasMore && events.length > 0 && (
        <div className="text-center py-4">
          <p className={`text-sm ${mutedTextColor}`}>
            No more events to show
          </p>
        </div>
      )}
    </div>
  );
};

export default UpcomingEventsSection;