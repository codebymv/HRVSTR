/**
 * Date Extractor - Extracts and processes dates from SEC filings
 */

const { isReasonableDate, logExtraction } = require('../utils/extractorUtils');

/**
 * Extract actual filing date from Form 4 document content
 * @param {string} content - Document content
 * @returns {string|null} - ISO date string or null
 */
function extractActualFilingDate(content) {
  if (!content) return null;

  try {
    console.log(`[dateExtractor] Searching for filing date in content (${content.length} chars)...`);

    const datePatterns = [
      // XML patterns (most reliable)
      { pattern: /<periodOfReport>([^<]+)<\/periodOfReport>/i, type: 'periodOfReport' },
      { pattern: /<signatureDate>([^<]+)<\/signatureDate>/i, type: 'signatureDate' },
      { pattern: /<transactionDate>([^<]+)<\/transactionDate>/i, type: 'transactionDate' },
      { pattern: /<filingDate>([^<]+)<\/filingDate>/i, type: 'filingDate' },
      { pattern: /<acceptanceDateTime>([^<]+)<\/acceptanceDateTime>/i, type: 'acceptanceDateTime' },
      { pattern: /<notificationDate>([^<]+)<\/notificationDate>/i, type: 'notificationDate' },
      
      // Form field patterns
      { pattern: /Document Date[^:]*:?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i, type: 'documentDate' },
      { pattern: /Filing Date[^:]*:?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i, type: 'filingDate' },
      { pattern: /Date Filed[^:]*:?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i, type: 'dateFiled' },
      
      // ISO date patterns
      { pattern: /([0-9]{4}-[0-9]{2}-[0-9]{2})/g, type: 'isoDate' }
    ];

    for (const { pattern, type } of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        const dateStr = match[1];
        const date = new Date(dateStr);
        
        if (isReasonableDate(date)) {
          logExtraction('dateExtractor', 'filing date', dateStr, type);
          return date.toISOString();
        }
      }
    }

    console.log(`[dateExtractor] No valid filing date found in document content`);
    return null;
  } catch (error) {
    console.error(`[dateExtractor] Error extracting filing date: ${error.message}`);
    return null;
  }
}

/**
 * Extract transaction date from filing content
 * @param {string} content - Filing content
 * @returns {string|null} - ISO date string or null
 */
function extractTransactionDate(content) {
  if (!content) return null;

  try {
    const transactionDatePatterns = [
      /<transactionDate>([^<]+)<\/transactionDate>/i,
      /<dateOfTransaction>([^<]+)<\/dateOfTransaction>/i,
      /Transaction Date[^:]*:?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i,
      /Date of Transaction[^:]*:?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i,
      /Date of Earliest Transaction[^:]*:?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i
    ];

    for (const pattern of transactionDatePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const date = new Date(match[1]);
        if (isReasonableDate(date)) {
          logExtraction('dateExtractor', 'transaction date', match[1], 'transaction date pattern');
          return date.toISOString();
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`[dateExtractor] Error extracting transaction date: ${error.message}`);
    return null;
  }
}

/**
 * Extract signature date from filing content
 * @param {string} content - Filing content
 * @returns {string|null} - ISO date string or null
 */
function extractSignatureDate(content) {
  if (!content) return null;

  try {
    const signatureDatePatterns = [
      /<signatureDate>([^<]+)<\/signatureDate>/i,
      /Signature Date[^:]*:?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i,
      /Date Signed[^:]*:?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i
    ];

    for (const pattern of signatureDatePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const date = new Date(match[1]);
        if (isReasonableDate(date)) {
          logExtraction('dateExtractor', 'signature date', match[1], 'signature date pattern');
          return date.toISOString();
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`[dateExtractor] Error extracting signature date: ${error.message}`);
    return null;
  }
}

/**
 * Extract all available dates from filing content
 * @param {string} content - Filing content
 * @returns {Object} - Object containing all extracted dates
 */
function extractAllDates(content) {
  if (!content) {
    return {
      filingDate: null,
      transactionDate: null,
      signatureDate: null
    };
  }

  const filingDate = extractActualFilingDate(content);
  const transactionDate = extractTransactionDate(content);
  const signatureDate = extractSignatureDate(content);

  return {
    filingDate,
    transactionDate,
    signatureDate,
    extractedAt: new Date().toISOString()
  };
}

/**
 * Get the most relevant date from filing content
 * @param {string} content - Filing content
 * @returns {string|null} - Most relevant date as ISO string
 */
function getMostRelevantDate(content) {
  const dates = extractAllDates(content);
  
  // Priority: transaction date > filing date > signature date
  return dates.transactionDate || dates.filingDate || dates.signatureDate;
}

/**
 * Parse and validate date string with multiple format support
 * @param {string} dateStr - Date string to parse
 * @returns {Date|null} - Parsed date or null if invalid
 */
function parseFlexibleDate(dateStr) {
  if (!dateStr) return null;

  try {
    // Common date formats to try
    const formats = [
      // ISO formats
      /^(\d{4}-\d{2}-\d{2})$/,
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})$/,
      
      // US formats
      /^(\d{1,2}\/\d{1,2}\/\d{4})$/,
      /^(\d{1,2}-\d{1,2}-\d{4})$/,
      
      // European formats
      /^(\d{1,2}\.\d{1,2}\.\d{4})$/
    ];

    for (const format of formats) {
      if (format.test(dateStr.trim())) {
        const date = new Date(dateStr);
        if (isReasonableDate(date)) {
          return date;
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`[dateExtractor] Error parsing date '${dateStr}': ${error.message}`);
    return null;
  }
}

/**
 * Extract dates with confidence scoring
 * @param {string} content - Filing content
 * @returns {Object} - Dates with confidence scores
 */
function extractDatesWithConfidence(content) {
  const dates = extractAllDates(content);
  
  let confidence = 0;
  if (dates.filingDate) confidence += 0.4;
  if (dates.transactionDate) confidence += 0.4;
  if (dates.signatureDate) confidence += 0.2;
  
  return {
    ...dates,
    _confidence: confidence,
    _extractionMethod: 'dateExtractor'
  };
}

/**
 * Check if content appears to be from a specific time period
 * @param {string} content - Filing content
 * @param {Date} startDate - Start of period
 * @param {Date} endDate - End of period
 * @returns {boolean} - True if content appears to be from the period
 */
function isFromTimePeriod(content, startDate, endDate) {
  const relevantDate = getMostRelevantDate(content);
  
  if (!relevantDate) return false;
  
  const date = new Date(relevantDate);
  return date >= startDate && date <= endDate;
}

module.exports = {
  extractActualFilingDate,
  extractTransactionDate,
  extractSignatureDate,
  extractAllDates,
  getMostRelevantDate,
  parseFlexibleDate,
  extractDatesWithConfidence,
  isFromTimePeriod
}; 