const { Pool } = require('pg');

const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addEventsColumns() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add title and description columns
    await client.query(`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS importance VARCHAR(10) DEFAULT 'medium'
    `);

    // Add unique constraints
    await client.query(`
      ALTER TABLE events 
      ADD CONSTRAINT unique_event 
      UNIQUE (symbol, event_type, scheduled_at)
    `);

    await client.query('COMMIT');
    console.log('Successfully added columns and constraints to events table');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding columns:', error);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

// Run the migration
addEventsColumns()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 