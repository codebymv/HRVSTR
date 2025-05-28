// This file handles data source configuration

// Default enabled state for data sources
let dataSourceConfig = {
  reddit: true,
  finviz: true,
  yahoo: true,  // Enable Yahoo Finance data source
  sec_insider: true,
  sec_institutional: true,
  earnings: true,
  sentiment: true
};

// Function to update data source configuration
function updateDataSources(config) {
  if (config) {
    // Only update values that are provided
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'boolean' && dataSourceConfig.hasOwnProperty(key)) {
        dataSourceConfig[key] = value;
      }
    }
    console.log('Data source configuration updated:', dataSourceConfig);
  }
}

// Check if a data source is enabled
function isDataSourceEnabled(source) {
  return dataSourceConfig[source] === true;
}

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Disable SSL
});

pool.on('connect', () => {
  console.log('Database connected successfully!');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err.stack);
});

module.exports = {
  updateDataSources,
  isDataSourceEnabled,
  // Export the current configuration
  getConfig: () => ({ ...dataSourceConfig }),
  pool
};
