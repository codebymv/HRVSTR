const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway'; // Your Railway PUBLIC database URL

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false // Required for connecting to Railway's public endpoint
  }
});

async function createUserApiKeysTable() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  console.log('Database connected!');

  try {
    // SQL to create the user_api_keys table
    const createTableSQL = `
      -- Add user API keys table for per-user API key storage
      CREATE TABLE IF NOT EXISTS user_api_keys (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL, -- 'reddit', 'alpha_vantage', 'finviz', 'sec'
        key_name VARCHAR(50) NOT NULL, -- 'client_id', 'client_secret', 'api_key'
        key_value TEXT, -- encrypted value
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, provider, key_name)
      );

      -- Index for faster lookups
      CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_provider ON user_api_keys(user_id, provider);
    `;

    console.log('Creating user_api_keys table...');
    await client.query(createTableSQL);
    console.log('✅ user_api_keys table created successfully!');

    // Verify the table was created
    const tableCheckSQL = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_api_keys'
      ORDER BY ordinal_position;
    `;
    
    const result = await client.query(tableCheckSQL);
    console.log('\n📋 Table structure:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });

    // Check indexes
    const indexCheckSQL = `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'user_api_keys';
    `;
    
    const indexResult = await client.query(indexCheckSQL);
    console.log('\n🔍 Indexes:');
    indexResult.rows.forEach(row => {
      console.log(`  ${row.indexname}`);
    });

  } catch (error) {
    console.error('❌ Error creating table:', error);
  } finally {
    client.release();
    pool.end();
    console.log('\n🔌 Database connection closed.');
  }
}

createUserApiKeysTable()
  .then(() => console.log('✨ Script finished successfully!'))
  .catch(error => console.error('💥 Script failed:', error)); 