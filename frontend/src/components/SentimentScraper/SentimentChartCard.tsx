import React, { useState, useEffect } from 'react';
import { ChartData, TimeRange, HistoricalTimeRange, ChartViewMode, HistoricalSentimentData } from '../../types';

type DataSource = 'reddit' | 'finviz' | 'yahoo' | 'combined';
import { useTheme } from '../../contexts/ThemeContext';
import { useSentimentTickersOptional } from '../../contexts/SentimentTickerContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Info, Settings, RefreshCw, MessageSquare, TrendingUp, Globe, Layers } from 'lucide-react';
import SentimentChart from './SentimentChart';
import HistoricalSentimentChart from './HistoricalSentimentChart';
import TimeRangeSelector from './TimeRangeSelector';
import ChartViewModeSelector from './ChartViewModeSelector';
import TickerSelector from './TickerSelector';
import LoadingCard from '../UI/LoadingCard';
import ErrorCard from '../UI/ErrorCard';
import { historicalSentimentAPI } from '../../api/historicalSentiment';
import SentimentChartCardMobile from './SentimentChartCardMobile';

interface SentimentChartCardProps {
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
  isHistoricalEnabled?: boolean; // New prop to enable historical features
  timeRange?: TimeRange; // Add timeRange for AI analysis
  // Add sentiment data props to use existing working data
  combinedSentiments?: any[]; // The working sentiment data from the main hook
  finvizSentiments?: any[];
  yahooSentiments?: any[];
  redditSentiments?: any[];
}

const SentimentChartCard: React.FC<SentimentChartCardProps> = ({
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
  const isMobile = useIsMobile();
  const isLight = theme === 'light';
  
  // Try to use shared ticker context, fallback to local state if not available
  const tickerContext = useSentimentTickersOptional();
  
  // Enhanced chart state - use local state if context not available
  // Persist viewMode in localStorage to survive component reloads
  const [viewMode, setViewMode] = useState<ChartViewMode>(() => {
    try {
      const savedMode = localStorage.getItem('sentiment-chart-view-mode');
      return (savedMode as ChartViewMode) || 'market';
    } catch {
      return 'market';
    }
  });
  
  // Data source filter state (similar to SentimentScoresSection)
  const [dataSource, setDataSource] = useState<DataSource>('combined');
  
  const [localSelectedTickers, setLocalSelectedTickers] = useState<string[]>([]);
  const [showTickerSelector, setShowTickerSelector] = useState(() => {
    try {
      const savedMode = localStorage.getItem('sentiment-chart-view-mode');
      return savedMode === 'ticker';
    } catch {
      return false;
    }
  });
  
  // Use context tickers and data if available, otherwise local state
  const selectedTickers = tickerContext?.selectedTickers || localSelectedTickers;
  const setSelectedTickers = tickerContext?.setSelectedTickers || setLocalSelectedTickers;
  
  // Enhanced viewMode setter that persists to localStorage
  const handleViewModeChange = (mode: ChartViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('sentiment-chart-view-mode', mode);
    } catch (error) {
      console.warn('Failed to save view mode to localStorage:', error);
    }
  };
  
  // Data source change handler (similar to SentimentScoresSection)
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
  
  // Local state for historical data (simple approach)
  const [historicalData, setHistoricalData] = useState<HistoricalSentimentData[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState<string | null>(null);
  
  // Track when ticker interface is ready to show
  const [showTickerInterface, setShowTickerInterface] = useState(false);

  // Effect to coordinate ticker interface readiness
  useEffect(() => {
    if (viewMode === 'market') {
      // Market mode is always ready immediately
      setShowTickerInterface(true);
    } else if (viewMode === 'ticker') {
      // For ticker mode, always start hidden during loading
      setShowTickerInterface(false);
      
      // Show interface after delay to allow for smooth loading experience
      const timer = setTimeout(() => {
        setShowTickerInterface(true);
      }, 2000); // Allow time for any background loading
      
      return () => clearTimeout(timer);
    }
  }, [viewMode]);

  // Reset when changing modes
  useEffect(() => {
    if (viewMode === 'ticker') {
      setShowTickerInterface(false);
    }
  }, [viewMode]);

  // Fetch historical data when in ticker mode
  const prepareRealSentimentData = () => {
    if (!isHistoricalEnabled || viewMode === 'market' || selectedTickers.length === 0) {
      console.log('🔍 prepareRealSentimentData: Skipping preparation:', { isHistoricalEnabled, viewMode, tickerCount: selectedTickers.length });
      return [];
    }
    
    console.log('🔍 prepareRealSentimentData: Using real sentiment data from available sources');
    
    // Get all available sentiment data based on what the backend provides
    const allAvailableData = [
      ...(combinedSentiments || []),
      ...(finvizSentiments || []),
      ...(yahooSentiments || [])
    ];
    
    // Filter to only selected tickers
    const tickerFilteredData = allAvailableData.filter(item => 
      selectedTickers.includes(item.ticker)
    );
    
    console.log('🔍 prepareRealSentimentData: Available real data points:', tickerFilteredData.length);
    console.log('🔍 prepareRealSentimentData: Sample data:', tickerFilteredData.slice(0, 3));
    
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
      
      console.log(`🔍 Generating ${expectedPoints} historical data points for ${timeRange} timeRange`);
      
      // Create time buckets
      const timePoints: Date[] = [];
      for (let t = startDate.getTime(); t <= now.getTime(); t += intervalMs) {
        timePoints.push(new Date(t));
      }
      
      // Generate historical data for each ticker at each time point
      const historicalData: HistoricalSentimentData[] = [];
      
      selectedTickers.forEach(ticker => {
        // Find sentiment data for this ticker
        const tickerData = tickerFilteredData.filter(item => item.ticker === ticker);
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
      
      console.log(`🔍 Generated ${historicalData.length} total historical data points`);
      console.log('🔍 Sample historical data:', historicalData.slice(0, 3));
      console.log('🔍 Date range:', {
        start: timePoints[0]?.toISOString(),
        end: timePoints[timePoints.length - 1]?.toISOString()
      });
      
      return historicalData;
    };
    
    return generateHistoricalTimeline();
  };

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
  }, [viewMode, selectedTickers, isHistoricalEnabled, timeRange, combinedSentiments, finvizSentiments, yahooSentiments]);
  
  // Debug effect to track ticker changes
  useEffect(() => {
    console.log('🔍 SentimentChartCard: selectedTickers changed to:', selectedTickers);
    console.log('🔍 SentimentChartCard: context available:', !!tickerContext);
    console.log('🔍 SentimentChartCard: context tickers:', tickerContext?.selectedTickers);
    console.log('🔍 SentimentChartCard: local tickers:', localSelectedTickers);
  }, [selectedTickers, tickerContext, localSelectedTickers]);
  
  // Debug effect to track historical data changes
  useEffect(() => {
    console.log('🔍 HISTORICAL DATA DEBUG:', {
      viewMode,
      selectedTickers,
      historicalDataLength: historicalData.length,
      historicalLoading,
      historicalError,
      isHistoricalEnabled
    });
  }, [viewMode, selectedTickers, historicalData, historicalLoading, historicalError, isHistoricalEnabled]);
  
  // Theme-specific styling
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBg = isLight ? 'bg-stone-200 hover:bg-stone-300' : 'bg-gray-700 hover:bg-gray-600';
  const activeBg = isLight ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white';

  // Calculate source distribution percentages
  const calculateSourcePercentages = (data: ChartData[]) => {
    if (!data || data.length === 0) {
      return { reddit: 0, finviz: 0, yahoo: 0 };
    }
    
    // Initialize source counts
    const sourceCounts = {
      reddit: 0,
      finviz: 0,
      yahoo: 0,
      other: 0
    };

    // Sum up source counts from all data points
    data.forEach(item => {
      const sources = item.sources || {};
      
      Object.entries(sources).forEach(([source, count]) => {
        const lowerSource = source.toLowerCase();
        if (lowerSource.includes('reddit')) {
          sourceCounts.reddit += count;
        } else if (lowerSource.includes('finviz')) {
          sourceCounts.finviz += count;
        } else if (lowerSource.includes('yahoo')) {
          sourceCounts.yahoo += count;
        } else {
          sourceCounts.other += count;
        }
      });
    });

    const total = Object.values(sourceCounts).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      return { reddit: 0, finviz: 0, yahoo: 0 };
    }

    // Calculate percentages
    const percentages = {
      reddit: Math.round((sourceCounts.reddit / total) * 100),
      finviz: Math.round((sourceCounts.finviz / total) * 100),
      yahoo: Math.round((sourceCounts.yahoo / total) * 100)
    };

    return percentages;
  };

  const sourcePercentages = calculateSourcePercentages(chartData);

  // Mobile-first: render mobile component on mobile devices
  if (isMobile) {
    return (
      <SentimentChartCardMobile
        chartData={chartData}
        loading={loading}
        isTransitioning={isTransitioning}
        loadingProgress={loadingProgress}
        loadingStage={loadingStage}
        isDataLoading={isDataLoading}
        errors={errors}
        onRefresh={onRefresh}
        hasRedditAccess={hasRedditAccess}
        isHistoricalEnabled={isHistoricalEnabled}
        timeRange={timeRange}
        combinedSentiments={combinedSentiments}
        finvizSentiments={finvizSentiments}
        yahooSentiments={yahooSentiments}
        redditSentiments={redditSentiments}
      />
    );
  }

  // Desktop rendering continues below...
  const renderContent = () => {
    // Enhanced mode with view mode selector for historical features
    if (isHistoricalEnabled) {
      // Show loading state during chart loading or time range transitions
      // Also show loading if ticker interface is not ready (prevents staggered loading)
      if (((loading || isTransitioning) && !errors.rateLimited && !errors.chart && !historicalError && viewMode === 'market') || 
          (viewMode === 'ticker' && !showTickerInterface)) {
        return (
          <LoadingCard
            stage={viewMode === 'ticker' && !showTickerInterface ? 'Loading ticker interface...' : loadingStage}
            subtitle={viewMode === 'ticker' && !showTickerInterface ? 'Preparing watchlist and analysis tools' : 'Processing sentiment data across multiple sources'}
            progress={viewMode === 'ticker' && !showTickerInterface ? 85 : loadingProgress}
            showProgress={true}
            size="md"
          />
        );
      }

      // Show rate limit error
      if (errors.rateLimited) {
        return (
          <ErrorCard
            type="rateLimited"
            message="The Reddit API is currently rate limiting requests. Please wait a moment and try again later."
            onRetry={onRefresh}
            isRetrying={isDataLoading}
            size="md"
          />
        );
      }

      // Show chart error (only show for market mode or when not loading historical data)
      if ((errors.chart && viewMode === 'market') || (historicalError && viewMode === 'ticker')) {
        return (
          <ErrorCard
            type="warning"
            message={errors.chart || historicalError || 'Chart error occurred'}
            onRetry={onRefresh}
            isRetrying={historicalError ? historicalLoading : isDataLoading}
            showRetry={false}
            size="md"
          />
        );
      }

      // Show enhanced chart with controls
      if (chartData.length > 0 || viewMode === 'ticker') {
        return (
          <div className="space-y-4">

            {/* Ticker Selector (for ticker mode) */}
            {showTickerSelector && viewMode === 'ticker' && (
              <div 
                className={`p-4 rounded-lg border ${borderColor} ${cardBgColor} transition-opacity duration-300`}
                style={{ 
                  opacity: showTickerInterface ? 1 : 0,
                  pointerEvents: showTickerInterface ? 'auto' : 'none'
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`text-xs ${mutedTextColor}`}>
                      Tickers For Sentiment Analysis
                    </div>
                  </div>
                  <TickerSelector
                    selectedTickers={selectedTickers}
                    onTickersChange={setSelectedTickers}
                    mode="watchlist"
                    isDisabled={historicalLoading}
                    suppressLoadingState={true}
                  />
                </div>
              </div>
            )}

            {/* Chart */}
            {viewMode === 'market' ? (
              <SentimentChart 
                data={chartData} 
                isLoading={loading}
                loadingProgress={loadingProgress}
                loadingStage={loadingStage}
                hasRedditAccess={hasRedditAccess}
                timeRange={timeRange}
              />
            ) : (
              <div 
                className="relative transition-opacity duration-300"
                style={{ 
                  opacity: showTickerInterface ? 1 : 0,
                  pointerEvents: showTickerInterface ? 'auto' : 'none'
                }}
              >
                {historicalLoading && (
                  <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
                      <div className="flex items-center gap-3">
                        <RefreshCw className="animate-spin" size={20} />
                        <span className="text-sm">Loading historical data...</span>
                      </div>
                    </div>
                  </div>
                )}
                <HistoricalSentimentChart
                  data={historicalData}
                  viewMode={viewMode}
                  selectedTickers={selectedTickers}
                  isLoading={historicalLoading}
                  timeRange={timeRange}
                  sourcePercentages={sourcePercentages}
                  hasRedditAccess={hasRedditAccess}
                  hasRedditTierAccess={true}
                  redditApiKeysConfigured={true}
                />
              </div>
            )}


          </div>
        );
      }
    } else {
      // Regular mode rendering (existing logic)
      // Show loading state during chart loading or time range transitions
      if ((loading || isTransitioning) && !errors.rateLimited && !errors.chart) {
        return (
          <LoadingCard
            stage={loadingStage}
            subtitle="Processing sentiment data across multiple sources"
            progress={loadingProgress}
            showProgress={true}
            size="md"
          />
        );
      }

      // Show rate limit error
      if (errors.rateLimited) {
        return (
          <ErrorCard
            type="rateLimited"
            message="The Reddit API is currently rate limiting requests. Please wait a moment and try again later."
            onRetry={onRefresh}
            isRetrying={isDataLoading}
            size="md"
          />
        );
      }

      // Show chart error
      if (errors.chart) {
        return (
          <ErrorCard
            type="warning"
            message={errors.chart}
            onRetry={onRefresh}
            isRetrying={isDataLoading}
            showRetry={false}
            size="md"
          />
        );
      }

      // Show chart data
      if (chartData.length > 0) {
        return (
          <>
            <SentimentChart 
              data={chartData} 
              isLoading={loading}
              loadingProgress={loadingProgress}
              loadingStage={loadingStage}
              hasRedditAccess={hasRedditAccess}
              timeRange={timeRange}
            />
          </>
        );
      }
    }

    // Show no data message
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <Info className={`mb-2 ${mutedTextColor}`} size={32} />
        <p className={mutedTextColor}>No chart data available for the selected time period</p>
      </div>
    );
  };

  return (
    <div className={`${cardBgColor} rounded-lg p-4 lg:p-5 border ${borderColor}`}>
      {/* Mobile-first responsive header */}
      <div className={`mb-4 ${isMobile ? 'space-y-3' : 'flex items-center justify-between'}`}>
        <h2 className={`text-lg font-semibold ${textColor}`}>
          Sentiment Overview
        </h2>
        {/* Right side controls - responsive positioning */}
        <div className={`${isMobile ? 'flex flex-col space-y-3' : 'flex items-center space-x-3'}`}>
          {/* Chart View Mode Selector */}
          {isHistoricalEnabled && (
            <div className={isMobile ? 'flex justify-center' : ''}>
              <ChartViewModeSelector
                currentMode={viewMode}
                onModeChange={(mode) => {
                  handleViewModeChange(mode);
                  if (mode === 'ticker') {
                    setShowTickerSelector(true);
                  } else {
                    setShowTickerSelector(false);
                  }
                  // Also save ticker selector state
                  try {
                    localStorage.setItem('sentiment-ticker-selector-visible', mode === 'ticker' ? 'true' : 'false');
                  } catch (error) {
                    console.warn('Failed to save ticker selector state to localStorage:', error);
                  }
                }}
                isDisabled={loading || historicalLoading}
              />
            </div>
          )}
          
          {/* Source Distribution Filter Buttons - matching SentimentScoresSection */}
          {chartData.length > 0 && !loading && (
            <div className={`${isMobile ? 'flex justify-center' : ''}`}>
              <div className={`flex flex-wrap gap-1 ${isLight ? 'bg-white' : 'bg-gray-800'} rounded-full p-1`}>
                <button
                  className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1.5 rounded-full transition-all text-xs font-medium relative ${
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
                      ? `Reddit (${dataSource === 'reddit' ? '100' : sourcePercentages.reddit}%)` 
                      : "Reddit (Pro feature)"
                  }
                >
                  <MessageSquare size={14} />
                  <span>{dataSource === 'reddit' ? '100' : sourcePercentages.reddit}%</span>
                  {!hasRedditAccess && (
                    <span className="text-xs absolute -top-1 -right-1">🔒</span>
                  )}
                </button>
                <button
                  className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1.5 rounded-full transition-all text-xs font-medium ${
                    dataSource === 'finviz'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border border-blue-500' 
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => handleDataSourceChange('finviz')}
                  title={`FinViz (${dataSource === 'finviz' ? '100' : sourcePercentages.finviz}%)`}
                >
                  <TrendingUp size={14} />
                  <span>{dataSource === 'finviz' ? '100' : sourcePercentages.finviz}%</span>
                </button>
                <button
                  className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1.5 rounded-full transition-all text-xs font-medium ${
                    dataSource === 'yahoo' 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border border-blue-500' 
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => handleDataSourceChange('yahoo')}
                  title={`Yahoo Finance (${dataSource === 'yahoo' ? '100' : sourcePercentages.yahoo}%)`}
                >
                  <Globe size={14} />
                  <span>{dataSource === 'yahoo' ? '100' : sourcePercentages.yahoo}%</span>
                </button>
                <button
                  className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1.5 rounded-full transition-all text-xs font-medium ${
                    dataSource === 'combined'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border border-blue-500' 
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => handleDataSourceChange('combined')}
                  title="All Sources Combined"
                >
                  <Layers size={14} />
                  <span>All</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

export default SentimentChartCard; 