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

async function applySentimentResearchDataSystem() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting sentiment research data system migration...');
    
    await client.query('BEGIN');
    
    // 1. Read the migration file
    const migrationPath = path.join(__dirname, 'src/database/migrations/add-sentiment-research-data.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing sentiment research data migration...');
    
    // 2. Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ sentiment_research_data table created successfully');
    
    // 3. Test the functions
    console.log('🧪 Testing cache key generation function...');
    const testResult = await client.query(`
      SELECT generate_sentiment_cache_key(
        'yahoo_tickers', 
        ARRAY['AAPL', 'MSFT'], 
        '1w', 
        NULL
      ) as cache_key
    `);
    console.log(`   Cache key test result: ${testResult.rows[0].cache_key}`);
    
    // 4. Test cleanup function
    console.log('🧹 Testing cleanup function...');
    const cleanupResult = await client.query('SELECT cleanup_expired_sentiment_data() as cleaned_count');
    console.log(`   Cleanup test result: ${cleanupResult.rows[0].cleaned_count} expired records cleaned`);
    
    // 5. Verify table structure
    console.log('🔍 Verifying table structure...');
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'sentiment_research_data' 
      ORDER BY ordinal_position
    `);
    
    console.log('   Table columns:');
    tableInfo.rows.forEach(col => {
      console.log(`     ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    
    // 6. Verify indexes
    console.log('🔍 Verifying indexes...');
    const indexInfo = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'sentiment_research_data'
      ORDER BY indexname
    `);
    
    console.log('   Table indexes:');
    indexInfo.rows.forEach(idx => {
      console.log(`     ${idx.indexname}`);
    });
    
    await client.query('COMMIT');
    
    console.log('');
    console.log('🎉 Sentiment research data system migration completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   ✅ sentiment_research_data table created');
    console.log('   ✅ Indexes created for efficient querying');
    console.log('   ✅ Cache key generation function created');
    console.log('   ✅ Cleanup function created');
    console.log('   ✅ Triggers created for auto-timestamps');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Test sentiment API calls to verify caching');
    console.log('   3. Monitor logs for cache hit/miss messages');
    console.log('   4. Check database for cached sentiment data');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error applying sentiment research data migration:', error);
    console.error('Stack trace:', error.stack);
    
    // Provide helpful error information
    if (error.message.includes('already exists')) {
      console.log('');
      console.log('ℹ️  It looks like the table already exists. This is normal if you\'ve run this script before.');
      console.log('   The migration includes IF NOT EXISTS clauses to prevent conflicts.');
    }
    
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await applySentimentResearchDataSystem();
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main();
}

module.exports = { applySentimentResearchDataSystem }; 