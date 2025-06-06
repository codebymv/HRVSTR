/**
 * Extractor Utils - Shared utilities for SEC data extraction components
 */

/**
 * Get nested value from object using dot notation path
 * @param {Object} obj - Object to search in
 * @param {string} path - Dot notation path (e.g., 'transaction.shares.value')
 * @returns {*} - Value at path or null if not found
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return null;
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return null;
    }
  }
  
  return current;
}

/**
 * Clean content by removing extra whitespace and normalizing
 * @param {string} content - Content to clean
 * @returns {string} - Cleaned content
 */
function cleanContent(content) {
  if (!content || typeof content !== 'string') return '';
  
  return content
    .replace(/\s+/g, ' ')
    .replace(/[\r\n\t]/g, ' ')
    .trim();
}

/**
 * Parse numeric value from string, handling commas and currency symbols
 * @param {string} value - String value to parse
 * @returns {number} - Parsed numeric value or 0
 */
function parseNumericValue(value) {
  if (!value) return 0;
  
  // Convert to string and clean
  const cleanValue = String(value)
    .replace(/[$,\s]/g, '')
    .replace(/[^\d.-]/g, '');
  
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Check if a date is reasonable (not too far in future/past)
 * @param {Date} date - Date to check
 * @returns {boolean} - True if date seems reasonable
 */
function isReasonableDate(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return false;
  }
  
  const now = new Date();
  const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  
  return date >= fiveYearsAgo && date <= oneYearFromNow;
}

/**
 * Extract numeric value using multiple regex patterns
 * @param {string} content - Content to search in
 * @param {Array} patterns - Array of regex patterns to try
 * @returns {number} - Extracted numeric value or 0
 */
function extractNumericWithPatterns(content, patterns) {
  if (!content || !patterns) return 0;
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const value = parseNumericValue(match[1]);
      if (value > 0) {
        return value;
      }
    }
  }
  
  return 0;
}

/**
 * Validate and clean extraction results
 * @param {Object} result - Extraction result object
 * @returns {Object} - Validated and cleaned result
 */
function validateExtractionResults(result) {
  if (!result || typeof result !== 'object') {
    return { shares: 0, price: 0, value: 0, tradeType: 'UNKNOWN' };
  }
  
  const validated = {
    shares: Math.max(0, parseNumericValue(result.shares) || 0),
    price: Math.max(0, parseNumericValue(result.price) || 0),
    value: Math.max(0, parseNumericValue(result.value) || 0),
    tradeType: result.tradeType || 'UNKNOWN'
  };
  
  // Ensure trade type is valid
  const validTradeTypes = ['BUY', 'SELL', 'PURCHASE', 'SALE', 'GRANT', 'AWARD', 'UNKNOWN'];
  if (!validTradeTypes.includes(validated.tradeType.toUpperCase())) {
    validated.tradeType = 'UNKNOWN';
  } else {
    validated.tradeType = validated.tradeType.toUpperCase();
  }
  
  // Calculate missing values
  if (validated.shares > 0 && validated.price > 0 && validated.value === 0) {
    validated.value = validated.shares * validated.price;
  } else if (validated.value > 0 && validated.price > 0 && validated.shares === 0) {
    validated.shares = Math.round(validated.value / validated.price);
  } else if (validated.value > 0 && validated.shares > 0 && validated.price === 0) {
    validated.price = validated.value / validated.shares;
  }
  
  // Copy over any metadata from original result
  if (result._extractionMethod) validated._extractionMethod = result._extractionMethod;
  if (result._extractionFailed) validated._extractionFailed = result._extractionFailed;
  if (result._errorMessage) validated._errorMessage = result._errorMessage;
  
  return validated;
}

/**
 * Log extraction results for debugging
 * @param {string} component - Component name
 * @param {string} field - Field being extracted
 * @param {*} value - Extracted value
 * @param {string} source - Source/method used
 */
function logExtraction(component, field, value, source) {
  console.log(`[${component}] Extracted ${field}: ${value} from ${source}`);
}

module.exports = {
  getNestedValue,
  cleanContent,
  parseNumericValue,
  isReasonableDate,
  extractNumericWithPatterns,
  validateExtractionResults,
  logExtraction
}; 