const { pool } = require('./src/config/data-sources');

async function fixOldSessions() {
  try {
    console.log('🔧 Fixing old sessions with incorrect 8-hour durations...');
    
    // Find sessions that were created with 8+ hour durations (likely the bug)
    const oldSessions = await pool.query(`
      SELECT 
        session_id,
        component,
        user_id,
        unlocked_at,
        expires_at,
        EXTRACT(EPOCH FROM (expires_at - unlocked_at))/3600 as duration_hours,
        status
      FROM research_sessions 
      WHERE status = 'active'
        AND EXTRACT(EPOCH FROM (expires_at - unlocked_at))/3600 > 6
      ORDER BY unlocked_at DESC
    `);
    
    console.log(`Found ${oldSessions.rows.length} sessions with 6+ hour durations:`);
    
    oldSessions.rows.forEach((session, index) => {
      console.log(`  ${index + 1}. ${session.component} (${session.duration_hours.toFixed(1)}h) - expires ${new Date(session.expires_at).toLocaleString()}`);
    });
    
    if (oldSessions.rows.length === 0) {
      console.log('✅ No old sessions to fix!');
      return;
    }
    
    // Expire these old sessions
    const result = await pool.query(`
      UPDATE research_sessions 
      SET status = 'expired', 
          updated_at = NOW()
      WHERE status = 'active'
        AND EXTRACT(EPOCH FROM (expires_at - unlocked_at))/3600 > 6
    `);
    
    console.log(`✅ Expired ${result.rowCount} old sessions with incorrect durations`);
    console.log('🎉 All future sessions will use correct 2-hour duration for Pro tier');
    
  } catch (error) {
    console.error('❌ Error fixing old sessions:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixOldSessions(); 