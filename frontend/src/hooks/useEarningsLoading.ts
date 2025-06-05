import { useState, useEffect, useCallback } from 'react';
import { EarningsEvent, EarningsAnalysis } from '../types';

interface LoadingState {
  upcomingEarnings: { isLoading: boolean; needsRefresh: boolean };
  earningsAnalysis: { isLoading: boolean; needsRefresh: boolean };
}

interface FreshUnlockState {
  earningsAnalysis: boolean;
  upcomingEarnings: boolean;
}

export const useEarningsLoading = (
  hasEarningsAnalysisAccess: boolean,
  hasUpcomingEarningsAccess: boolean,
  onLoadingProgressChange?: (progress: number, stage: string) => void
) => {
  // Loading state management
  const [loadingState, setLoadingState] = useState<LoadingState>({
    upcomingEarnings: { isLoading: false, needsRefresh: false },
    earningsAnalysis: { isLoading: false, needsRefresh: false }
  });
  
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track fresh unlocks vs cache loads for appropriate loading UI
  const [isFreshUnlock, setIsFreshUnlock] = useState<FreshUnlockState>({
    earningsAnalysis: false,
    upcomingEarnings: false
  });

  // Data states that loading handlers will update
  const [upcomingEarnings, setUpcomingEarnings] = useState<EarningsEvent[]>([]);
  const [earningsAnalysis, setEarningsAnalysis] = useState<EarningsAnalysis | null>(null);
  const [errors, setErrors] = useState<{
    upcomingEarnings: string | null;
    analysis: string | null;
  }>({
    upcomingEarnings: null,
    analysis: null
  });

  // Handle loading updates from upcoming earnings tab
  const handleUpcomingEarningsLoading = useCallback((
    isLoading: boolean, 
    progress: number, 
    stage: string, 
    data?: EarningsEvent[], 
    error?: string | null
  ) => {
    setLoadingState(prev => ({
      ...prev,
      upcomingEarnings: { 
        isLoading, 
        needsRefresh: false
      }
    }));
    
    // When loading completes successfully, update data
    if (!isLoading && data) {
      setUpcomingEarnings(data);
    }
    
    // Update error state if provided
    if (error !== undefined) {
      setErrors(prev => ({ ...prev, upcomingEarnings: error }));
    }
    
    // Always update progress for loading (to support harvest loading card)
    setLoadingProgress(progress);
    setLoadingStage(stage);
    
    // Propagate to parent component
    if (onLoadingProgressChange) {
      onLoadingProgressChange(progress, stage);
    }

    // Clear refresh state when upcoming earnings loading completes
    if (!isLoading && isRefreshing) {
      const analysisComplete = !hasEarningsAnalysisAccess || !loadingState.earningsAnalysis.isLoading;
      if (analysisComplete) {
        setIsRefreshing(false);
      }
    }
  }, [onLoadingProgressChange, isRefreshing, hasEarningsAnalysisAccess, loadingState.earningsAnalysis.isLoading]);
  
  // Handle loading updates from earnings analysis tab
  const handleEarningsAnalysisLoading = useCallback((
    isLoading: boolean, 
    progress: number, 
    stage: string, 
    data?: EarningsAnalysis, 
    error?: string | null
  ) => {
    setLoadingState(prev => ({
      ...prev,
      earningsAnalysis: { 
        isLoading, 
        needsRefresh: false
      }
    }));
    
    // When loading completes successfully, update data
    if (!isLoading && data) {
      setEarningsAnalysis(data);
    }
    
    // Update error state if provided
    if (error !== undefined) {
      setErrors(prev => ({ ...prev, analysis: error }));
    }
    
    // Always update progress for analysis loading (to support harvest loading card)
    setLoadingProgress(progress);
    setLoadingStage(stage);
    
    // Propagate to parent component
    if (onLoadingProgressChange) {
      onLoadingProgressChange(progress, stage);
    }

    // Clear refresh state when analysis loading completes
    if (!isLoading && isRefreshing) {
      const upcomingComplete = !loadingState.upcomingEarnings.isLoading;
      if (upcomingComplete) {
        setIsRefreshing(false);
      }
    }
  }, [onLoadingProgressChange, isRefreshing, loadingState.upcomingEarnings.isLoading]);

  // Monitor loading states and clear refresh state when all loading is complete
  useEffect(() => {
    if (isRefreshing) {
      const upcomingDone = !hasUpcomingEarningsAccess || !loadingState.upcomingEarnings.isLoading;
      const analysisDone = !hasEarningsAnalysisAccess || !loadingState.earningsAnalysis.isLoading;
      
      // If no components are accessible, end refresh immediately
      if (!hasUpcomingEarningsAccess && !hasEarningsAnalysisAccess) {
        console.log('🔄 EARNINGS LOADING HOOK - No components accessible, ending refresh');
        setIsRefreshing(false);
        return;
      }
      
      if (upcomingDone && analysisDone) {
        console.log('🔄 EARNINGS LOADING HOOK - All accessible components loaded, ending refresh');
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing, loadingState.upcomingEarnings.isLoading, loadingState.earningsAnalysis.isLoading, hasUpcomingEarningsAccess, hasEarningsAnalysisAccess]);

  // Utility functions for managing loading UI
  const updateLoadingProgress = useCallback((progress: number, stage: string) => {
    setLoadingProgress(progress);
    setLoadingStage(stage);
    if (onLoadingProgressChange) {
      onLoadingProgressChange(progress, stage);
    }
  }, [onLoadingProgressChange]);

  const setFreshUnlockState = useCallback((component: keyof FreshUnlockState, value: boolean) => {
    setIsFreshUnlock(prev => ({
      ...prev,
      [component]: value
    }));
  }, []);

  const resetLoadingStates = useCallback(() => {
    setLoadingProgress(0);
    setLoadingStage('');
    setIsFreshUnlock({
      earningsAnalysis: false,
      upcomingEarnings: false
    });
  }, []);

  const clearData = useCallback(() => {
    setUpcomingEarnings([]);
    setEarningsAnalysis(null);
    setErrors({
      upcomingEarnings: null,
      analysis: null
    });
  }, []);

  const setNeedsRefresh = useCallback((component: 'upcomingEarnings' | 'earningsAnalysis', needsRefresh: boolean) => {
    setLoadingState(prev => ({
      ...prev,
      [component]: { 
        ...prev[component],
        needsRefresh 
      }
    }));
  }, []);

  return {
    // State
    loadingState,
    loadingProgress,
    loadingStage,
    isFreshUnlock,
    isRefreshing,
    upcomingEarnings,
    earningsAnalysis,
    errors,

    // Setters
    setLoadingState,
    setIsRefreshing,
    setUpcomingEarnings,
    setEarningsAnalysis,
    setErrors,

    // Handlers
    handleUpcomingEarningsLoading,
    handleEarningsAnalysisLoading,

    // Utilities
    updateLoadingProgress,
    setFreshUnlockState,
    resetLoadingStates,
    clearData,
    setNeedsRefresh,
  };
}; 