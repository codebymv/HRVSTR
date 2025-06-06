/**
 * HTML Extractor - Extracts transaction data from HTML tables and SEC index pages
 */

const { logExtraction } = require('../utils/extractorUtils');

/**
 * Extract transaction data from HTML table patterns
 * @param {string} content - Document content
 * @returns {Object} - Extracted transaction data
 */
function extractFromHtmlTables(content) {
  let shares = 0;
  let price = 0;
  let value = 0;
  let tradeType = 'BUY';

  try {
    // Look for table data patterns
    const tableRows = content.match(/<tr[^>]*>.*?<\/tr>/gi) || [];
    console.log(`[htmlExtractor] Found ${tableRows.length} table rows to analyze`);
    
    for (const row of tableRows) {
      const cells = row.match(/<td[^>]*>(.*?)<\/td>/gi) || [];
      
      for (let i = 0; i < cells.length; i++) {
        const cellContent = cells[i].replace(/<[^>]*>/g, '').trim();
        
        // Skip empty cells or cells with just whitespace
        if (!cellContent || cellContent.length === 0) continue;
        
        const extractedData = extractFromTableCell(cellContent, cells, i);
        if (extractedData.shares && !shares) shares = extractedData.shares;
        if (extractedData.price && !price) price = extractedData.price;
        if (extractedData.value && !value) value = extractedData.value;
      }
    }
    
    // Determine transaction type from content
    tradeType = determineTradeTypeFromContent(content);
    
    console.log(`[htmlExtractor] HTML table extraction complete: shares=${shares}, price=${price}, value=${value}, type=${tradeType}`);
    
  } catch (error) {
    console.warn(`[htmlExtractor] Error extracting from HTML tables: ${error.message}`);
  }

  return { shares, price, value, tradeType };
}

/**
 * Extract data from individual table cell
 * @param {string} cellContent - Cell content text
 * @param {Array} allCells - All cells in the row
 * @param {number} cellIndex - Index of current cell
 * @returns {Object} - Extracted data
 */
function extractFromTableCell(cellContent, allCells, cellIndex) {
  const result = { shares: 0, price: 0, value: 0 };
  
  // Look for numeric patterns
  const numericMatch = cellContent.match(/([0-9,]+(?:\.[0-9]+)?)/);
  if (!numericMatch) return result;
  
  const numericValue = parseFloat(numericMatch[1].replace(/,/g, ''));
  if (isNaN(numericValue) || numericValue <= 0) return result;
  
  // Determine what type of value this might be based on context
  const cellText = cellContent.toLowerCase();
  const previousCell = cellIndex > 0 ? allCells[cellIndex - 1].replace(/<[^>]*>/g, '').toLowerCase() : '';
  const nextCell = cellIndex < allCells.length - 1 ? allCells[cellIndex + 1].replace(/<[^>]*>/g, '').toLowerCase() : '';
  
  // Check for shares indicators
  if (cellText.includes('shares') || previousCell.includes('shares') || nextCell.includes('shares') ||
      cellText.includes('quantity') || previousCell.includes('quantity') ||
      (numericValue > 1 && numericValue < 1000000 && !cellText.includes('$'))) {
    result.shares = numericValue;
    logExtraction('htmlExtractor', 'shares', numericValue, 'table cell context');
  }
  
  // Check for price indicators
  if (cellText.includes('$') || previousCell.includes('price') || nextCell.includes('price') ||
      previousCell.includes('per share') || nextCell.includes('per share') ||
      (numericValue > 0.01 && numericValue < 10000 && cellText.includes('$'))) {
    result.price = numericValue;
    logExtraction('htmlExtractor', 'price', `$${numericValue}`, 'table cell context');
  }
  
  // Check for value indicators
  if (previousCell.includes('total') || nextCell.includes('total') ||
      previousCell.includes('value') || nextCell.includes('value') ||
      (numericValue > 1000 && cellText.includes('$'))) {
    result.value = numericValue;
    logExtraction('htmlExtractor', 'value', `$${numericValue}`, 'table cell context');
  }
  
  return result;
}

/**
 * Extract transaction data from SEC index pages
 * @param {string} content - Index page content
 * @returns {Object} - Extracted transaction data
 */
function extractFromSecIndexPage(content) {
  let shares = 0;
  let price = 0;
  let value = 0;
  let tradeType = 'BUY';

  try {
    // Use cheerio for better HTML parsing if available, otherwise use regex
    let $ = null;
    try {
      const cheerio = require('cheerio');
      $ = cheerio.load(content);
    } catch (e) {
      console.log(`[htmlExtractor] Cheerio not available, using regex patterns`);
      return extractFromIndexWithRegex(content);
    }

    console.log(`[htmlExtractor] Processing SEC index page with ${$('table').length} tables found`);
    
    // Look through all tables for transaction data
    $('table').each((i, table) => {
      const $table = $(table);
      
      if (shares > 0 && price > 0 && value > 0) {
        return false; // Stop if we have all data
      }
      
      // Extract numeric values from the table
      $table.find('td, th').each((j, cell) => {
        const cellText = $(cell).text().trim();
        
        const extractedData = extractFromIndexCell(cellText);
        if (extractedData.shares && !shares) shares = extractedData.shares;
        if (extractedData.price && !price) price = extractedData.price;
        if (extractedData.value && !value) value = extractedData.value;
      });
    });
    
    // Look for transaction type indicators
    tradeType = determineTradeTypeFromContent(content);
    
    // Try to extract from any description or summary text
    if (shares === 0 || price === 0 || value === 0) {
      const additionalData = extractFromIndexSummary($);
      if (additionalData.shares && !shares) shares = additionalData.shares;
      if (additionalData.price && !price) price = additionalData.price;
      if (additionalData.value && !value) value = additionalData.value;
    }
    
    console.log(`[htmlExtractor] SEC index extraction complete: shares=${shares}, price=${price}, value=${value}, type=${tradeType}`);
    
  } catch (error) {
    console.warn(`[htmlExtractor] Error extracting from SEC index page: ${error.message}`);
  }

  return { shares, price, value, tradeType };
}

/**
 * Extract data from index page cell
 * @param {string} cellText - Cell text content
 * @returns {Object} - Extracted data
 */
function extractFromIndexCell(cellText) {
  const result = { shares: 0, price: 0, value: 0 };
  
  if (!cellText || cellText.length === 0) return result;
  
  const text = cellText.toLowerCase();
  
  // Look for shares patterns
  const sharesMatch = text.match(/(?:shares?|quantity)[:\s]*([0-9,]+)/i) ||
                     text.match(/([0-9,]+)\s*shares?/i);
  if (sharesMatch) {
    const shares = parseFloat(sharesMatch[1].replace(/,/g, ''));
    if (!isNaN(shares) && shares > 0) {
      result.shares = shares;
    }
  }
  
  // Look for price patterns
  const priceMatch = text.match(/\$([0-9,]+(?:\.[0-9]+)?)/i) ||
                    text.match(/price[:\s]*\$?([0-9,]+(?:\.[0-9]+)?)/i);
  if (priceMatch) {
    const price = parseFloat(priceMatch[1].replace(/,/g, ''));
    if (!isNaN(price) && price > 0) {
      result.price = price;
    }
  }
  
  // Look for value patterns
  const valueMatch = text.match(/(?:total|value)[:\s]*\$?([0-9,]+(?:\.[0-9]+)?)/i);
  if (valueMatch) {
    const value = parseFloat(valueMatch[1].replace(/,/g, ''));
    if (!isNaN(value) && value > 0) {
      result.value = value;
    }
  }
  
  return result;
}

/**
 * Extract from index page using regex when cheerio not available
 * @param {string} content - Index page content
 * @returns {Object} - Extracted data
 */
function extractFromIndexWithRegex(content) {
  let shares = 0;
  let price = 0;
  let value = 0;
  let tradeType = 'BUY';
  
  try {
    console.log(`[htmlExtractor] Using regex extraction for index page`);
    
    // Extract shares using regex patterns
    const sharePatterns = [
      /shares?[:\s]*([0-9,]+)/gi,
      /quantity[:\s]*([0-9,]+)/gi,
      /([0-9,]+)\s*shares?/gi
    ];
    
    for (const pattern of sharePatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const parsed = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(parsed) && parsed > 0 && parsed < 10000000) {
          shares = parsed;
          logExtraction('htmlExtractor', 'shares', shares, 'regex index extraction');
          break;
        }
      }
      if (shares > 0) break;
    }
    
    // Extract price using regex patterns
    const pricePatterns = [
      /price[:\s]*\$?([0-9,]+(?:\.[0-9]+)?)/gi,
      /\$([0-9,]+(?:\.[0-9]+)?)/g
    ];
    
    for (const pattern of pricePatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const parsed = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(parsed) && parsed > 0 && parsed < 100000) {
          price = parsed;
          logExtraction('htmlExtractor', 'price', `$${price}`, 'regex index extraction');
          break;
        }
      }
      if (price > 0) break;
    }
    
    // Determine transaction type
    tradeType = determineTradeTypeFromContent(content);
    
  } catch (error) {
    console.warn(`[htmlExtractor] Error in regex index extraction: ${error.message}`);
  }
  
  return { shares, price, value, tradeType };
}

/**
 * Extract from index summary sections
 * @param {Object} $ - Cheerio object
 * @returns {Object} - Extracted data
 */
function extractFromIndexSummary($) {
  const result = { shares: 0, price: 0, value: 0 };
  
  try {
    // Look for summary or description sections
    $('div, p, span').each((i, element) => {
      const text = $(element).text().trim().toLowerCase();
      
      if (text.length > 20 && (text.includes('transaction') || text.includes('filing'))) {
        const extracted = extractFromIndexCell(text);
        if (extracted.shares && !result.shares) result.shares = extracted.shares;
        if (extracted.price && !result.price) result.price = extracted.price;
        if (extracted.value && !result.value) result.value = extracted.value;
      }
    });
  } catch (error) {
    console.warn(`[htmlExtractor] Error extracting from index summary: ${error.message}`);
  }
  
  return result;
}

/**
 * Determine transaction type from content
 * @param {string} content - Document content
 * @returns {string} - Transaction type
 */
function determineTradeTypeFromContent(content) {
  const lowerContent = content.toLowerCase();
  
  // Look for explicit indicators
  if (lowerContent.includes('sale') || lowerContent.includes('sell') || lowerContent.includes('disposition')) {
    return 'SELL';
  }
  
  if (lowerContent.includes('purchase') || lowerContent.includes('buy') || lowerContent.includes('acquisition')) {
    return 'BUY';
  }
  
  if (lowerContent.includes('grant') || lowerContent.includes('award')) {
    return 'GRANT';
  }
  
  // Look for transaction codes
  const codeMatch = lowerContent.match(/code[:\s]*([ps])/i);
  if (codeMatch) {
    return codeMatch[1].toUpperCase() === 'S' ? 'SELL' : 'BUY';
  }
  
  return 'BUY'; // Default
}

/**
 * Extract transaction data with confidence scoring
 * @param {string} content - Content to extract from
 * @returns {Object} - Extracted data with confidence
 */
function extractFromHtmlWithConfidence(content) {
  const tableData = extractFromHtmlTables(content);
  const indexData = extractFromSecIndexPage(content);
  
  // Use the extraction with more successful fields
  const tableScore = (tableData.shares > 0 ? 1 : 0) + (tableData.price > 0 ? 1 : 0) + (tableData.value > 0 ? 1 : 0);
  const indexScore = (indexData.shares > 0 ? 1 : 0) + (indexData.price > 0 ? 1 : 0) + (indexData.value > 0 ? 1 : 0);
  
  const result = indexScore > tableScore ? indexData : tableData;
  
  return {
    ...result,
    _confidence: Math.max(tableScore, indexScore) / 3,
    _extractionMethod: indexScore > tableScore ? 'htmlIndex' : 'htmlTables'
  };
}

module.exports = {
  extractFromHtmlTables,
  extractFromSecIndexPage,
  extractFromHtmlWithConfidence
}; 