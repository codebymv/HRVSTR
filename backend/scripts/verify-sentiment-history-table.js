const { Pool } = require('pg');

const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function verifyTable() {
  console.log('🔌 Connecting to database...');
  const client = await pool.connect();
  
  try {
    // Check table structure
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'sentiment_history'
      ORDER BY ordinal_position;
    `;
    
    const columnsResult = await client.query(columnsQuery);
    console.log('\n📊 sentiment_history table structure:');
    columnsResult.rows.forEach((row, i) => {
      const nullable = row.is_nullable === 'YES' ? '(nullable)' : '(required)';
      const defaultVal = row.column_default ? ` default: ${row.column_default}` : '';
      console.log(`  ${i+1}. ${row.column_name}: ${row.data_type} ${nullable}${defaultVal}`);
    });
    
    // Check indexes
    const indexQuery = `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'sentiment_history'
      ORDER BY indexname;
    `;
    
    const indexResult = await client.query(indexQuery);
    console.log('\n🔍 Indexes:');
    indexResult.rows.forEach((row, i) => {
      console.log(`  ${i+1}. ${row.indexname}`);
    });
    
    console.log('\n✅ Table verification complete!');
    
  } catch (error) {
    console.error('❌ Error verifying table:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyTable(); 