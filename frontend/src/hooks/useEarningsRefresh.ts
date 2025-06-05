import { useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';

interface UnlockedComponents {
  earningsAnalysis: boolean;
  upcomingEarnings: boolean;
}

interface EarningsRefreshProps {
  unlockedComponents: UnlockedComponents;
  upcomingEarnings: any[];
  onLoadingProgressChange?: (progress: number, stage: string) => void;
  setIsRefreshing: (value: boolean) => void;
  updateLoadingProgress: (progress: number, stage: string) => void;
  setErrors: (errors: { upcomingEarnings: string | null; analysis: string | null }) => void;
  clearData: () => void;
  setNeedsRefresh: (component: 'upcomingEarnings' | 'earningsAnalysis', value: boolean) => void;
}

export const useEarningsRefresh = ({
  unlockedComponents,
  upcomingEarnings,
  onLoadingProgressChange,
  setIsRefreshing,
  updateLoadingProgress,
  setErrors,
  clearData,
  setNeedsRefresh
}: EarningsRefreshProps) => {
  const { info } = useToast();

  const refreshData = useCallback(async () => {
    // Check if any components are actually unlocked
    const hasUnlockedComponents = unlockedComponents.earningsAnalysis || unlockedComponents.upcomingEarnings;
    
    if (!hasUnlockedComponents) {
      info('Please unlock at least one component before refreshing');
      return;
    }

    setIsRefreshing(true);
    updateLoadingProgress(0, 'Clearing cache...');
    
    try {
      if (onLoadingProgressChange) {
        onLoadingProgressChange(20, 'Clearing cache...');
      }

      // Clear user's specific cache (using appropriate API)
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token');
      
      await fetch(`${proxyUrl}/api/earnings/clear-cache`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(50, 'Cache cleared');
      }

      // Reset errors
      setErrors({
        upcomingEarnings: null,
        analysis: null
      });
      
      // Clear existing data
      clearData();
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(80, 'Triggering refresh...');
      }
      
      // Trigger refresh for unlocked components only
      if (unlockedComponents.upcomingEarnings) {
        setNeedsRefresh('upcomingEarnings', true);
      }
      
      if (unlockedComponents.earningsAnalysis && upcomingEarnings.length > 0) {
        setNeedsRefresh('upcomingEarnings', true);
      }
      
      console.log('🔄 EARNINGS MONITOR - Manual refresh triggered for unlocked components:', {
        upcomingEarnings: unlockedComponents.upcomingEarnings,
        earningsAnalysis: unlockedComponents.earningsAnalysis
      });
      
      if (onLoadingProgressChange) {
        onLoadingProgressChange(100, 'Refresh complete');
      }
    } catch (error) {
      console.error('Error during refresh:', error);
      info('Error refreshing data. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }, [
    unlockedComponents,
    upcomingEarnings.length,
    onLoadingProgressChange,
    setIsRefreshing,
    updateLoadingProgress,
    setErrors,
    clearData,
    setNeedsRefresh,
    info
  ]);

  return { refreshData };
}; 