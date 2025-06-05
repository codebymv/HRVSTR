import { useState } from 'react';
import { clearSecCache, clearUserSecCache } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type TimeRange = '1w' | '1m' | '3m' | '6m';

interface LoadingState {
  insiderTrades: { isLoading: boolean; needsRefresh: boolean };
  institutionalHoldings: { isLoading: boolean; needsRefresh: boolean };
}

interface SECTimeRangeProps {
  hasInsiderAccess: boolean;
  hasInstitutionalAccess: boolean;
  setLoadingState: React.Dispatch<React.SetStateAction<LoadingState>>;
}

export const useSECTimeRange = ({ 
  hasInsiderAccess, 
  hasInstitutionalAccess, 
  setLoadingState 
}: SECTimeRangeProps) => {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('1m');

  // Handle time range changes - clear cache and reload accessible components
  const handleTimeRangeChange = (range: TimeRange) => {
    console.log('📅 SEC DASHBOARD - Time range changed:', { from: timeRange, to: range });
    setTimeRange(range);
    
    // Clear cache for fresh data
    clearSecCache();
    if (user?.id) {
      clearUserSecCache(user.id);
    }
    
    // Mark unlocked components for refresh with new time range
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
    
    console.log('📅 SEC DASHBOARD - Components marked for refresh:', {
      hasInsiderAccess,
      hasInstitutionalAccess,
      willRefreshInsider: hasInsiderAccess,
      willRefreshInstitutional: hasInstitutionalAccess
    });
  };

  return {
    timeRange,
    handleTimeRangeChange
  };
}; 