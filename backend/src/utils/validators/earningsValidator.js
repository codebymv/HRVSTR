/**
 * Earnings Validator - Specialized validation and cleaning for earnings data
 */

/**
 * Validate ticker symbol format
 * @param {string} ticker - Ticker symbol to validate
 * @returns {Object} - Validation result
 */
function validateTicker(ticker) {
  const validation = {
    isValid: false,
    cleanedTicker: null,
    errors: []
  };

  if (!ticker || typeof ticker !== 'string') {
    validation.errors.push('Ticker is missing or not a string');
    return validation;
  }

  const trimmed = ticker.trim().toUpperCase();

  // Check for invalid values
  const invalidValues = ['', 'SYMBOL', 'N/A', '-', 'TICKER'];
  if (invalidValues.includes(trimmed) || invalidValues.includes(trimmed.toLowerCase())) {
    validation.errors.push(`Invalid ticker value: "${ticker}"`);
    return validation;
  }

  // Check length constraints
  if (trimmed.length < 1 || trimmed.length > 10) {
    validation.errors.push(`Ticker length must be 1-10 characters: "${ticker}"`);
    return validation;
  }

  // Check pattern (letters, numbers, dots for international exchanges)
  const tickerRegex = /^[A-Z0-9]{1,10}(\.[A-Z]{1,3})?$/;
  if (!tickerRegex.test(trimmed)) {
    validation.errors.push(`Ticker doesn't match expected pattern: "${ticker}"`);
    return validation;
  }

  validation.isValid = true;
  validation.cleanedTicker = trimmed;
  return validation;
}

/**
 * Validate and clean company name
 * @param {string} companyName - Company name to validate
 * @returns {Object} - Validation result
 */
function validateCompanyName(companyName) {
  const validation = {
    isValid: false,
    cleanedName: null,
    errors: []
  };

  if (!companyName || typeof companyName !== 'string') {
    validation.errors.push('Company name is missing or not a string');
    return validation;
  }

  const trimmed = companyName.trim();

  // Check for invalid values
  const invalidValues = ['', 'COMPANY', 'N/A', '-', 'CORP'];
  if (invalidValues.includes(trimmed) || invalidValues.includes(trimmed.toLowerCase())) {
    validation.errors.push(`Invalid company name: "${companyName}"`);
    return validation;
  }

  // Check length constraints
  if (trimmed.length < 1 || trimmed.length > 200) {
    validation.errors.push(`Company name length must be 1-200 characters: "${companyName}"`);
    return validation;
  }

  // Basic pattern check (at least one letter)
  if (!/[a-zA-Z]/.test(trimmed)) {
    validation.errors.push(`Company name must contain at least one letter: "${companyName}"`);
    return validation;
  }

  validation.isValid = true;
  validation.cleanedName = trimmed;
  return validation;
}

/**
 * Parse and validate EPS value
 * @param {string|number} epsText - EPS text to parse
 * @returns {Object} - Parsing result
 */
function parseEPS(epsText) {
  const result = {
    isValid: false,
    value: null,
    errors: []
  };

  if (epsText === null || epsText === undefined) {
    return result; // Null values are acceptable for EPS
  }

  if (typeof epsText === 'number') {
    if (isNaN(epsText) || !isFinite(epsText)) {
      result.errors.push('EPS is not a finite number');
      return result;
    }
    result.isValid = true;
    result.value = epsText;
    return result;
  }

  if (typeof epsText !== 'string') {
    result.errors.push('EPS must be a string or number');
    return result;
  }

  const trimmed = epsText.trim();

  // Handle null/empty cases
  if (trimmed === '' || trimmed === '-' || trimmed === 'N/A' || trimmed === '--') {
    return result; // These are acceptable null values
  }

  // Remove currency symbols and clean text
  let cleaned = trimmed
    .replace(/[$,\s]/g, '') // Remove dollar signs, commas, spaces
    .replace(/[()]/g, ''); // Remove parentheses

  // Handle negative values in parentheses format
  if (epsText.includes('(') && epsText.includes(')')) {
    cleaned = '-' + cleaned;
  }

  // Try to parse as float
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed) || !isFinite(parsed)) {
    result.errors.push(`Cannot parse EPS value: "${epsText}"`);
    return result;
  }

  // Reasonable range check for EPS (-1000 to 1000)
  if (parsed < -1000 || parsed > 1000) {
    result.errors.push(`EPS value out of reasonable range: ${parsed}`);
    return result;
  }

  result.isValid = true;
  result.value = parsed;
  return result;
}

/**
 * Parse and validate surprise percentage
 * @param {string|number} surpriseText - Surprise percentage text
 * @returns {Object} - Parsing result
 */
function parseSurprisePercentage(surpriseText) {
  const result = {
    isValid: false,
    value: null,
    errors: []
  };

  if (surpriseText === null || surpriseText === undefined) {
    return result; // Null values are acceptable
  }

  if (typeof surpriseText === 'number') {
    if (isNaN(surpriseText) || !isFinite(surpriseText)) {
      result.errors.push('Surprise percentage is not a finite number');
      return result;
    }
    result.isValid = true;
    result.value = surpriseText;
    return result;
  }

  if (typeof surpriseText !== 'string') {
    result.errors.push('Surprise percentage must be a string or number');
    return result;
  }

  const trimmed = surpriseText.trim();

  // Handle null/empty cases
  if (trimmed === '' || trimmed === '-' || trimmed === 'N/A' || trimmed === '--') {
    return result; // These are acceptable null values
  }

  // Remove percentage signs and other characters
  let cleaned = trimmed.replace(/[^-0-9.]/g, '');

  if (cleaned === '' || cleaned === '-') {
    return result;
  }

  const parsed = parseFloat(cleaned);

  if (isNaN(parsed) || !isFinite(parsed)) {
    result.errors.push(`Cannot parse surprise percentage: "${surpriseText}"`);
    return result;
  }

  // Reasonable range check for surprise percentage (-1000% to 1000%)
  if (parsed < -1000 || parsed > 1000) {
    result.errors.push(`Surprise percentage out of reasonable range: ${parsed}%`);
    return result;
  }

  result.isValid = true;
  result.value = parsed;
  return result;
}

/**
 * Parse and validate earnings date
 * @param {string|Date} dateText - Date text to parse
 * @returns {Object} - Parsing result
 */
function parseEarningsDate(dateText) {
  const result = {
    isValid: false,
    date: null,
    isoString: null,
    errors: []
  };

  if (!dateText) {
    result.errors.push('Date is missing');
    return result;
  }

  let parsedDate;

  if (dateText instanceof Date) {
    parsedDate = dateText;
  } else if (typeof dateText === 'string') {
    parsedDate = new Date(dateText);
  } else {
    result.errors.push('Date must be a string or Date object');
    return result;
  }

  if (isNaN(parsedDate.getTime())) {
    result.errors.push(`Invalid date format: "${dateText}"`);
    return result;
  }

  // Reasonable date range check (1990 to 2030)
  const year = parsedDate.getFullYear();
  if (year < 1990 || year > 2030) {
    result.errors.push(`Date year out of reasonable range: ${year}`);
    return result;
  }

  result.isValid = true;
  result.date = parsedDate;
  result.isoString = parsedDate.toISOString();
  return result;
}

/**
 * Validate earnings time (BMO, AMC, etc.)
 * @param {string} timeText - Earnings time text
 * @returns {Object} - Validation result
 */
function validateEarningsTime(timeText) {
  const validation = {
    isValid: false,
    standardizedTime: null,
    errors: []
  };

  if (!timeText || typeof timeText !== 'string') {
    validation.standardizedTime = 'Unknown';
    validation.isValid = true; // Unknown time is acceptable
    return validation;
  }

  const trimmed = timeText.trim().toUpperCase();

  // Standard time mappings
  const timeMap = {
    'BMO': 'Before Market Open',
    'BEFORE MARKET OPEN': 'Before Market Open',
    'PRE-MARKET': 'Before Market Open',
    'PREMARKET': 'Before Market Open',
    'AMC': 'After Market Close',
    'AFTER MARKET CLOSE': 'After Market Close',
    'POST-MARKET': 'After Market Close',
    'POSTMARKET': 'After Market Close',
    'AFTER HOURS': 'After Market Close',
    'DURING MARKET': 'During Market Hours',
    'MARKET HOURS': 'During Market Hours',
    'UNKNOWN': 'Unknown',
    'N/A': 'Unknown',
    '-': 'Unknown',
    '': 'Unknown'
  };

  // Direct mapping
  if (timeMap[trimmed]) {
    validation.isValid = true;
    validation.standardizedTime = timeMap[trimmed];
    return validation;
  }

  // Pattern matching
  if (trimmed.includes('BEFORE') || trimmed.includes('PRE')) {
    validation.isValid = true;
    validation.standardizedTime = 'Before Market Open';
    return validation;
  }

  if (trimmed.includes('AFTER') || trimmed.includes('POST')) {
    validation.isValid = true;
    validation.standardizedTime = 'After Market Close';
    return validation;
  }

  // Default to unknown for unrecognized formats
  validation.isValid = true;
  validation.standardizedTime = 'Unknown';
  return validation;
}

/**
 * Validate complete earnings object
 * @param {Object} earningsData - Earnings data object
 * @returns {Object} - Comprehensive validation result
 */
function validateEarningsObject(earningsData) {
  const validation = {
    isValid: true,
    cleanedData: {},
    errors: [],
    warnings: []
  };

  if (!earningsData || typeof earningsData !== 'object') {
    validation.isValid = false;
    validation.errors.push('Earnings data must be an object');
    return validation;
  }

  // Validate ticker
  const tickerValidation = validateTicker(earningsData.symbol || earningsData.ticker);
  if (!tickerValidation.isValid) {
    validation.isValid = false;
    validation.errors.push(...tickerValidation.errors);
  } else {
    validation.cleanedData.symbol = tickerValidation.cleanedTicker;
    validation.cleanedData.ticker = tickerValidation.cleanedTicker;
  }

  // Validate company name
  const companyValidation = validateCompanyName(earningsData.companyName);
  if (!companyValidation.isValid) {
    validation.isValid = false;
    validation.errors.push(...companyValidation.errors);
  } else {
    validation.cleanedData.companyName = companyValidation.cleanedName;
  }

  // Validate estimated EPS
  const estimateValidation = parseEPS(earningsData.estimatedEPS);
  if (estimateValidation.errors.length > 0) {
    validation.warnings.push(...estimateValidation.errors);
  }
  validation.cleanedData.estimatedEPS = estimateValidation.value;

  // Validate actual EPS
  const actualValidation = parseEPS(earningsData.actualEPS);
  if (actualValidation.errors.length > 0) {
    validation.warnings.push(...actualValidation.errors);
  }
  validation.cleanedData.actualEPS = actualValidation.value;

  // Validate surprise percentage
  const surpriseValidation = parseSurprisePercentage(earningsData.surprisePercentage);
  if (surpriseValidation.errors.length > 0) {
    validation.warnings.push(...surpriseValidation.errors);
  }
  validation.cleanedData.surprisePercentage = surpriseValidation.value;

  // Validate earnings time
  const timeValidation = validateEarningsTime(earningsData.time);
  validation.cleanedData.time = timeValidation.standardizedTime;

  // Validate report date if present
  if (earningsData.reportDate) {
    const dateValidation = parseEarningsDate(earningsData.reportDate);
    if (!dateValidation.isValid) {
      validation.warnings.push(...dateValidation.errors);
    } else {
      validation.cleanedData.reportDate = dateValidation.isoString;
    }
  }

  // Calculate beat/miss if both values are present
  if (validation.cleanedData.estimatedEPS !== null && validation.cleanedData.actualEPS !== null) {
    validation.cleanedData.beat = validation.cleanedData.actualEPS > validation.cleanedData.estimatedEPS;
  } else {
    validation.cleanedData.beat = null;
  }

  // Add metadata
  validation.cleanedData.source = earningsData.source || 'Unknown';
  validation.cleanedData.timestamp = new Date().toISOString();

  return validation;
}

/**
 * Filter out duplicate earnings entries
 * @param {Array} earningsArray - Array of earnings objects
 * @returns {Array} - Deduplicated array
 */
function removeDuplicateEarnings(earningsArray) {
  if (!Array.isArray(earningsArray)) {
    return [];
  }

  const seenKeys = new Set();
  const uniqueEarnings = [];

  for (const earnings of earningsArray) {
    // Create a key based on ticker, date, and EPS values
    const key = [
      earnings.symbol || earnings.ticker || '',
      earnings.reportDate || '',
      earnings.estimatedEPS || '',
      earnings.actualEPS || ''
    ].join('|');

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueEarnings.push(earnings);
    }
  }

  console.log(`[earningsValidator] Removed ${earningsArray.length - uniqueEarnings.length} duplicate earnings`);
  return uniqueEarnings;
}

/**
 * Batch validate multiple earnings objects
 * @param {Array} earningsArray - Array of earnings data
 * @returns {Object} - Batch validation result
 */
function batchValidateEarnings(earningsArray) {
  const result = {
    valid: [],
    invalid: [],
    totalProcessed: 0,
    validCount: 0,
    invalidCount: 0,
    errors: [],
    warnings: []
  };

  if (!Array.isArray(earningsArray)) {
    result.errors.push('Input must be an array');
    return result;
  }

  for (let i = 0; i < earningsArray.length; i++) {
    const earnings = earningsArray[i];
    result.totalProcessed++;

    try {
      const validation = validateEarningsObject(earnings);

      if (validation.isValid) {
        result.valid.push(validation.cleanedData);
        result.validCount++;
      } else {
        result.invalid.push({
          originalData: earnings,
          errors: validation.errors,
          index: i
        });
        result.invalidCount++;
        result.errors.push(`Entry ${i}: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        result.warnings.push(`Entry ${i}: ${validation.warnings.join(', ')}`);
      }

    } catch (error) {
      result.invalid.push({
        originalData: earnings,
        errors: [error.message],
        index: i
      });
      result.invalidCount++;
      result.errors.push(`Entry ${i}: ${error.message}`);
    }
  }

  // Remove duplicates from valid entries
  result.valid = removeDuplicateEarnings(result.valid);

  console.log(`[earningsValidator] Batch validation: ${result.validCount} valid, ${result.invalidCount} invalid, ${result.totalProcessed} total`);

  return result;
}

module.exports = {
  validateTicker,
  validateCompanyName,
  parseEPS,
  parseSurprisePercentage,
  parseEarningsDate,
  validateEarningsTime,
  validateEarningsObject,
  removeDuplicateEarnings,
  batchValidateEarnings
}; 