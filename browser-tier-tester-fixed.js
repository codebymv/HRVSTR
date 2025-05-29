/**
 * HRVSTR Proper Tier Tester - Uses React Context
 * 
 * This version properly uses the TierContext.simulateUpgrade function
 * instead of bypassing it, which should automatically update the UI.
 */

// Available tiers and their features (Updated with proper capitalization)
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

// Function to find and use the React TierContext
function findTierContext() {
  // Try to find React fiber with TierContext
  const reactRoot = document.querySelector('#root') || document.querySelector('[data-reactroot]') || document.body;
  
  if (reactRoot && reactRoot._reactInternalFiber) {
    console.log('🔍 Found React fiber root');
  }
  
  // Check if we can access the TierContext hook directly
  if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
    console.log('🔍 React internals available');
  }
  
  return null;
}

// Use the proper TierContext method
async function properTierUpgrade(targetTier) {
  console.log(`🎯 Attempting proper ${targetTier} upgrade using TierContext...`);
  console.log(`✨ Target tier features:`, TIERS[targetTier]?.features || 'Unknown');
  
  // Method 1: Try to call the simulateUpgrade function directly if exposed
  if (window.simulateUpgrade && typeof window.simulateUpgrade === 'function') {
    console.log('✅ Found global simulateUpgrade function!');
    try {
      const success = await window.simulateUpgrade(targetTier);
      if (success) {
        console.log(`✅ Successfully upgraded to ${TIERS[targetTier]?.icon} ${targetTier} tier via context!`);
        return true;
      }
    } catch (error) {
      console.log('❌ Error with global function:', error);
    }
  }

  // Method 2: Dispatch a React event that the TierContext might listen to
  try {
    const event = new CustomEvent('tierUpgrade', {
      detail: { tier: targetTier }
    });
    window.dispatchEvent(event);
    console.log(`📡 Dispatched tierUpgrade event for ${targetTier}`);
  } catch (error) {
    console.log('❌ Error dispatching event:', error);
  }

  // Method 3: Call the API but trigger a context refresh
  const token = localStorage.getItem('auth_token');
  if (!token) {
    console.error('❌ No auth token found');
    return false;
  }

  try {
    console.log('🔄 Calling API and triggering context refresh...');
    
    const response = await fetch('/api/subscription/simulate-upgrade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ tier: targetTier })
    });
    
    const data = await response.json();
    
    if (data.success) {
      const tierEmoji = TIERS[targetTier]?.icon || '🎯';
      console.log(`✅ API upgrade to ${tierEmoji} ${targetTier} successful!`);
      console.log(`📊 New credits: ${data.data.credits.remaining}/${data.data.credits.monthly}`);
      console.log(`🎨 Expected UI changes: ${TIERS[targetTier]?.color} colors, ${TIERS[targetTier]?.features.join(', ')} features`);
      
      // Now trigger a context refresh by dispatching storage events
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tierChanged',
        newValue: targetTier,
        storageArea: localStorage
      }));
      
      // Also try to find and call refreshTierInfo
      await triggerTierRefresh();
      
      return true;
    } else {
      console.error('❌ API failed:', data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ API Error:', error);
    return false;
  }
}

// Function to trigger tier context refresh
async function triggerTierRefresh() {
  console.log('🔄 Triggering TierContext refresh...');
  
  // Try to find refreshTierInfo function
  const refreshFunctions = [
    'refreshTierInfo',
    'refreshTier',
    'updateTierInfo'
  ];
  
  for (const funcName of refreshFunctions) {
    if (window[funcName] && typeof window[funcName] === 'function') {
      console.log(`✅ Found ${funcName}! Calling it...`);
      try {
        await window[funcName]();
        console.log(`✅ ${funcName} called successfully!`);
        return true;
      } catch (error) {
        console.log(`❌ Error calling ${funcName}:`, error);
      }
    }
  }
  
  // Try to access React components and force re-render
  const tierElements = document.querySelectorAll('[data-tier], [class*="tier"], [class*="Tier"]');
  if (tierElements.length > 0) {
    console.log(`🔍 Found ${tierElements.length} potential tier elements`);
    
    // Try to trigger a re-render by simulating a click or focus event
    tierElements.forEach((element, index) => {
      try {
        element.dispatchEvent(new Event('focus', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
      } catch (e) {
        // Silent fail
      }
    });
  }
  
  console.log('⚠️ Could not find refresh function, you may need to manually refresh');
  return false;
}

// Show tier comparison
function showTierComparison() {
  console.log('📋 HRVSTR Tier Comparison:');
  console.log('');
  
  Object.entries(TIERS).forEach(([key, tier]) => {
    console.log(`${tier.icon} ${tier.name} (${key})`);
    console.log(`   💳 Credits: ${tier.monthlyCredits.toLocaleString()}/month`);
    console.log(`   📈 Watchlist: ${tier.watchlistLimit === -1 ? 'Unlimited' : tier.watchlistLimit} stocks`);
    console.log(`   🔧 Features: ${tier.features.join(', ')}`);
    console.log(`   🎨 Color: ${tier.color}`);
    console.log('');
  });
}

// Expose functions globally
window.properTierUpgrade = properTierUpgrade;
window.triggerTierRefresh = triggerTierRefresh;
window.showTierComparison = showTierComparison;

// Convenient shortcuts
window.upgradeToPro = () => properTierUpgrade('pro');
window.upgradeToElite = () => properTierUpgrade('elite'); 
window.upgradeToInstitutional = () => properTierUpgrade('institutional');
window.downgradeToFree = () => properTierUpgrade('free');

console.log('🎯 Proper HRVSTR Tier Tester Loaded! (v2 - Fixed Capitalization)');
console.log('');
console.log('📖 Commands (using React Context):');
console.log('  upgradeToElite()         - 💎 Upgrade to Elite tier (2000 credits, unlimited watchlist)');
console.log('  upgradeToPro()           - ⭐ Upgrade to Pro tier (500 credits, 25 watchlist)');
console.log('  upgradeToInstitutional() - 🏢 Upgrade to Institutional tier (10k credits, unlimited)');
console.log('  downgradeToFree()        - 🆓 Downgrade to Free tier (50 credits, 5 watchlist)');
console.log('  showTierComparison()     - 📋 Show detailed tier comparison');
console.log('  triggerTierRefresh()     - 🔄 Force refresh tier context');
console.log('');
console.log('💡 These should automatically update the UI with proper colors and features!');

// Auto-detect current tier context state
setTimeout(() => {
  console.log('🔍 Checking TierContext integration...');
  findTierContext();
}, 1000); 