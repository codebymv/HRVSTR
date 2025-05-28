import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

interface AddTickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (symbol: string) => void;
}

const AddTickerModal: React.FC<AddTickerModalProps> = ({ isOpen, onClose, onAdd }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const response = await axios.get(`/api/stocks/search?query=${encodeURIComponent(searchTerm)}`, {
        headers: {
          Authorization: `Bearer ${user?.token}`
        }
      });
      setSearchResults(response.data);
    } catch (err) {
      setError('Error searching for stocks. Please try again.');
      console.error('Error searching stocks:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = (symbol: string) => {
    onAdd(symbol);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add to Watchlist</h2>
          <button
            onClick={onClose}
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
              placeholder="Search for a stock symbol..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <button
              onClick={handleSearch}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-red-500 text-sm">{error}</div>
        )}

        {isSearching ? (
          <div className="text-center text-gray-500 dark:text-gray-400">Searching...</div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {searchResults.map((result) => (
              <div
                key={result.symbol}
                className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                onClick={() => handleAdd(result.symbol)}
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
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddTickerModal; 