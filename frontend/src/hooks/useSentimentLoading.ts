import { useState, useEffect, useCallback } from 'react';

interface SentimentLoadingState {
  chart: {
    isLoading: boolean;
    needsRefresh: boolean;
  };
  scores: {
    isLoading: boolean;
    needsRefresh: boolean;
  };
  reddit: {
    isLoading: boolean;
    needsRefresh: boolean;
  };
}

interface SentimentErrors {
  chart: string | null;
  scores: string | null;
  reddit: string | null;
}

interface FreshUnlockState {
  chart: boolean;
  scores: boolean;
  reddit: boolean;
}

export const useSentimentLoading = (
  hasChartAccess: boolean,
  hasScoresAccess: boolean,
  hasRedditAccess: boolean,
  onLoadingProgressChange?: (progress: number, stage: string) => void
) => {
  // Loading state for each component - Start with loading = true to prevent empty state flash
  const [loadingState, setLoadingState] = useState<SentimentLoadingState>({
    chart: { isLoading: true, needsRefresh: false },
    scores: { isLoading: true, needsRefresh: false },
    reddit: { isLoading: true, needsRefresh: false }
  });

  // Progress tracking
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');

  // Fresh unlock state (for showing harvest loading)
  const [isFreshUnlock, setIsFreshUnlock] = useState<FreshUnlockState>({
    chart: false,
    scores: false,
    reddit: false
  });

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Error states
  const [errors, setErrors] = useState<SentimentErrors>({
    chart: null,
    scores: null,
    reddit: null
  });

  // Data states - managed at this level
  const [chartData, setChartData] = useState<any[]>([]);
  const [sentimentScores, setSentimentScores] = useState<any[]>([]);
  const [redditPosts, setRedditPosts] = useState<any[]>([]);

  // Progress update handler
  const updateLoadingProgress = useCallback((progress: number, stage: string) => {
    setLoadingProgress(progress);
    setLoadingStage(stage);
    onLoadingProgressChange?.(progress, stage);
  }, [onLoadingProgressChange]);

  // Component loading handlers
  const handleChartLoading = useCallback((isLoading: boolean, error?: string | null) => {
    setLoadingState(prev => ({
      ...prev,
      chart: { ...prev.chart, isLoading }
    }));
    
    if (error !== undefined) {
      setErrors(prev => ({ ...prev, chart: error }));
    }
  }, []);

  const handleScoresLoading = useCallback((isLoading: boolean, error?: string | null) => {
    setLoadingState(prev => ({
      ...prev,
      scores: { ...prev.scores, isLoading }
    }));
    
    if (error !== undefined) {
      setErrors(prev => ({ ...prev, scores: error }));
    }
  }, []);

  const handleRedditLoading = useCallback((isLoading: boolean, error?: string | null) => {
    setLoadingState(prev => ({
      ...prev,
      reddit: { ...prev.reddit, isLoading }
    }));
    
    if (error !== undefined) {
      setErrors(prev => ({ ...prev, reddit: error }));
    }
  }, []);

  // Set fresh unlock state
  const setFreshUnlockState = useCallback((component: keyof FreshUnlockState, value: boolean) => {
    setIsFreshUnlock(prev => ({
      ...prev,
      [component]: value
    }));
  }, []);

  // Clear all data
  const clearData = useCallback(() => {
    setChartData([]);
    setSentimentScores([]);
    setRedditPosts([]);
  }, []);

  // Set needs refresh for a component
  const setNeedsRefresh = useCallback((component: keyof SentimentLoadingState, value: boolean) => {
    setLoadingState(prev => ({
      ...prev,
      [component]: { ...prev[component], needsRefresh: value }
    }));
  }, []);

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

  return {
    // State
    loadingState,
    loadingProgress,
    loadingStage,
    isFreshUnlock,
    isRefreshing,
    errors,
    
    // Data
    chartData,
    sentimentScores,
    redditPosts,
    
    // Setters
    setIsRefreshing,
    setLoadingState,
    setChartData,
    setSentimentScores,
    setRedditPosts,
    setErrors,
    
    // Handlers
    handleChartLoading,
    handleScoresLoading,
    handleRedditLoading,
    updateLoadingProgress,
    setFreshUnlockState,
    clearData,
    setNeedsRefresh,
    handleRefresh,
  };
}; 