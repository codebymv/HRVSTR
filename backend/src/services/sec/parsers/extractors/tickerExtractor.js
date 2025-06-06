/**
 * Ticker Extractor - Specialized extraction of ticker symbols using multiple resolution methods
 */

const { lookupTickerByCik, lookupTickerByName, lookupCompanyForInsider } = require('../utils/form4Utils');
const { findIssuerForPerson } = require('../../relationshipResolver');
const { getCompanyForInsider } = require('../../utils/parsingUtils');

/**
 * Extract ticker symbol using all available methods
 * @param {Object} params - Parameters for ticker extraction
 * @returns {Promise<string>} - Ticker symbol or '-'
 */
async function extractTicker(params) {
  const { companyName, companyCik, filerType, insiderName, personCIK, content } = params;
  
  console.log(`[tickerExtractor] Starting ticker extraction for: company="${companyName}", CIK="${companyCik}", type="${filerType}"`);
  
  let ticker = '-';
  
  // Method 1: Direct CIK lookup (most reliable)
  if (companyCik && ticker === '-') {
    ticker = await extractTickerByCik(companyCik);
  }
  
  // Method 2: Company name lookup
  if (companyName && ticker === '-') {
    ticker = await extractTickerByName(companyName);
  }
  
  // Method 3: Special case handling for well-known patterns
  if (companyName && ticker === '-') {
    ticker = await extractTickerBySpecialCases(companyName);
  }
  
  // Method 4: Enhanced fallback generation
  if (companyName && ticker === '-') {
    ticker = await generateTickerFromCompanyName(companyName);
  }
  
  // Methods 5-8: Reporting person specific methods (if it's a reporting person filing)
  if (filerType && filerType.toLowerCase().includes('reporting') && ticker === '-') {
    // Method 5: Insider CIK lookup
    if (personCIK) {
      ticker = await extractTickerByInsiderCik(personCIK);
    }
    
    // Method 6: Issuer extraction from content
    if (content && ticker === '-') {
      ticker = await extractTickerFromContent(content);
    }
    
    // Method 7: Known reporting persons mapping
    if (insiderName && ticker === '-') {
      ticker = await extractTickerByInsiderName(insiderName);
    }
    
    // Method 8: SEC Edgar Search API (last resort)
    if (insiderName && ticker === '-') {
      ticker = await extractTickerBySecSearch(insiderName, personCIK);
    }
  }
  
  console.log(`[tickerExtractor] Final ticker result: "${ticker}"`);
  return ticker;
}

/**
 * Method 1: Extract ticker by company CIK
 * @param {string} companyCik - Company CIK
 * @returns {Promise<string>} - Ticker or '-'
 */
async function extractTickerByCik(companyCik) {
  try {
    const ticker = lookupTickerByCik(companyCik);
    if (ticker) {
      console.log(`[tickerExtractor] Method 1 SUCCESS: Found ticker ${ticker} via CIK lookup`);
      return ticker;
    }
    
    console.log(`[tickerExtractor] Method 1 FAILED: No ticker found for CIK ${companyCik}`);
    return '-';
    
  } catch (error) {
    console.error(`[tickerExtractor] Method 1 ERROR: ${error.message}`);
    return '-';
  }
}

/**
 * Method 2: Extract ticker by company name
 * @param {string} companyName - Company name
 * @returns {Promise<string>} - Ticker or '-'
 */
async function extractTickerByName(companyName) {
  try {
    const ticker = lookupTickerByName(companyName);
    if (ticker) {
      console.log(`[tickerExtractor] Method 2 SUCCESS: Found ticker ${ticker} via name lookup`);
      return ticker;
    }
    
    console.log(`[tickerExtractor] Method 2 FAILED: No ticker found for company name ${companyName}`);
    return '-';
    
  } catch (error) {
    console.error(`[tickerExtractor] Method 2 ERROR: ${error.message}`);
    return '-';
  }
}

/**
 * Method 3: Extract ticker by special case patterns
 * @param {string} companyName - Company name
 * @returns {Promise<string>} - Ticker or '-'
 */
async function extractTickerBySpecialCases(companyName) {
  try {
    const specialCases = {
      'TENET HEALTHCARE': 'THC',
      'ELI LILLY': 'LLY', 
      'HARTE HANKS': 'HHS',
      'FRANKLIN ELECTRIC': 'FELE',
      'ALLY FINANCIAL': 'ALLY',
      '3M CO': 'MMM',
      'CATERPILLAR': 'CAT',
      'CALERES': 'CAL',
      'APPLE': 'AAPL',
      'MICROSOFT': 'MSFT',
      'AMAZON': 'AMZN',
      'ALPHABET': 'GOOGL',
      'META': 'META',
      'TESLA': 'TSLA',
      'NVIDIA': 'NVDA',
      'BERKSHIRE HATHAWAY': 'BRK.B',
      'JOHNSON & JOHNSON': 'JNJ',
      'JPMORGAN CHASE': 'JPM',
      'VISA': 'V',
      'MASTERCARD': 'MA',
      'WALMART': 'WMT',
      'HOME DEPOT': 'HD'
    };
    
    const upperCompanyName = companyName.toUpperCase();
    
    for (const [pattern, tickerSymbol] of Object.entries(specialCases)) {
      if (upperCompanyName.includes(pattern)) {
        console.log(`[tickerExtractor] Method 3 SUCCESS: Found ticker ${tickerSymbol} via special case pattern (${pattern})`);
        return tickerSymbol;
      }
    }
    
    console.log(`[tickerExtractor] Method 3 FAILED: No special case match for ${companyName}`);
    return '-';
    
  } catch (error) {
    console.error(`[tickerExtractor] Method 3 ERROR: ${error.message}`);
    return '-';
  }
}

/**
 * Method 4: Generate ticker from company name
 * @param {string} companyName - Company name
 * @returns {Promise<string>} - Generated ticker or '-'
 */
async function generateTickerFromCompanyName(companyName) {
  try {
    if (!companyName) return '-';
    
    // Clean company name
    const cleanName = companyName
      .replace(/\b(Inc|Corp|Corporation|Company|Ltd|Limited|LLC|LP|Co)\b\.?/gi, '')
      .trim();
    
    const words = cleanName.split(/\s+/).filter(word => word.length > 0);
    
    if (words.length === 0) return '-';
    
    let ticker = '-';
    
    // Rule 1: For single words, take first 2-4 letters
    if (words.length === 1) {
      const word = words[0].toUpperCase();
      if (word.length >= 4) {
        ticker = word.substring(0, 4);
      } else if (word.length >= 3) {
        ticker = word.substring(0, 3);
      } else if (word.length === 2) {
        ticker = word;
      }
    } else {
      // Rule 2: For multiple words, take first letters
      ticker = words.map(word => word.charAt(0).toUpperCase()).join('').substring(0, 5);
      
      // If we only got 1 character, try to get more from the first word
      if (ticker.length === 1) {
        const firstWord = words[0].toUpperCase();
        if (firstWord.length >= 3) {
          ticker = firstWord.substring(0, 3);
        } else {
          ticker = firstWord + words.slice(1).map(w => w.charAt(0)).join('').substring(0, 4);
        }
      }
    }
    
    // Rule 3: Special handling for common patterns
    if (cleanName.includes('TECHNOLOGIES')) {
      ticker = words[0].charAt(0).toUpperCase() + 'TECH';
    } else if (cleanName.includes('THERAPEUTICS')) {
      ticker = words[0].charAt(0).toUpperCase() + 'THER';
    } else if (cleanName.includes('PHARMACEUTICALS')) {
      ticker = words[0].charAt(0).toUpperCase() + 'PHAR';
    } else if (cleanName.includes('HOLDINGS')) {
      ticker = words[0].substring(0, Math.min(3, words[0].length)).toUpperCase() + 'H';
    }
    
    // Ensure minimum 2 characters
    if (ticker.length < 2) {
      const firstWord = words[0].toUpperCase();
      ticker = firstWord.length >= 2 ? firstWord.substring(0, 2) : '-';
    }
    
    if (ticker !== '-') {
      console.log(`[tickerExtractor] Method 4 SUCCESS: Generated ticker ${ticker} for company: ${companyName}`);
    } else {
      console.log(`[tickerExtractor] Method 4 FAILED: Could not generate ticker for ${companyName}`);
    }
    
    return ticker;
    
  } catch (error) {
    console.error(`[tickerExtractor] Method 4 ERROR: ${error.message}`);
    return '-';
  }
}

/**
 * Method 5: Extract ticker by insider CIK lookup
 * @param {string} personCIK - Person CIK
 * @returns {Promise<string>} - Ticker or '-'
 */
async function extractTickerByInsiderCik(personCIK) {
  try {
    console.log(`[tickerExtractor] Method 5: Looking up issuer for insider CIK ${personCIK}...`);
    
    const companyInfo = await getCompanyForInsider(personCIK);
    if (companyInfo && companyInfo.ticker) {
      console.log(`[tickerExtractor] Method 5 SUCCESS: Found ticker ${companyInfo.ticker} via insider CIK lookup`);
      return companyInfo.ticker;
    }
    
    console.log(`[tickerExtractor] Method 5 FAILED: No company found for insider CIK ${personCIK}`);
    return '-';
    
  } catch (error) {
    console.error(`[tickerExtractor] Method 5 ERROR: ${error.message}`);
    return '-';
  }
}

/**
 * Method 6: Extract ticker from filing content
 * @param {string} content - Filing content
 * @returns {Promise<string>} - Ticker or '-'
 */
async function extractTickerFromContent(content) {
  try {
    if (!content || content.length === 0) {
      console.log(`[tickerExtractor] Method 6 FAILED: No content provided`);
      return '-';
    }
    
    // Look for issuer information in content
    const issuerMatch = content.match(/Issuer[^:]*:[^A-Z]*([A-Za-z0-9\s\.\,]+)/i);
    if (issuerMatch) {
      const issuerName = issuerMatch[1].trim();
      const ticker = lookupTickerByName(issuerName);
      if (ticker) {
        console.log(`[tickerExtractor] Method 6 SUCCESS: Found ticker ${ticker} from issuer name ${issuerName}`);
        return ticker;
      }
    }
    
    // Look for explicit ticker mentions
    const tickerPatterns = [
      /Issuer[^:]*:[^A-Z]*\(([A-Z]{1,5})\)/i,
      /Ticker[^:]*:\s*([A-Z]{1,5})/i,
      /Symbol[^:]*:\s*([A-Z]{1,5})/i,
      /Trading\s+Symbol[^:]*:\s*([A-Z]{1,5})/i
    ];
    
    for (const pattern of tickerPatterns) {
      const match = content.match(pattern);
      if (match) {
        const ticker = match[1].toUpperCase();
        console.log(`[tickerExtractor] Method 6 SUCCESS: Found explicit ticker ${ticker} in content`);
        return ticker;
      }
    }
    
    console.log(`[tickerExtractor] Method 6 FAILED: No ticker found in content`);
    return '-';
    
  } catch (error) {
    console.error(`[tickerExtractor] Method 6 ERROR: ${error.message}`);
    return '-';
  }
}

/**
 * Method 7: Extract ticker by insider name mapping
 * @param {string} insiderName - Insider name
 * @returns {Promise<string>} - Ticker or '-'
 */
async function extractTickerByInsiderName(insiderName) {
  try {
    const companyInfo = lookupCompanyForInsider(insiderName);
    if (companyInfo && companyInfo.ticker) {
      console.log(`[tickerExtractor] Method 7 SUCCESS: Found ticker ${companyInfo.ticker} via insider name mapping`);
      return companyInfo.ticker;
    }
    
    console.log(`[tickerExtractor] Method 7 FAILED: No company mapping found for insider ${insiderName}`);
    return '-';
    
  } catch (error) {
    console.error(`[tickerExtractor] Method 7 ERROR: ${error.message}`);
    return '-';
  }
}

/**
 * Method 8: Extract ticker using SEC Edgar Search API
 * @param {string} insiderName - Insider name
 * @param {string} personCIK - Person CIK
 * @returns {Promise<string>} - Ticker or '-'
 */
async function extractTickerBySecSearch(insiderName, personCIK) {
  try {
    console.log(`[tickerExtractor] Method 8: SEC SEARCH API for insider ${insiderName}...`);
    
    const issuerInfo = await findIssuerForPerson({ 
      name: insiderName,
      cik: personCIK
    });
    
    if (issuerInfo && issuerInfo.ticker) {
      console.log(`[tickerExtractor] Method 8 SUCCESS: Found ticker ${issuerInfo.ticker} via SEC Search API`);
      return issuerInfo.ticker;
    }
    
    console.log(`[tickerExtractor] Method 8 FAILED: No issuer found via SEC Search API`);
    return '-';
    
  } catch (error) {
    console.error(`[tickerExtractor] Method 8 ERROR: ${error.message}`);
    return '-';
  }
}

/**
 * Extract ticker with detailed method tracking
 * @param {Object} params - Parameters for ticker extraction
 * @returns {Promise<Object>} - Result with ticker and method used
 */
async function extractTickerWithDetails(params) {
  const methods = [
    { name: 'CIK Lookup', func: () => extractTickerByCik(params.companyCik) },
    { name: 'Name Lookup', func: () => extractTickerByName(params.companyName) },
    { name: 'Special Cases', func: () => extractTickerBySpecialCases(params.companyName) },
    { name: 'Name Generation', func: () => generateTickerFromCompanyName(params.companyName) }
  ];
  
  // Add reporting person methods if applicable
  if (params.filerType && params.filerType.toLowerCase().includes('reporting')) {
    methods.push(
      { name: 'Insider CIK', func: () => extractTickerByInsiderCik(params.personCIK) },
      { name: 'Content Extraction', func: () => extractTickerFromContent(params.content) },
      { name: 'Insider Mapping', func: () => extractTickerByInsiderName(params.insiderName) },
      { name: 'SEC Search API', func: () => extractTickerBySecSearch(params.insiderName, params.personCIK) }
    );
  }
  
  for (const method of methods) {
    try {
      const ticker = await method.func();
      if (ticker && ticker !== '-') {
        return {
          ticker,
          method: method.name,
          success: true
        };
      }
    } catch (error) {
      console.error(`[tickerExtractor] ${method.name} failed: ${error.message}`);
    }
  }
  
  return {
    ticker: '-',
    method: 'None',
    success: false
  };
}

/**
 * Batch extract tickers for multiple entries
 * @param {Array} entries - Array of parameter objects
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Promise<Array>} - Array of ticker results
 */
async function batchExtractTickers(entries, progressCallback = null) {
  const results = [];
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    if (progressCallback) {
      progressCallback({
        current: i + 1,
        total: entries.length,
        entry: entry.companyName || entry.insiderName || 'Unknown'
      });
    }
    
    try {
      const result = await extractTickerWithDetails(entry);
      results.push({
        ...entry,
        ...result
      });
    } catch (error) {
      console.error(`[tickerExtractor] Batch extraction failed for entry ${i}: ${error.message}`);
      results.push({
        ...entry,
        ticker: '-',
        method: 'Error',
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

module.exports = {
  extractTicker,
  extractTickerWithDetails,
  batchExtractTickers,
  generateTickerFromCompanyName
}; 