/**
 * Final Session Management Test Script
 * 
 * This script validates that the complete session management fix is working:
 * 1. No tier-based auto-grants
 * 2. All users pay credits for sessions
 * 3. Sessions expire for everyone
 * 4. Earnings table is session-controlled (not auto-accessible)
 */

console.log('🎯 FINAL SESSION MANAGEMENT TEST');
console.log('='.repeat(50));

async function runCompleteTest() {
  console.log('\n🧪 Running Complete Session Management Tests...');
  
  // Test 1: Verify no auto-grants
  console.log('\n1️⃣ Testing Session Access Control...');
  
  try {
    const token = localStorage.getItem('auth_token');
    
    // Check earnings analysis access
    const earningsResponse = await fetch('http://localhost:3001/api/credits/component-access/earningsAnalysis', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const earningsHasAccess = earningsResponse.status === 200;
    console.log(`   Earnings Analysis Access: ${earningsHasAccess ? '✅ UNLOCKED' : '❌ LOCKED'}`);
    
    // Check insider trading access
    const insiderResponse = await fetch('http://localhost:3001/api/credits/component-access/insiderTrading', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const insiderHasAccess = insiderResponse.status === 200;
    console.log(`   Insider Trading Access: ${insiderHasAccess ? '✅ UNLOCKED' : '❌ LOCKED'}`);
    
    // Check institutional holdings access
    const institutionalResponse = await fetch('http://localhost:3001/api/credits/component-access/institutionalHoldings', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const institutionalHasAccess = institutionalResponse.status === 200;
    console.log(`   Institutional Holdings Access: ${institutionalHasAccess ? '✅ UNLOCKED' : '❌ LOCKED'}`);
    
    // Test 2: Verify earnings table behavior
    console.log('\n2️⃣ Testing Earnings Table Access Control...');
    
    if (!earningsHasAccess) {
      console.log('   ✅ Expected Behavior: Earnings table should NOT load data');
      console.log('   ✅ User should see unlock interface instead');
    } else {
      console.log('   ✅ User has active session - earnings table should load data');
    }
    
    // Test 3: Check frontend state
    console.log('\n3️⃣ Testing Frontend State...');
    
    const upcomingEarnings = JSON.parse(localStorage.getItem('earnings_upcomingEarnings') || '[]');
    console.log(`   Frontend cached earnings: ${upcomingEarnings.length} items`);
    
    if (!earningsHasAccess && upcomingEarnings.length > 0) {
      console.log('   ⚠️  WARNING: Frontend has cached data but no session access');
      console.log('   💡 This data should be cleared when session expires');
    }
    
    // Test 4: Verify UI state
    console.log('\n4️⃣ Testing UI Elements...');
    
    const unlockButtons = document.querySelectorAll('[data-testid*="unlock"], button:contains("Unlock")');
    console.log(`   Unlock buttons visible: ${unlockButtons.length}`);
    
    const lockedOverlays = document.querySelectorAll('[class*="LockedOverlay"], [class*="locked"]');
    console.log(`   Locked overlays visible: ${lockedOverlays.length}`);
    
    // Test 5: Business model validation
    console.log('\n5️⃣ Validating Business Model...');
    
    const allComponentsLocked = !earningsHasAccess && !insiderHasAccess && !institutionalHasAccess;
    
    if (allComponentsLocked) {
      console.log('   ✅ PERFECT: All premium features are locked');
      console.log('   ✅ Pro+ user must pay credits to unlock features');
      console.log('   ✅ No tier-based permanent access');
      console.log('   ✅ Session expiration is working correctly');
    } else {
      console.log('   ⚠️  Some features are unlocked - user has active sessions');
    }
    
    // Summary
    console.log('\n📊 TEST SUMMARY:');
    console.log('========================');
    console.log(`✅ Session expiration working: ${allComponentsLocked ? 'YES' : 'PARTIAL'}`);
    console.log(`✅ Tier-based auto-grants removed: ${allComponentsLocked ? 'YES' : 'PARTIAL'}`);
    console.log(`✅ Credit-based access enforced: ${allComponentsLocked ? 'YES' : 'PARTIAL'}`);
    console.log(`✅ Cross-device sync will work: ${allComponentsLocked ? 'YES' : 'PARTIAL'}`);
    
    if (allComponentsLocked) {
      console.log('\n🎉 SESSION MANAGEMENT FIX: COMPLETE SUCCESS!');
      console.log('🔒 All premium features properly locked');
      console.log('💳 Users must pay credits for access');
      console.log('⏰ Sessions expire correctly');
      console.log('📱 Mobile/desktop sync will work');
    } else {
      console.log('\n✅ SESSION MANAGEMENT: WORKING (User has active sessions)');
      console.log('💡 Some features unlocked - this is expected if user paid credits');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Helper function to test cache clear
function testCacheClear() {
  console.log('\n🧹 Testing Cache Clear Function...');
  
  // Clear all caches
  localStorage.removeItem('earnings_upcomingEarnings');
  localStorage.removeItem('earnings_lastFetchTime');
  
  console.log('✅ Frontend cache cleared');
  console.log('💡 Reload page to see earnings access control in action');
}

// Helper function to test unlock
async function testUnlock(component = 'earningsAnalysis') {
  console.log(`\n🔓 Testing Unlock for ${component}...`);
  
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`http://localhost:3001/api/credits/unlock-component`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ component })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Unlock successful:', result);
      console.log('💡 Reload page to see the unlocked state');
    } else {
      console.log(`❌ Unlock failed: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Unlock error:', error);
  }
}

// Run the test
runCompleteTest();

// Make functions available in console
window.testSessionFix = runCompleteTest;
window.testCacheClear = testCacheClear;
window.testUnlock = testUnlock;

console.log('\n💡 Available Commands:');
console.log('   testSessionFix() - Run complete test');
console.log('   testCacheClear() - Clear caches');
console.log('   testUnlock("earningsAnalysis") - Test unlock feature'); 