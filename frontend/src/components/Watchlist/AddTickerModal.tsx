import React, { useState } from 'react';
import { X, Search, Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useTierLimits } from '../../hooks/useTierLimits';

interface AddTickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (symbol: string) => void;
  isAdding?: boolean;
}

const AddTickerModal: React.FC<AddTickerModalProps> = ({ isOpen, onClose, onAdd, isAdding = false }) => {
  const { user } = useAuth();
  const { showTierLimitDialog } = useTierLimits();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    setSearchResults([]);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const timestamp = Date.now();
      const response = await axios.get(`${apiUrl}/api/stocks/search?query=${encodeURIComponent(searchTerm)}&_t=${timestamp}`, {
        headers: {
          Authorization: `Bearer ${user?.token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      // Debug logging
      console.log('Search API response:', {
        status: response.status,
        data: response.data,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        length: Array.isArray(response.data) ? response.data.length : 'N/A'
      });
      
      // Additional detailed logging
      if (Array.isArray(response.data) && response.data.length > 0) {
        console.log('First search result:', response.data[0]);
        console.log('All search results:', response.data);
      }
      
      if (response.status === 304) {
        setError(`Search results for "${searchTerm}" are cached. Please try again or search for a different ticker.`);
        setSearchResults([]);
      } else if (response.data && Array.isArray(response.data)) {
        setSearchResults(response.data);
        if (response.data.length === 0) {
          setError(`No results found for "${searchTerm}". This could be due to:
• The ticker symbol doesn't exist
• Alpha Vantage API issues - try again in a moment
• API rate limits - wait a few seconds and retry`);
        }
      } else {
        setSearchResults([]);
        setError(`Unexpected response format for "${searchTerm}". Please try again or contact support if this persists.`);
      }
    } catch (err: any) {
      console.error('Error searching stocks:', err);
      
      // Check for tier limit error (status 402)
      if (err.response?.status === 402 && err.response?.data?.error === 'tier_limit') {
        console.log('Tier limit reached for search, showing tier limit dialog');
        showTierLimitDialog(
          'Stock Search',
          'You\'ve reached the daily search limit for the free tier.',
          'Upgrade to Pro for unlimited stock searches and real-time data.'
        );
        onClose(); // Close the search modal
        return; // Don't set error message, let the tier dialog handle it
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
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
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
                <div className="text-sm">Enter a ticker symbol above to get started</div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddTickerModal; 