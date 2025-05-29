/**
 * HRVSTR Auth Debug Script
 * 
 * This script helps debug authentication token issues.
 * Run this in the browser console to find where your auth token is stored.
 */

// Function to search for potential auth tokens
function debugAuth() {
  console.log('🔍 Debugging HRVSTR Authentication...');
  console.log('');
  
  // 1. Check localStorage for all possible token keys
  console.log('📦 LocalStorage Contents:');
  const localStorageKeys = Object.keys(localStorage);
  const potentialTokens = [];
  
  localStorageKeys.forEach(key => {
    const value = localStorage.getItem(key);
    console.log(`  ${key}: ${value}`);
    
    // Look for anything that might be a token
    if (key.toLowerCase().includes('token') || 
        key.toLowerCase().includes('auth') || 
        key.toLowerCase().includes('jwt') ||
        (typeof value === 'string' && value.length > 20 && value.includes('.'))) {
      potentialTokens.push({ key, value });
    }
  });
  
  console.log('');
  
  // 2. Check sessionStorage
  console.log('📦 SessionStorage Contents:');
  const sessionStorageKeys = Object.keys(sessionStorage);
  sessionStorageKeys.forEach(key => {
    const value = sessionStorage.getItem(key);
    console.log(`  ${key}: ${value}`);
    
    if (key.toLowerCase().includes('token') || 
        key.toLowerCase().includes('auth') || 
        key.toLowerCase().includes('jwt') ||
        (typeof value === 'string' && value.length > 20 && value.includes('.'))) {
      potentialTokens.push({ key, value, storage: 'session' });
    }
  });
  
  console.log('');
  
  // 3. Check cookies
  console.log('🍪 Cookies:');
  const cookies = document.cookie.split(';');
  cookies.forEach(cookie => {
    const [key, value] = cookie.trim().split('=');
    console.log(`  ${key}: ${value}`);
    
    if (key && (key.toLowerCase().includes('token') || 
               key.toLowerCase().includes('auth') || 
               key.toLowerCase().includes('jwt'))) {
      potentialTokens.push({ key, value, storage: 'cookie' });
    }
  });
  
  console.log('');
  
  // 4. Show potential tokens
  if (potentialTokens.length > 0) {
    console.log('🎯 Potential Authentication Tokens Found:');
    potentialTokens.forEach((token, index) => {
      console.log(`  ${index + 1}. ${token.key} (${token.storage || 'localStorage'})`);
      console.log(`     Value: ${token.value.substring(0, 50)}${token.value.length > 50 ? '...' : ''}`);
    });
  } else {
    console.log('❌ No potential auth tokens found!');
    console.log('💡 This might mean:');
    console.log('   - You\'re not actually logged in');
    console.log('   - The token is stored in a different way');
    console.log('   - The token is stored in memory only');
  }
  
  console.log('');
  
  // 5. Test current user endpoint
  console.log('🔍 Testing if you can access user info...');
  testUserEndpoint();
  
  return potentialTokens;
}

// Test if we can access user info with different token approaches
async function testUserEndpoint() {
  const tokenKeys = ['token', 'authToken', 'access_token', 'jwt', 'auth', 'accessToken'];
  
  for (const key of tokenKeys) {
    const token = localStorage.getItem(key);
    if (token) {
      console.log(`🧪 Testing with ${key}: ${token.substring(0, 20)}...`);
      
      try {
        const response = await fetch('/api/subscription/tier-info', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ SUCCESS with ${key}! Current tier: ${data.data?.tier}`);
          return token;
        } else {
          console.log(`❌ Failed with ${key}: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ Error with ${key}: ${error.message}`);
      }
    }
  }
  
  // Try without Bearer prefix
  for (const key of tokenKeys) {
    const token = localStorage.getItem(key);
    if (token) {
      console.log(`🧪 Testing ${key} without Bearer prefix...`);
      
      try {
        const response = await fetch('/api/subscription/tier-info', {
          headers: { 'Authorization': token }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ SUCCESS with ${key} (no Bearer)! Current tier: ${data.data?.tier}`);
          return token;
        }
      } catch (error) {
        // Silent fail for this test
      }
    }
  }
  
  // Try session storage
  for (const key of tokenKeys) {
    const token = sessionStorage.getItem(key);
    if (token) {
      console.log(`🧪 Testing sessionStorage ${key}...`);
      
      try {
        const response = await fetch('/api/subscription/tier-info', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ SUCCESS with sessionStorage ${key}! Current tier: ${data.data?.tier}`);
          return token;
        }
      } catch (error) {
        // Silent fail
      }
    }
  }
  
  console.log('❌ No working auth token found');
  return null;
}

// Enhanced token getter
function getAuthToken() {
  // Try multiple possible token keys
  const tokenKeys = [
    'token', 'authToken', 'access_token', 'jwt', 'auth', 'accessToken',
    'user_token', 'authentication_token', 'bearer_token', 'loginToken'
  ];
  
  // Check localStorage first
  for (const key of tokenKeys) {
    const token = localStorage.getItem(key);
    if (token) return token;
  }
  
  // Check sessionStorage
  for (const key of tokenKeys) {
    const token = sessionStorage.getItem(key);
    if (token) return token;
  }
  
  // Check if there's a React/Auth context we can access
  if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
    try {
      // This is a hack to try to access React context, but it's very fragile
      console.log('🔍 Attempting to access React auth context...');
    } catch (e) {
      // Silent fail
    }
  }
  
  return null;
}

// Make functions available globally
window.debugAuth = debugAuth;
window.testUserEndpoint = testUserEndpoint;
window.getAuthToken = getAuthToken;

console.log('🔍 HRVSTR Auth Debugger Loaded!');
console.log('');
console.log('🚀 Run: debugAuth()');
console.log('   This will show all storage contents and try to find your auth token');
console.log(''); 