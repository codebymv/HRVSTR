const { Pool } = require('pg');

const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function alterEventsTable() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  console.log('Database connected!');

  try {
    console.log('Starting events table alteration...');

    // Add event_type column if it doesn't exist
    await client.query(`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) NOT NULL DEFAULT 'other'
    `);

    // Add additional columns for event details
    await client.query(`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS importance VARCHAR(20) DEFAULT 'medium'
    `);

    console.log('Events table alteration completed successfully');
  } catch (error) {
    console.error('Error altering events table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

alterEventsTable()
  .then(() => console.log('Script finished.'))
  .catch(error => console.error('Script failed:', error)); 