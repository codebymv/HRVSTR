/**
 * Yahoo Finance Earnings Refactored - Main orchestrator for modular earnings scraping
 * 
 * This refactored version breaks down the monolithic yahooFinanceEarnings.js into
 * specialized components following single responsibility principle
 */

const { puppeteerManager } = require('../../utils/scrapers/puppeteerManager');
const { formatDateForUrl, generateDateRange, createDateIterator } = require('../../utils/processors/dateRangeProcessor');
const { batchValidateEarnings } = require('../../utils/validators/earningsValidator');

/**
 * Scrape Yahoo earnings calendar for a date range
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @param {Function} progressCallback - Progress callback function
 * @returns {Array} - Array of earnings data
 */
async function scrapeYahooEarningsCalendar(fromDate, toDate, progressCallback = null) {
  console.log(`[yahooFinanceEarningsRefactored] Starting earnings scrape from ${fromDate} to ${toDate}`);

  let page = null;
  const allEarnings = [];
  const errors = [];

  try {
    // Create page with earnings-specific configuration
    page = await puppeteerManager.createPage('earnings-scraper', {
      interceptRequests: true,
      timeout: 30000
    });

    // Generate date range
    const dateRange = generateDateRange(fromDate, toDate);
    if (!dateRange.success) {
      throw new Error(`Invalid date range: ${dateRange.error}`);
    }

    console.log(`[yahooFinanceEarningsRefactored] Processing ${dateRange.totalDays} days`);

    // Create date iterator for efficient processing
    const dateIterator = createDateIterator(fromDate, toDate, {
      businessDaysOnly: true,
      delayBetweenDates: 1000 // 1 second between requests
    });

    let processedDays = 0;

    // Process each date
    for await (const dateInfo of dateIterator) {
      try {
        const currentDate = dateInfo.date;
        processedDays++;

        // Progress callback
        if (progressCallback) {
          progressCallback({
            current: processedDays,
            total: dateRange.totalDays,
            date: currentDate,
            progress: Math.round((processedDays / dateRange.totalDays) * 100)
          });
        }

        console.log(`[yahooFinanceEarningsRefactored] Scraping date ${processedDays}/${dateRange.totalDays}: ${currentDate}`);

        // Scrape earnings for this date
        const dailyEarnings = await scrapeSingleDateEarnings(page, currentDate);
        
        if (dailyEarnings.length > 0) {
          allEarnings.push(...dailyEarnings);
          console.log(`[yahooFinanceEarningsRefactored] Found ${dailyEarnings.length} earnings for ${currentDate}`);
        }

      } catch (dateError) {
        console.error(`[yahooFinanceEarningsRefactored] Error processing date ${dateInfo.date}:`, dateError.message);
        errors.push(`Date ${dateInfo.date}: ${dateError.message}`);
      }
    }

    // Validate and clean results
    const validationResult = batchValidateEarnings(allEarnings);
    
    console.log(`[yahooFinanceEarningsRefactored] Scraping complete: ${validationResult.validCount} valid earnings found`);
    
    if (validationResult.errors.length > 0) {
      console.warn(`[yahooFinanceEarningsRefactored] Validation errors:`, validationResult.errors.slice(0, 5));
    }

    return validationResult.valid;

  } catch (error) {
    console.error('[yahooFinanceEarningsRefactored] Scraping failed:', error.message);
    throw error;
  } finally {
    if (page) {
      await puppeteerManager.closePage('earnings-scraper');
    }
  }
}

/**
 * Scrape earnings for a single date
 * @param {Page} page - Puppeteer page instance
 * @param {string} date - Date to scrape (YYYY-MM-DD)
 * @returns {Array} - Array of earnings for the date
 */
async function scrapeSingleDateEarnings(page, date) {
  const earnings = [];

  try {
    // Format URL for Yahoo Finance earnings calendar
    const formattedDate = formatDateForUrl(date);
    const url = `https://finance.yahoo.com/calendar/earnings?day=${formattedDate}`;

    // Navigate with retry logic
    await puppeteerManager.navigateWithRetry(page, url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
      retries: 3
    });

    // Wait for earnings content
    await puppeteerManager.waitForContent(page, {
      selectors: ['table', '[data-test*="earnings"]', '.earnings'],
      additionalDelay: 3000
    });

    // Extract earnings data from the page
    const extractedEarnings = await extractEarningsFromPage(page, date);
    earnings.push(...extractedEarnings);

    return earnings;

  } catch (error) {
    console.error(`[yahooFinanceEarningsRefactored] Error scraping ${date}:`, error.message);
    return [];
  }
}

/**
 * Extract earnings data from the current page
 * @param {Page} page - Puppeteer page instance
 * @param {string} date - Date context
 * @returns {Array} - Extracted earnings data
 */
async function extractEarningsFromPage(page, date) {
  try {
    // Multiple extraction strategies
    const strategies = [
      () => extractFromDataTestTable(page, date),
      () => extractFromGenericTable(page, date),
      () => extractFromTextPatterns(page, date)
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result && result.length > 0) {
          console.log(`[yahooFinanceEarningsRefactored] Extraction strategy found ${result.length} earnings`);
          return result;
        }
      } catch (strategyError) {
        console.warn(`[yahooFinanceEarningsRefactored] Extraction strategy failed:`, strategyError.message);
      }
    }

    return [];

  } catch (error) {
    console.error(`[yahooFinanceEarningsRefactored] Page extraction failed:`, error.message);
    return [];
  }
}

/**
 * Extract from data-test attributes table
 * @param {Page} page - Puppeteer page instance
 * @param {string} date - Date context
 * @returns {Array} - Extracted earnings
 */
async function extractFromDataTestTable(page, date) {
  return await page.evaluate((dateContext) => {
    const earnings = [];
    
    // Look for earnings table with data-test attributes
    const table = document.querySelector('table[data-test*="earnings"]') || 
                  document.querySelector('[data-test*="earnings"] table') ||
                  document.querySelector('table');
    
    if (!table) return earnings;

    const rows = Array.from(table.querySelectorAll('tr'));
    
    for (let i = 1; i < rows.length; i++) { // Skip header
      const cells = Array.from(rows[i].querySelectorAll('td, th'));
      
      if (cells.length >= 3) {
        const rowData = cells.map(cell => cell.textContent?.trim() || '');
        
        // Basic parsing - adjust based on Yahoo's current structure
        if (rowData[0] && rowData[0].match(/^[A-Z]{1,5}$/)) {
          earnings.push({
            symbol: rowData[0],
            companyName: rowData[1] || null,
            estimatedEPS: parseFloat(rowData[2]) || null,
            actualEPS: parseFloat(rowData[3]) || null,
            surprisePercentage: parseFloat(rowData[4]) || null,
            time: rowData[5] || 'Unknown',
            reportDate: dateContext,
            source: 'Yahoo Finance',
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    return earnings;
  }, date);
}

/**
 * Extract from generic table
 * @param {Page} page - Puppeteer page instance
 * @param {string} date - Date context
 * @returns {Array} - Extracted earnings
 */
async function extractFromGenericTable(page, date) {
  return await page.evaluate((dateContext) => {
    const earnings = [];
    const tables = document.querySelectorAll('table');
    
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr'));
      
      if (rows.length > 1) {
        for (let i = 1; i < rows.length; i++) {
          const cells = Array.from(rows[i].querySelectorAll('td, th'));
          const rowData = cells.map(cell => cell.textContent?.trim() || '');
          
          // Look for ticker pattern in first few columns
          for (let j = 0; j < Math.min(3, rowData.length); j++) {
            if (rowData[j] && rowData[j].match(/^[A-Z]{1,5}$/)) {
              earnings.push({
                symbol: rowData[j],
                companyName: rowData[j + 1] || null,
                estimatedEPS: null,
                actualEPS: null,
                surprisePercentage: null,
                time: 'Unknown',
                reportDate: dateContext,
                source: 'Yahoo Finance (Generic)',
                timestamp: new Date().toISOString()
              });
              break;
            }
          }
        }
      }
    }

    return earnings;
  }, date);
}

/**
 * Extract from text patterns (fallback)
 * @param {Page} page - Puppeteer page instance
 * @param {string} date - Date context
 * @returns {Array} - Extracted earnings
 */
async function extractFromTextPatterns(page, date) {
  return await page.evaluate((dateContext) => {
    const earnings = [];
    const text = document.body.textContent || '';
    
    // Extract ticker symbols using regex
    const tickerPattern = /\b[A-Z]{1,5}\b/g;
    const matches = [...new Set(text.match(tickerPattern) || [])];
    
    // Filter out common false positives
    const excludePatterns = /^(THE|AND|FOR|WITH|FROM|TO|OF|IN|ON|AT|BY|AS|IS|OR|BUT|NOT|ALL|ANY|NEW|OLD|GET|SET|YES|NO|SEE|USE|ADD|TRY|RUN)$/;
    
    const validTickers = matches.filter(ticker => 
      ticker.length >= 1 && 
      ticker.length <= 5 && 
      !excludePatterns.test(ticker)
    );

    validTickers.forEach(ticker => {
      earnings.push({
        symbol: ticker,
        companyName: null,
        estimatedEPS: null,
        actualEPS: null,
        surprisePercentage: null,
        time: 'Unknown',
        reportDate: dateContext,
        source: 'Yahoo Finance (Text Pattern)',
        timestamp: new Date().toISOString(),
        note: 'Extracted using text pattern matching - verify accuracy'
      });
    });

    return earnings.slice(0, 50); // Limit to prevent spam
  }, date);
}

/**
 * Scrape today's earnings (convenience function)
 * @param {Function} progressCallback - Progress callback function
 * @returns {Array} - Today's earnings data
 */
async function scrapeTodayEarnings(progressCallback = null) {
  const today = new Date().toISOString().split('T')[0];
  return await scrapeYahooEarningsCalendar(today, today, progressCallback);
}

/**
 * Get earnings calendar for a specific date
 * @param {string} targetDate - Date to get earnings for (YYYY-MM-DD)
 * @returns {Array} - Earnings data for the date
 */
async function getYahooEarningsCalendar(targetDate) {
  const formattedDate = formatDateForUrl(targetDate);
  return await scrapeYahooEarningsCalendar(formattedDate, formattedDate);
}

/**
 * Scrape historical earnings data
 * @param {string} fromDate - Start date
 * @param {string} toDate - End date
 * @param {Function} progressCallback - Progress callback
 * @returns {Array} - Historical earnings data
 */
async function scrapeHistoricalEarnings(fromDate, toDate, progressCallback = null) {
  console.log(`[yahooFinanceEarningsRefactored] Scraping historical earnings from ${fromDate} to ${toDate}`);
  
  return await scrapeYahooEarningsCalendar(fromDate, toDate, progressCallback);
}

// Maintain backward compatibility - export same functions as original
module.exports = {
  // Main functions (same as original)
  scrapeYahooEarningsCalendar,
  scrapeTodayEarnings,
  getYahooEarningsCalendar,
  scrapeHistoricalEarnings,
  
  // New modular functions
  scrapeSingleDateEarnings,
  extractEarningsFromPage,
  extractFromDataTestTable,
  extractFromGenericTable,
  extractFromTextPatterns
}; 