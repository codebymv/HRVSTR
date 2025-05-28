const { pool } = require('../config/data-sources');

async function createEventsTable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) NOT NULL,
        event_type VARCHAR(20) NOT NULL,
        scheduled_at TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
        title VARCHAR(255) NOT NULL,
        description TEXT,
        importance VARCHAR(10) NOT NULL DEFAULT 'medium',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add unique constraints
    await client.query(`
      ALTER TABLE events 
      ADD CONSTRAINT unique_earnings_event 
      UNIQUE (symbol, event_type, scheduled_at)
      WHERE event_type = 'earnings'
    `);

    await client.query(`
      ALTER TABLE events 
      ADD CONSTRAINT unique_dividend_event 
      UNIQUE (symbol, event_type, scheduled_at)
      WHERE event_type = 'dividend'
    `);

    await client.query(`
      ALTER TABLE events 
      ADD CONSTRAINT unique_news_event 
      UNIQUE (symbol, event_type, scheduled_at)
      WHERE event_type = 'news'
    `);

    await client.query('COMMIT');
    console.log('Successfully created events table with constraints');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating events table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
createEventsTable()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 