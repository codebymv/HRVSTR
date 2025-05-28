import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Loader2 } from 'lucide-react';
import ProgressBar from '../ProgressBar';

interface LoadingCardProps {
  title?: string;
  subtitle?: string;
  progress?: number;
  stage?: string;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LoadingCard: React.FC<LoadingCardProps> = ({
  title = 'Loading...',
  subtitle = 'Please wait while we process your request',
  progress = 0,
  stage = 'Processing...',
  showProgress = false,
  size = 'md',
  className = ''
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Size configurations
  const sizeConfig = {
    sm: {
      padding: 'p-6',
      iconSize: 24,
      titleSize: 'text-base',
      subtitleSize: 'text-sm'
    },
    md: {
      padding: 'p-10',
      iconSize: 32,
      titleSize: 'text-lg',
      subtitleSize: 'text-sm'
    },
    lg: {
      padding: 'p-12',
      iconSize: 40,
      titleSize: 'text-xl',
      subtitleSize: 'text-base'
    }
  };
  
  const config = sizeConfig[size];
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const progressTextColor = isLight ? 'text-blue-600' : 'text-blue-400';
  
  return (
    <div className={`flex flex-col items-center justify-center ${config.padding} text-center ${className}`}>
      <Loader2 className="mb-4 text-blue-500 animate-spin" size={config.iconSize} />
      
      <h3 className={`${config.titleSize} font-semibold ${textColor} mb-2`}>
        {showProgress ? stage : title}
      </h3>
      
      <p className={`${config.subtitleSize} ${mutedTextColor} mb-4`}>
        {subtitle}
      </p>
      
      {showProgress && (
        <>
          <div className="w-full max-w-sm mb-3">
            <ProgressBar progress={progress} />
          </div>
          <div className={`text-xs ${progressTextColor} font-medium`}>
            {progress}% complete
          </div>
        </>
      )}
    </div>
  );
};

export default LoadingCard; 