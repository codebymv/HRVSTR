const { Pool } = require('pg');

const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixSecSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting SEC schema fix...');
    
    // Drop the view first (if it exists)
    console.log('📋 Dropping active_user_sec_cache view...');
    await client.query('DROP VIEW IF EXISTS active_user_sec_cache CASCADE;');
    
    // Update all problematic VARCHAR(10) and VARCHAR(20) columns to VARCHAR(50)
    console.log('🔧 Updating ticker columns to VARCHAR(50)...');
    await client.query(`
      ALTER TABLE user_sec_insider_trades 
      ALTER COLUMN ticker TYPE VARCHAR(50);
    `);
    
    await client.query(`
      ALTER TABLE user_sec_institutional_holdings 
      ALTER COLUMN ticker TYPE VARCHAR(50);
    `);
    
    console.log('🔧 Updating trade_type column to VARCHAR(50)...');
    await client.query(`
      ALTER TABLE user_sec_insider_trades 
      ALTER COLUMN trade_type TYPE VARCHAR(50);
    `);
    
    console.log('🔧 Updating time_range column to VARCHAR(50)...');
    await client.query(`
      ALTER TABLE user_sec_cache 
      ALTER COLUMN time_range TYPE VARCHAR(50);
    `);
    
    // Also update insider_name and institution_name which might be long
    console.log('🔧 Updating name columns to VARCHAR(255)...');
    await client.query(`
      ALTER TABLE user_sec_insider_trades 
      ALTER COLUMN insider_name TYPE VARCHAR(255);
    `);
    
    await client.query(`
      ALTER TABLE user_sec_institutional_holdings 
      ALTER COLUMN institution_name TYPE VARCHAR(255);
    `);
    
    // Recreate the view
    console.log('📋 Recreating active_user_sec_cache view...');
    await client.query(`
      CREATE VIEW active_user_sec_cache AS
      SELECT 
        id,
        user_id,
        data_type,
        time_range,
        expires_at,
        created_at,
        CASE 
          WHEN expires_at > NOW() THEN true 
          ELSE false 
        END as is_active
      FROM user_sec_cache
      WHERE expires_at > NOW();
    `);
    
    // Verify changes
    console.log('✅ Verifying schema changes...');
    
    const tickerCheck = await client.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name IN ('user_sec_insider_trades', 'user_sec_institutional_holdings') 
      AND column_name = 'ticker';
    `);
    
    const nameCheck = await client.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name IN ('user_sec_insider_trades', 'user_sec_institutional_holdings') 
      AND column_name IN ('insider_name', 'institution_name');
    `);
    
    console.log('📊 Updated ticker columns:', tickerCheck.rows);
    console.log('📊 Updated name columns:', nameCheck.rows);
    
    console.log('✅ SEC schema fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing SEC schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the fix
fixSecSchema()
  .then(() => {
    console.log('🎉 Schema fix completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Schema fix failed:', error);
    process.exit(1);
  }); 