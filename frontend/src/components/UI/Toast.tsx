import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { Toast as ToastType, useToast } from '../../contexts/ToastContext';

interface ToastItemProps {
  toast: ToastType;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast }) => {
  const { theme } = useTheme();
  const { removeToast } = useToast();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const isLight = theme === 'light';

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Handle removal with animation
  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(() => {
      removeToast(toast.id);
    }, 300);
  };

  // Handle toast click
  const handleToastClick = () => {
    if (!toast.clickable) return;
    
    if (toast.onToastClick) {
      toast.onToastClick();
    } else if (toast.linkTo) {
      navigate(toast.linkTo);
    }
    
    // Remove toast after click
    handleRemove();
  };

  // Auto-remove on duration
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleRemove();
      }, toast.duration - 300); // Start exit animation 300ms before removal
      return () => clearTimeout(timer);
    }
  }, [toast.duration, toast.id]);

  // Theme and type-specific styling
  const getToastStyles = () => {
    const baseClasses = `
      relative flex items-center gap-3 p-4 rounded-lg shadow-lg border
      transform transition-all duration-300 ease-in-out
      ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      ${isLeaving ? 'scale-95' : 'scale-100'}
      ${toast.clickable ? 'cursor-pointer hover:scale-105' : ''}
    `;

    switch (toast.type) {
      case 'success':
        return `${baseClasses} ${
          isLight 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-green-900/30 border-green-700 text-green-300'
        }`;
      case 'error':
        return `${baseClasses} ${
          isLight 
            ? 'bg-red-50 border-red-200 text-red-800' 
            : 'bg-red-900/30 border-red-700 text-red-300'
        }`;
      case 'warning':
        return `${baseClasses} ${
          isLight 
            ? 'bg-yellow-50 border-yellow-200 text-yellow-800' 
            : 'bg-yellow-900/30 border-yellow-700 text-yellow-300'
        }`;
      case 'info':
      default:
        return `${baseClasses} ${
          isLight 
            ? 'bg-blue-50 border-blue-200 text-blue-800' 
            : 'bg-blue-900/30 border-blue-700 text-blue-300'
        }`;
    }
  };

  const getIcon = () => {
    const iconClasses = "w-5 h-5 flex-shrink-0";
    
    switch (toast.type) {
      case 'success':
        return <CheckCircle className={`${iconClasses} ${isLight ? 'text-green-600' : 'text-green-400'}`} />;
      case 'error':
        return <AlertCircle className={`${iconClasses} ${isLight ? 'text-red-600' : 'text-red-400'}`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClasses} ${isLight ? 'text-yellow-600' : 'text-yellow-400'}`} />;
      case 'info':
      default:
        return <Info className={`${iconClasses} ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />;
    }
  };

  return (
    <div 
      className={getToastStyles()}
      onClick={toast.clickable ? handleToastClick : undefined}
      title={toast.clickable ? 'Click to view usage details' : undefined}
    >
      {getIcon()}
      <div className="flex-1 text-sm font-medium">
        {toast.message}
      </div>
      {toast.clickable && (
        <ExternalLink className={`w-4 h-4 flex-shrink-0 ${
          isLight ? 'text-gray-500' : 'text-gray-400'
        }`} />
      )}
      <button
        onClick={(e) => {
          e.stopPropagation(); // Prevent toast click when closing
          handleRemove();
        }}
        className={`
          flex-shrink-0 p-1 rounded-full transition-colors
          ${isLight 
            ? 'hover:bg-gray-200 text-gray-500 hover:text-gray-700' 
            : 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
          }
        `}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}; 