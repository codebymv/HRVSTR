import React, { useRef, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Info, Loader2, Star, RefreshCw, Trash2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTierLimits } from '../../hooks/useTierLimits';

interface WatchlistItem {
  id: string;
  symbol: string;
  company_name: string;
  last_price: string | number | null;
  price_change: string | number | null;
}

interface WatchlistSectionProps {
  watchlist: WatchlistItem[];
  isLoading: boolean;
  loadingProgress: number;
  loadingStage: string;
  error: string | null;
  className?: string;
  hasMore: boolean;
  onLoadMore: () => void;
  onAddTicker: () => void;
  onRemoveTicker: (symbol: string, name: string) => void;
  onRefresh: () => void;
  refreshingData: boolean;
  rateLimitActive: boolean;
  isAddingTicker: boolean;
  watchlistLimit?: number;
}

const WatchlistSection: React.FC<WatchlistSectionProps> = ({
  watchlist,
  isLoading,
  loadingProgress,
  loadingStage,
  error,
  className = '',
  hasMore,
  onLoadMore,
  onAddTicker,
  onRemoveTicker,
  onRefresh,
  refreshingData,
  rateLimitActive,
  isAddingTicker,
  watchlistLimit
}) => {
  // Theme-specific styling using ThemeContext
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const priceTextColor = isLight ? 'text-stone-600' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const activeButtonBgColor = 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700';
  const buttonBgColor = 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700';
  
  // Add container styling to match upcoming events
  const itemContainerBg = isLight ? 'bg-stone-200' : 'bg-gray-700';
  const itemContainerBorder = isLight ? 'border-stone-300' : 'border-gray-600';

  // Check if user is over their limit (tier downgrade case)
  const isOverLimit = watchlistLimit && watchlist.length > watchlistLimit;
  const disableAddButton = isOverLimit || isAddingTicker;

  // Show only items up to the limit (hide excess items for cleaner UX)
  const visibleWatchlist = isOverLimit && watchlistLimit 
    ? watchlist.slice(0, watchlistLimit)
    : watchlist;
  
  // Calculate hidden items count
  const hiddenItemsCount = isOverLimit ? watchlist.length - (watchlistLimit || 0) : 0;

  // Refs for infinite scroll
  const loadingRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isLoadingMoreRef = useRef(false);
  const lastLoadTimeRef = useRef(0);

  // Handle loading more watchlist items
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

  const formatPrice = (price: string | number | null): string => {
    if (price === null || price === undefined) return '-';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return isNaN(numPrice) ? '-' : `$${numPrice.toFixed(2)}`;
  };

  const formatPriceChange = (change: string | number | null): { formatted: string; isPositive: boolean } => {
    if (change === null || change === undefined) return { formatted: '-', isPositive: false };
    const numChange = typeof change === 'string' ? parseFloat(change) : change;
    if (isNaN(numChange)) return { formatted: '-', isPositive: false };
    
    const isPositive = numChange >= 0;
    const formatted = `${isPositive ? '+' : ''}${numChange.toFixed(2)}`;
    return { formatted, isPositive };
  };

  return (
    <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} h-[32rem] sm:h-96 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
          <Star className="w-5 h-5 mr-2 text-purple-600" />
          Watchlist
        </h2>
        <div className="flex items-center space-x-2">
          <button 
            onClick={onAddTicker}
            disabled={disableAddButton}
            className={`text-sm ${buttonBgColor} text-white px-3 py-1 rounded transition-colors ${disableAddButton ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isOverLimit ? 'Upgrade to access all your watchlist items' : 'Add a new ticker to your watchlist'}
          >
            {isAddingTicker ? (
              <>
                <Loader2 size={14} className="inline animate-spin mr-1" />
                Adding...
              </>
            ) : isOverLimit ? (
              'Upgrade Plan'
            ) : (
              'Add Ticker'
            )}
          </button>
          <button
            onClick={onRefresh}
            disabled={refreshingData || rateLimitActive}
            className={`p-2 rounded-full ${rateLimitActive ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'} text-white transition-all ${(refreshingData || rateLimitActive) ? 'opacity-50' : ''}`}
            title={refreshingData ? 'Refreshing...' : rateLimitActive ? 'Rate Limited...' : 'Refresh Data'}
          >
            {refreshingData ? (
              <Loader2 size={18} className="text-white animate-spin" />
            ) : (
              <RefreshCw size={18} className="text-white" />
            )}
          </button>
        </div>
      </div>

      {isLoading && watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <Loader2 className="mb-2 text-blue-500 animate-spin" size={32} />
          <p className={`text-lg font-semibold ${textColor}`}>{loadingStage}</p>
          {loadingProgress > 0 && (
            <>
              <div className="w-full max-w-sm mt-4 mb-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300" 
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
      ) : watchlist.length > 0 ? (
        <div ref={containerRef} className="space-y-4 overflow-y-auto h-[26rem] sm:h-72 pr-2">
          {visibleWatchlist.map((item) => {
            const priceChangeInfo = formatPriceChange(item.price_change);
            
            return (
              <div key={item.symbol || Math.random()} className={`${itemContainerBg} rounded-lg border ${itemContainerBorder} p-4`}>
                {/* Mobile Layout */}
                <div className="block sm:hidden">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className={`text-lg font-semibold ${textColor}`}>{item.symbol || 'N/A'}</div>
                      <div className={`text-sm ${mutedTextColor} truncate`}>{item.company_name || 'N/A'}</div>
                    </div>
                    <button
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      onClick={() => onRemoveTicker(item.symbol, item.company_name)}
                      title="Remove from watchlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className={`text-xl font-bold ${priceTextColor}`}>
                      {formatPrice(item.last_price)}
                    </div>
                    <div className={`text-sm font-medium ${priceChangeInfo.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                      {priceChangeInfo.formatted}
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center justify-between">
                  <div className="flex-1">
                    <div className={`text-lg font-semibold ${textColor}`}>{item.symbol || 'N/A'}</div>
                    <div className={`text-sm ${mutedTextColor} truncate max-w-[200px]`}>{item.company_name || 'N/A'}</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className={`text-xl font-bold ${priceTextColor}`}>
                      {formatPrice(item.last_price)}
                    </div>
                  </div>
                  <div className="flex-1 text-right">
                    <div className={`text-lg font-medium ${priceChangeInfo.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                      {priceChangeInfo.formatted}
                    </div>
                  </div>
                  <div className="flex justify-center ml-4">
                    <button
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      onClick={() => onRemoveTicker(item.symbol, item.company_name)}
                      title="Remove from watchlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          
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
            ) : visibleWatchlist.length >= 10 ? (
              <div className={`text-sm ${mutedTextColor} fade-in`}>All watchlist items loaded</div>
            ) : visibleWatchlist.length > 0 ? (
              // Show encouraging message for any non-empty watchlist under the limit
              <div className="flex flex-col items-center text-center space-y-2">
                <div className={`text-sm ${mutedTextColor}`}>
                  End of watchlist
                </div>
                
                {/* Progress bar showing watchlist usage */}
                {watchlistLimit && (
                  <div className="flex flex-col items-center space-y-2 w-full max-w-48">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${Math.min((visibleWatchlist.length / watchlistLimit) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <div className={`text-xs ${mutedTextColor}`}>
                      {visibleWatchlist.length} of {watchlistLimit} slots used
                    </div>
                  </div>
                )}
                
                {hiddenItemsCount > 0 ? (
                  <div className="flex flex-col items-center space-y-1">
                    <div className={`text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full`}>
                      {hiddenItemsCount} item{hiddenItemsCount > 1 ? 's' : ''} hidden
                    </div>
                    <div className={`text-xs ${mutedTextColor} max-w-48 text-center`}>
                      Upgrade your plan to access all items
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={onAddTicker}
                    className={`text-xs px-3 py-1 ${buttonBgColor} text-white rounded-full transition-all`}
                  >
                    Search tickers to add more
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-10 text-center">
          <Info className={`mb-2 ${mutedTextColor}`} size={32} />
          <p className={mutedTextColor}>Your watchlist is empty.</p>
          <p className={`text-sm ${mutedTextColor} mt-2 mb-4`}>
            Add stocks you want to track to get personalized insights.
          </p>
          <button 
            onClick={onAddTicker}
            className={`px-4 py-2 ${buttonBgColor} text-white rounded-md transition-all`}
          >
            Add Your First Stock
          </button>
        </div>
      )}
    </div>
  );
};

export default WatchlistSection;