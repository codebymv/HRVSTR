#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'hrvstr_dev',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function checkCacheData() {
  console.log('🔍 Checking SEC cache data for VARCHAR constraint issues...\n');
  
  try {
    // Check if tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_sec_cache', 'user_sec_insider_trades', 'user_sec_institutional_holdings')
    `;
    const tablesResult = await pool.query(tablesQuery);
    console.log('📋 Existing SEC cache tables:', tablesResult.rows.map(r => r.table_name));
    
    if (tablesResult.rows.length === 0) {
      console.log('❌ No SEC cache tables found. Run migrations first.');
      return;
    }

    // Check current column constraints
    const constraintsQuery = `
      SELECT table_name, column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_sec_cache', 'user_sec_insider_trades', 'user_sec_institutional_holdings')
      AND data_type = 'character varying'
      ORDER BY table_name, column_name
    `;
    const constraintsResult = await pool.query(constraintsQuery);
    
    console.log('\n📏 Current VARCHAR column constraints:');
    constraintsResult.rows.forEach(row => {
      const isProblematic = row.character_maximum_length <= 10;
      console.log(`  ${row.table_name}.${row.column_name}: VARCHAR(${row.character_maximum_length}) ${isProblematic ? '⚠️  PROBLEMATIC' : '✅'}`);
    });

    // Check for data that might be too long
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      
      if (tableName === 'user_sec_cache') {
        // Check time_range values
        const timeRangeQuery = `SELECT DISTINCT time_range, LENGTH(time_range) as len FROM ${tableName} ORDER BY len DESC`;
        const timeRangeResult = await pool.query(timeRangeQuery);
        
        console.log(`\n📊 ${tableName} - time_range values:`);
        timeRangeResult.rows.forEach(row => {
          const isTooLong = row.len > 10;
          console.log(`  "${row.time_range}" (${row.len} chars) ${isTooLong ? '⚠️  TOO LONG' : '✅'}`);
        });
      }
      
      if (tableName === 'user_sec_insider_trades') {
        // Check ticker values
        const tickerQuery = `SELECT DISTINCT ticker, LENGTH(ticker) as len FROM ${tableName} WHERE LENGTH(ticker) > 10 ORDER BY len DESC LIMIT 10`;
        const tickerResult = await pool.query(tickerQuery);
        
        if (tickerResult.rows.length > 0) {
          console.log(`\n📊 ${tableName} - ticker values > 10 chars:`);
          tickerResult.rows.forEach(row => {
            console.log(`  "${row.ticker}" (${row.len} chars) ⚠️`);
          });
        }

        // Check trade_type values
        const tradeTypeQuery = `SELECT DISTINCT trade_type, LENGTH(trade_type) as len FROM ${tableName} ORDER BY len DESC`;
        const tradeTypeResult = await pool.query(tradeTypeQuery);
        
        console.log(`\n📊 ${tableName} - trade_type values:`);
        tradeTypeResult.rows.forEach(row => {
          const isTooLong = row.len > 10;
          console.log(`  "${row.trade_type}" (${row.len} chars) ${isTooLong ? '⚠️  TOO LONG' : '✅'}`);
        });
      }
      
      if (tableName === 'user_sec_institutional_holdings') {
        // Check ticker values
        const tickerQuery = `SELECT DISTINCT ticker, LENGTH(ticker) as len FROM ${tableName} WHERE LENGTH(ticker) > 10 ORDER BY len DESC LIMIT 10`;
        const tickerResult = await pool.query(tickerQuery);
        
        if (tickerResult.rows.length > 0) {
          console.log(`\n📊 ${tableName} - ticker values > 10 chars:`);
          tickerResult.rows.forEach(row => {
            console.log(`  "${row.ticker}" (${row.len} chars) ⚠️`);
          });
        }
      }
    }

    // Check for recent cache entries
    const cacheCountQuery = `SELECT COUNT(*) as count FROM user_sec_cache`;
    const cacheCountResult = await pool.query(cacheCountQuery);
    console.log(`\n📊 Total cache entries: ${cacheCountResult.rows[0].count}`);

    const recentCacheQuery = `
      SELECT data_type, time_range, COUNT(*) as count, MAX(created_at) as latest
      FROM user_sec_cache 
      GROUP BY data_type, time_range 
      ORDER BY latest DESC
    `;
    const recentCacheResult = await pool.query(recentCacheQuery);
    
    console.log('\n📊 Cache entries by type:');
    recentCacheResult.rows.forEach(row => {
      console.log(`  ${row.data_type} (${row.time_range}): ${row.count} entries, latest: ${new Date(row.latest).toLocaleString()}`);
    });

  } catch (error) {
    console.error('❌ Error checking cache data:', error.message);
  }
}

async function runMigration() {
  console.log('\n🔧 Running migration to fix VARCHAR constraints...\n');
  
  try {
    const migrationPath = path.join(__dirname, 'migrations', 'update_sec_cache_column_sizes.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.log('❌ Migration file not found:', migrationPath);
      return;
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('\n🚀 Executing migration...\n');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the changes
    const verifyQuery = `
      SELECT table_name, column_name, character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_sec_cache', 'user_sec_insider_trades', 'user_sec_institutional_holdings')
      AND column_name IN ('ticker', 'trade_type', 'time_range')
      AND data_type = 'character varying'
      ORDER BY table_name, column_name
    `;
    const verifyResult = await pool.query(verifyQuery);
    
    console.log('\n✅ Updated column constraints:');
    verifyResult.rows.forEach(row => {
      console.log(`  ${row.table_name}.${row.column_name}: VARCHAR(${row.character_maximum_length})`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

async function main() {
  console.log('🔍 SEC Cache Data Checker\n');
  
  const args = process.argv.slice(2);
  const command = args[0] || 'check';
  
  try {
    if (command === 'check') {
      await checkCacheData();
    } else if (command === 'migrate') {
      await runMigration();
    } else if (command === 'both') {
      await checkCacheData();
      await runMigration();
      console.log('\n🔄 Re-checking after migration...\n');
      await checkCacheData();
    } else {
      console.log('Usage:');
      console.log('  node check-cache-data.js check    - Check current cache data');
      console.log('  node check-cache-data.js migrate  - Run migration to fix constraints');
      console.log('  node check-cache-data.js both     - Check, migrate, then check again');
    }
  } catch (error) {
    console.error('❌ Script failed:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkCacheData, runMigration }; 