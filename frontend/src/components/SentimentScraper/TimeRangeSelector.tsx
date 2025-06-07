import React from 'react';
import { TimeRange, HistoricalTimeRange } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

interface TimeRangeSelectorProps {
  currentRange: TimeRange | HistoricalTimeRange;
  onRangeChange: (range: TimeRange | HistoricalTimeRange) => void;
  isDisabled?: boolean;
  className?: string;
  showHistoricalRanges?: boolean;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  currentRange,
  onRangeChange,
  isDisabled = false,
  className = '',
  showHistoricalRanges = false
}) => {
  // Get theme context
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling - matching the consistent dropdown pattern used throughout the app
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-800';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-700';
  const textColor = isLight ? 'text-stone-800' : 'text-white';

  return (
    <select
      value={currentRange}
      onChange={(e) => onRangeChange(e.target.value as TimeRange | HistoricalTimeRange)}
      disabled={isDisabled}
      className={`px-3 py-2 rounded-lg border ${cardBorder} ${cardBg} ${textColor} text-sm ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      {showHistoricalRanges ? (
        // Historical ranges for enhanced chart
        <>
          <option value="7">7 Days</option>
          <option value="30">30 Days</option>
          <option value="60">60 Days</option>
          <option value="90">90 Days</option>
          <option value="365">1 Year</option>
        </>
      ) : (
        // Original real-time ranges
        <>
          <option value="1d">1 Day</option>
          <option value="3d">3 Days</option>
          <option value="1w">1 Week</option>
        </>
      )}
    </select>
  );
};

export default TimeRangeSelector;
