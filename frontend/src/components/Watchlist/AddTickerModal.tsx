import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useTierLimits } from '../../hooks/useTierLimits';
import { useLimitToasts } from '../../utils/limitToasts';
import { useTier } from '../../contexts/TierContext';

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  marketOpen: string;
  marketClose: string;
  timezone: string;
  currency: string;
  matchScore: string;
}

interface SearchUsage {
  current: number;
  limit: number | null;
  unlimited: boolean;
}

interface AddTickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (symbol: string) => void;
  isAdding?: boolean;
}

const AddTickerModal: React.FC<AddTickerModalProps> = ({ isOpen, onClose, onAdd, isAdding = false }) => {
  const { user } = useAuth();
  const { showTierLimitDialog } = useTierLimits();
  const { showSearchLimitReached } = useLimitToasts();
  const { tierInfo } = useTier();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchUsage, setSearchUsage] = useState<SearchUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch search usage when modal opens
  const fetchSearchUsage = async () => {
    if (!user?.token) return;
    
    setLoadingUsage(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.get(`${apiUrl}/api/stocks/search-usage`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      
      if (response.data.success) {
        setSearchUsage(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching search usage:', err);
    } finally {
      setLoadingUsage(false);
    }
  };

  // Fetch usage when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSearchUsage();
    }
  }, [isOpen, user?.token]);

  // Handle click outside modal to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        setError('Authentication required. Please log in and try again.');
        return;
      }
      
      const response = await axios.get(`${apiUrl}/api/search/stocks`, {
        params: {
          query: searchTerm.trim()
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data && Array.isArray(response.data.bestMatches)) {
        setSearchResults(response.data.bestMatches);
        // Refresh usage after successful search
        fetchSearchUsage();
      } else {
        setSearchResults([]);
        setError(`Unexpected response format for "${searchTerm}". Please try again or contact support if this persists.`);
      }
    } catch (err: any) {
      console.error('Error searching stocks:', err);
      
      // Check for tier limit error (status 402) - Use new toast system
      if (err.response?.status === 402 && err.response?.data?.error === 'tier_limit') {
        console.log('Tier limit reached for search, showing limit toast');
        const usage = err.response.data.usage;
        const currentTier = tierInfo?.tier || 'free';
        
        // Use new toast system for search limits
        showSearchLimitReached(usage?.current, usage?.limit, currentTier);
        onClose(); // Close the search modal
        return; // Don't set error message, the toast handles it
      }
      
      if (err.response?.status === 429) {
        setError('Alpha Vantage rate limit reached. Please wait a minute and try again.');
      } else if (err.response?.status === 502) {
        setError(`Alpha Vantage service error. The stock data provider is having issues. Please try again in a few moments.`);
      } else if (err.response?.status === 503) {
        setError(`Search service temporarily unavailable. Alpha Vantage may be down. Please try again later.`);
      } else if (err.response?.status === 504) {
        setError(`Search request timed out. Alpha Vantage is responding slowly. Please try again.`);
      } else if (err.response?.status === 500) {
        setError(`Server error while searching for "${searchTerm}". This ticker may not be available or there's a temporary issue. Please try a different ticker.`);
      } else if (err.response?.status === 404) {
        setError(`Ticker "${searchTerm}" not found. Please check the symbol and try again.`);
      } else {
        setError(`Error searching for "${searchTerm}". Please check your connection and try again.`);
      }
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = (symbol: string) => {
    onAdd(symbol);
    setSearchTerm('');
    setSearchResults([]);
    setHasSearched(false);
    setError(null);
    onClose();
  };

  const handleClose = () => {
    setSearchTerm('');
    setSearchResults([]);
    setHasSearched(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add to Watchlist</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for a stock symbol (e.g., AAPL, MSFT)..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchTerm.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
          
          {/* Search Usage Display */}
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {loadingUsage ? (
              <span className="flex items-center">
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                Loading usage...
              </span>
            ) : searchUsage ? (
              searchUsage.unlimited ? (
                <span className="flex items-center text-green-600 dark:text-green-400">
                  🔥 <span className="ml-1 font-medium">Unlimited searches</span>
                </span>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span>
                      Searches used: <span className={`font-medium ${searchUsage.current >= (searchUsage.limit || 0) ? 'text-red-500' : searchUsage.current >= (searchUsage.limit || 0) * 0.8 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {searchUsage.current}/{searchUsage.limit}
                      </span> today
                    </span>
                    {searchUsage.current >= (searchUsage.limit || 0) && (
                      <span className="text-xs text-red-500 font-medium">LIMIT REACHED</span>
                    )}
                  </div>
                  {/* Progress bar for free tier */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        searchUsage.current >= (searchUsage.limit || 0) 
                          ? 'bg-red-500' 
                          : searchUsage.current >= (searchUsage.limit || 0) * 0.8 
                            ? 'bg-yellow-500' 
                            : 'bg-blue-500'
                      }`}
                      style={{ 
                        width: `${Math.min(100, (searchUsage.current / (searchUsage.limit || 1)) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              )
            ) : (
              <span>Enter a ticker symbol above to get started</span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
          </div>
        )}

        {isSearching ? (
          <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span>Searching for "{searchTerm}"...</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {searchResults.length > 0 ? (
              searchResults.map((result) => (
                <div
                  key={result.symbol}
                  className={`flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 ${
                    isAdding ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                  }`}
                  onClick={() => !isAdding && handleAdd(result.symbol)}
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{result.symbol}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{result.name}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdd(result.symbol);
                    }}
                    disabled={isAdding}
                    className={`px-3 py-1 ${
                      isAdding ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
                    } text-white rounded flex items-center space-x-1`}
                  >
                    {isAdding ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <span>Add</span>
                    )}
                  </button>
                </div>
              ))
            ) : hasSearched && !error ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <div className="text-lg mb-2">No results found</div>
                <div className="text-sm">Try searching for a different ticker symbol</div>
              </div>
            ) : !hasSearched ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <div className="text-lg mb-2">Search for stocks</div>
                {/* <div className="text-sm">
                  {searchUsage && !searchUsage.unlimited ? (
                    `${searchUsage.current}/${searchUsage.limit} searches used today`
                  ) : searchUsage?.unlimited ? (
                    'Unlimited searches available'
                  ) : (
                    'Enter a ticker symbol above to get started'
                  )}
                </div> */}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddTickerModal;