import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { RefreshCw, Loader2 } from 'lucide-react';

interface SentimentHeaderProps {
  onRefresh: () => void;
  isDataLoading: boolean;
}

const SentimentHeader: React.FC<SentimentHeaderProps> = ({
  onRefresh,
  isDataLoading
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
      <div>
        <h1 className={`text-2xl font-bold ${textColor}`}>Sentiment Scraper</h1>
        <p className={`${mutedTextColor} mt-1`}>Track real-time sentiment across social platforms</p>
      </div>
      
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        <button 
          className={`bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full p-2 transition-colors ${isDataLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={onRefresh}
          disabled={isDataLoading}
          title="Refresh Data"
        >
          {isDataLoading ? (
            <Loader2 size={18} className="text-white animate-spin" />
          ) : (
            <RefreshCw size={18} className="text-white" />
          )}
        </button>
      </div>
    </div>
  );
};

export default SentimentHeader; 