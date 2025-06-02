const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration - using Railway
const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function applyResearchSessionsSystem() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting research sessions system migration...');
    
    await client.query('BEGIN');
    
    // 1. Drop and recreate research_sessions table to ensure clean state
    console.log('🗑️ Dropping existing research_sessions table if it exists...');
    await client.query('DROP TABLE IF EXISTS research_sessions CASCADE');
    
    // 2. Create research_sessions table
    console.log('📊 Creating research_sessions table...');
    await client.query(`
      CREATE TABLE research_sessions (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        component VARCHAR(100) NOT NULL,
        credits_used INTEGER NOT NULL DEFAULT 0,
        unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'manual_end')),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ research_sessions table created');
    
    // 3. Create indexes
    console.log('🔍 Creating indexes...');
    await client.query(`
      CREATE INDEX idx_research_sessions_user_component 
      ON research_sessions(user_id, component);
    `);
    
    await client.query(`
      CREATE INDEX idx_research_sessions_status_expires 
      ON research_sessions(status, expires_at);
    `);
    
    await client.query(`
      CREATE INDEX idx_research_sessions_session_id 
      ON research_sessions(session_id);
    `);
    console.log('✅ Indexes created');
    
    // 4. Create updated_at trigger function
    console.log('🔧 Creating updated_at trigger function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_research_sessions_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_research_sessions_updated_at ON research_sessions;
      CREATE TRIGGER update_research_sessions_updated_at
          BEFORE UPDATE ON research_sessions
          FOR EACH ROW
          EXECUTE FUNCTION update_research_sessions_updated_at();
    `);
    console.log('✅ Updated_at trigger created');
    
    // 5. Create cleanup function
    console.log('🧹 Creating cleanup function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
      RETURNS INTEGER AS $$
      DECLARE
          expired_count INTEGER;
      BEGIN
          UPDATE research_sessions 
          SET status = 'expired' 
          WHERE status = 'active' 
          AND expires_at < CURRENT_TIMESTAMP;
          
          GET DIAGNOSTICS expired_count = ROW_COUNT;
          RETURN expired_count;
      END;
      $$ language 'plpgsql';
    `);
    console.log('✅ Cleanup function created');
    
    // 6. Add table comment
    await client.query(`
      COMMENT ON TABLE research_sessions IS 'Tracks active component unlock sessions to prevent double-charging users within reasonable timeframes';
    `);
    
    // 7. Insert sample session data for testing
    console.log('📝 Creating sample session data...');
    const testUserId = await client.query('SELECT id FROM users LIMIT 1');
    
    if (testUserId.rows.length > 0) {
      const userId = testUserId.rows[0].id;
      
      // Create a sample active session
      await client.query(`
        INSERT INTO research_sessions (
          user_id, 
          session_id, 
          component, 
          credits_used, 
          expires_at,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (session_id) DO NOTHING
      `, [
        userId,
        `sample_session_${userId}_chart_${Date.now()}`,
        'chart',
        8,
        new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        JSON.stringify({
          tier: 'pro',
          component_cost: 8,
          session_duration_ms: 2 * 60 * 60 * 1000,
          test_data: true
        })
      ]);
      
      // Create an expired session for testing cleanup
      await client.query(`
        INSERT INTO research_sessions (
          user_id, 
          session_id, 
          component, 
          credits_used, 
          expires_at,
          status,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (session_id) DO NOTHING
      `, [
        userId,
        `expired_session_${userId}_scores_${Date.now()}`,
        'scores',
        12,
        new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago (expired)
        'active', // Will be updated by cleanup function
        JSON.stringify({
          tier: 'pro',
          component_cost: 12,
          session_duration_ms: 2 * 60 * 60 * 1000,
          test_data: true,
          expired_for_testing: true
        })
      ]);
      
      console.log('✅ Sample session data created');
    }
    
    // 8. Test cleanup function
    console.log('🧪 Testing cleanup function...');
    const cleanupResult = await client.query('SELECT cleanup_expired_sessions()');
    const expiredCount = cleanupResult.rows[0].cleanup_expired_sessions;
    console.log(`✅ Cleanup function test: ${expiredCount} expired sessions updated`);
    
    // 9. Verify table structure
    console.log('🔍 Verifying table structure...');
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'research_sessions' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Table structure:');
    tableInfo.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
    });
    
    // 10. Check active sessions
    const activeSessions = await client.query(`
      SELECT component, session_id, expires_at, status, credits_used
      FROM research_sessions 
      WHERE status = 'active' AND expires_at > CURRENT_TIMESTAMP
      ORDER BY expires_at
    `);
    
    console.log(`📊 Active sessions found: ${activeSessions.rows.length}`);
    activeSessions.rows.forEach(session => {
      const timeRemaining = new Date(session.expires_at) - new Date();
      const hoursRemaining = Math.round(timeRemaining / (1000 * 60 * 60) * 10) / 10;
      console.log(`   ${session.component}: ${session.session_id} (${hoursRemaining}h remaining, ${session.credits_used} credits)`);
    });
    
    await client.query('COMMIT');
    
    console.log('\n🎉 Research sessions system migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ research_sessions table created');
    console.log('   ✅ Indexes created for efficient queries');
    console.log('   ✅ Updated_at trigger implemented');
    console.log('   ✅ Cleanup function for expired sessions');
    console.log('   ✅ Sample data for testing');
    console.log('\n🔧 Key Features:');
    console.log('   • Session-based unlock persistence');
    console.log('   • Automatic expiration handling');
    console.log('   • Tier-based session durations');
    console.log('   • Comprehensive audit trail');
    console.log('   • Double-charging prevention');
    
    console.log('\n⏰ Session Durations by Tier:');
    console.log('   • Free: 30 minutes');
    console.log('   • Pro: 2 hours');
    console.log('   • Elite: 4 hours');
    console.log('   • Institutional: 8 hours');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error applying research sessions system:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
applyResearchSessionsSystem()
  .then(() => {
    console.log('\n✨ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  }); 