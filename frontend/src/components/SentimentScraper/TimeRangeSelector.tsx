import React from 'react';
import { TimeRange } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

interface TimeRangeSelectorProps {
  currentRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  isDisabled?: boolean;
  className?: string;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  currentRange,
  onRangeChange,
  isDisabled = false,
  className = ''
}) => {
  // Get theme context
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const activeButtonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';
  const buttonBgColor = isLight ? 'bg-stone-400 hover:bg-stone-500' : 'bg-gray-700 hover:bg-gray-600';
  const buttonTextColor = isLight ? 'text-stone-800' : 'text-white';
  const activeButtonTextColor = 'text-white';

  // Available time ranges
  const timeRanges: TimeRange[] = ['1d', '1w', '1m', '3m'];

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {timeRanges.map((range) => (
        <button
          key={range}
          onClick={() => onRangeChange(range)}
          disabled={isDisabled}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            currentRange === range 
              ? `${activeButtonBgColor} ${activeButtonTextColor}` 
              : `${buttonBgColor} ${buttonTextColor} ${isLight ? 'hover:bg-stone-500' : 'hover:bg-gray-600'}`
          } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {range.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

export default TimeRangeSelector;
