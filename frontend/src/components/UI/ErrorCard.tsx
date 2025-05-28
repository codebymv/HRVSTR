import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { AlertTriangle, Wifi, RefreshCw } from 'lucide-react';

interface ErrorCardProps {
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'rateLimited' | 'network';
  onRetry?: () => void;
  retryLabel?: string;
  showRetry?: boolean;
  isRetrying?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ErrorCard: React.FC<ErrorCardProps> = ({
  title,
  message,
  type = 'error',
  onRetry,
  retryLabel = 'Try Again',
  showRetry = true,
  isRetrying = false,
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
      messageSize: 'text-sm'
    },
    md: {
      padding: 'p-10',
      iconSize: 32,
      titleSize: 'text-lg',
      messageSize: 'text-sm'
    },
    lg: {
      padding: 'p-12',
      iconSize: 40,
      titleSize: 'text-xl',
      messageSize: 'text-base'
    }
  };
  
  const config = sizeConfig[size];
  
  // Theme colors
  const textColor = isLight ? 'text-stone-800' : 'text-white';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const buttonBgColor = isLight ? 'bg-blue-500 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700';
  
  // Type-specific configurations
  const typeConfig = {
    error: {
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      defaultTitle: 'Error'
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-500',
      defaultTitle: 'Warning'
    },
    rateLimited: {
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      defaultTitle: 'Rate Limit Exceeded'
    },
    network: {
      icon: Wifi,
      iconColor: 'text-orange-500',
      defaultTitle: 'Network Error'
    }
  };
  
  const { icon: Icon, iconColor, defaultTitle } = typeConfig[type];
  const displayTitle = title || defaultTitle;
  
  return (
    <div className={`flex flex-col items-center justify-center ${config.padding} text-center ${className}`}>
      <Icon className={`mb-4 ${iconColor}`} size={config.iconSize} />
      
      <h3 className={`${config.titleSize} font-semibold ${textColor} mb-2`}>
        {displayTitle}
      </h3>
      
      <p className={`${config.messageSize} ${mutedTextColor} mb-4 max-w-md`}>
        {message}
      </p>
      
      {showRetry && onRetry && (
        <button 
          onClick={onRetry} 
          disabled={isRetrying}
          className={`
            inline-flex items-center gap-2 px-4 py-2 
            ${buttonBgColor} text-white rounded-md 
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed
            ${isRetrying ? 'cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {isRetrying && <RefreshCw className="animate-spin" size={16} />}
          {retryLabel}
        </button>
      )}
    </div>
  );
};

export default ErrorCard; 