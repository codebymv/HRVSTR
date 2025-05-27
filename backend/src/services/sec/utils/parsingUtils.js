/**
 * Parsing Utilities - Common utility functions for SEC parsing operations
 * 
 * This module contains shared functionality used across different SEC parsing modules.
 */
const axios = require('axios');
const cheerio = require('cheerio');
const { secTickersByCik, secTickersByName } = require('../companyDatabase');

// Local caches shared *only* within this module
let insiderToCompanyCik = {};
let companyInfoByCik = {};

/**
 * Retrieve company (issuer) info for a given insider CIK.
 * This method is fairly heavy (multiple API calls) so results are cached.
 *
 * @param {string} insiderCik - Insider CIK (10-digit zero-padded)
 * @returns {Promise<{companyCik:string, companyName:string, ticker:string}|null>}
 */
async function getCompanyForInsider(insiderCik) {
  try {
    if (insiderToCompanyCik[insiderCik]) {
      const companyCik = insiderToCompanyCik[insiderCik];
      if (companyInfoByCik[companyCik]) return companyInfoByCik[companyCik];
    }

    console.log(`[parsingUtils] Fetching company for insider CIK ${insiderCik}`);
    
    // First try the submissions API
    try {
      const submissionUrl = `https://data.sec.gov/submissions/CIK${insiderCik}.json`;
      const resp = await axios.get(submissionUrl, {
        headers: { 
          'User-Agent': 'HRVSTR Financial Analysis Platform (educational purposes) contact@example.com',
          'Accept': 'application/json,*/*'
        },
        timeout: 15000 // 15 second timeout
      });

      const data = resp.data;
      if (data?.filings?.recent) {
        const idx = data.filings.recent.form.findIndex(f => f === '4');
        if (idx !== -1) {
          const issuerCiks = data.filings.recent.issuerCik || [];
          const issuerNames = data.filings.recent.issuerName || [];
          if (issuerCiks.length && issuerCiks[0] !== insiderCik) {
            const companyCik = issuerCiks[0].toString().padStart(10, '0');
            const companyName = issuerNames[0] || 'Unknown Company';
            const ticker = secTickersByCik[companyCik] || findTickerFromName(companyName);
            insiderToCompanyCik[insiderCik] = companyCik;
            companyInfoByCik[companyCik] = { companyCik, companyName, ticker };
            return companyInfoByCik[companyCik];
          }
        }
      }
    } catch (submissionError) {
      console.error(`[parsingUtils] Submissions API error:`, submissionError.message);
    }

    // Fallback search via RSS feed (single-entry)
    try {
      const searchUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${insiderCik}&type=4&count=1&output=atom`;
      const searchResp = await axios.get(searchUrl, { 
        headers: { 
          'User-Agent': 'HRVSTR Financial Analysis Platform (educational purposes) contact@example.com',
          'Accept': 'application/atom+xml,application/xml,text/xml,*/*'
        },
        timeout: 15000 // 15 second timeout
      });
      
      const $ = cheerio.load(searchResp.data, { xmlMode: true });
      const title = $('entry > title').text();
      const summary = $('entry > summary').text();
      
      // Try different patterns to extract company name
      const match = title.match(/for\s+(.+?)\s+\(Issuer\)/i) || 
                   summary.match(/Issuer:\s+(.+?)\s+/i) || 
                   title.match(/\((.+?)\)\s+\-\s+/i);
                   
      if (match?.[1]) {
        const companyName = match[1].trim();
        const ticker = findTickerFromName(companyName);
        
        if (ticker) {
          return { companyCik: null, companyName, ticker };
        }
      }
    } catch (rssError) {
      console.error(`[parsingUtils] Insider search RSS lookup failed:`, rssError.message);
    }

    return null;
  } catch (err) {
    console.error(`[parsingUtils] Error in getCompanyForInsider:`, err.message);
    return null;
  }
}

/**
 * Try to find a ticker symbol from a company name
 * @param {string} companyName - Company name to search
 * @returns {string|null} - Ticker symbol or null if not found
 */
function findTickerFromName(companyName) {
  if (!companyName) return null;
  
  // First check our database directly
  const upperName = companyName.toUpperCase();
  if (secTickersByName[upperName]) {
    return secTickersByName[upperName];
  }
  
  // Try common variations of the name
  const variations = [
    upperName,
    upperName.replace(/\s+INC\.?$/, ''),
    upperName.replace(/\s+CORP\.?$/, ''),
    upperName.replace(/\s+CORPORATION$/, ''),
    upperName.replace(/\s+LLC$/, ''),
    upperName.replace(/\s+LTD\.?$/, ''),
    upperName.replace(/\s+GROUP$/, ''),
    upperName.replace(/\s+HOLDINGS$/, ''),
    upperName.replace(/\s+TECHNOLOGIES$/, ''),
    upperName.replace(/\s+TECHNOLOGY$/, '')
  ];
  
  for (const variant of variations) {
    if (secTickersByName[variant]) {
      return secTickersByName[variant];
    }
  }
  
  // Try to find partial matches
  for (const [name, ticker] of Object.entries(secTickersByName)) {
    if (upperName.includes(name) || name.includes(upperName)) {
      return ticker;
    }
  }
  
  // No match found
  return null;
}

/**
 * Normalize an SEC CIK by padding with leading zeros
 * 
 * @param {string|number} cik - Raw CIK value
 * @returns {string} - Normalized 10-digit CIK
 */
function normalizeCIK(cik) {
  if (!cik) return null;
  return cik.toString().padStart(10, '0');
}

/**
 * Extract date values from a filing content
 * 
 * @param {string} content - Filing content
 * @returns {Object} - Object with transaction and filing dates
 */
function extractDates(content) {
  try {
    // Default to current date
    const defaultDate = new Date().toISOString();
    
    // Transaction date patterns
    const transactionDatePatterns = [
      /Transaction Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Date of Transaction:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Date of Earliest Transaction:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Transaction Date:\s*(\d{4}-\d{2}-\d{2})/i,
      /Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
    ];
    
    // Filing date patterns
    const filingDatePatterns = [
      /Filing Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Date Filed:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Date Filed:\s*(\d{4}-\d{2}-\d{2})/i,
      /Date:\s*(\d{4}-\d{2}-\d{2})/i
    ];
    
    // Extract transaction date
    let transactionDate = null;
    for (const pattern of transactionDatePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        transactionDate = new Date(match[1]).toISOString();
        break;
      }
    }
    
    // Extract filing date
    let filingDate = null;
    for (const pattern of filingDatePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        filingDate = new Date(match[1]).toISOString();
        break;
      }
    }
    
    return {
      transactionDate: transactionDate || defaultDate,
      filingDate: filingDate || defaultDate
    };
  } catch (error) {
    console.error(`[parsingUtils] Error extracting dates: ${error.message}`);
    return {
      transactionDate: new Date().toISOString(),
      filingDate: new Date().toISOString()
    };
  }
}

module.exports = {
  getCompanyForInsider,
  normalizeCIK,
  extractDates,
  findTickerFromName
};