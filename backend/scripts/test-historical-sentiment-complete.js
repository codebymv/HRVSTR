const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

// Database connection (same as used by the app)
const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3001',
  testUser: {
    email: 'test@historicalsentiment.com',
    name: 'Historical Test User'
  },
  testTickers: ['AAPL', 'TSLA', 'MSFT'],
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-here' // You'll need to set this
};

class HistoricalSentimentTester {
  constructor() {
    this.testUserId = null;
    this.authToken = null;
  }

  async createTestUser() {
    console.log('🔧 Creating test user...');
    
    try {
      // Check if test user already exists
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [TEST_CONFIG.testUser.email]);
      
      if (existingUser.rows.length > 0) {
        this.testUserId = existingUser.rows[0].id;
        console.log('✅ Test user already exists with ID:', this.testUserId);
      } else {
        // Create new test user
        const newUser = await pool.query(
          'INSERT INTO users (email, name, tier) VALUES ($1, $2, $3) RETURNING id',
          [TEST_CONFIG.testUser.email, TEST_CONFIG.testUser.name, 'pro']
        );
        this.testUserId = newUser.rows[0].id;
        console.log('✅ Created new test user with ID:', this.testUserId);
      }

      // Generate JWT token
      this.authToken = jwt.sign(
        { userId: this.testUserId },
        TEST_CONFIG.jwtSecret,
        { expiresIn: '1h' }
      );
      
      console.log('✅ Generated auth token');
      
    } catch (error) {
      console.error('❌ Failed to create test user:', error.message);
      throw error;
    }
  }

  async testManualAggregation() {
    console.log('\n📊 Testing manual aggregation...');
    
    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/sentiment/test/manual-aggregation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({ tickers: TEST_CONFIG.testTickers })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Manual aggregation successful');
      console.log(`   - Processed ${result.data?.processed || 0} tickers`);
      console.log(`   - Success: ${result.data?.successCount || 0}, Failed: ${result.data?.failureCount || 0}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Manual aggregation failed:', error.message);
      throw error;
    }
  }

  async testHistoricalEndpoint(ticker = 'AAPL', days = 30) {
    console.log(`\n📈 Testing historical sentiment for ${ticker}...`);
    
    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/sentiment/historical/${ticker}?days=${days}`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Historical sentiment endpoint working');
      console.log(`   - Retrieved ${result.data?.length || 0} historical data points`);
      console.log(`   - Date range: ${days} days`);
      
      if (result.data && result.data.length > 0) {
        const latest = result.data[0];
        console.log(`   - Latest entry: ${latest.date} (Score: ${latest.sentiment_score})`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Historical sentiment endpoint failed:', error.message);
      throw error;
    }
  }

  async testTrendsEndpoint(ticker = 'AAPL', days = 30) {
    console.log(`\n📊 Testing sentiment trends for ${ticker}...`);
    
    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/sentiment/trends/${ticker}?days=${days}`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Sentiment trends endpoint working');
      console.log(`   - Trend: ${result.data?.trend || 'unknown'}`);
      console.log(`   - Volatility: ${result.data?.volatility || 'N/A'}`);
      console.log(`   - Consistency: ${result.data?.consistency || 'N/A'}%`);
      console.log(`   - Data points: ${result.data?.dataPoints || 0}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Sentiment trends endpoint failed:', error.message);
      throw error;
    }
  }

  async testComparativeEndpoint(tickers = ['AAPL', 'TSLA'], days = 30) {
    console.log(`\n🔄 Testing comparative sentiment for ${tickers.join(', ')}...`);
    
    try {
      const tickersParam = tickers.join(',');
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/sentiment/comparative?tickers=${tickersParam}&days=${days}`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Comparative sentiment endpoint working');
      console.log(`   - Compared ${Object.keys(result.data || {}).length} tickers`);
      
      Object.keys(result.data || {}).forEach(ticker => {
        const data = result.data[ticker];
        console.log(`   - ${ticker}: ${data.length} data points`);
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Comparative sentiment endpoint failed:', error.message);
      throw error;
    }
  }

  async testSummaryEndpoint(ticker = 'AAPL', days = 30) {
    console.log(`\n📋 Testing sentiment summary for ${ticker}...`);
    
    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/sentiment/summary/${ticker}?days=${days}`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Sentiment summary endpoint working');
      console.log(`   - Historical data: ${result.data?.historical?.length || 0} points`);
      console.log(`   - Trend: ${result.data?.trends?.trend || 'unknown'}`);
      console.log(`   - Average sentiment: ${result.data?.trends?.recentAverage || 'N/A'}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Sentiment summary endpoint failed:', error.message);
      throw error;
    }
  }

  async verifyDatabaseData() {
    console.log('\n🔍 Verifying database data...');
    
    try {
      const result = await pool.query(
        'SELECT COUNT(*) as count, MIN(date) as earliest, MAX(date) as latest FROM sentiment_history'
      );
      
      const stats = result.rows[0];
      console.log('✅ Database verification complete');
      console.log(`   - Total records: ${stats.count}`);
      console.log(`   - Date range: ${stats.earliest} to ${stats.latest}`);
      
      // Show recent entries by ticker
      const recentData = await pool.query(
        'SELECT ticker, COUNT(*) as count FROM sentiment_history GROUP BY ticker ORDER BY count DESC LIMIT 5'
      );
      
      console.log('   - Recent data by ticker:');
      recentData.rows.forEach(row => {
        console.log(`     ${row.ticker}: ${row.count} records`);
      });
      
    } catch (error) {
      console.error('❌ Database verification failed:', error.message);
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test user...');
    
    try {
      if (this.testUserId) {
        await pool.query('DELETE FROM users WHERE id = $1', [this.testUserId]);
        console.log('✅ Test user cleaned up');
      }
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Historical Sentiment API Tests');
    console.log('==========================================\n');

    try {
      // Setup
      await this.createTestUser();
      
      // Test manual aggregation first to create data
      await this.testManualAggregation();
      
      // Wait a moment for data to be processed
      console.log('\n⏱️  Waiting 2 seconds for data processing...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test all endpoints
      await this.testHistoricalEndpoint();
      await this.testTrendsEndpoint();
      await this.testComparativeEndpoint();
      await this.testSummaryEndpoint();
      
      // Verify database
      await this.verifyDatabaseData();
      
      console.log('\n🎉 All tests completed successfully!');
      console.log('\n📋 Summary:');
      console.log('   ✅ Manual aggregation working');
      console.log('   ✅ Historical endpoint working');
      console.log('   ✅ Trends endpoint working');
      console.log('   ✅ Comparative endpoint working');
      console.log('   ✅ Summary endpoint working');
      console.log('   ✅ Database integration working');
      
    } catch (error) {
      console.error('\n💥 Test suite failed:', error.message);
      console.log('\n📋 Troubleshooting tips:');
      console.log('   - Ensure server is running on port 3001');
      console.log('   - Check JWT_SECRET environment variable');
      console.log('   - Verify database connection');
      console.log('   - Check server logs for detailed errors');
      
    } finally {
      // Always try to cleanup
      await this.cleanup();
      await pool.end();
    }
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  const tester = new HistoricalSentimentTester();
  tester.runAllTests();
}

module.exports = HistoricalSentimentTester; 