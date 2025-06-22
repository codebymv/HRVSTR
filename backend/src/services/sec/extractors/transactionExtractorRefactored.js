/**
 * Transaction Extractor (Refactored) - Main orchestrator for extracting transaction details from SEC filings
 * 
 * This refactored version delegates specific extraction tasks to specialized modules
 * for better maintainability and separation of concerns.
 */

// Import specialized extractors - NOTE: These paths will need to be created
// For now, we'll use fallback implementations until all components are moved
let extractFromXmlForm4, extractFromXmlWithRegex, extractFromHtmlTables, extractFromSecIndexPage, extractAllFields, extractActualFilingDate, validateExtractionResults;

try {
  const xmlExtractor = require('./extractors/xmlExtractor');
  extractFromXmlForm4 = xmlExtractor.extractFromXmlForm4;
  extractFromXmlWithRegex = xmlExtractor.extractFromXmlWithRegex;
} catch (e) {
  console.warn('[transactionExtractorRefactored] XML extractor not available, using fallbacks');
  extractFromXmlForm4 = async () => ({ shares: 0, price: 0, value: 0, tradeType: 'BUY' });
  extractFromXmlWithRegex = () => ({ shares: 0, price: 0, value: 0, tradeType: 'BUY' });
}

try {
  const htmlExtractor = require('./extractors/htmlExtractor');
  extractFromHtmlTables = htmlExtractor.extractFromHtmlTables;
  extractFromSecIndexPage = htmlExtractor.extractFromSecIndexPage;
} catch (e) {
  console.warn('[transactionExtractorRefactored] HTML extractor not available, using fallbacks');
  extractFromHtmlTables = () => ({ shares: 0, price: 0, value: 0, tradeType: 'BUY' });
  extractFromSecIndexPage = () => ({ shares: 0, price: 0, value: 0, tradeType: 'BUY' });
}

try {
  const fieldExtractor = require('./extractors/fieldExtractor');
  extractAllFields = fieldExtractor.extractAllFields;
} catch (e) {
  console.warn('[transactionExtractorRefactored] Field extractor not available, using fallback');
  extractAllFields = () => ({ shares: 0, price: 0, value: 0, tradeType: 'BUY' });
}

try {
  const dateExtractor = require('./extractors/dateExtractor');
  extractActualFilingDate = dateExtractor.extractActualFilingDate;
} catch (e) {
  console.warn('[transactionExtractorRefactored] Date extractor not available, using fallback');
  extractActualFilingDate = () => null;
}

// Sample data generator removed - no fallback data allowed
// Sample data checks removed - only real data is processed

try {
  const utils = require('./utils/extractorUtils');
  validateExtractionResults = utils.validateExtractionResults;
} catch (e) {
  console.warn('[transactionExtractorRefactored] Utils not available, using fallback');
  validateExtractionResults = (result) => result;
}

/**
 * Enhanced transaction details extraction with actual filing date parsing
 * @param {string} content - The filing content (HTML/XML)
 * @returns {Object} - Extracted transaction details including actual filing date
 */
async function extractTransactionDetails(content) {
  console.log(`[transactionExtractorRefactored] Processing content, length: ${content?.length || 0}`);
  
  // Handle undefined or empty content
  if (!content || typeof content !== 'string') {
    console.warn(`[transactionExtractorRefactored] Invalid content provided, generating fallback data`);
    return generateFallbackResponse();
  }

  // Handle very short content (likely failed requests)
  if (content.length < 50) {
    console.warn(`[transactionExtractorRefactored] Content too short (${content.length} chars), generating fallback data`);
    return generateFallbackResponse();
  }

  try {
    // Extract the actual filing date
    const actualFilingDate = extractActualFilingDate(content);
    
    // Determine content type
    const isXML = content.includes('<?xml') || content.includes('<ownershipDocument') || content.includes('<XML>');
    const isHTML = content.includes('<html') || content.includes('<table') || content.includes('<tr');
    
    console.log(`[transactionExtractorRefactored] Content type detected - XML: ${isXML}, HTML: ${isHTML}`);
    
    // Initialize extraction results
    let extractionResult = { shares: 0, price: 0, value: 0, tradeType: 'BUY' };
    
    // Try extraction methods in order of preference
    extractionResult = await tryExtractionMethods(content, isXML, isHTML);
    
    // Validate and clean up results
    const validatedResult = validateExtractionResults(extractionResult);
    
    // Add metadata and additional fields
    const finalResult = {
      ...validatedResult,
      transactionNote: generateTransactionNote(validatedResult),
      actualFilingDate,
      extractedAt: new Date().toISOString(),
      extractionMethods: getUsedExtractionMethods(extractionResult)
    };
    
    console.log(`[transactionExtractorRefactored] Final extraction result:`, finalResult);
    return finalResult;
    
  } catch (error) {
    console.error(`[transactionExtractorRefactored] Error extracting transaction details: ${error.message}`);
    return generateFallbackResponse();
  }
}

/**
 * Try different extraction methods in order of preference
 * @param {string} content - Content to extract from
 * @param {boolean} isXML - Whether content is XML
 * @param {boolean} isHTML - Whether content is HTML
 * @returns {Object} - Extraction results
 */
async function tryExtractionMethods(content, isXML, isHTML) {
  let result = { shares: 0, price: 0, value: 0, tradeType: 'BUY' };
  
  // Method 1: XML Form 4 extraction (highest priority for XML content)
  if (isXML && hasNoSignificantData(result)) {
    try {
      const xmlResult = await extractFromXmlForm4(content);
      if (hasSignificantData(xmlResult)) {
        result = xmlResult;
        result._extractionMethod = 'xmlForm4';
        console.log(`[transactionExtractorRefactored] Successfully extracted via XML Form 4 parser`);
      } else {
        // Fallback to XML regex
        const xmlRegexResult = extractFromXmlWithRegex(content);
        if (hasSignificantData(xmlRegexResult)) {
          result = xmlRegexResult;
          result._extractionMethod = 'xmlRegex';
          console.log(`[transactionExtractorRefactored] Successfully extracted via XML regex`);
        }
      }
    } catch (xmlError) {
      console.error(`[transactionExtractorRefactored] XML extraction failed: ${xmlError.message}`);
    }
  }
  
  // Method 2: HTML table extraction
  if (isHTML && hasNoSignificantData(result)) {
    try {
      const htmlResult = extractFromHtmlTables(content);
      if (hasSignificantData(htmlResult)) {
        result = htmlResult;
        result._extractionMethod = 'htmlTables';
        console.log(`[transactionExtractorRefactored] Successfully extracted via HTML tables`);
      }
    } catch (htmlError) {
      console.error(`[transactionExtractorRefactored] HTML extraction failed: ${htmlError.message}`);
    }
  }
  
  // Method 3: SEC index page extraction
  if (hasNoSignificantData(result)) {
    try {
      const indexResult = extractFromSecIndexPage(content);
      if (hasSignificantData(indexResult)) {
        result = indexResult;
        result._extractionMethod = 'secIndex';
        console.log(`[transactionExtractorRefactored] Successfully extracted via SEC index page`);
      }
    } catch (indexError) {
      console.error(`[transactionExtractorRefactored] SEC index extraction failed: ${indexError.message}`);
    }
  }
  
  // Method 4: Generic field extraction (fallback)
  if (hasNoSignificantData(result)) {
    try {
      const fieldResult = extractAllFields(content);
      if (hasSignificantData(fieldResult)) {
        result = fieldResult;
        result._extractionMethod = 'genericFields';
        console.log(`[transactionExtractorRefactored] Successfully extracted via generic field patterns`);
      }
    } catch (fieldError) {
      console.error(`[transactionExtractorRefactored] Generic field extraction failed: ${fieldError.message}`);
    }
  }
  
  // Method 5: Safe failure handling (final fallback)
  if (hasNoSignificantData(result)) {
    console.error(`[transactionExtractorRefactored] ALL extraction methods failed - returning safe empty result`);
    result = {
      shares: 0,
      price: 0,
      value: 0,
      tradeType: 'UNKNOWN',
      _extractionMethod: 'extractionFailed',
      _extractionFailed: true,
      _errorMessage: 'Unable to extract reliable transaction data from filing'
    };
  }
  
  return result;
}

/**
 * Check if result has significant data
 * @param {Object} result - Extraction result
 * @returns {boolean} - True if has significant data
 */
function hasSignificantData(result) {
  return result && (result.shares > 0 || result.price > 0 || result.value > 0);
}

/**
 * Check if result has no significant data
 * @param {Object} result - Extraction result
 * @returns {boolean} - True if has no significant data
 */
function hasNoSignificantData(result) {
  return !hasSignificantData(result);
}

/**
 * Generate transaction note based on extraction results
 * @param {Object} result - Extraction results
 * @returns {string} - Transaction note
 */
function generateTransactionNote(result) {
  if (result._extractionFailed) {
    return 'Data extraction failed - filing content could not be reliably parsed';
  }
  
  // Sample data checks removed - only real data is processed
  
  if (result.shares > 0 && (result.price === 0 || result.value === 0)) {
    return 'Non-monetary transaction (stock grant, option, etc.)';
  }
  
  if (result.price === 0 && result.value === 0 && result.shares === 0) {
    return 'No transaction data available';
  }
  
  return '';
}

/**
 * Get list of extraction methods used
 * @param {Object} result - Extraction results
 * @returns {Array} - Array of method names
 */
function getUsedExtractionMethods(result) {
  const methods = [];
  
  if (result._extractionMethod) {
    methods.push(result._extractionMethod);
  }
  
  return methods;
}

/**
 * Generate safe fallback response when extraction fails
 * @returns {Object} - Safe fallback response with no misleading data
 */
function generateFallbackResponse() {
  return {
    shares: 0,
    price: 0,
    value: 0,
    tradeType: 'UNKNOWN',
    transactionNote: 'Filing data extraction failed - content could not be parsed reliably',
    actualFilingDate: null,
    extractedAt: new Date().toISOString(),
    extractionMethods: ['extractionFailed'],
    _extractionFailed: true,
    _errorMessage: 'Unable to extract reliable financial data from this filing',
    _dataReliability: 'FAILED'
  };
}

/**
 * Extract transaction type from filing content (backward compatibility)
 * @param {string} content - Filing content
 * @returns {string} - Transaction type (BUY or SELL)
 */
async function extractTransactionType(content) {
  try {
    const { extractTransactionType: fieldExtractTransactionType } = require('./extractors/fieldExtractor');
    return fieldExtractTransactionType(content);
  } catch (e) {
    console.warn('[transactionExtractorRefactored] Field extractor not available for transaction type');
    return 'BUY';
  }
}

/**
 * Extract shares from filing content (backward compatibility)
 * @param {string} content - Filing content
 * @returns {number} - Number of shares
 */
async function extractShares(content) {
  try {
    const { extractShares: fieldExtractShares } = require('./extractors/fieldExtractor');
    return fieldExtractShares(content);
  } catch (e) {
    console.warn('[transactionExtractorRefactored] Field extractor not available for shares');
    return 0;
  }
}

/**
 * Extract price from filing content (backward compatibility)
 * @param {string} content - Filing content
 * @returns {number} - Price per share
 */
async function extractPrice(content) {
  try {
    const { extractPrice: fieldExtractPrice } = require('./extractors/fieldExtractor');
    return fieldExtractPrice(content);
  } catch (e) {
    console.warn('[transactionExtractorRefactored] Field extractor not available for price');
    return 0;
  }
}

/**
 * Extract value from filing content (backward compatibility)
 * @param {string} content - Filing content
 * @param {number} shares - Number of shares
 * @param {number} price - Price per share
 * @returns {number} - Transaction value
 */
async function extractValue(content, shares = 0, price = 0) {
  try {
    const { extractValue: fieldExtractValue } = require('./extractors/fieldExtractor');
    return fieldExtractValue(content, shares, price);
  } catch (e) {
    console.warn('[transactionExtractorRefactored] Field extractor not available for value');
    return shares * price;
  }
}

module.exports = {
  extractTransactionDetails,
  extractTransactionType,
  extractShares,
  extractPrice,
  extractValue
};