/**
 * Earnings Data Parser - Specialized processing and parsing for earnings data
 */

const { parseEPS, parseSurprisePercentage, validateEarningsTime } = require('../utils/validators/earningsValidator');

/**
 * Calculate EPS surprise percentage
 * @param {number} actualEPS - Actual EPS value
 * @param {number} estimatedEPS - Estimated EPS value
 * @returns {number|null} - Surprise percentage or null if cannot calculate
 */
function calculateSurprisePercentage(actualEPS, estimatedEPS) {
  if (actualEPS === null || actualEPS === undefined || 
      estimatedEPS === null || estimatedEPS === undefined || 
      estimatedEPS === 0) {
    return null;
  }

  try {
    const surprise = ((actualEPS - estimatedEPS) / Math.abs(estimatedEPS)) * 100;
    return Math.round(surprise * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.warn('[earningsDataParser] Error calculating surprise percentage:', error.message);
    return null;
  }
}

/**
 * Parse earnings row from scraped table data
 * @param {Object} rowData - Raw row data from table
 * @returns {Object} - Parsed earnings data
 */
function parseEarningsRow(rowData) {
  const parsed = {
    symbol: null,
    companyName: null,
    estimatedEPS: null,
    actualEPS: null,
    surprisePercentage: null,
    time: null,
    source: 'Yahoo Finance',
    errors: []
  };

  try {
    // Parse symbol/ticker
    if (rowData.symbol || rowData.ticker) {
      const symbolText = (rowData.symbol || rowData.ticker).toString().trim().toUpperCase();
      if (symbolText && symbolText !== '' && symbolText !== 'N/A') {
        parsed.symbol = symbolText;
      }
    }

    // Parse company name
    if (rowData.companyName || rowData.company) {
      const companyText = (rowData.companyName || rowData.company).toString().trim();
      if (companyText && companyText !== '' && companyText !== 'N/A') {
        parsed.companyName = companyText;
      }
    }

    // Parse estimated EPS
    const estimatedResult = parseEPS(rowData.estimatedEPS || rowData.estimate);
    parsed.estimatedEPS = estimatedResult.value;
    if (estimatedResult.errors.length > 0) {
      parsed.errors.push(...estimatedResult.errors);
    }

    // Parse actual EPS
    const actualResult = parseEPS(rowData.actualEPS || rowData.actual);
    parsed.actualEPS = actualResult.value;
    if (actualResult.errors.length > 0) {
      parsed.errors.push(...actualResult.errors);
    }

    // Parse or calculate surprise percentage
    if (rowData.surprisePercentage || rowData.surprise) {
      const surpriseResult = parseSurprisePercentage(rowData.surprisePercentage || rowData.surprise);
      parsed.surprisePercentage = surpriseResult.value;
      if (surpriseResult.errors.length > 0) {
        parsed.errors.push(...surpriseResult.errors);
      }
    } else if (parsed.estimatedEPS !== null && parsed.actualEPS !== null) {
      // Calculate surprise if not provided
      parsed.surprisePercentage = calculateSurprisePercentage(parsed.actualEPS, parsed.estimatedEPS);
    }

    // Parse earnings time
    const timeResult = validateEarningsTime(rowData.time || rowData.reportTime);
    parsed.time = timeResult.standardizedTime;

    // Additional fields
    if (rowData.reportDate) {
      parsed.reportDate = rowData.reportDate;
    }

  } catch (error) {
    parsed.errors.push(`Row parsing error: ${error.message}`);
  }

  return parsed;
}

/**
 * Extract earnings data from table rows using multiple strategies
 * @param {Array} tableRows - Array of table row elements or data
 * @param {Object} extractionOptions - Options for extraction
 * @returns {Array} - Array of parsed earnings objects
 */
function extractEarningsFromTable(tableRows, extractionOptions = {}) {
  const {
    skipHeaders = true,
    columnMapping = null,
    dateContext = null,
    fallbackStrategies = true
  } = extractionOptions;

  const earnings = [];
  const errors = [];

  if (!Array.isArray(tableRows)) {
    errors.push('Table rows must be an array');
    return { earnings: [], errors };
  }

  // Skip header row if requested
  const dataRows = skipHeaders && tableRows.length > 0 ? tableRows.slice(1) : tableRows;

  for (let i = 0; i < dataRows.length; i++) {
    try {
      const rowData = extractRowData(dataRows[i], columnMapping, i);
      
      if (rowData && Object.keys(rowData).length > 0) {
        // Add date context if provided
        if (dateContext) {
          rowData.reportDate = dateContext;
        }

        const parsedRow = parseEarningsRow(rowData);
        
        // Only include rows with at least a symbol
        if (parsedRow.symbol) {
          earnings.push(parsedRow);
        }
      }

    } catch (error) {
      errors.push(`Row ${i} extraction error: ${error.message}`);
    }
  }

  // Apply fallback strategies if enabled and no data found
  if (fallbackStrategies && earnings.length === 0 && tableRows.length > 0) {
    console.log('[earningsDataParser] No data found with primary strategy, trying fallback extraction');
    return extractEarningsWithFallback(tableRows, extractionOptions);
  }

  console.log(`[earningsDataParser] Extracted ${earnings.length} earnings from ${dataRows.length} rows`);
  return { earnings, errors };
}

/**
 * Extract data from a single table row
 * @param {*} row - Table row element or data
 * @param {Object} columnMapping - Column mapping configuration
 * @param {number} rowIndex - Row index for debugging
 * @returns {Object} - Extracted row data
 */
function extractRowData(row, columnMapping, rowIndex) {
  try {
    // Handle different row data formats
    if (Array.isArray(row)) {
      return extractFromArrayRow(row, columnMapping);
    } else if (typeof row === 'object' && row !== null) {
      return extractFromObjectRow(row, columnMapping);
    } else if (typeof row === 'string') {
      // Try to parse as delimited text
      return extractFromTextRow(row, columnMapping);
    } else {
      console.warn(`[earningsDataParser] Unknown row format at index ${rowIndex}:`, typeof row);
      return null;
    }
  } catch (error) {
    console.error(`[earningsDataParser] Error extracting row ${rowIndex}:`, error.message);
    return null;
  }
}

/**
 * Extract data from array-based row (CSV-like)
 * @param {Array} rowArray - Array of cell values
 * @param {Object} columnMapping - Column mapping
 * @returns {Object} - Extracted data
 */
function extractFromArrayRow(rowArray, columnMapping) {
  const extracted = {};

  if (columnMapping) {
    // Use provided column mapping
    Object.keys(columnMapping).forEach(field => {
      const columnIndex = columnMapping[field];
      if (columnIndex < rowArray.length) {
        extracted[field] = rowArray[columnIndex];
      }
    });
  } else {
    // Use default column order: Symbol, Company, EPS Estimate, EPS Actual, Surprise, Time
    const defaultMapping = {
      symbol: 0,
      companyName: 1,
      estimatedEPS: 2,
      actualEPS: 3,
      surprisePercentage: 4,
      time: 5
    };

    Object.keys(defaultMapping).forEach(field => {
      const columnIndex = defaultMapping[field];
      if (columnIndex < rowArray.length) {
        extracted[field] = rowArray[columnIndex];
      }
    });
  }

  return extracted;
}

/**
 * Extract data from object-based row (JSON-like)
 * @param {Object} rowObject - Object containing row data
 * @param {Object} columnMapping - Column mapping
 * @returns {Object} - Extracted data
 */
function extractFromObjectRow(rowObject, columnMapping) {
  const extracted = {};

  if (columnMapping) {
    // Use provided field mapping
    Object.keys(columnMapping).forEach(targetField => {
      const sourceField = columnMapping[targetField];
      if (rowObject.hasOwnProperty(sourceField)) {
        extracted[targetField] = rowObject[sourceField];
      }
    });
  } else {
    // Try common field name variations
    const fieldMappings = {
      symbol: ['symbol', 'ticker', 'Symbol', 'Ticker', 'SYMBOL'],
      companyName: ['companyName', 'company', 'Company Name', 'name', 'Name'],
      estimatedEPS: ['estimatedEPS', 'estimate', 'eps_estimate', 'EPS Estimate', 'consensus'],
      actualEPS: ['actualEPS', 'actual', 'eps_actual', 'EPS Actual', 'reported'],
      surprisePercentage: ['surprisePercentage', 'surprise', 'Surprise %', 'surprise_pct'],
      time: ['time', 'reportTime', 'Time', 'when', 'timing']
    };

    Object.keys(fieldMappings).forEach(targetField => {
      const possibleFields = fieldMappings[targetField];
      for (const sourceField of possibleFields) {
        if (rowObject.hasOwnProperty(sourceField)) {
          extracted[targetField] = rowObject[sourceField];
          break;
        }
      }
    });
  }

  return extracted;
}

/**
 * Extract data from text-based row (delimited string)
 * @param {string} rowText - Delimited text row
 * @param {Object} columnMapping - Column mapping
 * @returns {Object} - Extracted data
 */
function extractFromTextRow(rowText, columnMapping) {
  // Try different delimiters
  const delimiters = ['\t', '|', ',', ';'];
  let cells = [];

  for (const delimiter of delimiters) {
    const testCells = rowText.split(delimiter);
    if (testCells.length > cells.length) {
      cells = testCells.map(cell => cell.trim());
    }
  }

  // If no good delimiter found, return the whole text as company name
  if (cells.length <= 1) {
    return { companyName: rowText.trim() };
  }

  return extractFromArrayRow(cells, columnMapping);
}

/**
 * Fallback extraction strategies for difficult pages
 * @param {Array} tableRows - Table rows
 * @param {Object} options - Extraction options
 * @returns {Object} - Extraction result
 */
function extractEarningsWithFallback(tableRows, options) {
  const earnings = [];
  const errors = [];

  console.log('[earningsDataParser] Attempting fallback extraction strategies');

  // Strategy 1: Look for any text that looks like ticker symbols
  try {
    const tickerPattern = /\b[A-Z]{1,5}\b/g;
    const potentialTickers = new Set();

    tableRows.forEach(row => {
      const rowText = typeof row === 'string' ? row : JSON.stringify(row);
      const matches = rowText.match(tickerPattern);
      if (matches) {
        matches.forEach(match => {
          if (match.length >= 1 && match.length <= 5) {
            potentialTickers.add(match);
          }
        });
      }
    });

    potentialTickers.forEach(ticker => {
      earnings.push({
        symbol: ticker,
        companyName: null,
        estimatedEPS: null,
        actualEPS: null,
        surprisePercentage: null,
        time: 'Unknown',
        source: 'Yahoo Finance (Fallback)',
        errors: ['Extracted using fallback pattern matching']
      });
    });

    if (earnings.length > 0) {
      console.log(`[earningsDataParser] Fallback strategy found ${earnings.length} potential tickers`);
    }

  } catch (error) {
    errors.push(`Fallback extraction error: ${error.message}`);
  }

  return { earnings, errors };
}

module.exports = {
  calculateSurprisePercentage,
  parseEarningsRow,
  extractEarningsFromTable,
  extractRowData,
  extractFromArrayRow,
  extractFromObjectRow,
  extractFromTextRow,
  extractEarningsWithFallback
};
