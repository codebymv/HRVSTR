const { Pool } = require('pg');

const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixEarningsSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting Earnings schema setup...');
    
    // Create the user_earnings_cache table
    console.log('📋 Creating user_earnings_cache table...');
    
    // Drop and recreate the table if it exists with wrong schema
    console.log('🔄 Checking and fixing user_earnings_cache schema...');
    await client.query(`
      DROP TABLE IF EXISTS user_earnings_cache CASCADE
    `);
    
    await client.query(`
      CREATE TABLE user_earnings_cache (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        data_type VARCHAR(50) NOT NULL,
        cache_key VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        tier VARCHAR(20) DEFAULT 'free',
        metadata JSONB DEFAULT '{}',
        UNIQUE(user_id, data_type, cache_key)
      )
    `);
    
    console.log('📋 Creating performance indexes...');
    
    // Create index for cache lookups (most important for performance)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_earnings_cache_lookup 
      ON user_earnings_cache(user_id, data_type, cache_key, expires_at);
    `);
    
    // Create index for expired data cleanup
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_earnings_cache_expiry 
      ON user_earnings_cache(expires_at);
    `);
    
    // Create index for user-specific queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_earnings_cache_user 
      ON user_earnings_cache(user_id, expires_at);
    `);
    
    // Create index for data type queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_earnings_cache_type 
      ON user_earnings_cache(data_type, expires_at);
    `);
    
    // Create a view for active cache entries (non-expired)
    console.log('📋 Creating active_user_earnings_cache view...');
    await client.query(`
      CREATE OR REPLACE VIEW active_user_earnings_cache AS
      SELECT 
        id,
        user_id,
        data_type,
        cache_key,
        created_at,
        expires_at,
        tier,
        metadata,
        CASE 
          WHEN expires_at > NOW() THEN true 
          ELSE false 
        END as is_active,
        EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_until_expiry
      FROM user_earnings_cache
      WHERE expires_at > NOW()
      ORDER BY created_at DESC;
    `);
    
    // Create a function to automatically clean up expired entries
    console.log('📋 Creating cleanup function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION cleanup_expired_earnings_cache()
      RETURNS INTEGER AS $$
      DECLARE
        deleted_count INTEGER;
      BEGIN
        DELETE FROM user_earnings_cache WHERE expires_at <= NOW();
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Verify table creation and structure
    console.log('✅ Verifying earnings cache schema...');
    
    const tableInfo = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'user_earnings_cache'
      ORDER BY ordinal_position;
    `);
    
    const indexInfo = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'user_earnings_cache';
    `);
    
    const viewInfo = await client.query(`
      SELECT schemaname, viewname, definition
      FROM pg_views 
      WHERE viewname = 'active_user_earnings_cache';
    `);
    
    console.log('📊 Earnings cache table structure:');
    console.table(tableInfo.rows);
    
    console.log('📊 Created indexes:');
    indexInfo.rows.forEach(index => {
      console.log(`  - ${index.indexname}`);
    });
    
    console.log('📊 Created views:');
    viewInfo.rows.forEach(view => {
      console.log(`  - ${view.viewname}`);
    });
    
    // Test the cleanup function
    console.log('🧹 Testing cleanup function...');
    const cleanupResult = await client.query('SELECT cleanup_expired_earnings_cache();');
    console.log(`🧹 Cleanup function works - removed ${cleanupResult.rows[0].cleanup_expired_earnings_cache} expired entries`);
    
    console.log('✅ Earnings schema setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up Earnings schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the schema setup
fixEarningsSchema()
  .then(() => {
    console.log('🎉 Earnings schema setup completed!');
    console.log('💡 The following objects were created:');
    console.log('   📋 Table: user_earnings_cache');
    console.log('   🔍 Indexes: lookup, expiry, user, type');
    console.log('   👁️  View: active_user_earnings_cache');
    console.log('   🧹 Function: cleanup_expired_earnings_cache()');
    console.log('');
    console.log('🚀 Ready to use earnings session-based caching!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Earnings schema setup failed:', error);
    process.exit(1);
  }); 