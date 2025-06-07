const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway',
  ssl: { rejectUnauthorized: false }
});

async function testCleanupFunction() {
  try {
    console.log('🧪 Testing cleanup function with a mock expired session...');
    
    // First, get a user ID to work with
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    const userId = userResult.rows[0].id;
    console.log(`📋 Using user ID: ${userId}`);
    
    // Create a test session that's already expired
    const testSessionId = `test_expired_session_${Date.now()}`;
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
    
    console.log('➕ Creating test expired session...');
    await pool.query(`
      INSERT INTO research_sessions (
        user_id, 
        session_id, 
        component, 
        credits_used, 
        unlocked_at,
        expires_at,
        status,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      userId,
      testSessionId,
      'testComponent',
      10,
      threeHoursAgo,
      oneHourAgo, // Expired 1 hour ago
      'active', // Still marked as active (should be processed by cleanup)
      JSON.stringify({
        tier: 'pro',
        unlockDurationHours: 2,
        test_session: true
      })
    ]);
    
    console.log('✅ Test session created');
    
    // Check activities before cleanup
    const activitiesBefore = await pool.query(`
      SELECT COUNT(*) as count 
      FROM activities 
      WHERE activity_type = 'research_expired' 
      AND created_at > NOW() - INTERVAL '5 minutes'
    `);
    console.log(`📝 Expiration activities in last 5 minutes (before): ${activitiesBefore.rows[0].count}`);
    
    // Run cleanup function
    console.log('🧹 Running cleanup function...');
    const cleanupResult = await pool.query('SELECT cleanup_expired_sessions()');
    const expiredCount = cleanupResult.rows[0].cleanup_expired_sessions;
    console.log(`✅ Cleanup result: ${expiredCount} sessions processed`);
    
    // Check activities after cleanup
    const activitiesAfter = await pool.query(`
      SELECT COUNT(*) as count 
      FROM activities 
      WHERE activity_type = 'research_expired' 
      AND created_at > NOW() - INTERVAL '5 minutes'
    `);
    console.log(`📝 Expiration activities in last 5 minutes (after): ${activitiesAfter.rows[0].count}`);
    
    // Check if our test session was processed
    const testSession = await pool.query(`
      SELECT status FROM research_sessions WHERE session_id = $1
    `, [testSessionId]);
    
    if (testSession.rows.length > 0) {
      console.log(`📋 Test session status: ${testSession.rows[0].status}`);
    }
    
    // Get the new activity if created
    const newActivity = await pool.query(`
      SELECT title, description, created_at
      FROM activities 
      WHERE activity_type = 'research_expired' 
      AND created_at > NOW() - INTERVAL '2 minutes'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (newActivity.rows.length > 0) {
      console.log('🆕 New expiration activity created:');
      console.log(`   Title: ${newActivity.rows[0].title}`);
      console.log(`   Description: ${newActivity.rows[0].description}`);
      console.log(`   Created: ${new Date(newActivity.rows[0].created_at).toLocaleString()}`);
    } else {
      console.log('❌ No new expiration activity was created');
    }
    
    // Clean up test session
    await pool.query('DELETE FROM research_sessions WHERE session_id = $1', [testSessionId]);
    console.log('🧽 Test session cleaned up');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testCleanupFunction(); 