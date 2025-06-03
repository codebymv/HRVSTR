const { Pool } = require('pg');

// Database configuration - using Railway
const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function cleanupExpiredCache() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Cleaning up expired cache data...\n');
    
    // 1. Clean up expired sentiment research data
    console.log('📊 Cleaning sentiment research data...');
    const sentimentResult = await client.query('SELECT * FROM cleanup_expired_sentiment_data()');
    
    if (sentimentResult.rows.length > 0) {
      const cleanup = sentimentResult.rows[0];
      console.log(`✅ Sentiment cleanup: ${cleanup.total_cleaned} total records removed`);
      console.log(`   📋 Expired data: ${cleanup.expired_data_count} records`);
      console.log(`   📋 Expired session data: ${cleanup.expired_session_data_count} records`);
    }
    
    // 2. Clean up expired sessions
    console.log('\n📊 Cleaning expired sessions...');
    const sessionResult = await client.query('SELECT cleanup_expired_sessions()');
    const expiredSessions = sessionResult.rows[0].cleanup_expired_sessions;
    console.log(`✅ Session cleanup: ${expiredSessions} sessions marked as expired`);
    
    // 3. Try to clean other cache types if they exist
    console.log('\n📊 Cleaning other cache types...');
    
    // SEC cache
    try {
      const secResult = await client.query('SELECT cleanup_expired_sec_cache()');
      const secCleaned = secResult.rows[0].cleanup_expired_sec_cache;
      console.log(`✅ SEC cache cleanup: ${secCleaned} records removed`);
    } catch (error) {
      console.log('⚠️  SEC cache cleanup function not available');
    }
    
    // Earnings cache
    try {
      const earningsResult = await client.query('SELECT cleanup_expired_earnings_cache()');
      const earningsCleaned = earningsResult.rows[0].cleanup_expired_earnings_cache;
      console.log(`✅ Earnings cache cleanup: ${earningsCleaned} records removed`);
    } catch (error) {
      console.log('⚠️  Earnings cache cleanup function not available');
    }
    
    // 4. Get updated cache statistics
    console.log('\n📊 Updated cache statistics:');
    try {
      const cacheStats = await client.query('SELECT * FROM get_sentiment_cache_stats()');
      if (cacheStats.rows.length > 0) {
        const stats = cacheStats.rows[0];
        console.log(`   📋 Total cached records: ${stats.total_cached_records}`);
        console.log(`   📋 Active sessions: ${stats.active_sessions}`);
        console.log(`   📋 Expired records remaining: ${stats.expired_records}`);
        console.log(`   📋 Cache size: ${stats.total_data_size_mb}MB`);
        
        if (stats.expired_records > 0) {
          console.log(`   ⚠️  Warning: ${stats.expired_records} expired records still remain`);
        } else {
          console.log(`   ✅ All expired records have been cleaned up`);
        }
      }
    } catch (error) {
      console.log('⚠️  Cache stats function not available');
    }
    
    // 5. Check for any remaining active sessions
    console.log('\n📊 Checking remaining active sessions:');
    const remainingSessions = await client.query(`
      SELECT 
        component,
        COUNT(*) as count,
        MIN(EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))/3600) as min_hours_remaining,
        MAX(EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))/3600) as max_hours_remaining
      FROM research_sessions 
      WHERE status = 'active' AND expires_at > CURRENT_TIMESTAMP
      GROUP BY component
      ORDER BY component
    `);
    
    if (remainingSessions.rows.length === 0) {
      console.log('   ✅ No active sessions remaining');
    } else {
      console.log('   📋 Active sessions:');
      remainingSessions.rows.forEach(session => {
        const minHours = Math.round(session.min_hours_remaining * 100) / 100;
        const maxHours = Math.round(session.max_hours_remaining * 100) / 100;
        console.log(`     ${session.component}: ${session.count} sessions (${minHours}-${maxHours} hours remaining)`);
      });
    }
    
    console.log('\n✅ Cache cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the cleanup
cleanupExpiredCache(); 