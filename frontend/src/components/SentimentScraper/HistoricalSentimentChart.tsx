import React, { useMemo, useState, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { HistoricalSentimentData, ChartViewMode, ChartData, TimeRange } from '../../types';
import { Line, Bar } from 'react-chartjs-2';
import { Plus, Minus, RotateCcw, MessageSquare, TrendingUp, Globe, Layers } from 'lucide-react';
import ChartAIAnalysisButton from './ChartAIAnalysisButton';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

type DataSource = 'reddit' | 'finviz' | 'yahoo' | 'combined';

interface HistoricalSentimentChartProps {
  data: HistoricalSentimentData[] | ChartData[];
  viewMode: ChartViewMode;
  selectedTickers?: string[];
  isLoading?: boolean;
  showTrendLines?: boolean;
  className?: string;
  timeRange?: TimeRange;
  sourcePercentages?: {
    reddit: number;
    finviz: number;
    yahoo: number;
  };
  hasRedditAccess?: boolean;
  hasRedditTierAccess?: boolean;
  redditApiKeysConfigured?: boolean;
}

// Hook to detect mobile devices
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileUA = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      const isMobileScreen = window.innerWidth <= 768;
      setIsMobile(isMobileUA || isMobileScreen);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
};

const HistoricalSentimentChart: React.FC<HistoricalSentimentChartProps> = ({
  data,
  viewMode,
  selectedTickers = [],
  isLoading = false,
  showTrendLines = true,
  className = '',
  timeRange = '1w',
  sourcePercentages,
  hasRedditAccess = true,
  hasRedditTierAccess,
  redditApiKeysConfigured
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const isMobile = useIsMobile();
  
  // Zoom state - disabled on mobile
  const [zoomLevel, setZoomLevel] = useState(0); // 0 = auto, positive = zoomed in, negative = zoomed out
  
  // Source filter state - default to 'combined' to show all sources
  const [dataSource, setDataSource] = useState<DataSource>('combined');
  
  // Handle data source filtering
  const handleDataSourceChange = (source: DataSource) => {
    if (source === 'reddit' && !hasRedditAccess) {
      return; // Prevent changing to Reddit for free users
    }
    setDataSource(source);
  };
  
  // Get source distribution percentages
  const getSourceDistribution = () => {
    if (!sourcePercentages) {
      return { reddit: 33, finviz: 33, yahoo: 34 }; // Fallback
    }
    
    // For individual sources, return 100% for the selected source
    if (dataSource === 'reddit') return { reddit: hasRedditAccess ? 100 : 0, finviz: 0, yahoo: 0 };
    if (dataSource === 'finviz') return { reddit: 0, finviz: 100, yahoo: 0 };
    if (dataSource === 'yahoo') return { reddit: 0, finviz: 0, yahoo: 100 };
    
    // For combined view, use actual percentages
    return sourcePercentages;
  };
  
  const distribution = getSourceDistribution();

  // Convert sentiment score to percentage for better visualization
  const normalizeScore = (score: number): number => {
    // Assuming sentiment scores are between -1 and 1, convert to 0-100 scale
    return ((score + 1) / 2) * 100;
  };

  // Get color for sentiment score
  const getSentimentColor = (score: number): string => {
    const normalizedScore = normalizeScore(score);
    if (normalizedScore >= 60) return 'rgba(34, 197, 94, 0.8)'; // Green for bullish
    if (normalizedScore >= 40) return 'rgba(234, 179, 8, 0.8)'; // Yellow for neutral
    return 'rgba(239, 68, 68, 0.8)'; // Red for bearish
  };

  // Calculate intelligent Y-axis range based on data and zoom level
  const calculateYAxisRange = useCallback((datasets: any[]) => {
    if (viewMode === 'market') {
      return { min: 0, max: 100 }; // Market view always shows full range
    }

    // Collect all data points
    const allValues: number[] = [];
    datasets.forEach(dataset => {
      dataset.data.forEach((value: any) => {
        if (value !== null && typeof value === 'number') {
          allValues.push(value);
        }
      });
    });

    if (allValues.length === 0) {
      return { min: 0, max: 100 };
    }

    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue;
    const center = (minValue + maxValue) / 2;

    // Base padding (10% of range or minimum 5 points)
    let padding = Math.max(range * 0.1, 5);

    // Apply zoom adjustment
    const zoomFactor = Math.pow(0.7, zoomLevel); // Each zoom level reduces visible range by 30%
    padding *= zoomFactor;

    let adjustedMin = Math.max(0, center - (range / 2 + padding));
    let adjustedMax = Math.min(100, center + (range / 2 + padding));

    // Ensure we don't zoom too much if data hits extremes
    if (minValue <= 5 || maxValue >= 95) {
      adjustedMin = Math.max(0, adjustedMin);
      adjustedMax = Math.min(100, adjustedMax);
      // If we're at extremes, don't zoom in as much
      if (zoomLevel > 0 && (minValue <= 5 || maxValue >= 95)) {
        const extremePadding = Math.max(range * 0.2, 10);
        adjustedMin = Math.max(0, center - (range / 2 + extremePadding * zoomFactor));
        adjustedMax = Math.min(100, center + (range / 2 + extremePadding * zoomFactor));
      }
    }

    // Ensure minimum visible range of 10%
    if (adjustedMax - adjustedMin < 10) {
      const midpoint = (adjustedMin + adjustedMax) / 2;
      adjustedMin = Math.max(0, midpoint - 5);
      adjustedMax = Math.min(100, midpoint + 5);
    }

    return { 
      min: Math.round(adjustedMin), 
      max: Math.round(adjustedMax) 
    };
  }, [viewMode, zoomLevel]);

  // Process data based on view mode and apply source filtering
  const chartData = useMemo(() => {
    console.log('🔍 HISTORICAL CHART DEBUG: Processing data', { 
      dataLength: data?.length || 0, 
      viewMode, 
      selectedTickers,
      dataSource,
      firstDataItem: data?.[0]
    });
    
    if (!data || data.length === 0) {
      console.log('🔍 HISTORICAL CHART DEBUG: No data available');
      return null;
    }

    // Apply source filtering to the data first
    let filteredData: HistoricalSentimentData[] | ChartData[] = data;
    if (dataSource !== 'combined' && data.length > 0 && 'source' in data[0]) {
      filteredData = data.filter((item: any) => {
        if (dataSource === 'reddit' && !hasRedditAccess) return false;
        return item.source === dataSource;
      }) as HistoricalSentimentData[] | ChartData[];
      console.log('🔍 HISTORICAL CHART DEBUG: Filtered data by source', dataSource, 'from', data.length, 'to', filteredData.length);
    }

    if (filteredData.length === 0) {
      console.log('🔍 HISTORICAL CHART DEBUG: No data after filtering');
      return null;
    }

    // Check if data is historical sentiment data or chart data
    const isHistoricalData = 'sentiment_score' in filteredData[0];
    console.log('🔍 HISTORICAL CHART DEBUG: Is historical data:', isHistoricalData);

    if (viewMode === 'market' && !isHistoricalData) {
      // Use existing ChartData for market view (stacked bar chart)
      const chartDataItems = data as ChartData[];
      console.log('🔍 HISTORICAL CHART DEBUG: Processing market view with', chartDataItems.length, 'items');
      const labels = chartDataItems.map(item => {
        if (item.displayDate) return item.displayDate;
        return new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });

      return {
        labels,
        datasets: [
          {
            label: 'Bullish',
            data: chartDataItems.map(d => d.bullish),
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 1,
            stack: 'Stack 0',
          },
          {
            label: 'Neutral',
            data: chartDataItems.map(d => d.neutral),
            backgroundColor: 'rgba(234, 179, 8, 0.8)',
            borderColor: 'rgba(234, 179, 8, 1)',
            borderWidth: 1,
            stack: 'Stack 0',
          },
          {
            label: 'Bearish',
            data: chartDataItems.map(d => d.bearish),
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 1,
            stack: 'Stack 0',
          },
        ],
      };
    }

    if (isHistoricalData) {
      const historicalData = filteredData as HistoricalSentimentData[];
      console.log('🔍 HISTORICAL CHART DEBUG: Processing historical data with', historicalData.length, 'items');
      console.log('🔍 HISTORICAL CHART DEBUG: Raw historical data sample:', historicalData.slice(0, 2));
      
      if (viewMode === 'ticker') {
        // Group data by ticker for line chart
        const tickerGroups = historicalData.reduce((acc, item) => {
          if (!acc[item.ticker]) acc[item.ticker] = [];
          acc[item.ticker].push(item);
          return acc;
        }, {} as Record<string, HistoricalSentimentData[]>);

        console.log('🔍 HISTORICAL CHART DEBUG: Ticker groups:', Object.keys(tickerGroups), tickerGroups);

        // Sort data by date for each ticker
        Object.keys(tickerGroups).forEach(ticker => {
          tickerGroups[ticker].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        });

        // Get all unique timestamps and sort them (preserve full temporal granularity)
        const allTimestamps = [...new Set(historicalData.map(item => item.date))].sort();
        console.log('🔍 HISTORICAL CHART DEBUG: All timestamps:', allTimestamps);
        
        const labels = allTimestamps.map(timestamp => {
          const date = new Date(timestamp);
          // For granular timelines (more than 10 points), show time, otherwise just date
          if (allTimestamps.length > 10) {
            return date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              hour: timeRange === '1d' ? 'numeric' : undefined
            });
          } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }
        });

        // Color palette for different tickers
        const colors = [
          'rgba(59, 130, 246, 0.8)', // Blue
          'rgba(239, 68, 68, 0.8)',  // Red
          'rgba(34, 197, 94, 0.8)',  // Green
          'rgba(168, 85, 247, 0.8)', // Purple
          'rgba(245, 158, 11, 0.8)', // Orange
        ];

        const datasets = Object.keys(tickerGroups).map((ticker, index) => {
          const tickerData = tickerGroups[ticker];
          const dataPoints = allTimestamps.map((timestamp: string) => {
            const item = tickerData.find(d => d.date === timestamp);
            if (item) {
              console.log(`🔍 CHART DEBUG: ${ticker} on ${timestamp} - Raw score: ${item.sentiment_score}, Normalized: ${normalizeScore(item.sentiment_score)}`);
              return normalizeScore(item.sentiment_score);
            }
            return null;
          });

          console.log(`🔍 HISTORICAL CHART DEBUG: Dataset for ${ticker}:`, dataPoints);

          return {
            label: ticker,
            data: dataPoints,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length].replace('0.8', '0.2'),
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 4,
            pointHoverRadius: 6,
          };
        });

        console.log('🔍 HISTORICAL CHART DEBUG: Final chart data:', { labels, datasets });
        return { labels, datasets };
      }
    }

    console.log('🔍 HISTORICAL CHART DEBUG: No matching condition, returning null');
    return null;
  }, [data, viewMode, dataSource, hasRedditAccess]);

  // Calculate Y-axis range based on current data
  const yAxisRange = useMemo(() => {
    if (chartData && chartData.datasets) {
      return calculateYAxisRange(chartData.datasets);
    }
    return { min: 0, max: 100 };
  }, [chartData, zoomLevel, viewMode, calculateYAxisRange]);

  // Chart options
  const options: ChartOptions<'line' | 'bar'> = useMemo(() => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            color: isLight ? '#374151' : '#D1D5DB',
            usePointStyle: true,
            padding: isMobile ? 15 : 20,
            boxWidth: isMobile ? 12 : 16,
            font: {
              size: isMobile ? 11 : 12,
            },
            // Better text wrapping for many tickers
            generateLabels: function(chart: any) {
              const originalLabels = ChartJS.defaults.plugins.legend.labels.generateLabels!(chart);
              return originalLabels.map((label: any) => {
                // Truncate very long ticker names on mobile
                if (isMobile && label.text && label.text.length > 8) {
                  label.text = label.text.substring(0, 6) + '...';
                }
                return label;
              });
            },
          },
          // Add more space between legend and chart
          onClick: function() {
            // Disable legend click to prevent dataset toggling on mobile for better UX
            return !isMobile;
          },
          maxHeight: isMobile ? 80 : 100, // Limit legend height
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(17, 24, 39, 0.95)',
          titleColor: isLight ? '#1F2937' : '#F9FAFB',
          bodyColor: isLight ? '#374151' : '#D1D5DB',
          borderColor: isLight ? '#E5E7EB' : '#374151',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            title: function(context: any) {
              if (viewMode === 'ticker' && context.length > 0) {
                const date = context[0].label;
                return `Sentiment Analysis - ${date}`;
              }
              return context[0]?.label || '';
            },
            label: function(context: any) {
              if (viewMode === 'market') {
                return `${context.dataset.label}: ${context.parsed.y}%`;
              }
              
              // Enhanced ticker tooltip
              const value = context.parsed.y?.toFixed(1);
              const ticker = context.dataset.label;
              let sentiment = 'Neutral';
              let emoji = '😐';
              
              if (context.parsed.y > 60) {
                sentiment = 'Very Bullish';
                emoji = '🚀';
              } else if (context.parsed.y > 55) {
                sentiment = 'Bullish';
                emoji = '📈';
              } else if (context.parsed.y > 45) {
                sentiment = 'Neutral';
                emoji = '😐';
              } else if (context.parsed.y > 40) {
                sentiment = 'Bearish';
                emoji = '📉';
              } else {
                sentiment = 'Very Bearish';
                emoji = '💥';
              }
              
              return `${emoji} ${ticker}: ${value}% (${sentiment})`;
            },
            afterBody: function(context: any) {
              if (viewMode === 'ticker' && context.length > 0) {
                // Calculate portfolio average for this date
                const values = context.map((item: any) => item.parsed.y).filter((v: any) => v !== null);
                if (values.length > 0) {
                  const avg = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;
                  const portfolioSentiment = avg > 55 ? 'Bullish Portfolio' : avg < 45 ? 'Bearish Portfolio' : 'Neutral Portfolio';
                  return [``, `📊 Portfolio Average: ${avg.toFixed(1)}%`, `${portfolioSentiment}`];
                }
              }
              return [];
            }
          }
        },
      },
      scales: {
        x: {
          ticks: {
            color: isLight ? '#6B7280' : '#9CA3AF',
            maxTicksLimit: viewMode === 'ticker' ? 8 : 10,
          },
          grid: {
            color: isLight ? '#E5E7EB' : '#374151',
          },
        },
        y: {
          min: yAxisRange.min,
          max: yAxisRange.max,
          ticks: {
            color: isLight ? '#6B7280' : '#9CA3AF',
            callback: function(value: any) {
              return value + '%';
            },
            stepSize: Math.max(5, Math.round((yAxisRange.max - yAxisRange.min) / 8)),
          },
          grid: {
            color: isLight ? '#E5E7EB' : '#374151',
          },
        },
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
      elements: {
        point: {
          radius: viewMode === 'ticker' ? 3 : 2,
          hoverRadius: viewMode === 'ticker' ? 6 : 4,
          hitRadius: 10,
        },
        line: {
          tension: 0.2,
          borderWidth: viewMode === 'ticker' ? 3 : 2,
        }
      },
      // Enhanced animations for better UX
      animation: {
        duration: 750
      }
    };

    return baseOptions;
  }, [isLight, viewMode, chartData, yAxisRange]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className={`text-sm ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
            Loading historical sentiment data...
          </p>
        </div>
      </div>
    );
  }

  if (!chartData || !data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <p className={`text-sm ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
            No historical sentiment data available
          </p>
          <p className={`text-xs mt-1 ${isLight ? 'text-stone-500' : 'text-gray-500'}`}>
            Try selecting a different time range or ticker
          </p>
        </div>
      </div>
    );
  }

  const ChartComponent = viewMode === 'market' ? Bar : Line;

  return (
    <div className={`relative ${className}`}>
      {/* Zoom Controls - Only show for ticker view on desktop */}
      {!isMobile && viewMode === 'ticker' && chartData && chartData.datasets.length > 0 && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-1 bg-white/10 backdrop-blur-sm rounded-lg p-1">
          <button
            onClick={() => setZoomLevel(prev => Math.min(prev + 1, 5))}
            disabled={zoomLevel >= 5}
            className={`p-2 rounded-md text-xs font-medium transition-colors ${
              isLight
                ? 'bg-white/95 hover:bg-white text-stone-600 border border-stone-200 hover:border-stone-300'
                : 'bg-gray-800/95 hover:bg-gray-800 text-gray-300 border border-gray-600 hover:border-gray-500'
            } ${
              zoomLevel >= 5 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer shadow-sm'
            }`}
            title="Zoom In"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoomLevel(prev => Math.max(prev - 1, -2))}
            disabled={zoomLevel <= -2}
            className={`p-2 rounded-md text-xs font-medium transition-colors ${
              isLight
                ? 'bg-white/95 hover:bg-white text-stone-600 border border-stone-200 hover:border-stone-300'
                : 'bg-gray-800/95 hover:bg-gray-800 text-gray-300 border border-gray-600 hover:border-gray-500'
            } ${
              zoomLevel <= -2 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer shadow-sm'
            }`}
            title="Zoom Out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoomLevel(0)}
            disabled={zoomLevel === 0}
            className={`p-2 rounded-md text-xs font-medium transition-colors ${
              isLight
                ? 'bg-white/95 hover:bg-white text-stone-600 border border-stone-200 hover:border-stone-300'
                : 'bg-gray-800/95 hover:bg-gray-800 text-gray-300 border border-gray-600 hover:border-gray-500'
            } ${
              zoomLevel === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer shadow-sm'
            }`}
            title="Reset Zoom (Auto Scale)"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {/* Chart Container */}
      <div className={`h-64 touch-pan-x touch-pan-y ${selectedTickers.length > 0 ? 'pt-3' : ''}`}>
        <ChartComponent
          key={`${viewMode}-${selectedTickers.join('-')}-${zoomLevel}`}
          data={chartData}
          options={options}
        />
      </div>
      
      {/* Mobile zoom instruction - moved below chart */}
      {isMobile && viewMode === 'ticker' && chartData && chartData.datasets.length > 0 && (
        <div className={`flex items-center justify-center gap-2 mt-2 py-2 px-3 rounded-md text-xs ${
          isLight ? 'bg-stone-100 text-stone-600' : 'bg-gray-700 text-gray-300'
        } border ${isLight ? 'border-stone-200' : 'border-gray-600'}`}>
          <span>📱</span>
          <span>Pinch to zoom and pan around the chart</span>
        </div>
      )}
      
      {/* Range Indicator - Only show for ticker view when zoomed (desktop only) */}
      {!isMobile && viewMode === 'ticker' && zoomLevel !== 0 && (
        <div className={`text-xs text-center mt-1 ${isLight ? 'text-stone-500' : 'text-gray-400'}`}>
          Showing {yAxisRange.min}% - {yAxisRange.max}% 
          {zoomLevel > 0 && ` (Zoomed In +${zoomLevel})`}
          {zoomLevel < 0 && ` (Zoomed Out ${zoomLevel})`}
        </div>
      )}

      {/* Chart Footer Info - Only show for ticker view with selected tickers */}
      {viewMode === 'ticker' && selectedTickers && selectedTickers.length > 0 && data && data.length > 0 && !isLoading && (
        <div className="mt-4 space-y-3">
          {/* Single Row Info */}
          <div className={`flex flex-wrap items-center justify-between gap-3 text-xs ${isLight ? 'text-stone-500' : 'text-gray-400'}`}>
            <div>
              {data.length > 0 ? (
                `Showing ${data.length} data points over ${
                  timeRange === '1d' ? '1 day' : 
                  timeRange === '3d' ? '3 days' : 
                  timeRange === '1w' ? '1 week' : 
                  timeRange
                } for ${selectedTickers.length} ticker${selectedTickers.length > 1 ? 's' : ''}`
              ) : (
                'Data Quality: High Confidence - 3 Sources'
              )}
            </div>
            <div>
              Updated: {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>



          {/* AI Analysis Button */}
          <ChartAIAnalysisButton
            chartData={data as ChartData[]}
            analysisType="ticker"
            timeRange={timeRange}
            selectedTickers={selectedTickers}
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  );
};

export default HistoricalSentimentChart; 