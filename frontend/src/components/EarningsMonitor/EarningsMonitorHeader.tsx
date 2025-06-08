import React from 'react';
import { TimeRange } from '../../types';
import { RefreshCw, Loader2 } from 'lucide-react';

interface EarningsMonitorHeaderProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  onRefresh: () => void;
  isLoading: boolean;
  hasUnlockedComponents: boolean;
  isLight: boolean;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  subTextColor: string;
}

const EarningsMonitorHeader: React.FC<EarningsMonitorHeaderProps> = ({
  timeRange,
  onTimeRangeChange,
  onRefresh,
  isLoading,
  hasUnlockedComponents,
  isLight,
  cardBg,
  cardBorder,
  textColor,
  subTextColor,
}) => {
  return (
    <div className={`flex flex-row justify-between items-center gap-4 mb-4 ${cardBg} rounded-lg p-4 border ${cardBorder}`}>
      <div className="flex-1">
        <h1 className={`text-xl font-bold ${textColor}`}>Earnings Monitor</h1>
        <p className={`text-sm ${subTextColor}`}>Track upcoming earnings events and analysis</p>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Time range selector */}
        <select 
          value={timeRange}
          onChange={(e) => onTimeRangeChange(e.target.value as TimeRange)}
          className={`py-1 px-2 rounded text-sm ${cardBg} ${textColor} border ${cardBorder} ${
            !hasUnlockedComponents ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={isLoading || !hasUnlockedComponents}
        >
          <option value="1d">Today</option>
          <option value="1w">This Week</option>
        </select>
        
        {/* Refresh button */}
        <button 
          className={`transition-colors rounded-full p-2 ${
            hasUnlockedComponents
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
              : 'bg-gray-400 cursor-not-allowed text-gray-200'
          } ${isLoading ? 'opacity-50' : ''}`}
          onClick={onRefresh}
          disabled={isLoading || !hasUnlockedComponents}
        >
          {hasUnlockedComponents && isLoading ? (
            <Loader2 size={18} className="text-white animate-spin" />
          ) : (
            <RefreshCw size={18} className={
              !hasUnlockedComponents ? 'text-gray-200' : 'text-white'
            } />
          )}
        </button>
      </div>
    </div>
  );
};

export default EarningsMonitorHeader; 