const fetch = require('node-fetch');

async function testManualAggregation() {
  console.log('🧪 Testing manual aggregation for AAPL...');
  
  try {
    const response = await fetch('http://localhost:3001/api/sentiment/test/manual-aggregation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tickers: ['AAPL'] })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Manual aggregation result:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server is not running. Please start the server first with: npm start');
    } else {
      console.log('❌ Test failed:', error.message);
    }
  }
}

testManualAggregation(); 