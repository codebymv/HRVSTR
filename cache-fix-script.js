/**
 * Cache Clear Fix Script
 * Uses the correct endpoints that actually exist in the backend
 */

console.log('🧹 CLEARING EARNINGS CACHE WITH CORRECT ENDPOINTS');
console.log('='.repeat(50));

async function clearAllCaches() {
  const token = localStorage.getItem('auth_token');
  
  try {
    console.log('1️⃣ Clearing user-specific earnings cache...');
    
    // Use DELETE method for user cache (correct endpoint)
    const userCacheResponse = await fetch('http://localhost:3001/api/earnings/cache/clear', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (userCacheResponse.ok) {
      const result = await userCacheResponse.json();
      console.log('✅ User cache cleared:', result);
    } else {
      console.log('⚠️ User cache clear response:', userCacheResponse.status);
    }
    
    console.log('2️⃣ Clearing global earnings cache...');
    
    // Use GET method for global cache (correct endpoint)
    const globalCacheResponse = await fetch('http://localhost:3001/api/earnings/clear-cache', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (globalCacheResponse.ok) {
      const result = await globalCacheResponse.json();
      console.log('✅ Global cache cleared:', result);
    } else {
      console.log('⚠️ Global cache clear response:', globalCacheResponse.status);
    }
    
    console.log('3️⃣ Clearing frontend cache...');
    localStorage.removeItem('earnings_upcomingEarnings');
    localStorage.removeItem('earnings_lastFetchTime');
    console.log('✅ Frontend cache cleared');
    
    console.log('4️⃣ Reloading page...');
    setTimeout(() => {
      location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Cache clear error:', error);
    
    // Fallback: just clear frontend and reload
    localStorage.removeItem('earnings_upcomingEarnings');
    localStorage.removeItem('earnings_lastFetchTime');
    console.log('🔄 Cleared frontend cache and reloading...');
    location.reload();
  }
}

// Run the cache clear
clearAllCaches(); 