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

async function applyCreditSystem() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  console.log('Database connected!');

  try {
    console.log('🔍 Checking current database schema...');
    
    // Check if the credit fields already exist in users table
    const checkUsersTable = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND table_schema = 'public'
        AND column_name IN ('credits_remaining', 'credits_monthly_limit', 'monthly_credits', 'credits_used', 'credits_purchased')
    `);
    
    const existingColumns = checkUsersTable.rows.map(row => row.column_name);
    console.log('📊 Existing credit columns:', existingColumns);

    // Check if credit_transactions table exists
    const checkCreditTransactions = await client.query(`
      SELECT to_regclass('public.credit_transactions') as exists
    `);
    
    const creditTransactionsExists = checkCreditTransactions.rows[0].exists !== null;
    console.log('💳 Credit transactions table exists:', creditTransactionsExists);

    console.log('\n🚀 Starting credit system migration...');

    // Step 1: Update users table structure
    if (existingColumns.includes('credits_remaining') && existingColumns.includes('credits_monthly_limit')) {
      console.log('📝 Converting existing credit columns...');
      
      // Rename existing columns to match our new schema
      if (!existingColumns.includes('monthly_credits')) {
        await client.query(`ALTER TABLE users RENAME COLUMN credits_monthly_limit TO monthly_credits`);
        console.log('   ✅ Renamed credits_monthly_limit to monthly_credits');
      }
      
      if (!existingColumns.includes('credits_used')) {
        // Convert credits_remaining to credits_used
        await client.query(`ALTER TABLE users RENAME COLUMN credits_remaining TO credits_used_temp`);
        await client.query(`ALTER TABLE users ADD COLUMN credits_used INTEGER NOT NULL DEFAULT 0`);
        // Calculate used credits: used = monthly_credits - remaining
        await client.query(`
          UPDATE users 
          SET credits_used = GREATEST(0, monthly_credits - COALESCE(credits_used_temp, 0))
        `);
        await client.query(`ALTER TABLE users DROP COLUMN credits_used_temp`);
        console.log('   ✅ Converted credits_remaining to credits_used');
      }
    } else {
      console.log('📝 Adding new credit columns to users table...');
      
      // Add new columns if they don't exist
      if (!existingColumns.includes('monthly_credits')) {
        await client.query(`ALTER TABLE users ADD COLUMN monthly_credits INTEGER NOT NULL DEFAULT 0`);
        console.log('   ✅ Added monthly_credits column');
      }
      
      if (!existingColumns.includes('credits_used')) {
        await client.query(`ALTER TABLE users ADD COLUMN credits_used INTEGER NOT NULL DEFAULT 0`);
        console.log('   ✅ Added credits_used column');
      }
    }

    // Add credits_purchased if it doesn't exist
    if (!existingColumns.includes('credits_purchased')) {
      await client.query(`ALTER TABLE users ADD COLUMN credits_purchased INTEGER NOT NULL DEFAULT 0`);
      console.log('   ✅ Added credits_purchased column');
    }

    // Step 2: Update existing users with proper tier-based credit allocations
    console.log('📊 Updating tier-based credit allocations...');
    await client.query(`
      UPDATE users 
      SET monthly_credits = CASE 
          WHEN tier = 'free' THEN 0
          WHEN tier = 'pro' THEN 500
          WHEN tier = 'elite' THEN 2000
          WHEN tier = 'institutional' THEN 10000
          ELSE COALESCE(monthly_credits, 0)
      END
      WHERE monthly_credits = 0 OR monthly_credits IS NULL
    `);
    console.log('   ✅ Updated tier-based credit allocations');

    // Step 3: Create credit_transactions table
    if (!creditTransactionsExists) {
      console.log('📊 Creating credit_transactions table...');
      await client.query(`
        CREATE TABLE credit_transactions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            action VARCHAR(50) NOT NULL,
            credits_used INTEGER NOT NULL, -- Can be negative for purchases/refunds
            credits_remaining INTEGER NOT NULL,
            metadata JSONB DEFAULT '{}', -- Store additional transaction details
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Created credit_transactions table');

      // Create indexes
      await client.query(`CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id)`);
      await client.query(`CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at)`);
      console.log('   ✅ Created credit_transactions indexes');
    } else {
      console.log('   ℹ️ credit_transactions table already exists');
    }

    // Step 4: Create research_sessions table
    const checkResearchSessions = await client.query(`
      SELECT to_regclass('public.research_sessions') as exists
    `);
    
    if (checkResearchSessions.rows[0].exists === null) {
      console.log('📊 Creating research_sessions table...');
      await client.query(`
        CREATE TABLE research_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            session_id VARCHAR(100) NOT NULL, -- Client-generated session ID
            symbol VARCHAR(10) NOT NULL,
            start_time TIMESTAMP WITH TIME ZONE NOT NULL,
            end_time TIMESTAMP WITH TIME ZONE,
            credits_used INTEGER NOT NULL DEFAULT 0,
            queries_count INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, paused, completed
            metadata JSONB DEFAULT '{}', -- Store session details
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Created research_sessions table');

      // Create indexes
      await client.query(`CREATE INDEX idx_research_sessions_user_id ON research_sessions(user_id)`);
      await client.query(`CREATE INDEX idx_research_sessions_session_id ON research_sessions(session_id)`);
      await client.query(`CREATE INDEX idx_research_sessions_status ON research_sessions(status)`);
      console.log('   ✅ Created research_sessions indexes');

      // Add update trigger
      await client.query(`
        CREATE TRIGGER update_research_sessions_updated_at
            BEFORE UPDATE ON research_sessions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
      `);
      console.log('   ✅ Added research_sessions update trigger');
    } else {
      console.log('   ℹ️ research_sessions table already exists');
    }

    // Step 5: Create helpful views
    console.log('📊 Creating credit balance view...');
    await client.query(`
      CREATE OR REPLACE VIEW user_credit_summary AS
      SELECT 
          u.id as user_id,
          u.email,
          u.tier,
          u.monthly_credits,
          u.credits_used,
          COALESCE(u.credits_purchased, 0) as credits_purchased,
          (u.monthly_credits + COALESCE(u.credits_purchased, 0)) as total_credits,
          (u.monthly_credits + COALESCE(u.credits_purchased, 0) - u.credits_used) as remaining_credits,
          u.credits_reset_date,
          CASE 
              WHEN u.credits_reset_date < CURRENT_TIMESTAMP THEN true 
              ELSE false 
          END as needs_reset
      FROM users u
    `);
    console.log('   ✅ Created user_credit_summary view');

    // Step 6: Add some sample credit transactions for testing
    console.log('📊 Adding sample credit transactions...');
    const sampleUsersResult = await client.query(`
      SELECT id, tier, monthly_credits 
      FROM users 
      WHERE tier != 'free' 
      LIMIT 3
    `);

    for (const user of sampleUsersResult.rows) {
      // Add initial credit allocation transaction
      await client.query(`
        INSERT INTO credit_transactions (user_id, action, credits_used, credits_remaining, metadata)
        VALUES ($1, 'tier_allocation', $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [
        user.id,
        -user.monthly_credits, // Negative because it's adding credits
        user.monthly_credits - user.credits_used || 0,
        JSON.stringify({
          tier: user.tier,
          allocation_type: 'monthly_reset',
          timestamp: new Date().toISOString()
        })
      ]);
    }
    console.log('   ✅ Added sample credit transactions');

    // Step 7: Verify the migration
    console.log('\n🔍 Verifying migration...');
    
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const transactionCount = await client.query('SELECT COUNT(*) FROM credit_transactions');
    const sessionCount = await client.query('SELECT COUNT(*) FROM research_sessions');
    const viewCheck = await client.query('SELECT COUNT(*) FROM user_credit_summary');

    console.log(`   📊 Users: ${userCount.rows[0].count}`);
    console.log(`   💳 Credit transactions: ${transactionCount.rows[0].count}`);
    console.log(`   🔬 Research sessions: ${sessionCount.rows[0].count}`);
    console.log(`   📈 Credit summary view: ${viewCheck.rows[0].count} users`);

    console.log('\n✅ Credit system migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Test the /api/credits/balance endpoint');
    console.log('   3. Verify the PremiumCreditControls component loads correctly');
    console.log('   4. Test credit purchase functionality');

  } catch (error) {
    console.error('❌ Error applying credit system migration:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    client.release();
    pool.end();
    console.log('📡 Database connection closed.');
  }
}

applyCreditSystem()
  .then(() => console.log('🎉 Migration script finished.'))
  .catch(error => console.error('💥 Migration script failed:', error)); 