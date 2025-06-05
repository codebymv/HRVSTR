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
    const interval = setInterval(checkExistingSessions, 60000);
    return () => clearInterval(interval);
  }, [tierInfo]); // Remove currentTier dependency since it's derived from tierInfo

  // Handle component unlock
  const handleUnlockComponent = async (component: keyof typeof unlockedComponents, cost: number) => {
    // Check if already unlocked using database-only approach
    const existingSession = await checkComponentAccess(component, currentTier);
    if (existingSession) {
      const timeRemaining = getSessionTimeRemainingFormatted(existingSession);
      info(`${component} already unlocked (${timeRemaining}h remaining)`);
      return;
    }
    
    try {
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
        throw new Error(data.error || 'Failed to unlock component');
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
          isFreshUnlock: !data.existingSession
        };
      }
      
    } catch (error) {
      info(`Failed to unlock ${component}. Please try again.`);
      return {
        success: false,
        isExistingSession: false,
        isFreshUnlock: false
      };
    }
  };

  // Calculate component access state based on sessions
  const hasEarningsAnalysisAccess = unlockedComponents.earningsAnalysis;
  const hasUpcomingEarningsAccess = unlockedComponents.upcomingEarnings;

  return {
    // State
    unlockedComponents,
    activeSessions,
    isCheckingSessions,
    currentTier,
    
    // Computed values
    hasEarningsAnalysisAccess,
    hasUpcomingEarningsAccess,
    
    // Functions
    handleUnlockComponent,
    
    // Constants
    COMPONENT_COSTS,
  };
}; 