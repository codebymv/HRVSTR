/**
 * Database connection wrapper
 * Re-exports the pool from data-sources for consistent import paths
 */
const { pool } = require('../config/data-sources');

module.exports = pool; 