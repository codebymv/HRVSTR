/**
 * Field Extractor - Extracts individual transaction fields using regex patterns
 */

const { extractNumericWithPatterns, logExtraction } = require('../utils/extractorUtils');

/**
 * Extract transaction type from filing content
 * @param {string} content - Filing content
 * @returns {string} - Transaction type (BUY or SELL)
 */
function extractTransactionType(content) {
  try {
    // Extract transaction type with enhanced patterns
    const transTypeMatch = content.match(/transaction\s+code[^:]*:[^A-Z]*(\w)/i) || 
                          content.match(/Code\s*\(Instr\)\.?\s*([PS])/i) ||
                          content.match(/Transaction\s+Type\s*:?\s*([PS])/i) ||
                          content.match(/Transaction\s+Code\s*:?\s*([PS])/i) ||
                          content.match(/Form 4\s+Transaction\s+Code\s*:?\s*([PS])/i) ||
                          content.match(/Code\s*:?\s*([PS])/i);
                          
    let transactionType = 'BUY'; // Default to buy if not found
    if (transTypeMatch) {
      const code = transTypeMatch[1].toUpperCase();
      // S = Sale, P = Purchase, A = Grant/Award, D = Disposition
      if (code === 'S' || code === 'D') {
        transactionType = 'SELL';
      } else if (code === 'P' || code === 'A') {
        transactionType = 'BUY';
      }
      logExtraction('fieldExtractor', 'transaction type', transactionType, `code ${code}`);
    }
    
    return transactionType;
  } catch (error) {
    console.error(`[fieldExtractor] Error extracting transaction type: ${error.message}`);
    return 'BUY'; // Default to BUY on error
  }
}

/**
 * Extract number of shares from filing content
 * @param {string} content - Filing content
 * @returns {number} - Number of shares
 */
function extractShares(content) {
  try {
    // Define multiple patterns for extracting shares
    const sharePatterns = [
      // XML-style patterns
      /<transactionShares[^>]*>([^<]+)<\/transactionShares>/i,
      /<shares[^>]*>([^<]+)<\/shares>/i,
      /<sharesOwned[^>]*>([^<]+)<\/sharesOwned>/i,
      /<amountOfSecuritiesOwned[^>]*>([^<]+)<\/amountOfSecuritiesOwned>/i,
      
      // Form field patterns
      /shares\s+(?:owned|acquired|disposed)[^:]*:\s*([0-9,]+)/i,
      /number\s+of\s+shares[^:]*:\s*([0-9,]+)/i,
      /quantity[^:]*:\s*([0-9,]+)/i,
      /amount[^:]*:\s*([0-9,]+)\s+shares/i,
      
      // Table patterns
      /shares[^0-9]{1,20}?([0-9,]+)/i,
      /quantity[^0-9]{1,20}?([0-9,]+)/i,
      
      // Generic number patterns (be careful with these)
      /([0-9]{1,3}(?:,[0-9]{3})+)\s+shares/i
    ];
    
    const shares = extractNumericWithPatterns(content, sharePatterns);
    
    if (shares > 0) {
      logExtraction('fieldExtractor', 'shares', shares, 'field extraction');
    }
    
    return shares;
  } catch (error) {
    console.error(`[fieldExtractor] Error extracting shares: ${error.message}`);
    return 0;
  }
}

/**
 * Extract price per share from filing content
 * @param {string} content - Filing content
 * @returns {number} - Price per share
 */
function extractPrice(content) {
  try {
    // Define multiple patterns for extracting price
    const pricePatterns = [
      // XML-style patterns
      /<transactionPricePerShare[^>]*>([^<]+)<\/transactionPricePerShare>/i,
      /<pricePerShare[^>]*>([^<]+)<\/pricePerShare>/i,
      /<price[^>]*>([^<]+)<\/price>/i,
      /<priceOfSecurity[^>]*>([^<]+)<\/priceOfSecurity>/i,
      
      // Form field patterns
      /price\s+per\s+share[^:]*:\s*\$?([0-9,]+\.?[0-9]*)/i,
      /share\s+price[^:]*:\s*\$?([0-9,]+\.?[0-9]*)/i,
      /transaction\s+price[^:]*:\s*\$?([0-9,]+\.?[0-9]*)/i,
      /price[^:]*:\s*\$?([0-9,]+\.?[0-9]*)/i,
      
      // Dollar amount patterns
      /\$([0-9]+\.?[0-9]*)\s+per\s+share/i,
      /\$([0-9]+\.?[0-9]*)\s+\/\s+share/i,
      
      // Generic price patterns (more restrictive)
      /price[^$0-9]{1,20}?\$?([0-9]+\.?[0-9]*)/i
    ];
    
    const price = extractNumericWithPatterns(content, pricePatterns);
    
    if (price > 0) {
      logExtraction('fieldExtractor', 'price', `$${price}`, 'field extraction');
    }
    
    return price;
  } catch (error) {
    console.error(`[fieldExtractor] Error extracting price: ${error.message}`);
    return 0;
  }
}

/**
 * Extract value from filing content
 * @param {string} content - Filing content
 * @param {number} shares - Number of shares (for calculation if direct extraction fails)
 * @param {number} price - Price per share (for calculation if direct extraction fails)
 * @returns {number} - Transaction value
 */
function extractValue(content, shares = 0, price = 0) {
  try {
    // Define multiple patterns for extracting total value
    const valuePatterns = [
      // XML-style patterns
      /<transactionTotalValue[^>]*>([^<]+)<\/transactionTotalValue>/i,
      /<totalValue[^>]*>([^<]+)<\/totalValue>/i,
      /<value[^>]*>([^<]+)<\/value>/i,
      /<marketValue[^>]*>([^<]+)<\/marketValue>/i,
      
      // Form field patterns
      /total\s+value[^:]*:\s*\$?([0-9,]+\.?[0-9]*)/i,
      /transaction\s+value[^:]*:\s*\$?([0-9,]+\.?[0-9]*)/i,
      /total\s+transaction[^:]*:\s*\$?([0-9,]+\.?[0-9]*)/i,
      /market\s+value[^:]*:\s*\$?([0-9,]+\.?[0-9]*)/i,
      
      // General value patterns
      /[Aa]mount[^$0-9]{1,20}?\$?([0-9,]+\.?[0-9]*)/i,
      /[Vv]alue[^$0-9]{1,20}?\$?([0-9,]+\.?[0-9]*)/i,
      /[Tt]otal[^$0-9]{1,20}?\$?([0-9,]+\.?[0-9]*)/i,
      
      // Large dollar amounts (likely total values)
      /\$([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?)/
    ];
    
    const value = extractNumericWithPatterns(content, valuePatterns);
    
    if (value > 0) {
      logExtraction('fieldExtractor', 'transaction value', `$${value}`, 'direct extraction');
      return value;
    }
    
    // If we couldn't extract value but have shares and price, calculate it
    if (shares > 0 && price > 0) {
      const calculatedValue = shares * price;
      logExtraction('fieldExtractor', 'transaction value', `$${calculatedValue}`, 'calculated from shares * price');
      return calculatedValue;
    }
    
    return 0;
  } catch (error) {
    console.error(`[fieldExtractor] Error extracting value: ${error.message}`);
    
    // If we have shares and price, calculate value
    if (shares > 0 && price > 0) {
      return shares * price;
    }
    
    return 0;
  }
}

/**
 * Extract numeric value with additional validation
 * @param {string} content - Content to search in
 * @param {Array} patterns - Regex patterns to try
 * @param {Object} validation - Validation rules
 * @returns {number} - Extracted and validated value
 */
function extractNumericWithValidation(content, patterns, validation = {}) {
  const { min = 0, max = Infinity, allowZero = false } = validation;
  
  const value = extractNumericWithPatterns(content, patterns);
  
  if (!allowZero && value === 0) return 0;
  if (value < min || value > max) return 0;
  
  return value;
}

/**
 * Extract all transaction fields at once
 * @param {string} content - Filing content
 * @returns {Object} - Object containing all extracted fields
 */
function extractAllFields(content) {
  if (!content) {
    return {
      shares: 0,
      price: 0,
      value: 0,
      tradeType: 'BUY'
    };
  }
  
  const tradeType = extractTransactionType(content);
  const shares = extractShares(content);
  const price = extractPrice(content);
  const value = extractValue(content, shares, price);
  
  return {
    shares,
    price,
    value,
    tradeType
  };
}

/**
 * Extract fields with confidence scoring
 * @param {string} content - Filing content
 * @returns {Object} - Extracted fields with confidence scores
 */
function extractFieldsWithConfidence(content) {
  const fields = extractAllFields(content);
  
  // Calculate confidence based on successful extractions
  let confidence = 0;
  if (fields.shares > 0) confidence += 0.3;
  if (fields.price > 0) confidence += 0.3;
  if (fields.value > 0) confidence += 0.3;
  if (fields.tradeType !== 'BUY') confidence += 0.1; // Default is BUY, so other types indicate actual detection
  
  return {
    ...fields,
    _confidence: confidence,
    _extractionMethod: 'fieldExtractor'
  };
}

module.exports = {
  extractTransactionType,
  extractShares,
  extractPrice,
  extractValue,
  extractAllFields,
  extractNumericWithValidation,
  extractFieldsWithConfidence
}; 