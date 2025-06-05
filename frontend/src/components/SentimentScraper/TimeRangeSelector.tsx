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
  
  // Theme-specific styling - matching the consistent dropdown pattern used throughout the app
  const cardBg = isLight ? 'bg-stone-300' : 'bg-gray-800';
  const cardBorder = isLight ? 'border-stone-400' : 'border-gray-700';
  const textColor = isLight ? 'text-stone-800' : 'text-white';

  return (
    <select
      value={currentRange}
      onChange={(e) => onRangeChange(e.target.value as TimeRange)}
      disabled={isDisabled}
      className={`px-3 py-2 rounded-lg border ${cardBorder} ${cardBg} ${textColor} text-sm ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <option value="1d">1 Day</option>
      <option value="3d">3 Days</option>
      <option value="1w">1 Week</option>
    </select>
  );
};

export default TimeRangeSelector;
