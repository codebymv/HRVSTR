const { Pool } = require('pg');

// Database configuration - using Railway
const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function applyResearchExpirationActivity() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔧 Updating cleanup_expired_sessions function to log expiration activities...');
    
    // Update the cleanup function to include activity logging
    await client.query(`
      CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
      RETURNS INTEGER AS $$
      DECLARE
          expired_count INTEGER;
          expired_session RECORD;
          tier_hours INTEGER;
          component_name VARCHAR(255);
      BEGIN
          -- First, get all sessions that are about to be expired and log activities
          FOR expired_session IN 
              SELECT user_id, component, metadata, 
                     EXTRACT(EPOCH FROM (expires_at - unlocked_at))/3600 as original_duration_hours
              FROM research_sessions 
              WHERE status = 'active' 
              AND expires_at < (NOW() AT TIME ZONE 'UTC')
          LOOP
              -- Extract tier from metadata if available (handle decimal hours)
              tier_hours := COALESCE(ROUND((expired_session.metadata->>'unlockDurationHours')::NUMERIC)::INTEGER, 2);
              
              -- Format component name for display
              component_name := CASE 
                  WHEN expired_session.component = 'earningsAnalysis' THEN 'Earnings Analysis Research'
                  WHEN expired_session.component = 'upcomingEarnings' THEN 'Upcoming Earnings Research'
                  WHEN expired_session.component = 'institutionalHoldings' THEN 'Institutional Holdings Research'
                  WHEN expired_session.component = 'insiderTrading' THEN 'Insider Trading Research'
                  WHEN expired_session.component = 'sentimentAnalysis' THEN 'Sentiment Analysis Research'
                  WHEN expired_session.component = 'technicalAnalysis' THEN 'Technical Analysis Research'
                  WHEN expired_session.component = 'fundamentalAnalysis' THEN 'Fundamental Analysis Research'
                  WHEN expired_session.component = 'marketTrends' THEN 'Market Trends Research'
                  WHEN expired_session.component = 'newsAnalysis' THEN 'News Analysis Research'
                  WHEN expired_session.component = 'socialSentiment' THEN 'Social Sentiment Research'
                  WHEN expired_session.component = 'redditAnalysis' THEN 'Reddit Analysis Research'
                  ELSE initcap(replace(expired_session.component, '_', ' ')) || ' Research'
              END;
              
              -- Log the expiration activity
              INSERT INTO activities (user_id, activity_type, title, description, created_at)
              VALUES (
                  expired_session.user_id,
                  'research_expired',
                  'Research Expired',
                  component_name || ' expired after ' || tier_hours || ' hour' || 
                  CASE WHEN tier_hours = 1 THEN '' ELSE 's' END || ' time limit',
                  (NOW() AT TIME ZONE 'UTC')
              );
          END LOOP;
          
          -- Now update the sessions to mark them as expired
          UPDATE research_sessions 
          SET status = 'expired' 
          WHERE status = 'active' 
          AND expires_at < (NOW() AT TIME ZONE 'UTC');
          
          GET DIAGNOSTICS expired_count = ROW_COUNT;
          RETURN expired_count;
      END;
      $$ language 'plpgsql';
    `);
    
    console.log('✅ Updated cleanup_expired_sessions function');
    
    // Test the function with any existing expired sessions
    console.log('🧪 Testing updated function...');
    const testResult = await client.query('SELECT cleanup_expired_sessions()');
    const expiredCount = testResult.rows[0].cleanup_expired_sessions;
    console.log(`✅ Test completed: ${expiredCount} expired sessions processed`);
    
    // Check if any new activities were created
    const newActivities = await client.query(`
      SELECT COUNT(*) as count FROM activities 
      WHERE activity_type = 'research_expired' 
      AND created_at > NOW() - INTERVAL '1 minute'
    `);
    console.log(`📝 New expiration activities created: ${newActivities.rows[0].count}`);
    
    await client.query('COMMIT');
    
    console.log('\n🎉 Research expiration activity system applied successfully!');
    console.log('\n📋 What changed:');
    console.log('   ✅ cleanup_expired_sessions() now logs activities when sessions expire');
    console.log('   ✅ New activity type: "research_expired" with gradient lock icon');
    console.log('   ✅ Activities show component name and tier limit hours');
    console.log('   ✅ Frontend activity formatter updated to handle new type');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error applying research expiration activity system:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
applyResearchExpirationActivity()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 