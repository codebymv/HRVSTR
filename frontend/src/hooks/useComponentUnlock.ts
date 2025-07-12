import { useState, useEffect, useRef } from 'react';
import { useTier } from '../contexts/TierContext';
import { useToast } from '../contexts/ToastContext';
import { useSessionExpirationNotifications } from './useSessionExpirationNotifications';
import { 
  checkComponentAccess, 
  storeUnlockSession, 
  getAllUnlockSessions,
  getSessionTimeRemainingFormatted,
  clearComponentAccessCache
} from '../utils/sessionStorage';
import { getApiUrlClient } from '../services/apiService';

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
  onSessionExpired?: (component: string) => void;
  enableExpirationNotifications?: boolean;
}

export const useComponentUnlock = (config: UseComponentUnlockConfig) => {
  const { tierInfo, refreshTierInfo } = useTier();
  const { info, warning } = useToast();
  
  // Enable global expiration notifications (backend-based)
  useSessionExpirationNotifications({
    enabled: config.enableExpirationNotifications !== false
  });
  
  const [unlockedComponents, setUnlockedComponents] = useState<ComponentUnlockState>(() => {
    const initialState: ComponentUnlockState = {};
    config.componentKeys.forEach(key => {
      initialState[key] = false;
    });
    return initialState;
  });
  
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [isCheckingSessions, setIsCheckingSessions] = useState(true);
  
  // Track previous unlock states to detect transitions from unlocked to locked (fallback detection)
  const previousUnlockedState = useRef<ComponentUnlockState>({});
  const isInitialLoad = useRef(true);
  
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
      
      // Fallback detection: Check for local state transitions (only as backup)
      // The primary expiration detection is now handled by useSessionExpirationNotifications
      if (!isInitialLoad.current) {
        config.componentKeys.forEach(component => {
          const wasUnlocked = previousUnlockedState.current[component];
          const isUnlocked = newUnlockedState[component];
          
          // Component was unlocked but is now locked = session expired (fallback detection)
          if (wasUnlocked && !isUnlocked) {
            console.log(`🔒 Local expiration detected for component: ${component} (fallback)`);
            
            // Call optional callback (backend notifications are primary)
            if (config.onSessionExpired) {
              config.onSessionExpired(component);
            }
          }
        });
      }
      
      // Update state and track previous state
      previousUnlockedState.current = { ...newUnlockedState };
      setUnlockedComponents(newUnlockedState);
      
      // Update active sessions for display
      const sessions = await getAllUnlockSessions(currentTier);
      setActiveSessions(sessions);
      
      console.log('🔍 COMPONENT UNLOCK HOOK - Session check:', {
        currentTier,
        unlockedComponents: newUnlockedState,
        databaseSessions: sessions.length,
        isInitialLoad: isInitialLoad.current
      });
      
      // Mark that we've completed the initial load
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
      }
      
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
  
  // Format component names for user-friendly display
  const formatComponentName = (component: string): string => {
    const nameMap: Record<string, string> = {
      'earningsAnalysis': 'Earnings Analysis',
      'upcomingEarnings': 'Upcoming Earnings',
      'institutionalHoldings': 'Institutional Holdings',
      'insiderTrading': 'Insider Trading',
      'sentimentAnalysis': 'Sentiment Analysis',
      'technicalAnalysis': 'Technical Analysis',
      'fundamentalAnalysis': 'Fundamental Analysis',
      'marketTrends': 'Market Trends',
      'newsAnalysis': 'News Analysis',
      'socialSentiment': 'Social Sentiment',
      'redditAnalysis': 'Reddit Analysis',
      'reddit': 'Reddit Analysis',
      'chart': 'Technical Chart',
      'scores': 'Risk Scores'
    };
    
    return nameMap[component] || component.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  };
  
  // Effect to check sessions on mount and tier changes
  useEffect(() => {
    checkExistingSessions();
    
    // Check for expired sessions every 2 minutes
    const interval = setInterval(checkExistingSessions, 120000);
    return () => clearInterval(interval);
  }, [tierInfo, currentTier]);
  
  // Handle component unlock
  const handleUnlockComponent = async (component: string, cost: number) => {
    // Check if already unlocked
    const existingSession = await checkComponentAccess(component, currentTier);
    if (existingSession) {
      const timeRemaining = getSessionTimeRemainingFormatted(existingSession);
      info(`${formatComponentName(component)} already unlocked (${timeRemaining})`);
      return;
    }
    
    try {
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
        // Clear cache for this component to get fresh data
        clearComponentAccessCache(component);
        
        // Update component state
        setUnlockedComponents(prev => {
          const newState = { ...prev, [component]: true };
          // Update previous state reference immediately to prevent false expiration detection
          previousUnlockedState.current = { ...newState };
          return newState;
        });
        
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
          info(`${formatComponentName(component)} already unlocked (${data.timeRemaining}h remaining)`);
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
        info(`Failed to unlock ${formatComponentName(component)}. Please try again.`);
      }
    }
  };
  
  return {
    unlockedComponents,
    activeSessions,
    isCheckingSessions,
    currentTier,
    handleUnlockComponent,
    refreshSessions: checkExistingSessions,
    formatComponentName
  };
}; 