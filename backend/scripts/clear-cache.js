const { pool } = require('../src/config/data-sources');

async function clearCache() {
  try {
    // Clear old cached sentiment data
    const result = await pool.query(`
      DELETE FROM sentiment_research_data 
      WHERE user_id = $1
    `, ['e0c943d4-da2e-4490-916b-7927e765e83d']);
    
    console.log(`✅ Deleted ${result.rowCount} old cache entries with timezone issues`);
    
    // Check remaining data
    const remaining = await pool.query(`
      SELECT COUNT(*) as count 
      FROM sentiment_research_data 
      WHERE user_id = $1
    `, ['e0c943d4-da2e-4490-916b-7927e765e83d']);
    
    console.log(`📊 Remaining cache entries for user: ${remaining.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
  } finally {
    await pool.end();
  }
}

clearCache(); 