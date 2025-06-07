const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkAllSessions() {
  try {
    console.log('🔍 Checking ALL research sessions (active and expired)...');
    
    // Get all sessions from the last 24 hours
    const result = await pool.query(`
      SELECT 
        session_id,
        user_id,
        component,
        credits_used,
        unlocked_at,
        expires_at,
        status,
        created_at,
        updated_at,
        metadata,
        EXTRACT(EPOCH FROM (expires_at - unlocked_at))/3600 as duration_hours,
        EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - unlocked_at))/3600 as hours_running,
        CASE 
          WHEN expires_at <= (NOW() AT TIME ZONE 'UTC') THEN 'SHOULD_BE_EXPIRED'
          ELSE 'STILL_ACTIVE'
        END as current_status
      FROM research_sessions 
      WHERE unlocked_at > NOW() - INTERVAL '24 hours'
      ORDER BY unlocked_at DESC
    `);
    
    console.log(`Found ${result.rows.length} sessions from the last 24 hours:`);
    
    result.rows.forEach((session, i) => {
      const unlocked = new Date(session.unlocked_at);
      const expires = new Date(session.expires_at);
      const now = new Date();
      const timeRemaining = expires - now;
      const hoursRemaining = Math.round(timeRemaining / (1000 * 60 * 60) * 10) / 10;
      
      console.log(`${i+1}. ${session.component} - STATUS: ${session.status} (${session.current_status})`);
      console.log(`   Unlocked: ${unlocked.toLocaleString()}`);
      console.log(`   Expires: ${expires.toLocaleString()}`);
      console.log(`   Duration: ${session.duration_hours ? session.duration_hours.toFixed(1) : 'N/A'}h`);
      console.log(`   Time remaining: ${hoursRemaining}h`);
      console.log(`   Session ID: ${session.session_id}`);
      console.log(`   Metadata: ${session.metadata || 'null'}`);
      console.log('');
    });
    
    // Get activities from the last 24 hours, specifically looking for research activities
    const activities = await pool.query(`
      SELECT activity_type, title, description, created_at, user_id
      FROM activities 
      WHERE created_at > NOW() - INTERVAL '24 hours'
        AND (activity_type = 'component_unlock' OR activity_type = 'research_expired')
      ORDER BY created_at DESC
    `);
    
    console.log(`📝 Research-related activities (last 24 hours): ${activities.rows.length}`);
    activities.rows.forEach((activity, i) => {
      const created = new Date(activity.created_at);
      console.log(`${i+1}. [${activity.activity_type}] ${activity.title}`);
      console.log(`   ${activity.description}`);
      console.log(`   Created: ${created.toLocaleString()}`);
      console.log(`   User ID: ${activity.user_id}`);
      console.log('');
    });
    
    // Check if there are any research unlock activities from around 7:57 PM
    const timeRange = await pool.query(`
      SELECT activity_type, title, description, created_at, user_id
      FROM activities 
      WHERE created_at BETWEEN NOW() - INTERVAL '48 hours' AND NOW()
        AND activity_type = 'component_unlock'
        AND EXTRACT(HOUR FROM created_at) BETWEEN 19 AND 20  -- 7-8 PM
      ORDER BY created_at DESC
    `);
    
    console.log(`🕰️ Research unlocks around 7-8 PM (last 48 hours): ${timeRange.rows.length}`);
    timeRange.rows.forEach((activity, i) => {
      const created = new Date(activity.created_at);
      console.log(`${i+1}. ${activity.title}`);
      console.log(`   ${activity.description}`);
      console.log(`   Created: ${created.toLocaleString()}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAllSessions(); 