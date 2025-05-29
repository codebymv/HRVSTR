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
  Building
} from 'lucide-react';
import AddTickerModal from '../Watchlist/AddTickerModal';
import { formatEventRelativeTime, getRelativeTimeBadgeStyle } from '../../utils/timeUtils';
import { useTier } from '../../contexts/TierContext';

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
  
  // State for watchlist data, loading, and error
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

  // State for recent activity data, loading, and error
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  // State for upcoming events data, loading, and error
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [isAddTickerModalOpen, setIsAddTickerModalOpen] = useState(false);
  const [refreshingData, setRefreshingData] = useState(false);
  const [rateLimitActive, setRateLimitActive] = useState(false);
  const [isAddingTicker, setIsAddingTicker] = useState(false);

  // Add refs to track if requests are in progress to prevent duplicate calls
  const fetchingWatchlist = useRef(false);
  const fetchingActivity = useRef(false);
  const fetchingEvents = useRef(false);

  // Add cache with timestamps to prevent unnecessary requests
  const dataCache = useRef({
    watchlist: { data: null as WatchlistItem[] | null, timestamp: 0 },
    activity: { data: null as ActivityItem[] | null, timestamp: 0 },
    events: { data: null as EventItem[] | null, timestamp: 0 }
  });

  // Cache duration in milliseconds (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000;

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
  const bgColor = isLight ? 'bg-stone-200' : 'bg-gray-950';
  const textColor = isLight ? 'text-stone-700' : 'text-white';
  const welcomeTextColor = isLight ? 'text-stone-600' : 'text-white';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';
  const membershipTextColor = isLight ? 'text-amber-600' : 'text-amber-400';

  // Add icon filter for theme switching
  const iconFilter = isLight ? 'invert(1) brightness(0)' : 'none';

  // Helper function to get user tier information with icon and color
  const getUserTierInfo = () => {
    // Use TierContext tierInfo instead of hardcoded user data
    const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
    
    const tierData = {
      free: {
        name: 'HRVSTR Free',
        icon: <Star className="w-4 h-4" />,
        iconColor: 'text-gray-400',
        textColor: 'text-gray-400'
      },
      pro: {
        name: 'HRVSTR Pro',
        icon: <Crown className="w-4 h-4" />,
        iconColor: 'text-blue-500',
        textColor: 'text-blue-400'
      },
      elite: {
        name: 'HRVSTR Elite',
        icon: <Zap className="w-4 h-4" />,
        iconColor: 'text-purple-500',
        textColor: 'text-purple-400'
      },
      institutional: {
        name: 'HRVSTR Institutional',
        icon: <Building className="w-4 h-4" />,
        iconColor: 'text-green-500',
        textColor: 'text-green-400'
      }
    };

    return tierData[currentTier as keyof typeof tierData] || tierData.free;
  };

  // Fetch watchlist data from the backend with rate limiting protection
  const fetchWatchlist = useCallback(async (forceRefresh = false) => {
    if (!user?.token) {
      setWatchlistError('User not authenticated');
      setLoadingWatchlist(false);
      return;
    }

    // Check if request is already in progress
    if (fetchingWatchlist.current) {
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh && dataCache.current.watchlist.data && isCacheValid(dataCache.current.watchlist.timestamp)) {
      setWatchlist(dataCache.current.watchlist.data);
      setLoadingWatchlist(false);
      return;
    }

    fetchingWatchlist.current = true;
    setLoadingWatchlist(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.get(`${apiUrl}/api/watchlist`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      
      // Defensive programming: ensure we have an array
      let watchlistData = response.data;
      
      // Log the response for debugging in production
      console.log('Watchlist API response:', { 
        status: response.status,
        data: response.data,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data)
      });
      
      // Handle different response structures
      if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data)) {
          watchlistData = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          // Handle wrapped response like { data: [...] }
          watchlistData = response.data.data;
        } else if (response.data.data && response.data.data.stocks && Array.isArray(response.data.data.stocks)) {
          // Handle new tier-aware response like { data: { stocks: [...], limits: {...} } }
          watchlistData = response.data.data.stocks;
          // Store tier limits if available for future use
          if (response.data.data.limits) {
            sessionStorage.setItem('watchlist_limits', JSON.stringify(response.data.data.limits));
          }
        } else if (response.data.stocks && Array.isArray(response.data.stocks)) {
          // Handle direct stocks response like { stocks: [...], limits: {...} }
          watchlistData = response.data.stocks;
          if (response.data.limits) {
            sessionStorage.setItem('watchlist_limits', JSON.stringify(response.data.limits));
          }
        } else if (response.data.watchlist && Array.isArray(response.data.watchlist)) {
          // Handle response like { watchlist: [...] }
          watchlistData = response.data.watchlist;
        } else {
          // Fallback: if it's an object but not an array, create empty array
          console.warn('Unexpected watchlist response structure:', response.data);
          watchlistData = [];
        }
      } else {
        // If response.data is null, undefined, or not an object, use empty array
        watchlistData = [];
      }
      
      // Ensure it's definitely an array
      if (!Array.isArray(watchlistData)) {
        console.error('Failed to convert watchlist response to array, using empty array');
        watchlistData = [];
      }
      
      // Update cache
      dataCache.current.watchlist = {
        data: watchlistData,
        timestamp: Date.now()
      };
      
      setWatchlist(watchlistData);
      setWatchlistError(null);
    } catch (error: any) {
      console.error('Error fetching watchlist:', error);
      if (error.response?.status === 429) {
        setWatchlistError('Rate limit exceeded. Data will retry automatically in a moment.');
        setRateLimitActive(true);
        // Auto-retry after 3 seconds for rate limit errors
        setTimeout(() => {
          if (user?.token) {
            setRateLimitActive(false);
            fetchWatchlist(true);
          }
        }, 3000);
      } else {
        setWatchlistError('Failed to fetch watchlist');
      }
      // Ensure watchlist is set to empty array on error
      setWatchlist([]);
    } finally {
      setLoadingWatchlist(false);
      fetchingWatchlist.current = false;
    }
  }, [user?.token]);

  // Fetch recent activity data with rate limiting protection
  const fetchRecentActivity = useCallback(async (forceRefresh = false) => {
    if (!user?.token) {
      setActivityError('User not authenticated');
      setLoadingActivity(false);
      return;
    }

    // Check if request is already in progress
    if (fetchingActivity.current) {
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh && dataCache.current.activity.data && isCacheValid(dataCache.current.activity.timestamp)) {
      setRecentActivity(dataCache.current.activity.data);
      setLoadingActivity(false);
      return;
    }

    fetchingActivity.current = true;
    setLoadingActivity(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.get(`${apiUrl}/api/activity`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      
      // Defensive programming: ensure we have an array
      let activityData = response.data;
      
      // Log the response for debugging in production
      console.log('Activity API response:', { 
        status: response.status,
        data: response.data,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data)
      });
      
      // Handle different response structures
      if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data)) {
          activityData = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          // Handle wrapped response like { data: [...] }
          activityData = response.data.data;
        } else if (response.data.activity && Array.isArray(response.data.activity)) {
          // Handle response like { activity: [...] }
          activityData = response.data.activity;
        } else {
          // Fallback: if it's an object but not an array, create empty array
          console.warn('Unexpected activity response structure:', response.data);
          activityData = [];
        }
      } else {
        // If response.data is null, undefined, or not an object, use empty array
        activityData = [];
      }
      
      // Ensure it's definitely an array
      if (!Array.isArray(activityData)) {
        console.error('Failed to convert activity response to array, using empty array');
        activityData = [];
      }
      
      // Update cache
      dataCache.current.activity = {
        data: activityData,
        timestamp: Date.now()
      };
      
      setRecentActivity(activityData);
      setActivityError(null);
    } catch (error: any) {
      console.error('Error fetching recent activity:', error);
      if (error.response?.status === 429) {
        setActivityError('Rate limit exceeded. Data will retry automatically in a moment.');
        // Auto-retry after 3 seconds for rate limit errors
        setTimeout(() => {
          if (user?.token) {
            fetchRecentActivity(true);
          }
        }, 3000);
      } else {
        setActivityError('Failed to fetch recent activity');
      }
      // Ensure activity is set to empty array on error
      setRecentActivity([]);
    } finally {
      setLoadingActivity(false);
      fetchingActivity.current = false;
    }
  }, [user?.token]);

  // Fetch upcoming events data with rate limiting protection
  const fetchUpcomingEvents = useCallback(async (forceRefresh = false) => {
    if (!user?.token) {
      setEventsError('User not authenticated');
      setLoadingEvents(false);
      return;
    }

    // Check if request is already in progress
    if (fetchingEvents.current) {
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh && dataCache.current.events.data && isCacheValid(dataCache.current.events.timestamp)) {
      setUpcomingEvents(dataCache.current.events.data);
      setLoadingEvents(false);
      return;
    }

    fetchingEvents.current = true;
    setLoadingEvents(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.get(`${apiUrl}/api/events`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      
      // Defensive programming: ensure we have an array
      let eventsData = response.data;
      
      // Log the response for debugging in production
      console.log('Events API response:', { 
        status: response.status,
        data: response.data,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data)
      });
      
      // Handle different response structures
      if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data)) {
          eventsData = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          // Handle wrapped response like { data: [...] }
          eventsData = response.data.data;
        } else if (response.data.events && Array.isArray(response.data.events)) {
          // Handle response like { events: [...] }
          eventsData = response.data.events;
        } else {
          // Fallback: if it's an object but not an array, create empty array
          console.warn('Unexpected events response structure:', response.data);
          eventsData = [];
        }
      } else {
        // If response.data is null, undefined, or not an object, use empty array
        eventsData = [];
      }
      
      // Ensure it's definitely an array
      if (!Array.isArray(eventsData)) {
        console.error('Failed to convert events response to array, using empty array');
        eventsData = [];
      }
      
      // Update cache
      dataCache.current.events = {
        data: eventsData,
        timestamp: Date.now()
      };
      
      setUpcomingEvents(eventsData);
      setEventsError(null);
    } catch (error: any) {
      console.error('Error fetching upcoming events:', error);
      if (error.response?.status === 429) {
        setEventsError('Rate limit exceeded. Data will retry automatically in a moment.');
        // Auto-retry after 3 seconds for rate limit errors
        setTimeout(() => {
          if (user?.token) {
            fetchUpcomingEvents(true);
          }
        }, 3000);
      } else {
        setEventsError('Failed to fetch upcoming events');
      }
      // Ensure events is set to empty array on error
      setUpcomingEvents([]);
    } finally {
      setLoadingEvents(false);
      fetchingEvents.current = false;
    }
  }, [user?.token]);

  // Single effect to fetch all data when user token is available
  useEffect(() => {
    if (user?.token) {
      // Debounce the initial data fetch to prevent rapid successive calls
      debounce('initialFetch', () => {
        fetchWatchlist();
        fetchRecentActivity();
        fetchUpcomingEvents();
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

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
      await axios.post(`${apiUrl}/api/stocks/watchlist`, { symbol }, {
        headers: {
          Authorization: `Bearer ${user?.token}`
        }
      });
      
      // After adding, trigger a data refresh for the entire watchlist
      // This will fetch events and price data for the new ticker
      await axios.post(`${apiUrl}/api/stocks/refresh-watchlist-data`, {}, {
        headers: {
          Authorization: `Bearer ${user?.token}`
        }
      });

      // Clear cache and force refresh data for frontend display
      dataCache.current.watchlist.timestamp = 0;
      dataCache.current.activity.timestamp = 0;
      dataCache.current.events.timestamp = 0;
      await fetchWatchlist(true);
      await fetchRecentActivity(true);
      await fetchUpcomingEvents(true);

    } catch (error) {
      console.error('Error adding ticker:', error);
    } finally {
      setIsAddingTicker(false);
    }
  };

  const handleRemoveTicker = async (symbol: string) => {
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
      dataCache.current.events.timestamp = 0;
      fetchWatchlist(true);
      fetchRecentActivity(true);
      fetchUpcomingEvents(true);
    } catch (error) {
      console.error('Error removing ticker:', error);
    }
  };

  const handleRefreshData = async () => {
    setRefreshingData(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      // Call backend endpoint to trigger data refresh
      await axios.post(`${apiUrl}/api/stocks/refresh-watchlist-data`, {}, {
        headers: {
          Authorization: `Bearer ${user?.token}`
        }
      });
      
      // Clear all caches and force refresh all data
      dataCache.current.watchlist.timestamp = 0;
      dataCache.current.activity.timestamp = 0;
      dataCache.current.events.timestamp = 0;
      
      await Promise.all([
        fetchWatchlist(true),
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
        {rateLimitActive && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>API rate limit reached. Data will refresh automatically in a moment...</span>
          </div>
        )}
        {/* Welcome Section */}
        <div className={`${cardBgColor} rounded-lg p-6 mb-6 border ${borderColor} relative`}>
          {/* HRVSTR Icon with Gold Star Badge */}
          <div className="absolute top-4 right-4">
            <div className="relative">
              {/* HRVSTR Icon */}
              <img 
                src="/hrvstr_icon.png" 
                alt="HRVSTR" 
                className="w-12 h-12 object-contain"
                style={{ filter: iconFilter }}
              />
              {/* Gold Star Badge */}
              <div className="absolute -top-1 -right-1">
                <div className={`w-5 h-5 flex items-center justify-center ${getUserTierInfo().iconColor}`}>
                  {getUserTierInfo().icon}
                </div>
              </div>
            </div>
          </div>
          
          <h1 className={`text-2xl font-bold ${welcomeTextColor} pr-16`}>
            Welcome back, <br className="block sm:hidden" />
            <span className="block sm:inline bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent ml-4">
              {user?.name}!
            </span>
          </h1>
          <p className={`${secondaryTextColor} mt-2 flex items-center`}>
            Tier: 
            <span className={`font-semibold ml-2 flex items-center`}>
              <span className={getUserTierInfo().textColor}>
                {getUserTierInfo().name}
              </span>
            </span>
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <button 
            onClick={() => navigate('/sentiment')}
            className={`${cardBgColor} p-4 rounded-lg border ${borderColor} hover:scale-105 transition-transform flex items-center space-x-3`}
          >
            <BarChart2 className="w-6 h-6 text-blue-500" />
            <span className={textColor}>Sentiment Analysis</span>
          </button>
          <button 
            onClick={() => navigate('/sec-filings')}
            className={`${cardBgColor} p-4 rounded-lg border ${borderColor} hover:scale-105 transition-transform flex items-center space-x-3`}
          >
            <ListChecks className="w-6 h-6 text-blue-500" />
            <span className={textColor}>SEC Filings</span>
          </button>
          <button 
            onClick={() => navigate('/earnings')}
            className={`${cardBgColor} p-4 rounded-lg border ${borderColor} hover:scale-105 transition-transform flex items-center space-x-3`}
          >
            <TrendingUp className="w-6 h-6 text-blue-500" />
            <span className={textColor}>Earnings Monitor</span>
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Watchlist */}
          <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} h-[32rem] sm:h-96`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
                <Star className="w-5 h-5 mr-2 text-blue-500" />
                Watchlist
              </h2>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setIsAddTickerModalOpen(true)}
                  className={`text-sm ${buttonBgColor} text-white px-3 py-1 rounded`}
                >
                  Add Ticker
                </button>
                <button
                  onClick={handleRefreshData}
                  disabled={refreshingData || rateLimitActive}
                  className={`p-2 rounded-full ${rateLimitActive ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'} text-white ${(refreshingData || rateLimitActive) ? 'opacity-50' : ''}`}
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
            <div className="space-y-4 overflow-y-auto h-[26rem] sm:h-72">
              {loadingWatchlist && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className={`w-6 h-6 animate-spin ${secondaryTextColor}`} />
                  <span className={`ml-2 ${secondaryTextColor}`}>Loading watchlist...</span>
                </div>
              )}
              {watchlistError && <p className="text-red-500">Error: {watchlistError}</p>}
              {!loadingWatchlist && !watchlistError && watchlist.length === 0 && (
                <p className={secondaryTextColor}>Your watchlist is empty.</p>
              )}
              {!loadingWatchlist && !watchlistError && watchlist.length > 0 && (() => {
                try {
                  // Ensure watchlist is definitely an array before mapping
                  const safeWatchlist = Array.isArray(watchlist) ? watchlist : [];
                  return safeWatchlist.map((item) => (
                    <div key={item.symbol || Math.random()} className={`py-3 border-b ${borderColor}`}>
                      {/* Mobile Layout */}
                      <div className="block sm:hidden">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className={`text-lg font-semibold ${textColor}`}>{item.symbol || 'N/A'}</div>
                            <div className={`text-sm ${secondaryTextColor} truncate`}>{item.company_name || 'N/A'}</div>
                          </div>
                          <button
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            onClick={() => handleRemoveTicker(item.symbol)}
                            title="Remove from watchlist"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex items-center">
                          <div className="flex-1 pl-6">
                            <div className={`text-sm ${secondaryTextColor} mb-1`}>Current Price</div>
                            <div className={`text-xl font-bold ${textColor}`}>
                              {formatPrice(item.last_price)}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right pr-4">
                            <div className={`text-sm ${secondaryTextColor} mb-1`}>Change</div>
                            <div className={`text-lg font-medium ${getPriceChangeColor(item.price_change)}`}>
                              {formatPriceChange(item.price_change)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Desktop Layout */}
                      <div className="hidden sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center">
                        {/* Company Info */}
                        <div className="sm:col-span-5">
                          <div className={`text-lg font-semibold ${textColor}`}>{item.symbol || 'N/A'}</div>
                          <div className={`text-sm ${secondaryTextColor} truncate`}>{item.company_name || 'N/A'}</div>
                        </div>
                        
                        {/* Price Info and Remove Button for Desktop */}
                        <div className="sm:col-span-7 sm:grid sm:grid-cols-3 sm:gap-4 sm:items-center">
                          {/* Current Price */}
                          <div className="text-center">
                            <div className={`text-xs ${secondaryTextColor} mb-1`}>Current Price</div>
                            <div className={`text-lg font-semibold ${textColor}`}>
                              {formatPrice(item.last_price)}
                            </div>
                          </div>
                          
                          {/* Change */}
                          <div className="text-center">
                            <div className={`text-xs ${secondaryTextColor} mb-1`}>Change</div>
                            <div className={`text-sm font-medium ${getPriceChangeColor(item.price_change)}`}>
                              {formatPriceChange(item.price_change)}
                            </div>
                          </div>
                          
                          {/* Remove Button */}
                          <div className="flex justify-center">
                            <button
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              onClick={() => handleRemoveTicker(item.symbol)}
                              title="Remove from watchlist"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ));
                } catch (error) {
                  console.error('Error rendering watchlist:', error);
                  return <p className="text-red-500">Error displaying watchlist data</p>;
                }
              })()}
            </div>
          </div>

          {/* Recent Activity */}
          <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} h-96`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
                <Activity className="w-5 h-5 mr-2 text-blue-500" />
                Recent Activity
              </h2>
            </div>
            <div className="space-y-4 overflow-y-auto h-72">
              {loadingActivity && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className={`w-6 h-6 animate-spin ${secondaryTextColor}`} />
                  <span className={`ml-2 ${secondaryTextColor}`}>Loading recent activity...</span>
                </div>
              )}
              {activityError && <p className="text-red-500">Error: {activityError}</p>}
              {!loadingActivity && !activityError && recentActivity.length === 0 && (
                <p className={secondaryTextColor}>No recent activity.</p>
              )}
              {!loadingActivity && !activityError && recentActivity.length > 0 && (() => {
                try {
                  // Ensure recentActivity is definitely an array before mapping
                  const safeActivity = Array.isArray(recentActivity) ? recentActivity : [];
                  return safeActivity.map((activity) => (
                    <div key={activity.id || Math.random()} className="flex items-center">
                      <div>
                        <p className={`font-medium ${textColor}`}>{activity.title || 'No title'}</p>
                        <p className={`text-sm ${secondaryTextColor}`}>{formatActivityTime(activity.created_at)}</p>
                      </div>
                    </div>
                  ));
                } catch (error) {
                  console.error('Error rendering recent activity:', error);
                  return <p className="text-red-500">Error displaying activity data</p>;
                }
              })()}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor} lg:col-span-2`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
                <Clock className="w-5 h-5 mr-2 text-blue-500" />
                Upcoming Events
              </h2>
            </div>
            <div className="space-y-4">
              {loadingEvents && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className={`w-6 h-6 animate-spin ${secondaryTextColor}`} />
                  <span className={`ml-2 ${secondaryTextColor}`}>Loading upcoming events...</span>
                </div>
              )}
              {eventsError && <p className="text-red-500">Error: {eventsError}</p>}
              {!loadingEvents && !eventsError && upcomingEvents.length === 0 && (
                <p className={secondaryTextColor}>No upcoming events.</p>
              )}
              {!loadingEvents && !eventsError && upcomingEvents.length > 0 && (() => {
                try {
                  // Ensure upcomingEvents is definitely an array before mapping
                  const safeEvents = Array.isArray(upcomingEvents) ? upcomingEvents : [];
                  
                  // Group events by symbol
                  const eventsBySymbol = safeEvents.reduce((acc, event) => {
                    const symbol = event.symbol || 'Unknown';
                    if (!acc[symbol]) {
                      acc[symbol] = [];
                    }
                    acc[symbol].push(event);
                    return acc;
                  }, {} as { [key: string]: typeof safeEvents });

                  return Object.entries(eventsBySymbol).map(([symbol, symbolEvents]) => (
                    <div key={symbol} className={`p-4 rounded-lg border ${borderColor} ${cardBgColor}`}>
                      {/* Company Header */}
                      <div className="flex items-center mb-3">
                        <span className={`text-lg font-semibold ${textColor}`}>{symbol}</span>
                        <span className={`text-sm ${secondaryTextColor} ml-2`}>
                          ({symbolEvents.length} event{symbolEvents.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      
                      {/* Events Row */}
                      <div className="flex space-x-4 overflow-x-auto">
                        {symbolEvents.map((event) => (
                          <div 
                            key={event.id || Math.random()} 
                            className={`min-w-64 p-3 rounded-lg border ${borderColor} bg-opacity-50 hover:bg-opacity-70 transition-all flex-shrink-0`}
                          >
                            <div className="flex items-center space-x-2 mb-2">
                              {getEventIcon(event.event_type)}
                              <span className={`text-sm font-medium ${textColor}`}>
                                {capitalizeFirstLetter(event.event_type || 'event')}
                              </span>
                            </div>
                            <div className="mb-2">
                              <p className={`text-sm ${secondaryTextColor}`}>
                                {formatDate(event.scheduled_at)}
                              </p>
                              <p className={`text-xs ${secondaryTextColor}`}>
                                {formatTime(event.scheduled_at)}
                              </p>
                            </div>
                            <div className="flex items-center">
                              {(() => {
                                const relativeTime = formatEventRelativeTime(event.scheduled_at);
                                if (!relativeTime) {
                                  // Fallback to status if no relative time available
                                  return (
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      event.status === 'scheduled' 
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
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
                        ))}
                      </div>
                    </div>
                  ));
                } catch (error) {
                  console.error('Error rendering upcoming events:', error);
                  return <p className="text-red-500">Error displaying events data</p>;
                }
              })()}
            </div>
          </div>
        </div>
      </div>

      <AddTickerModal
        isOpen={isAddTickerModalOpen}
        onClose={() => setIsAddTickerModalOpen(false)}
        onAdd={handleAddTicker}
        isAdding={isAddingTicker}
      />
    </div>
  );
};

export default UserHome;