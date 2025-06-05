import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { 
  BarChart2, 
  ListChecks, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  ArrowRight,
  Star,
  Activity,
  DollarSign,
  Calendar,
  RefreshCw,
  Loader2,
  Trash2,
  Crown,
  Zap,
  Building,
  Settings,
  Key,
  BarChart
} from 'lucide-react';
import AddTickerModal from '../Watchlist/AddTickerModal';
import WatchlistSection from '../Watchlist/WatchlistSection';
import RecentActivitySection from './RecentActivitySection';
import WelcomeSection from './WelcomeSection';
import AlphaVantageSetupCard from './AlphaVantageSetupCard';
import ConfirmationDialog from '../UI/ConfirmationDialog';
import TierLimitDialog from '../UI/TierLimitDialog';
import RateLimitNotification from '../UI/RateLimitNotification';
import { formatEventRelativeTime, getRelativeTimeBadgeStyle } from '../../utils/timeUtils';
import { useTier } from '../../contexts/TierContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import { useWatchlistInfiniteScroll } from '../../hooks/useWatchlistInfiniteScroll';
import { useRecentActivityInfiniteScroll } from '../../hooks/useRecentActivityInfiniteScroll';
import { useUpcomingEventsInfiniteScroll } from '../../hooks/useUpcomingEventsInfiniteScroll';
import UpcomingEventsSection from './UpcomingEventsSection';
import { useLimitToasts } from '../../utils/limitToasts';

interface WatchlistItem {
  id: string;
  symbol: string;
  company_name: string;
  last_price: string | number | null;
  price_change: string | number | null;
}

interface ActivityItem {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  symbol: string | null;
  created_at: string; // Assuming ISO string timestamp
}

interface EventItem {
  id: string;
  symbol: string;
  event_type: string;
  scheduled_at: string; // Assuming ISO string timestamp
  status: string;
}

const UserHome: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { tierInfo } = useTier();
  const { showTierLimitDialog, tierLimitDialog, closeTierLimitDialog } = useTierLimits();
  const { 
    showWatchlistLimitReached, 
    showSearchLimitReached, 
    showPriceUpdateLimitReached,
    showCreditLimitExceeded
  } = useLimitToasts();
  
  // Infinite scroll watchlist hook
  const {
    watchlist: infiniteWatchlist,
    hasMore: hasMoreWatchlist,
    loading: watchlistLoading,
    loadingProgress: watchlistProgress,
    loadingStage: watchlistStage,
    error: infiniteWatchlistError,
    handleLoadMore: handleLoadMoreWatchlist,
    fetchWatchlist: fetchInfiniteWatchlist,
    resetPagination
  } = useWatchlistInfiniteScroll();

  // Infinite scroll recent activity hook
  const {
    activities: recentActivity,
    hasMore: hasMoreActivity,
    loading: activityLoading,
    loadingProgress: activityProgress,
    loadingStage: activityStage,
    error: activityError,
    handleLoadMore: handleLoadMoreActivity,
    fetchActivities: fetchRecentActivity,
    resetPagination: resetActivityPagination
  } = useRecentActivityInfiniteScroll();

  // Infinite scroll upcoming events hook
  const {
    events: upcomingEvents,
    hasMore: hasMoreEvents,
    loading: eventsLoading,
    loadingProgress: eventsProgress,
    loadingStage: eventsStage,
    error: eventsError,
    handleLoadMore: handleLoadMoreEvents,
    fetchEvents: fetchUpcomingEvents,
    resetPagination: resetEventsPagination
  } = useUpcomingEventsInfiniteScroll();

  // Legacy watchlist state for backwards compatibility
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

  // Legacy activity states - kept for backward compatibility but no longer used
  const [loadingActivity, setLoadingActivity] = useState(true);

  // Other existing state
  const [watchlistLimit, setWatchlistLimit] = useState<number | undefined>(undefined);
  const [isAddTickerModalOpen, setIsAddTickerModalOpen] = useState(false);
  const [refreshingData, setRefreshingData] = useState(false);
  const [rateLimitActive, setRateLimitActive] = useState(false);
  const [isAddingTicker, setIsAddingTicker] = useState(false);

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [tickerToRemove, setTickerToRemove] = useState<{ symbol: string; name: string } | null>(null);
  const [isRemovingTicker, setIsRemovingTicker] = useState(false);
  
  // Alpha Vantage API key status
  const [alphaVantageConfigured, setAlphaVantageConfigured] = useState<boolean>(false);
  const [checkingApiKeys, setCheckingApiKeys] = useState<boolean>(true);

  // Add refs to track if requests are in progress to prevent duplicate calls
  const fetchingWatchlist = useRef(false);
  const fetchingActivity = useRef(false);

  // Add cache with timestamps to prevent unnecessary requests
  const dataCache = useRef({
    watchlist: { data: null as WatchlistItem[] | null, timestamp: 0 },
    activity: { data: null as ActivityItem[] | null, timestamp: 0 }
  });

  // Cache duration in milliseconds (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000;

  // Update legacy watchlist state when infinite scroll watchlist changes
  useEffect(() => {
    setWatchlist(infiniteWatchlist);
    setLoadingWatchlist(!!watchlistLoading);
    setWatchlistError(infiniteWatchlistError);
  }, [infiniteWatchlist, watchlistLoading, infiniteWatchlistError]);

  // Update legacy activity state when infinite scroll activity changes  
  useEffect(() => {
    setLoadingActivity(!!activityLoading);
  }, [activityLoading]);

  // Load data on mount
  useEffect(() => {
    fetchInfiniteWatchlist();
    fetchRecentActivity();
  }, [fetchInfiniteWatchlist, fetchRecentActivity]);

  // Load watchlist limit from sessionStorage on mount
  useEffect(() => {
    try {
      const storedLimits = sessionStorage.getItem('watchlist_limits');
      if (storedLimits) {
        const limits = JSON.parse(storedLimits);
        if (limits.watchlist) {
          setWatchlistLimit(limits.watchlist);
        }
      }
    } catch (error) {
      console.error('Error loading watchlist limits from storage:', error);
    }
  }, []);

  // Set default watchlist limit based on tier if not already set
  useEffect(() => {
    if (!watchlistLimit && tierInfo?.tier) {
      const defaultLimits = {
        'free': 3,      // Based on marketing: "3 watchlist stocks"
        'pro': 25,      // Based on usage page: "4/25" 
        'elite': 50,    // Based on marketing: "50 watchlist stocks"
        'institutional': 500
      };
      const tierLimit = defaultLimits[tierInfo.tier.toLowerCase() as keyof typeof defaultLimits] || 3;
      setWatchlistLimit(tierLimit);
    }
  }, [watchlistLimit, tierInfo?.tier]);

  // Helper function to check if cached data is still valid
  const isCacheValid = (timestamp: number) => {
    return Date.now() - timestamp < CACHE_DURATION;
  };

  // Debounce utility to prevent rapid successive calls
  const debounceTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});
  
  const debounce = (key: string, func: () => void, delay: number = 1000) => {
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }
    debounceTimers.current[key] = setTimeout(func, delay);
  };

  // Theme-specific styling
  const isLight = theme === 'light';
  const bgColor = isLight ? 'bg-stone-100' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const welcomeTextColor = isLight ? 'text-stone-600' : 'text-white';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';
  const membershipTextColor = isLight ? 'text-amber-600' : 'text-amber-400';
  
  // Container styling for buttons - matching upcoming events
  const buttonContainerBg = isLight ? 'bg-stone-200' : 'bg-gray-700';
  const buttonContainerBorder = isLight ? 'border-stone-300' : 'border-gray-600';

  // Add icon filter for theme switching
  const iconFilter = isLight ? 'invert(1) brightness(0)' : 'none';



  // Check Alpha Vantage API key status
  const checkAlphaVantageApiKeyStatus = useCallback(async () => {
    if (!user?.token) {
      setCheckingApiKeys(false);
      return;
    }

    try {
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      const response = await fetch(`${proxyUrl}/api/settings/key-status`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.dataSources) {
          setAlphaVantageConfigured(data.dataSources.alpha_vantage || false);
        }
      }
    } catch (error) {
      console.error('Error checking Alpha Vantage API key status:', error);
      setAlphaVantageConfigured(false);
    } finally {
      setCheckingApiKeys(false);
    }
  }, [user?.token]);

  // Refresh API key status when the user returns to this tab/window  
  const refreshApiKeyStatus = useCallback(async () => {
    if (!user?.token) {
      return;
    }

    try {
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      const response = await fetch(`${proxyUrl}/api/settings/key-status`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.dataSources) {
          setAlphaVantageConfigured(data.dataSources.alpha_vantage || false);
        }
      }
    } catch (error) {
      console.error('Error refreshing Alpha Vantage API key status:', error);
    }
  }, [user?.token]);

  // Single effect to fetch all data when user token is available
  useEffect(() => {
    if (user?.token) {
      // Debounce the initial data fetch to prevent rapid successive calls
      debounce('initialFetch', () => {
        // Watchlist, activity, and events are now handled by their respective infinite scroll hooks
        // No need to manually call fetch functions here as they're handled in the hooks
        checkAlphaVantageApiKeyStatus();
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

  // Add event listeners for when user returns to the tab/window to refresh API key status
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshApiKeyStatus();
      }
    };

    const handleFocus = () => {
      refreshApiKeyStatus();
    };

    // Add event listeners for when user returns to the tab
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Cleanup event listeners
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshApiKeyStatus]);

  // Cleanup effect to clear debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // Helper function to format date/time with MM/DD/YY for better context
  const formatActivityTime = (timestamp: string) => {
    const date = new Date(timestamp);
    
    // Always show MM/DD/YY + time for all dates
    return date.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: '2-digit' }) + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper function to format time for events (basic example)
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Helper function to format date (basic example)
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Helper function to safely parse price values (handles both strings and numbers)
  const parsePrice = (price: string | number | null | undefined): number | null => {
    if (price === null || price === undefined) return null;
    
    // If it's already a number, return it
    if (typeof price === 'number' && !isNaN(price)) {
      return price;
    }
    
    // If it's a string, try to parse it
    if (typeof price === 'string') {
      const parsed = parseFloat(price);
      return !isNaN(parsed) ? parsed : null;
    }
    
    return null;
  };

  // Helper function to format price for display
  const formatPrice = (price: string | number | null | undefined): string => {
    const parsedPrice = parsePrice(price);
    return parsedPrice !== null ? `$${parsedPrice.toFixed(2)}` : 'N/A';
  };

  // Helper function to format price change for display
  const formatPriceChange = (change: string | number | null | undefined): string => {
    const parsedChange = parsePrice(change);
    if (parsedChange !== null) {
      const formatted = parsedChange.toFixed(2);
      return parsedChange >= 0 ? `+${formatted}` : formatted;
    }
    return 'N/A';
  };

  // Helper function to get price change color
  const getPriceChangeColor = (change: string | number | null | undefined): string => {
    const parsedChange = parsePrice(change);
    if (parsedChange !== null) {
      return parsedChange >= 0 ? 'text-green-500' : 'text-red-500';
    }
    return 'text-gray-500';
  };

  // Add this helper function before the return statement
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'Earnings':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'Dividend':
        return <DollarSign className="w-5 h-5 text-blue-500" />;
      default:
        return <Calendar className="w-5 h-5 text-blue-500" />;
    }
  };

  const handleAddTicker = async (symbol: string) => {
    setIsAddingTicker(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      // Add ticker to watchlist
      const response = await axios.post(`${apiUrl}/api/stocks/watchlist`, { symbol }, {
        headers: {
          Authorization: `Bearer ${user?.token}`
        }
      });

      // Check for tier limit response
      if (response.status === 202 && response.data.tierLimitReached) {
        
        // Check if this was an Alpha Vantage limit (external API limit)
        if (response.data.alphaVantageLimit) {
          showTierLimitDialog(
            'Real-time Price Data',
            `You've reached the daily limit for real-time price updates (25/day for Free tier). Your stock was added to the watchlist but without current pricing.`,
            'Upgrade to Pro for unlimited real-time price updates, advanced analytics, and priority data access.',
            'watchlist'
          );
        } else {
          // Internal tier limit reached
          showTierLimitDialog(
            'Watchlist Price Updates',
            `You've reached the daily price update limit (25/day for Free tier). The stock was added but current pricing is unavailable today.`,
            'Upgrade to Pro for unlimited price updates, real-time data, and advanced portfolio tracking.',
            'watchlist'
          );
        }
        return; // Don't continue with UI updates
      }
      
      // Clear cache first to ensure fresh data
      dataCache.current.watchlist.timestamp = 0;
      dataCache.current.activity.timestamp = 0;

      // Try to trigger backend data refresh, but don't let it block the UI update
      try {
        await axios.post(`${apiUrl}/api/stocks/refresh-watchlist-data`, {}, {
          headers: {
            Authorization: `Bearer ${user?.token}`
          }
        });
      } catch (refreshError) {
        console.warn('Backend refresh failed, but continuing with frontend update:', refreshError);
        // Don't throw - we'll still update the frontend
      }

      // Always update the frontend regardless of backend refresh success
      await Promise.all([
        fetchInfiniteWatchlist(true),
        fetchRecentActivity(true),
        fetchUpcomingEvents(true)
      ]);

    } catch (error: any) {
      console.error('Error adding ticker:', error);
      
      // Check for tier limit error responses
      if (error.response?.status === 202 && error.response?.data?.tierLimitReached) {
        
        // Check if this was an Alpha Vantage limit
        if (error.response.data.alphaVantageLimit) {
          showTierLimitDialog(
            'Real-time Price Data',
            `You've reached the daily limit for real-time price updates (25/day for Free tier). Your stock was added to the watchlist but without current pricing.`,
            'Upgrade to Pro for unlimited real-time price updates, advanced analytics, and priority data access.',
            'watchlist'
          );
        } else {
          showTierLimitDialog(
            'Watchlist Price Updates', 
            `You've reached the daily price update limit (25/day for Free tier). The stock was added but current pricing is unavailable today.`,
            'Upgrade to Pro for unlimited price updates, real-time data, and advanced portfolio tracking.',
            'watchlist'
          );
        }
        return;
      }
      
      // Check for other tier limit types (402 status) - Use new toast system for some cases
      if (error.response?.status === 402 && error.response?.data?.error === 'tier_limit') {
        const tierLimitType = error.response.data.tierLimitType;
        const usage = error.response.data.usage;
        const currentTier = tierInfo?.tier || 'free';
        
        if (tierLimitType === 'search') {
          // Use new toast system for search limits
          showSearchLimitReached(usage?.current, usage?.limit, currentTier);
        } else if (tierLimitType === 'watchlist') {
          // Use new toast system for watchlist limits
          showWatchlistLimitReached(usage?.current, usage?.limit, currentTier);
        } else if (tierLimitType === 'price_updates') {
          // Use new toast system for price update limits
          showPriceUpdateLimitReached(usage?.current, usage?.limit, currentTier);
        } else if (tierLimitType === 'credit') {
          // Use new toast system for credit limits
          showCreditLimitExceeded(usage?.remaining || 0);
        } else {
          // Keep existing tier limit dialog for other types
          showTierLimitDialog(
            'Daily Limit Reached',
            `You've reached your daily limit for this feature (Free tier: ${usage?.current || 25}/${usage?.limit || 25}). Upgrade for unlimited access.`,
            'Upgrade to Pro for unlimited access to all features and real-time data.',
            'watchlist'
          );
        }
        return;
      }
      
      // If the actual ticker addition failed, show an error or handle appropriately
      if (error.response?.status !== 200) {
        // Handle ticker addition failure
        console.error('Failed to add ticker to watchlist');
      }
    } finally {
      setIsAddingTicker(false);
    }
  };

  const handleRemoveTicker = async (symbol: string) => {
    setIsRemovingTicker(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      await axios.delete(`${apiUrl}/api/stocks/watchlist`, {
        headers: {
          Authorization: `Bearer ${user?.token}`,
          'Content-Type': 'application/json'
        },
        data: { symbol }
      });
      // Clear cache and force refresh data after removing
      dataCache.current.watchlist.timestamp = 0;
      dataCache.current.activity.timestamp = 0;
      fetchInfiniteWatchlist(true);
      fetchRecentActivity(true);
      fetchUpcomingEvents(true);
    } catch (error) {
      console.error('Error removing ticker:', error);
    } finally {
      setIsRemovingTicker(false);
      setTickerToRemove(null);
    }
  };

  const handleRefreshData = async () => {
    setRefreshingData(true);
    setRateLimitActive(false);
    
    try {
      // Reset pagination and refresh all data
      resetPagination();
      resetActivityPagination();
      resetEventsPagination();
      
      await Promise.all([
        fetchInfiniteWatchlist(true),
        fetchRecentActivity(true),
        fetchUpcomingEvents(true)
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshingData(false);
    }
  };



  return (
    <div className={`min-h-screen ${bgColor} p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Rate Limit Notification */}
        <RateLimitNotification isActive={rateLimitActive} />
        {/* Welcome Section */}
        <WelcomeSection
          userName={user?.name}
          userTier={tierInfo?.tier}
          theme={theme}
          cardBgColor={cardBgColor}
          borderColor={borderColor}
          welcomeTextColor={welcomeTextColor}
          iconFilter={iconFilter}
        />

        {/* Navigation */}
        {/* <div className={`${cardBgColor} rounded-lg p-6 mb-6 border ${borderColor}`}>
          <h2 className={`text-xl font-semibold ${textColor} mb-4 flex items-center`}>
            <ArrowRight className="w-5 h-5 mr-2 text-blue-500" />
            Navigation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => navigate('/sentiment')}
              className={`${buttonContainerBg} p-4 rounded-lg border ${buttonContainerBorder} hover:scale-105 transition-transform flex items-center space-x-3`}
            >
              <BarChart2 className="w-6 h-6 text-blue-500" />
              <span className={textColor}>Sentiment Scraper</span>
            </button>
            <button 
              onClick={() => navigate('/sec-filings')}
              className={`${buttonContainerBg} p-4 rounded-lg border ${buttonContainerBorder} hover:scale-105 transition-transform flex items-center space-x-3`}
            >
              <ListChecks className="w-6 h-6 text-blue-500" />
              <span className={textColor}>SEC Filings</span>
            </button>
            <button 
              onClick={() => navigate('/earnings')}
              className={`${buttonContainerBg} p-4 rounded-lg border ${buttonContainerBorder} hover:scale-105 transition-transform flex items-center space-x-3`}
            >
              <TrendingUp className="w-6 h-6 text-blue-500" />
              <span className={textColor}>Earnings Monitor</span>
            </button>
          </div>
        </div> */}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Watchlist */}
          <WatchlistSection
            watchlist={watchlist}
            isLoading={loadingWatchlist}
            loadingProgress={watchlistProgress || 0}
            loadingStage={watchlistStage || (loadingWatchlist ? 'Loading watchlist...' : '')}
            error={watchlistError}
            hasMore={hasMoreWatchlist && watchlist.length >= 10} // Enable infinite scroll when we have 10+ items
            onLoadMore={handleLoadMoreWatchlist}
            onAddTicker={() => setIsAddTickerModalOpen(true)}
            onRemoveTicker={(symbol: string, name: string) => {
              setTickerToRemove({ symbol, name });
              setShowConfirmDialog(true);
            }}
            onRefresh={() => {
              resetPagination();
              fetchInfiniteWatchlist(true);
            }}
            refreshingData={refreshingData}
            rateLimitActive={rateLimitActive}
            isAddingTicker={isAddingTicker}
            watchlistLimit={watchlistLimit}
          />

          {/* Recent Activity */}
          <RecentActivitySection
            activities={recentActivity}
            isLoading={activityLoading}
            loadingProgress={activityProgress || 0}
            loadingStage={activityStage || (activityLoading ? 'Loading recent activity...' : '')}
            error={activityError}
            hasMore={hasMoreActivity}
            onLoadMore={handleLoadMoreActivity}
          />

          {/* Upcoming Events / Alpha Vantage Setup */}
          {checkingApiKeys ? (
            // Loading state while checking API keys
            <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} lg:col-span-2 text-center`}>
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
              <p className={`${secondaryTextColor}`}>Checking Alpha Vantage configuration...</p>
            </div>
          ) : !alphaVantageConfigured ? (
            // Alpha Vantage setup card when not configured
            <div className="lg:col-span-2">
              <AlphaVantageSetupCard theme={theme} />
            </div>
          ) : (
            // Normal upcoming events when Alpha Vantage is configured
            <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} lg:col-span-2 h-[32rem] sm:h-96 lg:h-[30rem]`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
                  <Clock className="w-5 h-5 mr-2 text-blue-500" />
                  Upcoming Events
                </h2>
              </div>
              <div className="h-[26rem] sm:h-72 lg:h-[24rem] overflow-y-auto">
                <UpcomingEventsSection
                  events={upcomingEvents}
                  isLoading={eventsLoading}
                  error={eventsError}
                  hasMore={hasMoreEvents && upcomingEvents.length >= 10} // Enable infinite scroll when we have 10+ events
                  onLoadMore={handleLoadMoreEvents}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <AddTickerModal
        isOpen={isAddTickerModalOpen}
        onClose={() => setIsAddTickerModalOpen(false)}
        onAdd={handleAddTicker}
        isAdding={isAddingTicker}
      />

      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false);
          setTickerToRemove(null);
        }}
        onConfirm={() => {
          if (tickerToRemove) {
            handleRemoveTicker(tickerToRemove.symbol);
          }
          setShowConfirmDialog(false);
        }}
        title="Remove from Watchlist"
        message={`Are you sure you want to remove ${tickerToRemove?.symbol} (${tickerToRemove?.name}) from your watchlist?`}
        confirmText="Remove"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isRemovingTicker}
      />

      <TierLimitDialog
        isOpen={tierLimitDialog.isOpen}
        onClose={closeTierLimitDialog}
        featureName={tierLimitDialog.featureName}
        message={tierLimitDialog.message}
        upgradeMessage={tierLimitDialog.upgradeMessage}
        currentTier={tierInfo?.tier || 'Free'}
        context={tierLimitDialog.context || 'watchlist'}
      />
    </div>
  );
};

export default UserHome;