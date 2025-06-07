import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { X, Plus, Search, Star, StarOff, Loader2 } from 'lucide-react';
import axios from 'axios';

interface WatchlistTicker {
  id: string;
  symbol: string;
  company_name: string;
  isFromWatchlist: true;
}

interface SearchedTicker {
  symbol: string;
  name?: string;
  isFromWatchlist: false;
}

type TickerItem = WatchlistTicker | SearchedTicker;

interface TickerSelectorProps {
  selectedTickers: string[];
  onTickersChange: (tickers: string[]) => void;
  className?: string;
  isDisabled?: boolean;
  mode?: 'watchlist' | 'manual'; // New prop to determine behavior
}

const TickerSelector: React.FC<TickerSelectorProps> = ({
  selectedTickers,
  onTickersChange,
  className = '',
  isDisabled = false,
  mode = 'watchlist' // Default to watchlist mode
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isLight = theme === 'light';
  const [inputValue, setInputValue] = useState('');
  const [watchlistTickers, setWatchlistTickers] = useState<WatchlistTicker[]>([]);
  const [searchedTickers, setSearchedTickers] = useState<SearchedTicker[]>([]);
  const [isLoadingWatchlist, setIsLoadingWatchlist] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  
  // Track if we've initially loaded and auto-selected watchlist tickers
  const hasAutoSelectedWatchlist = useRef(false);
  const isInitialLoad = useRef(true);
  
  // Theme-specific styling
  const inputBg = isLight ? 'bg-stone-200' : 'bg-gray-700';
  const inputBorder = isLight ? 'border-stone-300' : 'border-gray-600';
  const inputText = isLight ? 'text-stone-800' : 'text-white';
  const watchlistTagBg = isLight ? 'bg-blue-100' : 'bg-blue-900';
  const watchlistTagText = isLight ? 'text-blue-800' : 'text-blue-200';
  const watchlistTagBorder = isLight ? 'border-blue-200' : 'border-blue-700';
  const searchedTagBg = isLight ? 'bg-green-100' : 'bg-green-900';
  const searchedTagText = isLight ? 'text-green-800' : 'text-green-200';
  const searchedTagBorder = isLight ? 'border-green-200' : 'border-green-700';

  // Popular tickers for suggestions
  const popularTickers = [
    'AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'NFLX',
    'AMD', 'INTC', 'BABA', 'UBER', 'SPOT', 'COIN', 'GME', 'AMC'
  ];

  // Load user's watchlist on component mount
  const loadWatchlist = useCallback(async () => {
    if (mode !== 'watchlist' || !user?.token) return;
    
    // Prevent rapid-fire requests by adding a small delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
    
    setIsLoadingWatchlist(true);
    setWatchlistError(null);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.get(`${apiUrl}/api/watchlist`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });

      // Handle different response structures
      let watchlistData = [];
      if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data)) {
          watchlistData = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          watchlistData = response.data.data;
        } else if (response.data.data && response.data.data.stocks && Array.isArray(response.data.data.stocks)) {
          watchlistData = response.data.data.stocks;
        } else if (response.data.stocks && Array.isArray(response.data.stocks)) {
          watchlistData = response.data.stocks;
        }
      }

      const tickers: WatchlistTicker[] = watchlistData.map((item: any) => ({
        id: item.id,
        symbol: item.symbol,
        company_name: item.company_name,
        isFromWatchlist: true as const
      }));

      console.log('📊 Watchlist loaded:', tickers.length, 'tickers:', tickers.map(t => t.symbol));
      setWatchlistTickers(tickers);
      
    } catch (error) {
      console.error('Error loading watchlist:', error);
      // Handle rate limit errors gracefully
      if (error instanceof Error && 'response' in error && (error as any).response?.status === 429) {
        setWatchlistError('Rate limit reached. Please wait a moment and try again.');
      } else {
        setWatchlistError('Failed to load watchlist');
      }
    } finally {
      setIsLoadingWatchlist(false);
    }
  }, [mode, user?.token]);

  // Separate effect for auto-selection after watchlist is loaded
  useEffect(() => {
    if (mode === 'watchlist' && 
        watchlistTickers.length > 0 && 
        selectedTickers.length === 0 && 
        isInitialLoad.current &&
        !hasAutoSelectedWatchlist.current) {
      
      const watchlistSymbols = watchlistTickers.map(t => t.symbol);
      console.log('🔄 Auto-selecting watchlist tickers:', watchlistSymbols);
      
      hasAutoSelectedWatchlist.current = true;
      isInitialLoad.current = false;
      onTickersChange(watchlistSymbols);
    }
  }, [watchlistTickers, selectedTickers, mode, onTickersChange]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  const handleAddTicker = (ticker: string) => {
    const upperTicker = ticker.toUpperCase().trim();
    
    if (upperTicker && 
        !selectedTickers.includes(upperTicker) && 
        /^[A-Z]{1,5}$/.test(upperTicker)) {
      
      // Add to searched tickers if not in watchlist
      const isInWatchlist = watchlistTickers.some(w => w.symbol === upperTicker);
      if (!isInWatchlist) {
        const newSearchedTicker: SearchedTicker = {
          symbol: upperTicker,
          isFromWatchlist: false
        };
        setSearchedTickers(prev => [...prev, newSearchedTicker]);
      }
      
      onTickersChange([...selectedTickers, upperTicker]);
      setInputValue('');
    }
  };

  const handleRemoveTicker = (ticker: string) => {
    const newSelectedTickers = selectedTickers.filter(t => t !== ticker);
    onTickersChange(newSelectedTickers);
    
    // Remove from searched tickers if it's not a watchlist ticker
    const isInWatchlist = watchlistTickers.some(w => w.symbol === ticker);
    if (!isInWatchlist) {
      setSearchedTickers(prev => prev.filter(t => t.symbol !== ticker));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTicker(inputValue);
    }
  };

  const getSuggestions = () => {
    if (!inputValue) return popularTickers.slice(0, 6);
    
    return popularTickers.filter(ticker => 
      ticker.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedTickers.includes(ticker)
    ).slice(0, 6);
  };

  const getAllTickers = (): TickerItem[] => {
    return [...watchlistTickers, ...searchedTickers];
  };

  if (mode === 'watchlist' && isLoadingWatchlist) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className={`text-sm ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
          Loading your watchlist...
        </span>
      </div>
    );
  }

  if (mode === 'watchlist' && watchlistError) {
    return (
      <div className={`p-4 border border-red-300 rounded-lg bg-red-50 ${className}`}>
        <span className="text-sm text-red-600">{watchlistError}</span>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Mode indicator and stats */}
      {mode === 'watchlist' && (
        <div className={`text-xs ${isLight ? 'text-stone-500' : 'text-gray-400'} mb-2`}>
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-3 w-3" />
            <span>
              {watchlistTickers.length} watchlist {watchlistTickers.length === 1 ? 'ticker' : 'tickers'} loaded
              {searchedTickers.length > 0 && `, ${searchedTickers.length} additional searched`}
            </span>
          </div>
        </div>
      )}

      {/* Selected Tickers */}
      {selectedTickers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {getAllTickers()
            .filter(ticker => selectedTickers.includes(ticker.symbol))
            .map(ticker => {
              const isWatchlist = ticker.isFromWatchlist;
              const tagBg = isWatchlist ? watchlistTagBg : searchedTagBg;
              const tagText = isWatchlist ? watchlistTagText : searchedTagText;
              const tagBorder = isWatchlist ? watchlistTagBorder : searchedTagBorder;
              
              return (
                <div
                  key={ticker.symbol}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md border ${tagBg} ${tagText} ${tagBorder}`}
                >
                  {isWatchlist ? (
                    <Star className="h-3 w-3 fill-current" />
                  ) : (
                    <Search className="h-3 w-3" />
                  )}
                  <span className="text-sm font-medium">{ticker.symbol}</span>
                  <button
                    onClick={() => handleRemoveTicker(ticker.symbol)}
                    disabled={isDisabled}
                    className={`p-0.5 rounded hover:bg-opacity-50 ${
                      isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {/* Add Ticker Input */}
      <div className="space-y-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className={`h-4 w-4 ${isLight ? 'text-stone-400' : 'text-gray-400'}`} />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isDisabled}
            placeholder={mode === 'watchlist' ? "Search for additional tickers (e.g., AAPL)" : "Enter ticker symbol (e.g., AAPL)"}
            className={`w-full pl-10 pr-10 py-2 rounded-lg border ${inputBorder} ${inputBg} ${inputText} placeholder-gray-400 text-sm ${
              isDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
          {inputValue && (
            <button
              onClick={() => handleAddTicker(inputValue)}
              disabled={isDisabled}
              className={`absolute inset-y-0 right-0 pr-3 flex items-center ${
                isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <Plus className={`h-4 w-4 ${isLight ? 'text-blue-500' : 'text-blue-400'}`} />
            </button>
          )}
        </div>

        {/* Suggestions */}

      </div>

      {/* Legend */}
      {mode === 'watchlist' && (watchlistTickers.length > 0 || searchedTickers.length > 0) && (
        <div className={`text-xs ${isLight ? 'text-stone-500' : 'text-gray-400'} flex items-center gap-4`}>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-blue-500 fill-current" />
            <span>Watchlist tickers</span>
          </div>
          <div className="flex items-center gap-1">
            <Search className="h-3 w-3 text-green-500" />
            <span>Searched tickers</span>
          </div>
        </div>
      )}

      {/* Current status */}
      <div className={`text-xs ${isLight ? 'text-stone-500' : 'text-gray-400'}`}>
        {selectedTickers.length} {selectedTickers.length === 1 ? 'ticker' : 'tickers'} selected
        {mode === 'watchlist' && watchlistTickers.length === 0 && (
          <span className="ml-2 text-yellow-500">
            (Add stocks to your watchlist for automatic loading)
          </span>
        )}
      </div>
    </div>
  );
};

export default TickerSelector; 