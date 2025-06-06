/**
 * XML Extractor - Extracts transaction data from XML Form 4 documents
 */

const { getNestedValue, logExtraction } = require('../utils/extractorUtils');

/**
 * Extract transaction details from XML Form 4 document
 * @param {string} xmlContent - XML Form 4 document content
 * @returns {Promise<Object>} - Promise resolving to object with shares, price, value, and tradeType
 */
async function extractFromXmlForm4(xmlContent) {
  try {
    // Try to require xml2js, fall back to regex if not available
    let xml2js;
    try {
      xml2js = require('xml2js');
    } catch (e) {
      console.warn('[xmlExtractor] xml2js not available, falling back to regex extraction');
      return extractFromXmlWithRegex(xmlContent);
    }
    
    // Clean and validate the XML content first
    const cleanedXml = cleanXmlContent(xmlContent);
    
    // Parse the XML
    const parser = new xml2js.Parser({ 
      explicitArray: false, 
      ignoreAttrs: false,
      trim: true,
      normalize: true,
      normalizeTags: true,
      explicitRoot: false,
      emptyTag: '',
      strict: false  // Allow malformed XML
    });
    
    return new Promise((resolve, reject) => {
      parser.parseString(cleanedXml, (err, result) => {
        if (err) {
          console.error(`[xmlExtractor] XML parsing failed: ${err.message}`);
          // Fall back to regex extraction
          resolve(extractFromXmlWithRegex(xmlContent));
          return;
        }
        
        try {
          console.log(`[xmlExtractor] Successfully parsed XML Form 4`);
          
          // Find the ownership document
          const ownershipDoc = findOwnershipDocument(result);
          if (!ownershipDoc) {
            console.warn(`[xmlExtractor] No ownership document found in XML`);
            resolve({ shares: 0, price: 0, value: 0, tradeType: 'BUY' });
            return;
          }
          
          // Find transactions within the ownership document
          const transactions = findTransactions(ownershipDoc);
          if (!transactions || transactions.length === 0) {
            console.warn(`[xmlExtractor] No transactions found in ownership document`);
            resolve({ shares: 0, price: 0, value: 0, tradeType: 'BUY' });
            return;
          }
          
          // Process the first transaction (most filings have one main transaction)
          const transaction = Array.isArray(transactions) ? transactions[0] : transactions;
          const extractedData = processTransaction(transaction);
          
          resolve(extractedData);
        } catch (processingError) {
          console.error(`[xmlExtractor] Error processing parsed XML: ${processingError.message}`);
          resolve(extractFromXmlWithRegex(xmlContent));
        }
      });
    });
  } catch (error) {
    console.error(`[xmlExtractor] Unexpected error in XML extraction: ${error.message}`);
    return extractFromXmlWithRegex(xmlContent);
  }
}

/**
 * Clean XML content before parsing
 * @param {string} xmlContent - Raw XML content
 * @returns {string} - Cleaned XML content
 */
function cleanXmlContent(xmlContent) {
  if (!xmlContent) return '';
  
  return xmlContent
    .replace(/&(?![a-zA-Z0-9#]{1,6};)/g, '&amp;') // Escape unescaped ampersands
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

/**
 * Find ownership document in parsed XML
 * @param {Object} parsed - Parsed XML object
 * @returns {Object|null} - Ownership document or null
 */
function findOwnershipDocument(parsed) {
  // Try different possible paths for the ownership document
  const possiblePaths = [
    'ownershipDocument',
    'ownershipdocument',
    'form4',
    'Form4',
    'document.ownershipDocument',
    'root.ownershipDocument'
  ];
  
  for (const path of possiblePaths) {
    const doc = getNestedValue(parsed, path);
    if (doc) {
      console.log(`[xmlExtractor] Found ownership document at path: ${path}`);
      return doc;
    }
  }
  
  // If no specific path found, try to find any object that looks like an ownership doc
  if (parsed && typeof parsed === 'object') {
    const keys = Object.keys(parsed);
    for (const key of keys) {
      const value = parsed[key];
      if (value && typeof value === 'object' && 
          (value.nonDerivativeTable || value.derivativeTable || 
           value.issuer || value.reportingOwner)) {
        console.log(`[xmlExtractor] Found ownership document-like object at: ${key}`);
        return value;
      }
    }
  }
  
  return null;
}

/**
 * Find transactions in the ownership document
 * @param {Object} ownershipDoc - Ownership document structure
 * @returns {Array} - Array of transactions
 */
function findTransactions(ownershipDoc) {
  let transactions = [];
  
  if (ownershipDoc.nonDerivativeTable?.nonDerivativeTransaction) {
    const nonDerivTrans = ownershipDoc.nonDerivativeTable.nonDerivativeTransaction;
    transactions = Array.isArray(nonDerivTrans) ? nonDerivTrans : [nonDerivTrans];
    console.log(`[xmlExtractor] Found ${transactions.length} non-derivative transactions`);
  } else if (ownershipDoc.derivativeTable?.derivativeTransaction) {
    const derivTrans = ownershipDoc.derivativeTable.derivativeTransaction;
    transactions = Array.isArray(derivTrans) ? derivTrans : [derivTrans];
    console.log(`[xmlExtractor] Found ${transactions.length} derivative transactions`);
  }
  
  return transactions;
}

/**
 * Process a single transaction from XML
 * @param {Object} transaction - Transaction object from XML
 * @returns {Object} - Extracted transaction data
 */
function processTransaction(transaction) {
  console.log(`[xmlExtractor] Processing transaction:`, JSON.stringify(transaction, null, 2));
  
  let shares = extractSharesFromTransaction(transaction);
  let price = extractPriceFromTransaction(transaction);
  let value = extractValueFromTransaction(transaction);
  let tradeType = extractTradeTypeFromTransaction(transaction);
  
  // Calculate missing values
  if (shares > 0 && price > 0 && value === 0) {
    value = shares * price;
  } else if (value > 0 && price > 0 && shares === 0) {
    shares = Math.round(value / price);
  } else if (value > 0 && shares > 0 && price === 0) {
    price = value / shares;
  }
  
  console.log(`[xmlExtractor] Final extraction result: shares=${shares}, price=${price}, value=${value}, type=${tradeType}`);
  
  return { shares, price, value, tradeType };
}

/**
 * Extract shares from transaction
 * @param {Object} transaction - Transaction object
 * @returns {number} - Number of shares
 */
function extractSharesFromTransaction(transaction) {
  const sharePaths = [
    'transactionShares.value',
    'transactionShares._',
    'transactionShares',
    'transactionAmounts.transactionShares.value',
    'transactionAmounts.transactionShares._',
    'transactionAmounts.transactionShares',
    'sharesOwnedFollowingTransaction.value',
    'sharesOwnedFollowingTransaction._',
    'sharesOwnedFollowingTransaction'
  ];
  
  for (const path of sharePaths) {
    const pathValue = getNestedValue(transaction, path);
    if (pathValue !== null && pathValue !== undefined) {
      const parsedShares = parseFloat(pathValue);
      if (!isNaN(parsedShares) && parsedShares > 0) {
        logExtraction('xmlExtractor', 'shares', parsedShares, `path '${path}'`);
        return parsedShares;
      }
    }
  }
  
  return 0;
}

/**
 * Extract price from transaction
 * @param {Object} transaction - Transaction object
 * @returns {number} - Price per share
 */
function extractPriceFromTransaction(transaction) {
  const pricePaths = [
    'transactionPricePerShare.value',
    'transactionPricePerShare._',
    'transactionPricePerShare',
    'transactionAmounts.transactionPricePerShare.value',
    'transactionAmounts.transactionPricePerShare._',
    'transactionAmounts.transactionPricePerShare',
    'pricePerShare.value',
    'pricePerShare._',
    'pricePerShare'
  ];
  
  for (const path of pricePaths) {
    const pathValue = getNestedValue(transaction, path);
    if (pathValue !== null && pathValue !== undefined) {
      const parsedPrice = parseFloat(pathValue);
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        logExtraction('xmlExtractor', 'price', `$${parsedPrice}`, `path '${path}'`);
        return parsedPrice;
      }
    }
  }
  
  return 0;
}

/**
 * Extract value from transaction
 * @param {Object} transaction - Transaction object
 * @returns {number} - Total transaction value
 */
function extractValueFromTransaction(transaction) {
  const valuePaths = [
    'transactionAmounts.transactionTotalValue.value',
    'transactionAmounts.transactionTotalValue._',
    'transactionAmounts.transactionTotalValue',
    'transactionTotalValue.value',
    'transactionTotalValue._',
    'transactionTotalValue'
  ];
  
  for (const path of valuePaths) {
    const pathValue = getNestedValue(transaction, path);
    if (pathValue !== null && pathValue !== undefined) {
      const parsedValue = parseFloat(pathValue);
      if (!isNaN(parsedValue) && parsedValue > 0) {
        logExtraction('xmlExtractor', 'value', `$${parsedValue}`, `path '${path}'`);
        return parsedValue;
      }
    }
  }
  
  return 0;
}

/**
 * Extract trade type from transaction
 * @param {Object} transaction - Transaction object
 * @returns {string} - Trade type
 */
function extractTradeTypeFromTransaction(transaction) {
  if (transaction.transactionCode) {
    const code = transaction.transactionCode._ || transaction.transactionCode.value || transaction.transactionCode;
    if (code === 'S' || code === 'D') {
      logExtraction('xmlExtractor', 'transaction code', code, 'SELL');
      return 'SELL';
    } else if (code === 'P' || code === 'A') {
      logExtraction('xmlExtractor', 'transaction code', code, 'BUY');
      return 'BUY';
    }
  }
  
  return 'BUY'; // Default
}

/**
 * Extract transaction data using regex patterns when XML parsing fails
 * @param {string} xmlContent - Raw XML content
 * @returns {Object} - Object with shares, price, value, and tradeType
 */
function extractFromXmlWithRegex(xmlContent) {
  let shares = 0;
  let price = 0;
  let value = 0;
  let tradeType = 'BUY';

  try {
    console.log(`[xmlExtractor] Using regex fallback for XML extraction`);
    
    // Extract shares from XML tags
    const sharesPatterns = [
      /<transactionShares[^>]*>([^<]+)<\/transactionShares>/i,
      /<shares[^>]*>([^<]+)<\/shares>/i,
      /<sharesOwned[^>]*>([^<]+)<\/sharesOwned>/i,
      /<amountOfSecuritiesOwned[^>]*>([^<]+)<\/amountOfSecuritiesOwned>/i
    ];
    
    for (const pattern of sharesPatterns) {
      const match = xmlContent.match(pattern);
      if (match) {
        const parsed = parseFloat(match[1].replace(/[,$]/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          shares = parsed;
          logExtraction('xmlExtractor', 'shares', shares, 'regex extraction');
          break;
        }
      }
    }

    // Extract price from XML tags
    const pricePatterns = [
      /<transactionPricePerShare[^>]*>([^<]+)<\/transactionPricePerShare>/i,
      /<pricePerShare[^>]*>([^<]+)<\/pricePerShare>/i,
      /<price[^>]*>([^<]+)<\/price>/i,
      /<priceOfSecurity[^>]*>([^<]+)<\/priceOfSecurity>/i
    ];
    
    for (const pattern of pricePatterns) {
      const match = xmlContent.match(pattern);
      if (match) {
        const parsed = parseFloat(match[1].replace(/[,$]/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          price = parsed;
          logExtraction('xmlExtractor', 'price', `$${price}`, 'regex extraction');
          break;
        }
      }
    }

    // Extract value from XML tags
    const valuePatterns = [
      /<transactionTotalValue[^>]*>([^<]+)<\/transactionTotalValue>/i,
      /<totalValue[^>]*>([^<]+)<\/totalValue>/i,
      /<value[^>]*>([^<]+)<\/value>/i,
      /<marketValue[^>]*>([^<]+)<\/marketValue>/i
    ];
    
    for (const pattern of valuePatterns) {
      const match = xmlContent.match(pattern);
      if (match) {
        const parsed = parseFloat(match[1].replace(/[,$]/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          value = parsed;
          logExtraction('xmlExtractor', 'value', `$${value}`, 'regex extraction');
          break;
        }
      }
    }

    // Extract transaction type
    const typeMatch = xmlContent.match(/<transactionCode[^>]*>([^<]+)<\/transactionCode>/i);
    if (typeMatch) {
      const code = typeMatch[1].toUpperCase();
      if (code === 'S' || code === 'D') {
        tradeType = 'SELL';
      } else if (code === 'P' || code === 'A') {
        tradeType = 'BUY';
      }
      logExtraction('xmlExtractor', 'transaction type', tradeType, `code ${code}`);
    }
    
    // Calculate missing values
    if (shares > 0 && price > 0 && value === 0) {
      value = shares * price;
    }
    
  } catch (error) {
    console.warn(`[xmlExtractor] Error in regex XML extraction: ${error.message}`);
  }

  return { shares, price, value, tradeType };
}

module.exports = {
  extractFromXmlForm4,
  extractFromXmlWithRegex
}; 