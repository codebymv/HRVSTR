import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface TierLimits {
  watchlistLimit: number;
  monthlyCredits: number;
  features: string[];
  historyDays: number;
}

interface TierInfo {
  tier: string;
  credits: {
    remaining: number;
    monthly: number;
    resetDate: string;
    daysUntilReset?: number;
  };
  limits: TierLimits;
  features: string[];
  usage?: {
    watchlist: {
      current: number;
      limit: number;
    };
  };
}

interface TierContextType {
  tierInfo: TierInfo | null;
  loading: boolean;
  error: string | null;
  refreshTierInfo: () => Promise<void>;
  simulateUpgrade: (tier: string) => Promise<boolean>;
  addCredits: (amount: number) => Promise<boolean>;
}

const TierContext = createContext<TierContextType | undefined>(undefined);

export const TierProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTierInfo = async () => {
    if (!isAuthenticated || !token) {
      setTierInfo(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/subscription/tier-info', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setTierInfo(data.data);
        console.log('✅ TierContext: Updated to', data.data.tier, 'tier');
      } else {
        throw new Error(data.error || 'Failed to fetch tier info');
      }
    } catch (err) {
      console.error('Error fetching tier info:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tier information');
    } finally {
      setLoading(false);
    }
  };

  const simulateUpgrade = async (tier: string): Promise<boolean> => {
    if (!isAuthenticated || !token) return false;

    try {
      setLoading(true);
      const response = await fetch('/api/subscription/simulate-upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();
      if (data.success) {
        setTierInfo(data.data);
        console.log('✅ TierContext: Upgraded to', tier, 'tier via simulateUpgrade');
        
        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('tierChanged', {
          detail: { tier, tierInfo: data.data }
        }));
        
        return true;
      } else {
        setError(data.error || 'Failed to upgrade tier');
        return false;
      }
    } catch (err) {
      console.error('Error upgrading tier:', err);
      setError(err instanceof Error ? err.message : 'Failed to upgrade tier');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const addCredits = async (amount: number): Promise<boolean> => {
    if (!isAuthenticated || !token) return false;

    try {
      const response = await fetch('/api/subscription/add-credits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();
      if (data.success) {
        setTierInfo(data.data);
        return true;
      } else {
        setError(data.error || 'Failed to add credits');
        return false;
      }
    } catch (err) {
      console.error('Error adding credits:', err);
      setError(err instanceof Error ? err.message : 'Failed to add credits');
      return false;
    }
  };

  // Load tier info when auth status changes
  useEffect(() => {
    if (isAuthenticated && token) {
      refreshTierInfo();
    } else {
      setTierInfo(null);
    }
  }, [isAuthenticated, token]);

  // Listen for external tier change events
  useEffect(() => {
    const handleTierUpgrade = (event: CustomEvent) => {
      console.log('🔔 TierContext: Received tierUpgrade event', event.detail);
      if (event.detail?.tier) {
        simulateUpgrade(event.detail.tier);
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'tierChanged' || event.key === 'auth_token') {
        console.log('🔔 TierContext: Storage changed, refreshing tier info');
        refreshTierInfo();
      }
    };

    const handleTierRefresh = () => {
      console.log('🔔 TierContext: Manual refresh requested');
      refreshTierInfo();
    };

    // Add event listeners
    window.addEventListener('tierUpgrade', handleTierUpgrade as EventListener);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('refreshTierInfo', handleTierRefresh);

    // Expose refresh function globally for debugging
    (window as any).refreshTierInfo = refreshTierInfo;
    (window as any).simulateUpgrade = simulateUpgrade;

    return () => {
      window.removeEventListener('tierUpgrade', handleTierUpgrade as EventListener);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('refreshTierInfo', handleTierRefresh);
      delete (window as any).refreshTierInfo;
      delete (window as any).simulateUpgrade;
    };
  }, [isAuthenticated, token]);

  // Auto-refresh tier info periodically (every 30 seconds)
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const interval = setInterval(() => {
      console.log('🔄 TierContext: Auto-refreshing tier info');
      refreshTierInfo();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, token]);

  const value = {
    tierInfo,
    loading,
    error,
    refreshTierInfo,
    simulateUpgrade,
    addCredits,
  };

  return (
    <TierContext.Provider value={value}>
      {children}
    </TierContext.Provider>
  );
};

export const useTier = () => {
  const context = useContext(TierContext);
  if (context === undefined) {
    throw new Error('useTier must be used within a TierProvider');
  }
  return context;
}; 