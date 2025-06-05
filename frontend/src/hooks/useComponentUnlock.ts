import { useState, useEffect } from 'react';
import { useTier } from '../contexts/TierContext';
import { useToast } from '../contexts/ToastContext';
import { 
  checkComponentAccess, 
  storeUnlockSession, 
  getAllUnlockSessions,
  getSessionTimeRemainingFormatted,
  clearComponentAccessCache
} from '../utils/sessionStorage';

export interface ComponentUnlockState {
  [key: string]: boolean;
}

export interface UnlockSession {
  sessionId: string;
  expiresAt: string;
  creditsUsed: number;
  tier: string;
}

interface UseComponentUnlockConfig {
  componentKeys: string[];
  onUnlockSuccess?: (component: string, data: any) => void;
}

export const useComponentUnlock = (config: UseComponentUnlockConfig) => {
  const { tierInfo, refreshTierInfo } = useTier();
  const { info } = useToast();
  
  const [unlockedComponents, setUnlockedComponents] = useState<ComponentUnlockState>(() => {
    const initialState: ComponentUnlockState = {};
    config.componentKeys.forEach(key => {
      initialState[key] = false;
    });
    return initialState;
  });
  
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [isCheckingSessions, setIsCheckingSessions] = useState(true);
  
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';
  
  // Check existing sessions for all components
  const checkExistingSessions = async () => {
    if (!tierInfo) return;
    
    try {
      setIsCheckingSessions(true);
      
      const sessionChecks = await Promise.all(
        config.componentKeys.map(async (component) => {
          const session = await checkComponentAccess(component, currentTier);
          return { component, hasSession: !!session };
        })
      );
      
      const newUnlockedState: ComponentUnlockState = {};
      sessionChecks.forEach(({ component, hasSession }) => {
        newUnlockedState[component] = hasSession;
      });
      
      setUnlockedComponents(newUnlockedState);
      
      // Update active sessions for display
      const sessions = await getAllUnlockSessions(currentTier);
      setActiveSessions(sessions);
      
      console.log('🔍 COMPONENT UNLOCK HOOK - Session check:', {
        currentTier,
        unlockedComponents: newUnlockedState,
        databaseSessions: sessions.length
      });
      
    } catch (error) {
      console.warn('Database session check failed:', error);
      // Reset to false if database fails
      const resetState: ComponentUnlockState = {};
      config.componentKeys.forEach(key => {
        resetState[key] = false;
      });
      setUnlockedComponents(resetState);
      setActiveSessions([]);
    } finally {
      setIsCheckingSessions(false);
    }
  };
  
  // Effect to check sessions on mount and tier changes
  useEffect(() => {
    checkExistingSessions();
    
    // Check for expired sessions every minute
    const interval = setInterval(checkExistingSessions, 60000);
    return () => clearInterval(interval);
  }, [tierInfo, currentTier]);
  
  // Handle component unlock
  const handleUnlockComponent = async (component: string, cost: number) => {
    // Check if already unlocked
    const existingSession = await checkComponentAccess(component, currentTier);
    if (existingSession) {
      const timeRemaining = getSessionTimeRemainingFormatted(existingSession);
      info(`${component} already unlocked (${timeRemaining})`);
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
        // Clear cache for this component to get fresh data
        clearComponentAccessCache(component);
        
        // Update component state
        setUnlockedComponents(prev => ({
          ...prev,
          [component]: true
        }));
        
        // Store session in localStorage for backward compatibility
        storeUnlockSession(component, {
          sessionId: data.sessionId,
          expiresAt: data.expiresAt,
          creditsUsed: data.creditsUsed,
          tier: tierInfo?.tier || 'free'
        });
        
        // Update active sessions
        const sessions = await getAllUnlockSessions(currentTier);
        setActiveSessions(sessions);
        
        // Show appropriate toast message
        if (data.existingSession) {
          info(`${component} already unlocked (${data.timeRemaining}h remaining)`);
        } else {
          info(`${data.creditsUsed} credits used`);
        }
        
        // Call success callback if provided
        if (config.onUnlockSuccess) {
          config.onUnlockSuccess(component, data);
        }
        
        // Refresh tier info to update usage meter
        if (refreshTierInfo) {
          await refreshTierInfo();
        }
      }
      
    } catch (error) {
      console.error('Component unlock error:', error);
      info(`Failed to unlock ${component}. Please try again.`);
    }
  };
  
  return {
    unlockedComponents,
    activeSessions,
    isCheckingSessions,
    currentTier,
    handleUnlockComponent,
    refreshSessions: checkExistingSessions
  };
}; 