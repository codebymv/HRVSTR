const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testServerStatus() {
  console.log('🔍 Testing server status...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/status`);
    const data = await response.json();
    
    console.log('✅ Server is running');
    console.log(`   - Environment: ${data.environment}`);
    console.log(`   - Version: ${data.version}`);
    console.log(`   - Endpoints: ${data.endpoints.total}`);
    
    // Check if our new endpoints are listed
    const hasHistorical = data.endpoints.available.includes('/api/sentiment/historical/:ticker');
    const hasTrends = data.endpoints.available.includes('/api/sentiment/trends/:ticker');
    const hasComparative = data.endpoints.available.includes('/api/sentiment/comparative');
    const hasSummary = data.endpoints.available.includes('/api/sentiment/summary/:ticker');
    
    console.log('✅ New historical sentiment endpoints are registered:');
    console.log(`   - Historical: ${hasHistorical ? '✅' : '❌'}`);
    console.log(`   - Trends: ${hasTrends ? '✅' : '❌'}`);
    console.log(`   - Comparative: ${hasComparative ? '✅' : '❌'}`);
    console.log(`   - Summary: ${hasSummary ? '✅' : '❌'}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Server status check failed:', error.message);
    return false;
  }
}

async function testAuthenticationRequirement() {
  console.log('\n🔐 Testing authentication requirements...');
  
  const endpoints = [
    '/api/sentiment/historical/AAPL',
    '/api/sentiment/trends/AAPL',
    '/api/sentiment/comparative?tickers=AAPL',
    '/api/sentiment/summary/AAPL'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`);
      
      if (response.status === 401) {
        console.log(`✅ ${endpoint} - Requires authentication (401)`);
      } else if (response.status === 403) {
        console.log(`✅ ${endpoint} - Authentication required (403)`);
      } else {
        console.log(`⚠️  ${endpoint} - Unexpected status: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`❌ ${endpoint} - Connection error: ${error.message}`);
    }
  }
}

async function testManualAggregationWithoutAuth() {
  console.log('\n📊 Testing manual aggregation endpoint (without auth)...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/sentiment/test/manual-aggregation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tickers: ['AAPL'] })
    });
    
    if (response.status === 401 || response.status === 403) {
      console.log('✅ Manual aggregation endpoint requires authentication (expected)');
    } else {
      console.log(`⚠️  Manual aggregation returned status: ${response.status}`);
      const data = await response.text();
      console.log('Response:', data.substring(0, 200));
    }
    
  } catch (error) {
    console.error('❌ Manual aggregation test failed:', error.message);
  }
}

async function checkDatabaseConnection() {
  console.log('\n💾 Checking if historical sentiment table exists...');
  
  try {
    // Try to create a simple database connection test
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway',
      ssl: { rejectUnauthorized: false }
    });
    
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'sentiment_history'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ sentiment_history table exists');
      
      // Check if it has any data
      const countResult = await pool.query('SELECT COUNT(*) as count FROM sentiment_history');
      const count = parseInt(countResult.rows[0].count);
      console.log(`   - Records: ${count}`);
      
      if (count > 0) {
        // Show some sample data
        const sampleResult = await pool.query(`
          SELECT ticker, date, sentiment_score 
          FROM sentiment_history 
          ORDER BY created_at DESC 
          LIMIT 3
        `);
        
        console.log('   - Recent entries:');
        sampleResult.rows.forEach(row => {
          console.log(`     ${row.ticker}: ${row.date} (Score: ${row.sentiment_score})`);
        });
      }
      
    } else {
      console.log('❌ sentiment_history table does not exist');
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

async function suggestNextSteps() {
  console.log('\n📋 Next Steps for Full Testing:');
  console.log('=====================================');
  console.log('');
  console.log('1. 🔑 Set up authentication:');
  console.log('   - Use the frontend to get a valid JWT token');
  console.log('   - Or create a test user and generate a token');
  console.log('');
  console.log('2. 🧪 Test manual aggregation:');
  console.log('   - POST /api/sentiment/test/manual-aggregation');
  console.log('   - With auth header: Authorization: Bearer <token>');
  console.log('   - Body: {"tickers": ["AAPL", "TSLA"]}');
  console.log('');
  console.log('3. 📊 Test historical endpoints:');
  console.log('   - GET /api/sentiment/historical/AAPL?days=30');
  console.log('   - GET /api/sentiment/trends/AAPL?days=30');
  console.log('   - GET /api/sentiment/comparative?tickers=AAPL,TSLA&days=30');
  console.log('   - GET /api/sentiment/summary/AAPL?days=30');
  console.log('');
  console.log('4. 🔄 Verify real-time integration:');
  console.log('   - Make regular sentiment API calls');
  console.log('   - Verify data is auto-saved to sentiment_history');
  console.log('');
  console.log('5. ⏰ Test daily job (optional):');
  console.log('   - Set ENABLE_SENTIMENT_JOB=true');
  console.log('   - Wait for 6 AM UTC or trigger manually');
  console.log('');
}

async function runBasicTests() {
  console.log('🧪 Historical Sentiment API - Basic Tests');
  console.log('==========================================\n');
  
  // Run basic tests that don't require auth
  const serverOk = await testServerStatus();
  
  if (!serverOk) {
    console.log('\n❌ Server is not responding. Make sure it\'s running on port 3001');
    return;
  }
  
  await testAuthenticationRequirement();
  await testManualAggregationWithoutAuth();
  await checkDatabaseConnection();
  await suggestNextSteps();
  
  console.log('\n✅ Basic tests completed!');
  console.log('\nTo run authenticated tests, use the comprehensive test script');
  console.log('with proper JWT token setup.');
}

// Run tests
runBasicTests().catch(console.error); 