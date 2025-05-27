/**
 * Filings Parser - Main entry point for SEC filings parsing
 *
 * This module coordinates parsing of SEC filings from the EDGAR RSS feed,
 * delegating specific parsing tasks to specialized submodules.
 */

// Ensure ticker DB is initialised once when this module is loaded
const { initSecTickerDatabase } = require('./companyDatabase');
initSecTickerDatabase();

// Import parsers
const { parseForm4Data } = require('./parsers/form4Parser');
const { parseForm13FData, getQuarterEndDate } = require('./parsers/form13FParser');

// Import utilities
const { getCompanyForInsider } = require('./utils/parsingUtils');


// getQuarterEndDate has been moved to form13FParser.js

// getCompanyForInsider has been moved to utils/parsingUtils.js

/**
 * Parse Form 4 feed XML into an array of structured insider-trade objects.
 * This function now delegates to the specialized form4Parser module.
 *
 * @param {string} xmlData - XML data from SEC RSS feed
 * @param {number} limit - Maximum number of entries to parse
 * @returns {Promise<Array>} - Array of parsed insider trading objects
 */
async function parseSecForm4Data(xmlData, limit = 100) {
  try {
    console.log(`[filingsParser] Parsing Form 4 data with limit: ${limit}`);
    // Delegate to the specialized form4Parser module with proper limit parameter
    return parseForm4Data(xmlData, limit);
  } catch (err) {
    console.error('[filingsParser] Error delegating to form4Parser:', err.message);
    // Return empty array instead of throwing to prevent server crash
    return [];
  }
}

/**
 * Parse Form 13F feed XML into an array of structured institutional-holding objects.
 * This function now delegates to the specialized form13FParser module.
 *
 * @param {string} xmlData - XML data from SEC RSS feed
 * @param {number} limit - Maximum number of entries to parse
 * @returns {Promise<Array>} - Array of parsed institutional holdings objects
 */
async function parseSecForm13FData(xmlData, limit) {
  try {
    // Delegate to the specialized form13FParser module
    return parseForm13FData(xmlData, limit);
  } catch (err) {
    console.error('[filingsParser] Error delegating to form13FParser:', err.message);
    // Return empty array instead of throwing to prevent server crash
    return [];
  }
}

module.exports = {
  // Main functions
  parseSecForm4Data,
  parseSecForm13FData,
  
  // Utils - re-exported from specialized modules
  getCompanyForInsider,
  getQuarterEndDate
};