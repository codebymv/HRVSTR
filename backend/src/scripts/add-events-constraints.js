const { pool } = require('../config/data-sources');

async function addEventsConstraints() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add unique constraint for earnings events
    await client.query(`
      ALTER TABLE events 
      ADD CONSTRAINT unique_earnings_event 
      UNIQUE (symbol, event_type, scheduled_at)
      WHERE event_type = 'earnings'
    `);

    // Add unique constraint for dividend events
    await client.query(`
      ALTER TABLE events 
      ADD CONSTRAINT unique_dividend_event 
      UNIQUE (symbol, event_type, scheduled_at)
      WHERE event_type = 'dividend'
    `);

    // Add unique constraint for news events
    await client.query(`
      ALTER TABLE events 
      ADD CONSTRAINT unique_news_event 
      UNIQUE (symbol, event_type, scheduled_at)
      WHERE event_type = 'news'
    `);

    await client.query('COMMIT');
    console.log('Successfully added constraints to events table');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding constraints:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
addEventsConstraints()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 