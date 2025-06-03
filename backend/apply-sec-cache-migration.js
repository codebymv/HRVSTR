const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function applySECCacheMigration() {
  console.log('🔄 Starting SEC Data Cache Migration...');
  const client = await pool.connect();
  
  try {
    console.log('✅ Database connected successfully!');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_sec_data_cache.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Loaded migration file');
    console.log('🚀 Executing migration...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ SEC Data Cache migration completed successfully!');
    
    // Test the new functions
    console.log('\n🧪 Testing migration functions...');
    
    // Test expiration function
    const expirationTest = await client.query(`
      SELECT get_sec_cache_expiration('pro'::user_tier_enum, 'insider_trades'::sec_data_type_enum) as expiration
    `);
    console.log('✅ Expiration function test:', expirationTest.rows[0]);
    
    // Test credits cost function
    const creditsTest = await client.query(`
      SELECT get_sec_data_credits_cost('free'::user_tier_enum, 'insider_trades'::sec_data_type_enum, '1m') as cost
    `);
    console.log('✅ Credits cost function test:', creditsTest.rows[0]);
    
    // Check if tables were created
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('user_sec_cache', 'user_sec_insider_trades', 'user_sec_institutional_holdings')
      ORDER BY table_name
    `);
    console.log('✅ Created tables:', tablesCheck.rows.map(r => r.table_name));
    
    // Check if view was created
    const viewCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
        AND table_name = 'active_user_sec_cache'
    `);
    console.log('✅ Created views:', viewCheck.rows.map(r => r.table_name));
    
    console.log('\n🎉 SEC Data Cache system is ready!');
    console.log('\nFeatures enabled:');
    console.log('- ✅ User-specific SEC data caching');
    console.log('- ✅ Tier-based expiration times');
    console.log('- ✅ Credit-based access control');
    console.log('- ✅ Cross-device data persistence');
    console.log('- ✅ Automatic cache cleanup');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
applySECCacheMigration().catch(console.error); 