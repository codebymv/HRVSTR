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
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xmlData);
      
      if (result && result.feed && result.feed.entry) {
        const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
        return await processXmlEntries(entries, limit, progressCallback);
      }
    } catch (xmlError) {
      console.error('XML parsing failed, falling back to cheerio:', xmlError.message);
    }
    
    // Fall back to cheerio if xml2js fails
    const $ = cheerio.load(xmlData, { xmlMode: true });
    const entries = $('entry');
    const trades = [];
    const totalEntries = Math.min(entries.length, limit);

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
      const link = entry.find('link').attr('href');
      
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
      
      // 1. Get a better position/title using multiple approaches
      let insiderRole = 'Unknown Position';
      
      // 2. First check our mapping of known exec roles
      const lowerInsiderName = cleanInsiderName.toLowerCase();
      if (reportingPersonsToRoles[lowerInsiderName]) {
        insiderRole = reportingPersonsToRoles[lowerInsiderName];
        console.log(`Found role "${insiderRole}" for "${cleanInsiderName}" in roles mapping`);
      }
      
      // 3. If not found in mapping, try other approaches
      if (insiderRole === 'Unknown Position') {
        // Try our specialized extractor
        const extractedRole = insiderExtractor.extractInsiderRole(content);
        if (extractedRole && extractedRole !== 'Unknown Position') {
          insiderRole = extractedRole;
          console.log(`Extracted role via extractor: ${insiderRole}`);
        }
      }

      // 4. Try direct pattern matching as a fallback
      if (insiderRole === 'Unknown Position') {
        // Common executive roles
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

      // 5. Try to determine from context clues
      if (insiderRole === 'Unknown Position') {
        // If the insider name contains Inc, Corp, etc, they're an issuer
        if (/Inc\.?$|Corp\.?$|Corporation$|LLC$|Ltd\.?$/i.test(cleanInsiderName)) {
          insiderRole = 'Issuer';
          console.log(`Determined role as Issuer based on company name pattern`);
        }
        // If the insider name is the company name, they're likely an issuer
        else if (ticker && cleanInsiderName.toUpperCase() === ticker) {
          insiderRole = 'Issuer';
          console.log(`Determined role as Issuer based on name match with ticker`);
        }
      }
      
      // 6. Last resort - assign a generic role based on context
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
      const { shares, price, value, tradeType: transactionType } = 
        transactionExtractor.extractTransactionDetails(content);
      
      // Use the better role if available, otherwise fallback to position
      const finalRole = insiderRole !== 'Unknown Position' ? insiderRole : position;
      
      // Log transaction details for debugging
      // Make sure we have good values for key fields
      const displayTicker = ticker || '-';
      const displayName = cleanInsiderName || 'Unknown';
      const displayRole = finalRole || 'Unknown Position';
      
      console.log(`Filing ${i+1} details:`);
      console.log(`  - Ticker: ${displayTicker}`);
      console.log(`  - Insider: ${displayName}`);
      console.log(`  - Role: ${displayRole}`);
      console.log(`  - Type: ${transactionType}`);
      console.log(`  - Shares: ${shares}`);
      console.log(`  - Price: ${price}`);
      console.log(`  - Value: ${value}`);
      
      trades.push({
        id: `${i}-${Date.now()}`,
        ticker: displayTicker,
        insiderName: displayName,
        title: displayRole, // This is the field displayed in the UI
        tradeType: transactionType,
        shares,
        price,
        value,
        filingDate: new Date(updated).toISOString(),
        transactionDate: new Date().toISOString(), // Ideally extract from content
        formType: '4',
        url: link
      });
    }

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
    console.error('[form4Parser] Error parsing Form 4 feed:', err.message);
    
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
    const link = entry.link && entry.link.$ ? entry.link.$.href : '';
    
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
      }
    }

    // Extract transaction details
    const { shares, price, value, tradeType: transactionType } = 
      transactionExtractor.extractTransactionDetails(content);
    
    // Use the better role if available, otherwise fallback to position
    const finalRole = insiderRole !== 'Unknown Position' ? insiderRole : position;
    
    trades.push({
      id: `${i}-${Date.now()}`,
      ticker: ticker || '-',
      insiderName: cleanInsiderName || 'Unknown',
      title: finalRole || 'Unknown Position',
      tradeType: transactionType,
      shares,
      price,
      value,
      filingDate: new Date(updated).toISOString(),
      transactionDate: new Date().toISOString(), // Ideally extract from content
      formType: '4',
      url: link
    });
  }
  
  return trades;
}

/**
 * Fetches the content of a filing from its URL
 * @param {string} url - Filing URL
 * @returns {Promise<string>} - Filing content
 */
async function fetchFilingContent(url) {
  try {
    const response = await axios.get(url, {
      headers: { 
        'User-Agent': 'HRVSTR Financial Analysis Platform (educational purposes) contact@example.com',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000 // 15 second timeout
    });
    
    // Parse the HTML response to extract the filing content
    const $ = cheerio.load(response.data);
    return $('.formContent').text() || $('.miniFormContent').text() || response.data;
  } catch (error) {
    console.error(`[form4Parser] Error fetching filing content: ${error.message}`);
    return ''; // Return empty string on error
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
    // Extract company CIK and name from the title
    const titleMatch = title.match(/4\s*-\s*([^(]+)\s*\((\d+)\)\s*\(([^)]+)\)/i);
    if (titleMatch) {
      const companyName = titleMatch[1].trim();
      const companyCik = titleMatch[2].toString().padStart(10, '0');
      const filerType = titleMatch[3].trim();
      
      // Set the ticker based on filer type
      if (filerType.toLowerCase().includes('reporting')) {
        // It's a reporting person (insider) filing
        // Multiple methods to determine ticker...
        
        // Method 1: Look up directly in SEC database by CIK
        if (!ticker || ticker === '-') {
          // Try to look up the company for this insider if we have a CIK
          if (personCIK) {
            const companyInfo = await getCompanyForInsider(personCIK);
            if (companyInfo && companyInfo.ticker) {
              ticker = companyInfo.ticker;
              console.log(`Found ticker ${ticker} by looking up insider CIK ${personCIK}`);
            }
          }
        }
        
        // Method 2: Try to extract issuer information from the content
        if (!ticker || ticker === '-') {
          const issuerMatch = content.match(/Issuer[^:]*:[^A-Z]*([A-Za-z0-9\s\.\,]+)/i);
          if (issuerMatch) {
            const issuerName = issuerMatch[1].trim();
            // Look up the issuer name in our database
            const upperIssuerName = issuerName.toUpperCase();
            if (secTickersByName[upperIssuerName]) {
              ticker = secTickersByName[upperIssuerName];
              console.log(`Found ticker ${ticker} from issuer name ${issuerName}`);
            }
          }
        }
        
        // Method 3: Try to extract the ticker from the filing
        if (!ticker || ticker === '-') {
          const tickerMatch = content.match(/Issuer[^:]*:[^A-Z]*\(([A-Z]{1,5})\)/i) || 
                             content.match(/Ticker[^:]*:\s*([A-Z]{1,5})/i) ||
                             content.match(/Symbol[^:]*:\s*([A-Z]{1,5})/i);
          if (tickerMatch) {
            ticker = tickerMatch[1].toUpperCase();
            console.log(`Found explicit ticker ${ticker} in content`);
          }
        }
        
        // Method 4: Check our mapping of known reporting persons
        if (!ticker || ticker === '-') {
          if (insiderName && insiderName !== 'Unknown') {
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
                console.log(`Found ticker ${ticker} using name match for ${nameKey}`);
                break;
              }
            }
          }
        }
        
        // Method 5: Last resort - use SEC Edgar Full-Text Search API
        if (!ticker || ticker === '-') {
          try {
            console.log(`🔍 SEC SEARCH API: Looking up issuer for reporting person ${insiderName}...`);
            
            // Use our relationship resolver to find the most likely company
            const issuerInfo = await findIssuerForPerson({ 
              name: insiderName,
              cik: personCIK
            });
            
            if (issuerInfo && issuerInfo.ticker) {
              ticker = issuerInfo.ticker;
              console.log(`✅ SEC SEARCH SUCCESS: Found ticker ${ticker} for ${insiderName} via SEC Search API`);
            }
          } catch (error) {
            console.error(`SEC Search API error for ${insiderName}:`, error.message);
          }
        }
      } else {
        // It's an issuer filing
        if (secTickersByCik[companyCik]) {
          ticker = secTickersByCik[companyCik];
          console.log(`Found ticker ${ticker} for issuer CIK ${companyCik}`);
        } else {
          // Try to get ticker from the company name
          const upperName = companyName.toUpperCase();
          if (secTickersByName[upperName]) {
            ticker = secTickersByName[upperName];
            console.log(`Found ticker ${ticker} for company ${companyName}`);
          }
        }
      }
    }
    
    // Extract insider's title/position
    const roleTitleMatch = content.match(/Director|Officer|10% Owner/i);
    if (roleTitleMatch) {
      position = roleTitleMatch[0];
    } else {
      const positionMatch = content.match(/Title[^:]*:[^A-Z]*([A-Za-z\s\,\.]+)/i);
      if (positionMatch) {
        position = positionMatch[1].trim();
      }
    }

    return { ticker, title: position };
  } catch (error) {
    console.error(`[form4Parser] Error extracting ticker and title: ${error.message}`);
    return { ticker, title: position };
  }
}

module.exports = {
  parseForm4Data
};