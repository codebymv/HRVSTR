const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkScheduler() {
  try {
    console.log('🔍 Checking session cleanup scheduler status...');
    
    // Check when sessions were last updated (indicates when cleanup ran)
    const lastCleanup = await pool.query(`
      SELECT 
        MAX(updated_at) as last_cleanup,
        COUNT(*) as total_expired_sessions
      FROM research_sessions 
      WHERE status = 'expired'
    `);
    
    if (lastCleanup.rows[0].last_cleanup) {
      const lastCleanupTime = new Date(lastCleanup.rows[0].last_cleanup);
      const timeSinceCleanup = (new Date() - lastCleanupTime) / (1000 * 60); // minutes
      console.log(`📅 Last cleanup ran: ${lastCleanupTime.toLocaleString()}`);
      console.log(`⏰ Time since last cleanup: ${Math.round(timeSinceCleanup)} minutes ago`);
      console.log(`📊 Total expired sessions: ${lastCleanup.rows[0].total_expired_sessions}`);
    } else {
      console.log('❌ No cleanup has ever run (no expired sessions found)');
    }
    
    // Check for sessions that should have been cleaned up but weren't
    const missedCleanups = await pool.query(`
      SELECT 
        component,
        unlocked_at,
        expires_at,
        status,
        EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - expires_at))/3600 as hours_overdue
      FROM research_sessions 
      WHERE status = 'active' 
      AND expires_at < (NOW() AT TIME ZONE 'UTC')
      ORDER BY expires_at
    `);
    
    console.log(`\n⚠️  Sessions that should be expired but aren't: ${missedCleanups.rows.length}`);
    missedCleanups.rows.forEach((session, i) => {
      const expires = new Date(session.expires_at);
      console.log(`${i+1}. ${session.component}`);
      console.log(`   Expired: ${expires.toLocaleString()}`);
      console.log(`   Hours overdue: ${session.hours_overdue.toFixed(1)}h`);
      console.log('');
    });
    
    // Check recent expiration activities to see the pattern
    const recentExpirations = await pool.query(`
      SELECT 
        created_at,
        description
      FROM activities 
      WHERE activity_type = 'research_expired'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log(`📝 Recent expiration activities (last 5):`);
    recentExpirations.rows.forEach((activity, i) => {
      const created = new Date(activity.created_at);
      console.log(`${i+1}. ${created.toLocaleString()}`);
      console.log(`   ${activity.description}`);
      console.log('');
    });
    
    // Calculate expected cleanup times based on 15-minute intervals
    const now = new Date();
    const last15MinMark = new Date(now);
    last15MinMark.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
    
    const next15MinMark = new Date(last15MinMark);
    next15MinMark.setMinutes(next15MinMark.getMinutes() + 15);
    
    console.log(`⏰ Cleanup schedule (15-min intervals):`);
    console.log(`   Last expected: ${last15MinMark.toLocaleString()}`);
    console.log(`   Next expected: ${next15MinMark.toLocaleString()}`);
    console.log(`   Minutes until next: ${Math.round((next15MinMark - now) / (1000 * 60))}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkScheduler(); 