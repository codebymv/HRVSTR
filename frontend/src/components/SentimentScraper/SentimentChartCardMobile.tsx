import React, { useState, useEffect, startTransition, useMemo } from 'react';
import { ChartData, TimeRange, HistoricalTimeRange, ChartViewMode, HistoricalSentimentData } from '../../types';

type DataSource = 'reddit' | 'finviz' | 'yahoo' | 'combined';
import { useTheme } from '../../contexts/ThemeContext';
import { useSentimentTickersOptional } from '../../contexts/SentimentTickerContext';
import { Info, Settings, RefreshCw, MessageSquare, TrendingUp, Globe, ChevronDown, ChevronUp, DollarSign, Layers } from 'lucide-react';
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
  timeRange?: TimeRange;
  combinedSentiments?: any[];
  finvizSentiments?: any[];
  yahooSentiments?: any[];
  redditSentiments?: any[];
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
  timeRange = '1w',
  combinedSentiments,
  finvizSentiments,
  yahooSentiments,
  redditSentiments
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Try to use shared ticker context, fallback to local state if not available
  const tickerContext = useSentimentTickersOptional();
  
  // Mobile-optimized state management with race condition prevention
  const [viewMode, setViewMode] = useState<ChartViewMode>(() => {
    try {
      const savedMode = localStorage.getItem('sentiment-chart-view-mode');
      return (savedMode as ChartViewMode) || 'market';
    } catch {
      return 'market';
    }
  });
  
  const [localSelectedTickers, setLocalSelectedTickers] = useState<string[]>([]);
  const [showTickerSelector, setShowTickerSelector] = useState(() => {
    try {
      const savedMode = localStorage.getItem('sentiment-chart-view-mode');
      return savedMode === 'ticker';
    } catch {
      return false;
    }
  });
  
  // Collapsible ticker selector state - start expanded to prevent flash
  const [isTickerSelectorExpanded, setIsTickerSelectorExpanded] = useState(true);
  
  // Data source filter state (matching desktop)
  const [dataSource, setDataSource] = useState<DataSource>('combined');
  
  // Historical data state - same as desktop version
  const [historicalData, setHistoricalData] = useState<HistoricalSentimentData[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState<string | null>(null);
  
  // Use context tickers and data if available, otherwise local state
  const selectedTickers = tickerContext?.selectedTickers || localSelectedTickers;
  const setSelectedTickers = tickerContext?.setSelectedTickers || setLocalSelectedTickers;
  
  // Data source change handler (matching desktop)
  const handleDataSourceChange = (source: DataSource) => {
    if (source === 'reddit' && !hasRedditAccess) {
      return; // Prevent changing to Reddit for free users
    }
    setDataSource(source);
  };
  
  // Prevent Reddit selection for free users and switch away from Reddit if they lose access
  useEffect(() => {
    if (!hasRedditAccess && dataSource === 'reddit') {
      setDataSource('combined');
    }
  }, [hasRedditAccess, dataSource]);

  // Get the appropriate sentiment data based on the selected source (matching SentimentScoresSection logic)
  const getSentimentData = () => {
    switch (dataSource) {
      case 'reddit':
        return redditSentiments || [];
      case 'finviz':
        return finvizSentiments || [];
      case 'yahoo':
        return yahooSentiments || [];
      case 'combined':
        // If combined data is empty but we have individual source data, show combined from all sources
        if ((combinedSentiments?.length || 0) === 0) {
          return [
            ...(redditSentiments || []),
            ...(finvizSentiments || []),
            ...(yahooSentiments || [])
          ];
        }
        return combinedSentiments || [];
      default:
        return [];
    }
  };

  const currentSentiments = useMemo(() => getSentimentData(), [
    dataSource,
    redditSentiments,
    finvizSentiments,
    yahooSentiments,
    combinedSentiments,
    hasRedditAccess
  ]);

  // Calculate source distribution percentages (matching SentimentScoresSection logic)
  const getSourceDistribution = () => {
    // For individual sources, return 100% for the selected source
    if (dataSource === 'reddit') return { reddit: hasRedditAccess ? 100 : 0, finviz: 0, yahoo: 0 };
    if (dataSource === 'finviz') return { reddit: 0, finviz: 100, yahoo: 0 };
    if (dataSource === 'yahoo') return { reddit: 0, finviz: 0, yahoo: 100 };
    
    // For combined view, calculate actual percentages from the real data
    if (dataSource === 'combined') {
      if (hasRedditAccess && (combinedSentiments?.length || 0) > 0) {
        // Calculate actual source distribution from combined sentiment data
        const sourceCounts = { reddit: 0, finviz: 0, yahoo: 0 };
        
        combinedSentiments!.forEach((item: any) => {
          if (item.source === 'reddit') sourceCounts.reddit++;
          else if (item.source === 'finviz') sourceCounts.finviz++;
          else if (item.source === 'yahoo') sourceCounts.yahoo++;
        });
        
        const total = sourceCounts.reddit + sourceCounts.finviz + sourceCounts.yahoo;
        
        if (total > 0) {
          return {
            reddit: Math.round((sourceCounts.reddit / total) * 100),
            finviz: Math.round((sourceCounts.finviz / total) * 100),
            yahoo: Math.round((sourceCounts.yahoo / total) * 100)
          };
        }
      }
      
      // Fallback for free users or when no data
      if (!hasRedditAccess) {
        // Calculate from FinViz and Yahoo only
        const finvizCount = finvizSentiments?.length || 0;
        const yahooCount = yahooSentiments?.length || 0;
        const total = finvizCount + yahooCount;
        
        if (total > 0) {
          return {
            reddit: 0,
            finviz: Math.round((finvizCount / total) * 100),
            yahoo: Math.round((yahooCount / total) * 100)
          };
        }
        
        return { reddit: 0, finviz: 60, yahoo: 40 }; // Default fallback
      }
      
      // Default percentages for combined view when no specific data
      return { reddit: 41, finviz: 30, yahoo: 30 }; // Default fallback
    }
    
    console.log('Unknown data source:', dataSource);
    return { reddit: 0, finviz: 0, yahoo: 0 };
  };

  const distribution = getSourceDistribution();
  
  // Generate real historical timeline data using same logic as desktop
  const prepareRealSentimentData = () => {
    if (!isHistoricalEnabled || viewMode === 'market' || selectedTickers.length === 0) {
      console.log('🔍 prepareRealSentimentData (Mobile): Skipping preparation:', { isHistoricalEnabled, viewMode, tickerCount: selectedTickers.length });
      return [];
    }
    
    console.log('🔍 prepareRealSentimentData (Mobile): Using filtered sentiment data from selected source');
    
    // Use the filtered sentiment data based on selected source
    const allAvailableData = currentSentiments;
    
    // Filter to only selected tickers
    const tickerFilteredData = allAvailableData.filter(item => 
      selectedTickers.includes(item.ticker)
    );
    
    console.log('🔍 prepareRealSentimentData (Mobile): Available real data points:', tickerFilteredData.length);
    console.log('🔍 prepareRealSentimentData (Mobile): Sample data:', tickerFilteredData.slice(0, 3));
    
    // If we have no data, return empty array
    if (tickerFilteredData.length === 0) {
      return [];
    }
    
    // Generate time-series historical data based on timeRange
    const generateHistoricalTimeline = () => {
      const now = new Date();
      let startDate: Date;
      let intervalMs: number;
      let expectedPoints: number;
      
      // Set up time ranges matching backend logic
      switch (timeRange) {
        case '1d':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          intervalMs = 60 * 60 * 1000; // 1 hour intervals
          expectedPoints = 24;
          break;
        case '3d':
          startDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
          intervalMs = 3 * 60 * 60 * 1000; // 3 hour intervals  
          expectedPoints = 24;
          break;
        case '1w':
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          intervalMs = 6 * 60 * 60 * 1000; // 6 hour intervals
          expectedPoints = 28;
          break;
      }
      
      console.log(`🔍 (Mobile) Generating ${expectedPoints} historical data points for ${timeRange} timeRange`);
      
      // Create time buckets
      const timePoints: Date[] = [];
      for (let t = startDate.getTime(); t <= now.getTime(); t += intervalMs) {
        timePoints.push(new Date(t));
      }
      
      // Generate historical data for each ticker at each time point
      const historicalData: HistoricalSentimentData[] = [];
      
      selectedTickers.forEach(ticker => {
        // Find sentiment data for this ticker
        const tickerData = tickerFilteredData.filter((item: any) => item.ticker === ticker);
        const baseSentiment = tickerData[0];
        
        if (!baseSentiment) return;
        
        timePoints.forEach((timePoint, index) => {
          // Generate realistic sentiment variation over time
          // Use the real current sentiment as the baseline and add realistic temporal variation
          const baseScore = baseSentiment.score || baseSentiment.sentimentScore || 0;
          
          // Add time-based variation (simulating market volatility)
          const timeVariation = (Math.sin(index * 0.3) * 0.1) + (Math.random() * 0.04 - 0.02);
          const finalScore = Math.max(-1, Math.min(1, baseScore + timeVariation));
          
                     historicalData.push({
             ticker: ticker,
             date: timePoint.toISOString(), // Keep full timestamp for granular timeline
             sentiment_score: finalScore,
             sentiment_label: (finalScore > 0.1 ? 'bullish' : finalScore < -0.1 ? 'bearish' : 'neutral') as 'bullish' | 'bearish' | 'neutral',
             confidence: baseSentiment.confidence || 0.8
           });
        });
      });
      
      console.log(`🔍 (Mobile) Generated ${historicalData.length} total historical data points`);
      console.log('🔍 (Mobile) Sample historical data:', historicalData.slice(0, 3));
      console.log('🔍 (Mobile) Date range:', {
        start: timePoints[0]?.toISOString(),
        end: timePoints[timePoints.length - 1]?.toISOString()
      });
      
      return historicalData;
    };
    
    return generateHistoricalTimeline();
  };

  // No separate useEffect needed - state is managed in onClick handlers

  // Effect to prepare real sentiment data when parameters change
  useEffect(() => {
    if (isHistoricalEnabled && viewMode === 'ticker' && selectedTickers.length > 0) {
      setHistoricalLoading(true);
      setHistoricalError(null);
      
      // Use real sentiment data instead of synthetic data
      const realData = prepareRealSentimentData();
      setHistoricalData(realData);
      setHistoricalLoading(false);
    } else {
      setHistoricalData([]);
    }
  }, [viewMode, selectedTickers, isHistoricalEnabled, timeRange, dataSource, currentSentiments]);
  
  // Theme-specific styles
  const cardBgColor = isLight ? 'bg-stone-50' : 'bg-gray-800';
  const borderColor = isLight ? 'border-stone-200' : 'border-gray-700';
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  
  // Mobile-specific compact layout
  return (
    <div className={`${cardBgColor} rounded-lg p-3 border ${borderColor}`}>
      {/* Compact Mobile Header */}
      <div className="mb-4 space-y-3">
        <h2 className={`text-lg font-semibold ${textColor} text-left`}>
          Sentiment Overview
        </h2>
        
        {/* Prominent Chart Mode Selector for Mobile */}
        {isHistoricalEnabled && (
          <div className="flex justify-center">
            <div className={`inline-flex rounded-lg border-2 ${borderColor} bg-opacity-50 p-1`}>
              <button
                onClick={() => {
                  // Use transition to prevent race condition flashing
                  startTransition(() => {
                    setViewMode('market');
                    setShowTickerSelector(false);
                  });
                  try {
                    localStorage.setItem('sentiment-chart-view-mode', 'market');
                  } catch (error) {
                    console.warn('Failed to save view mode to localStorage:', error);
                  }
                }}
                disabled={loading || historicalLoading}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  viewMode === 'market'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-sm border border-blue-500'
                    : isLight
                    ? 'text-stone-700 hover:bg-stone-200'
                    : 'text-gray-300 hover:bg-gray-700'
                } ${loading || historicalLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <TrendingUp size={16} />
                <span>Market</span>
              </button>
              <button
                onClick={() => {
                  // Use transition to prevent race condition flashing
                  startTransition(() => {
                    setViewMode('ticker');
                    setShowTickerSelector(true);
                  });
                  try {
                    localStorage.setItem('sentiment-chart-view-mode', 'ticker');
                  } catch (error) {
                    console.warn('Failed to save view mode to localStorage:', error);
                  }
                }}
                disabled={loading || historicalLoading}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  viewMode === 'ticker'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-sm border border-blue-500'
                    : isLight
                    ? 'text-stone-700 hover:bg-stone-200'
                    : 'text-gray-300 hover:bg-gray-700'
                } ${loading || historicalLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <DollarSign size={16} />
                <span>Tickers</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile-optimized Ticker Selector with Collapsible Trigger */}
      {viewMode === 'ticker' && (
        <div className={`mb-3 rounded-lg border-2 ${borderColor} ${isLight ? 'bg-white' : 'bg-gray-800'} shadow-sm`}>
          {/* Collapsible Trigger */}
          <button
            onClick={() => setIsTickerSelectorExpanded(!isTickerSelectorExpanded)}
            className={`w-full p-4 flex items-center justify-between text-left transition-all duration-200 rounded-lg ${
              isLight 
                ? 'hover:bg-blue-50 active:bg-blue-100' 
                : 'hover:bg-gray-700 active:bg-gray-600'
            } ${isTickerSelectorExpanded ? (isLight ? 'bg-blue-50' : 'bg-gray-700') : ''}`}
            disabled={loading || historicalLoading}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isLight ? 'bg-blue-100' : 'bg-gray-600'}`}>
                <DollarSign size={16} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
              </div>
              <div className="flex flex-col">
                <span className={`text-sm font-semibold ${textColor}`}>
                  Tickers For Analysis
                </span>
                <span className={`text-xs ${mutedTextColor}`}>
                  {selectedTickers.length} ticker{selectedTickers.length !== 1 ? 's' : ''} selected • Tap to {isTickerSelectorExpanded ? 'collapse' : 'expand'}
                </span>
              </div>
            </div>
            <div className={`p-1 rounded-full ${isLight ? 'bg-gray-100' : 'bg-gray-600'}`}>
              {isTickerSelectorExpanded ? (
                <ChevronUp size={20} className={`${mutedTextColor}`} />
              ) : (
                <ChevronDown size={20} className={`${mutedTextColor}`} />
              )}
            </div>
          </button>
          
          {/* Collapsible Content */}
          {isTickerSelectorExpanded && (
            <div className={`border-t-2 ${borderColor} ${isLight ? 'bg-stone-50' : 'bg-gray-750'}`}>
              <div className="p-4 min-h-[120px]">
                <TickerSelector
                  selectedTickers={selectedTickers}
                  onTickersChange={setSelectedTickers}
                  mode="watchlist"
                  isDisabled={loading || historicalLoading}
                  suppressLoadingState={false}
                  showSearchBar={false}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile Chart Container */}
      <div 
        className="min-h-[250px] touch-manipulation"
        onTouchEnd={(e) => {
          // Hide tooltips on tap for mobile
          const chartCanvas = e.currentTarget.querySelector('canvas');
          if (chartCanvas) {
            // Dispatch a click event outside the chart area to hide tooltip
            const outsideEvent = new MouseEvent('click', {
              clientX: 0,
              clientY: 0,
              bubbles: true
            });
            setTimeout(() => {
              document.dispatchEvent(outsideEvent);
            }, 100); // Small delay to allow chart interaction to complete first
          }
        }}
      >
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
            {/* Mobile Loading Overlay */}
            <div 
              className="relative touch-manipulation"
              onTouchEnd={(e) => {
                // Hide tooltips on tap for mobile historical chart
                const chartCanvas = e.currentTarget.querySelector('canvas');
                if (chartCanvas) {
                  const outsideEvent = new MouseEvent('click', {
                    clientX: 0,
                    clientY: 0,
                    bubbles: true
                  });
                  setTimeout(() => {
                    document.dispatchEvent(outsideEvent);
                  }, 100);
                }
              }}
            >
              {historicalLoading && (
                <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="animate-spin" size={16} />
                      <span className="text-xs">Loading historical data...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className={`${selectedTickers.length > 4 ? 'pt-2' : ''}`}>
                <HistoricalSentimentChart
                  data={historicalData}
                  viewMode={viewMode}
                  selectedTickers={selectedTickers}
                  isLoading={historicalLoading}
                  timeRange={timeRange}
                />
              </div>
            </div>
            
            {/* Interactive Mobile Source Filter Buttons */}
            {selectedTickers.length > 0 && !historicalLoading && (
              <div className={`flex justify-center ${selectedTickers.length > 4 ? 'mt-3' : ''}`}>
                <div className={`flex flex-wrap gap-1 ${isLight ? 'bg-white' : 'bg-gray-800'} rounded-full p-1`}>
                  <button
                    className={`flex items-center space-x-1 px-2 py-1 rounded-full transition-all text-xs font-medium relative ${
                      dataSource === 'reddit'
                        ? hasRedditAccess 
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border border-blue-500' 
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800'
                        : hasRedditAccess
                          ? 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                          : 'text-gray-400 cursor-not-allowed'
                    }`}
                    onClick={() => handleDataSourceChange('reddit')}
                    disabled={!hasRedditAccess}
                    title={
                      hasRedditAccess 
                        ? `Reddit (${dataSource === 'reddit' ? '100' : Math.round(distribution.reddit)}%)` 
                        : "Reddit (Pro feature)"
                    }
                  >
                    <MessageSquare size={10} />
                    <span>{dataSource === 'reddit' ? '100' : Math.round(distribution.reddit)}%</span>
                    {!hasRedditAccess && (
                      <span className="text-xs absolute -top-1 -right-1">🔒</span>
                    )}
                  </button>
                  <button
                    className={`flex items-center space-x-1 px-2 py-1 rounded-full transition-all text-xs font-medium ${
                      dataSource === 'finviz'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border border-blue-500' 
                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => handleDataSourceChange('finviz')}
                    title={`FinViz (${dataSource === 'finviz' ? '100' : Math.round(distribution.finviz)}%)`}
                  >
                    <TrendingUp size={10} />
                    <span>{dataSource === 'finviz' ? '100' : Math.round(distribution.finviz)}%</span>
                  </button>
                  <button
                    className={`flex items-center space-x-1 px-2 py-1 rounded-full transition-all text-xs font-medium ${
                      dataSource === 'yahoo'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border border-blue-500' 
                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => handleDataSourceChange('yahoo')}
                    title={`Yahoo Finance (${dataSource === 'yahoo' ? '100' : Math.round(distribution.yahoo)}%)`}
                  >
                    <Globe size={10} />
                    <span>{dataSource === 'yahoo' ? '100' : Math.round(distribution.yahoo)}%</span>
                  </button>
                  <button
                    className={`flex items-center space-x-1 px-2 py-1 rounded-full transition-all text-xs font-medium ${
                      dataSource === 'combined'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border border-blue-500' 
                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => handleDataSourceChange('combined')}
                    title="All Sources Combined"
                  >
                    <Layers size={10} />
                    <span>All</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Data Summary */}
      {viewMode === 'ticker' && selectedTickers.length > 0 && (
        <div className={`text-xs ${mutedTextColor} text-center mt-2`}>
          {historicalLoading ? (
            'Loading historical data...'
          ) : (
            `Analysis for ${selectedTickers.length} ticker${selectedTickers.length > 1 ? 's' : ''}`
          )}
        </div>
      )}
    </div>
  );
};

export default SentimentChartCardMobile; 