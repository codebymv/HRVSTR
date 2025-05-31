const { fetchInsiderTrades, fetchInstitutionalHoldings } = require('./sec/filingsFetcher');
const {
  parseSecForm4Data,
  parseSecForm13FData
} = require('./sec/filingsParser');
const { initSecTickerDatabase } = require('./sec/companyDatabase');
const axios = require('axios');

// Initialize the SEC ticker database when this module is loaded
initSecTickerDatabase();

/**
 * Get detailed information for a specific SEC filing by accession number
 * @param {string} accessionNumber - The SEC filing accession number
 * @returns {Promise<Object>} Filing details
 */
async function getFilingDetails(accessionNumber) {
  try {
    console.log(`[secService] Fetching filing details for ${accessionNumber}`);
    
    // Clean the accession number (remove dashes)
    const cleanAccessionNumber = accessionNumber.replace(/-/g, '');
    
    // Construct the SEC EDGAR URL for the filing
    const filingUrl = `https://www.sec.gov/Archives/edgar/data/${cleanAccessionNumber}`;
    
    // For now, return a basic structure - this would need full implementation
    // to parse specific filing documents
    const response = await axios.get(filingUrl, {
      headers: {
        'User-Agent': 'HRVSTR Financial Analysis Platform (educational purposes) contact@example.com',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000
    });

    // Basic parsing - in a full implementation, this would parse the specific filing type
    const filingDetails = {
      accessionNumber,
      url: filingUrl,
      retrieved: new Date().toISOString(),
      status: 'available',
      // Additional parsing would be needed here based on filing type
    };

    return filingDetails;
  } catch (error) {
    console.error(`[secService] Error fetching filing details: ${error.message}`);
    throw new Error(`Failed to fetch filing details: ${error.message}`);
  }
}

/**
 * Enhanced wrapper for fetchInsiderTrades with error handling
 * @param {string} timeRange - Time range for the data
 * @param {number} limit - Maximum number of results
 * @param {function} progressCallback - Optional callback function for progress updates
 * @returns {Promise<Array>} Array of insider trades
 */
async function getInsiderTrades(timeRange = '1m', limit = 100, progressCallback = null) {
  try {
    console.log(`[secService] Fetching insider trades for ${timeRange}, limit: ${limit}`);
    
    const trades = await fetchInsiderTrades(timeRange, limit, progressCallback);
    
    if (!trades || trades.length === 0) {
      console.warn(`[secService] No insider trades found for timeRange: ${timeRange}`);
      return [];
    }
    
    console.log(`[secService] Successfully fetched ${trades.length} insider trades`);
    return trades;
  } catch (error) {
    console.error(`[secService] Error in getInsiderTrades: ${error.message}`);
    // Return empty array instead of throwing to prevent cascade failures
    return [];
  }
}

/**
 * Enhanced wrapper for fetchInstitutionalHoldings with error handling
 * @param {string} timeRange - Time range for the data
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of institutional holdings
 */
async function getInstitutionalHoldings(timeRange = '1m', limit = 50) {
  try {
    console.log(`[secService] Fetching institutional holdings for ${timeRange}, limit: ${limit}`);
    
    const holdings = await fetchInstitutionalHoldings(timeRange, limit);
    
    if (!holdings || holdings.length === 0) {
      console.warn(`[secService] No institutional holdings found for timeRange: ${timeRange}`);
      return [];
    }
    
    console.log(`[secService] Successfully fetched ${holdings.length} institutional holdings`);
    return holdings;
  } catch (error) {
    console.error(`[secService] Error in getInstitutionalHoldings: ${error.message}`);
    // Return empty array instead of throwing to prevent cascade failures
    return [];
  }
}

/**
 * Get insider trades filtered by ticker symbol
 * @param {string} ticker - Stock ticker symbol
 * @param {string} timeRange - Time range for the data
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of insider trades for the ticker
 */
async function getInsiderTradesByTicker(ticker, timeRange = '1m', limit = 50) {
  try {
    console.log(`[secService] Fetching insider trades for ticker ${ticker}`);
    
    // Get all trades first, then filter by ticker
    const allTrades = await getInsiderTrades(timeRange, limit * 2);
    const tickerTrades = allTrades.filter(trade => 
      trade.ticker && trade.ticker.toUpperCase() === ticker.toUpperCase()
    );
    
    console.log(`[secService] Found ${tickerTrades.length} insider trades for ${ticker}`);
    return tickerTrades.slice(0, limit);
  } catch (error) {
    console.error(`[secService] Error in getInsiderTradesByTicker: ${error.message}`);
    return [];
  }
}

/**
 * Get institutional holdings filtered by ticker symbol
 * @param {string} ticker - Stock ticker symbol
 * @param {string} timeRange - Time range for the data
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of institutional holdings for the ticker
 */
async function getInstitutionalHoldingsByTicker(ticker, timeRange = '1m', limit = 20) {
  try {
    console.log(`[secService] Fetching institutional holdings for ticker ${ticker}`);
    
    // Get all holdings first, then filter by ticker
    const allHoldings = await getInstitutionalHoldings(timeRange, limit * 2);
    const tickerHoldings = allHoldings.filter(holding => 
      holding.ticker && holding.ticker.toUpperCase() === ticker.toUpperCase()
    );
    
    console.log(`[secService] Found ${tickerHoldings.length} institutional holdings for ${ticker}`);
    return tickerHoldings.slice(0, limit);
  } catch (error) {
    console.error(`[secService] Error in getInstitutionalHoldingsByTicker: ${error.message}`);
    return [];
  }
}

/**
 * Search for specific types of filings
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of matching filings
 */
async function searchFilings(options = {}) {
  try {
    const {
      ticker,
      formType = '4',
      limit = 20,
      timeRange = '1m'
    } = options;

    console.log(`[secService] Searching for ${formType} filings`, options);

    // This would require more sophisticated implementation
    // For now, delegate to existing functions based on form type
    if (formType === '4') {
      return ticker ? 
        await getInsiderTradesByTicker(ticker, timeRange, limit) :
        await getInsiderTrades(timeRange, limit);
    } else if (formType === '13F') {
      return ticker ?
        await getInstitutionalHoldingsByTicker(ticker, timeRange, limit) :
        await getInstitutionalHoldings(timeRange, limit);
    }

    return [];
  } catch (error) {
    console.error(`[secService] Error in searchFilings: ${error.message}`);
    return [];
  }
}

module.exports = {
  // Core functions with enhanced error handling
  fetchInsiderTrades: getInsiderTrades,
  fetchInstitutionalHoldings: getInstitutionalHoldings,
  
  // New enhanced functions
  getFilingDetails,
  getInsiderTradesByTicker,
  getInstitutionalHoldingsByTicker,
  searchFilings,
  
  // Parser functions (re-exported)
  parseSecForm4Data,
  parseSecForm13FData
};