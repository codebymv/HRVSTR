import { useState, useEffect, useCallback } from 'react';

interface LoadingState {
  chart: { isLoading: boolean; needsRefresh: boolean };
  scores: { isLoading: boolean; needsRefresh: boolean };
  reddit: { isLoading: boolean; needsRefresh: boolean };
}

interface FreshUnlockState {
  chart: boolean;
  scores: boolean;
  reddit: boolean;
}

interface SentimentLoadingProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
  hasChartAccess: boolean;
  hasScoresAccess: boolean;
  hasRedditAccess: boolean;
  isFreshUnlock: FreshUnlockState;
  isCheckingSessions: boolean;
  setFreshUnlockState: (component: 'chart' | 'scores' | 'reddit', value: boolean) => void;
}

export const useSentimentLoading = ({ 
  onLoadingProgressChange, 
  hasChartAccess, 
  hasScoresAccess,
  hasRedditAccess,
  isFreshUnlock,
  isCheckingSessions,
  setFreshUnlockState
}: SentimentLoadingProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  
  // Loading states for components
  const [loadingState, setLoadingState] = useState<LoadingState>({
    chart: { isLoading: false, needsRefresh: false },
    scores: { isLoading: false, needsRefresh: false },
    reddit: { isLoading: false, needsRefresh: false }
  });

  // Error states
  const [errors, setErrors] = useState<{
    chart: string | null;
    scores: string | null;
    reddit: string | null;
  }>({
    chart: null,
    scores: null,
    reddit: null
  });

  // Data states
  const [chartData, setChartData] = useState<any>(null);
  const [scoresData, setScoresData] = useState<any[]>([]);
  const [redditData, setRedditData] = useState<any[]>([]);

  // Handle loading updates from chart component
  const handleChartLoading = useCallback((
    isLoading: boolean, 
    progress: number, 
    stage: string, 
    data?: any, 
    error?: string | null
  ) => {
    setLoadingState(prev => ({
      ...prev,
      chart: { 
        isLoading, 
        needsRefresh: false
      }
    }));
    
    // When loading completes successfully, update data
    if (!isLoading && data) {
      setChartData(data);
    }
    
    // Update error state if provided
    if (error !== undefined) {
      setErrors(prev => ({ ...prev, chart: error }));
    }
    
    // Always update progress for loading (to support harvest loading card)
    setLoadingProgress(progress);
    setLoadingStage(stage);
    
    // Propagate to parent component
    if (onLoadingProgressChange) {
      onLoadingProgressChange(progress, stage);
    }

    // Clear refresh state when chart loading completes
    if (!isLoading && isRefreshing) {
      const scoresComplete = !hasScoresAccess || !loadingState.scores.isLoading;
      const redditComplete = !hasRedditAccess || !loadingState.reddit.isLoading;
      if (scoresComplete && redditComplete) {
        setIsRefreshing(false);
      }
    }
  }, [onLoadingProgressChange, isRefreshing, hasScoresAccess, hasRedditAccess, loadingState.scores.isLoading, loadingState.reddit.isLoading]);

  // Handle loading updates from scores component
  const handleScoresLoading = useCallback((
    isLoading: boolean, 
    progress: number, 
    stage: string, 
    data?: any[], 
    error?: string | null
  ) => {
    setLoadingState(prev => ({
      ...prev,
      scores: { 
        isLoading, 
        needsRefresh: false
      }
    }));
    
    // When loading completes successfully, update data
    if (!isLoading && data) {
      setScoresData(data);
    }
    
    // Update error state if provided
    if (error !== undefined) {
      setErrors(prev => ({ ...prev, scores: error }));
    }
    
    // Always update progress for loading (to support harvest loading card)
    setLoadingProgress(progress);
    setLoadingStage(stage);
    
    // Propagate to parent component
    if (onLoadingProgressChange) {
      onLoadingProgressChange(progress, stage);
    }

    // Clear refresh state when scores loading completes
    if (!isLoading && isRefreshing) {
      const chartComplete = !hasChartAccess || !loadingState.chart.isLoading;
      const redditComplete = !hasRedditAccess || !loadingState.reddit.isLoading;
      if (chartComplete && redditComplete) {
        setIsRefreshing(false);
      }
    }
  }, [onLoadingProgressChange, isRefreshing, hasChartAccess, hasRedditAccess, loadingState.chart.isLoading, loadingState.reddit.isLoading]);

  // Handle loading updates from reddit component
  const handleRedditLoading = useCallback((
    isLoading: boolean, 
    progress: number, 
    stage: string, 
    data?: any[], 
    error?: string | null
  ) => {
    setLoadingState(prev => ({
      ...prev,
      reddit: { 
        isLoading, 
        needsRefresh: false
      }
    }));
    
    // When loading completes successfully, update data
    if (!isLoading && data) {
      setRedditData(data);
    }
    
    // Update error state if provided
    if (error !== undefined) {
      setErrors(prev => ({ ...prev, reddit: error }));
    }
    
    // Always update progress for loading (to support harvest loading card)
    setLoadingProgress(progress);
    setLoadingStage(stage);
    
    // Propagate to parent component
    if (onLoadingProgressChange) {
      onLoadingProgressChange(progress, stage);
    }

    // Clear refresh state when reddit loading completes
    if (!isLoading && isRefreshing) {
      const chartComplete = !hasChartAccess || !loadingState.chart.isLoading;
      const scoresComplete = !hasScoresAccess || !loadingState.scores.isLoading;
      if (chartComplete && scoresComplete) {
        setIsRefreshing(false);
      }
    }
  }, [onLoadingProgressChange, isRefreshing, hasChartAccess, hasScoresAccess, loadingState.chart.isLoading, loadingState.scores.isLoading]);

  // Handle refresh - triggers reload for all unlocked components
  const handleRefresh = async () => {
    console.log('🔄 SENTIMENT DASHBOARD - Starting refresh cycle...');
    setIsRefreshing(true);
    
    // Mark unlocked components for refresh
    setLoadingState(prev => ({
      chart: {
        isLoading: hasChartAccess,
        needsRefresh: hasChartAccess
      },
      scores: {
        isLoading: hasScoresAccess,
        needsRefresh: hasScoresAccess
      },
      reddit: {
        isLoading: hasRedditAccess,
        needsRefresh: hasRedditAccess
      }
    }));
    
    console.log('🔄 SENTIMENT DASHBOARD - Refresh state set:', {
      hasChartAccess,
      hasScoresAccess,
      hasRedditAccess,
      willRefreshChart: hasChartAccess,
      willRefreshScores: hasScoresAccess,
      willRefreshReddit: hasRedditAccess
    });
  };

  // Auto-end refresh when all components finish loading
  useEffect(() => {
    if (isRefreshing) {
      const chartDone = !loadingState.chart.isLoading;
      const scoresDone = !loadingState.scores.isLoading;
      const redditDone = !loadingState.reddit.isLoading;
      
      // If no components are accessible, end refresh immediately
      if (!hasChartAccess && !hasScoresAccess && !hasRedditAccess) {
        console.log('🔄 SENTIMENT DASHBOARD - No components accessible, ending refresh');
        setIsRefreshing(false);
        return;
      }
      
      if (chartDone && scoresDone && redditDone) {
        console.log('🔄 SENTIMENT DASHBOARD - All accessible components loaded, ending refresh');
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing, loadingState.chart.isLoading, loadingState.scores.isLoading, loadingState.reddit.isLoading, hasChartAccess, hasScoresAccess, hasRedditAccess]);
  
  // Safety mechanism - clear refresh state after 5 seconds maximum
  useEffect(() => {
    if (isRefreshing) {
      const timeout = setTimeout(() => {
        setIsRefreshing(false);
        setLoadingState({
          chart: { isLoading: false, needsRefresh: false },
          scores: { isLoading: false, needsRefresh: false },
          reddit: { isLoading: false, needsRefresh: false }
        });
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [isRefreshing]);

  // Clear fresh unlock flags when loading completes (matching earnings pattern)
  useEffect(() => {
    if (!loadingState.chart.isLoading && isFreshUnlock.chart) {
      console.log('🔄 SENTIMENT DASHBOARD - Clearing chart fresh unlock flag after loading');
      setFreshUnlockState('chart', false);
    }
  }, [loadingState.chart.isLoading, isFreshUnlock.chart, setFreshUnlockState]);

  useEffect(() => {
    if (!loadingState.scores.isLoading && isFreshUnlock.scores) {
      console.log('🔄 SENTIMENT DASHBOARD - Clearing scores fresh unlock flag after loading');
      setFreshUnlockState('scores', false);
    }
  }, [loadingState.scores.isLoading, isFreshUnlock.scores, setFreshUnlockState]);

  useEffect(() => {
    if (!loadingState.reddit.isLoading && isFreshUnlock.reddit) {
      console.log('🔄 SENTIMENT DASHBOARD - Clearing reddit fresh unlock flag after loading');
      setFreshUnlockState('reddit', false);
    }
  }, [loadingState.reddit.isLoading, isFreshUnlock.reddit, setFreshUnlockState]);

  return {
    isRefreshing,
    loadingProgress,
    loadingStage,
    loadingState,
    errors,
    chartData,
    scoresData,
    redditData,
    loadingIsFreshUnlock: isFreshUnlock, // Match SEC/earnings naming convention
    handleChartLoading,
    handleScoresLoading,
    handleRedditLoading,
    handleRefresh,
    setLoadingState,
    setErrors
  };
}; 