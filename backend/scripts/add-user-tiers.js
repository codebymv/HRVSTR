const { Pool } = require('pg');

const databaseUrl = 'postgresql://postgres:uhvLzWQTraqYWeMTmgdvgWzoUvhaJpZj@crossover.proxy.rlwy.net:37814/railway';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addUserTiers() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  console.log('Database connected!');

  try {
    console.log('Adding tier system to users table...');

    // Step 1: Create enum type if it doesn't exist
    console.log('Creating tier enum type...');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_tier_enum AS ENUM ('free', 'pro', 'elite', 'institutional');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Step 2: Add new columns to users table
    console.log('Adding tier columns...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS tier user_tier_enum DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS credits_remaining INTEGER DEFAULT 50,
      ADD COLUMN IF NOT EXISTS credits_monthly_limit INTEGER DEFAULT 50,
      ADD COLUMN IF NOT EXISTS credits_reset_date TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 month'),
      ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
    `);

    // Step 3: Update existing users to have default values
    console.log('Updating existing users with default tier values...');
    await client.query(`
      UPDATE users 
      SET 
        tier = 'free',
        credits_remaining = 50,
        credits_monthly_limit = 50,
        credits_reset_date = CURRENT_TIMESTAMP + INTERVAL '1 month',
        subscription_status = 'active'
      WHERE tier IS NULL;
    `);

    // Step 4: Make tier column NOT NULL now that all rows have values
    console.log('Setting tier column as NOT NULL...');
    await client.query(`
      ALTER TABLE users 
      ALTER COLUMN tier SET NOT NULL,
      ALTER COLUMN credits_remaining SET NOT NULL,
      ALTER COLUMN credits_monthly_limit SET NOT NULL;
    `);

    // Step 5: Create indexes for better performance
    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
      CREATE INDEX IF NOT EXISTS idx_users_credits_reset_date ON users(credits_reset_date);
      CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
    `);

    console.log('✅ User tier system added successfully!');
    
    // Show current user data
    const result = await client.query('SELECT id, email, tier, credits_remaining, credits_monthly_limit FROM users LIMIT 5');
    console.log('Sample user data:');
    console.table(result.rows);

  } catch (error) {
    console.error('❌ Error adding user tiers:', error);
  } finally {
    client.release();
    pool.end();
    console.log('Database connection closed.');
  }
}

addUserTiers()
  .then(() => console.log('✅ Migration script finished successfully!'))
  .catch(error => console.error('❌ Migration script failed:', error)); 