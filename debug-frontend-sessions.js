/**
 * Frontend Session Debug Script
 * Run this in your browser console to check and clean localStorage sessions
 */

// Function to debug all HRVSTR sessions in localStorage
function debugHRVSTRSessions() {
  console.log('🔍 Debugging HRVSTR Frontend Sessions\n');
  
  const sessionPrefix = 'hrvstr_unlock_';
  const allSessions = [];
  const expiredSessions = [];
  const activeSessions = [];
  
  // Get all localStorage keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(sessionPrefix)) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        const component = key.replace(sessionPrefix, '');
        const now = Date.now();
        const isExpired = now > data.expiresAt;
        const hoursRemaining = Math.round((data.expiresAt - now) / (1000 * 60 * 60) * 100) / 100;
        const hoursSinceUnlock = Math.round((now - data.timestamp) / (1000 * 60 * 60) * 100) / 100;
        
        const sessionInfo = {
          component,
          isExpired,
          hoursRemaining: isExpired ? 0 : hoursRemaining,
          hoursSinceUnlock,
          unlockedAt: new Date(data.timestamp).toLocaleString(),
          expiresAt: new Date(data.expiresAt).toLocaleString(),
          sessionId: data.sessionId,
          tier: data.tier || 'unknown',
          creditsUsed: data.creditsUsed || 0
        };
        
        allSessions.push(sessionInfo);
        
        if (isExpired) {
          expiredSessions.push(sessionInfo);
        } else {
          activeSessions.push(sessionInfo);
        }
        
      } catch (error) {
        console.error(`Error parsing session data for ${key}:`, error);
        // Remove corrupted session data
        localStorage.removeItem(key);
      }
    }
  }
  
  console.log(`📊 Found ${allSessions.length} total sessions in localStorage`);
  
  if (allSessions.length === 0) {
    console.log('✅ No HRVSTR sessions found in localStorage');
    return { allSessions, expiredSessions, activeSessions };
  }
  
  // Show all sessions
  console.log('\n📋 All Sessions:');
  console.table(allSessions);
  
  // Show expired sessions
  if (expiredSessions.length > 0) {
    console.log(`\n❌ Found ${expiredSessions.length} expired sessions:`);
    console.table(expiredSessions.map(s => ({
      Component: s.component,
      'Hours Since Expired': Math.abs(s.hoursRemaining),
      'Hours Since Unlock': s.hoursSinceUnlock,
      'Unlocked At': s.unlockedAt,
      'Expired At': s.expiresAt
    })));
  }
  
  // Show active sessions
  if (activeSessions.length > 0) {
    console.log(`\n✅ Found ${activeSessions.length} active sessions:`);
    console.table(activeSessions.map(s => ({
      Component: s.component,
      'Hours Remaining': s.hoursRemaining,
      'Tier': s.tier,
      'Credits Used': s.creditsUsed,
      'Expires At': s.expiresAt
    })));
  }
  
  return { allSessions, expiredSessions, activeSessions };
}

// Function to clean up expired sessions
function cleanupExpiredFrontendSessions() {
  console.log('🧹 Cleaning up expired frontend sessions...\n');
  
  const sessionPrefix = 'hrvstr_unlock_';
  let cleanedCount = 0;
  const cleanedSessions = [];
  
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith(sessionPrefix)) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        const component = key.replace(sessionPrefix, '');
        const now = Date.now();
        const isExpired = now > data.expiresAt;
        
        if (isExpired) {
          const hoursPastExpiry = Math.round((now - data.expiresAt) / (1000 * 60 * 60) * 100) / 100;
          cleanedSessions.push({
            component,
            hoursPastExpiry,
            unlockedAt: new Date(data.timestamp).toLocaleString(),
            expiredAt: new Date(data.expiresAt).toLocaleString()
          });
          
          localStorage.removeItem(key);
          cleanedCount++;
          console.log(`🗑️  Removed expired session for ${component} (expired ${hoursPastExpiry}h ago)`);
        }
        
      } catch (error) {
        console.error(`Error processing session ${key}:`, error);
        localStorage.removeItem(key);
        cleanedCount++;
      }
    }
  }
  
  if (cleanedCount === 0) {
    console.log('✅ No expired sessions found to clean up');
  } else {
    console.log(`\n✅ Cleaned up ${cleanedCount} expired sessions`);
    if (cleanedSessions.length > 0) {
      console.table(cleanedSessions);
    }
  }
  
  return { cleanedCount, cleanedSessions };
}

// Function to verify with server
async function verifySessionsWithServer() {
  console.log('🔍 Verifying localStorage sessions with server...\n');
  
  try {
    const response = await fetch('/api/credits/active-sessions', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      console.error('❌ Failed to fetch server sessions:', response.status);
      return;
    }
    
    const data = await response.json();
    const serverSessions = data.activeSessions || [];
    
    console.log(`📊 Server has ${serverSessions.length} active sessions`);
    
    if (serverSessions.length > 0) {
      console.table(serverSessions.map(s => ({
        Component: s.component,
        'Hours Remaining': s.timeRemainingHours,
        'Expires At': new Date(s.expires_at).toLocaleString(),
        'Session ID': s.session_id
      })));
    }
    
    // Compare with localStorage
    const localSessions = debugHRVSTRSessions();
    
    console.log('\n🔄 Synchronizing localStorage with server...');
    
    // Remove localStorage sessions that don't exist on server
    let syncedCount = 0;
    localSessions.allSessions.forEach(localSession => {
      const serverSession = serverSessions.find(s => s.component === localSession.component);
      
      if (!serverSession) {
        localStorage.removeItem(`hrvstr_unlock_${localSession.component}`);
        console.log(`🗑️  Removed ${localSession.component} from localStorage (not active on server)`);
        syncedCount++;
      } else if (localSession.isExpired && serverSession.timeRemainingHours > 0) {
        // Server session is still active but localStorage thinks it's expired
        console.log(`🔄 Updating ${localSession.component} in localStorage (server session still active)`);
        
        const updatedSession = {
          unlocked: true,
          timestamp: Date.now(),
          expiresAt: new Date(serverSession.expires_at).getTime(),
          sessionId: serverSession.session_id,
          component: localSession.component,
          creditsUsed: serverSession.credits_used,
          tier: localSession.tier
        };
        
        localStorage.setItem(`hrvstr_unlock_${localSession.component}`, JSON.stringify(updatedSession));
        syncedCount++;
      }
    });
    
    console.log(`✅ Synchronized ${syncedCount} sessions with server`);
    
  } catch (error) {
    console.error('❌ Error verifying with server:', error);
  }
}

// Function to clear all HRVSTR sessions (nuclear option)
function clearAllHRVSTRSessions() {
  console.log('💥 Clearing ALL HRVSTR sessions from localStorage...\n');
  
  const sessionPrefix = 'hrvstr_unlock_';
  let clearedCount = 0;
  
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith(sessionPrefix)) {
      const component = key.replace(sessionPrefix, '');
      localStorage.removeItem(key);
      console.log(`🗑️  Cleared ${component} session`);
      clearedCount++;
    }
  }
  
  console.log(`✅ Cleared ${clearedCount} sessions from localStorage`);
  console.log('📝 All components will now require unlocking again');
}

// Main debug function
function debugAndFixSessions() {
  console.log('🛠️  HRVSTR Session Debug & Fix Tool\n');
  console.log('Available functions:');
  console.log('  debugHRVSTRSessions() - Show all sessions');
  console.log('  cleanupExpiredFrontendSessions() - Clean expired sessions');
  console.log('  verifySessionsWithServer() - Sync with server');
  console.log('  clearAllHRVSTRSessions() - Clear all sessions (nuclear)');
  console.log('\nRunning automatic diagnosis...\n');
  
  const sessions = debugHRVSTRSessions();
  
  if (sessions.expiredSessions.length > 0) {
    console.log('\n🔧 Found expired sessions, cleaning them up...');
    cleanupExpiredFrontendSessions();
  }
  
  return sessions;
}

// Auto-run the debug
debugAndFixSessions();

// Export functions to global scope for manual use
window.debugHRVSTRSessions = debugHRVSTRSessions;
window.cleanupExpiredFrontendSessions = cleanupExpiredFrontendSessions;
window.verifySessionsWithServer = verifySessionsWithServer;
window.clearAllHRVSTRSessions = clearAllHRVSTRSessions;
window.debugAndFixSessions = debugAndFixSessions; 