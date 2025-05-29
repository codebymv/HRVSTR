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
 *   showTiers()              - Show all available tiers
 *   getCurrentTier()         - Show current tier info
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

// Shortcuts for common tiers
window.testFree = () => testTier('free');
window.testPro = () => testTier('pro');
window.testElite = () => testTier('elite');
window.testInstitutional = () => testTier('institutional');

// Welcome message
console.log('🎯 HRVSTR Tier Tester Loaded! (Updated v2)');
console.log('');
console.log('📖 Quick Commands:');
console.log('  testAuth()          - Test if authentication is working');
console.log('  testPro()           - Switch to Pro tier');
console.log('  testElite()         - Switch to Elite tier');
console.log('  testFree()          - Switch back to Free tier');
console.log('  showTiers()         - Show all tiers');
console.log('  getCurrentTier()    - Show current tier');
console.log('');
console.log('💡 Or use: testTier("tier_name")');

// Auto-test authentication on load
console.log('');
testAuth().then(success => {
  if (success) {
    console.log('🚀 Ready to test tiers! Try: testPro()');
  } else {
    console.log('⚠️  Authentication issue detected. You may need to log in again.');
  }
}); 