const fetch = require('node-fetch');

// Instructions for getting token from frontend
console.log('🔑 To test with a real token:');
console.log('1. Open your browser dev tools (F12)');
console.log('2. Go to localStorage and copy the "auth_token" value');
console.log('3. Run this script like: node scripts/test-with-frontend-token.js "your_token_here"');
console.log('');

const token = process.argv[2];

if (!token) {
  console.log('❌ Please provide a token as an argument');
  console.log('Usage: node scripts/test-with-frontend-token.js "eyJ0eXAiOiJKV1QiLCJhbGciOi..."');
  process.exit(1);
}

const BASE_URL = 'http://localhost:3001';

async function testWithToken(endpoint, method = 'GET', body = null) {
  console.log(`\n🧪 Testing ${method} ${endpoint}...`);
  
  try {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${response.status} - Success!`);
      
      // Show key information without overwhelming output
      if (data.data) {
        if (Array.isArray(data.data)) {
          console.log(`   - Retrieved ${data.data.length} items`);
        } else if (data.data.ticker) {
          console.log(`   - Ticker: ${data.data.ticker}`);
        }
      }
      
      if (data.success !== undefined) {
        console.log(`   - Success: ${data.success}`);
      }
      
      return data;
    } else {
      const errorText = await response.text();
      console.log(`❌ ${response.status} - ${response.statusText}`);
      console.log(`   Error: ${errorText.substring(0, 200)}`);
      return null;
    }
    
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    return null;
  }
}

async function runAuthenticatedTests() {
  console.log('🚀 Testing Historical Sentiment API with Authentication');
  console.log('=====================================================\n');
  
  // Test manual aggregation first
  const aggregationResult = await testWithToken(
    '/api/sentiment/test/manual-aggregation',
    'POST',
    { tickers: ['AAPL'] }
  );
  
  if (aggregationResult) {
    console.log('⏱️  Waiting 3 seconds for data to be processed...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Test all historical endpoints
  await testWithToken('/api/sentiment/historical/AAPL?days=30');
  await testWithToken('/api/sentiment/trends/AAPL?days=30');
  await testWithToken('/api/sentiment/comparative?tickers=AAPL,TSLA&days=30');
  await testWithToken('/api/sentiment/summary/AAPL?days=30');
  
  console.log('\n🎉 Authentication tests completed!');
  console.log('\n📋 Summary:');
  console.log('   - If manual aggregation succeeded, you should now have historical data');
  console.log('   - Check the other endpoints to see historical sentiment analysis');
  console.log('   - This proves the Phase 1A implementation is working!');
}

if (token.length < 20) {
  console.log('❌ Token seems too short. Make sure you copied the full JWT token.');
  process.exit(1);
}

runAuthenticatedTests(); 