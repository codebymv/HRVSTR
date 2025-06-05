import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import ProgressBar from '../ProgressBar';

interface ProgressiveLoaderProps {
  isLoading: boolean;
  progress: number;
  stage: string;
  showProgressBar?: boolean;
  showStage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'card' | 'overlay';
  children?: React.ReactNode;
  className?: string;
}

const ProgressiveLoader: React.FC<ProgressiveLoaderProps> = ({
  isLoading,
  progress,
  stage,
  showProgressBar = true,
  showStage = true,
  size = 'md',
  variant = 'default',
  children,
  className = ''
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Size configurations
  const sizeConfig = {
    sm: {
      spinner: 'w-4 h-4',
      text: 'text-sm',
      padding: 'p-2'
    },
    md: {
      spinner: 'w-6 h-6',
      text: 'text-base',
      padding: 'p-4'
    },
    lg: {
      spinner: 'w-8 h-8',
      text: 'text-lg',
      padding: 'p-6'
    }
  };
  
  // Theme-based styling
  const textColor = isLight ? 'text-gray-700' : 'text-gray-300';
  const mutedTextColor = isLight ? 'text-gray-500' : 'text-gray-400';
  const cardBg = isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700';
  const overlayBg = isLight ? 'bg-white/90' : 'bg-gray-900/90';
  
  const config = sizeConfig[size];
  
  // Render loading content
  const renderLoader = () => (
    <div className="flex flex-col items-center justify-center space-y-3">
      <Loader2 className={`${config.spinner} animate-spin text-blue-500`} />
      
      {showStage && stage && (
        <p className={`${config.text} ${textColor} text-center font-medium`}>
          {stage}
        </p>
      )}
      
      {showProgressBar && (
        <div className="w-full max-w-xs">
          <ProgressBar progress={progress} />
          <p className={`text-xs ${mutedTextColor} text-center mt-1`}>
            {progress}% complete
          </p>
        </div>
      )}
    </div>
  );
  
  // Variant rendering
  if (variant === 'overlay' && isLoading) {
    return (
      <div className={`absolute inset-0 ${overlayBg} backdrop-blur-sm flex items-center justify-center z-10 ${className}`}>
        {renderLoader()}
      </div>
    );
  }
  
  if (variant === 'card') {
    return (
      <div className={`${cardBg} rounded-lg border ${config.padding} ${className}`}>
        {isLoading ? renderLoader() : children}
      </div>
    );
  }
  
  // Default variant
  if (isLoading) {
    return (
      <div className={`${config.padding} ${className}`}>
        {renderLoader()}
      </div>
    );
  }
  
  return <>{children}</>;
};

export default ProgressiveLoader; 