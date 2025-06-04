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
 * Check if component is unlocked by querying the database first, then localStorage as fallback
 * Now includes tier-aware validation to prevent tier downgrade issues
 */
export const checkComponentAccess = async (component: string, currentTier?: string): Promise<UnlockSession | null> => {
  try {
    // First check database sessions via API
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn(`[checkComponentAccess] No auth token found for ${component}`);
      return checkUnlockSession(component, currentTier);
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
      // If API fails, fall back to localStorage
      return checkUnlockSession(component, currentTier);
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
        console.warn(`[checkComponentAccess] Session exists for ${component} but current tier (${currentTier}) doesn't support it. Temporarily blocking access - session preserved for tier upgrade.`);
        
        // Don't clear the session - just temporarily block access
        // This allows the session to be restored when user upgrades tier
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
      
      console.log(`[checkComponentAccess] Found active session for ${component}, syncing to localStorage`);
      
      // Sync to localStorage for offline access
      storeUnlockSession(component, {
        sessionId: dbSession.session_id,
        expiresAt: dbSession.expires_at,
        creditsUsed: dbSession.credits_used,
        tier: dbSession.metadata?.tier || 'free'
      });
      
      return unlockSession;
    } else {
      console.log(`[checkComponentAccess] No active database session for ${component}`);
    }
  } catch (error) {
    console.warn(`[checkComponentAccess] Error checking database session for ${component}:`, error);
  }
  
  // Fallback to localStorage check
  console.log(`[checkComponentAccess] Falling back to localStorage check for ${component}`);
  return checkUnlockSession(component, currentTier);
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
 * Store component unlock session in localStorage
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

    console.log(`📦 Stored unlock session for ${component}:`, {
      sessionId: sessionData.sessionId,
      expiresAt: new Date(expiresAtTimestamp).toLocaleString(),
      creditsUsed: sessionData.creditsUsed
    });
  } catch (error) {
    console.error('Error storing unlock session:', error);
  }
};

/**
 * Check if component is unlocked in current session (localStorage only)
 */
export const checkUnlockSession = (component: string, currentTier?: string): UnlockSession | null => {
  try {
    const stored = localStorage.getItem(`${SESSION_STORAGE_PREFIX}${component}`);
    if (!stored) return null;

    const data: UnlockSession = JSON.parse(stored);
    
    // Check if session has expired
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(`${SESSION_STORAGE_PREFIX}${component}`);
      console.log(`⏰ Session expired for ${component}, removing from storage`);
      return null;
    }

    // TIER-AWARE VALIDATION: Check if current tier supports this component
    const tierSupportsComponent = checkTierSupportsComponent(component, currentTier);
    
    if (!tierSupportsComponent) {
      console.warn(`[checkUnlockSession] Session exists for ${component} but current tier (${currentTier}) doesn't support it. Temporarily blocking access - session preserved for tier upgrade.`);
      
      // Don't clear the session - just temporarily block access
      // This allows the session to be restored when user upgrades tier
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error checking unlock session:', error);
    // Remove corrupted data
    localStorage.removeItem(`${SESSION_STORAGE_PREFIX}${component}`);
    return null;
  }
};

/**
 * Get all active unlock sessions
 */
export const getAllUnlockSessions = (currentTier?: string): UnlockSession[] => {
  const sessions: UnlockSession[] = [];
  
  try {
    // Get all localStorage keys that match our prefix
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SESSION_STORAGE_PREFIX)) {
        const component = key.replace(SESSION_STORAGE_PREFIX, '');
        const session = checkUnlockSession(component, currentTier);
        if (session) {
          sessions.push(session);
        }
      }
    }
  } catch (error) {
    console.error('Error getting all unlock sessions:', error);
  }

  return sessions;
};

/**
 * Clear specific component session
 */
export const clearUnlockSession = (component: string): void => {
  try {
    localStorage.removeItem(`${SESSION_STORAGE_PREFIX}${component}`);
    console.log(`🗑️ Cleared unlock session for ${component}`);
  } catch (error) {
    console.error('Error clearing unlock session:', error);
  }
};

/**
 * Clear all unlock sessions
 */
export const clearAllUnlockSessions = (): void => {
  try {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SESSION_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`🗑️ Cleared ${keysToRemove.length} unlock sessions`);
  } catch (error) {
    console.error('Error clearing all unlock sessions:', error);
  }
};

/**
 * Get time remaining for a session in milliseconds
 */
export const getSessionTimeRemaining = (session: UnlockSession): number => {
  return Math.max(0, session.expiresAt - Date.now());
};

/**
 * Get time remaining for a session in human-readable format
 */
export const getSessionTimeRemainingFormatted = (session: UnlockSession): string => {
  const timeRemaining = getSessionTimeRemaining(session);
  
  if (timeRemaining <= 0) return 'Expired';
  
  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else {
    return `${minutes}m remaining`;
  }
};

/**
 * Check if any sessions are expiring soon (within 15 minutes)
 */
export const getExpiringSoonSessions = (currentTier?: string): UnlockSession[] => {
  const sessions = getAllUnlockSessions(currentTier);
  const fifteenMinutes = 15 * 60 * 1000;
  
  return sessions.filter(session => {
    const timeRemaining = getSessionTimeRemaining(session);
    return timeRemaining > 0 && timeRemaining <= fifteenMinutes;
  });
}; 