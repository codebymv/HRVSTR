import React from 'react';
import { ChartViewMode } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { TrendingUp, BarChart2 } from 'lucide-react';

interface ChartViewModeSelectorProps {
  currentMode: ChartViewMode;
  onModeChange: (mode: ChartViewMode) => void;
  isDisabled?: boolean;
  className?: string;
}

const ChartViewModeSelector: React.FC<ChartViewModeSelectorProps> = ({
  currentMode,
  onModeChange,
  isDisabled = false,
  className = ''
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const buttonBase = `px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2`;
  const activeButton = isLight 
    ? 'bg-blue-500 text-white' 
    : 'bg-blue-600 text-white';
  const inactiveButton = isLight 
    ? 'bg-stone-200 text-stone-700 hover:bg-stone-300' 
    : 'bg-gray-700 text-gray-300 hover:bg-gray-600';

  const modes = [
    {
      value: 'market' as ChartViewMode,
      label: 'Market',
      icon: TrendingUp,
      description: 'Overall market sentiment'
    },
    {
      value: 'ticker' as ChartViewMode,
      label: 'Tickers',
      icon: BarChart2,
      description: 'Watchlist ticker analysis'
    }
  ];

  return (
    <div className={`flex rounded-lg border ${isLight ? 'border-stone-300 bg-stone-100' : 'border-gray-600 bg-gray-800'} p-1 ${className}`}>
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.value;
        
        return (
          <button
            key={mode.value}
            onClick={() => onModeChange(mode.value)}
            disabled={isDisabled}
            className={`${buttonBase} ${isActive ? activeButton : inactiveButton} ${
              isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title={mode.description}
          >
            <Icon size={16} />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ChartViewModeSelector; 