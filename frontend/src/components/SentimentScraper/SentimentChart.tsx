import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { ChartData } from '../../types';
import { BarChart2, Loader2, MessageSquare, TrendingUp, Globe } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import ProgressBar from '../ProgressBar';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions,
} from 'chart.js';
import type { TooltipItem } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, TimeScale);

interface SentimentChartProps {
  data: ChartData[];
  isLoading?: boolean;
  loadingProgress?: number;
  loadingStage?: string;
  hasRedditAccess?: boolean;
}

const SentimentChart: React.FC<SentimentChartProps> = ({ 
  data, 
  isLoading = false, 
  loadingProgress = 0,
  loadingStage = 'Generating chart...',
  hasRedditAccess = true
}) => {
  // Get theme context
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Calculate source distribution percentages
  const calculateSourcePercentages = (data: ChartData[]) => {
    if (!data || data.length === 0) {
      console.log('No data available for source calculation');
      return { reddit: 0, finviz: 0, yahoo: 0 };
    }

    console.log('Raw data for source calculation:', JSON.parse(JSON.stringify(data)));
    
    // Initialize source counts
    const sourceCounts = {
      reddit: 0,
      finviz: 0,
      yahoo: 0,
      other: 0  // Track any unexpected sources
    };

    // Sum up source counts from all data points
    data.forEach(item => {
      const sources = item.sources || {};
      console.log(`Sources for ${item.date}:`, sources);
      
      // Process each source in the item
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
          console.log(`Found unexpected source: ${source}`);
        }
      });
    });

    const total = Object.values(sourceCounts).reduce((sum, count) => sum + count, 0);
    console.log('Final source counts:', { ...sourceCounts, total });

    if (total === 0) {
      console.log('No source data found');
      return { reddit: 0, finviz: 0, yahoo: 0 };
    }

    // Calculate percentages (only for the three main sources)
    let percentages = {
      reddit: Math.round((sourceCounts.reddit / total) * 100),
      finviz: Math.round((sourceCounts.finviz / total) * 100),
      yahoo: Math.round((sourceCounts.yahoo / total) * 100)
    };

    // Override Reddit percentage for free users
    if (!hasRedditAccess) {
      const redditPercentage = percentages.reddit;
      percentages.reddit = 0;
      
      // Redistribute Reddit percentage to other sources
      if (redditPercentage > 0) {
        const nonRedditTotal = percentages.finviz + percentages.yahoo;
        if (nonRedditTotal > 0) {
          const redistributionRatio = (100 - percentages.reddit) / nonRedditTotal;
          percentages.finviz = Math.round(percentages.finviz * redistributionRatio);
          percentages.yahoo = Math.round(percentages.yahoo * redistributionRatio);
        } else {
          // If no other sources, default distribution
          percentages.finviz = 60;
          percentages.yahoo = 40;
        }
      }
    }

    console.log('Final calculated percentages:', percentages);
    return percentages;
  };

  const sourcePercentages = calculateSourcePercentages(data);
  
  // Helper to detect hourly data (1-day view)
  const isHourlyData = (d: ChartData[]): boolean => {
    if (d.length < 2) return false;
    
    // Check if the data has displayDate that looks like "HH:00" format
    // which indicates it's from a 1D view
    if (d[0]?.displayDate && d[0].displayDate.includes(':00')) {
      return true;
    }
    
    // Fallback to the old method - check time difference
    const first = new Date(d[0].date);
    const second = new Date(d[1].date);
    const diff = Math.abs(first.getTime() - second.getTime());
    return diff <= 60 * 60 * 1000 + 60 * 1000; // ~1h tolerance
  };

  const hourly = isHourlyData(data);
  console.log('Chart data is hourly:', hourly, data[0]?.displayDate);

  const formatLabel = (item: ChartData): string => {
    // First try to use the pre-formatted displayDate from the data
    if (item.displayDate) {
      if (hourly) {
        // For hourly data, get just the hour component in 12-hour format
        try {
          const [hour] = item.displayDate.split(':');
          // Format as "1 PM" or "2 AM"
          const hourNum = parseInt(hour, 10);
          return `${hourNum % 12 || 12}${hourNum >= 12 ? 'PM' : 'AM'}`;
        } catch (err) {
          return item.displayDate; // Fallback to standard displayDate
        }
      } else {
        // For daily data, use the full displayDate (e.g., "May 4")
        return item.displayDate;
      }
    }
    
    // If no displayDate is available, construct one from the date field
    try {
      const date = new Date(item.date);
      if (hourly) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (err) {
      return item.date;
    }
  };

  const labels = data.map((d) => formatLabel(d));

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Bullish',
        data: data.map((d) => d.bullish),
        backgroundColor: 'rgba(34,197,94,0.8)', // Tailwind green-500/80
        borderColor: 'rgba(34,197,94,1)',
        borderWidth: 1,
        borderRadius: 4,
        stack: 'Stack 0',
      },
      {
        label: 'Neutral',
        data: data.map((d) => d.neutral),
        backgroundColor: 'rgba(234,179,8,0.8)', // Tailwind amber-500/80
        borderColor: 'rgba(234,179,8,1)',
        borderWidth: 1,
        borderRadius: 4,
        stack: 'Stack 0',
      },
      {
        label: 'Bearish',
        data: data.map((d) => d.bearish),
        backgroundColor: 'rgba(239,68,68,0.8)', // Tailwind red-500/80
        borderColor: 'rgba(239,68,68,1)',
        borderWidth: 1,
        borderRadius: 4,
        stack: 'Stack 0',
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isLight ? '#57534e' : '#9ca3af', // stone-600 for light mode, gray-400 for dark mode
          boxWidth: 12,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => `${ctx.dataset.label}: ${ctx.parsed.y}%`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        border: {
          color: isLight ? '#a8a29e' : '#374151', // stone-400 for light mode, gray-700 for dark
        },
        grid: {
          color: isLight ? '#d6d3d1' : '#27272a', // stone-300 for light mode, gray-800 for dark
        },
        ticks: {
          color: isLight ? '#78716c' : '#6b7280', // stone-500 for light, gray-500 for dark
          maxRotation: hourly && data.length > 16 ? 45 : 0,
          minRotation: hourly && data.length > 16 ? 45 : 0,
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        suggestedMax: 100,
        border: {
          color: isLight ? '#a8a29e' : '#374151', // stone-400 for light mode, gray-700 for dark
        },
        grid: {
          color: isLight ? '#d6d3d1' : '#27272a', // stone-300 for light mode, gray-800 for dark
        },
        ticks: {
          callback: (value: string | number) => `${value}%`,
          color: isLight ? '#78716c' : '#6b7280', // stone-500 for light, gray-500 for dark
        },
      },
    },
  };

  // Only show the no data message if we're not loading and the data is empty
  const showNoDataMessage = !isLoading && (!data || data.length === 0);

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ height: '300px' }}>
        {/* Only render chart if we have data */}
        {!showNoDataMessage && <Bar options={options} data={chartData} />}
        
        {/* No data message */}
        {showNoDataMessage && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center ${isLight ? 'bg-stone-300' : 'bg-gray-900'} rounded-lg p-6`}>
            <BarChart2 className={`${isLight ? 'text-stone-500' : 'text-gray-600'} mb-4`} size={32} />
            <p className={`text-center ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
              No chart data available for the selected time period
            </p>
          </div>
        )}
        
        {/* Loading overlay - placed after the chart to ensure it's on top */}
        {isLoading && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center ${isLight ? 'bg-stone-300 bg-opacity-90' : 'bg-gray-900 bg-opacity-90'} rounded-lg p-6 z-10`}>
            <Loader2 className="text-blue-500 mb-4 animate-spin" size={32} />
            <div className="text-center mb-4">
              <h3 className={`text-lg font-medium ${isLight ? 'text-stone-800' : 'text-white'} mb-1`}>{loadingStage}</h3>
              <p className={`text-sm ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>Please wait while we process sentiment data...</p>
            </div>
            <div className="w-full max-w-sm mb-2">
              <ProgressBar progress={loadingProgress} />
            </div>
            <div className="text-xs text-blue-400">{loadingProgress}% complete</div>
          </div>
        )}
      </div>
      <div className="text-xs flex flex-wrap items-center justify-between gap-3 text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center space-x-2">
          <span className={`flex items-center space-x-1 rounded-full px-2 py-0.5 ${
            hasRedditAccess 
              ? 'bg-stone-100 dark:bg-gray-700' 
              : 'bg-gray-200 dark:bg-gray-800 opacity-50'
          }`}>
            <MessageSquare size={12} className={hasRedditAccess ? "text-orange-500" : "text-gray-400"} />
            <span className={hasRedditAccess ? "" : "text-gray-400"}>
              {sourcePercentages.reddit}%
            </span>
            {!hasRedditAccess && (
              <span className="text-xs text-gray-400" title="Pro feature">🔒</span>
            )}
          </span>
          <span className="flex items-center space-x-1 bg-stone-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
            <TrendingUp size={12} className="text-amber-500" />
            <span>{sourcePercentages.finviz}%</span>
          </span>
          <span className="flex items-center space-x-1 bg-stone-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
            <Globe size={12} className="text-blue-500" />
            <span>{sourcePercentages.yahoo}%</span>
          </span>
          {/* <span className="hidden sm:inline-flex items-center space-x-1 bg-stone-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
            <Layers size={12} className="text-gray-500" />
            <span>Combined</span>
          </span> */}
        </div>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          Last updated: {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

export default SentimentChart;