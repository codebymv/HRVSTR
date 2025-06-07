import React, { useMemo, useState, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { HistoricalSentimentData, ChartViewMode, ChartData } from '../../types';
import { Line, Bar } from 'react-chartjs-2';
import { Plus, Minus, RotateCcw } from 'lucide-react';
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

interface HistoricalSentimentChartProps {
  data: HistoricalSentimentData[] | ChartData[];
  viewMode: ChartViewMode;
  selectedTickers?: string[];
  isLoading?: boolean;
  showTrendLines?: boolean;
  className?: string;
}

const HistoricalSentimentChart: React.FC<HistoricalSentimentChartProps> = ({
  data,
  viewMode,
  selectedTickers = [],
  isLoading = false,
  showTrendLines = true,
  className = ''
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Zoom state
  const [zoomLevel, setZoomLevel] = useState(0); // 0 = auto, positive = zoomed in, negative = zoomed out

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

  // Process data based on view mode
  const chartData = useMemo(() => {
    console.log('🔍 HISTORICAL CHART DEBUG: Processing data', { 
      dataLength: data?.length || 0, 
      viewMode, 
      selectedTickers,
      firstDataItem: data?.[0]
    });
    
    if (!data || data.length === 0) {
      console.log('🔍 HISTORICAL CHART DEBUG: No data available');
      return null;
    }

    // Check if data is historical sentiment data or chart data
    const isHistoricalData = 'sentiment_score' in data[0];
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
      const historicalData = data as HistoricalSentimentData[];
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

        // Get all unique dates and sort them
        const allDates = [...new Set(historicalData.map(item => item.date))].sort();
        console.log('🔍 HISTORICAL CHART DEBUG: All dates:', allDates);
        
        const labels = allDates.map(date => 
          new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        );

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
          const dataPoints = allDates.map(date => {
            const item = tickerData.find(d => d.date === date);
            if (item) {
              console.log(`🔍 CHART DEBUG: ${ticker} on ${date} - Raw score: ${item.sentiment_score}, Normalized: ${normalizeScore(item.sentiment_score)}`);
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
  }, [data, viewMode]);

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
            padding: 20,
          },
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
      {/* Zoom Controls - Only show for ticker view */}
      {viewMode === 'ticker' && chartData && chartData.datasets.length > 0 && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <button
            onClick={() => setZoomLevel(prev => Math.min(prev + 1, 5))}
            disabled={zoomLevel >= 5}
            className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
              isLight
                ? 'bg-white/90 hover:bg-white text-stone-600 border border-stone-200 hover:border-stone-300'
                : 'bg-gray-800/90 hover:bg-gray-800 text-gray-300 border border-gray-600 hover:border-gray-500'
            } ${
              zoomLevel >= 5 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer shadow-sm'
            }`}
            title="Zoom In"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            onClick={() => setZoomLevel(prev => Math.max(prev - 1, -2))}
            disabled={zoomLevel <= -2}
            className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
              isLight
                ? 'bg-white/90 hover:bg-white text-stone-600 border border-stone-200 hover:border-stone-300'
                : 'bg-gray-800/90 hover:bg-gray-800 text-gray-300 border border-gray-600 hover:border-gray-500'
            } ${
              zoomLevel <= -2 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer shadow-sm'
            }`}
            title="Zoom Out"
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            onClick={() => setZoomLevel(0)}
            disabled={zoomLevel === 0}
            className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
              isLight
                ? 'bg-white/90 hover:bg-white text-stone-600 border border-stone-200 hover:border-stone-300'
                : 'bg-gray-800/90 hover:bg-gray-800 text-gray-300 border border-gray-600 hover:border-gray-500'
            } ${
              zoomLevel === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer shadow-sm'
            }`}
            title="Reset Zoom (Auto Scale)"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      )}
      
      {/* Chart Container */}
      <div className="h-64">
        <ChartComponent
          key={`${viewMode}-${selectedTickers.join('-')}-${zoomLevel}`}
          data={chartData}
          options={options}
        />
      </div>
      
      {/* Range Indicator - Only show for ticker view when zoomed */}
      {viewMode === 'ticker' && zoomLevel !== 0 && (
        <div className={`text-xs text-center mt-1 ${isLight ? 'text-stone-500' : 'text-gray-400'}`}>
          Showing {yAxisRange.min}% - {yAxisRange.max}% 
          {zoomLevel > 0 && ` (Zoomed In +${zoomLevel})`}
          {zoomLevel < 0 && ` (Zoomed Out ${zoomLevel})`}
        </div>
      )}
    </div>
  );
};

export default HistoricalSentimentChart; 