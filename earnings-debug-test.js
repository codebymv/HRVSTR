/**
 * Earnings Analysis Debug Test Script
 * 
 * This script helps debug why the earnings analysis unlock interface isn't showing
 */

console.log('🔧 EARNINGS ANALYSIS DEBUG TEST');
console.log('='.repeat(50));

// Helper to get auth token
function getAuthToken() {
  return localStorage.getItem('auth_token');
}

// Test current component state
function testEarningsComponentState() {
  console.log('\n📋 Testing Earnings Component State...');
  
  // Check if we can access React component state
  const earningsContainer = document.querySelector('[data-testid="earnings-analysis-section"], .grid.grid-cols-1.lg\\:grid-cols-2 > div:nth-child(2)');
  
  if (!earningsContainer) {
    console.log('❌ Could not find earnings analysis container in DOM');
    return false;
  }
  
  console.log('✅ Found earnings analysis container');
  
  // Check what's currently displayed
  const hasUpgradeCard = earningsContainer.querySelector('[class*="upgrade"], [class*="Crown"]');
  const hasUnlockOverlay = earningsContainer.querySelector('[class*="unlock"], button[class*="gradient"]');
  const hasSelectTicker = earningsContainer.textContent?.includes('Select a ticker');
  const hasLoadingSpinner = earningsContainer.querySelector('[class*="animate-spin"]');
  const hasAnalysisData = earningsContainer.querySelector('[class*="analysis"], [data-testid="earnings-analysis-data"]');
  const hasErrorMessage = earningsContainer.textContent?.includes('Error') || earningsContainer.querySelector('[class*="AlertTriangle"]');
  
  console.log('\n🔍 Current UI State:');
  console.log(`   Upgrade Card (Free users): ${hasUpgradeCard ? '✅ VISIBLE' : '❌ Not shown'}`);
  console.log(`   Unlock Overlay (Pro users): ${hasUnlockOverlay ? '✅ VISIBLE' : '❌ Not shown'}`);
  console.log(`   Select Ticker message: ${hasSelectTicker ? '✅ VISIBLE' : '❌ Not shown'}`);
  console.log(`   Loading spinner: ${hasLoadingSpinner ? '✅ VISIBLE' : '❌ Not shown'}`);
  console.log(`   Analysis data: ${hasAnalysisData ? '✅ VISIBLE' : '❌ Not shown'}`);
  console.log(`   Error message: ${hasErrorMessage ? '✅ VISIBLE' : '❌ Not shown'}`);
  
  // Check text content for debugging
  const textContent = earningsContainer.textContent;
  console.log(`\n📝 Container text content: "${textContent?.substring(0, 200)}..."`);
  
  return true;
}

// Test tier and session state
async function testTierAndSessionState() {
  console.log('\n📋 Testing Tier and Session State...');
  
  const token = getAuthToken();
  if (!token) {
    console.log('❌ Not logged in - cannot test session state');
    return false;
  }
  
  try {
    // Check tier info
    const tierResponse = await fetch('http://localhost:3001/api/credits/balance', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (tierResponse.ok) {
      const tierData = await tierResponse.json();
      console.log(`✅ Current tier: ${tierData.tier || 'Unknown'}`);
      console.log(`✅ Credits available: ${tierData.credits?.available || 0}`);
    }
    
    // Check session state
    const sessionResponse = await fetch('http://localhost:3001/api/credits/component-access/earningsAnalysis', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      console.log(`✅ Earnings analysis access: ${sessionData.hasAccess ? 'UNLOCKED' : 'LOCKED'}`);
      
      if (sessionData.hasAccess && sessionData.session) {
        console.log(`✅ Session expires: ${new Date(sessionData.session.expires_at).toLocaleString()}`);
        console.log(`✅ Time remaining: ${Math.round(sessionData.session.timeRemainingHours * 10) / 10}h`);
      }
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Error checking tier/session state: ${error.message}`);
    return false;
  }
}

// Test what conditional path is being taken
function testConditionalLogic() {
  console.log('\n📋 Testing Conditional Logic...');
  
  // Try to access React component state via dev tools
  try {
    // This might not work in production builds
    const reactRoot = document.querySelector('#root');
    if (reactRoot && reactRoot._reactInternalFiber) {
      console.log('⚠️ React dev tools not available - cannot inspect component state');
    }
  } catch (e) {
    console.log('⚠️ Cannot access React component state directly');
  }
  
  // Check localStorage for any cached state
  const relevantKeys = Object.keys(localStorage).filter(key => 
    key.includes('earnings') || key.includes('unlock') || key.includes('tier') || key.includes('session')
  );
  
  if (relevantKeys.length > 0) {
    console.log('\n💾 Relevant localStorage data:');
    relevantKeys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        const parsed = value && value.startsWith('{') ? JSON.parse(value) : value;
        console.log(`   ${key}: ${typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : parsed}`);
      } catch (e) {
        console.log(`   ${key}: ${value} (failed to parse)`);
      }
    });
  } else {
    console.log('✅ No relevant localStorage data found');
  }
}

// Run all tests
async function runEarningsDebugTests() {
  console.log('🧪 Running Earnings Analysis Debug Tests...\n');
  
  const test1 = testEarningsComponentState();
  const test2 = await testTierAndSessionState();
  const test3 = testConditionalLogic();
  
  console.log('\n📊 DEBUG TEST RESULTS:');
  console.log('='.repeat(30));
  console.log(`Component State Check: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Tier/Session Check: ${test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Conditional Logic Check: ✅ PASS`);
  
  console.log('\n💡 Next Steps:');
  console.log('1. Check if the component is showing the right conditional branch');
  console.log('2. Verify tier and session data is correct');
  console.log('3. Look for any console errors or React warnings');
  console.log('4. Check if the component is re-rendering correctly');
}

// Expose functions to window for manual testing
window.debugEarnings = runEarningsDebugTests;
window.testEarningsUI = testEarningsComponentState;
window.testEarningsTier = testTierAndSessionState;

// Auto-run tests
runEarningsDebugTests();

console.log('\n💡 You can also run individual tests:');
console.log('   debugEarnings() - Run all debug tests');
console.log('   testEarningsUI() - Check UI state');
console.log('   testEarningsTier() - Check tier/session state'); 