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
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      // Add cache-busting query parameter to force fresh request
      const cacheBuster = `?_t=${Date.now()}&_r=${Math.random()}`;
      
      const response = await fetch(`${apiUrl}/api/subscription/tier-info${cacheBuster}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ TierContext: Response error text:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText.substring(0, 200)}...`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('❌ TierContext: Non-JSON response:', responseText.substring(0, 500));
        throw new Error(`Expected JSON response but got ${contentType}: ${responseText.substring(0, 200)}...`);
      }

      const data = await response.json();
      
      console.log('🔍 TierContext: Received data:', data);
      
      if (data.success) {
        console.log('✅ TierContext: Setting tierInfo to:', data.data);
        setTierInfo(data.data);
        console.log('✅ TierContext: tierInfo state should be updated');
      } else {
        console.error('❌ TierContext: API returned success=false:', data);
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
      if (event.detail?.tier) {
        simulateUpgrade(event.detail.tier);
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'tierChanged' || event.key === 'auth_token') {
        refreshTierInfo();
      }
    };

    const handleTierRefresh = () => {
      refreshTierInfo();
    };

    // Add event listeners
    window.addEventListener('tierUpgrade', handleTierUpgrade as EventListener);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('refreshTierInfo', handleTierRefresh);

    // Expose refresh function globally for debugging
    (window as any).refreshTierInfo = refreshTierInfo;
    (window as any).simulateUpgrade = simulateUpgrade;
    
    // Add debug function to check tier data
    (window as any).debugTierInfo = () => {
      // Debug information available in production for troubleshooting
      if (tierInfo) {
        // Production debug function - logs removed
      }
      
      refreshTierInfo();
    };

    return () => {
      window.removeEventListener('tierUpgrade', handleTierUpgrade as EventListener);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('refreshTierInfo', handleTierRefresh);
      delete (window as any).refreshTierInfo;
      delete (window as any).simulateUpgrade;
      delete (window as any).debugTierInfo;
    };
  }, [isAuthenticated, token]);

  // Separate useEffect to track tierInfo changes and expose to window
  useEffect(() => {
    // Expose current tierInfo for debugging and update when it changes
    (window as any).tierInfo = tierInfo;
    console.log('🔍 TierContext: tierInfo state updated:', tierInfo);
    
    // Cleanup on unmount
    return () => {
      delete (window as any).tierInfo;
    };
  }, [tierInfo]); // This runs whenever tierInfo changes

  // Auto-refresh tier info periodically (every 30 seconds)
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const interval = setInterval(() => {
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