/**
 * Form 4 Parser - Specialized parser for SEC Form 4 (insider trading) filings
 */
const cheerio = require('cheerio');
const axios = require('axios');
const xml2js = require('xml2js');
const { 
  secTickersByCik, 
  secTickersByName, 
  reportingPersonsToCompany,
  reportingPersonsToRoles 
} = require('../companyDatabase');
const { findIssuerForPerson } = require('../relationshipResolver');
const insiderExtractor = require('../extractors/insiderExtractor');
const transactionExtractor = require('../extractors/transactionExtractor');
const { getCompanyForInsider } = require('../utils/parsingUtils');

/**
 * Parse Form 4 feed XML into an array of structured insider-trade objects.
 * 
 * @param {string} xmlData - Raw XML data from SEC EDGAR RSS feed
 * @param {number} limit - Maximum number of entries to parse
 * @param {function} progressCallback - Optional callback function for progress updates
 * @returns {Promise<Array>} - Array of parsed insider trading objects
 */
async function parseForm4Data(xmlData, limit, progressCallback = null) {
  try {
    console.log(`\n🔍 FORM4PARSER - parseForm4Data START`);
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

    // First try to parse with xml2js for more reliable XML parsing
    try {
      console.log(`🔍 FORM4PARSER - Attempting xml2js parsing...`);
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xmlData);
      
      if (result && result.feed && result.feed.entry) {
        const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
        console.log(`🔍 FORM4PARSER - xml2js success: found ${entries.length} entries`);
        
        // Log the first entry to see what fields are available
        if (entries.length > 0) {
          console.log(`🔍 FORM4PARSER - Sample RSS entry structure:`, {
            title: entries[0].title?.substring(0, 80),
            updated: entries[0].updated,
            published: entries[0].published,
            allKeys: Object.keys(entries[0])
          });
        }
        
        return await processXmlEntries(entries, limit, progressCallback);
      }
    } catch (xmlError) {
      console.error('🔍 FORM4PARSER - XML parsing failed, falling back to cheerio:', xmlError.message);
    }
    
    // Fall back to cheerio if xml2js fails
    console.log(`🔍 FORM4PARSER - Using cheerio fallback...`);
    const $ = cheerio.load(xmlData, { xmlMode: true });
    const entries = $('entry');
    const trades = [];
    const totalEntries = Math.min(entries.length, limit);

    console.log(`🔍 FORM4PARSER - Cheerio found ${entries.length} entries, processing ${totalEntries}`);

    if (progressCallback) {
      progressCallback({ 
        stage: 'Starting Form 4 filing analysis...', 
        progress: 5, 
        total: totalEntries, 
        current: 0 
      });
    }

    for (let i = 0; i < totalEntries; i++) {
      const entry = entries.eq(i);
      const title = entry.find('title').text();
      const summary = entry.find('summary').text();
      const updated = entry.find('updated').text();
      const published = entry.find('published').text(); // Check if this exists
      const link = entry.find('link').attr('href');
      
      console.log(`\n🔍 FORM4PARSER - Entry #${i+1} Raw Dates:`, {
        title: title?.substring(0, 60),
        updated: updated,
        published: published,
        hasPublished: !!published
      });
      
      // Emit progress for each filing
      if (progressCallback) {
        const progressPercent = Math.round(((i + 1) / totalEntries) * 85) + 10; // 10-95% range
        progressCallback({ 
          stage: `Processing Form 4 filing #${i + 1}: ${title.substring(0, 50)}...`, 
          progress: progressPercent, 
          total: totalEntries, 
          current: i + 1 
        });
      }
      
      // More flexible Form 4 detection
      // Accept entries with '4 -', 'Form 4', '- Form 4', or just '4' in title
      if (!title.match(/\b4\b|Form 4|4 -/i)) {
        console.log(`🔍 FORM4PARSER - Skipping non-Form 4 entry: ${title}`);
        continue;
      }

      console.log(`🔍 FORM4PARSER - Processing Form 4 filing #${i+1}: ${title}`);
      
      // Fetch and parse the filing content
      const content = summary.length > 500 ? summary : await fetchFilingContent(link);
      
      // Extract insider information
      const { insiderName, personCIK } = insiderExtractor.extractInsiderDetails(title, summary, content);
      
      // Clean up the insider name to remove "4 - " prefix
      const cleanInsiderName = insiderName.replace(/^4\s*-\s*/, '').trim();
      
      // Extract company and ticker information
      const { ticker, title: position } = await extractTickerAndTitle(title, cleanInsiderName, personCIK, content);
      
      // Get a better position/title using multiple approaches
      let insiderRole = 'Unknown Position';
      
      // Check our mapping of known exec roles
      const lowerInsiderName = cleanInsiderName.toLowerCase();
      if (reportingPersonsToRoles[lowerInsiderName]) {
        insiderRole = reportingPersonsToRoles[lowerInsiderName];
        console.log(`Found role "${insiderRole}" for "${cleanInsiderName}" in roles mapping`);
      }
      
      // If not found in mapping, try other approaches
      if (insiderRole === 'Unknown Position') {
        // Try our specialized extractor
        const extractedRole = insiderExtractor.extractInsiderRole(content);
        if (extractedRole && extractedRole !== 'Unknown Position') {
          insiderRole = extractedRole;
          console.log(`Extracted role via extractor: ${insiderRole}`);
        }
      }

      // Try direct pattern matching as a fallback
      if (insiderRole === 'Unknown Position') {
        const rolePatterns = [
          /\b(CEO|Chief Executive Officer|President|Chairman|Director|Officer|CFO|Chief Financial Officer|COO|CTO|Board Member)\b/i,
          /\bvice president\b/i,
          /\btreasurer\b/i,
          /\bsecretary\b/i,
          /\b10\%\s*owner\b/i,
          /\bExecutive\b/i,
          /\bTrustee\b/i,
          /\bPartner\b/i,
          /\bGeneral Counsel\b/i
        ];
        
        for (const pattern of rolePatterns) {
          const match = content.match(pattern);
          if (match) {
            insiderRole = match[0];
            console.log(`Extracted role via direct pattern: ${insiderRole}`);
            break;
          }
        }
      }

      // Try to determine from context clues
      if (insiderRole === 'Unknown Position') {
        if (/Inc\.?$|Corp\.?$|Corporation$|LLC$|Ltd\.?$/i.test(cleanInsiderName)) {
          insiderRole = 'Issuer';
          console.log(`Determined role as Issuer based on company name pattern`);
        } else if (ticker && cleanInsiderName.toUpperCase() === ticker) {
          insiderRole = 'Issuer';
          console.log(`Determined role as Issuer based on name match with ticker`);
        }
      }
      
      // Last resort - assign a generic role based on context
      if (insiderRole === 'Unknown Position') {
        if (content.includes('director') || content.includes('Director')) {
          insiderRole = 'Director';
        } else if (content.includes('officer') || content.includes('Officer')) {
          insiderRole = 'Officer';
        } else if (content.includes('10%') || content.includes('ten percent')) {
          insiderRole = '10% Owner';
        } else {
          insiderRole = 'Executive';
        }
        console.log(`Assigned generic role: ${insiderRole}`);
      }
      
      console.log(`Final role for ${cleanInsiderName}: ${insiderRole}`);
      
      // Extract transaction details
      const transactionData = await transactionExtractor.extractTransactionDetails(content);
      const { shares, price, value, tradeType: transactionType, actualFilingDate } = transactionData;
      
      // Use the better role if available, otherwise fallback to position
      const finalRole = insiderRole !== 'Unknown Position' ? insiderRole : position;
      
      // Determine the best date to use for filing date
      // Priority: actualFilingDate from document > published > updated > current date
      let filingDate;
      try {
        if (actualFilingDate) {
          filingDate = new Date(actualFilingDate);
          console.log(`🔍 FORM4PARSER - Using actual filing date from document: ${actualFilingDate} -> ${filingDate.toISOString()}`);
        } else if (published) {
          filingDate = new Date(published);
          console.log(`🔍 FORM4PARSER - Using published date: ${published} -> ${filingDate.toISOString()}`);
        } else if (updated) {
          filingDate = new Date(updated);
          console.log(`🔍 FORM4PARSER - Using updated date: ${updated} -> ${filingDate.toISOString()}`);
        } else {
          filingDate = new Date();
          console.log(`🔍 FORM4PARSER - Using current date as fallback: ${filingDate.toISOString()}`);
        }
        
        // Validate the date
        if (isNaN(filingDate.getTime())) {
          console.warn(`🔍 FORM4PARSER - Invalid date detected, using current date`);
          filingDate = new Date();
        }
      } catch (dateError) {
        console.error(`🔍 FORM4PARSER - Error parsing date:`, dateError.message);
        filingDate = new Date();
      }
      
      const trade = {
        id: `${i}-${Date.now()}`,
        ticker: ticker || '-',
        insiderName: cleanInsiderName || 'Unknown',
        title: finalRole || 'Unknown Position',
        tradeType: transactionType,
        shares,
        price,
        value,
        filingDate: filingDate.toISOString(),
        transactionDate: filingDate.toISOString(),
        formType: '4',
        url: link
      };
      
      console.log(`🔍 FORM4PARSER - Created trade object:`, {
        ticker: trade.ticker,
        filingDate: trade.filingDate,
        insiderName: trade.insiderName?.substring(0, 30),
        value: trade.value
      });
      
      trades.push(trade);
    }

    console.log(`🔍 FORM4PARSER - Cheerio processing complete: ${trades.length} trades`);

    // Emit completion progress
    if (progressCallback) {
      progressCallback({ 
        stage: 'Form 4 processing completed', 
        progress: 100, 
        total: totalEntries, 
        current: totalEntries 
      });
    }

    return trades;
  } catch (err) {
    console.error('🔍 FORM4PARSER - Error parsing Form 4 feed:', err.message);
    
    // Emit error progress
    if (progressCallback) {
      progressCallback({ 
        stage: 'Error processing Form 4 filings', 
        progress: 0, 
        total: 0, 
        current: 0,
        error: err.message 
      });
    }
    
    // Return empty array instead of throwing to prevent server crash
    return [];
  }
}

/**
 * Process XML entries from xml2js parser
 * @param {Array} entries - Array of entry objects from xml2js
 * @param {number} limit - Maximum number of entries to process
 * @param {function} progressCallback - Optional callback function for progress updates
 * @returns {Promise<Array>} - Array of parsed insider trading objects
 */
async function processXmlEntries(entries, limit, progressCallback = null) {
  const trades = [];
  
  for (let i = 0; i < Math.min(entries.length, limit); i++) {
    const entry = entries[i];
    const title = entry.title;
    const summary = entry.summary;
    const updated = entry.updated;
    const published = entry.published; // This might be the actual filing date
    const link = entry.link && entry.link.$ ? entry.link.$.href : '';
    
    // Debug: Log available date fields
    console.log(`\n📅 Entry #${i+1} Date Fields:`, {
      title: title?.substring(0, 80),
      updated: updated,
      published: published,
      hasPublished: !!published
    });
    
    // Emit progress for each filing
    if (progressCallback) {
      const progressPercent = Math.round(((i + 1) / limit) * 85) + 10; // 10-95% range
      progressCallback({ 
        stage: `Processing Form 4 filing #${i + 1}: ${title.substring(0, 50)}...`, 
        progress: progressPercent, 
        total: limit, 
        current: i + 1 
      });
    }
    
    // More flexible Form 4 detection
    if (!title.match(/\b4\b|Form 4|4 -/i)) {
      console.log(`Skipping non-Form 4 entry: ${title}`);
      continue;
    }

    console.log(`\nProcessing Form 4 filing #${i+1}: ${title}`);
    
    // Fetch and parse the filing content
    const content = summary.length > 500 ? summary : await fetchFilingContent(link);
    
    // Extract insider information
    const { insiderName, personCIK } = insiderExtractor.extractInsiderDetails(title, summary, content);
    
    // Clean up the insider name to remove "4 - " prefix
    const cleanInsiderName = insiderName.replace(/^4\s*-\s*/, '').trim();
    
    // Extract company and ticker information
    const { ticker, title: position } = await extractTickerAndTitle(title, cleanInsiderName, personCIK, content);
    
    // Get a better position/title using multiple approaches
    let insiderRole = 'Unknown Position';
    
    // Check our mapping of known exec roles
    const lowerInsiderName = cleanInsiderName.toLowerCase();
    if (reportingPersonsToRoles[lowerInsiderName]) {
      insiderRole = reportingPersonsToRoles[lowerInsiderName];
    }
    
    // If not found in mapping, try other approaches
    if (insiderRole === 'Unknown Position') {
      // Try our specialized extractor
      const extractedRole = insiderExtractor.extractInsiderRole(content);
      if (extractedRole && extractedRole !== 'Unknown Position') {
        insiderRole = extractedRole;
        console.log(`Extracted role via extractor: ${insiderRole}`);
      }
    }

    // Try direct pattern matching as a fallback
    if (insiderRole === 'Unknown Position') {
      const rolePatterns = [
        /\b(CEO|Chief Executive Officer|President|Chairman|Director|Officer|CFO|Chief Financial Officer|COO|CTO|Board Member)\b/i,
        /\bvice president\b/i,
        /\btreasurer\b/i,
        /\bsecretary\b/i,
        /\b10\%\s*owner\b/i,
        /\bExecutive\b/i,
        /\bTrustee\b/i,
        /\bPartner\b/i,
        /\bGeneral Counsel\b/i
      ];
      
      for (const pattern of rolePatterns) {
        const match = content.match(pattern);
        if (match) {
          insiderRole = match[0];
          console.log(`Extracted role via direct pattern: ${insiderRole}`);
          break;
        }
      }
    }

    // Try to determine from context clues
    if (insiderRole === 'Unknown Position') {
      if (/Inc\.?$|Corp\.?$|Corporation$|LLC$|Ltd\.?$/i.test(cleanInsiderName)) {
        insiderRole = 'Issuer';
        console.log(`Determined role as Issuer based on company name pattern`);
      } else if (ticker && cleanInsiderName.toUpperCase() === ticker) {
        insiderRole = 'Issuer';
        console.log(`Determined role as Issuer based on name match with ticker`);
      }
    }
    
    // Last resort - assign a generic role based on context
    if (insiderRole === 'Unknown Position') {
      if (content.includes('director') || content.includes('Director')) {
        insiderRole = 'Director';
      } else if (content.includes('officer') || content.includes('Officer')) {
        insiderRole = 'Officer';
      } else if (content.includes('10%') || content.includes('ten percent')) {
        insiderRole = '10% Owner';
      } else {
        insiderRole = 'Executive';
      }
      console.log(`Assigned generic role: ${insiderRole}`);
    }
    
    console.log(`Final role for ${cleanInsiderName}: ${insiderRole}`);

    // Extract transaction details
    const transactionData = await transactionExtractor.extractTransactionDetails(content);
    const { shares, price, value, tradeType: transactionType, actualFilingDate } = transactionData;
    
    // Use the better role if available, otherwise fallback to position
    const finalRole = insiderRole !== 'Unknown Position' ? insiderRole : position;
    
    // Determine the best date to use for filing date
    // Priority: actualFilingDate from document > published > updated > current date
    let filingDate;
    try {
      if (actualFilingDate) {
        filingDate = new Date(actualFilingDate);
        console.log(`🔍 FORM4PARSER - Using actual filing date from document: ${actualFilingDate} -> ${filingDate.toISOString()}`);
      } else if (published) {
        filingDate = new Date(published);
        console.log(`🔍 FORM4PARSER - Using published date: ${published} -> ${filingDate.toISOString()}`);
      } else if (updated) {
        filingDate = new Date(updated);
        console.log(`🔍 FORM4PARSER - Using updated date: ${updated} -> ${filingDate.toISOString()}`);
      } else {
        filingDate = new Date();
        console.log(`🔍 FORM4PARSER - Using current date as fallback: ${filingDate.toISOString()}`);
      }
      
      // Validate the date
      if (isNaN(filingDate.getTime())) {
        console.warn(`🔍 FORM4PARSER - Invalid date detected, using current date`);
        filingDate = new Date();
      }
    } catch (dateError) {
      console.error(`🔍 FORM4PARSER - Error parsing date:`, dateError.message);
      filingDate = new Date();
    }
    
    // Ensure we never return "Sec Form 4" as a title
    let cleanTitle = finalRole;
    if (cleanTitle === 'Sec Form 4' || cleanTitle === 'Form 4' || !cleanTitle || cleanTitle.trim() === '') {
      cleanTitle = 'Unknown Position';
      console.log(`⚠️ Cleaned up invalid title in processXmlEntries, set to: "${cleanTitle}"`);
    }
    
    trades.push({
      id: `${i}-${Date.now()}`,
      ticker: ticker || '-',
      insiderName: cleanInsiderName || 'Unknown',
      title: cleanTitle,
      tradeType: transactionType,
      shares,
      price,
      value,
      filingDate: filingDate.toISOString(),
      transactionDate: filingDate.toISOString(), // Use same date for transaction
      formType: '4',
      url: link
    });
  }
  
  return trades;
}

/**
 * Fetches the content of a filing from its URL with enhanced SEC EDGAR handling
 * @param {string} url - Filing URL (typically an index page)
 * @returns {Promise<string>} - Filing content
 */
async function fetchFilingContent(url) {
  try {
    console.log(`[form4Parser] Fetching filing content from: ${url}`);
    
    // Add delay to respect SEC rate limits
    await new Promise(resolve => setTimeout(resolve, 150)); // 150ms delay = ~6.6 requests/second
    
    // Step 1: Fetch the index page first to find the actual Form 4 document
    try {
      const indexResponse = await axios.get(url, {
        headers: { 
          'User-Agent': 'HRVSTR Financial Analysis Platform (educational purposes) contact@example.com',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status < 500; // Accept anything less than 500 as valid
        }
      });
      
      // Check for rate limiting
      if (indexResponse.status === 429) {
        console.log(`[form4Parser] Rate limited on index page. Waiting and using summary fallback...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        return '';
      }
      
      if (indexResponse.status !== 200) {
        console.log(`[form4Parser] Index page returned status ${indexResponse.status}, using summary fallback`);
        return '';
      }
      
      // Parse the index page to find the actual Form 4 document
      const $ = cheerio.load(indexResponse.data);
      console.log(`[form4Parser] Successfully loaded index page (${indexResponse.data.length} chars)`);
      
      // Method 1: Look for the primary document in the filing table
      let form4DocUrl = null;
      
      // Look for table rows containing Form 4 documents
      $('table tr').each((i, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        
        // Check if this row contains a Form 4 document
        cells.each((j, cell) => {
          const $cell = $(cell);
          const cellText = $cell.text().toLowerCase();
          
          // Look for Form 4 indicators
          if (cellText.includes('form 4') || cellText.includes('form4') || 
              cellText.includes('primary document') || cellText.includes('complete submission')) {
            
            // Find the link in this row
            const link = $row.find('a').first();
            if (link.length > 0) {
              let href = link.attr('href');
              if (href) {
                if (href.startsWith('/')) {
                  href = `https://www.sec.gov${href}`;
                }
                form4DocUrl = href;
                console.log(`[form4Parser] Found Form 4 document link in table: ${href}`);
                return false; // Break out of loop
              }
            }
          }
        });
        
        if (form4DocUrl) return false; // Break out of outer loop
      });
      
      // Method 2: Look for direct links to .xml files
      if (!form4DocUrl) {
        $('a').each((i, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().toLowerCase();
          
          if (href && (href.includes('.xml') || text.includes('form 4') || text.includes('complete submission'))) {
            if (href.startsWith('/')) {
              form4DocUrl = `https://www.sec.gov${href}`;
            } else {
              form4DocUrl = href;
            }
            console.log(`[form4Parser] Found document link: ${form4DocUrl}`);
            return false; // Break out of loop
          }
        });
      }
      
      // Method 3: Construct the XML filename from the URL pattern
      if (!form4DocUrl) {
        // Extract components from the index URL
        // Pattern: /Archives/edgar/data/CIK/ACCESSION/ACCESSION-index.htm
        const urlMatch = url.match(/edgar\/data\/(\d+)\/(\d+)\/([^\/]+)-index\.htm/);
        if (urlMatch) {
          const [, cik, accession, baseFilename] = urlMatch;
          
          // Try different Form 4 document patterns
          const possibleUrls = [
            `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/${baseFilename}.xml`,
            `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/form4.xml`,
            `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/primary_doc.xml`,
            `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/doc1.xml`,
            `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/${accession.replace(/-/g, '')}.xml`
          ];
          
          for (const testUrl of possibleUrls) {
            try {
              console.log(`[form4Parser] Testing constructed URL: ${testUrl}`);
              await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between attempts
              
              const testResponse = await axios.head(testUrl, {
                headers: { 'User-Agent': 'HRVSTR Financial Analysis Platform (educational purposes) contact@example.com' },
                timeout: 10000,
                validateStatus: function (status) {
                  return status < 500;
                }
              });
              
              if (testResponse.status === 200) {
                form4DocUrl = testUrl;
                console.log(`[form4Parser] Found XML document via pattern: ${testUrl}`);
                break;
              }
            } catch (e) {
              // Continue to next pattern
            }
          }
        }
      }
      
      // Step 2: If we found a Form 4 document URL, fetch it
      if (form4DocUrl) {
        try {
          console.log(`[form4Parser] Fetching Form 4 document: ${form4DocUrl}`);
          await new Promise(resolve => setTimeout(resolve, 150)); // Rate limit delay
          
          const docResponse = await axios.get(form4DocUrl, {
            headers: { 
              'User-Agent': 'HRVSTR Financial Analysis Platform (educational purposes) contact@example.com',
              'Accept': 'application/xml,text/xml,*/*'
            },
            timeout: 30000,
            validateStatus: function (status) {
              return status < 500;
            }
          });
          
          if (docResponse.status === 429) {
            console.log(`[form4Parser] Rate limited on document fetch. Using index fallback.`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Fall through to use index page content
          } else if (docResponse.status === 200 && docResponse.data.length > 100) {
            console.log(`[form4Parser] Successfully fetched Form 4 document (${docResponse.data.length} chars)`);
            return docResponse.data;
          }
        } catch (docError) {
          console.error(`[form4Parser] Error fetching Form 4 document: ${docError.message}`);
          // Fall through to extract from index page
        }
      }
      
      // Step 3: Fallback - extract what we can from the index page itself
      console.log(`[form4Parser] Using index page content as fallback`);
      
      // Try to find any useful content in the index page
      let content = '';
      
      // Look for filing summary or other useful information
      const summaryContent = $('.filerInformation').text() || 
                           $('.formContent').text() || 
                           $('.infoTable').text() || 
                           $('.formGrouping').text() ||
                           $('pre').text() || // Sometimes content is in <pre> tags
                           '';
      
      if (summaryContent.length > 50) {
        content = summaryContent;
        console.log(`[form4Parser] Extracted summary content (${content.length} chars)`);
      } else {
        // Last resort: return the full HTML which might contain some extractable info
        content = indexResponse.data;
        console.log(`[form4Parser] Using full index page HTML (${content.length} chars)`);
      }
      
      return content;
      
    } catch (indexError) {
      console.error(`[form4Parser] Error fetching index page: ${indexError.message}`);
      return '';
    }
    
  } catch (error) {
    console.error(`[form4Parser] Error in fetchFilingContent: ${error.message}`);
    return '';
  }
}

/**
 * Extract ticker symbol and insider title from filing information
 */
async function extractTickerAndTitle(title, insiderName, personCIK, content) {
  // Default values
  let ticker = '-';
  let position = 'Unknown Position';
  
  try {
    // Ensure content is a valid string for matching operations
    const safeContent = content && typeof content === 'string' ? content : '';
    
    console.log(`[form4Parser] 🔍 Extracting ticker for: title="${title}", insider="${insiderName}", CIK="${personCIK}"`);
    
    // Extract company CIK and name from the title
    const titleMatch = title.match(/4\s*-\s*([^(]+)\s*\((\d+)\)\s*\(([^)]*)\)/i);
    if (titleMatch) {
      const companyName = titleMatch[1].trim();
      const companyCik = titleMatch[2].toString().padStart(10, '0');
      const filerType = titleMatch[3].trim() || 'subject company'; // Default if empty
      
      console.log(`[form4Parser] 🔍 Parsed title: company="${companyName}", CIK="${companyCik}", type="${filerType}"`);
      
      // Method 1: Direct CIK lookup (most reliable)
      if (secTickersByCik[companyCik]) {
        ticker = secTickersByCik[companyCik];
        console.log(`[form4Parser] ✅ Found ticker ${ticker} via CIK lookup (${companyCik})`);
      } else if (secTickersByCik[companyCik.replace(/^0+/, '')]) {
        ticker = secTickersByCik[companyCik.replace(/^0+/, '')];
        console.log(`[form4Parser] ✅ Found ticker ${ticker} via unpadded CIK lookup (${companyCik.replace(/^0+/, '')})`);
      } else {
        console.log(`[form4Parser] ❌ No ticker found for CIK ${companyCik} in database`);
      }
      
      // Method 2: Company name lookup (if CIK lookup failed)
      if (ticker === '-') {
        const upperCompanyName = companyName.toUpperCase();
        console.log(`[form4Parser] 🔍 Trying company name lookup for: "${upperCompanyName}"`);
        
        // Direct match
        if (secTickersByName[upperCompanyName]) {
          ticker = secTickersByName[upperCompanyName];
          console.log(`[form4Parser] ✅ Found ticker ${ticker} via direct name match`);
        } else {
          // Try cleaned name (remove suffixes)
          const cleanedName = upperCompanyName.replace(/,?\s*(INC\.?|CORP\.?|CORPORATION|LLC|LTD\.?|CO\.?)$/i, '').trim();
          if (secTickersByName[cleanedName]) {
            ticker = secTickersByName[cleanedName];
            console.log(`[form4Parser] ✅ Found ticker ${ticker} via cleaned name match (${cleanedName})`);
          } else {
            // Try partial matches
            for (const [dbName, dbTicker] of Object.entries(secTickersByName)) {
              if (cleanedName.includes(dbName) || dbName.includes(cleanedName)) {
                ticker = dbTicker;
                console.log(`[form4Parser] ✅ Found ticker ${ticker} via partial match: "${cleanedName}" ~ "${dbName}"`);
                break;
              }
            }
          }
        }
      }
      
      // Method 3: Enhanced fallback generation based on common patterns
      if (ticker === '-') {
        console.log(`[form4Parser] 🔍 Attempting enhanced ticker generation for: "${companyName}"`);
        
        // Special handling for well-known patterns
        const specialCases = {
          'TENET HEALTHCARE': 'THC',
          'ELI LILLY': 'LLY', 
          'HARTE HANKS': 'HHS',
          'FRANKLIN ELECTRIC': 'FELE',
          'ALLY FINANCIAL': 'ALLY',
          '3M CO': 'MMM',
          'CATERPILLAR': 'CAT',
          'CALERES': 'CAL'
        };
        
        for (const [pattern, tickerSymbol] of Object.entries(specialCases)) {
          if (companyName.toUpperCase().includes(pattern)) {
            ticker = tickerSymbol;
            console.log(`[form4Parser] ✅ Found ticker ${ticker} via special case pattern (${pattern})`);
            break;
          }
        }
        
        // If still no ticker, generate one
        if (ticker === '-') {
          const potentialTicker = generateTickerFromCompanyName(companyName);
          if (potentialTicker) {
            ticker = potentialTicker;
            console.log(`[form4Parser] ⚠️ Generated ticker ${ticker} from company name ${companyName}`);
          }
        }
      }
      
      // Set the ticker based on filer type
      if (filerType.toLowerCase().includes('reporting')) {
        // It's a reporting person (insider) filing
        // Multiple methods to determine ticker...
        
        // Method 4: Look up directly in SEC database by person CIK (if we still don't have ticker)
        if (ticker === '-' && personCIK) {
          try {
            const companyInfo = await getCompanyForInsider(personCIK);
            if (companyInfo && companyInfo.ticker) {
              ticker = companyInfo.ticker;
              console.log(`[form4Parser] ✅ Found ticker ${ticker} by looking up insider CIK ${personCIK}`);
            }
          } catch (error) {
            console.log(`[form4Parser] ❌ Error looking up insider CIK: ${error.message}`);
          }
        }
        
        // Method 5: Try to extract issuer information from the content (only if content exists)
        if (ticker === '-' && safeContent.length > 0) {
          const issuerMatch = safeContent.match(/Issuer[^:]*:[^A-Z]*([A-Za-z0-9\s\.\,]+)/i);
          if (issuerMatch) {
            const issuerName = issuerMatch[1].trim();
            // Look up the issuer name in our database
            const upperIssuerName = issuerName.toUpperCase();
            if (secTickersByName[upperIssuerName]) {
              ticker = secTickersByName[upperIssuerName];
              console.log(`[form4Parser] ✅ Found ticker ${ticker} from issuer name ${issuerName}`);
            }
          }
        }
        
        // Method 6: Try to extract the ticker from the filing (only if content exists)
        if (ticker === '-' && safeContent.length > 0) {
          const tickerMatch = safeContent.match(/Issuer[^:]*:[^A-Z]*\(([A-Z]{1,5})\)/i) || 
                             safeContent.match(/Ticker[^:]*:\s*([A-Z]{1,5})/i) ||
                             safeContent.match(/Symbol[^:]*:\s*([A-Z]{1,5})/i);
          if (tickerMatch) {
            ticker = tickerMatch[1].toUpperCase();
            console.log(`[form4Parser] ✅ Found explicit ticker ${ticker} in content`);
          }
        }
        
        // Method 7: Check our mapping of known reporting persons
        if (ticker === '-' && insiderName && insiderName !== 'Unknown') {
          // Try various ways to match the name
          const lowerName = insiderName.toLowerCase().trim();
          const nameParts = lowerName.split(/\s+/);
          
          const possibleNameKeys = [
            lowerName, // Full name
            nameParts[0], // First part (often last name)
            nameParts[nameParts.length - 1] // Last part (often first name)
          ];
          
          if (nameParts.length > 1) {
            possibleNameKeys.push(`${nameParts[0]} ${nameParts[1]}`); // First two parts
            possibleNameKeys.push(nameParts.join(' ')); // Normalized full name
          }
          
          for (const nameKey of possibleNameKeys) {
            if (reportingPersonsToCompany[nameKey]) {
              ticker = reportingPersonsToCompany[nameKey].ticker;
              console.log(`[form4Parser] ✅ Found ticker ${ticker} using name match for ${nameKey}`);
              break;
            }
          }
        }
        
        // Method 8: Last resort - use SEC Edgar Full-Text Search API
        if (ticker === '-') {
          try {
            console.log(`[form4Parser] 🔍 SEC SEARCH API: Looking up issuer for reporting person ${insiderName}...`);
            
            // Use our relationship resolver to find the most likely company
            const issuerInfo = await findIssuerForPerson({ 
              name: insiderName,
              cik: personCIK
            });
            
            if (issuerInfo && issuerInfo.ticker) {
              ticker = issuerInfo.ticker;
              console.log(`[form4Parser] ✅ SEC SEARCH SUCCESS: Found ticker ${ticker} for ${insiderName} via SEC Search API`);
            }
          } catch (error) {
            console.error(`[form4Parser] ❌ SEC Search API error for ${insiderName}:`, error.message);
          }
        }
        
      } else {
        // It's an issuer filing - the company CIK should directly map to ticker
        console.log(`[form4Parser] 🔍 Processing issuer filing for ${companyName}`);
        
        if (ticker === '-') {
          console.log(`[form4Parser] ❌ No ticker found for issuer ${companyName} (CIK: ${companyCik})`);
        }
      }
    } else {
      console.log(`[form4Parser] ❌ Could not parse title format: ${title}`);
    }
    
    // ENHANCED position/title extraction (MAIN FIX FOR "Sec Form 4" issue)
    console.log(`[form4Parser] 🔍 Starting enhanced position extraction...`);
    
    // Method 1: Extract from the filing title itself - this is often where the best info is
    if (title && title.length > 0) {
      // Try to extract position from title patterns like:
      // "4 - KINGSTONE COMPANIES, INC (0001063757) (Issuer)"
      // "4 - CATERPILLAR INC (0001055387) (Reporting Person - Chief Executive Officer)"
      const titlePositionMatch = title.match(/\(Reporting Person[^)]*-\s*([^)]+)\)/i) ||
                                 title.match(/\(([^)]*(?:Officer|Director|President|CEO|CFO|COO|CTO|Chairman|Vice President|VP)[^)]*)\)/i);
                                 
      if (titlePositionMatch) {
        position = titlePositionMatch[1].trim();
        console.log(`[form4Parser] ✅ Extracted position from title: "${position}"`);
      }
    }
    
    // Method 2: Extract from content using multiple pattern attempts (only if we haven't found it yet and content exists)
    if ((position === 'Unknown Position' || position === 'Sec Form 4') && safeContent.length > 0) {
      console.log(`[form4Parser] 🔍 Trying content-based position extraction...`);
      
      // Advanced pattern matching for positions
      const advancedPatterns = [
        // Standard role patterns
        /(?:Title|Position|Role)\s*[:\-]\s*([^,\n\r;]+(?:Officer|Director|President|CEO|CFO|COO|CTO|Chairman|Vice President|VP|Secretary|Treasurer|Manager|Executive)[^,\n\r;]*)/i,
        
        // XML-style tags
        /<(?:title|position|role)>([^<]+)<\/(?:title|position|role)>/i,
        
        // Direct role mentions
        /\b(Chief Executive Officer|Chief Financial Officer|Chief Operating Officer|Chief Technology Officer|President|Chairman|Vice President|VP|Director|Secretary|Treasurer|Executive Vice President|Senior Vice President|General Counsel|Chief Marketing Officer|Chief Human Resources Officer|Chief Accounting Officer|10% Owner|Beneficial Owner)\b/i,
        
        // Role indicators in sentences
        /(?:is|serves as|appointed as|acting as|position of)\s+(?:a\s+|an\s+|the\s+)?([^,\n\r;]+(?:Officer|Director|President|CEO|CFO|COO|CTO|Chairman|Vice President|VP|Secretary|Treasurer|Manager|Executive)[^,\n\r;]*)/i,
        
        // Form 4 specific patterns
        /Relationship[^:]*:\s*([^,\n\r;]+)/i,
        /Officer Title[^:]*:\s*([^,\n\r;]+)/i,
        /Director Title[^:]*:\s*([^,\n\r;]+)/i,
        
        // Ownership patterns
        /\b(10\s*%\s*Owner|Ten\s*Percent\s*Owner|Beneficial\s*Owner)\b/i,
        
        // Generic patterns
        /\b([A-Z][a-z]+\s+(?:Officer|Director|President|CEO|CFO|COO|CTO|Chairman|Vice President|VP|Secretary|Treasurer|Manager|Executive))\b/,
        /\b((?:Senior|Executive|Assistant|Deputy)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/
      ];
      
      for (const pattern of advancedPatterns) {
        const match = safeContent.match(pattern);
        if (match && match[1]) {
          const extractedPosition = match[1].trim();
          // Clean up the extracted position
          const cleanPosition = extractedPosition.replace(/[^\w\s&-]/g, ' ').replace(/\s+/g, ' ').trim();
          if (cleanPosition.length > 2 && cleanPosition.length < 100) {
            position = cleanPosition;
            console.log(`[form4Parser] ✅ Extracted position from content via pattern: "${position}"`);
            break;
          }
        }
      }
    }
    
    // Method 3: Fallback to basic role indicators if still no position
    if ((position === 'Unknown Position' || position === 'Sec Form 4') && safeContent.length > 0) {
      console.log(`[form4Parser] 🔍 Trying basic role indicators...`);
      
      const basicRoles = [
        { pattern: /\b(director|board member)\b/i, role: 'Director' },
        { pattern: /\b(officer|executive)\b/i, role: 'Officer' },
        { pattern: /\b(president)\b/i, role: 'President' },
        { pattern: /\b(ceo|chief executive)\b/i, role: 'Chief Executive Officer' },
        { pattern: /\b(cfo|chief financial)\b/i, role: 'Chief Financial Officer' },
        { pattern: /\b(coo|chief operating)\b/i, role: 'Chief Operating Officer' },
        { pattern: /\b(chairman|chair)\b/i, role: 'Chairman' },
        { pattern: /\bvice president|vp\b/i, role: 'Vice President' },
        { pattern: /\b10\s*%|ten\s*percent\b/i, role: '10% Owner' },
        { pattern: /\b(secretary)\b/i, role: 'Secretary' },
        { pattern: /\b(treasurer)\b/i, role: 'Treasurer' }
      ];
      
      for (const { pattern, role } of basicRoles) {
        if (pattern.test(safeContent)) {
          position = role;
          console.log(`[form4Parser] ✅ Assigned basic role: "${position}"`);
          break;
        }
      }
    }
    
    // Method 4: Final fallback - analyze insider name patterns
    if ((position === 'Unknown Position' || position === 'Sec Form 4') && insiderName) {
      console.log(`[form4Parser] 🔍 Trying name-based inference...`);
      
      // If insider name contains company-like suffixes, it's likely an issuer
      if (/\b(Inc\.?|Corp\.?|Corporation|LLC|Ltd\.?|Co\.?|Company|LP|LLP)\b/i.test(insiderName)) {
        position = 'Issuer';
        console.log(`[form4Parser] ✅ Inferred position as Issuer based on name pattern`);
      }
      // If name matches ticker, it's likely an issuer  
      else if (ticker && ticker !== '-' && insiderName.toUpperCase().includes(ticker)) {
        position = 'Issuer';
        console.log(`[form4Parser] ✅ Inferred position as Issuer based on ticker match`);
      }
      // Default to Executive for individual names
      else if (position === 'Unknown Position' || position === 'Sec Form 4') {
        position = 'Executive';
        console.log(`[form4Parser] ✅ Defaulted to Executive for individual name`);
      }
    }
    
    // Ensure we never return "Sec Form 4" as a position
    if (position === 'Sec Form 4' || position === 'Form 4' || !position || position.trim() === '') {
      position = 'Unknown Position';
      console.log(`[form4Parser] ⚠️ Cleaned up invalid position, set to: "${position}"`);
    }

    console.log(`[form4Parser] 🎯 Final result: ticker="${ticker}", position="${position}"`);
    return { ticker, title: position };
  } catch (error) {
    console.error(`[form4Parser] ❌ Error extracting ticker and title: ${error.message}`);
    return { ticker, title: position === 'Sec Form 4' ? 'Unknown Position' : position };
  }
}

/**
 * Generate a ticker symbol from company name as a last resort
 * @param {string} companyName - Company name to generate ticker from
 * @returns {string|null} - Generated ticker or null
 */
function generateTickerFromCompanyName(companyName) {
  try {
    if (!companyName) return null;
    
    // Clean company name
    const cleanName = companyName
      .replace(/\b(Inc|Corp|Corporation|Company|Ltd|Limited|LLC|LP|Co)\b\.?/gi, '')
      .trim();
    
    // Enhanced ticker generation rules
    const words = cleanName.split(/\s+/).filter(word => word.length > 0);
    
    if (words.length === 0) return null;
    
    // Rule 1: For single words, take first 2-4 letters (avoid single letters)
    if (words.length === 1) {
      const word = words[0].toUpperCase();
      if (word.length >= 4) {
        return word.substring(0, 4);
      } else if (word.length >= 3) {
        return word.substring(0, 3);
      } else if (word.length === 2) {
        return word;
      } else {
        return null; // Don't generate single-letter tickers
      }
    }
    
    // Rule 2: For multiple words, take first letters but ensure min 2 chars
    let ticker = words.map(word => word.charAt(0).toUpperCase()).join('').substring(0, 5);
    
    // If we only got 1 character, try to get more from the first word
    if (ticker.length === 1) {
      const firstWord = words[0].toUpperCase();
      if (firstWord.length >= 3) {
        ticker = firstWord.substring(0, 3);
      } else {
        ticker = firstWord + words.slice(1).map(w => w.charAt(0)).join('').substring(0, 4);
      }
    }
    
    // Rule 3: Special handling for common patterns
    if (cleanName.includes('TECHNOLOGIES')) {
      ticker = words[0].charAt(0).toUpperCase() + 'TECH';
    } else if (cleanName.includes('THERAPEUTICS')) {
      ticker = words[0].charAt(0).toUpperCase() + 'THER';
    } else if (cleanName.includes('PHARMACEUTICALS')) {
      ticker = words[0].charAt(0).toUpperCase() + 'PHAR';
    } else if (cleanName.includes('HOLDINGS')) {
      ticker = words[0].substring(0, Math.min(3, words[0].length)).toUpperCase() + 'H';
    }
    
    // Ensure minimum 2 characters for any ticker
    if (ticker.length < 2) {
      const firstWord = words[0].toUpperCase();
      ticker = firstWord.length >= 2 ? firstWord.substring(0, 2) : null;
    }
    
    console.log(`Generated ticker ${ticker} for company: ${companyName}`);
    return ticker;
  } catch (error) {
    console.error(`Error generating ticker for ${companyName}:`, error.message);
    return null;
  }
}

module.exports = {
  parseForm4Data
};