import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { ChartData } from '../../types';
import { BarChart2, Loader2 } from 'lucide-react';
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
}

const SentimentChart: React.FC<SentimentChartProps> = ({ 
  data, 
  isLoading = false, 
  loadingProgress = 0,
  loadingStage = 'Generating chart...' 
}) => {
  // Get theme context
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
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
      <div className="text-xs flex flex-wrap items-center gap-2 text-neutral-500 dark:text-neutral-400">
        <span>Data sources:</span>
        <div className="flex space-x-2">
          <span className="bg-orange-500 rounded-full px-2 py-0.5 text-white">
            Reddit (30%)
          </span>
          <span className="bg-amber-500 rounded-full px-2 py-0.5 text-white">
            Finviz (40%)
          </span>
          <span className="bg-green-500 rounded-full px-2 py-0.5 text-white">
            Yahoo (30%)
          </span>
        </div>
        <span className="ml-auto">
          Last updated: {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

export default SentimentChart;