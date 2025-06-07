const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway',
  ssl: { rejectUnauthorized: false }
});

async function createTestSession() {
  try {
    console.log('🧪 Creating test session that will expire in 3 minutes...');
    
    // Get a user ID
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('❌ No users found');
      return;
    }
    const userId = userResult.rows[0].id;
    
    // Create session that expires in 3 minutes
    const now = new Date();
    const expiresIn3Min = new Date(now.getTime() + 3 * 60 * 1000);
    const testSessionId = `test_scheduler_session_${Date.now()}`;
    
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
      'schedulerTest',
      10,
      now,
      expiresIn3Min,
      'active',
      JSON.stringify({
        tier: 'pro',
        unlockDurationHours: 0.05, // 3 minutes
        test_session: true,
        created_for: 'scheduler_testing'
      })
    ]);
    
    console.log('✅ Test session created:');
    console.log(`   Session ID: ${testSessionId}`);
    console.log(`   Component: schedulerTest`);
    console.log(`   Unlocked: ${now.toLocaleString()}`);
    console.log(`   Expires: ${expiresIn3Min.toLocaleString()}`);
    console.log(`   User ID: ${userId}`);
    
    console.log('\n⏰ This session should be automatically expired by the scheduler in ~3 minutes');
    console.log('📝 Watch for a "Research Expired" activity to be created');
    
    // Also create an activity for the unlock
    await pool.query(`
      INSERT INTO activities (user_id, activity_type, title, description, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      userId,
      'component_unlock',
      'Research Unlocked',
      '10 Credits Used To Unlock Scheduler Test Research For 0.05 Hours',
      now
    ]);
    
    console.log('✅ Unlock activity created for testing');
    
  } catch (error) {
    console.error('❌ Error creating test session:', error);
  } finally {
    await pool.end();
  }
}

createTestSession(); 