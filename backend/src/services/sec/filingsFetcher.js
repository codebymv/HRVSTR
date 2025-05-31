const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');

// Parsing helpers are kept in a separate module to maintain a clear separation of concerns
const {
  parseSecForm4Data,
  parseSecForm13FData
} = require('./filingsParser');

/**
 * Fetch SEC Form 4 (insider trade) data from the SEC EDGAR RSS feed and parse it.
 *
 * @param {string} [timeRange] - Optional time-range filter (placeholder for future use)
 * @param {number} [limit=100]  - Maximum number of entries to fetch from the feed
 * @param {function} [progressCallback] - Optional callback function for progress updates
 * @returns {Promise<Array>} Parsed insider-trade objects
 */
async function fetchInsiderTrades(timeRange = '1m', limit = 100, progressCallback = null) {
  try {
    // The SEC RSS feed URL for the latest Form 4 filings
    const secUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&count=${limit}&output=atom`;
    console.log(`[filingsFetcher] Fetching SEC Form 4 filings from: ${secUrl}`);

    // Emit initial progress
    if (progressCallback) {
      progressCallback({ 
        stage: 'Fetching SEC Form 4 data from EDGAR...', 
        progress: 5, 
        total: limit, 
        current: 0 
      });
    }

    // Make the actual API request to SEC EDGAR
    const response = await axios.get(secUrl, {
      headers: {
        'User-Agent': 'HRVSTR Financial Analysis Platform (educational purposes) contact@example.com',
        'Accept': 'application/atom+xml,application/xml,text/xml,*/*'
      },
      timeout: 15000 // 15 second timeout
    });

    // Emit progress after successful fetch
    if (progressCallback) {
      progressCallback({ 
        stage: 'SEC data received, starting processing...', 
        progress: 10, 
        total: limit, 
        current: 0 
      });
    }

    // Parse the XML data using the form4Parser with progress callback
    const insiderTrades = await parseSecForm4Data(response.data, limit, progressCallback);
    
    // If we got no data from the parser, return empty array
    if (!insiderTrades || insiderTrades.length === 0) {
      console.log('[filingsFetcher] No insider trades found from SEC API');
      if (progressCallback) {
        progressCallback({ 
          stage: 'No insider trades found', 
          progress: 100, 
          total: 0, 
          current: 0 
        });
      }
      return [];
    }
    
    console.log(`[filingsFetcher] Successfully fetched ${insiderTrades.length} insider trades`);
    return insiderTrades;
  } catch (error) {
    console.error('[filingsFetcher] Error fetching SEC insider trades:', error.message);
    
    // Emit error progress
    if (progressCallback) {
      progressCallback({ 
        stage: 'Error fetching SEC data', 
        progress: 0, 
        total: 0, 
        current: 0,
        error: error.message 
      });
    }
    
    // Return empty array instead of sample data
    return [];
  }
}

/**
 * Fetch SEC Form 13F (institutional holding) data from the SEC EDGAR RSS feed and parse it.
 *
 * @param {string} [timeRange] - Optional time-range filter (placeholder for future use)
 * @param {number} [limit=100]  - Maximum number of entries to fetch from the feed
 * @returns {Promise<Array>} Parsed institutional-holding objects
 */
async function fetchInstitutionalHoldings(timeRange = '1m', limit = 100) {
  try {
    // The SEC RSS feed URL for the latest Form 13F filings
    const secUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=13F&count=${limit}&output=atom`;
    console.log(`[filingsFetcher] Fetching SEC Form 13F filings from: ${secUrl}`);

    // Make the actual API request to SEC EDGAR
    const response = await axios.get(secUrl, {
      headers: {
        'User-Agent': 'HRVSTR Financial Analysis Platform (educational purposes) contact@example.com',
        'Accept': 'application/atom+xml,application/xml,text/xml,*/*'
      },
      timeout: 15000 // 15 second timeout
    });

    // Parse the XML data using the form13FParser
    const institutionalHoldings = await parseSecForm13FData(response.data, limit);
    
    // If we got no data from the parser, return empty array
    if (!institutionalHoldings || institutionalHoldings.length === 0) {
      console.log('[filingsFetcher] No institutional holdings found from SEC API');
      return [];
    }
    
    console.log(`[filingsFetcher] Successfully fetched ${institutionalHoldings.length} institutional holdings`);
    return institutionalHoldings;
  } catch (error) {
    console.error('[filingsFetcher] Error fetching SEC institutional holdings:', error.message);
    // Return empty array instead of sample data
    return [];
  }
}

module.exports = {
  fetchInsiderTrades,
  fetchInstitutionalHoldings
};