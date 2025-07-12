import { useState, useEffect } from 'react';
import { useTier } from '../contexts/TierContext';
import { useTierLimits } from './useTierLimits';
import { useToast } from '../contexts/ToastContext';
import { 
  storeUnlockSession, 
  getAllUnlockSessions,
  checkComponentAccess,
  getSessionTimeRemainingFormatted
} from '../utils/sessionStorage';
import { getApiUrlClient } from '../services/apiService';

interface FreshUnlockState {
  earningsAnalysis: boolean;
  upcomingEarnings: boolean;
}

// Credit costs for each component
const COMPONENT_COSTS = {
  earningsAnalysis: 8,
  upcomingEarnings: 12,
};

export const useEarningsUnlock = () => {
  const { tierInfo, refreshTierInfo } = useTier();
  const { showTierLimitDialog } = useTierLimits();
  const { info, warning } = useToast();
  
  // Get tier info
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  
  // Add state to prevent double-clicking and race conditions
  const [isUnlocking, setIsUnlocking] = useState<Record<string, boolean>>({});
  
  // Component unlock state - managed by sessions
  const [unlockedComponents, setUnlockedComponents] = useState<{
    earningsAnalysis: boolean;
    upcomingEarnings: boolean;
  }>({
    earningsAnalysis: false,
    upcomingEarnings: false
  });

  // Session state for time tracking
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  
  // Add state to track when we're checking sessions (prevents locked overlay flash)
  const [isCheckingSessions, setIsCheckingSessions] = useState(true);

  // Track fresh unlocks vs cache loads for appropriate loading UI
  const [isFreshUnlock, setIsFreshUnlock] = useState<FreshUnlockState>({
    earningsAnalysis: false,
    upcomingEarnings: false
  });

  // Check existing sessions for all users
  useEffect(() => {
    if (!tierInfo) return;
    
    const checkExistingSessions = async () => {
      setIsCheckingSessions(true);
      try {
        const currentTierValue = tierInfo?.tier?.toLowerCase() || 'free';
        const earningsAnalysisSession = await checkComponentAccess('earningsAnalysis', currentTierValue);
        const upcomingEarningsSession = await checkComponentAccess('upcomingEarnings', currentTierValue);

        const newUnlockedState = {
          earningsAnalysis: !!earningsAnalysisSession,
          upcomingEarnings: !!upcomingEarningsSession
        };

        setUnlockedComponents(newUnlockedState);

        const sessions = await getAllUnlockSessions(currentTierValue);
        setActiveSessions(sessions);
        
        console.log('🔍 EARNINGS UNLOCK HOOK - Component access check:', {
          earningsAnalysis: !!earningsAnalysisSession,
          upcomingEarnings: !!upcomingEarningsSession,
          currentTier: currentTierValue,
          databaseSessions: sessions.length,
          timestamp: Date.now() // Add timestamp to track when checks happen
        });
      } catch (error) {
        console.warn('Database session check failed:', error);
        setUnlockedComponents({
          earningsAnalysis: false,
          upcomingEarnings: false
        });
        setActiveSessions([]);
      } finally {
        setIsCheckingSessions(false);
      }
    };

    checkExistingSessions();
    const interval = setInterval(checkExistingSessions, 120000); // Cut frequency in half: was 60s, now 120s
    return () => clearInterval(interval);
  }, [tierInfo]); // Remove currentTier dependency since it's derived from tierInfo

  // Handle component unlock
  const handleUnlockComponent = async (component: keyof typeof unlockedComponents, cost: number) => {
    // Prevent double-clicking and race conditions
    if (isUnlocking[component]) {
      console.log(`🔒 ${component} unlock already in progress, ignoring request`);
      return;
    }
    
    setIsUnlocking(prev => ({ ...prev, [component]: true }));
    
    try {
      // Check if already unlocked using database-only approach
      const existingSession = await checkComponentAccess(component, currentTier);
      if (existingSession) {
        const timeRemaining = getSessionTimeRemainingFormatted(existingSession);
        info(`${component} already unlocked (${timeRemaining}h remaining)`);
        return {
          success: true,
          isExistingSession: true,
          isFreshUnlock: false
        };
      }
      
      const apiUrl = getApiUrlClient();
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${apiUrl}/api/credits/unlock-component`, {
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
        
        // Update active sessions by querying database
        const sessions = await getAllUnlockSessions(currentTier);
        setActiveSessions(sessions);
        
        // Set fresh unlock state based on whether this is a new unlock or existing session
        const isFreshUnlockValue = !data.existingSession;
        setIsFreshUnlock(prev => ({
          ...prev,
          [component]: isFreshUnlockValue
        }));
        
        // Show appropriate toast message
        if (data.existingSession) {
          info(`${component} already unlocked (${data.timeRemaining}h remaining)`);
        } else {
          info(`${data.creditsUsed} credits used`);
        }
        
        // Refresh tier info to update usage meter
        if (refreshTierInfo) {
          await refreshTierInfo();
        }
        
        return {
          success: true,
          isExistingSession: data.existingSession,
          isFreshUnlock: isFreshUnlockValue
        };
      }
      
    } catch (error) {
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
      
      return {
        success: false,
        isExistingSession: false,
        isFreshUnlock: false
      };
    } finally {
      // Always reset the locking state
      setIsUnlocking(prev => ({ ...prev, [component]: false }));
    }
  };

  // Helper to set fresh unlock state (for cleanup after component loading)
  const setFreshUnlockState = (component: keyof FreshUnlockState, value: boolean) => {
    setIsFreshUnlock(prev => ({
      ...prev,
      [component]: value
    }));
  };

  // Calculate component access state based on sessions
  const hasEarningsAnalysisAccess = unlockedComponents.earningsAnalysis;
  const hasUpcomingEarningsAccess = unlockedComponents.upcomingEarnings;

  return {
    // State
    unlockedComponents,
    activeSessions,
    isCheckingSessions,
    isUnlocking,
    isFreshUnlock,
    currentTier,
    
    // Computed values
    hasEarningsAnalysisAccess,
    hasUpcomingEarningsAccess,
    
    // Functions
    handleUnlockComponent,
    setFreshUnlockState,
    
    // Constants
    COMPONENT_COSTS,
  };
}; 