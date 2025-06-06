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

async function applySchema() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  console.log('Database connected!');

  try {
    const schemaPath = path.join(__dirname, 'schema.sql'); // Assumes schema.sql is in the same directory
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Applying database schema...');
    // Execute all SQL commands from the schema file
    await client.query(schemaSql);
    console.log('Database schema applied successfully!');

  } catch (error) {
    console.error('Error applying database schema:', error);
  } finally {
    client.release();
    pool.end();
    console.log('Database connection closed.');
  }
}

applySchema()
  .then(() => console.log('Script finished.'))
  .catch(error => console.error('Script failed:', error)); 