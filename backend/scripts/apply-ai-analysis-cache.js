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

/**
 * Apply AI Analysis Cache Schema
 * Creates tables and indexes for caching AI analysis results
 */
async function applyAiAnalysisCacheSchema() {
  let client;
  
  try {
    console.log('🔄 Starting AI Analysis Cache schema application...');
    
    // Get a client from the pool
    client = await pool.connect();
    
    console.log('📁 Reading migration file...');
    const migrationPath = path.join(__dirname, '../migrations/add_ai_analysis_cache.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🗄️ Executing migration...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    try {
      // Execute the migration SQL
      await client.query(migrationSQL);
      
      // Commit the transaction
      await client.query('COMMIT');
      
      console.log('✅ AI Analysis Cache schema applied successfully!');
      console.log('');
      console.log('📊 Created tables:');
      console.log('   ✓ user_ai_analysis_cache - Main cache table');
      console.log('   ✓ user_ai_analysis_details - Detailed analysis records');
      console.log('');
      console.log('🏷️ Created enum:');
      console.log('   ✓ ai_analysis_type_enum - Analysis type definitions');
      console.log('');
      console.log('🔍 Created indexes:');
      console.log('   ✓ idx_user_ai_analysis_cache_user_id');
      console.log('   ✓ idx_user_ai_analysis_cache_expires_at');
      console.log('   ✓ idx_user_ai_analysis_cache_session_id');
      console.log('   ✓ idx_user_ai_analysis_cache_user_type_tickers');
      console.log('   ✓ idx_user_ai_analysis_details_*');
      console.log('   ✓ idx_research_sessions_ai_component');
      console.log('');
      console.log('🧹 Created cleanup function:');
      console.log('   ✓ cleanup_expired_ai_analysis_cache()');
      console.log('');
      console.log('🎉 AI insights caching is now enabled!');
      console.log('');
      console.log('💡 Features enabled:');
      console.log('   ✓ Session-based AI analysis caching');
      console.log('   ✓ Cross-device cache persistence');
      console.log('   ✓ No double-charging protection');
      console.log('   ✓ Tier-based cache durations');
      console.log('   ✓ Automatic cache cleanup');
      
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Failed to apply AI Analysis Cache schema:');
    console.error(`   Error: ${error.message}`);
    
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('   1. Check database connection');
    console.error('   2. Verify PostgreSQL permissions');
    console.error('   3. Ensure migration file exists');
    console.error('   4. Check for conflicting table names');
    
    process.exit(1);
    
  } finally {
    // Release the client back to the pool
    if (client) {
      client.release();
    }
    
    // Close the pool
    await pool.end();
  }
}

/**
 * Verify that required tables exist after migration
 */
async function verifySchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verifying schema...');
    
    // Check for main tables
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_ai_analysis_cache', 'user_ai_analysis_details')
      ORDER BY table_name
    `;
    
    const tablesResult = await client.query(tableQuery);
    
    if (tablesResult.rows.length === 2) {
      console.log('✅ All required tables exist');
    } else {
      console.warn('⚠️ Some tables may be missing');
      tablesResult.rows.forEach(row => {
        console.log(`   Found: ${row.table_name}`);
      });
    }
    
    // Check for enum
    const enumQuery = `
      SELECT typname 
      FROM pg_type 
      WHERE typname = 'ai_analysis_type_enum'
    `;
    
    const enumResult = await client.query(enumQuery);
    
    if (enumResult.rows.length > 0) {
      console.log('✅ AI analysis type enum exists');
    } else {
      console.warn('⚠️ AI analysis type enum not found');
    }
    
    // Check for cleanup function
    const functionQuery = `
      SELECT proname 
      FROM pg_proc 
      WHERE proname = 'cleanup_expired_ai_analysis_cache'
    `;
    
    const functionResult = await client.query(functionQuery);
    
    if (functionResult.rows.length > 0) {
      console.log('✅ Cleanup function exists');
    } else {
      console.warn('⚠️ Cleanup function not found');
    }
    
  } catch (error) {
    console.error('❌ Schema verification failed:', error.message);
  } finally {
    client.release();
  }
}

// Run the migration
if (require.main === module) {
  console.log('🚀 AI Analysis Cache Schema Migration');
  console.log('=====================================');
  console.log('');
  
  applyAiAnalysisCacheSchema()
    .then(() => {
      console.log('');
      console.log('🎯 Migration completed successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Restart your backend server');
      console.log('2. Test AI analysis caching');
      console.log('3. Monitor cache performance');
    })
    .catch((error) => {
      console.error('Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  applyAiAnalysisCacheSchema,
  verifySchema
}; 