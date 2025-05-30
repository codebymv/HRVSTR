/**
 * Test script for credit purchase functionality
 * Run with: node test-credit-purchase.js
 */

const BASE_URL = 'http://localhost:5000'; // Adjust to your backend URL

// Test data
const TEST_USER = {
  email: 'test@example.com',
  token: 'your_test_token_here' // Replace with actual test token
};

async function testCreditPurchaseFlow() {
  console.log('🧪 Testing Credit Purchase Flow\n');
  
  try {
    // Test 1: Create checkout session
    console.log('1. Testing checkout session creation...');
    const checkoutResponse = await fetch(`${BASE_URL}/api/billing/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_USER.token}`
      },
      body: JSON.stringify({
        priceId: 'price_100_credits_bundle',
        mode: 'payment',
        quantity: 1,
        successUrl: 'http://localhost:3000/settings/usage?credits_purchased=true',
        cancelUrl: 'http://localhost:3000/settings/usage?purchase_cancelled=true'
      })
    });
    
    const checkoutData = await checkoutResponse.json();
    console.log('✅ Checkout session response:', checkoutData);
    
    // Test 2: Simulate webhook (you'll need to test this with actual Stripe events)
    console.log('\n2. Webhook testing requires actual Stripe events');
    console.log('💡 Use Stripe CLI: stripe listen --forward-to localhost:5000/api/billing/webhook');
    
    // Test 3: Verify billing endpoints exist
    console.log('\n3. Testing billing endpoints availability...');
    const endpoints = [
      '/api/billing/subscription',
      '/api/billing/payment-methods', 
      '/api/billing/invoices'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
          headers: { 'Authorization': `Bearer ${TEST_USER.token}` }
        });
        console.log(`✅ ${endpoint}: ${response.status}`);
      } catch (error) {
        console.log(`❌ ${endpoint}: Error - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('- Backend server is running');
    console.log('- Environment variables are set');
    console.log('- Valid auth token is provided');
  }
}

// Price ID validation
function validatePriceIds() {
  console.log('\n💳 Validating Price ID Configuration');
  
  const expectedPriceIds = [
    'price_100_credits_bundle',
    'price_250_credits_bundle', 
    'price_500_credits_bundle'
  ];
  
  expectedPriceIds.forEach(priceId => {
    console.log(`📋 ${priceId} - Configure this in Stripe Dashboard`);
  });
  
  console.log('\n🔧 Environment Variables Needed:');
  console.log('Backend (.env):');
  console.log('- STRIPE_SECRET_KEY');
  console.log('- STRIPE_WEBHOOK_SECRET');
  console.log('- FRONTEND_URL');
  
  console.log('\nFrontend (.env):');
  console.log('- REACT_APP_STRIPE_PUBLISHABLE_KEY');
  console.log('- REACT_APP_STRIPE_CREDITS_100_PRICE_ID');
  console.log('- REACT_APP_STRIPE_CREDITS_250_PRICE_ID');
  console.log('- REACT_APP_STRIPE_CREDITS_500_PRICE_ID');
}

// Run tests
async function main() {
  console.log('🚀 HRVSTR Credit Purchase Test Suite\n');
  
  validatePriceIds();
  
  // Only run API tests if token is provided
  if (TEST_USER.token !== 'your_test_token_here') {
    await testCreditPurchaseFlow();
  } else {
    console.log('\n⚠️  Skipping API tests - Please set TEST_USER.token');
  }
  
  console.log('\n📚 Next Steps:');
  console.log('1. Set up Stripe products and price IDs');
  console.log('2. Configure environment variables');
  console.log('3. Test with Stripe CLI webhook forwarding');
  console.log('4. Test end-to-end with test credit card');
}

main().catch(console.error); 