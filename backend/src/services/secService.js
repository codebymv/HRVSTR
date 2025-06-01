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
 * Enhanced error handler for SEC service operations
 * @param {Error} error - The error to handle
 * @param {string} operation - Description of the operation that failed
 * @returns {Object} - Standardized error response
 */
function handleSecServiceError(error, operation) {
  console.error(`[secService] ${operation} failed:`, error.message);
  
  // Check for rate limiting
  if (error.isRateLimit || error.message.includes('429') || error.message.includes('rate limit')) {
    return {
      success: false,
      error: 'SEC_RATE_LIMITED',
      message: 'SEC API rate limit reached. This is temporary - please wait a moment and try again.',
      userMessage: 'The SEC servers are currently busy. We\'ll automatically retry in a few seconds.',
      retryAfter: 60, // Suggest waiting 60 seconds
      technical: error.message
    };
  }
  
  // Check for server errors
  if (error.isServerError || (error.response && error.response.status >= 500)) {
    return {
      success: false,
      error: 'SEC_SERVER_ERROR',
      message: 'SEC API servers are temporarily unavailable.',
      userMessage: 'SEC servers are experiencing issues. Please try again in a few minutes.',
      retryAfter: 300, // Suggest waiting 5 minutes
      technical: error.message
    };
  }
  
  // Check for network errors
  if (error.isNetworkError || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: 'Network connection to SEC API failed.',
      userMessage: 'Connection issue detected. Please check your internet connection and try again.',
      retryAfter: 30,
      technical: error.message
    };
  }
  
  // Generic error
  return {
    success: false,
    error: 'SEC_API_ERROR',
    message: 'SEC API request failed.',
    userMessage: 'Unable to fetch SEC data at the moment. Please try again later.',
    retryAfter: 60,
    technical: error.message
  };
}

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
    return handleSecServiceError(error, 'filing details fetch');
  }
}

/**
 * Get insider trades with enhanced error handling
 */
async function getInsiderTrades(timeRange = '1m', limit = 100, progressCallback = null) {
  try {
    console.log(`[secService] Fetching insider trades for ${timeRange}, limit: ${limit}`);
    
    // Add progress callback for rate limit awareness
    const enhancedProgressCallback = progressCallback ? (progress) => {
      // Add rate limit context to progress updates
      if (progress.stage && progress.stage.includes('Rate Limit')) {
        progress.isRateLimit = true;
        progress.userMessage = 'SEC servers are busy. Waiting to retry...';
      }
      progressCallback(progress);
    } : null;
    
    const insiderTrades = await fetchInsiderTrades(timeRange, limit, enhancedProgressCallback);
    
    if (!insiderTrades || insiderTrades.length === 0) {
      console.log(`[secService] No insider trades found for timeRange: ${timeRange}`);
      return {
        success: true,
        data: [],
        count: 0,
        message: 'No insider trades found for the selected time range.',
        userMessage: 'No insider trading activity found for the selected time period. Try a different time range.'
      };
    }
    
    console.log(`[secService] Successfully fetched ${insiderTrades.length} insider trades`);
    return {
      success: true,
      data: insiderTrades,
      count: insiderTrades.length,
      message: `Successfully fetched ${insiderTrades.length} insider trades`
    };
  } catch (error) {
    return handleSecServiceError(error, 'insider trades fetch');
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
    return handleSecServiceError(error, 'institutional holdings fetch');
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
    return handleSecServiceError(error, 'insider trades by ticker fetch');
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
    return handleSecServiceError(error, 'institutional holdings by ticker fetch');
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
    return handleSecServiceError(error, 'filings search');
  }
}

module.exports = {
  // Core functions with enhanced error handling
  fetchInsiderTrades: getInsiderTrades,
  getInsiderTrades,
  fetchInstitutionalHoldings: getInstitutionalHoldings,
  getInstitutionalHoldings,
  
  // New enhanced functions
  getFilingDetails,
  getInsiderTradesByTicker,
  getInstitutionalHoldingsByTicker,
  searchFilings,
  
  // Parser functions (re-exported)
  parseSecForm4Data,
  parseSecForm13FData
};