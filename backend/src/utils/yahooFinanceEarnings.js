const puppeteer = require('puppeteer');

/**
 * Scrape real earnings calendar data from Yahoo Finance
 * @param {string} fromDate - Start date in YYYY-MM-DD format
 * @param {string} toDate - End date in YYYY-MM-DD format
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Array>} Array of real earnings events
 */
async function scrapeYahooEarningsCalendar(fromDate, toDate, progressCallback = null) {
  let browser;
  try {
    console.log(`📅 Scraping Yahoo Finance earnings calendar from ${fromDate} to ${toDate}`);
    
    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    const earnings = [];
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    
    // Calculate total days for progress tracking
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    let currentDay = 0;
    
    // Scrape each day in the date range
    for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
      const dateStr = currentDate.toISOString().split('T')[0];
      currentDay++;
      
      // Report progress
      if (progressCallback) {
        const progressPercent = Math.round((currentDay / totalDays) * 100);
        progressCallback(progressPercent, `Scraping earnings for ${dateStr} (${currentDay}/${totalDays} days)`, dateStr);
      }
      
      try {
        console.log(`🔍 Scraping earnings for ${dateStr} (${currentDay}/${totalDays})`);
        
        // Navigate to Yahoo Finance earnings calendar for specific date
        const url = `https://finance.yahoo.com/calendar/earnings?day=${dateStr}`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for page to fully load - INCREASED WAIT TIME for dynamic content
        await new Promise(resolve => setTimeout(resolve, 10000)); // Increased from 5s to 10s
        
        // Try to wait for any potential dynamic content with more specific selectors
        try {
          await page.waitForSelector('table', { timeout: 30000 }); // Increased timeout
        } catch (e) {
          console.log(`📊 No tables found initially, continuing with analysis...`);
        }
        
        // ADDITIONAL WAIT: Try to wait for earnings-specific content
        try {
          await page.waitForSelector('[data-test*="earnings"], [data-testid*="earnings"], .earnings, [aria-label*="earnings"]', { timeout: 15000 });
          console.log(`✅ Found earnings-specific elements!`);
        } catch (e) {
          console.log(`📊 No earnings-specific elements found, proceeding with general analysis...`);
        }
        
        // Extract earnings data from the table
        const dayEarnings = await page.evaluate(() => {
          const rows = document.querySelectorAll('table tbody tr');
          const earnings = [];
          
          rows.forEach((row, index) => {
            try {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 5) {
                // Extract raw data from cells
                const rawTicker = cells[0]?.textContent?.trim();
                const rawCompanyName = cells[1]?.textContent?.trim();
                const earningsTime = cells[2]?.textContent?.trim();
                const epsEstimate = cells[3]?.textContent?.trim();
                const reportedEPS = cells[4]?.textContent?.trim();
                
                // Enhanced validation - check for valid ticker first
                if (!rawTicker || 
                    typeof rawTicker !== 'string' || 
                    rawTicker === '' ||
                    rawTicker === 'Symbol' || 
                    rawTicker === 'N/A' || 
                    rawTicker === '-' ||
                    rawTicker.toLowerCase() === 'symbol' ||
                    rawTicker.length > 10 ||
                    rawTicker.length < 1) {
                  console.log(`⚠️ Skipping row ${index}: invalid ticker "${rawTicker}"`);
                  return; // Skip this row
                }
                
                // Enhanced company name validation
                if (!rawCompanyName || 
                    typeof rawCompanyName !== 'string' || 
                    rawCompanyName === '' ||
                    rawCompanyName === 'Company' ||
                    rawCompanyName === 'N/A' ||
                    rawCompanyName.toLowerCase() === 'company') {
                  console.log(`⚠️ Skipping row ${index}: invalid company "${rawCompanyName}" for ticker "${rawTicker}"`);
                  return; // Skip this row
                }
                
                // Strict ticker pattern validation
                const tickerRegex = /^[A-Z]{1,10}(\.[A-Z]{1,3})?$/i;
                if (!tickerRegex.test(rawTicker)) {
                  console.log(`⚠️ Skipping row ${index}: ticker "${rawTicker}" doesn't match expected pattern`);
                  return; // Skip this row
                }
                
                // Normalize ticker to uppercase and trim
                const normalizedTicker = rawTicker.toUpperCase().trim();
                const normalizedCompanyName = rawCompanyName.trim();
                
                // Final validation before adding
                if (normalizedTicker && 
                    normalizedTicker.length >= 1 && 
                    normalizedTicker.length <= 10 &&
                    normalizedCompanyName && 
                    normalizedCompanyName.length >= 1) {
                  
                  // Create earnings object with consistent field names
                  const earningsObject = {
                    symbol: normalizedTicker,
                    ticker: normalizedTicker, // Add both fields for consistency
                    companyName: normalizedCompanyName,
                    time: earningsTime || 'Unknown',
                    estimatedEPS: epsEstimate && epsEstimate !== '-' ? parseFloat(epsEstimate) : null,
                    actualEPS: reportedEPS && reportedEPS !== '-' ? parseFloat(reportedEPS) : null,
                    source: 'Yahoo Finance'
                  };
                  
                  // Double-check the object before adding
                  if (earningsObject.symbol && earningsObject.ticker && earningsObject.companyName) {
                    earnings.push(earningsObject);
                    console.log(`✅ Added earnings: ${normalizedTicker} - ${normalizedCompanyName}`);
                  } else {
                    console.log(`❌ Failed final validation for row ${index}: ${JSON.stringify(earningsObject)}`);
                  }
                } else {
                  console.log(`❌ Failed normalization validation for row ${index}: ticker="${normalizedTicker}", company="${normalizedCompanyName}"`);
                }
              } else {
                console.log(`⚠️ Skipping row ${index}: insufficient cells (${cells.length})`);
              }
            } catch (rowError) {
              console.log(`❌ Error parsing row ${index}:`, rowError.message);
            }
          });
          
          return earnings;
        });
        
        // Server-side validation of the scraped data
        const validatedDayEarnings = dayEarnings.filter((earning, index) => {
          // Comprehensive validation on the server side
          if (!earning.symbol || 
              !earning.ticker ||
              !earning.companyName ||
              typeof earning.symbol !== 'string' ||
              typeof earning.ticker !== 'string' ||
              typeof earning.companyName !== 'string' ||
              earning.symbol.trim() === '' ||
              earning.ticker.trim() === '' ||
              earning.companyName.trim() === '') {
            
            console.warn(`🚨 SERVER VALIDATION: Filtering out invalid earning at index ${index}:`, {
              symbol: earning.symbol,
              ticker: earning.ticker,
              companyName: earning.companyName,
              types: {
                symbol: typeof earning.symbol,
                ticker: typeof earning.ticker,
                companyName: typeof earning.companyName
              }
            });
            return false;
          }
          return true;
        });
        
        if (validatedDayEarnings.length !== dayEarnings.length) {
          console.log(`🔍 SERVER VALIDATION: Filtered ${dayEarnings.length - validatedDayEarnings.length} invalid earnings from day ${dateStr}`);
        }
        
        // Add date to each earnings event and add to main array
        validatedDayEarnings.forEach(earning => {
          earnings.push({
            ...earning,
            date: dateStr,
            reportDate: dateStr, // Add both field names for consistency
            estimatedRevenue: null,
            actualRevenue: null,
            marketCap: null,
            sector: 'Unknown',
            industry: 'Unknown',
            lastUpdated: new Date().toISOString()
          });
        });
        
        console.log(`✅ Found ${validatedDayEarnings.length} valid earnings for ${dateStr} (filtered from ${dayEarnings.length} raw results)`);
        
        // Update progress with success
        if (progressCallback) {
          const progressPercent = Math.round((currentDay / totalDays) * 100);
          progressCallback(progressPercent, `Found ${validatedDayEarnings.length} earnings for ${dateStr} (${currentDay}/${totalDays} days)`, dateStr);
        }
        
        // Add delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (dayError) {
        console.log(`⚠️ Failed to scrape earnings for ${dateStr}: ${dayError.message}`);
        
        // Update progress with failure
        if (progressCallback) {
          const progressPercent = Math.round((currentDay / totalDays) * 100);
          progressCallback(progressPercent, `Failed to scrape ${dateStr} (${currentDay}/${totalDays} days) - ${dayError.message}`, dateStr);
        }
      }
    }
    
    console.log(`✅ Successfully scraped ${earnings.length} real earnings events from Yahoo Finance`);
    
    // Final validation - filter out any items with invalid ticker symbols
    const validEarnings = earnings.filter(earning => {
      if (!earning.symbol || typeof earning.symbol !== 'string' || earning.symbol.trim() === '') {
        console.warn(`🚨 Filtering out invalid earning with ticker: "${earning.symbol}"`);
        return false;
      }
      return true;
    });
    
    if (validEarnings.length !== earnings.length) {
      console.log(`🔍 Filtered ${earnings.length - validEarnings.length} invalid earnings, ${validEarnings.length} valid earnings remaining`);
    }
    
    return validEarnings;
    
  } catch (error) {
    console.error('❌ Yahoo Finance earnings scraping failed:', error.message);
    throw new Error(`Failed to scrape Yahoo Finance: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Scrape earnings for today only (faster for testing)
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of earnings events for today
 */
async function scrapeTodayEarnings(date = null) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  let browser;
  try {
    console.log(`📅 Scraping Yahoo Finance earnings for ${targetDate}`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    const url = `https://finance.yahoo.com/calendar/earnings?day=${targetDate}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for table and extract data
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    const earnings = await page.evaluate((dateStr) => {
      const rows = document.querySelectorAll('table tbody tr');
      const results = [];
      
      rows.forEach((row, index) => {
        try {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 4) {
            // Extract raw data from cells
            const rawTicker = cells[0]?.textContent?.trim();
            const rawCompanyName = cells[1]?.textContent?.trim();
            const earningsTime = cells[2]?.textContent?.trim();
            const epsEstimate = cells[3]?.textContent?.trim();
            const reportedEPS = cells[4]?.textContent?.trim();
            
            // Enhanced validation - check for valid ticker first
            if (!rawTicker || 
                typeof rawTicker !== 'string' || 
                rawTicker === '' ||
                rawTicker === 'Symbol' || 
                rawTicker === 'N/A' || 
                rawTicker === '-' ||
                rawTicker.toLowerCase() === 'symbol' ||
                rawTicker.length > 10 ||
                rawTicker.length < 1) {
              console.log(`⚠️ Skipping row ${index}: invalid ticker "${rawTicker}"`);
              return; // Skip this row
            }
            
            // Enhanced company name validation
            if (!rawCompanyName || 
                typeof rawCompanyName !== 'string' || 
                rawCompanyName === '' ||
                rawCompanyName === 'Company' ||
                rawCompanyName === 'N/A' ||
                rawCompanyName.toLowerCase() === 'company') {
              console.log(`⚠️ Skipping row ${index}: invalid company "${rawCompanyName}" for ticker "${rawTicker}"`);
              return; // Skip this row
            }
            
            // Strict ticker pattern validation
            const tickerRegex = /^[A-Z]{1,10}(\.[A-Z]{1,3})?$/i;
            if (!tickerRegex.test(rawTicker)) {
              console.log(`⚠️ Skipping row ${index}: ticker "${rawTicker}" doesn't match expected pattern`);
              return; // Skip this row
            }
            
            // Normalize ticker to uppercase and trim
            const normalizedTicker = rawTicker.toUpperCase().trim();
            const normalizedCompanyName = rawCompanyName.trim();
            
            // Final validation before adding
            if (normalizedTicker && 
                normalizedTicker.length >= 1 && 
                normalizedTicker.length <= 10 &&
                normalizedCompanyName && 
                normalizedCompanyName.length >= 1) {
              
              // Create earnings object with consistent field names
              const earningsObject = {
                symbol: normalizedTicker,
                ticker: normalizedTicker, // Add both fields for consistency
                companyName: normalizedCompanyName || normalizedTicker,
                date: dateStr,
                reportDate: dateStr, // Add both field names for consistency
                time: earningsTime || 'Unknown',
                estimatedEPS: epsEstimate && epsEstimate !== '-' ? parseFloat(epsEstimate) : null,
                actualEPS: reportedEPS && reportedEPS !== '-' ? parseFloat(reportedEPS) : null,
                estimatedRevenue: null,
                actualRevenue: null,
                source: 'Yahoo Finance',
                lastUpdated: new Date().toISOString()
              };
              
              // Double-check the object before adding
              if (earningsObject.symbol && earningsObject.ticker && earningsObject.companyName) {
                results.push(earningsObject);
                console.log(`✅ Added earnings: ${normalizedTicker} - ${normalizedCompanyName}`);
              } else {
                console.log(`❌ Failed final validation for row ${index}: ${JSON.stringify(earningsObject)}`);
              }
            } else {
              console.log(`❌ Failed normalization validation for row ${index}: ticker="${normalizedTicker}", company="${normalizedCompanyName}"`);
            }
          } else {
            console.log(`⚠️ Skipping row ${index}: insufficient cells (${cells.length})`);
          }
        } catch (rowError) {
          console.log(`❌ Error parsing row ${index}:`, rowError.message);
        }
      });
      
      return results;
    }, targetDate);
    
    console.log(`✅ Found ${earnings.length} raw earnings for ${targetDate}`);
    
    // Server-side validation of the scraped data
    const validatedEarnings = earnings.filter((earning, index) => {
      // Comprehensive validation on the server side
      if (!earning.symbol || 
          !earning.ticker ||
          !earning.companyName ||
          typeof earning.symbol !== 'string' ||
          typeof earning.ticker !== 'string' ||
          typeof earning.companyName !== 'string' ||
          earning.symbol.trim() === '' ||
          earning.ticker.trim() === '' ||
          earning.companyName.trim() === '') {
        
        console.warn(`🚨 TODAY SERVER VALIDATION: Filtering out invalid earning at index ${index}:`, {
          symbol: earning.symbol,
          ticker: earning.ticker,
          companyName: earning.companyName,
          types: {
            symbol: typeof earning.symbol,
            ticker: typeof earning.ticker,
            companyName: typeof earning.companyName
          }
        });
        return false;
      }
      return true;
    });
    
    if (validatedEarnings.length !== earnings.length) {
      console.log(`🔍 TODAY SERVER VALIDATION: Filtered ${earnings.length - validatedEarnings.length} invalid earnings, ${validatedEarnings.length} valid earnings remaining`);
    }
    
    console.log(`✅ Final result: ${validatedEarnings.length} valid earnings for ${targetDate}`);
    
    return validatedEarnings;
    
  } catch (error) {
    console.error(`❌ Failed to scrape earnings for ${targetDate}:`, error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Get real earnings calendar using Yahoo Finance scraping
 * @param {string} fromDate - Start date in YYYY-MM-DD format  
 * @param {string} toDate - End date in YYYY-MM-DD format
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Array>} Real earnings data or empty array
 */
async function getYahooEarningsCalendar(fromDate, toDate, progressCallback = null) {
  try {
    // For date ranges > 7 days, limit to prevent long scraping times
    const daysDiff = Math.ceil((new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 7) {
      console.log(`⚠️ Date range too large (${daysDiff} days), limiting to 7 days from start date`);
      const limitedEndDate = new Date(fromDate);
      limitedEndDate.setDate(limitedEndDate.getDate() + 6);
      toDate = limitedEndDate.toISOString().split('T')[0];
    }
    
    // Use the full scraper with progress tracking
    const earnings = await scrapeYahooEarningsCalendar(fromDate, toDate, progressCallback);
    
    if (earnings.length === 0) {
      console.log('⚠️ No real earnings found, returning empty array (no mock data)');
      return [];
    }
    
    return earnings;
    
  } catch (error) {
    console.error('❌ Yahoo Finance scraping failed:', error.message);
    console.log('🚫 No fallback data - returning empty array');
    return [];
  }
}

/**
 * Enhanced historical earnings scraper with comprehensive debugging and multiple strategies
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Array>} Array of historical earnings data
 */
async function scrapeHistoricalEarnings(ticker) {
  let browser;
  try {
    console.log(`📊 ENHANCED SCRAPING: Starting comprehensive historical earnings scrape for ${ticker}`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set realistic browser properties
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Enable console logging from the page
    page.on('console', msg => {
      if (msg.type() === 'log') {
        console.log(`🌐 PAGE LOG: ${msg.text()}`);
      }
    });
    
    // Try multiple URL variations for Yahoo Finance earnings
    const urlVariations = [
      `https://finance.yahoo.com/quote/${ticker}/earnings`,
      `https://finance.yahoo.com/quote/${ticker}/earnings-history`,
      `https://finance.yahoo.com/quote/${ticker}/financials`,
      `https://finance.yahoo.com/quote/${ticker}`
    ];
    
    let earnings = [];
    let successfulUrl = null;
    
    for (const url of urlVariations) {
      try {
        console.log(`🔍 TRYING URL: ${url}`);
        
        await page.goto(url, { 
          waitUntil: 'networkidle2', 
          timeout: 45000 
        });
        
        // Wait for page to fully load - using Promise instead of waitForTimeout for compatibility
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try to wait for any potential dynamic content
        try {
          await page.waitForSelector('table', { timeout: 15000 });
        } catch (e) {
          console.log(`📊 No tables found initially, continuing with analysis...`);
        }
        
        // Comprehensive page analysis
        const pageAnalysis = await page.evaluate((tickerSymbol) => {
          console.log(`🔍 Starting comprehensive page analysis for ${tickerSymbol}`);
          
          const analysis = {
            url: window.location.href,
            title: document.title,
            tableCount: 0,
            tableAnalysis: [],
            earningsKeywords: [],
            potentialEarningsElements: [],
            allText: '',
            earnings: []
          };
          
          // Analyze all tables on the page
          const tables = document.querySelectorAll('table');
          analysis.tableCount = tables.length;
          console.log(`📊 Found ${tables.length} tables on page`);
          
          tables.forEach((table, tableIndex) => {
            const tableText = table.textContent.toLowerCase();
            const tableHTML = table.outerHTML.substring(0, 500); // First 500 chars
            
            const tableInfo = {
              index: tableIndex,
              rowCount: table.querySelectorAll('tr').length,
              cellCount: table.querySelectorAll('td').length,
              hasEarningsKeywords: false,
              keywords: [],
              sampleText: tableText.substring(0, 200),
              sampleHTML: tableHTML,
              rawTableData: [] // Add this to capture actual table content
            };
            
            // Capture raw table data for debugging
            const rows = table.querySelectorAll('tr');
            rows.forEach((row, rowIdx) => {
              if (rowIdx < 5) { // Only capture first 5 rows to avoid overwhelming logs
                const cells = row.querySelectorAll('td, th');
                const rowData = Array.from(cells).map(cell => cell.textContent.trim()).slice(0, 8); // Max 8 cells
                if (rowData.length > 0) {
                  tableInfo.rawTableData.push(`Row ${rowIdx}: [${rowData.join(' | ')}]`);
                }
              }
            });
            
            // Check for earnings-related keywords - EXPANDED LIST
            const earningsKeywords = [
              'earnings date', 'eps estimate', 'eps actual', 'surprise', 
              'reported', 'estimate', 'actual', 'quarter', 'fiscal',
              'earnings history', 'quarterly results', 'financial results',
              // Add more variations
              'earning', 'eps', 'per share', 'quarterly', 'annual',
              'q1', 'q2', 'q3', 'q4', 'fy', 'ttm', 'consensus',
              'beat', 'miss', 'revenue', 'sales', 'income',
              'year ago', 'prior year', 'same quarter', 'guidance'
            ];
            
            earningsKeywords.forEach(keyword => {
              if (tableText.includes(keyword)) {
                tableInfo.hasEarningsKeywords = true;
                tableInfo.keywords.push(keyword);
                analysis.earningsKeywords.push(`Table ${tableIndex}: ${keyword}`);
              }
            });
            
            analysis.tableAnalysis.push(tableInfo);
            
            // If this table seems earnings-related, try to parse it
            if (tableInfo.hasEarningsKeywords && tableInfo.rowCount > 1) {
              console.log(`📋 Analyzing earnings-candidate table ${tableIndex} with ${tableInfo.rowCount} rows`);
              
              const rows = table.querySelectorAll('tbody tr, tr');
              
              rows.forEach((row, rowIndex) => {
                try {
                  const cells = row.querySelectorAll('td, th');
                  
                  if (cells.length >= 3) {
                    const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
                    console.log(`📋 Row ${rowIndex} data:`, cellTexts);
                    
                    // Try multiple parsing strategies
                    const strategies = [
                      // Strategy 1: Date, Estimate, Actual, Surprise
                      { dateIndex: 0, estimateIndex: 1, actualIndex: 2, surpriseIndex: 3 },
                      // Strategy 2: Quarter, Date, Estimate, Actual, Surprise
                      { dateIndex: 1, estimateIndex: 2, actualIndex: 3, surpriseIndex: 4 },
                      // Strategy 3: Date, Estimate, Actual (no surprise)
                      { dateIndex: 0, estimateIndex: 1, actualIndex: 2, surpriseIndex: -1 },
                      // Strategy 4: Reverse order
                      { dateIndex: cellTexts.length - 4, estimateIndex: cellTexts.length - 3, actualIndex: cellTexts.length - 2, surpriseIndex: cellTexts.length - 1 }
                    ];
                    
                    for (const strategy of strategies) {
                      if (strategy.dateIndex >= 0 && strategy.dateIndex < cellTexts.length &&
                          strategy.estimateIndex >= 0 && strategy.estimateIndex < cellTexts.length &&
                          strategy.actualIndex >= 0 && strategy.actualIndex < cellTexts.length) {
                        
                        const dateText = cellTexts[strategy.dateIndex];
                        const estimateText = cellTexts[strategy.estimateIndex];
                        const actualText = cellTexts[strategy.actualIndex];
                        const surpriseText = strategy.surpriseIndex >= 0 ? cellTexts[strategy.surpriseIndex] : null;
                        
                        // Enhanced parsing functions
                        const parseEPS = (text) => {
                          if (!text || text === '-' || text === 'N/A' || text === '--') return null;
                          
                          // Remove all non-numeric characters except decimal point and minus
                          const cleaned = text.replace(/[^-0-9.]/g, '');
                          if (cleaned === '' || cleaned === '-') return null;
                          
                          const parsed = parseFloat(cleaned);
                          return isNaN(parsed) ? null : parsed;
                        };
                        
                        const parseSurprise = (text) => {
                          if (!text || text === '-' || text === 'N/A' || text === '--') return null;
                          
                          // Handle percentage format
                          let cleaned = text.replace(/[^-0-9.]/g, '');
                          if (cleaned === '' || cleaned === '-') return null;
                          
                          const parsed = parseFloat(cleaned);
                          return isNaN(parsed) ? null : parsed;
                        };
                        
                        const parseDate = (text) => {
                          if (!text) return null;
                          
                          // Try various date formats
                          const date = new Date(text);
                          return isNaN(date.getTime()) ? null : date;
                        };
                        
                        const earningsDate = parseDate(dateText);
                        const epsEstimate = parseEPS(estimateText);
                        const epsActual = parseEPS(actualText);
                        const surprisePercent = parseSurprise(surpriseText);
                        
                        // Check if this looks like valid earnings data
                        if (earningsDate && (epsEstimate !== null || epsActual !== null)) {
                          const earningsEvent = {
                            ticker: tickerSymbol,
                            reportDate: earningsDate.toISOString(),
                            estimatedEPS: epsEstimate,
                            actualEPS: epsActual,
                            surprisePercentage: surprisePercent,
                            beat: (epsActual !== null && epsEstimate !== null) ? epsActual > epsEstimate : null,
                            source: 'Yahoo Finance Historical Enhanced',
                            timestamp: new Date().toISOString(),
                            parsingStrategy: `Table ${tableIndex}, Strategy ${strategies.indexOf(strategy)}`,
                            rawData: {
                              dateText,
                              estimateText,
                              actualText,
                              surpriseText,
                              allCells: cellTexts
                            }
                          };
                          
                          // Avoid duplicates
                          const isDuplicate = analysis.earnings.some(existing => 
                            existing.reportDate === earningsEvent.reportDate &&
                            existing.estimatedEPS === earningsEvent.estimatedEPS &&
                            existing.actualEPS === earningsEvent.actualEPS
                          );
                          
                          if (!isDuplicate) {
                            analysis.earnings.push(earningsEvent);
                            console.log(`✅ PARSED EARNINGS: ${tickerSymbol} ${dateText} - Est: ${epsEstimate}, Actual: ${epsActual}, Surprise: ${surprisePercent}%`);
                          }
                          
                          break; // Stop trying strategies for this row
                        }
                      }
                    }
                  }
                } catch (rowError) {
                  console.log(`❌ Error parsing row ${rowIndex}:`, rowError.message);
                }
              });
            }
          });
          
          // Additional search strategies
          console.log(`🔍 Trying additional element searches...`);
          
          // Look for specific Yahoo Finance earnings elements
          const potentialSelectors = [
            '[data-test="earnings-history"]',
            '[data-testid="earnings-history"]',
            '.earnings-history',
            '.quarterly-earnings',
            '.financial-table',
            '[data-module="EarningsHistory"]',
            '[data-reactid*="earnings"]'
          ];
          
          potentialSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              console.log(`🎯 Found ${elements.length} elements with selector: ${selector}`);
              analysis.potentialEarningsElements.push({
                selector,
                count: elements.length,
                sampleHTML: elements[0].outerHTML.substring(0, 300)
              });
            }
          });
          
          // Capture page text for analysis
          analysis.allText = document.body.textContent.toLowerCase().substring(0, 2000);
          
          console.log(`📊 ANALYSIS COMPLETE: Found ${analysis.earnings.length} earnings events`);
          return analysis;
          
        }, ticker);
        
        console.log(`📊 PAGE ANALYSIS RESULTS for ${url}:`);
        console.log(`   - Title: ${pageAnalysis.title}`);
        console.log(`   - Tables found: ${pageAnalysis.tableCount}`);
        console.log(`   - Earnings keywords: ${pageAnalysis.earningsKeywords.length}`);
        console.log(`   - Potential earnings elements: ${pageAnalysis.potentialEarningsElements.length}`);
        console.log(`   - Parsed earnings: ${pageAnalysis.earnings.length}`);
        
        if (pageAnalysis.earnings.length > 0) {
          earnings = pageAnalysis.earnings;
          successfulUrl = url;
          console.log(`✅ SUCCESS: Found ${earnings.length} earnings events from ${url}`);
          break; // Stop trying URLs if we found data
        }
        
        // If no earnings found, log detailed analysis
        if (pageAnalysis.tableAnalysis.length > 0) {
          console.log(`📋 TABLE ANALYSIS DETAILS:`);
          pageAnalysis.tableAnalysis.forEach((table, index) => {
            console.log(`   Table ${index}: ${table.rowCount} rows, ${table.cellCount} cells, Keywords: [${table.keywords.join(', ')}]`);
            if (table.hasEarningsKeywords) {
              console.log(`      Sample text: ${table.sampleText}`);
            }
            // ENHANCED: Show raw table data for debugging
            if (table.rawTableData && table.rawTableData.length > 0) {
              console.log(`      📊 RAW TABLE CONTENT:`);
              table.rawTableData.forEach(rowData => {
                console.log(`         ${rowData}`);
              });
            }
          });
        }
        
        if (pageAnalysis.potentialEarningsElements.length > 0) {
          console.log(`🎯 POTENTIAL EARNINGS ELEMENTS:`);
          pageAnalysis.potentialEarningsElements.forEach(elem => {
            console.log(`   ${elem.selector}: ${elem.count} elements`);
          });
        }
        
      } catch (urlError) {
        console.warn(`⚠️ Failed to process ${url}: ${urlError.message}`);
        continue; // Try next URL
      }
    }
    
    if (earnings.length === 0) {
      console.log(`⚠️ No historical earnings data found for ${ticker} across all URL variations`);
      return [];
    }
    
    // Sort by report date (newest first) and remove duplicates
    const uniqueEarnings = [];
    const seenKeys = new Set();
    
    earnings
      .sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate))
      .forEach(earning => {
        const key = `${earning.reportDate}_${earning.estimatedEPS}_${earning.actualEPS}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueEarnings.push(earning);
        }
      });
    
    console.log(`✅ FINAL RESULT: Successfully scraped ${uniqueEarnings.length} unique historical earnings for ${ticker} from ${successfulUrl}`);
    
    // Log sample of results
    if (uniqueEarnings.length > 0) {
      console.log(`📊 SAMPLE RESULTS:`);
      uniqueEarnings.slice(0, 3).forEach((earning, index) => {
        console.log(`   ${index + 1}. ${earning.reportDate.split('T')[0]} - Est: ${earning.estimatedEPS}, Actual: ${earning.actualEPS}, Surprise: ${earning.surprisePercentage}%`);
      });
    }
    
    return uniqueEarnings;
    
  } catch (error) {
    console.error(`❌ COMPREHENSIVE SCRAPER FAILED for ${ticker}:`, error.message);
    console.error(`❌ Stack trace:`, error.stack);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  scrapeYahooEarningsCalendar,
  scrapeTodayEarnings,
  getYahooEarningsCalendar,
  scrapeHistoricalEarnings
};