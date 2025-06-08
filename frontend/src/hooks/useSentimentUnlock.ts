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

  // Track recently unlocked components to prevent session checker from overriding them
  const [recentlyUnlocked, setRecentlyUnlocked] = useState<Set<string>>(new Set());

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
          chart: !!chartSession || recentlyUnlocked.has('chart'),
          scores: !!scoresSession || recentlyUnlocked.has('scores'),
          reddit: !!redditSession || recentlyUnlocked.has('reddit')
        };

        console.log('🔍 SENTIMENT - Active sessions:', {
          chart: !!chartSession,
          scores: !!scoresSession,
          reddit: !!redditSession,
          recentlyUnlocked: Array.from(recentlyUnlocked),
          finalState: newUnlockedState,
          currentTier: currentTierValue,
          timestamp: Date.now()
        });

        setUnlockedComponents(newUnlockedState);
        console.log('🔍 SENTIMENT - Updated unlockedComponents state:', newUnlockedState);

        const sessions = await getAllUnlockSessions(currentTierValue);
        setActiveSessions(sessions);
      } catch (error) {
        console.warn('Database session check failed:', error);
        // Don't override recently unlocked components even on error
        setUnlockedComponents(prev => ({
          chart: recentlyUnlocked.has('chart') || prev.chart,
          scores: recentlyUnlocked.has('scores') || prev.scores,
          reddit: recentlyUnlocked.has('reddit') || prev.reddit
        }));
        setActiveSessions([]);
      } finally {
        setIsCheckingSessions(false);
      }
    };

    checkExistingSessions();
    const interval = setInterval(checkExistingSessions, 120000); // Cut frequency in half: was 60s, now 120s
    return () => clearInterval(interval);
  }, [tierInfo, recentlyUnlocked]);

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
        // Create an error with the response status for better error handling
        const error = new Error(data.error || 'Failed to unlock component');
        (error as any).status = response.status;
        (error as any).data = data;
        throw error;
      }
      
      if (data.success) {
        // Add to recently unlocked set to prevent session checker from overriding
        setRecentlyUnlocked(prev => {
          const newSet = new Set(prev);
          newSet.add(component);
          console.log(`🔓 SENTIMENT UNLOCK - Added ${component} to recently unlocked:`, Array.from(newSet));
          return newSet;
        });

        // IMMEDIATELY update component state to prevent UI flicker
        setUnlockedComponents(prev => {
          const newState = {
            ...prev,
            [component]: true
          };
          console.log(`🔓 SENTIMENT UNLOCK - Immediately updating ${component} to unlocked:`, newState);
          return newState;
        });
        
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
        
        // Clear component access cache to force fresh database check
        clearComponentAccessCache(component);
        
        // Update active sessions by querying database with a small delay
        // to ensure database consistency
        setTimeout(async () => {
          try {
            const sessions = await getAllUnlockSessions(currentTier);
            setActiveSessions(sessions);
            console.log(`🔓 SENTIMENT UNLOCK - Updated active sessions for ${component}`);
            
            // Remove from recently unlocked after confirming session is active
            setTimeout(() => {
              setRecentlyUnlocked(prev => {
                const newSet = new Set(prev);
                newSet.delete(component);
                console.log(`🔓 SENTIMENT UNLOCK - Removed ${component} from recently unlocked after confirmation:`, Array.from(newSet));
                return newSet;
              });
            }, 1000);
          } catch (error) {
            console.warn(`Failed to update active sessions after unlocking ${component}:`, error);
          }
        }, 500);

        // Fallback cleanup: remove from recently unlocked after 10 seconds regardless
        setTimeout(() => {
          setRecentlyUnlocked(prev => {
            if (prev.has(component)) {
              const newSet = new Set(prev);
              newSet.delete(component);
              console.log(`🔓 SENTIMENT UNLOCK - Fallback cleanup: removed ${component} from recently unlocked:`, Array.from(newSet));
              return newSet;
            }
            return prev;
          });
        }, 10000);
        
        // Show appropriate toast message
        if (data.existingSession) {
          info(`${component} already unlocked (${data.timeRemaining}h remaining)`);
        } else {
          info(`${data.creditsUsed} credits used`);
        }
        
        // Refresh tier info to update usage meter (run in background)
        if (refreshTierInfo) {
          refreshTierInfo().catch(error => {
            console.warn('Failed to refresh tier info after unlock:', error);
          });
        }
        
        return {
          success: true,
          isExistingSession: data.existingSession,
          isFreshUnlock: !data.existingSession
        };
      }
      
    } catch (error) {
      console.error('Sentiment unlock error:', error);
      
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