import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useTier } from '../contexts/TierContext';
import { useTierLimits } from './useTierLimits';
import { 
  checkComponentAccess, 
  storeUnlockSession, 
  getAllUnlockSessions,
  getSessionTimeRemainingFormatted,
  clearComponentAccessCache
} from '../utils/sessionStorage';

interface FreshUnlockState {
  success: boolean;
  isExistingSession: boolean;
  isFreshUnlock: boolean;
}

// Credit costs for each component - MUST MATCH EXACT DATABASE COMPONENT NAMES
const COMPONENT_COSTS = {
  chart: 10,
  scores: 8,
  reddit: 12,
};

export const useSentimentUnlock = () => {
  const { info, warning } = useToast();
  const { tierInfo, refreshTierInfo } = useTier();
  const { showTierLimitDialog } = useTierLimits();

  // Component unlock state - managed by sessions - MATCH DATABASE COMPONENT NAMES
  const [unlockedComponents, setUnlockedComponents] = useState<{
    chart: boolean;
    scores: boolean;
    reddit: boolean;
  }>({
    chart: false,
    scores: false,
    reddit: false
  });

  // Session state for time tracking
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  
  // Add state to track when we're checking sessions (prevents locked overlay flash)
  const [isCheckingSessions, setIsCheckingSessions] = useState(true);

  // Track fresh unlocks vs cache loads for appropriate loading UI
  const [isFreshUnlock, setIsFreshUnlock] = useState<FreshUnlockState>({
    success: false,
    isExistingSession: false,
    isFreshUnlock: false
  });

  // Get tier info
  const currentTier = tierInfo?.tier?.toLowerCase() || 'free';

  // Check existing sessions for all users
  useEffect(() => {
    if (!tierInfo) return;
    
    const checkExistingSessions = async () => {
      setIsCheckingSessions(true);
      try {
        const currentTierValue = tierInfo?.tier?.toLowerCase() || 'free';
        const chartSession = await checkComponentAccess('chart', currentTierValue);
        const scoresSession = await checkComponentAccess('scores', currentTierValue);
        const redditSession = await checkComponentAccess('reddit', currentTierValue);

        const newUnlockedState = {
          chart: !!chartSession,
          scores: !!scoresSession,
          reddit: !!redditSession
        };

        console.log('🔍 SENTIMENT - Active sessions:', {
          chart: !!chartSession,
          scores: !!scoresSession,
          reddit: !!redditSession,
          currentTier: currentTierValue,
          timestamp: Date.now()
        });

        setUnlockedComponents(newUnlockedState);
        console.log('🔍 SENTIMENT - Updated unlockedComponents state:', newUnlockedState);

        const sessions = await getAllUnlockSessions(currentTierValue);
        setActiveSessions(sessions);
      } catch (error) {
        console.warn('Database session check failed:', error);
        setUnlockedComponents({
          chart: false,
          scores: false,
          reddit: false
        });
        setActiveSessions([]);
      } finally {
        setIsCheckingSessions(false);
      }
    };

    checkExistingSessions();
    const interval = setInterval(checkExistingSessions, 60000);
    return () => clearInterval(interval);
  }, [tierInfo]);

  // Handlers for unlocking individual components
  const handleUnlockComponent = async (component: keyof typeof unlockedComponents, cost: number): Promise<FreshUnlockState> => {
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
        
        // Set fresh unlock flag for harvest loading (when credits are actually spent)
        if (!data.existingSession) {
          setFreshUnlockState(component, true);
          console.log(`🌟 SENTIMENT DASHBOARD - Set fresh unlock flag for ${component} (credits spent)`);
        }
        
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
    
    return {
      success: false,
      isExistingSession: false,
      isFreshUnlock: false
    };
  };

  // Helper to set fresh unlock state (for cleanup after component loading)
  const setFreshUnlockState = (component: keyof typeof unlockedComponents, value: boolean) => {
    setIsFreshUnlock(prev => ({
      ...prev,
      [component]: value
    }));
  };

  // Calculate component access state based on sessions
  const hasChartAccess = unlockedComponents.chart;
  const hasScoresAccess = unlockedComponents.scores;
  const hasRedditAccess = unlockedComponents.reddit;
  
  // Check if user has any sentiment access
  const hasAnySentimentAccess = hasChartAccess || hasScoresAccess || hasRedditAccess;
  
  // Get active session info for display
  const getActiveSessionInfo = (component: keyof typeof unlockedComponents) => {
    const session = activeSessions.find(s => s.component === component && s.status === 'active');
    if (!session) return null;
    
    return {
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      timeRemaining: getSessionTimeRemainingFormatted(session),
      creditsUsed: session.creditsUsed
    };
  };

  return {
    // State
    unlockedComponents,
    activeSessions,
    isFreshUnlock,
    isCheckingSessions,
    currentTier,
    
    // Computed values
    hasChartAccess,
    hasScoresAccess,
    hasRedditAccess,
    hasAnySentimentAccess,
    
    // Functions
    handleUnlockComponent,
    setFreshUnlockState,
    getActiveSessionInfo,
    
    // Constants
    COMPONENT_COSTS,
  };
}; 