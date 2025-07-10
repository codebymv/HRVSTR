import { useState, useCallback, useEffect } from 'react';

export interface LoadingState {
  [key: string]: boolean;
}

export interface LoadingConfig {
  initialStates?: LoadingState;
  onProgressChange?: (progress: number, stage: string) => void;
}

export const useLoadingState = (config: LoadingConfig = {}) => {
  const [loading, setLoading] = useState<LoadingState>(config.initialStates || {});
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string | null }>({});
  
  // LOADING STATE FIX: Add timeout tracking to prevent stuck loading states
  const loadingTimeouts = useState<{ [key: string]: NodeJS.Timeout }>({})[0];
  
  // Helper function to update loading states consistently
  const updateLoadingState = useCallback((states: Partial<LoadingState>) => {
    setLoading(prev => {
      const newState: LoadingState = { ...prev };
      
      // Update with new states, ensuring all values are boolean
      Object.entries(states).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          newState[key] = value;
        } else {
          // LOADING STATE FIX: Handle non-boolean values by converting to boolean
          console.warn(`Loading state for '${key}' is not boolean:`, value, 'Converting to boolean');
          newState[key] = Boolean(value);
        }
      });
      
      // If all states are false, reset global loading
      const allComplete = Object.values(newState).every(state => state === false);
      if (allComplete) {
        setIsDataLoading(false);
        setIsRefreshing(false);
        setLoadingProgress(0);
        setLoadingStage('');
      }
      
      return newState;
    });
  }, []);
  
  // Helper function to update progress
  const updateProgress = useCallback((progress: number, stage: string) => {
    // Ensure progress is always between 0-100
    const safeProgress = Math.min(Math.max(0, progress), 100);
    console.log(`Loading progress: ${safeProgress}%, Stage: ${stage}`);
    setLoadingProgress(safeProgress);
    setLoadingStage(stage);
    
    // Propagate to parent component if callback exists
    if (config.onProgressChange) {
      config.onProgressChange(safeProgress, stage);
    }
  }, [config.onProgressChange]);
  
  // Set a specific loading state with automatic timeout protection
  const setLoadingForKey = useCallback((key: string, isLoading: boolean, timeoutMs: number = 120000) => {
    // Clear existing timeout for this key
    if (loadingTimeouts[key]) {
      clearTimeout(loadingTimeouts[key]);
      delete loadingTimeouts[key];
    }
    
    updateLoadingState({ [key]: isLoading });
    
    // LOADING STATE FIX: Set timeout to automatically clear stuck loading states
    if (isLoading) {
      loadingTimeouts[key] = setTimeout(() => {
        console.warn(`Loading state for '${key}' timed out after ${timeoutMs}ms, automatically resetting`);
        updateLoadingState({ [key]: false });
        setErrorForKey(key, 'Loading timed out - please try again');
        delete loadingTimeouts[key];
      }, timeoutMs);
    }
  }, [updateLoadingState, loadingTimeouts]);
  
  // Set error for a specific key
  const setErrorForKey = useCallback((key: string, error: string | null) => {
    // LOADING STATE FIX: Clear timeout when setting error to prevent conflicts
    if (loadingTimeouts[key]) {
      clearTimeout(loadingTimeouts[key]);
      delete loadingTimeouts[key];
    }
    setErrors(prev => ({ ...prev, [key]: error }));
  }, [loadingTimeouts]);
  
  // Reset all loading states
  const resetLoading = useCallback(() => {
    // LOADING STATE FIX: Clear all timeouts when resetting
    Object.values(loadingTimeouts).forEach(timeout => {
      if (timeout) clearTimeout(timeout);
    });
    Object.keys(loadingTimeouts).forEach(key => {
      delete loadingTimeouts[key];
    });
    
    setLoading({});
    setLoadingProgress(0);
    setLoadingStage('');
    setIsDataLoading(false);
    setIsRefreshing(false);
    setErrors({});
  }, [loadingTimeouts]);
  
  // Start refresh process
  const startRefresh = useCallback(() => {
    setIsRefreshing(true);
    setErrors({});
  }, []);
  
  // Start initial data loading
  const startDataLoading = useCallback(() => {
    setIsDataLoading(true);
    setLoadingProgress(0);
    setLoadingStage('Initializing...');
    setErrors({});
  }, []);
  
  // Check if any component is loading
  const isAnyLoading = Object.values(loading).some(state => state === true);
  
  // LOADING STATE FIX: Cleanup effect to clear timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(loadingTimeouts).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, [loadingTimeouts]);
  
  return {
    // States
    loading,
    loadingProgress,
    loadingStage,
    isDataLoading,
    isRefreshing,
    isAnyLoading,
    errors,
    
    // Actions
    updateLoadingState,
    updateProgress,
    setLoadingForKey,
    setErrorForKey,
    resetLoading,
    startRefresh,
    startDataLoading
  };
};