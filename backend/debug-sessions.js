const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway',
  ssl: { rejectUnauthorized: false }
});

async function debugSessions() {
  try {
    console.log('🔍 Debugging research sessions and activities...');
    
    // Get basic session count and status
    const sessionCount = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM research_sessions 
      WHERE unlocked_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
      ORDER BY status
    `);
    
    console.log('📊 Session counts by status (last 24 hours):');
    sessionCount.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count}`);
    });
    
    // Get recent sessions (simple query first)
    const recentSessions = await pool.query(`
      SELECT 
        component,
        status,
        unlocked_at,
        expires_at
      FROM research_sessions 
      WHERE unlocked_at > NOW() - INTERVAL '24 hours'
      ORDER BY unlocked_at DESC
      LIMIT 10
    `);
    
    console.log(`\n📋 Recent sessions (last 24 hours):`);
    recentSessions.rows.forEach((session, i) => {
      const unlocked = new Date(session.unlocked_at).toLocaleString();
      const expires = new Date(session.expires_at).toLocaleString();
      console.log(`${i+1}. ${session.component} [${session.status}]`);
      console.log(`   Unlocked: ${unlocked}`);
      console.log(`   Expires: ${expires}`);
      console.log('');
    });
    
    // Get unlock activities from last 24 hours
    const unlockActivities = await pool.query(`
      SELECT 
        title,
        description,
        created_at
      FROM activities 
      WHERE activity_type = 'component_unlock'
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
    `);
    
    console.log(`📝 Research unlock activities (last 24 hours): ${unlockActivities.rows.length}`);
    unlockActivities.rows.forEach((activity, i) => {
      const created = new Date(activity.created_at).toLocaleString();
      console.log(`${i+1}. ${activity.title}`);
      console.log(`   ${activity.description}`);
      console.log(`   Created: ${created}`);
      console.log('');
    });
    
    // Get expiration activities
    const expirationActivities = await pool.query(`
      SELECT 
        title,
        description,
        created_at
      FROM activities 
      WHERE activity_type = 'research_expired'
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
    `);
    
    console.log(`🔒 Research expiration activities (last 24 hours): ${expirationActivities.rows.length}`);
    expirationActivities.rows.forEach((activity, i) => {
      const created = new Date(activity.created_at).toLocaleString();
      console.log(`${i+1}. ${activity.title}`);
      console.log(`   ${activity.description}`);
      console.log(`   Created: ${created}`);
      console.log('');
    });
    
    // Run cleanup manually and see what happens
    console.log('🧪 Running cleanup function manually...');
    const cleanupResult = await pool.query('SELECT cleanup_expired_sessions()');
    const expiredCount = cleanupResult.rows[0].cleanup_expired_sessions;
    console.log(`✅ Cleanup result: ${expiredCount} sessions processed`);
    
    // Check for new expiration activities after cleanup
    const newExpirationActivities = await pool.query(`
      SELECT 
        title,
        description,
        created_at
      FROM activities 
      WHERE activity_type = 'research_expired'
        AND created_at > NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC
    `);
    
    console.log(`🆕 New expiration activities (last minute): ${newExpirationActivities.rows.length}`);
    newExpirationActivities.rows.forEach((activity, i) => {
      const created = new Date(activity.created_at).toLocaleString();
      console.log(`${i+1}. ${activity.title}`);
      console.log(`   ${activity.description}`);
      console.log(`   Created: ${created}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugSessions(); 