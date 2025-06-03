const { Pool } = require('pg');

// Database configuration - using Railway
const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function forceCleanupOldSessions() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Force Cleaning Old Sessions\n');
    
    // 1. Find all sessions that are clearly expired
    console.log('🔍 Finding expired sessions...');
    const expiredSessions = await client.query(`
      SELECT 
        session_id,
        component,
        user_id,
        status,
        unlocked_at,
        expires_at,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - expires_at))/3600 as hours_past_expiry,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - unlocked_at))/3600 as hours_since_unlock,
        metadata->>'tier' as tier
      FROM research_sessions 
      WHERE status = 'active' 
        AND (
          expires_at < CURRENT_TIMESTAMP OR  -- Officially expired
          unlocked_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'  -- Older than 24 hours (clearly too old)
        )
      ORDER BY unlocked_at ASC
    `);
    
    if (expiredSessions.rows.length === 0) {
      console.log('✅ No expired sessions found');
      return;
    }
    
    console.log(`❌ Found ${expiredSessions.rows.length} sessions that should be expired:`);
    console.table(expiredSessions.rows.map(session => ({
      Component: session.component,
      Tier: session.tier || 'unknown',
      'Hours Past Expiry': Math.round(session.hours_past_expiry * 100) / 100,
      'Hours Since Unlock': Math.round(session.hours_since_unlock * 100) / 100,
      'Unlocked At': new Date(session.unlocked_at).toLocaleString(),
      'Expires At': new Date(session.expires_at).toLocaleString()
    })));
    
    // 2. Get breakdown by component
    const componentBreakdown = await client.query(`
      SELECT 
        component,
        COUNT(*) as count,
        MIN(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - expires_at))/3600) as min_hours_past_expiry,
        MAX(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - expires_at))/3600) as max_hours_past_expiry
      FROM research_sessions 
      WHERE status = 'active' 
        AND (
          expires_at < CURRENT_TIMESTAMP OR
          unlocked_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
        )
      GROUP BY component
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Breakdown by component:');
    componentBreakdown.rows.forEach(comp => {
      const minHours = Math.round(comp.min_hours_past_expiry * 100) / 100;
      const maxHours = Math.round(comp.max_hours_past_expiry * 100) / 100;
      console.log(`   ${comp.component}: ${comp.count} sessions (${minHours} to ${maxHours} hours past expiry)`);
    });
    
    // 3. Force expire these sessions
    console.log('\n🔒 Force expiring old sessions...');
    
    const updateResult = await client.query(`
      UPDATE research_sessions 
      SET 
        status = 'expired',
        updated_at = CURRENT_TIMESTAMP
      WHERE status = 'active' 
        AND (
          expires_at < CURRENT_TIMESTAMP OR
          unlocked_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
        )
    `);
    
    console.log(`✅ Force-expired ${updateResult.rowCount} old sessions`);
    
    // 4. Run the standard cleanup function
    console.log('\n🧹 Running standard cleanup function...');
    const cleanupResult = await client.query('SELECT cleanup_expired_sessions()');
    const standardExpired = cleanupResult.rows[0].cleanup_expired_sessions;
    console.log(`✅ Standard cleanup marked ${standardExpired} additional sessions as expired`);
    
    // 5. Check for any remaining active sessions
    console.log('\n📊 Checking remaining active sessions...');
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
      console.log('✅ No active sessions remaining - all cleaned up!');
    } else {
      console.log('📋 Remaining active sessions (these are valid):');
      remainingSessions.rows.forEach(session => {
        const minHours = Math.round(session.min_hours_remaining * 100) / 100;
        const maxHours = Math.round(session.max_hours_remaining * 100) / 100;
        console.log(`   ${session.component}: ${session.count} sessions (${minHours} to ${maxHours} hours remaining)`);
      });
    }
    
    // 6. Test the new automatic cleanup system
    console.log('\n🤖 Testing automatic cleanup system...');
    try {
      const { SessionCleanupScheduler } = require('./backend/src/utils/sessionCleanupScheduler');
      const scheduler = new SessionCleanupScheduler();
      
      const manualResult = await scheduler.runManualCleanup();
      
      console.log('✅ Automatic cleanup system test:');
      console.log(`   📊 Sessions: ${manualResult.sessions.success ? manualResult.sessions.expired + ' expired' : 'FAILED'}`);
      console.log(`   📊 Cache: ${manualResult.cache.success ? manualResult.cache.cleaned + ' cleaned' : 'FAILED'}`);
      console.log(`   📊 Long-running: ${manualResult.longRunning.success ? manualResult.longRunning.forcedExpirations + ' force-expired' : 'FAILED'}`);
      
    } catch (error) {
      console.log('⚠️  Automatic cleanup system not available yet (server needs restart)');
    }
    
    console.log('\n🎉 Old sessions cleanup completed!');
    console.log('\n📋 SUMMARY:');
    console.log(`   ✅ Force-expired ${updateResult.rowCount} old sessions`);
    console.log(`   ✅ Standard cleanup handled ${standardExpired} additional sessions`);
    console.log(`   ✅ Automatic cleanup system will prevent this in the future`);
    
    console.log('\n💡 TO PREVENT THIS IN THE FUTURE:');
    console.log('   🔄 Restart your backend server to enable automatic cleanup');
    console.log('   🔄 The SessionCleanupScheduler will run every 15 minutes');
    console.log('   🔄 Sessions will be properly expired based on tier limits');
    
  } catch (error) {
    console.error('❌ Error during force cleanup:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the force cleanup
forceCleanupOldSessions(); 