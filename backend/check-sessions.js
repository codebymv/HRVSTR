const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkSessions() {
  try {
    console.log('🔍 Checking current research sessions...');
    
    // Get all active sessions
    const result = await pool.query(`
      SELECT 
        session_id,
        user_id,
        component,
        credits_used,
        unlocked_at,
        expires_at,
        status,
        EXTRACT(EPOCH FROM (expires_at - unlocked_at))/3600 as duration_hours,
        EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - unlocked_at))/3600 as hours_running,
        CASE 
          WHEN expires_at <= (NOW() AT TIME ZONE 'UTC') THEN 'EXPIRED'
          ELSE 'ACTIVE'
        END as current_status
      FROM research_sessions 
      WHERE status = 'active'
      ORDER BY unlocked_at DESC
    `);
    
    console.log(`Found ${result.rows.length} sessions with status 'active':`);
    
    result.rows.forEach((session, i) => {
      const unlocked = new Date(session.unlocked_at);
      const expires = new Date(session.expires_at);
      const now = new Date();
      const timeRemaining = expires - now;
      const hoursRemaining = Math.round(timeRemaining / (1000 * 60 * 60) * 10) / 10;
      
      console.log(`${i+1}. ${session.component} - ${session.current_status}`);
      console.log(`   Unlocked: ${unlocked.toLocaleString()}`);
      console.log(`   Expires: ${expires.toLocaleString()}`);
      console.log(`   Duration: ${session.duration_hours.toFixed(1)}h`);
      console.log(`   Time remaining: ${hoursRemaining}h`);
      console.log(`   Session ID: ${session.session_id}`);
      console.log('');
    });
    
    // Check recent activities
    const activities = await pool.query(`
      SELECT activity_type, title, description, created_at
      FROM activities 
      WHERE created_at > NOW() - INTERVAL '4 hours'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`📝 Recent activities (last 4 hours): ${activities.rows.length}`);
    activities.rows.forEach((activity, i) => {
      const created = new Date(activity.created_at);
      console.log(`${i+1}. [${activity.activity_type}] ${activity.title}`);
      console.log(`   ${activity.description}`);
      console.log(`   Created: ${created.toLocaleString()}`);
      console.log('');
    });
    
    // Test cleanup function manually
    console.log('🧪 Testing cleanup function manually...');
    const cleanupResult = await pool.query('SELECT cleanup_expired_sessions()');
    const expiredCount = cleanupResult.rows[0].cleanup_expired_sessions;
    console.log(`✅ Cleanup function processed: ${expiredCount} expired sessions`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkSessions(); 