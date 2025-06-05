import { useState, useCallback } from 'react';
import { EarningsAnalysis } from '../types';
import { fetchEarningsAnalysisWithUserCache } from '../services/earnings';

interface UseEarningsAnalysisProps {
  hasEarningsAnalysisAccess: boolean;
  isFreshUnlock: boolean;
  handleEarningsAnalysisLoading: (
    isLoading: boolean, 
    progress: number, 
    stage: string, 
    data?: EarningsAnalysis, 
    error?: string | null
  ) => void;
  updateLoadingProgress: (progress: number, stage: string) => void;
  setFreshUnlockState: (component: 'earningsAnalysis', value: boolean) => void;
}

export const useEarningsAnalysis = ({
  hasEarningsAnalysisAccess,
  isFreshUnlock,
  handleEarningsAnalysisLoading,
  updateLoadingProgress,
  setFreshUnlockState,
}: UseEarningsAnalysisProps) => {
  // Track which tickers have been analyzed in this session (for visual cache indication)
  const [analyzedTickers, setAnalyzedTickers] = useState<Set<string>>(new Set());

  // Load analysis function
  const loadAnalysis = useCallback(async (ticker: string) => {
    if (!hasEarningsAnalysisAccess) {
      console.log('🔒 EARNINGS TABBED - Access denied for earnings analysis');
      return;
    }

    // Determine appropriate loading UI based on:
    // 1. Fresh unlock (credits spent) → Always harvest loading
    // 2. New ticker (not analyzed in this session) → Harvest loading (likely fresh scraping)
    // 3. Previously analyzed ticker → Simple cache loading
    const isInUnlockFlow = isFreshUnlock;
    const wasAnalyzedBefore = analyzedTickers.has(ticker);
    const shouldShowHarvestLoading = isInUnlockFlow || !wasAnalyzedBefore;
    
    console.log(`🔍 Loading analysis for ${ticker}: isInUnlockFlow=${isInUnlockFlow}, wasAnalyzedBefore=${wasAnalyzedBefore}, showHarvestLoading=${shouldShowHarvestLoading}`);
    
    // Set loading UI based on unlock flow or ticker analysis history
    if (isInUnlockFlow) {
      console.log('🌟 Just unlocked - showing harvest loading card (user spent credits)');
      // Keep isFreshUnlock as set by handleUnlockComponent
      updateLoadingProgress(0, `Analyzing ${ticker} earnings...`);
    } else if (!wasAnalyzedBefore) {
      console.log('🔍 New ticker - likely needs fresh scraping, showing harvest loading card');
      setFreshUnlockState('earningsAnalysis', true);
      updateLoadingProgress(0, `Analyzing ${ticker} earnings...`);
    } else {
      console.log('📦 Previously analyzed ticker - loading from cache with simple loader');
      setFreshUnlockState('earningsAnalysis', false);
      updateLoadingProgress(0, `Loading ${ticker} from cache...`);
    }

    handleEarningsAnalysisLoading(true, 0, `Analyzing ${ticker} earnings...`, undefined, null);
    
    try {
      if (shouldShowHarvestLoading) {
        // Show harvest loading stages for fresh unlocks or new tickers
        handleEarningsAnalysisLoading(true, 10, `Initializing analysis for ${ticker}...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        handleEarningsAnalysisLoading(true, 25, `Fetching company profile for ${ticker}...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        handleEarningsAnalysisLoading(true, 40, `Scraping historical earnings for ${ticker}...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 400));
        
        handleEarningsAnalysisLoading(true, 60, `Processing earnings data for ${ticker}...`, undefined, null);
      } else {
        // Show simple cache loading for previously analyzed tickers
        handleEarningsAnalysisLoading(true, 50, `Loading ${ticker} analysis...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      // Perform the actual API call
      console.log(`🔍 Starting fetchEarningsAnalysisWithUserCache for ${ticker}`);
      const result = await fetchEarningsAnalysisWithUserCache(ticker);
      console.log(`✅ Analysis completed for ${ticker}:`, result);
      
      // Log actual data source for monitoring (no UI changes)
      const isFromCache = result.source === 'cache';
      console.log(`📊 Data source: ${result.source}, fromCache: ${isFromCache}, UI choice: ${shouldShowHarvestLoading ? 'harvest' : 'simple'}, wasAnalyzedBefore: ${wasAnalyzedBefore}`);
      
      // Complete the loading process based on initial UI choice
      if (shouldShowHarvestLoading) {
        // Continue with harvest loading stages
        handleEarningsAnalysisLoading(true, 80, `Computing analysis metrics for ${ticker}...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        handleEarningsAnalysisLoading(true, 95, `Finalizing ${ticker} analysis...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        // Quick completion for cache
        handleEarningsAnalysisLoading(true, 90, `Finalizing ${ticker} analysis...`, undefined, null);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      handleEarningsAnalysisLoading(false, 100, 'Analysis complete!', result.analysis, null);
      
      // Add ticker to analyzed set for future reference
      setAnalyzedTickers(prev => new Set([...prev, ticker]));
      
      // Reset unlock flags after appropriate delay
      const resetDelay = shouldShowHarvestLoading ? 1500 : 100;
      setTimeout(() => {
        setFreshUnlockState('earningsAnalysis', false);
        if (isInUnlockFlow) {
          setFreshUnlockState('earningsAnalysis', false);
        }
      }, resetDelay);
      
    } catch (error) {
      console.error('❌ Earnings analysis error:', error);
      
      // Ensure loading state is properly cleared on error
      handleEarningsAnalysisLoading(false, 0, 'Analysis failed', undefined, String(error) || 'Failed to analyze earnings data');
      
      // Reset unlock flags immediately on error
      setFreshUnlockState('earningsAnalysis', false);
      if (isInUnlockFlow) {
        setFreshUnlockState('earningsAnalysis', false);
      }
      
      // Also reset loading progress explicitly
      updateLoadingProgress(0, 'Analysis failed');
    }
  }, [hasEarningsAnalysisAccess, isFreshUnlock, analyzedTickers, handleEarningsAnalysisLoading, updateLoadingProgress, setFreshUnlockState]);

  return {
    analyzedTickers,
    loadAnalysis,
    setAnalyzedTickers,
  };
}; 