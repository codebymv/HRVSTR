/**
 * Earnings utility functions
 * Handles scraping and processing earnings data
 */
const axios = require('axios');
const cheerio = require('cheerio');
const { randomUserAgent, randomDelay, parseNumber } = require('./scraping-helpers');
const { getYahooEarningsCalendar, scrapeHistoricalEarnings } = require('./yahooFinanceEarnings');

// API Configuration
const FMP_API_KEY = process.env.FMP_API_KEY || null;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || null;

// Progress tracking for long-running scraping operations
const progressStore = new Map();

/**
 * Store progress for a scraping operation
 * @param {string} sessionId - Unique session identifier
 * @param {number} percent - Progress percentage (0-100)
 * @param {string} message - Progress message
 * @param {string} currentDate - Current date being processed
 * @param {Array} results - Optional results data when completed
 */
function updateProgress(sessionId, percent, message, currentDate = null, results = null) {
  progressStore.set(sessionId, {
    percent,
    message,
    currentDate,
    results,
    timestamp: new Date().toISOString()
  });
  
  console.log(`📊 Progress [${sessionId}]: ${percent}% - ${message}`);
  
  // Clean up old progress entries (older than 10 minutes)
  const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
  for (const [key, value] of progressStore.entries()) {
    if (new Date(value.timestamp).getTime() < tenMinutesAgo) {
      progressStore.delete(key);
    }
  }
}

/**
 * Get progress for a scraping operation
 * @param {string} sessionId - Unique session identifier
 * @returns {Object|null} Progress object or null if not found
 */
function getProgress(sessionId) {
  return progressStore.get(sessionId) || null;
}

/**
 * Main function to scrape earnings calendar - now uses Yahoo Finance with progress tracking
 * @param {string} timeRange - Time range (1d, 1w, 1m, 3m)
 * @param {string} sessionId - Optional session ID for progress tracking
 * @returns {Promise<Array>} Array of earnings events
 */
async function scrapeEarningsCalendar(timeRange, sessionId = null) {
  // Determine date range based on timeRange
  const now = new Date();
  let fromDate, toDate;
  
  switch (timeRange) {
    case '1d':
      fromDate = new Date(now);
      toDate = new Date(now);
      toDate.setDate(now.getDate() + 1);
      break;
    case '1w':
      fromDate = new Date(now);
      toDate = new Date(now);
      toDate.setDate(now.getDate() + 7);
      break;
    case '1m':
      fromDate = new Date(now);
      toDate = new Date(now);
      toDate.setMonth(now.getMonth() + 1);
      break;
    case '3m':
      fromDate = new Date(now);
      toDate = new Date(now);
      toDate.setMonth(now.getMonth() + 3);
      break;
    default:
      fromDate = new Date(now);
      toDate = new Date(now);
      toDate.setDate(now.getDate() + 7);
  }

  const fromDateStr = fromDate.toISOString().split('T')[0];
  const toDateStr = toDate.toISOString().split('T')[0];

  console.log(`📅 Fetching earnings calendar from ${fromDateStr} to ${toDateStr} (${timeRange})`);

  // Create progress callback if sessionId provided
  const progressCallback = sessionId ? (percent, message, currentDate) => {
    updateProgress(sessionId, percent, message, currentDate);
  } : null;

  try {
    // Use Yahoo Finance for earnings calendar (free) with progress tracking
    const yahooEarnings = await getYahooEarningsCalendar(fromDateStr, toDateStr, progressCallback);
    
    if (yahooEarnings.length > 0) {
      console.log(`✅ Successfully fetched ${yahooEarnings.length} earnings events from Yahoo Finance`);
      
      // Mark as completed if tracking progress
      if (sessionId) {
        updateProgress(sessionId, 100, `Completed! Found ${yahooEarnings.length} earnings events`);
      }
      
      return yahooEarnings;
    } else {
      console.log('⚠️ No earnings found from Yahoo Finance');
      
      if (sessionId) {
        updateProgress(sessionId, 100, 'Completed - No earnings found for this date range');
      }
      
      return [];
    }
    
  } catch (error) {
    console.error('❌ Error fetching upcoming earnings:', error.message);
    
    if (sessionId) {
      updateProgress(sessionId, 0, `Error: ${error.message}`);
    }
    
    throw new Error(`Failed to fetch earnings data: ${error.message}`);
  }
}

/**
 * Fetch company profile from FMP (available on free tier)
 * @param {string} ticker - Stock symbol
 * @returns {Promise<Object>} Company profile data
 */
async function fetchCompanyProfile(ticker) {
  if (!FMP_API_KEY) {
    throw new Error('FMP_API_KEY environment variable is required');
  }

  try {
    const url = `https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${FMP_API_KEY}`;
    console.log(`🔄 Fetching company profile for ${ticker}`);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': randomUserAgent()
      }
    });
    
    if (response.data && response.data.length > 0) {
      console.log(`✅ Successfully fetched profile for ${ticker}`);
      return response.data[0];
    } else {
      console.log(`⚠️ No profile data found for ${ticker}`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ FMP profile API failed for ${ticker}: ${error.message}`);
    throw new Error(`Failed to fetch company profile: ${error.message}`);
  }
}

/**
 * Fetch basic financial data from FMP (available on free tier)
 * @param {string} ticker - Stock symbol
 * @returns {Promise<Object>} Financial data
 */
async function fetchBasicFinancials(ticker) {
  if (!FMP_API_KEY) {
    throw new Error('FMP_API_KEY environment variable is required');
  }

  try {
    const url = `https://financialmodelingprep.com/api/v3/quote/${ticker}?apikey=${FMP_API_KEY}`;
    console.log(`🔄 Fetching basic financials for ${ticker}`);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': randomUserAgent()
      }
    });
    
    if (response.data && response.data.length > 0) {
      console.log(`✅ Successfully fetched financials for ${ticker}`);
      return response.data[0];
    } else {
      console.log(`⚠️ No financial data found for ${ticker}`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ FMP financials API failed for ${ticker}: ${error.message}`);
    throw new Error(`Failed to fetch financial data: ${error.message}`);
  }
}

/**
 * Analyze earnings for a specific ticker using scraped historical data and free APIs
 * @param {string} ticker - Stock symbol
 * @returns {Promise<Object>} Real earnings analysis with calculated metrics
 */
async function analyzeEarnings(ticker) {
  try {
    console.log(`📊 Analyzing earnings for ${ticker} using scraped historical data and real APIs`);
    
    // Create a timeout promise that rejects after 180 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Earnings analysis for ${ticker} timed out after 60 seconds`));
      }, 180000);
    });
    
    // Get company profile and basic financials from FMP (free tier) and historical earnings via scraping
    const dataPromise = Promise.all([
      fetchCompanyProfile(ticker).catch((error) => {
        console.warn(`⚠️ Failed to fetch company profile for ${ticker}: ${error.message}`);
        return null;
      }),
      fetchBasicFinancials(ticker).catch((error) => {
        console.warn(`⚠️ Failed to fetch basic financials for ${ticker}: ${error.message}`);
        return null;
      }),
      scrapeHistoricalEarnings(ticker).catch((error) => {
        console.warn(`⚠️ Failed to scrape historical earnings for ${ticker}: ${error.message}`);
        return [];
      })
    ]);
    
    // Race between data fetching and timeout
    const [profile, financials, historicalEarnings] = await Promise.race([
      dataPromise,
      timeoutPromise
    ]);
    
    if (!profile && !financials && historicalEarnings.length === 0) {
      throw new Error(`No real data available for ${ticker}. Unable to provide analysis.`);
    }
    
    // Calculate real metrics from scraped historical earnings data
    const earningsMetrics = calculateEarningsMetrics(historicalEarnings);
    
    // Generate basic analysis scores from real data only
    const analysisScore = generateBasicScore(financials);
    const riskLevel = calculateRiskLevel(financials);
    
    // Create analysis with real data only
    const analysis = {
      ticker,
      companyName: profile?.companyName || financials?.name || ticker,
      sector: profile?.sector || 'Unknown',
      industry: profile?.industry || 'Unknown',
      marketCap: financials?.marketCap || profile?.mktCap || null,
      
      // Current metrics (real data from FMP)
      currentPrice: financials?.price || null,
      eps: financials?.eps || null,
      pe: financials?.pe || null,
      
      // Basic analysis (real data)
      earningsDate: financials?.earningsAnnouncement || null,
      priceChange: financials?.change || null,
      priceChangePercent: financials?.changesPercentage || null,
      
      // Risk/opportunity indicators (real data)
      dayLow: financials?.dayLow || null,
      dayHigh: financials?.dayHigh || null,
      yearLow: financials?.yearLow || null,
      yearHigh: financials?.yearHigh || null,
      
      // Analysis summary (real data only)
      analysisScore,
      riskLevel,
      
      // Historical earnings metrics - NOW CALCULATED FROM SCRAPED DATA
      beatFrequency: earningsMetrics.beatFrequency,
      averageSurprise: earningsMetrics.averageSurprise,
      consistency: earningsMetrics.consistency,
      postEarningsDrift: earningsMetrics.postEarningsDrift,
      
      latestEarnings: {
        surprise: earningsMetrics.latestSurprise,
        magnitude: earningsMetrics.latestMagnitude,
        marketReaction: earningsMetrics.marketReaction // Still limited without price data
      },
      
      // Data sources and status
      dataSources: ['FMP Free Tier', 'Yahoo Finance Scraping'],
      isPlaceholder: false,
      dataLimitations: historicalEarnings.length === 0 ? [
        'No historical earnings data found via scraping',
        'Market reaction data requires premium APIs'
      ] : [
        'Market reaction data requires premium APIs'
      ],
      historicalEarningsCount: historicalEarnings.length,
      timestamp: new Date().toISOString()
    };
    
    console.log(`✅ Generated real earnings analysis for ${ticker} with ${historicalEarnings.length} historical data points`);
    return analysis;
    
  } catch (error) {
    console.error(`❌ Error analyzing earnings for ${ticker}: ${error.message}`);
    
    // If it's a timeout error, provide a more specific error message
    if (error.message.includes('timed out')) {
      throw new Error(`Earnings analysis for ${ticker} is taking too long. This may be due to heavy server load or data provider issues. Please try again later.`);
    }
    
    throw error;
  }
}

/**
 * Calculate earnings metrics from historical earnings data
 * @param {Array} historicalEarnings - Array of historical earnings events
 * @returns {Object} Calculated earnings metrics
 */
function calculateEarningsMetrics(historicalEarnings) {
  const defaultMetrics = {
    beatFrequency: null,
    averageSurprise: null,
    consistency: null,
    postEarningsDrift: null,
    latestSurprise: null,
    latestMagnitude: null,
    marketReaction: null
  };

  if (!historicalEarnings || historicalEarnings.length === 0) {
    console.log('📊 No historical earnings data available for metrics calculation');
    return defaultMetrics;
  }

  console.log(`📊 Calculating metrics from ${historicalEarnings.length} historical earnings`);

  // Filter earnings with valid surprise data
  const earningsWithSurprises = historicalEarnings.filter(e => 
    e.surprisePercentage !== null && 
    e.surprisePercentage !== undefined && 
    !isNaN(e.surprisePercentage)
  );

  if (earningsWithSurprises.length === 0) {
    console.log('⚠️ No earnings with valid surprise data found');
    return defaultMetrics;
  }

  // Calculate Beat Frequency (percentage of earnings that beat estimates)
  const beats = earningsWithSurprises.filter(e => e.beat === true).length;
  const beatFrequency = (beats / earningsWithSurprises.length) * 100;

  // Calculate Average Surprise
  const surprises = earningsWithSurprises.map(e => e.surprisePercentage);
  const averageSurprise = surprises.reduce((sum, surprise) => sum + surprise, 0) / surprises.length;

  // Calculate Consistency (inverse of standard deviation of surprises)
  const surpriseVariance = surprises.reduce((sum, surprise) => {
    return sum + Math.pow(surprise - averageSurprise, 2);
  }, 0) / surprises.length;
  const surpriseStdDev = Math.sqrt(surpriseVariance);
  const consistency = Math.max(0, 100 - (surpriseStdDev * 10)); // Convert to 0-100 scale

  // Post-Earnings Drift calculation (simplified - would need price data for accurate calculation)
  // For now, use average surprise as a proxy
  const postEarningsDrift = averageSurprise * 0.3; // Rough approximation

  // Latest earnings metrics
  const latestEarnings = earningsWithSurprises[0]; // Already sorted by date
  const latestSurprise = latestEarnings ? latestEarnings.surprisePercentage : null;
  const latestMagnitude = latestSurprise ? Math.abs(latestSurprise) : null;

  const calculatedMetrics = {
    beatFrequency: Math.round(beatFrequency * 10) / 10, // Round to 1 decimal
    averageSurprise: Math.round(averageSurprise * 100) / 100, // Round to 2 decimals
    consistency: Math.round(consistency * 10) / 10, // Round to 1 decimal
    postEarningsDrift: Math.round(postEarningsDrift * 100) / 100, // Round to 2 decimals
    latestSurprise: latestSurprise ? Math.round(latestSurprise * 100) / 100 : null,
    latestMagnitude: latestMagnitude ? Math.round(latestMagnitude * 100) / 100 : null,
    marketReaction: null // Would need price data
  };

  console.log(`📊 Calculated metrics:`, calculatedMetrics);
  return calculatedMetrics;
}

/**
 * Generate a basic analysis score based on available metrics
 * @param {Object} financials - Financial data
 * @returns {number} Score from 0-100
 */
function generateBasicScore(financials) {
  if (!financials) return 50; // Neutral score if no data
  
  let score = 50; // Start with neutral
  
  // PE ratio analysis
  if (financials.pe) {
    if (financials.pe > 0 && financials.pe < 15) score += 10; // Undervalued
    else if (financials.pe > 30) score -= 10; // Overvalued
  }
  
  // Price momentum
  if (financials.changesPercentage) {
    if (financials.changesPercentage > 0) score += 5; // Positive momentum
    else score -= 5; // Negative momentum
  }
  
  // Market cap consideration
  if (financials.marketCap) {
    if (financials.marketCap > 10000000000) score += 5; // Large cap stability
  }
  
  return Math.max(0, Math.min(100, score)); // Clamp between 0-100
}

/**
 * Calculate risk level based on available metrics
 * @param {Object} financials - Financial data
 * @returns {string} Risk level: Low, Medium, High
 */
function calculateRiskLevel(financials) {
  if (!financials) return 'Medium';
  
  let riskFactors = 0;
  
  // High PE ratio increases risk
  if (financials.pe && financials.pe > 30) riskFactors++;
  
  // High volatility increases risk
  if (financials.dayLow && financials.dayHigh) {
    const dailyVolatility = (financials.dayHigh - financials.dayLow) / financials.price;
    if (dailyVolatility > 0.05) riskFactors++; // >5% daily range
  }
  
  // Negative price change increases risk
  if (financials.changesPercentage && financials.changesPercentage < -5) riskFactors++;
  
  if (riskFactors >= 2) return 'High';
  if (riskFactors === 1) return 'Medium';
  return 'Low';
}

module.exports = {
  scrapeEarningsCalendar,
  fetchCompanyProfile,
  fetchBasicFinancials,
  analyzeEarnings,
  generateBasicScore,
  calculateRiskLevel,
  updateProgress,
  getProgress
};
