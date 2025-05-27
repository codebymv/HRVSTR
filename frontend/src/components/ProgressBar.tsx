import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  label, 
  className = '' 
}) => {
  // Get theme context
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const textColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const trackBgColor = isLight ? 'bg-stone-400' : 'bg-gray-800';
  // Ensure progress is between 0-100
  const clampedProgress = Math.min(100, Math.max(0, progress));
  
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className={`flex justify-between mb-1 text-sm ${textColor}`}>
          <span>{label}</span>
          <span>{clampedProgress.toFixed(0)}%</span>
        </div>
      )}
      <div className={`w-full h-2.5 ${trackBgColor} rounded-full overflow-hidden`}>
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
