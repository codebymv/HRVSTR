#!/usr/bin/env node

/**
 * Tier Testing Script for HRVSTR
 * 
 * This script allows you to simulate tier upgrades for testing UI changes.
 * Available tiers: 'free', 'pro', 'elite', 'institutional'
 * 
 * Usage (Browser Console):
 * 1. Open your HRVSTR app in browser
 * 2. Open Developer Tools (F12)
 * 3. Copy and paste this script into the console
 * 4. Run: await changeTier('pro') or changeTier('elite')
 * 
 * Usage (Node.js):
 * node tier-tester.js <tier> [email]
 */

// Configuration - Update these if needed
const API_BASE_URL = 'http://localhost:3001'; // or your backend URL
const DEFAULT_EMAIL = 'codebymv@gmail.com';

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

/**
 * Change user tier via API call
 * Works in both browser console and Node.js
 */
async function changeTier(targetTier, apiUrl = API_BASE_URL) {
  if (!TIERS[targetTier]) {
    console.error('❌ Invalid tier. Available tiers:', Object.keys(TIERS));
    return false;
  }

  try {
    console.log(`🔄 Attempting to change tier to: ${targetTier}`);
    console.log(`📊 Tier features:`, TIERS[targetTier]);

    // Try to get auth token from localStorage (browser) or use environment variable
    let authToken = null;
    
    if (typeof window !== 'undefined' && window.localStorage) {
      // Browser environment
      authToken = localStorage.getItem('token') || localStorage.getItem('authToken');
    } else if (process.env.AUTH_TOKEN) {
      // Node.js environment with token from environment variable
      authToken = process.env.AUTH_TOKEN;
    }

    if (!authToken) {
      console.error('❌ No authentication token found. Please log in first or set AUTH_TOKEN environment variable.');
      console.log('💡 In browser: Make sure you\'re logged in to HRVSTR');
      console.log('💡 In Node.js: Set AUTH_TOKEN=your_token_here as environment variable');
      return false;
    }

    const response = await fetch(`${apiUrl}/api/subscription/simulate-upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ tier: targetTier })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ Successfully changed tier!');
      console.log('📊 New tier info:', data.data);
      console.log('🔄 Refresh your page to see the changes in the UI');
      return true;
    } else {
      console.error('❌ Failed to change tier:', data.error || 'Unknown error');
      if (data.availableTiers) {
        console.log('Available tiers:', data.availableTiers);
      }
      return false;
    }

  } catch (error) {
    console.error('❌ Error changing tier:', error.message);
    console.log('💡 Make sure your backend is running and accessible');
    return false;
  }
}

/**
 * Browser console helper functions
 */
if (typeof window !== 'undefined') {
  // Make functions available globally in browser
  window.changeTier = changeTier;
  window.showAvailableTiers = () => {
    console.table(TIERS);
  };
  
  console.log('🎯 HRVSTR Tier Tester loaded!');
  console.log('📖 Usage:');
  console.log('  await changeTier("pro")     - Upgrade to Pro tier');
  console.log('  await changeTier("elite")   - Upgrade to Elite tier');
  console.log('  await changeTier("free")    - Downgrade to Free tier');
  console.log('  showAvailableTiers()        - Show all available tiers');
  console.log('');
}

/**
 * Node.js CLI usage
 */
if (typeof window === 'undefined' && require.main === module) {
  const args = process.argv.slice(2);
  const targetTier = args[0];
  const email = args[1] || DEFAULT_EMAIL;

  if (!targetTier) {
    console.log('🎯 HRVSTR Tier Tester');
    console.log('Usage: node tier-tester.js <tier> [email]');
    console.log('');
    console.log('Available tiers:');
    console.table(TIERS);
    console.log('');
    console.log('Examples:');
    console.log('  node tier-tester.js pro');
    console.log('  node tier-tester.js elite codebymv@gmail.com');
    console.log('');
    console.log('⚠️  Make sure to set AUTH_TOKEN environment variable first!');
    process.exit(1);
  }

  // Run the tier change
  changeTier(targetTier)
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { changeTier, TIERS };
} 