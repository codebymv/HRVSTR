const { Pool } = require('pg');

// Database configuration - using Railway (same as apply-sentiment-research-data.js)
const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function clearOldCache() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Clearing old cached sentiment data with timezone issues...');
    
    // Clear old cached sentiment data for the specific user
    const result = await client.query(`
      DELETE FROM sentiment_research_data 
      WHERE user_id = $1
    `, ['e0c943d4-da2e-4490-916b-7927e765e83d']);
    
    console.log(`✅ Deleted ${result.rowCount} old cache entries`);
    
    // Check remaining data
    const remaining = await client.query(`
      SELECT COUNT(*) as count 
      FROM sentiment_research_data 
      WHERE user_id = $1
    `, ['e0c943d4-da2e-4490-916b-7927e765e83d']);
    
    console.log(`📊 Remaining cache entries for user: ${remaining.rows[0].count}`);
    
    // Also check overall cache state
    const total = await client.query('SELECT COUNT(*) as total FROM sentiment_research_data');
    console.log(`📊 Total cache entries in system: ${total.rows[0].total}`);
    
    console.log('');
    console.log('🎉 Cache clearing completed!');
    console.log('💡 Now when you test the sentiment page, fresh data will be stored with correct UTC timestamps');
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  try {
    await clearOldCache();
    console.log('✅ Cache clearing completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cache clearing failed:', error.message);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main();
}

module.exports = { clearOldCache }; 