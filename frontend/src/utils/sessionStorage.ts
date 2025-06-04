// Session storage utilities for component unlocks
export interface UnlockSession {
  unlocked: boolean;
  timestamp: number;
  expiresAt: number;
  sessionId: string;
  component: string;
  creditsUsed: number;
  tier: string;
}

// Database session interface for API responses
export interface DatabaseSession {
  session_id: string;
  component: string;
  credits_used: number;
  expires_at: string;
  status: string;
  metadata?: any;
}

const SESSION_STORAGE_PREFIX = 'hrvstr_unlock_';

/**
 * Check if component is unlocked by querying the database ONLY
 * No localStorage fallback - everything goes through the database layer
 * Includes tier-based auto-grants for Pro+ users
 */
export const checkComponentAccess = async (component: string, currentTier?: string): Promise<UnlockSession | null> => {
  try {
    // TIER-BASED AUTO-GRANTS: Pro+ users get certain components as part of tier benefits
    if (currentTier && ['pro', 'elite', 'institutional'].includes(currentTier.toLowerCase())) {
      if (component === 'insiderTrading' || component === 'institutionalHoldings' || component === 'earningsAnalysis') {
        console.log(`[checkComponentAccess] ✅ Auto-granted ${component} for ${currentTier} tier user`);
        
        // Create a virtual session for tier-based access
        const virtualSession: UnlockSession = {
          unlocked: true,
          timestamp: Date.now(),
          expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year expiry for tier benefits
          sessionId: `tier-${currentTier}-${component}`,
          component,
          creditsUsed: 0,
          tier: currentTier
        };
        
        return virtualSession;
      }
    }

    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn(`[checkComponentAccess] No auth token found for ${component}`);
      return null;
    }

    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
    
    console.log(`[checkComponentAccess] Checking database access for ${component}...`);
    
    const response = await fetch(`${proxyUrl}/api/credits/component-access/${component}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[checkComponentAccess] API response error for ${component}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log(`[checkComponentAccess] Database response for ${component}:`, {
      success: data.success,
      hasAccess: data.hasAccess,
      sessionId: data.session?.session_id,
      timeRemaining: data.session?.timeRemainingHours
    });

    if (data.success && data.hasAccess && data.session) {
      // TIER-AWARE VALIDATION: Check if current tier supports this component
      const tierSupportsComponent = checkTierSupportsComponent(component, currentTier);
      
      if (!tierSupportsComponent) {
        console.warn(`[checkComponentAccess] Session exists for ${component} but current tier (${currentTier}) doesn't support it. Access denied.`);
        return null;
      }
      
      // Convert database session to UnlockSession format
      const dbSession = data.session;
      const unlockSession: UnlockSession = {
        unlocked: true,
        timestamp: Date.now(),
        expiresAt: new Date(dbSession.expires_at).getTime(),
        sessionId: dbSession.session_id,
        component: dbSession.component,
        creditsUsed: dbSession.credits_used,
        tier: dbSession.metadata?.tier || 'free'
      };
      
      console.log(`[checkComponentAccess] ✅ Active database session found for ${component}`);
      return unlockSession;
    } else {
      console.log(`[checkComponentAccess] ❌ No active database session for ${component}`);
      return null;
    }
  } catch (error) {
    console.warn(`[checkComponentAccess] Error checking database session for ${component}:`, error);
    return null;
  }
};

/**
 * Check if the current tier supports a specific component
 */
const checkTierSupportsComponent = (component: string, currentTier?: string): boolean => {
  console.log(`[checkTierSupportsComponent] Input - Component: ${component}, Tier: ${currentTier} (type: ${typeof currentTier})`);
  
  if (!currentTier) {
    console.log(`[checkTierSupportsComponent] No tier provided, returning false`);
    return false;
  }
  
  const tier = currentTier.toLowerCase();
  console.log(`[checkTierSupportsComponent] Normalized tier: ${tier}`);
  
  // Define tier access rules - CORRECTED STRUCTURE
  // Each tier maps to the components it can access
  const tierAccess: Record<string, string[]> = {
    // Free tier gets basic access only
    'free': ['insiderTrading'], // Free users can unlock insider trading with credits
    
    // Pro tier and above get institutional holdings AND earnings analysis (Pro+ exclusive features)
    'pro': ['insiderTrading', 'institutionalHoldings', 'earningsAnalysis'],
    'elite': ['insiderTrading', 'institutionalHoldings', 'earningsAnalysis'],
    'institutional': ['insiderTrading', 'institutionalHoldings', 'earningsAnalysis'],
  };
  
  const allowedComponents = tierAccess[tier] || [];
  const isSupported = allowedComponents.includes(component);
  
  console.log(`[checkTierSupportsComponent] Component: ${component}, Tier: ${tier}, Allowed: [${allowedComponents.join(', ')}], Supported: ${isSupported}`);
  
  return isSupported;
};

/**
 * Store component unlock session in localStorage (DEPRECATED - keeping for backward compatibility only)
 * This is now only used for legacy support, all session checking goes through database
 */
export const storeUnlockSession = (
  component: string, 
  sessionData: {
    sessionId: string;
    expiresAt: string | Date;
    creditsUsed: number;
    tier: string;
  }
): void => {
  try {
    const expiresAtTimestamp = typeof sessionData.expiresAt === 'string' 
      ? new Date(sessionData.expiresAt).getTime()
      : sessionData.expiresAt.getTime();

    const unlockData: UnlockSession = {
      unlocked: true,
      timestamp: Date.now(),
      expiresAt: expiresAtTimestamp,
      sessionId: sessionData.sessionId,
      component,
      creditsUsed: sessionData.creditsUsed,
      tier: sessionData.tier
    };

    localStorage.setItem(
      `${SESSION_STORAGE_PREFIX}${component}`, 
      JSON.stringify(unlockData)
    );

    console.log(`📦 [DEPRECATED] Stored unlock session for ${component} (legacy support only):`, {
      sessionId: sessionData.sessionId,
      expiresAt: new Date(expiresAtTimestamp).toLocaleString(),
      creditsUsed: sessionData.creditsUsed
    });
  } catch (error) {
    console.error('Error storing unlock session:', error);
  }
};

/**
 * Check if component is unlocked in current session (localStorage only) - DEPRECATED
 * This function is deprecated and should not be used. Use checkComponentAccess instead.
 */
export const checkUnlockSession = (component: string, currentTier?: string): UnlockSession | null => {
  console.warn(`[DEPRECATED] checkUnlockSession called for ${component}. Use checkComponentAccess instead which queries the database.`);
  return null;
};

/**
 * Get all active unlock sessions - NOW QUERIES DATABASE ONLY
 */
export const getAllUnlockSessions = async (currentTier?: string): Promise<UnlockSession[]> => {
  const sessions: UnlockSession[] = [];
  const components = ['earningsAnalysis', 'insiderTrading', 'institutionalHoldings'];
  
  try {
    // Query database for all components
    for (const component of components) {
      const session = await checkComponentAccess(component, currentTier);
      if (session) {
        sessions.push(session);
      }
    }
  } catch (error) {
    console.error('Error getting all unlock sessions from database:', error);
  }

  return sessions;
};

/**
 * Clear component unlock session from localStorage (keeping for cleanup only)
 */
export const clearUnlockSession = (component: string): void => {
  try {
    localStorage.removeItem(`${SESSION_STORAGE_PREFIX}${component}`);
    console.log(`🗑️ Cleared localStorage session for ${component} (cleanup only)`);
  } catch (error) {
    console.error('Error clearing unlock session:', error);
  }
};

/**
 * Clear all unlock sessions from localStorage (keeping for cleanup only)
 */
export const clearAllUnlockSessions = (): void => {
  try {
    const keys = Object.keys(localStorage);
    const sessionKeys = keys.filter(key => key.startsWith(SESSION_STORAGE_PREFIX));
    
    sessionKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`🗑️ Cleared ${sessionKeys.length} localStorage sessions (cleanup only)`);
  } catch (error) {
    console.error('Error clearing all unlock sessions:', error);
  }
};

/**
 * Get session time remaining in milliseconds
 */
export const getSessionTimeRemaining = (session: UnlockSession): number => {
  return Math.max(0, session.expiresAt - Date.now());
};

/**
 * Get formatted time remaining for a session
 */
export const getSessionTimeRemainingFormatted = (session: UnlockSession): string => {
  const timeRemaining = getSessionTimeRemaining(session);
  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return 'Expired';
  }
};

/**
 * Get sessions that are expiring soon (within 24 hours) - NOW QUERIES DATABASE
 */
export const getExpiringSoonSessions = async (currentTier?: string): Promise<UnlockSession[]> => {
  const allSessions = await getAllUnlockSessions(currentTier);
  const twentyFourHours = 24 * 60 * 60 * 1000;
  
  return allSessions.filter(session => {
    const timeRemaining = getSessionTimeRemaining(session);
    return timeRemaining > 0 && timeRemaining <= twentyFourHours;
  });
}; 