/**
 * Earnings Controller
 * Handles business logic for earnings API endpoints using free data sources
 */
const earningsUtils = require('../utils/earnings');
const cacheUtils = require('../utils/cache');
const { randomDelay } = require('../utils/scraping-helpers');

/**
 * Get upcoming earnings data using Yahoo Finance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getUpcomingEarnings(req, res, next) {
  try {
    const { timeRange = '1m', refresh = false } = req.query;
    
    // Check cache first (unless refresh is requested)
    if (!refresh && cacheUtils.hasCachedItem('earnings-upcoming', timeRange)) {
      const cachedData = cacheUtils.getCachedItem('earnings-upcoming', timeRange);
      console.log(`📋 Serving cached upcoming earnings data for ${timeRange}`);
      
      // Apply comprehensive validation to cached data as well
      const validatedCachedData = validateAndCleanEarningsData(cachedData);
      
      return res.json({
        success: true,
        data: validatedCachedData,
        source: 'cache',
        timeRange,
        count: validatedCachedData.length,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔍 Fetching upcoming earnings for time range: ${timeRange}`);
    
    // Add random delay to avoid rate limiting
    await randomDelay(500, 1500);
    
    // Fetch upcoming earnings from Yahoo Finance
    const upcomingEarnings = await earningsUtils.scrapeEarningsCalendar(timeRange);
    
    if (!upcomingEarnings || upcomingEarnings.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No upcoming earnings found for the specified time range',
        timeRange,
        count: 0,
        timestamp: new Date().toISOString()
      });
    }

    // Apply comprehensive validation and cleaning
    const validatedEarnings = validateAndCleanEarningsData(upcomingEarnings);
    
    // Cache the validated results for 1 hour
    cacheUtils.setCachedItem('earnings-upcoming', timeRange, validatedEarnings, 3600);
    
    console.log(`✅ Successfully fetched and validated ${validatedEarnings.length} upcoming earnings (filtered from ${upcomingEarnings.length} raw entries)`);
    
    res.json({
      success: true,
      data: validatedEarnings,
      source: 'Yahoo Finance',
      timeRange,
      count: validatedEarnings.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching upcoming earnings:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming earnings data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Comprehensive validation and cleaning function for earnings data
 * Filters out any earnings with invalid ticker symbols and ensures data consistency
 * @param {Array} earningsData - Array of earnings objects
 * @returns {Array} Cleaned array of valid earnings objects
 */
function validateAndCleanEarningsData(earningsData) {
  if (!Array.isArray(earningsData)) {
    console.warn('🚨 VALIDATION: Expected array but received:', typeof earningsData);
    return [];
  }

  let invalidCount = 0;
  const validEarnings = earningsData.filter((earning, index) => {
    // Check all possible ticker field names
    const ticker = earning.symbol || earning.ticker;
    
    // Comprehensive ticker validation
    if (!ticker || 
        typeof ticker !== 'string' || 
        ticker.trim() === '' ||
        ticker === 'undefined' ||
        ticker === 'null' ||
        ticker === 'Symbol' ||
        ticker === 'N/A' ||
        ticker === '-' ||
        ticker.toLowerCase() === 'company' ||
        ticker.length > 10 ||
        ticker.length < 1) {
      
      console.warn(`🚨 VALIDATION: Filtering out earnings at index ${index} with invalid ticker:`, {
        ticker: ticker,
        type: typeof ticker,
        fullEarning: earning
      });
      invalidCount++;
      return false;
    }

    // Additional validation for ticker pattern (basic stock symbol format)
    const tickerPattern = /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/;
    if (!tickerPattern.test(ticker.toUpperCase())) {
      console.warn(`🚨 VALIDATION: Filtering out earnings with ticker pattern mismatch: "${ticker}"`);
      invalidCount++;
      return false;
    }

    // Validate company name
    const companyName = earning.companyName || earning.company;
    if (!companyName || 
        typeof companyName !== 'string' || 
        companyName.trim() === '' ||
        companyName === 'Company' ||
        companyName === 'N/A') {
      console.warn(`🚨 VALIDATION: Filtering out earnings with invalid company name: "${companyName}" for ticker: "${ticker}"`);
      invalidCount++;
      return false;
    }

    return true;
  }).map(earning => {
    // Normalize the data structure to ensure consistent field names
    return {
      ticker: (earning.symbol || earning.ticker).toUpperCase().trim(),
      symbol: (earning.symbol || earning.ticker).toUpperCase().trim(), // Keep both fields for compatibility
      companyName: (earning.companyName || earning.company || '').trim(),
      reportDate: earning.date || earning.reportDate,
      estimatedEPS: earning.estimatedEPS || earning.expectedEPS || null,
      actualEPS: earning.actualEPS || earning.reportedEPS || null,
      time: earning.time || 'Unknown',
      source: earning.source || 'Yahoo Finance',
      lastUpdated: earning.lastUpdated || new Date().toISOString()
    };
  });

  if (invalidCount > 0) {
    console.log(`🔍 VALIDATION: Filtered out ${invalidCount} invalid earnings entries. ${validEarnings.length} valid entries remaining.`);
  }

  return validEarnings;
}

/**
 * Get earnings analysis for a specific ticker using free data sources
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getEarningsAnalysis(req, res, next) {
  try {
    const { ticker } = req.params;
    const { refresh = false } = req.query;

    if (!ticker) {
      return res.status(400).json({
        success: false,
        error: 'Ticker symbol is required',
        timestamp: new Date().toISOString()
      });
    }

    const normalizedTicker = ticker.toUpperCase();
    console.log(`📊 Fetching earnings analysis for: ${normalizedTicker}`);

    // Check cache first
    if (!refresh && cacheUtils.hasCachedItem('earnings-analysis', normalizedTicker)) {
      const cachedAnalysis = cacheUtils.getCachedItem('earnings-analysis', normalizedTicker);
      console.log(`📋 Serving cached analysis for ${normalizedTicker}`);
      return res.json({
        success: true,
        ticker: normalizedTicker,
        analysis: cachedAnalysis,
        source: 'cache',
        timestamp: new Date().toISOString()
      });
    }

    // Add random delay to avoid rate limiting
    await randomDelay(800, 2000);

    // Perform earnings analysis using free data sources
    const analysis = await earningsUtils.analyzeEarnings(normalizedTicker);
    
    // Cache the analysis for 2 hours
    cacheUtils.setCachedItem('earnings-analysis', normalizedTicker, analysis, 7200);
    
    console.log(`✅ Successfully generated analysis for ${normalizedTicker}`);
    
    res.json({
      success: true,
      ticker: normalizedTicker,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Error analyzing earnings for ${req.params.ticker}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze earnings data',
      message: error.message,
      ticker: req.params.ticker,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get basic company information using free FMP endpoints
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getCompanyInfo(req, res, next) {
  try {
    const { ticker } = req.params;

    if (!ticker) {
      return res.status(400).json({
        success: false,
        error: 'Ticker symbol is required',
        timestamp: new Date().toISOString()
      });
    }

    const normalizedTicker = ticker.toUpperCase();
    console.log(`🏢 Fetching company info for: ${normalizedTicker}`);

    // Check cache first
    if (cacheUtils.hasCachedItem('company-info', normalizedTicker)) {
      const cachedInfo = cacheUtils.getCachedItem('company-info', normalizedTicker);
      console.log(`📋 Serving cached company info for ${normalizedTicker}`);
      return res.json({
        success: true,
        ticker: normalizedTicker,
        data: cachedInfo,
        source: 'cache',
        timestamp: new Date().toISOString()
      });
    }

    // Add random delay
    await randomDelay(500, 1200);

    // Fetch company profile and basic financials
    const [profile, financials] = await Promise.all([
      earningsUtils.fetchCompanyProfile(normalizedTicker).catch(() => null),
      earningsUtils.fetchBasicFinancials(normalizedTicker).catch(() => null)
    ]);

    const companyInfo = {
      ticker: normalizedTicker,
      profile,
      financials,
      lastUpdated: new Date().toISOString()
    };

    // Cache for 4 hours
    cacheUtils.setCachedItem('company-info', normalizedTicker, companyInfo, 14400);
    
    console.log(`✅ Successfully fetched company info for ${normalizedTicker}`);
    
    res.json({
      success: true,
      ticker: normalizedTicker,
      data: companyInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Error fetching company info for ${req.params.ticker}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company information',
      message: error.message,
      ticker: req.params.ticker,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Health check endpoint for earnings service
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getEarningsHealth(req, res) {
  try {
    // Test basic functionality
    const testResult = await earningsUtils.fetchBasicFinancials('AAPL').catch(() => null);
    
    res.json({
      success: true,
      status: 'healthy',
      dataSources: {
        yahooFinance: 'active',
        fmpFreeTier: testResult ? 'active' : 'limited',
        cache: 'active'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'degraded',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get progress for a scraping operation
 * @param {string} sessionId - Session identifier
 * @returns {Object|null} Progress object or null
 */
function getProgress(sessionId) {
  return earningsUtils.getProgress(sessionId);
}

/**
 * Update progress for a scraping operation
 * @param {string} sessionId - Session identifier
 * @param {number} percent - Progress percentage
 * @param {string} message - Progress message
 * @param {string} currentDate - Current date being processed
 * @param {Array} results - Optional results array
 */
function updateProgress(sessionId, percent, message, currentDate = null, results = null) {
  return earningsUtils.updateProgress(sessionId, percent, message, currentDate, results);
}

/**
 * Scrape earnings calendar with optional progress tracking
 * @param {string} timeRange - Time range for scraping
 * @param {string} sessionId - Optional session ID for progress tracking
 * @returns {Promise<Array>} Array of earnings events
 */
async function scrapeEarningsCalendar(timeRange, sessionId = null) {
  return await earningsUtils.scrapeEarningsCalendar(timeRange, sessionId);
}

module.exports = {
  getUpcomingEarnings,
  getEarningsAnalysis,
  getCompanyInfo,
  getEarningsHealth,
  getProgress,
  updateProgress,
  scrapeEarningsCalendar
};
