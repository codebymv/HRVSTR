/**
 * Validation Utilities
 * Provides common validation functions for the application
 */

/**
 * Validate ticker symbol format
 * @param {string} ticker - The ticker symbol to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateTicker(ticker) {
    if (!ticker || typeof ticker !== 'string') {
        return false;
    }
    
    // Ticker should be 1-5 uppercase letters
    const tickerRegex = /^[A-Z]{1,5}$/;
    return tickerRegex.test(ticker.toUpperCase());
}

/**
 * Validate email format
 * @param {string} email - The email to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate timeframe parameter
 * @param {string} timeframe - The timeframe to validate (e.g., '1h', '24h', '7d')
 * @returns {boolean} - True if valid, false otherwise
 */
function validateTimeframe(timeframe) {
    if (!timeframe || typeof timeframe !== 'string') {
        return false;
    }
    
    const validTimeframes = ['1h', '6h', '12h', '24h', '3d', '7d', '30d'];
    return validTimeframes.includes(timeframe);
}

/**
 * Validate confidence threshold
 * @param {number} threshold - The confidence threshold (0-1)
 * @returns {boolean} - True if valid, false otherwise
 */
function validateConfidenceThreshold(threshold) {
    if (typeof threshold !== 'number') {
        return false;
    }
    
    return threshold >= 0 && threshold <= 1;
}

/**
 * Validate array of tickers
 * @param {Array} tickers - Array of ticker symbols
 * @param {number} maxLength - Maximum allowed length
 * @returns {object} - Validation result with isValid and errors
 */
function validateTickerArray(tickers, maxLength = 10) {
    const result = {
        isValid: true,
        errors: []
    };
    
    if (!Array.isArray(tickers)) {
        result.isValid = false;
        result.errors.push('Tickers must be an array');
        return result;
    }
    
    if (tickers.length === 0) {
        result.isValid = false;
        result.errors.push('Tickers array cannot be empty');
        return result;
    }
    
    if (tickers.length > maxLength) {
        result.isValid = false;
        result.errors.push(`Maximum ${maxLength} tickers allowed`);
        return result;
    }
    
    const invalidTickers = tickers.filter(ticker => !validateTicker(ticker));
    if (invalidTickers.length > 0) {
        result.isValid = false;
        result.errors.push(`Invalid ticker format: ${invalidTickers.join(', ')}`);
    }
    
    return result;
}

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {object} - Validation result with normalized values
 */
function validatePagination(page, limit) {
    const result = {
        isValid: true,
        page: 1,
        limit: 20,
        errors: []
    };
    
    // Validate page
    if (page !== undefined) {
        const pageNum = parseInt(page);
        if (isNaN(pageNum) || pageNum < 1) {
            result.errors.push('Page must be a positive integer');
            result.isValid = false;
        } else {
            result.page = pageNum;
        }
    }
    
    // Validate limit
    if (limit !== undefined) {
        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            result.errors.push('Limit must be between 1 and 100');
            result.isValid = false;
        } else {
            result.limit = limitNum;
        }
    }
    
    return result;
}

module.exports = {
    validateTicker,
    validateEmail,
    validateTimeframe,
    validateConfidenceThreshold,
    validateTickerArray,
    validatePagination
};