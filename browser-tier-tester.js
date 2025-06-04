/**
 * HRVSTR Browser Tier Tester
 * 
 * Simple script to test different tiers in the browser console.
 * 
 * USAGE:
 * 1. Open HRVSTR in your browser and log in
 * 2. Open Developer Tools (F12)
 * 3. Go to Console tab
 * 4. Copy and paste this entire script
 * 5. Press Enter to load the functions
 * 6. Use the commands below:
 * 
 * COMMANDS:
 *   testTier('pro')          - Switch to Pro tier
 *   testTier('elite')        - Switch to Elite tier  
 *   testTier('institutional') - Switch to Institutional tier
 *   testTier('free')         - Switch back to Free tier
 *   clearCache()             - Manually clear sentiment cache
 *   showTiers()              - Show all available tiers
 *   getCurrentTier()         - Show current tier info
 *   
 *   // NEW DIAGNOSTIC FUNCTIONS:
 *   debugUnlockStatus()      - Check unlock status across systems
 *   debugSessionSync()       - Test database vs localStorage sync
 *   testUnlockFlow()         - Test complete unlock + verification flow
 *   clearUnlockSessions()    - Clear all unlock sessions (localStorage)
 */

// Available tiers and their features
const TIERS = {
  free: {
    name: 'Free',
    watchlistLimit: 5,
    monthlyCredits: 50,
    features: ['FinViz', 'SEC', 'Earnings'],
    icon: '🆓',
    color: '#6B7280'
  },
  pro: {
    name: 'Pro',
    watchlistLimit: 25,
    monthlyCredits: 500,
    features: ['FinViz', 'SEC', 'Earnings', 'Reddit', 'Yahoo'],
    icon: '⭐',
    color: '#3B82F6'
  },
  elite: {
    name: 'Elite',
    watchlistLimit: -1,
    monthlyCredits: 2000,
    features: ['FinViz', 'SEC', 'Earnings', 'Reddit', 'Yahoo', 'AlphaVantage'],
    icon: '💎',
    color: '#8B5CF6'
  },
  institutional: {
    name: 'Institutional',
    watchlistLimit: -1,
    monthlyCredits: 10000,
    features: ['FinViz', 'SEC', 'Earnings', 'Reddit', 'Yahoo', 'AlphaVantage', 'Premium'],
    icon: '🏢',
    color: '#F59E0B'
  }
};

// Helper function to get auth token - Updated to use the correct key!
function getAuthToken() {
  // First try the correct key we found in debug
  const primaryToken = localStorage.getItem('auth_token');
  if (primaryToken) return primaryToken;
  
  // Also check the auth_user object which has a token field
  const authUser = localStorage.getItem('auth_user');
  if (authUser) {
    try {
      const userObj = JSON.parse(authUser);
      if (userObj.token) return userObj.token;
    } catch (e) {
      // Silent fail
    }
  }
  
  // Fallback to other common token keys
  const fallbackKeys = ['token', 'authToken', 'access_token', 'jwt', 'auth', 'accessToken'];
  for (const key of fallbackKeys) {
    const token = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (token) return token;
  }
  
  return null;
}

// Function to manually clear sentiment cache
function clearCache() {
  console.log('🔄 Clearing sentiment cache...');
  
  try {
    // Try using the exposed cache clearing function first
    if (typeof window !== 'undefined' && window.clearSentimentCache) {
      window.clearSentimentCache();
      console.log('✅ Sentiment cache cleared using exposed function');
      return;
    }
    
    // Manual cache clearing if function isn't available
    const cacheKeys = [
      'sentiment_allSentiments',
      'sentiment_allTickerSentiments', 
      'sentiment_cachedRedditPosts',
      'sentiment_lastFetchTime'
    ];
    
    let clearedCount = 0;
    cacheKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        clearedCount++;
      }
    });
    
    console.log(`✅ Manually cleared ${clearedCount} sentiment cache keys`);
    console.log('💡 Refresh the page to reload with fresh data');
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
  }
}

// NEW: Clear all unlock sessions from localStorage
function clearUnlockSessions() {
  console.log('🔄 Clearing all unlock sessions from localStorage...');
  
  const sessionKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('hrvstr_unlock_')) {
      sessionKeys.push(key);
    }
  }
  
  sessionKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🗑️ Removed: ${key}`);
  });
  
  console.log(`✅ Cleared ${sessionKeys.length} unlock sessions from localStorage`);
  console.log('💡 Refresh the page to reload unlock status from database');
}

// NEW: Debug unlock status across all systems
async function debugUnlockStatus() {
  console.log('🔍 UNLOCK STATUS DEBUG');
  console.log('='.repeat(50));
  
  const token = getAuthToken();
  if (!token) {
    console.error('❌ Not logged in! Cannot debug unlock status.');
    return;
  }
  
  const proxyUrl = 'http://localhost:3001';
  const components = ['earningsAnalysis', 'insiderTrading', 'institutionalHoldings'];
  
  console.log(`🔑 Using token: ${token.substring(0, 20)}...`);
  console.log('');
  
  for (const component of components) {
    console.log(`📋 Component: ${component}`);
    console.log('-'.repeat(30));
    
    // Check localStorage
    const localStorageKey = `hrvstr_unlock_${component}`;
    const localSession = localStorage.getItem(localStorageKey);
    console.log(`💾 localStorage: ${localSession ? 'EXISTS' : 'NOT FOUND'}`);
    
    if (localSession) {
      try {
        const parsed = JSON.parse(localSession);
        const expiresAt = new Date(parsed.expiresAt);
        const isExpired = Date.now() > parsed.expiresAt;
        console.log(`   📅 Expires: ${expiresAt.toLocaleString()}`);
        console.log(`   ⏰ Status: ${isExpired ? '❌ EXPIRED' : '✅ ACTIVE'}`);
        console.log(`   🎟️ Session ID: ${parsed.sessionId}`);
        console.log(`   💳 Credits: ${parsed.creditsUsed}`);
      } catch (e) {
        console.log(`   ⚠️ Invalid JSON in localStorage`);
      }
    }
    
    // Check database via API
    try {
      const response = await fetch(`${proxyUrl}/api/credits/component-access/${component}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`🌐 Database API: ${data.hasAccess ? '✅ HAS ACCESS' : '❌ NO ACCESS'}`);
        
        if (data.session) {
          const expiresAt = new Date(data.session.expires_at);
          console.log(`   📅 Expires: ${expiresAt.toLocaleString()}`);
          console.log(`   ⏰ Time Remaining: ${data.session.timeRemainingHours}h`);
          console.log(`   🎟️ Session ID: ${data.session.session_id}`);
          console.log(`   💳 Credits: ${data.session.credits_used}`);
        }
      } else {
        console.log(`🌐 Database API: ❌ ERROR ${response.status}`);
      }
    } catch (error) {
      console.log(`🌐 Database API: ❌ NETWORK ERROR`);
      console.log(`   Error: ${error.message}`);
    }
    
    console.log('');
  }
}

// NEW: Test database vs localStorage sync
async function debugSessionSync() {
  console.log('🔄 SESSION SYNC DEBUG');
  console.log('='.repeat(50));
  
  const token = getAuthToken();
  if (!token) {
    console.error('❌ Not logged in! Cannot test session sync.');
    return;
  }
  
  const components = ['earningsAnalysis', 'insiderTrading', 'institutionalHoldings'];
  
  for (const component of components) {
    console.log(`🔄 Testing sync for: ${component}`);
    
    // Step 1: Clear localStorage
    const localStorageKey = `hrvstr_unlock_${component}`;
    localStorage.removeItem(localStorageKey);
    console.log(`   1️⃣ Cleared localStorage for ${component}`);
    
    // Step 2: Call API to check database
    try {
      const response = await fetch(`http://localhost:3001/api/credits/component-access/${component}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   2️⃣ Database check: ${data.hasAccess ? '✅ HAS ACCESS' : '❌ NO ACCESS'}`);
        
        if (data.hasAccess) {
          // Step 3: Simulate frontend sync logic
          const dbSession = data.session;
          const unlockSession = {
            unlocked: true,
            timestamp: Date.now(),
            expiresAt: new Date(dbSession.expires_at).getTime(),
            sessionId: dbSession.session_id,
            component: dbSession.component,
            creditsUsed: dbSession.credits_used,
            tier: dbSession.metadata?.tier || 'free'
          };
          
          localStorage.setItem(localStorageKey, JSON.stringify(unlockSession));
          console.log(`   3️⃣ Synced to localStorage: ✅ SUCCESS`);
          console.log(`       Session ID: ${dbSession.session_id}`);
          console.log(`       Expires: ${new Date(dbSession.expires_at).toLocaleString()}`);
        } else {
          console.log(`   3️⃣ No active session to sync`);
        }
      } else {
        console.log(`   2️⃣ Database check: ❌ API ERROR ${response.status}`);
      }
    } catch (error) {
      console.log(`   2️⃣ Database check: ❌ NETWORK ERROR`);
      console.log(`       Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('🔄 Sync test complete! Check unlock status with debugUnlockStatus()');
}

// NEW: Test complete unlock and verification flow
async function testUnlockFlow(component = 'earningsAnalysis', cost = 10) {
  console.log('🧪 UNLOCK FLOW TEST');
  console.log('='.repeat(50));
  console.log(`Component: ${component}`);
  console.log(`Cost: ${cost} credits`);
  console.log('');
  
  const token = getAuthToken();
  if (!token) {
    console.error('❌ Not logged in! Cannot test unlock flow.');
    return;
  }
  
  const proxyUrl = 'http://localhost:3001';
  
  // Step 1: Check initial status
  console.log('1️⃣ Checking initial status...');
  await debugUnlockStatusForComponent(component);
  console.log('');
  
  // Step 2: Attempt unlock
  console.log('2️⃣ Attempting unlock...');
  try {
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
    
    if (data.success) {
      console.log(`✅ Unlock successful!`);
      console.log(`   Session ID: ${data.sessionId}`);
      console.log(`   Credits used: ${data.creditsUsed}`);
      console.log(`   Expires: ${new Date(data.expiresAt).toLocaleString()}`);
      console.log(`   Existing session: ${data.existingSession ? 'YES' : 'NO'}`);
    } else {
      console.log(`❌ Unlock failed: ${data.error}`);
    }
  } catch (error) {
    console.log(`❌ Unlock error: ${error.message}`);
  }
  console.log('');
  
  // Step 3: Wait a moment and verify
  console.log('3️⃣ Verifying unlock status...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await debugUnlockStatusForComponent(component);
  console.log('');
  
  console.log('🧪 Unlock flow test complete!');
}

// Helper function for single component debug
async function debugUnlockStatusForComponent(component) {
  const token = getAuthToken();
  const proxyUrl = 'http://localhost:3001';
  
  // Check localStorage
  const localStorageKey = `hrvstr_unlock_${component}`;
  const localSession = localStorage.getItem(localStorageKey);
  console.log(`💾 localStorage: ${localSession ? 'EXISTS' : 'NOT FOUND'}`);
  
  // Check database
  try {
    const response = await fetch(`${proxyUrl}/api/credits/component-access/${component}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`🌐 Database: ${data.hasAccess ? '✅ HAS ACCESS' : '❌ NO ACCESS'}`);
      if (data.session) {
        console.log(`   Time remaining: ${data.session.timeRemainingHours}h`);
      }
    } else {
      console.log(`🌐 Database: ❌ ERROR ${response.status}`);
    }
  } catch (error) {
    console.log(`🌐 Database: ❌ NETWORK ERROR`);
  }
}

// Main function to change tier
async function testTier(tierName) {
  const tier = tierName.toLowerCase();
  
  if (!TIERS[tier]) {
    console.error('❌ Invalid tier. Available:', Object.keys(TIERS).join(', '));
    return;
  }
  
  const token = getAuthToken();
  if (!token) {
    console.error('❌ Not logged in! Please log in to HRVSTR first.');
    console.log('🔍 Debug: Run debugAuth() to see what tokens are available');
    return;
  }
  
  console.log(`🔄 Switching to ${TIERS[tier].icon} ${TIERS[tier].name} tier...`);
  console.log(`🔑 Using token: ${token.substring(0, 20)}...`);
  
  try {
    const response = await fetch('/api/subscription/simulate-upgrade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ tier })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Successfully switched to ${TIERS[tier].icon} ${TIERS[tier].name} tier!`);
      console.log(`📊 Credits: ${data.data.credits.remaining}/${data.data.credits.monthly}`);
      
      // Clear sentiment cache to prevent stale data
      console.log('🔄 Clearing sentiment cache...');
      try {
        // Clear sentiment cache if the function is available
        if (typeof window !== 'undefined' && window.clearSentimentCache) {
          window.clearSentimentCache();
          console.log('✅ Sentiment cache cleared successfully');
        } else {
          // Manual cache clearing if function isn't available
          const cacheKeys = [
            'sentiment_allSentiments',
            'sentiment_allTickerSentiments', 
            'sentiment_cachedRedditPosts',
            'sentiment_lastFetchTime'
          ];
          
          cacheKeys.forEach(key => localStorage.removeItem(key));
          console.log('✅ Manually cleared sentiment cache keys');
        }
      } catch (cacheError) {
        console.warn('⚠️ Could not clear sentiment cache:', cacheError.message);
      }
      
      console.log(`🔄 Refresh the page to see UI changes`);
      
      // Update the local watchlist limits in sessionStorage
      if (sessionStorage.getItem('watchlist_limits')) {
        try {
          const limits = JSON.parse(sessionStorage.getItem('watchlist_limits'));
          limits.tier = tier;
          limits.max = TIERS[tier].watchlistLimit;
          sessionStorage.setItem('watchlist_limits', JSON.stringify(limits));
          console.log(`📝 Updated local watchlist limits for ${tier} tier`);
        } catch (e) {
          // Silent fail
        }
      }
      
      // Automatically refresh after 1 second to show changes
      console.log('🔄 Auto-refreshing page in 1 second...');
      setTimeout(() => window.location.reload(), 1000);
      
    } else {
      console.error('❌ Failed:', data.error);
      if (response.status === 401) {
        console.log('🔑 Authentication failed. Your token might be expired.');
        console.log('💡 Try logging out and logging back in.');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('💡 Make sure your backend is running and you\'re on the correct domain');
  }
}

// Function to show all tiers
function showTiers() {
  console.log('📋 Available HRVSTR Tiers:');
  console.log('');
  
  Object.entries(TIERS).forEach(([key, tier]) => {
    console.log(`${tier.icon} ${tier.name} (${key})`);
    console.log(`   Credits: ${tier.monthlyCredits}/month`);
    console.log(`   Watchlist: ${tier.watchlistLimit === -1 ? 'Unlimited' : tier.watchlistLimit} stocks`);
    console.log(`   Features: ${tier.features.join(', ')}`);
    console.log('');
  });
  
  console.log('💡 Usage: testTier("pro") or testTier("elite")');
}

// Function to get current tier
async function getCurrentTier() {
  const token = getAuthToken();
  if (!token) {
    console.error('❌ Not logged in!');
    return;
  }
  
  try {
    const response = await fetch('/api/subscription/tier-info', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      const tierInfo = data.data;
      const tier = TIERS[tierInfo.tier];
      
      if (tier) {
        console.log(`${tier.icon} Current Tier: ${tier.name}`);
        console.log(`📊 Credits: ${tierInfo.credits.remaining}/${tierInfo.credits.monthly}`);
        console.log(`📅 Resets in: ${tierInfo.credits.daysUntilReset} days`);
        
        if (tierInfo.usage?.watchlist) {
          const limit = tierInfo.usage.watchlist.limit === -1 ? '∞' : tierInfo.usage.watchlist.limit;
          console.log(`📈 Watchlist: ${tierInfo.usage.watchlist.current}/${limit} stocks`);
        }
      } else {
        console.log(`Current Tier: ${tierInfo.tier} (unknown tier configuration)`);
      }
      
      return tierInfo;
    } else {
      console.error('❌ Failed to get tier info:', data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Test current authentication
async function testAuth() {
  const token = getAuthToken();
  console.log('🔍 Testing Authentication...');
  console.log(`🔑 Token found: ${token ? 'YES' : 'NO'}`);
  
  if (token) {
    console.log(`🔑 Token preview: ${token.substring(0, 30)}...`);
    console.log('🧪 Testing API access...');
    
    try {
      const response = await fetch('/api/subscription/tier-info', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Authentication working!');
        console.log(`👤 User: ${data.data?.tier || 'Unknown'} tier`);
        return true;
      } else {
        console.log(`❌ API returned ${response.status}: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ API Error: ${error.message}`);
      return false;
    }
  } else {
    console.log('❌ No token found in storage');
    return false;
  }
}

// Quick test functions
window.testTier = testTier;
window.showTiers = showTiers;
window.getCurrentTier = getCurrentTier;
window.testAuth = testAuth;

// NEW: Expose debug functions
window.debugUnlockStatus = debugUnlockStatus;
window.debugSessionSync = debugSessionSync;
window.testUnlockFlow = testUnlockFlow;
window.clearUnlockSessions = clearUnlockSessions;
window.testDatabaseOnlyAccess = testDatabaseOnlyAccess;
window.testTierAutoGrants = testTierAutoGrants;

// Shortcuts for common tiers
window.testFree = () => testTier('free');
window.testPro = () => testTier('pro');
window.testElite = () => testTier('elite');
window.testInstitutional = () => testTier('institutional');

// Welcome message
console.log('🎯 HRVSTR Tier Tester Loaded! (Updated v3 - With Debug Tools)');
console.log('');
console.log('📖 Quick Commands:');
console.log('  testAuth()          - Test if authentication is working');
console.log('  testPro()           - Switch to Pro tier');
console.log('  testElite()         - Switch to Elite tier');
console.log('  testFree()          - Switch back to Free tier');
console.log('  showTiers()         - Show all tiers');
console.log('  getCurrentTier()    - Show current tier');
console.log('');
console.log('🔧 Debug Commands:');
console.log('  debugUnlockStatus() - Check unlock status across systems');
console.log('  debugSessionSync()  - Test database vs localStorage sync');
console.log('  testUnlockFlow()    - Test complete unlock + verification flow');
console.log('  clearUnlockSessions() - Clear all unlock sessions (localStorage)');
console.log('  testDatabaseOnlyAccess() - Test new database-only approach');
console.log('  testTierAutoGrants() - Test tier-based auto-grants for Pro+ users');
console.log('');
console.log('💡 Or use: testTier("tier_name")');

// Auto-test authentication on load
console.log('');
testAuth().then(success => {
  if (success) {
    console.log('🚀 Ready to test tiers! Try: testPro()');
    console.log('🔍 Debug unlock issues with: debugUnlockStatus()');
  } else {
    console.log('⚠️  Authentication issue detected. You may need to log in again.');
  }
});

// NEW: Test the new database-only approach
async function testDatabaseOnlyAccess() {
  console.log('🔗 TESTING DATABASE-ONLY ACCESS');
  console.log('='.repeat(50));
  
  const token = getAuthToken();
  if (!token) {
    console.error('❌ Not logged in! Cannot test database access.');
    return;
  }
  
  // Step 1: Clear all localStorage sessions
  clearUnlockSessions();
  console.log('');
  
  // Step 2: Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 3: Check what the database says (should ignore localStorage now)
  console.log('2️⃣ Checking database access (localStorage now cleared)...');
  await debugUnlockStatus();
  
  console.log('🔗 Database-only test complete!');
  console.log('💡 If you see database sessions but NO localStorage, the fix is working!');
  console.log('🔄 Refresh the page to see if components unlock properly from database only.');
}

// NEW: Test tier-based auto-grants for Pro+ users
async function testTierAutoGrants() {
  console.log('👑 TESTING TIER-BASED AUTO-GRANTS');
  console.log('='.repeat(50));
  
  // Get current tier info
  const currentTier = await getCurrentTier();
  if (!currentTier) {
    console.error('❌ Could not get tier information!');
    return;
  }
  
  console.log(`📊 Current Tier: ${currentTier.tier}`);
  console.log('');
  
  // Components that should be auto-granted for Pro+
  const proComponents = ['institutionalHoldings', 'earningsAnalysis'];
  const generalComponents = ['insiderTrading']; // Always requires unlock
  
  if (['pro', 'elite', 'institutional'].includes(currentTier.tier.toLowerCase())) {
    console.log('✅ Pro+ tier detected! Testing auto-grants...');
    console.log('');
    
    for (const component of proComponents) {
      console.log(`🔍 Testing auto-grant for: ${component}`);
      
      // This should work through tier-based auto-grant (no API call needed)
      console.log(`   Expected: ✅ AUTO-GRANTED (tier benefit)`);
      console.log(`   Reason: Pro+ users get ${component} as tier benefit`);
      console.log('');
    }
    
    for (const component of generalComponents) {
      console.log(`🔍 Testing credit unlock for: ${component}`);
      console.log(`   Expected: Requires credit unlock or existing session`);
      console.log(`   Reason: Available to all tiers but requires credits`);
      console.log('');
    }
    
  } else if (currentTier.tier.toLowerCase() === 'free') {
    console.log('💡 Free tier detected!');
    console.log('');
    
    for (const component of proComponents) {
      console.log(`🔍 Testing access for: ${component}`);
      console.log(`   Expected: ❌ UPGRADE REQUIRED`);
      console.log(`   Reason: ${component} is a Pro+ exclusive feature`);
      console.log('');
    }
    
    for (const component of generalComponents) {
      console.log(`🔍 Testing access for: ${component}`);
      console.log(`   Expected: Requires credit unlock`);
      console.log(`   Reason: Available to free tier with credits`);
      console.log('');
    }
  }
  
  console.log('👑 Tier auto-grant test complete!');
  console.log('🔄 Refresh the page to see if Pro+ components are automatically unlocked.');
} 