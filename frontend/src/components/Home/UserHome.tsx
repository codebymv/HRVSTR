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
  Loader2
} from 'lucide-react';
import AddTickerModal from '../Watchlist/AddTickerModal';
import { formatEventRelativeTime, getRelativeTimeBadgeStyle } from '../../utils/timeUtils';

interface WatchlistItem {
  id: string;
  symbol: string;
  company_name: string;
  last_price: number | null;
  price_change: number | null;
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
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';

  // Add icon filter for theme switching
  const iconFilter = isLight ? 'invert(1) brightness(0)' : 'none';

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
      
      // Update cache
      dataCache.current.watchlist = {
        data: response.data,
        timestamp: Date.now()
      };
      
      setWatchlist(response.data);
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
      
      // Update cache
      dataCache.current.activity = {
        data: response.data,
        timestamp: Date.now()
      };
      
      setRecentActivity(response.data);
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
      
      // Update cache
      dataCache.current.events = {
        data: response.data,
        timestamp: Date.now()
      };
      
      setUpcomingEvents(response.data);
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

  // Helper function to format date/time (basic example)
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
      dataCache.current.events.timestamp = 0;
      await fetchWatchlist(true);
      await fetchUpcomingEvents(true);

    } catch (error) {
      console.error('Error adding ticker:', error);
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
      dataCache.current.events.timestamp = 0;
      fetchWatchlist(true);
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
                <svg 
                  className="w-5 h-5 text-yellow-400" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            </div>
          </div>
          
          <h1 className={`text-2xl font-bold ${textColor} pr-16`}>
            Welcome back, <br className="block sm:hidden" />
            <span className="block sm:inline bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
              {user?.name}!
            </span>
          </h1>
          <p className={`${secondaryTextColor} mt-2`}>
            Membership: <span className="font-semibold text-yellow-400">Tier 1 HRVSTR!</span>
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
          <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor}`}>
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
            <div className="space-y-4">
              {loadingWatchlist && <p className={secondaryTextColor}>Loading watchlist...</p>}
              {watchlistError && <p className="text-red-500">Error: {watchlistError}</p>}
              {!loadingWatchlist && !watchlistError && watchlist.length === 0 && (
                <p className={secondaryTextColor}>Your watchlist is empty.</p>
              )}
              {!loadingWatchlist && !watchlistError && watchlist.length > 0 && (
                watchlist.map((item) => (
                  <div key={item.symbol} className={`flex justify-between items-center py-2 border-b ${borderColor}`}>
                    <div>
                      <div className={`text-lg font-semibold ${textColor}`}>{item.symbol}</div>
                      <div className={`text-sm ${secondaryTextColor}`}>{item.company_name}</div>
                    </div>
                    {/* Placeholder for price info - currently shows N/A */}
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${textColor}`}>
                        {item.last_price !== null && typeof item.last_price === 'number' && !isNaN(item.last_price) 
                          ? item.last_price.toFixed(2) 
                          : 'N/A'}
                      </div>
                      <div className={`text-sm ${typeof item.price_change === 'number' && item.price_change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {item.price_change !== null && typeof item.price_change === 'number' && !isNaN(item.price_change) 
                          ? item.price_change.toFixed(2) 
                          : 'N/A'}
                      </div>
                    </div>
                    <button
                      className="ml-4 px-2 py-1 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition-colors"
                      onClick={() => handleRemoveTicker(item.symbol)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className={`${cardBgColor} rounded-lg p-6 border ${borderColor}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${textColor} flex items-center`}>
                <Activity className="w-5 h-5 mr-2 text-blue-500" />
                Recent Activity
              </h2>
            </div>
            <div className="space-y-4">
              {loadingActivity && <p className={secondaryTextColor}>Loading recent activity...</p>}
              {activityError && <p className="text-red-500">Error: {activityError}</p>}
              {!loadingActivity && !activityError && recentActivity.length === 0 && (
                <p className={secondaryTextColor}>No recent activity.</p>
              )}
              {!loadingActivity && !activityError && recentActivity.length > 0 && (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${textColor}`}>{activity.title}</p>
                      <p className={`text-sm ${secondaryTextColor}`}>{formatTime(activity.created_at)}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-blue-500" />
                  </div>
                ))
              )}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {loadingEvents && <p className={secondaryTextColor}>Loading upcoming events...</p>}
              {eventsError && <p className="text-red-500">Error: {eventsError}</p>}
              {!loadingEvents && !eventsError && upcomingEvents.length === 0 && (
                <p className={secondaryTextColor}>No upcoming events.</p>
              )}
              {!loadingEvents && !eventsError && upcomingEvents.length > 0 && (
                upcomingEvents.map((event) => (
                  <div 
                    key={event.id} 
                    className={`p-4 rounded-lg border ${borderColor} ${cardBgColor} hover:scale-105 transition-transform`}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      {getEventIcon(event.event_type)}
                      <div>
                        <span className={`font-medium ${textColor}`}>{event.symbol}</span>
                        <span className={`text-sm ${secondaryTextColor} ml-2`}>
                          {capitalizeFirstLetter(event.event_type)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className={`text-sm ${secondaryTextColor}`}>
                        {formatDate(event.scheduled_at)}
                      </p>
                      <p className={`text-xs ${secondaryTextColor} mt-1`}>
                        {formatTime(event.scheduled_at)}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center">
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
                              {event.status}
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <AddTickerModal
        isOpen={isAddTickerModalOpen}
        onClose={() => setIsAddTickerModalOpen(false)}
        onAdd={handleAddTicker}
      />
    </div>
  );
};

export default UserHome;