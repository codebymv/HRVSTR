require('dotenv').config();
const { pool } = require('../config/data-sources');

async function createCompaniesTable() {
  try {
    // Create companies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) UNIQUE NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        sector VARCHAR(100),
        industry VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Companies table created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating companies table:', error);
    process.exit(1);
  }
}

createCompaniesTable(); 