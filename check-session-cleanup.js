const { Pool } = require('pg');

// Database configuration - using Railway
const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkSessionCleanup() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Analyzing Research Session Cleanup Status\n');
    
    // 1. Check for active sessions
    console.log('📊 ACTIVE SESSIONS:');
    const activeSessions = await client.query(`
      SELECT 
        user_id,
        component,
        session_id,
        credits_used,
        unlocked_at,
        expires_at,
        status,
        EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))/3600 as hours_remaining,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - unlocked_at))/3600 as hours_since_unlock,
        metadata->>'tier' as tier
      FROM research_sessions 
      WHERE status = 'active'
      ORDER BY unlocked_at DESC
    `);
    
    if (activeSessions.rows.length === 0) {
      console.log('   ✅ No active sessions found');
    } else {
      console.table(activeSessions.rows.map(session => ({
        Component: session.component,
        User: session.user_id,
        Tier: session.tier || 'unknown',
        Credits: session.credits_used,
        'Hours Remaining': Math.round(session.hours_remaining * 100) / 100,
        'Hours Since Unlock': Math.round(session.hours_since_unlock * 100) / 100,
        Status: session.status,
        'Expires At': new Date(session.expires_at).toLocaleString()
      })));
    }
    
    // 2. Check for expired sessions that should be cleaned up
    console.log('\n⏰ EXPIRED SESSIONS THAT NEED CLEANUP:');
    const expiredSessions = await client.query(`
      SELECT 
        user_id,
        component,
        session_id,
        status,
        expires_at,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - expires_at))/3600 as hours_past_expiry
      FROM research_sessions 
      WHERE status = 'active' 
        AND expires_at < CURRENT_TIMESTAMP
      ORDER BY expires_at DESC
    `);
    
    if (expiredSessions.rows.length === 0) {
      console.log('   ✅ No expired sessions found');
    } else {
      console.log(`   ❌ Found ${expiredSessions.rows.length} expired sessions that should be cleaned up:`);
      console.table(expiredSessions.rows.map(session => ({
        Component: session.component,
        User: session.user_id,
        Status: session.status,
        'Hours Past Expiry': Math.round(session.hours_past_expiry * 100) / 100,
        'Expired At': new Date(session.expires_at).toLocaleString()
      })));
    }
    
    // 3. Test the cleanup function
    console.log('\n🧹 TESTING CLEANUP FUNCTION:');
    const cleanupResult = await client.query('SELECT cleanup_expired_sessions()');
    const expiredCount = cleanupResult.rows[0].cleanup_expired_sessions;
    console.log(`   ✅ Cleanup function executed: ${expiredCount} sessions marked as expired`);
    
    // 4. Check session duration configurations
    console.log('\n⚙️ SESSION DURATION ANALYSIS:');
    const sessionDurations = await client.query(`
      SELECT 
        metadata->>'tier' as tier,
        component,
        EXTRACT(EPOCH FROM (expires_at - unlocked_at))/3600 as session_duration_hours,
        COUNT(*) as count
      FROM research_sessions 
      WHERE status IN ('active', 'expired')
        AND unlocked_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
      GROUP BY metadata->>'tier', component, EXTRACT(EPOCH FROM (expires_at - unlocked_at))/3600
      ORDER BY tier, component, session_duration_hours
    `);
    
    if (sessionDurations.rows.length > 0) {
      console.table(sessionDurations.rows.map(row => ({
        Tier: row.tier || 'unknown',
        Component: row.component,
        'Duration (hours)': Math.round(row.session_duration_hours * 100) / 100,
        'Session Count': row.count
      })));
    }
    
    // 5. Check for long-running sessions
    console.log('\n🚨 LONG-RUNNING SESSIONS (>6 hours):');
    const longRunningSessions = await client.query(`
      SELECT 
        user_id,
        component,
        session_id,
        status,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - unlocked_at))/3600 as hours_running,
        EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))/3600 as hours_remaining,
        metadata->>'tier' as tier
      FROM research_sessions 
      WHERE status = 'active'
        AND unlocked_at < CURRENT_TIMESTAMP - INTERVAL '6 hours'
      ORDER BY unlocked_at ASC
    `);
    
    if (longRunningSessions.rows.length === 0) {
      console.log('   ✅ No long-running sessions found');
    } else {
      console.log(`   ❌ Found ${longRunningSessions.rows.length} sessions running longer than 6 hours:`);
      console.table(longRunningSessions.rows.map(session => ({
        Component: session.component,
        User: session.user_id,
        Tier: session.tier || 'unknown',
        'Hours Running': Math.round(session.hours_running * 100) / 100,
        'Hours Remaining': Math.round(session.hours_remaining * 100) / 100,
        Status: session.status
      })));
    }
    
    // 6. Check cache cleanup frequency
    console.log('\n📈 CACHE CLEANUP ANALYSIS:');
    try {
      const cacheStats = await client.query('SELECT * FROM get_sentiment_cache_stats()');
      if (cacheStats.rows.length > 0) {
        const stats = cacheStats.rows[0];
        console.log(`   📊 Total cached records: ${stats.total_cached_records}`);
        console.log(`   📊 Active sessions: ${stats.active_sessions}`);
        console.log(`   📊 Expired records: ${stats.expired_records}`);
        console.log(`   📊 Cache size: ${stats.total_data_size_mb}MB`);
        
        if (stats.expired_records > 0) {
          console.log(`   ⚠️  WARNING: ${stats.expired_records} expired cache records need cleanup`);
        }
      }
    } catch (error) {
      console.log('   ⚠️  Cache stats function not available:', error.message);
    }
    
    // 7. Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (expiredSessions.rows.length > 0) {
      console.log('   🔧 ISSUE: Expired sessions are not being cleaned up automatically');
      console.log('   💡 SOLUTION: The cleanup function exists but is only called manually');
      console.log('   📝 ACTION: Implement automatic cleanup via cron job or scheduled task');
    }
    
    if (longRunningSessions.rows.length > 0) {
      console.log('   🔧 ISSUE: Sessions are running longer than expected durations');
      console.log('   💡 SOLUTION: Check tier-based duration limits and enforce them');
    }
    
    // Expected durations by tier
    const expectedDurations = {
      'free': 0.5,        // 30 minutes
      'pro': 2,           // 2 hours
      'elite': 4,         // 4 hours
      'institutional': 8  // 8 hours
    };
    
    console.log('\n📋 EXPECTED SESSION DURATIONS:');
    Object.entries(expectedDurations).forEach(([tier, hours]) => {
      console.log(`   ${tier.toUpperCase()}: ${hours} hours`);
    });
    
    // 8. Suggest cleanup schedule
    console.log('\n⏰ SUGGESTED CLEANUP SCHEDULE:');
    console.log('   🔄 Run cleanup_expired_sessions() every 15 minutes');
    console.log('   🔄 Run sentiment cache cleanup every 30 minutes');
    console.log('   🔄 Check for sessions exceeding maximum duration daily');
    
  } catch (error) {
    console.error('❌ Error analyzing sessions:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the analysis
checkSessionCleanup(); 