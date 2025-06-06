/**
 * Form 4 Utilities - Shared utilities for Form 4 parsing operations
 */

const { 
  secTickersByCik, 
  secTickersByName, 
  reportingPersonsToCompany,
  reportingPersonsToRoles 
} = require('../../companyDatabase');

/**
 * Convert filing date to quarter-end date
 * @param {string} filingDateStr - Filing date string
 * @returns {string} - Quarter-end date as ISO string
 */
function getQuarterEndDate(filingDateStr) {
  try {
    const filingDate = new Date(filingDateStr);
    const quarterEnd = new Date(filingDate);
    quarterEnd.setDate(1);
    quarterEnd.setMonth(Math.floor(quarterEnd.getMonth() / 3) * 3 + 2);
    quarterEnd.setDate(0); // last day of previous month
    return quarterEnd.toISOString();
  } catch (error) {
    console.error(`[form4Utils] Error calculating quarter end date: ${error.message}`);
    return new Date().toISOString();
  }
}

/**
 * Parse and validate filing dates with fallback priority
 * @param {Object} dateFields - Object containing potential date fields
 * @returns {Object} - Validated date information
 */
function processFilingDates(dateFields) {
  const { actualFilingDate, published, updated } = dateFields;
  
  let filingDate;
  let dateSource = 'fallback';
  
  try {
    if (actualFilingDate) {
      filingDate = new Date(actualFilingDate);
      dateSource = 'document';
      console.log(`[form4Utils] Using actual filing date from document: ${actualFilingDate}`);
    } else if (published) {
      filingDate = new Date(published);
      dateSource = 'published';
      console.log(`[form4Utils] Using published date: ${published}`);
    } else if (updated) {
      filingDate = new Date(updated);
      dateSource = 'updated';
      console.log(`[form4Utils] Using updated date: ${updated}`);
    } else {
      filingDate = new Date();
      dateSource = 'current';
      console.log(`[form4Utils] Using current date as fallback`);
    }
    
    // Validate the date
    if (isNaN(filingDate.getTime())) {
      console.warn(`[form4Utils] Invalid date detected, using current date`);
      filingDate = new Date();
      dateSource = 'fallback';
    }
    
    return {
      filingDate: filingDate.toISOString(),
      transactionDate: filingDate.toISOString(), // Use same date for transaction
      dateSource,
      quarterEnd: getQuarterEndDate(filingDate.toISOString())
    };
    
  } catch (dateError) {
    console.error(`[form4Utils] Error parsing dates:`, dateError.message);
    const fallbackDate = new Date();
    return {
      filingDate: fallbackDate.toISOString(),
      transactionDate: fallbackDate.toISOString(),
      dateSource: 'error_fallback',
      quarterEnd: getQuarterEndDate(fallbackDate.toISOString())
    };
  }
}

/**
 * Look up ticker by CIK with fallback options
 * @param {string} cik - Company CIK (Central Index Key)
 * @returns {string|null} - Ticker symbol or null
 */
function lookupTickerByCik(cik) {
  if (!cik) return null;
  
  try {
    // Ensure CIK is properly formatted
    const paddedCik = cik.toString().padStart(10, '0');
    const unpaddedCik = cik.toString().replace(/^0+/, '');
    
    // Try padded CIK first
    if (secTickersByCik[paddedCik]) {
      console.log(`[form4Utils] Found ticker ${secTickersByCik[paddedCik]} via padded CIK (${paddedCik})`);
      return secTickersByCik[paddedCik];
    }
    
    // Try unpadded CIK
    if (secTickersByCik[unpaddedCik]) {
      console.log(`[form4Utils] Found ticker ${secTickersByCik[unpaddedCik]} via unpadded CIK (${unpaddedCik})`);
      return secTickersByCik[unpaddedCik];
    }
    
    console.log(`[form4Utils] No ticker found for CIK ${cik} in database`);
    return null;
    
  } catch (error) {
    console.error(`[form4Utils] Error looking up CIK ${cik}: ${error.message}`);
    return null;
  }
}

/**
 * Look up ticker by company name with fuzzy matching
 * @param {string} companyName - Company name
 * @returns {string|null} - Ticker symbol or null
 */
function lookupTickerByName(companyName) {
  if (!companyName) return null;
  
  try {
    const upperCompanyName = companyName.toUpperCase().trim();
    
    // Direct match
    if (secTickersByName[upperCompanyName]) {
      console.log(`[form4Utils] Found ticker ${secTickersByName[upperCompanyName]} via direct name match`);
      return secTickersByName[upperCompanyName];
    }
    
    // Try cleaned name (remove suffixes)
    const cleanedName = upperCompanyName.replace(/,?\s*(INC\.?|CORP\.?|CORPORATION|LLC|LTD\.?|CO\.?)$/i, '').trim();
    if (secTickersByName[cleanedName]) {
      console.log(`[form4Utils] Found ticker ${secTickersByName[cleanedName]} via cleaned name match (${cleanedName})`);
      return secTickersByName[cleanedName];
    }
    
    // Try partial matches (fuzzy matching)
    for (const [dbName, dbTicker] of Object.entries(secTickersByName)) {
      if (cleanedName.includes(dbName) || dbName.includes(cleanedName)) {
        console.log(`[form4Utils] Found ticker ${dbTicker} via partial match: "${cleanedName}" ~ "${dbName}"`);
        return dbTicker;
      }
    }
    
    console.log(`[form4Utils] No ticker found for company name: ${companyName}`);
    return null;
    
  } catch (error) {
    console.error(`[form4Utils] Error looking up company name ${companyName}: ${error.message}`);
    return null;
  }
}

/**
 * Look up insider role by name
 * @param {string} insiderName - Insider name
 * @returns {string|null} - Role or null
 */
function lookupInsiderRole(insiderName) {
  if (!insiderName) return null;
  
  try {
    const lowerInsiderName = insiderName.toLowerCase().trim();
    
    // Direct lookup
    if (reportingPersonsToRoles[lowerInsiderName]) {
      console.log(`[form4Utils] Found role "${reportingPersonsToRoles[lowerInsiderName]}" for "${insiderName}"`);
      return reportingPersonsToRoles[lowerInsiderName];
    }
    
    // Try name parts for partial matches
    const nameParts = lowerInsiderName.split(/\s+/);
    const possibleNameKeys = [
      nameParts[0], // First part (often last name)
      nameParts[nameParts.length - 1], // Last part (often first name)
      nameParts.slice(0, 2).join(' ') // First two parts
    ];
    
    for (const nameKey of possibleNameKeys) {
      if (reportingPersonsToRoles[nameKey]) {
        console.log(`[form4Utils] Found role "${reportingPersonsToRoles[nameKey]}" for "${insiderName}" via partial match "${nameKey}"`);
        return reportingPersonsToRoles[nameKey];
      }
    }
    
    return null;
    
  } catch (error) {
    console.error(`[form4Utils] Error looking up insider role for ${insiderName}: ${error.message}`);
    return null;
  }
}

/**
 * Look up company for insider by name
 * @param {string} insiderName - Insider name
 * @returns {Object|null} - Company info or null
 */
function lookupCompanyForInsider(insiderName) {
  if (!insiderName) return null;
  
  try {
    const lowerName = insiderName.toLowerCase().trim();
    const nameParts = lowerName.split(/\s+/);
    
    const possibleNameKeys = [
      lowerName, // Full name
      nameParts[0], // First part
      nameParts[nameParts.length - 1], // Last part
      nameParts.slice(0, 2).join(' ') // First two parts
    ];
    
    for (const nameKey of possibleNameKeys) {
      if (reportingPersonsToCompany[nameKey]) {
        console.log(`[form4Utils] Found company info for "${insiderName}" via name match "${nameKey}"`);
        return reportingPersonsToCompany[nameKey];
      }
    }
    
    return null;
    
  } catch (error) {
    console.error(`[form4Utils] Error looking up company for insider ${insiderName}: ${error.message}`);
    return null;
  }
}

/**
 * Validate and clean insider name
 * @param {string} insiderName - Raw insider name
 * @returns {string} - Cleaned insider name
 */
function cleanInsiderName(insiderName) {
  if (!insiderName || typeof insiderName !== 'string') {
    return 'Unknown';
  }
  
  // Remove common prefixes and clean up
  const cleaned = insiderName
    .replace(/^4\s*-\s*/, '') // Remove "4 - " prefix
    .replace(/^\s*(Form\s*4\s*-\s*)?/i, '') // Remove "Form 4 - " prefix
    .trim();
  
  return cleaned || 'Unknown';
}

/**
 * Validate and clean position/title
 * @param {string} position - Raw position
 * @returns {string} - Cleaned position
 */
function cleanPosition(position) {
  if (!position || typeof position !== 'string') {
    return 'Unknown Position';
  }
  
  // Clean up invalid positions
  if (position === 'Sec Form 4' || position === 'Form 4' || position.trim() === '') {
    return 'Unknown Position';
  }
  
  return position.trim();
}

/**
 * Parse Form 4 title to extract company info
 * @param {string} title - Form 4 title
 * @returns {Object} - Parsed title information
 */
function parseForm4Title(title) {
  if (!title) {
    return {
      companyName: null,
      companyCik: null,
      filerType: null,
      success: false
    };
  }
  
  try {
    // Match pattern: "4 - COMPANY NAME (CIK) (Filer Type)"
    const titleMatch = title.match(/4\s*-\s*([^(]+)\s*\((\d+)\)\s*\(([^)]*)\)/i);
    
    if (titleMatch) {
      return {
        companyName: titleMatch[1].trim(),
        companyCik: titleMatch[2].toString().padStart(10, '0'),
        filerType: titleMatch[3].trim() || 'subject company',
        success: true
      };
    }
    
    console.log(`[form4Utils] Could not parse title format: ${title}`);
    return {
      companyName: null,
      companyCik: null,
      filerType: null,
      success: false
    };
    
  } catch (error) {
    console.error(`[form4Utils] Error parsing title: ${error.message}`);
    return {
      companyName: null,
      companyCik: null,
      filerType: null,
      success: false
    };
  }
}

/**
 * Check if a string represents a Form 4 filing
 * @param {string} title - Title to check
 * @returns {boolean} - True if it's a Form 4 filing
 */
function isForm4Filing(title) {
  if (!title || typeof title !== 'string') {
    return false;
  }
  
  return title.match(/\b4\b|Form 4|4 -/i) !== null;
}

/**
 * Generate a unique ID for a trade entry
 * @param {number} index - Entry index
 * @param {string} prefix - ID prefix
 * @returns {string} - Unique ID
 */
function generateTradeId(index, prefix = 'form4') {
  return `${prefix}-${index}-${Date.now()}`;
}

/**
 * Validate trade data completeness
 * @param {Object} tradeData - Trade data object
 * @returns {Object} - Validation result
 */
function validateTradeData(tradeData) {
  const validationResult = {
    isValid: true,
    warnings: [],
    errors: []
  };
  
  // Check required fields
  if (!tradeData.insiderName || tradeData.insiderName === 'Unknown') {
    validationResult.warnings.push('Insider name is unknown or missing');
  }
  
  if (!tradeData.ticker || tradeData.ticker === '-') {
    validationResult.warnings.push('Ticker symbol not found');
  }
  
  if (!tradeData.title || tradeData.title === 'Unknown Position') {
    validationResult.warnings.push('Insider position/title not determined');
  }
  
  if (tradeData.shares === 0 && tradeData.value === 0) {
    validationResult.warnings.push('No transaction data extracted');
  }
  
  // Check for critical errors
  if (!tradeData.filingDate) {
    validationResult.errors.push('Filing date is required');
    validationResult.isValid = false;
  }
  
  return validationResult;
}

module.exports = {
  getQuarterEndDate,
  processFilingDates,
  lookupTickerByCik,
  lookupTickerByName,
  lookupInsiderRole,
  lookupCompanyForInsider,
  cleanInsiderName,
  cleanPosition,
  parseForm4Title,
  isForm4Filing,
  generateTradeId,
  validateTradeData
}; 