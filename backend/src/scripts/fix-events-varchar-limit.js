const { Pool } = require('pg');

const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixEventsVarcharLimit() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  console.log('Database connected!');

  try {
    console.log('Starting events table schema fix...');
    await client.query('BEGIN');

    // Modify the title column to allow longer text
    await client.query(`
      ALTER TABLE events 
      ALTER COLUMN title TYPE TEXT
    `);

    // Also ensure description can handle long text (should already be TEXT but just in case)
    await client.query(`
      ALTER TABLE events 
      ALTER COLUMN description TYPE TEXT
    `);

    // Make sure event_type can handle longer values if needed
    await client.query(`
      ALTER TABLE events 
      ALTER COLUMN event_type TYPE VARCHAR(100)
    `);

    await client.query('COMMIT');
    console.log('✅ Successfully updated events table schema:');
    console.log('   - title column changed from VARCHAR(255) to TEXT');
    console.log('   - description column ensured to be TEXT');
    console.log('   - event_type column expanded to VARCHAR(100)');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating events table schema:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

fixEventsVarcharLimit()
  .then(() => console.log('Schema fix completed successfully!'))
  .catch(error => console.error('Schema fix failed:', error)); 