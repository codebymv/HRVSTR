import { useState, useEffect } from 'react';

interface LoadingState {
  insiderTrades: { isLoading: boolean; needsRefresh: boolean };
  institutionalHoldings: { isLoading: boolean; needsRefresh: boolean };
}

interface FreshUnlockState {
  insiderTrading: boolean;
  institutionalHoldings: boolean;
}

interface SECLoadingProps {
  onLoadingProgressChange?: (progress: number, stage: string) => void;
  hasInsiderAccess: boolean;
  hasInstitutionalAccess: boolean;
  isFreshUnlock: FreshUnlockState;
  setFreshUnlockState: (component: keyof FreshUnlockState, value: boolean) => void;
}

export const useSECLoading = ({ 
  onLoadingProgressChange, 
  hasInsiderAccess, 
  hasInstitutionalAccess,
  isFreshUnlock,
  setFreshUnlockState
}: SECLoadingProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  
  // Loading states for components
  const [loadingState, setLoadingState] = useState<LoadingState>({
    insiderTrades: { isLoading: false, needsRefresh: false },
    institutionalHoldings: { isLoading: false, needsRefresh: false }
  });

  // Error states
  const [errors, setErrors] = useState<{
    insiderTrades: string | null;
    institutionalHoldings: string | null;
  }>({
    insiderTrades: null,
    institutionalHoldings: null
  });

  // Data states - no longer stored in localStorage
  const [insiderTradesData, setInsiderTradesData] = useState<any[]>([]);
  const [institutionalHoldingsData, setInstitutionalHoldingsData] = useState<any[]>([]);

  // Handle loading updates from insider trades tab
  const handleInsiderTradesLoading = (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => {
    setLoadingState(prev => ({
      ...prev,
      insiderTrades: { 
        isLoading, 
        needsRefresh: false
      }
    }));
    
    // When loading completes successfully, update data
    if (!isLoading && data) {
      setInsiderTradesData(data);
    }
    
    // Update error state if provided
    if (error !== undefined) {
      setErrors(prev => ({ ...prev, insiderTrades: error }));
    }
    
    // Only update overall progress if this is the active tab
    setLoadingProgress(progress);
    setLoadingStage(stage);
    
    // Propagate loading progress changes to parent
    if (onLoadingProgressChange) {
      onLoadingProgressChange(progress, stage);
    }
  };

  // Handle loading updates from institutional holdings tab
  const handleInstitutionalHoldingsLoading = (isLoading: boolean, progress: number, stage: string, data?: any[], error?: string | null) => {
    setLoadingState(prev => ({
      ...prev,
      institutionalHoldings: { 
        isLoading, 
        needsRefresh: false
      }
    }));
    
    // When loading completes successfully, update data
    if (!isLoading && data) {
      setInstitutionalHoldingsData(data);
    }
    
    // Update error state if provided
    if (error !== undefined) {
      setErrors(prev => ({ ...prev, institutionalHoldings: error }));
    }
    
    // Only update overall progress if this is the active tab
    setLoadingProgress(progress);
    setLoadingStage(stage);
    
    // Propagate loading progress changes to parent
    if (onLoadingProgressChange) {
      onLoadingProgressChange(progress, stage);
    }
  };

  // Handle refresh - triggers reload for all unlocked components
  const handleRefresh = async () => {
    console.log('🔄 SEC DASHBOARD - Starting refresh cycle...');
    setIsRefreshing(true);
    
    // Mark unlocked components for refresh
    setLoadingState(prev => ({
      insiderTrades: {
        isLoading: hasInsiderAccess,
        needsRefresh: hasInsiderAccess
      },
      institutionalHoldings: {
        isLoading: hasInstitutionalAccess,
        needsRefresh: hasInstitutionalAccess
      }
    }));
    
    console.log('🔄 SEC DASHBOARD - Refresh state set:', {
      hasInsiderAccess,
      hasInstitutionalAccess,
      willRefreshInsider: hasInsiderAccess,
      willRefreshInstitutional: hasInstitutionalAccess
    });
  };

  // Auto-end refresh when all components finish loading
  useEffect(() => {
    if (isRefreshing) {
      const insiderDone = !loadingState.insiderTrades.isLoading;
      const institutionalDone = !loadingState.institutionalHoldings.isLoading;
      
      // If no components are accessible, end refresh immediately
      if (!hasInsiderAccess && !hasInstitutionalAccess) {
        console.log('🔄 SEC DASHBOARD - No components accessible, ending refresh');
        setIsRefreshing(false);
        return;
      }
      
      if (insiderDone && institutionalDone) {
        console.log('🔄 SEC DASHBOARD - All accessible components loaded, ending refresh');
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing, loadingState.insiderTrades.isLoading, loadingState.institutionalHoldings.isLoading, hasInstitutionalAccess, hasInsiderAccess]);
  
  // Safety mechanism - clear refresh state after 5 seconds maximum
  useEffect(() => {
    if (isRefreshing) {
      const timeout = setTimeout(() => {
        setIsRefreshing(false);
        setLoadingState({
          insiderTrades: { isLoading: false, needsRefresh: false },
          institutionalHoldings: { isLoading: false, needsRefresh: false }
        });
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [isRefreshing]);

  // Clear fresh unlock flags when loading completes (matching earnings pattern)
  useEffect(() => {
    if (!loadingState.insiderTrades.isLoading && isFreshUnlock.insiderTrading) {
      console.log('🔄 SEC DASHBOARD - Clearing insider trading fresh unlock flag after loading');
      setFreshUnlockState('insiderTrading', false);
    }
  }, [loadingState.insiderTrades.isLoading, isFreshUnlock.insiderTrading, setFreshUnlockState]);

  useEffect(() => {
    if (!loadingState.institutionalHoldings.isLoading && isFreshUnlock.institutionalHoldings) {
      console.log('🔄 SEC DASHBOARD - Clearing institutional holdings fresh unlock flag after loading');
      setFreshUnlockState('institutionalHoldings', false);
    }
  }, [loadingState.institutionalHoldings.isLoading, isFreshUnlock.institutionalHoldings, setFreshUnlockState]);

  return {
    isRefreshing,
    loadingProgress,
    loadingStage,
    loadingState,
    errors,
    insiderTradesData,
    institutionalHoldingsData,
    isFreshUnlock,
    handleInsiderTradesLoading,
    handleInstitutionalHoldingsLoading,
    handleRefresh,
    setLoadingState,
    setErrors
  };
}; 