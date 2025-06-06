/**
 * Form 4 Parser (Refactored) - Main orchestrator for Form 4 parsing using specialized components
 * 
 * This refactored version delegates specific tasks to specialized modules for better
 * maintainability, testability, and separation of concerns.
 */

// Import specialized components
const { parseXmlFeed } = require('./parsers/xmlFormParser');
const { fetchFilingContent } = require('./fetchers/secContentFetcher');
const { extractTicker } = require('./extractors/tickerExtractor');
const { extractPosition } = require('./extractors/positionExtractor');
const { 
  processFilingDates, 
  cleanInsiderName, 
  parseForm4Title, 
  generateTradeId, 
  validateTradeData 
} = require('./utils/form4Utils');

// Import existing extractors
const insiderExtractor = require('../extractors/insiderExtractor');
const transactionExtractor = require('../extractors/transactionExtractorRefactored');

/**
 * Parse Form 4 feed XML into an array of structured insider-trade objects
 * @param {string} xmlData - Raw XML data from SEC EDGAR RSS feed
 * @param {number} limit - Maximum number of entries to parse
 * @param {function} progressCallback - Optional callback function for progress updates
 * @returns {Promise<Array>} - Array of parsed insider trading objects
 */
async function parseForm4Data(xmlData, limit, progressCallback = null) {
  try {
    console.log(`\n🔍 FORM4PARSER REFACTORED - parseForm4Data START`);
    console.log(`🔍 Input: xmlData length=${xmlData?.length || 0}, limit=${limit}`);
    
    // Emit initial progress
    if (progressCallback) {
      progressCallback({ 
        stage: 'Initializing Form 4 processing...', 
        progress: 0, 
        total: limit, 
        current: 0 
      });
    }

    // Parse the XML feed to get structured entries
    const entries = await parseXmlFeed(xmlData, limit);
    
    if (entries.length === 0) {
      console.warn(`🔍 FORM4PARSER REFACTORED - No Form 4 entries found in feed`);
      return [];
    }
    
    console.log(`🔍 FORM4PARSER REFACTORED - Found ${entries.length} Form 4 entries to process`);
    
    // Process each entry
    const trades = [];
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      // Emit progress for each filing
      if (progressCallback) {
        const progressPercent = Math.round(((i + 1) / entries.length) * 85) + 10; // 10-95% range
        progressCallback({ 
          stage: `Processing Form 4 filing #${i + 1}: ${entry.title.substring(0, 50)}...`, 
          progress: progressPercent, 
          total: entries.length, 
          current: i + 1 
        });
      }
      
      console.log(`\n🔍 FORM4PARSER REFACTORED - Processing entry #${i+1}: ${entry.title}`);
      
      try {
        const trade = await processForm4Entry(entry, i);
        if (trade) {
          trades.push(trade);
        }
      } catch (entryError) {
        console.error(`🔍 FORM4PARSER REFACTORED - Error processing entry #${i+1}: ${entryError.message}`);
        // Continue with next entry rather than failing the entire batch
      }
    }
    
    // Final progress update
    if (progressCallback) {
      progressCallback({ 
        stage: 'Form 4 processing completed', 
        progress: 100, 
        total: entries.length, 
        current: entries.length 
      });
    }
    
    console.log(`🔍 FORM4PARSER REFACTORED - Completed processing. Generated ${trades.length} trades from ${entries.length} entries`);
    return trades;
    
  } catch (error) {
    console.error(`🔍 FORM4PARSER REFACTORED - Error in parseForm4Data: ${error.message}`);
    return [];
  }
}

/**
 * Process a single Form 4 entry into a trade object
 * @param {Object} entry - Parsed RSS entry
 * @param {number} index - Entry index
 * @returns {Promise<Object|null>} - Trade object or null
 */
async function processForm4Entry(entry, index) {
  try {
    // Parse the title to extract company information
    const titleInfo = parseForm4Title(entry.title);
    
    if (!titleInfo.success) {
      console.warn(`[form4ParserRefactored] Could not parse title: ${entry.title}`);
      return null;
    }
    
    const { companyName, companyCik, filerType } = titleInfo;
    
    // Fetch the filing content
    const content = entry.summary.length > 500 ? entry.summary : await fetchFilingContent(entry.link);
    
    // Extract insider information
    const { insiderName: rawInsiderName, personCIK } = insiderExtractor.extractInsiderDetails(
      entry.title, 
      entry.summary, 
      content
    );
    
    const insiderName = cleanInsiderName(rawInsiderName);
    
    // Extract ticker using specialized extractor
    const ticker = await extractTicker({
      companyName,
      companyCik,
      filerType,
      insiderName,
      personCIK,
      content
    });
    
    // Extract position using specialized extractor
    const position = await extractPosition({
      title: entry.title,
      content,
      insiderName,
      ticker
    });
    
    // Extract transaction details
    const transactionData = await transactionExtractor.extractTransactionDetails(content);
    const { shares, price, value, tradeType: transactionType, actualFilingDate } = transactionData;
    
    // Process filing dates with priority fallback
    const dateInfo = processFilingDates({
      actualFilingDate,
      published: entry.published,
      updated: entry.updated
    });
    
    // Create the trade object
    const trade = {
      id: generateTradeId(index),
      ticker: ticker || '-',
      insiderName: insiderName || 'Unknown',
      title: position || 'Unknown Position',
      tradeType: transactionType,
      shares,
      price,
      value,
      filingDate: dateInfo.filingDate,
      transactionDate: dateInfo.transactionDate,
      formType: '4',
      url: entry.link,
      
      // Additional metadata
      companyCik,
      personCIK,
      filerType,
      dateSource: dateInfo.dateSource,
      parser: entry.parser || 'refactored',
      processedAt: new Date().toISOString()
    };
    
    // Validate the trade data
    const validation = validateTradeData(trade);
    
    if (validation.warnings.length > 0) {
      console.warn(`[form4ParserRefactored] Trade validation warnings for ${insiderName}:`, validation.warnings);
    }
    
    if (!validation.isValid) {
      console.error(`[form4ParserRefactored] Trade validation failed for ${insiderName}:`, validation.errors);
      return null;
    }
    
    console.log(`[form4ParserRefactored] Successfully processed trade: ${insiderName} (${ticker}) - ${transactionType} ${shares} shares`);
    return trade;
    
  } catch (error) {
    console.error(`[form4ParserRefactored] Error processing entry: ${error.message}`);
    return null;
  }
}

/**
 * Parse Form 4 data with enhanced error handling and reporting
 * @param {string} xmlData - Raw XML data
 * @param {number} limit - Maximum entries to process
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Detailed processing results
 */
async function parseForm4DataWithDetails(xmlData, limit, options = {}) {
  const {
    progressCallback = null,
    includeValidation = false,
    includeMetrics = false,
    skipInvalidEntries = true
  } = options;
  
  const startTime = Date.now();
  const results = {
    trades: [],
    totalEntries: 0,
    processedEntries: 0,
    validTrades: 0,
    skippedEntries: 0,
    errors: [],
    warnings: [],
    processingTime: 0
  };
  
  try {
    // Parse entries
    const entries = await parseXmlFeed(xmlData, limit);
    results.totalEntries = entries.length;
    
    // Process each entry with detailed tracking
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      if (progressCallback) {
        progressCallback({
          stage: `Processing ${i + 1}/${entries.length}`,
          progress: Math.round((i / entries.length) * 100),
          current: i + 1,
          total: entries.length
        });
      }
      
      try {
        const trade = await processForm4Entry(entry, i);
        
        if (trade) {
          results.trades.push(trade);
          results.validTrades++;
        } else if (!skipInvalidEntries) {
          results.errors.push(`Failed to process entry: ${entry.title}`);
        } else {
          results.skippedEntries++;
        }
        
        results.processedEntries++;
        
      } catch (entryError) {
        const errorMsg = `Entry ${i + 1} processing failed: ${entryError.message}`;
        results.errors.push(errorMsg);
        
        if (!skipInvalidEntries) {
          console.error(`[form4ParserRefactored] ${errorMsg}`);
        }
      }
    }
    
    results.processingTime = Date.now() - startTime;
    
    // Add performance metrics if requested
    if (includeMetrics) {
      results.metrics = {
        averageProcessingTimePerEntry: results.processingTime / results.processedEntries,
        successRate: results.validTrades / results.processedEntries,
        entriesPerSecond: results.processedEntries / (results.processingTime / 1000)
      };
    }
    
    console.log(`[form4ParserRefactored] Processing complete: ${results.validTrades} valid trades from ${results.processedEntries} entries in ${results.processingTime}ms`);
    
    return results;
    
  } catch (error) {
    results.errors.push(`Fatal parsing error: ${error.message}`);
    results.processingTime = Date.now() - startTime;
    
    console.error(`[form4ParserRefactored] Fatal error in detailed parsing: ${error.message}`);
    return results;
  }
}

/**
 * Parse a single Form 4 entry (for testing or specific processing)
 * @param {string} xmlData - Raw XML data
 * @param {number} entryIndex - Index of entry to parse
 * @returns {Promise<Object|null>} - Parsed trade object or null
 */
async function parseSingleForm4Entry(xmlData, entryIndex) {
  try {
    const entries = await parseXmlFeed(xmlData, entryIndex + 1);
    
    if (entryIndex < entries.length) {
      return await processForm4Entry(entries[entryIndex], entryIndex);
    }
    
    console.warn(`[form4ParserRefactored] Entry index ${entryIndex} not found`);
    return null;
    
  } catch (error) {
    console.error(`[form4ParserRefactored] Error parsing single entry: ${error.message}`);
    return null;
  }
}

/**
 * Validate Form 4 XML data before processing
 * @param {string} xmlData - Raw XML data
 * @returns {Object} - Validation result
 */
function validateForm4XmlData(xmlData) {
  const validation = {
    isValid: true,
    warnings: [],
    errors: []
  };
  
  if (!xmlData || typeof xmlData !== 'string') {
    validation.errors.push('XML data is missing or not a string');
    validation.isValid = false;
    return validation;
  }
  
  if (xmlData.length < 100) {
    validation.errors.push('XML data is too short to contain valid Form 4 data');
    validation.isValid = false;
  }
  
  if (!xmlData.includes('<entry>') && !xmlData.includes('<item>')) {
    validation.warnings.push('No RSS entries found in XML data');
  }
  
  if (!xmlData.includes('Form 4') && !xmlData.includes('4 -')) {
    validation.warnings.push('No Form 4 references found in XML data');
  }
  
  // Check for common XML issues
  const openTags = (xmlData.match(/</g) || []).length;
  const closeTags = (xmlData.match(/>/g) || []).length;
  
  if (Math.abs(openTags - closeTags) > openTags * 0.1) {
    validation.warnings.push('XML appears to have malformed tags');
  }
  
  return validation;
}

// Maintain backward compatibility with original function name
const processXmlEntries = parseForm4Data;

module.exports = {
  parseForm4Data,
  parseForm4DataWithDetails,
  parseSingleForm4Entry,
  validateForm4XmlData,
  processXmlEntries // Backward compatibility
}; 