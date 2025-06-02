import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  clickable?: boolean;
  linkTo?: string;
  onToastClick?: () => void;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: Toast['type'], duration?: number, options?: { clickable?: boolean; linkTo?: string; onToastClick?: () => void }) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number, options?: { clickable?: boolean; linkTo?: string; onToastClick?: () => void }) => void;
  error: (message: string, duration?: number, options?: { clickable?: boolean; linkTo?: string; onToastClick?: () => void }) => void;
  info: (message: string, duration?: number, options?: { clickable?: boolean; linkTo?: string; onToastClick?: () => void }) => void;
  warning: (message: string, duration?: number, options?: { clickable?: boolean; linkTo?: string; onToastClick?: () => void }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((
    message: string, 
    type: Toast['type'], 
    duration = 4000,
    options?: { clickable?: boolean; linkTo?: string; onToastClick?: () => void }
  ) => {
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const toast: Toast = { 
      id, 
      message, 
      type, 
      duration,
      clickable: options?.clickable,
      linkTo: options?.linkTo,
      onToastClick: options?.onToastClick
    };
    
    setToasts(prev => [...prev, toast]);

    // Auto-remove toast after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  // Convenience methods
  const success = useCallback((
    message: string, 
    duration?: number, 
    options?: { clickable?: boolean; linkTo?: string; onToastClick?: () => void }
  ) => {
    addToast(message, 'success', duration, options);
  }, [addToast]);

  const error = useCallback((
    message: string, 
    duration?: number, 
    options?: { clickable?: boolean; linkTo?: string; onToastClick?: () => void }
  ) => {
    addToast(message, 'error', duration, options);
  }, [addToast]);

  const info = useCallback((
    message: string, 
    duration?: number, 
    options?: { clickable?: boolean; linkTo?: string; onToastClick?: () => void }
  ) => {
    addToast(message, 'info', duration, options);
  }, [addToast]);

  const warning = useCallback((
    message: string, 
    duration?: number, 
    options?: { clickable?: boolean; linkTo?: string; onToastClick?: () => void }
  ) => {
    addToast(message, 'warning', duration, options);
  }, [addToast]);

  const value = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    warning,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}; 