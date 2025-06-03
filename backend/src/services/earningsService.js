/**
 * Earnings Service
 * Handles earnings data fetching and processing with user-specific caching
 * Follows the same architecture pattern as secService.js
 */
const earningsUtils = require('../utils/earnings');
const cache = require('../utils/cache');
const { pool: db } = require('../config/data-sources');
const axios = require('axios');

/**
 * Enhanced error handler for earnings service operations
 * @param {Error} error - The error to handle
 * @param {string} operation - Description of the operation that failed
 * @returns {Object} - Standardized error response
 */
function handleEarningsServiceError(error, operation) {
  console.error(`[earningsService] ${operation} failed:`, error.message);
  
  // Check for rate limiting
  if (error.isRateLimit || error.message.includes('429') || error.message.includes('rate limit')) {
    return {
      success: false,
      error: 'EARNINGS_RATE_LIMITED',
      message: 'Data provider rate limit reached. This is temporary - please wait a moment and try again.',
      userMessage: 'The earnings data servers are currently busy. We\'ll automatically retry in a few seconds.',
      retryAfter: 60,
      technical: error.message
    };
  }
  
  // Check for server errors
  if (error.isServerError || (error.response && error.response.status >= 500)) {
    return {
      success: false,
      error: 'EARNINGS_SERVER_ERROR',
      message: 'Earnings data servers are temporarily unavailable.',
      userMessage: 'Earnings servers are experiencing issues. Please try again in a few minutes.',
      retryAfter: 300,
      technical: error.message
    };
  }
  
  // Check for network errors
  if (error.isNetworkError || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: 'Network connection to earnings data provider failed.',
      userMessage: 'Connection issue detected. Please check your internet connection and try again.',
      retryAfter: 30,
      technical: error.message
    };
  }
  
  // Generic error
  return {
    success: false,
    error: 'EARNINGS_API_ERROR',
    message: 'Earnings data request failed.',
    userMessage: 'Unable to fetch earnings data at the moment. Please try again later.',
    retryAfter: 60,
    technical: error.message
  };
}

/**
 * Get upcoming earnings with enhanced error handling and user caching
 * @param {string} timeRange - Time range for the data
 * @param {number} limit - Maximum number of results
 * @param {function} progressCallback - Progress callback function
 * @returns {Promise<Object>} - Earnings data response
 */
async function getUpcomingEarnings(timeRange = '1m', limit = 50, progressCallback = null) {
  try {
    console.log(`[earningsService] Fetching upcoming earnings for ${timeRange}, limit: ${limit}`);
    
    // Add progress callback for rate limit awareness
    const enhancedProgressCallback = progressCallback ? (progress) => {
      if (progress.stage && progress.stage.includes('Rate Limit')) {
        progress.isRateLimit = true;
        progress.userMessage = 'Earnings servers are busy. Waiting to retry...';
      }
      progressCallback(progress);
    } : null;
    
    const upcomingEarnings = await earningsUtils.scrapeEarningsCalendar(timeRange, null, enhancedProgressCallback);
    
    if (!upcomingEarnings || upcomingEarnings.length === 0) {
      console.log(`[earningsService] No upcoming earnings found for timeRange: ${timeRange}`);
      return {
        success: true,
        data: [],
        count: 0,
        message: 'No upcoming earnings found for the selected time range.',
        userMessage: 'No earnings announcements found for the selected time period. Try a different time range.'
      };
    }
    
    // Apply limit if specified
    const limitedEarnings = limit ? upcomingEarnings.slice(0, limit) : upcomingEarnings;
    
    console.log(`[earningsService] Successfully fetched ${limitedEarnings.length} upcoming earnings`);
    return {
      success: true,
      data: limitedEarnings,
      count: limitedEarnings.length,
      message: `Successfully fetched ${limitedEarnings.length} upcoming earnings`
    };
  } catch (error) {
    return handleEarningsServiceError(error, 'upcoming earnings fetch');
  }
}

/**
 * Get earnings analysis for a specific ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} - Analysis data response
 */
async function getEarningsAnalysis(ticker) {
  try {
    console.log(`[earningsService] Fetching earnings analysis for ${ticker}`);
    
    const analysis = await earningsUtils.analyzeEarnings(ticker);
    
    if (!analysis) {
      console.warn(`[earningsService] No analysis data found for ticker: ${ticker}`);
      return {
        success: false,
        error: 'NO_DATA',
        message: 'No earnings analysis data available for this ticker.',
        userMessage: 'Earnings analysis is not available for this stock at the moment.'
      };
    }
    
    console.log(`[earningsService] Successfully generated analysis for ${ticker}`);
    return {
      success: true,
      data: analysis,
      message: `Successfully analyzed earnings for ${ticker}`
    };
  } catch (error) {
    return handleEarningsServiceError(error, 'earnings analysis fetch');
  }
}

/**
 * Get historical earnings for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @param {number} limit - Maximum number of historical records
 * @returns {Promise<Object>} - Historical earnings data
 */
async function getHistoricalEarnings(ticker, limit = 20) {
  try {
    console.log(`[earningsService] Fetching historical earnings for ${ticker}`);
    
    // This would be implemented with actual historical data fetching
    // For now, returning placeholder structure
    const historicalEarnings = [];
    
    console.log(`[earningsService] Successfully fetched ${historicalEarnings.length} historical earnings for ${ticker}`);
    return {
      success: true,
      data: historicalEarnings,
      count: historicalEarnings.length,
      message: `Historical earnings data for ${ticker}`
    };
  } catch (error) {
    return handleEarningsServiceError(error, 'historical earnings fetch');
  }
}

/**
 * Get company information for earnings context
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} - Company information
 */
async function getCompanyInfo(ticker) {
  try {
    console.log(`[earningsService] Fetching company info for ${ticker}`);
    
    // Use existing utils or implement company data fetching
    const companyInfo = await earningsUtils.getCompanyInfo(ticker);
    
    if (!companyInfo) {
      console.warn(`[earningsService] No company info found for ticker: ${ticker}`);
      return {
        success: false,
        error: 'NO_DATA',
        message: 'No company information available for this ticker.'
      };
    }
    
    return {
      success: true,
      data: companyInfo,
      message: `Company information for ${ticker}`
    };
  } catch (error) {
    return handleEarningsServiceError(error, 'company info fetch');
  }
}

/**
 * Clear earnings cache for development/testing
 * @returns {Promise<Object>} - Cache clear response
 */
async function clearEarningsCache() {
  try {
    console.log('[earningsService] Clearing earnings cache');
    
    // Clear memory cache
    cache.clearPrefix('earnings-');
    
    console.log('[earningsService] Earnings cache cleared successfully');
    return {
      success: true,
      message: 'Earnings cache cleared successfully'
    };
  } catch (error) {
    console.error('[earningsService] Error clearing cache:', error);
    return {
      success: false,
      error: 'Failed to clear earnings cache',
      message: error.message
    };
  }
}

module.exports = {
  getUpcomingEarnings,
  getEarningsAnalysis,
  getHistoricalEarnings,
  getCompanyInfo,
  clearEarningsCache,
  handleEarningsServiceError
}; 