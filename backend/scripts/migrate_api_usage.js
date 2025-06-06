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

async function addApiUsageTable() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  console.log('Database connected!');

  try {
    console.log('Checking if api_usage table already exists...');
    
    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'api_usage'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('API usage table already exists. Skipping creation.');
      return;
    }

    console.log('Creating api_usage table...');
    
    // Create the API usage table
    const createTableSql = `
      -- API Usage tracking table for tier limits
      CREATE TABLE api_usage (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          usage_date DATE NOT NULL,
          daily_searches INTEGER DEFAULT 0,
          daily_price_updates INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, usage_date)
      );

      -- Add indexes for efficient queries
      CREATE INDEX idx_api_usage_user_date ON api_usage(user_id, usage_date);
      CREATE INDEX idx_api_usage_date ON api_usage(usage_date);

      -- Add helpful comments
      COMMENT ON TABLE api_usage IS 'Tracks daily API usage per user for tier limit enforcement';
      COMMENT ON COLUMN api_usage.daily_searches IS 'Number of Alpha Vantage search API calls made today';
      COMMENT ON COLUMN api_usage.daily_price_updates IS 'Number of Alpha Vantage price/quote API calls made today';

      -- Add trigger for updated_at timestamp
      CREATE TRIGGER update_api_usage_updated_at
          BEFORE UPDATE ON api_usage
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `;

    await client.query(createTableSql);
    console.log('✅ API usage table created successfully!');

    // Verify the table was created
    const verifyTable = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'api_usage' 
      ORDER BY ordinal_position;
    `);
    
    console.log('✅ Table structure verified:');
    verifyTable.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    console.log('🎉 Migration completed successfully!');
    console.log('🚀 Your app now supports tier-based API usage tracking');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    client.release();
    pool.end();
    console.log('Database connection closed.');
  }
}

addApiUsageTable()
  .then(() => {
    console.log('✅ Migration script finished successfully!');
    console.log('');
    console.log('📊 API Usage Tracking Features Added:');
    console.log('  • Free tier: 25 searches/day + 25 price updates/day');
    console.log('  • Pro+ tiers: Unlimited usage');
    console.log('  • Automatic tier limit dialogs');
    console.log('  • Usage tracking and analytics');
    console.log('');
    console.log('🔄 Next: Restart your backend server to activate the new features');
  })
  .catch(error => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  }); 