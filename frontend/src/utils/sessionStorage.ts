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

// RATE LIMITING FIX: Add client-side caching to prevent API spam
const componentAccessCache = new Map<string, { data: UnlockSession | null; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache to prevent rate limiting
const pendingRequests = new Map<string, Promise<UnlockSession | null>>();

/**
 * Check if component is unlocked by querying the database ONLY
 * No localStorage fallback - everything goes through the database layer
 * All users (including Pro+) must pay credits and have session expiration
 * RATE LIMITING FIX: Added caching and debouncing
 */
export const checkComponentAccess = async (component: string, currentTier?: string): Promise<UnlockSession | null> => {
  const cacheKey = `${component}_${currentTier || 'unknown'}`;
  
  // RATE LIMITING FIX: Check cache first
  const cached = componentAccessCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`[checkComponentAccess] ⚡ Using cached result for ${component} (${Math.round((Date.now() - cached.timestamp) / 1000)}s old)`);
    return cached.data;
  }
  
  // RATE LIMITING FIX: Debounce concurrent requests for same component
  const existingRequest = pendingRequests.get(cacheKey);
  if (existingRequest) {
    console.log(`[checkComponentAccess] 🔄 Reusing pending request for ${component}`);
    return existingRequest;
  }
  
  // Create new request
  const requestPromise = performComponentAccessCheck(component, currentTier);
  pendingRequests.set(cacheKey, requestPromise);
  
  try {
    const result = await requestPromise;
    
    // Cache the result
    componentAccessCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  } finally {
    // Clean up pending request
    pendingRequests.delete(cacheKey);
  }
};

/**
 * Perform the actual component access check (separated for caching)
 */
const performComponentAccessCheck = async (component: string, currentTier?: string): Promise<UnlockSession | null> => {
  try {
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
      if (response.status === 429) {
        console.warn(`[checkComponentAccess] ⏰ Rate limited for ${component} - will retry with cached data`);
        // Don't clear cache on rate limit - let existing cache serve requests
        throw new Error('Rate limited');
      }
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

    // If we have a database response, use it (backend already validates tier access)
    if (data.success && data.hasAccess && data.session) {
      const { session_id: sessionId, timeRemainingHours: timeRemaining } = data.session;
      
      console.log(`✅ Active database session found for ${component}`);
      return {
        unlocked: true,
        sessionId,
        timestamp: Date.now(),
        expiresAt: Date.now() + (timeRemaining * 60 * 60 * 1000), // Convert hours to milliseconds
        component,
        creditsUsed: 0, // Not available from database response
        tier: currentTier || 'unknown'
      };
    } else {
      console.log(`❌ No active database session for ${component}`);
      return null;
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Rate limited') {
      // For rate limit errors, return cached data if available
      const cacheKey = `${component}_${currentTier || 'unknown'}`;
      const cached = componentAccessCache.get(cacheKey);
      if (cached) {
        console.log(`[checkComponentAccess] 🛡️ Rate limited, using stale cache for ${component}`);
        return cached.data;
      }
    }
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
  
  // Define tier access rules - what features each tier can access/unlock
  // Free users are completely blocked from premium features
  const tierAccess: Record<string, string[]> = {
    // Free tier: Can only unlock insider trading with credits
    'free': ['insiderTrading'],
    
    // Pro tier and above: Can unlock all features with credits (including premium ones)
    'pro': ['insiderTrading', 'institutionalHoldings', 'earningsAnalysis', 'chart', 'scores', 'reddit'],
    'elite': ['insiderTrading', 'institutionalHoldings', 'earningsAnalysis', 'chart', 'scores', 'reddit'],
    'institutional': ['insiderTrading', 'institutionalHoldings', 'earningsAnalysis', 'chart', 'scores', 'reddit'],
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
  const components = ['earningsAnalysis', 'insiderTrading', 'institutionalHoldings', 'chart', 'scores', 'reddit'];
  
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

/**
 * Clear component access cache (useful for testing or after unlock)
 */
export const clearComponentAccessCache = (component?: string): void => {
  if (component) {
    // Clear specific component cache entries
    const keysToDelete = Array.from(componentAccessCache.keys()).filter(key => key.startsWith(component));
    keysToDelete.forEach(key => componentAccessCache.delete(key));
    console.log(`🗑️ Cleared cache for ${component}`);
  } else {
    // Clear all cache
    componentAccessCache.clear();
    console.log(`🗑️ Cleared all component access cache`);
  }
}; 