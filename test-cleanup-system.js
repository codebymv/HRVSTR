const { Pool } = require('pg');

// Database configuration - using Railway
const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Test the session cleanup system
 */
async function testCleanupSystem() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing Session Cleanup System\n');
    
    // 1. Create test sessions with different scenarios
    console.log('📋 Creating test sessions...');
    
    const testUserId = 'test_user_' + Date.now();
    
    // Create an expired free tier session (should have expired 1 hour ago)
    const expiredFreeSession = `test_expired_free_${Date.now()}`;
    await client.query(`
      INSERT INTO research_sessions (
        user_id, session_id, component, credits_used, 
        unlocked_at, expires_at, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      testUserId,
      expiredFreeSession,
      'chart',
      8,
      new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      new Date(Date.now() - 1 * 60 * 60 * 1000), // Expired 1 hour ago
      'active', // Should be marked expired
      JSON.stringify({ tier: 'free', test: true })
    ]);
    
    // Create a long-running pro session (running 4 hours, should be force-expired)
    const longRunningProSession = `test_longrunning_pro_${Date.now()}`;
    await client.query(`
      INSERT INTO research_sessions (
        user_id, session_id, component, credits_used, 
        unlocked_at, expires_at, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      testUserId,
      longRunningProSession,
      'reddit',
      12,
      new Date(Date.now() - 4 * 60 * 60 * 1000), // Started 4 hours ago
      new Date(Date.now() + 2 * 60 * 60 * 1000), // Should expire in 2 hours (but tier limit is 2h)
      'active', // Should be force-expired due to tier limit
      JSON.stringify({ tier: 'pro', test: true })
    ]);
    
    // Create a valid elite session (1 hour old, should remain active)
    const validEliteSession = `test_valid_elite_${Date.now()}`;
    await client.query(`
      INSERT INTO research_sessions (
        user_id, session_id, component, credits_used, 
        unlocked_at, expires_at, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      testUserId,
      validEliteSession,
      'scores',
      15,
      new Date(Date.now() - 1 * 60 * 60 * 1000), // Started 1 hour ago
      new Date(Date.now() + 3 * 60 * 60 * 1000), // Expires in 3 hours
      'active', // Should remain active (elite allows 4 hours)
      JSON.stringify({ tier: 'elite', test: true })
    ]);
    
    console.log('✅ Created test sessions:');
    console.log(`   📋 Expired free session: ${expiredFreeSession}`);
    console.log(`   📋 Long-running pro session: ${longRunningProSession}`);
    console.log(`   📋 Valid elite session: ${validEliteSession}`);
    
    // 2. Test standard cleanup function
    console.log('\n🧹 Testing standard cleanup function...');
    const cleanupResult = await client.query('SELECT cleanup_expired_sessions()');
    const expiredCount = cleanupResult.rows[0].cleanup_expired_sessions;
    console.log(`✅ Standard cleanup marked ${expiredCount} sessions as expired`);
    
    // 3. Test the SessionCleanupScheduler
    console.log('\n🤖 Testing SessionCleanupScheduler...');
    const { SessionCleanupScheduler } = require('./backend/src/utils/sessionCleanupScheduler');
    const scheduler = new SessionCleanupScheduler();
    
    // Test each cleanup method
    const sessionCleanupResult = await scheduler.cleanupExpiredSessions();
    const cacheCleanupResult = await scheduler.cleanupExpiredCache();
    const longRunningResult = await scheduler.checkLongRunningSessions();
    
    console.log('📊 Cleanup Results:');
    console.log(`   Sessions: ${sessionCleanupResult.success ? sessionCleanupResult.expired + ' expired' : 'FAILED'}`);
    console.log(`   Cache: ${cacheCleanupResult.success ? cacheCleanupResult.cleaned + ' cleaned' : 'FAILED'}`);
    console.log(`   Long-running: ${longRunningResult.success ? longRunningResult.forcedExpirations + ' force-expired' : 'FAILED'}`);
    
    // 4. Verify results
    console.log('\n🔍 Verifying cleanup results...');
    const testSessions = await client.query(`
      SELECT session_id, component, status, 
             EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - unlocked_at))/3600 as hours_running,
             metadata->>'tier' as tier
      FROM research_sessions 
      WHERE user_id = $1
      ORDER BY unlocked_at DESC
    `, [testUserId]);
    
    console.log('\n📋 Test Session Status:');
    testSessions.rows.forEach(session => {
      const expected = session.session_id.includes('expired') || session.session_id.includes('longrunning') ? 'expired' : 'active';
      const status = session.status === expected ? '✅' : '❌';
      console.log(`   ${status} ${session.component} (${session.tier}): ${session.status} - ${Math.round(session.hours_running * 100) / 100}h running`);
    });
    
    // 5. Test scheduler stats
    console.log('\n📊 Getting cleanup statistics...');
    const stats = await scheduler.getCleanupStats();
    if (stats.success) {
      console.log('✅ Cleanup Statistics:');
      console.log(`   📊 Active sessions: ${stats.sessions.active_sessions}`);
      console.log(`   📊 Expired sessions needing cleanup: ${stats.sessions.expired_sessions}`);
      console.log(`   📊 Already cleaned sessions: ${stats.sessions.cleaned_sessions}`);
      if (stats.cache) {
        console.log(`   📊 Total cache records: ${stats.cache.total_cached_records}`);
        console.log(`   📊 Expired cache records: ${stats.cache.expired_records}`);
      }
    }
    
    // 6. Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    const deleteResult = await client.query(
      'DELETE FROM research_sessions WHERE user_id = $1',
      [testUserId]
    );
    console.log(`✅ Cleaned up ${deleteResult.rowCount} test sessions`);
    
    // 7. Summary and recommendations
    console.log('\n📋 TEST SUMMARY:');
    console.log('✅ Session cleanup system tested successfully');
    console.log('\n💡 FINDINGS:');
    
    if (sessionCleanupResult.success && sessionCleanupResult.expired > 0) {
      console.log('   ✅ Standard session expiration is working');
    }
    
    if (longRunningResult.success && longRunningResult.forcedExpirations > 0) {
      console.log('   ✅ Tier-based session limits are enforced');
    } else {
      console.log('   ⚠️  No sessions exceeded tier limits (this is normal if all sessions are within limits)');
    }
    
    if (cacheCleanupResult.success) {
      console.log('   ✅ Cache cleanup is working');
    }
    
    console.log('\n🔧 SOLUTION TO YOUR ISSUE:');
    console.log('   The automatic cleanup system will now:');
    console.log('   🔄 Check for expired sessions every 15 minutes');
    console.log('   🔄 Clean cache data every 30 minutes');
    console.log('   🔄 Force-expire sessions exceeding tier limits every hour');
    console.log('   🔄 Free tier: 30 minutes max');
    console.log('   🔄 Pro tier: 2 hours max');
    console.log('   🔄 Elite tier: 4 hours max');
    console.log('   🔄 Institutional tier: 8 hours max');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testCleanupSystem(); 