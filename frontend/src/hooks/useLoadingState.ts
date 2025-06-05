import { useState, useCallback } from 'react';

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
  
  // Helper function to update loading states consistently
  const updateLoadingState = useCallback((states: Partial<LoadingState>) => {
    setLoading(prev => {
      const newState: LoadingState = { ...prev };
      
      // Update with new states, ensuring all values are boolean
      Object.entries(states).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          newState[key] = value;
        }
      });
      
      // If all states are false, reset global loading
      const allComplete = Object.values(newState).every(state => state === false);
      if (allComplete) {
        setIsDataLoading(false);
        setIsRefreshing(false);
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
  
  // Set a specific loading state
  const setLoadingForKey = useCallback((key: string, isLoading: boolean) => {
    updateLoadingState({ [key]: isLoading });
  }, [updateLoadingState]);
  
  // Set error for a specific key
  const setErrorForKey = useCallback((key: string, error: string | null) => {
    setErrors(prev => ({ ...prev, [key]: error }));
  }, []);
  
  // Reset all loading states
  const resetLoading = useCallback(() => {
    setLoading({});
    setLoadingProgress(0);
    setLoadingStage('');
    setIsDataLoading(false);
    setIsRefreshing(false);
    setErrors({});
  }, []);
  
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