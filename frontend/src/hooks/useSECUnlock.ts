import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useTier } from '../contexts/TierContext';
import { 
  checkComponentAccess, 
  storeUnlockSession, 
  getAllUnlockSessions,
  getSessionTimeRemainingFormatted,
  clearComponentAccessCache
} from '../utils/sessionStorage';

interface UnlockedComponents {
  insiderTrading: boolean;
  institutionalHoldings: boolean;
}

interface FreshUnlockState {
  insiderTrades: boolean;
  institutionalHoldings: boolean;
}

const COMPONENT_COSTS = {
  insiderTrading: 10,        // Insider trading data
  institutionalHoldings: 15, // Institutional holdings data
};

export const useSECUnlock = () => {
  const { info, warning } = useToast();
  const { tierInfo, refreshTierInfo } = useTier();

  // Component unlock state - managed by sessions
  const [unlockedComponents, setUnlockedComponents] = useState<UnlockedComponents>({
    insiderTrading: false,
    institutionalHoldings: false
  });

  // Session state for time tracking
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  // Track fresh unlocks vs cache loads for appropriate loading UI
  const [isFreshUnlock, setIsFreshUnlock] = useState<FreshUnlockState>({
    insiderTrades: false,
    institutionalHoldings: false
  });

  // Get tier info
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';

  // Check existing sessions for all users
  useEffect(() => {
    if (!tierInfo) return;
    
    const checkExistingSessions = async () => {
      try {
        // Use database-only checking - no more localStorage fallback
        const currentTierValue = tierInfo?.tier?.toLowerCase() || 'free';
        const insiderSession = await checkComponentAccess('insiderTrading', currentTierValue);
        const institutionalSession = await checkComponentAccess('institutionalHoldings', currentTierValue);

        const newUnlockedState = {
          insiderTrading: !!insiderSession,
          institutionalHoldings: !!institutionalSession
        };

        // Log session restoration scenarios
        if (!unlockedComponents.institutionalHoldings && newUnlockedState.institutionalHoldings) {
          if (institutionalSession) {
            console.log('🎉 SEC DASHBOARD - Institutional holdings session restored from database!');
          }
        }

        setUnlockedComponents(newUnlockedState);

        // Update active sessions for display - NOW QUERIES DATABASE ONLY
        const sessions = await getAllUnlockSessions(currentTierValue);
        setActiveSessions(sessions);
        
        console.log('🔍 SEC DASHBOARD - Component access check (DATABASE ONLY):', {
          insiderTrading: !!insiderSession,
          institutionalHoldings: !!institutionalSession,
          insiderSessionId: insiderSession?.sessionId,
          institutionalSessionId: institutionalSession?.sessionId,
          currentTier: currentTierValue,
          databaseSessions: sessions.length,
          timestamp: Date.now()
        });
      } catch (error) {
        console.warn('Database session check failed:', error);
        // No more localStorage fallback - just set to false if database fails
        setUnlockedComponents({
          insiderTrading: false,
          institutionalHoldings: false
        });

        setActiveSessions([]);
      }
    };

    // Check sessions immediately
    checkExistingSessions();
    
    // Check for expired sessions every minute
    const interval = setInterval(checkExistingSessions, 120000); // Cut frequency in half: was 60s, now 120s
    return () => clearInterval(interval);
  }, [tierInfo]);

  // Handlers for unlocking individual components
  const handleUnlockComponent = async (component: keyof UnlockedComponents, cost: number) => {
    try {
      // Check if already unlocked using database-only approach
      const existingSession = await checkComponentAccess(component, currentTier);
      if (existingSession) {
        const timeRemaining = getSessionTimeRemainingFormatted(existingSession);
        info(`${component} already unlocked (${timeRemaining})`);
        return;
      }
      
      const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${proxyUrl}/api/credits/unlock-component`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          component,
          cost
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Create an error with the response status for better error handling
        const error = new Error(data.error || 'Failed to unlock component');
        (error as any).status = response.status;
        (error as any).data = data;
        throw error;
      }
      
      if (data.success) {
        // RATE LIMITING FIX: Clear cache for this component to get fresh data
        clearComponentAccessCache(component);
        
        // Update component state
        setUnlockedComponents(prev => ({
          ...prev,
          [component]: true
        }));
        
        // Store session in localStorage for backward compatibility only
        storeUnlockSession(component, {
          sessionId: data.sessionId,
          expiresAt: data.expiresAt,
          creditsUsed: data.creditsUsed,
          tier: tierInfo?.tier || 'free'
        });
        
        // Update active sessions
        const sessions = await getAllUnlockSessions(currentTier);
        setActiveSessions(sessions);
        
        // Show appropriate toast message and track unlock type
        if (data.existingSession) {
          info(`${component} already unlocked (${data.timeRemaining}h remaining)`);
          // This is a cache load, not a fresh unlock
          setIsFreshUnlock(prev => ({
            ...prev,
            [component]: false
          }));
        } else {
          info(`${data.creditsUsed} credits used`);
          // This is a fresh unlock with credits spent - show harvest loading
          setIsFreshUnlock(prev => ({
            ...prev,
            [component]: true
          }));
        }
        
        // Refresh tier info to update usage meter
        if (refreshTierInfo) {
          await refreshTierInfo();
        }
      }
      
    } catch (error) {
      console.error('SEC unlock error:', error);
      
      // Handle different types of errors with specific messages
      const errorStatus = (error as any)?.status;
      const errorData = (error as any)?.data;
      
             if (errorStatus === 402) {
         const remainingCredits = errorData?.remaining ?? errorData?.remainingCredits ?? 0;
         const requiredCredits = errorData?.required ?? errorData?.requiredCredits ?? cost;
         warning(
           `Insufficient credits! You need ${requiredCredits} credits but only have ${remainingCredits} remaining.`, 
           8000, 
           {
             clickable: true,
             linkTo: '/settings/usage'
           }
         );
       } else if (errorStatus === 401) {
        warning('Please log in to unlock components.');
      } else if (errorStatus === 403) {
        warning('Access denied. This feature may not be available for your tier.');
      } else {
        info(`Failed to unlock ${component}. Please try again.`);
      }
    }
  };

  // Helper to set fresh unlock state (for cleanup after component loading)
  const setFreshUnlockState = (component: keyof FreshUnlockState, value: boolean) => {
    setIsFreshUnlock(prev => ({
      ...prev,
      [component]: value
    }));
  };

  // Calculate component access state based on sessions (not tier)
  const hasInsiderAccess = unlockedComponents.insiderTrading;
  const hasInstitutionalAccess = unlockedComponents.institutionalHoldings;
  
  console.log('🔐 SEC DASHBOARD - Access state:', {
    currentTier,
    hasInsiderAccess,
    hasInstitutionalAccess,
    unlockedComponents
  });

  return {
    unlockedComponents,
    activeSessions,
    isFreshUnlock,
    currentTier,
    hasInsiderAccess,
    hasInstitutionalAccess,
    COMPONENT_COSTS,
    handleUnlockComponent,
    setFreshUnlockState
  };
};