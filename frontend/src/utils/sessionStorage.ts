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

const SESSION_STORAGE_PREFIX = 'hrvstr_unlock_';

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
 * Check if component is unlocked in current session
 */
export const checkUnlockSession = (component: string): UnlockSession | null => {
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
export const getAllUnlockSessions = (): UnlockSession[] => {
  const sessions: UnlockSession[] = [];
  
  try {
    // Get all localStorage keys that match our prefix
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SESSION_STORAGE_PREFIX)) {
        const component = key.replace(SESSION_STORAGE_PREFIX, '');
        const session = checkUnlockSession(component);
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
export const getExpiringSoonSessions = (): UnlockSession[] => {
  const sessions = getAllUnlockSessions();
  const fifteenMinutes = 15 * 60 * 1000;
  
  return sessions.filter(session => {
    const timeRemaining = getSessionTimeRemaining(session);
    return timeRemaining > 0 && timeRemaining <= fifteenMinutes;
  });
}; 