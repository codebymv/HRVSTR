import React, { useState, useEffect } from 'react';
import { ChartData, TimeRange, HistoricalTimeRange, ChartViewMode, HistoricalSentimentData } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { useSentimentTickersOptional } from '../../contexts/SentimentTickerContext';
import { Info, Settings, RefreshCw, MessageSquare, TrendingUp, Globe } from 'lucide-react';
import SentimentChart from './SentimentChart';
import HistoricalSentimentChart from './HistoricalSentimentChart';
import ChartViewModeSelector from './ChartViewModeSelector';
import TickerSelector from './TickerSelector';
import LoadingCard from '../UI/LoadingCard';
import ErrorCard from '../UI/ErrorCard';

interface SentimentChartCardMobileProps {
  chartData: ChartData[];
  loading: boolean;
  isTransitioning: boolean;
  loadingProgress: number;
  loadingStage: string;
  isDataLoading: boolean;
  errors: {
    chart: string | null;
    rateLimited: boolean;
  };
  onRefresh: () => void;
  hasRedditAccess?: boolean;
  isHistoricalEnabled?: boolean;
  combinedSentiments?: any[];
  finvizSentiments?: any[];
  yahooSentiments?: any[];
}

const SentimentChartCardMobile: React.FC<SentimentChartCardMobileProps> = ({
  chartData,
  loading,
  isTransitioning,
  loadingProgress,
  loadingStage,
  isDataLoading,
  errors,
  onRefresh,
  hasRedditAccess = true,
  isHistoricalEnabled = true,
  combinedSentiments,
  finvizSentiments,
  yahooSentiments
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Try to use shared ticker context, fallback to local state if not available
  const tickerContext = useSentimentTickersOptional();
  
  // Mobile-optimized state management
  const [viewMode, setViewMode] = useState<ChartViewMode>(() => {
    try {
      const savedMode = localStorage.getItem('sentiment-chart-view-mode');
      return (savedMode as ChartViewMode) || 'market';
    } catch {
      return 'market';
    }
  });
  
  const [localSelectedTickers, setLocalSelectedTickers] = useState<string[]>([]);
  const [showTickerSelector, setShowTickerSelector] = useState(false);
  
  // Use context tickers and data if available, otherwise local state
  const selectedTickers = tickerContext?.selectedTickers || localSelectedTickers;
  const setSelectedTickers = tickerContext?.setSelectedTickers || setLocalSelectedTickers;
  
  // Theme-specific styles
  const cardBgColor = isLight ? 'bg-stone-50' : 'bg-gray-800';
  const borderColor = isLight ? 'border-stone-200' : 'border-gray-700';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  
  // Mobile-specific compact layout
  return (
    <div className={`${cardBgColor} rounded-lg p-3 border ${borderColor}`}>
      {/* Compact Mobile Header */}
      <div className="mb-3 space-y-2">
        <h2 className={`text-base font-semibold ${textColor} text-center`}>
          Sentiment Overview
        </h2>
        
        {/* Compact Chart Mode Selector */}
        {isHistoricalEnabled && (
          <div className="flex justify-center">
            <ChartViewModeSelector
              currentMode={viewMode}
              onModeChange={(mode) => {
                setViewMode(mode);
                setShowTickerSelector(mode === 'ticker');
                try {
                  localStorage.setItem('sentiment-chart-view-mode', mode);
                  localStorage.setItem('sentiment-ticker-selector-visible', mode === 'ticker' ? 'true' : 'false');
                } catch (error) {
                  console.warn('Failed to save view mode to localStorage:', error);
                }
              }}
              isDisabled={loading}
            />
          </div>
        )}
      </div>

      {/* Mobile-optimized Ticker Selector */}
      {showTickerSelector && viewMode === 'ticker' && (
        <div className={`mb-3 p-3 rounded-lg border ${borderColor} ${cardBgColor}`}>
          <div className="space-y-2">
            <div className={`text-xs ${mutedTextColor} text-center`}>
              Tickers For Analysis
            </div>
            <TickerSelector
              selectedTickers={selectedTickers}
              onTickersChange={setSelectedTickers}
              mode="watchlist"
              isDisabled={loading}
              suppressLoadingState={true}
            />
          </div>
        </div>
      )}

      {/* Mobile Chart Container */}
      <div className="min-h-[250px]">
        {viewMode === 'market' ? (
          <SentimentChart 
            data={chartData} 
            isLoading={loading}
            loadingProgress={loadingProgress}
            loadingStage={loadingStage}
            hasRedditAccess={hasRedditAccess}
          />
        ) : (
          <div className="space-y-3">
            <HistoricalSentimentChart
              data={[]} // Simplified for mobile
              viewMode={viewMode}
              selectedTickers={selectedTickers}
              isLoading={loading}
            />
            
            {/* Compact Mobile Source Badges */}
            {selectedTickers.length > 0 && !loading && (
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <span className={`flex items-center space-x-1 rounded-full px-2 py-1 ${
                  hasRedditAccess 
                    ? 'bg-stone-100 dark:bg-gray-700' 
                    : 'bg-gray-200 dark:bg-gray-800 opacity-50'
                }`}>
                  <MessageSquare size={10} className={hasRedditAccess ? "text-orange-500" : "text-gray-400"} />
                  <span className={hasRedditAccess ? "" : "text-gray-400"}>Reddit</span>
                  {!hasRedditAccess && <span className="text-xs">🔒</span>}
                </span>
                <span className="flex items-center space-x-1 bg-stone-100 dark:bg-gray-700 rounded-full px-2 py-1">
                  <TrendingUp size={10} className="text-amber-500" />
                  <span>FinViz</span>
                </span>
                <span className="flex items-center space-x-1 bg-stone-100 dark:bg-gray-700 rounded-full px-2 py-1">
                  <Globe size={10} className="text-blue-500" />
                  <span>Yahoo</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Data Summary */}
      {viewMode === 'ticker' && selectedTickers.length > 0 && (
        <div className={`text-xs ${mutedTextColor} text-center mt-2`}>
          {loading ? (
            'Loading...'
          ) : (
            `Analysis for ${selectedTickers.length} ticker${selectedTickers.length > 1 ? 's' : ''}`
          )}
        </div>
      )}
    </div>
  );
};

export default SentimentChartCardMobile; 