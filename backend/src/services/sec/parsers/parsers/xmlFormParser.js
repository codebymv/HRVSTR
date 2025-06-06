/**
 * XML Form Parser - Specialized parsing of XML/RSS feeds for Form 4 filings
 */

const cheerio = require('cheerio');
const xml2js = require('xml2js');
const { isForm4Filing } = require('../utils/form4Utils');

/**
 * Parse XML data using xml2js with cheerio fallback
 * @param {string} xmlData - Raw XML data from SEC EDGAR RSS feed
 * @param {number} limit - Maximum number of entries to parse
 * @returns {Promise<Array>} - Array of parsed RSS entries
 */
async function parseXmlFeed(xmlData, limit) {
  try {
    console.log(`[xmlFormParser] Starting XML feed parsing, data length: ${xmlData?.length || 0}, limit: ${limit}`);
    
    // First try xml2js for more reliable parsing
    try {
      console.log(`[xmlFormParser] Attempting xml2js parsing...`);
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xmlData);
      
      if (result && result.feed && result.feed.entry) {
        const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
        console.log(`[xmlFormParser] xml2js success: found ${entries.length} entries`);
        
        return processXml2jsEntries(entries, limit);
      }
    } catch (xmlError) {
      console.error('[xmlFormParser] xml2js parsing failed, falling back to cheerio:', xmlError.message);
    }
    
    // Fall back to cheerio if xml2js fails
    console.log(`[xmlFormParser] Using cheerio fallback...`);
    return parseWithCheerio(xmlData, limit);
    
  } catch (error) {
    console.error(`[xmlFormParser] Error parsing XML feed: ${error.message}`);
    return [];
  }
}

/**
 * Process entries parsed by xml2js
 * @param {Array} entries - Array of entry objects from xml2js
 * @param {number} limit - Maximum number of entries to process
 * @returns {Array} - Array of standardized entry objects
 */
function processXml2jsEntries(entries, limit) {
  const processedEntries = [];
  
  for (let i = 0; i < Math.min(entries.length, limit); i++) {
    const entry = entries[i];
    
    // Skip non-Form 4 entries
    if (!isForm4Filing(entry.title)) {
      console.log(`[xmlFormParser] Skipping non-Form 4 entry: ${entry.title}`);
      continue;
    }
    
    const processedEntry = {
      index: i,
      title: entry.title || '',
      summary: entry.summary || '',
      updated: entry.updated || '',
      published: entry.published || '', // This might be the actual filing date
      link: extractLinkFromEntry(entry),
      parser: 'xml2js'
    };
    
    // Log available date fields for debugging
    console.log(`[xmlFormParser] Entry #${i+1} Date Fields:`, {
      title: processedEntry.title.substring(0, 80),
      updated: processedEntry.updated,
      published: processedEntry.published,
      hasPublished: !!processedEntry.published
    });
    
    processedEntries.push(processedEntry);
  }
  
  console.log(`[xmlFormParser] Processed ${processedEntries.length} xml2js entries`);
  return processedEntries;
}

/**
 * Parse XML data using cheerio
 * @param {string} xmlData - Raw XML data
 * @param {number} limit - Maximum number of entries to parse
 * @returns {Array} - Array of standardized entry objects
 */
function parseWithCheerio(xmlData, limit) {
  try {
    const $ = cheerio.load(xmlData, { xmlMode: true });
    const entries = $('entry');
    const processedEntries = [];
    const totalEntries = Math.min(entries.length, limit);

    console.log(`[xmlFormParser] Cheerio found ${entries.length} entries, processing ${totalEntries}`);

    for (let i = 0; i < totalEntries; i++) {
      const entry = entries.eq(i);
      const title = entry.find('title').text();
      
      // Skip non-Form 4 entries
      if (!isForm4Filing(title)) {
        console.log(`[xmlFormParser] Skipping non-Form 4 entry: ${title}`);
        continue;
      }
      
      const summary = entry.find('summary').text();
      const updated = entry.find('updated').text();
      const published = entry.find('published').text();
      const link = entry.find('link').attr('href');
      
      const processedEntry = {
        index: i,
        title: title || '',
        summary: summary || '',
        updated: updated || '',
        published: published || '',
        link: link || '',
        parser: 'cheerio'
      };
      
      // Log available date fields for debugging
      console.log(`[xmlFormParser] Entry #${i+1} Date Fields:`, {
        title: processedEntry.title.substring(0, 60),
        updated: processedEntry.updated,
        published: processedEntry.published,
        hasPublished: !!processedEntry.published
      });
      
      processedEntries.push(processedEntry);
    }
    
    console.log(`[xmlFormParser] Processed ${processedEntries.length} cheerio entries`);
    return processedEntries;
    
  } catch (error) {
    console.error(`[xmlFormParser] Error in cheerio parsing: ${error.message}`);
    return [];
  }
}

/**
 * Extract link href from xml2js entry object
 * @param {Object} entry - Entry object from xml2js
 * @returns {string} - Link href or empty string
 */
function extractLinkFromEntry(entry) {
  try {
    if (entry.link) {
      // Handle different link formats
      if (typeof entry.link === 'string') {
        return entry.link;
      } else if (entry.link.$ && entry.link.$.href) {
        return entry.link.$.href;
      } else if (entry.link.href) {
        return entry.link.href;
      } else if (Array.isArray(entry.link) && entry.link[0]) {
        return extractLinkFromEntry({ link: entry.link[0] });
      }
    }
    
    return '';
  } catch (error) {
    console.error(`[xmlFormParser] Error extracting link: ${error.message}`);
    return '';
  }
}

/**
 * Validate RSS entry structure
 * @param {Object} entry - RSS entry to validate
 * @returns {Object} - Validation result
 */
function validateRssEntry(entry) {
  const validation = {
    isValid: true,
    warnings: [],
    errors: []
  };
  
  // Check required fields
  if (!entry.title || entry.title.trim().length === 0) {
    validation.errors.push('Entry title is missing or empty');
    validation.isValid = false;
  }
  
  if (!entry.link || entry.link.trim().length === 0) {
    validation.errors.push('Entry link is missing or empty');
    validation.isValid = false;
  }
  
  // Check date fields
  if (!entry.updated && !entry.published) {
    validation.warnings.push('No date fields available (updated or published)');
  }
  
  // Validate dates if present
  if (entry.updated) {
    const updatedDate = new Date(entry.updated);
    if (isNaN(updatedDate.getTime())) {
      validation.warnings.push('Updated date is not valid');
    }
  }
  
  if (entry.published) {
    const publishedDate = new Date(entry.published);
    if (isNaN(publishedDate.getTime())) {
      validation.warnings.push('Published date is not valid');
    }
  }
  
  // Check summary length
  if (entry.summary && entry.summary.length < 50) {
    validation.warnings.push('Summary seems too short, might not contain full filing data');
  }
  
  return validation;
}

/**
 * Parse and validate multiple RSS entries
 * @param {string} xmlData - Raw XML data
 * @param {number} limit - Maximum number of entries to parse
 * @param {Function} validationCallback - Optional callback for validation results
 * @returns {Promise<Object>} - Parse results with entries and validation info
 */
async function parseXmlFeedWithValidation(xmlData, limit, validationCallback = null) {
  try {
    const entries = await parseXmlFeed(xmlData, limit);
    const validationResults = [];
    const validEntries = [];
    
    for (const entry of entries) {
      const validation = validateRssEntry(entry);
      validationResults.push({
        entry: entry.title.substring(0, 50),
        ...validation
      });
      
      if (validationCallback) {
        validationCallback(validation, entry);
      }
      
      if (validation.isValid) {
        validEntries.push(entry);
      } else {
        console.warn(`[xmlFormParser] Invalid entry excluded: ${entry.title}`);
      }
    }
    
    return {
      entries: validEntries,
      totalParsed: entries.length,
      validCount: validEntries.length,
      invalidCount: entries.length - validEntries.length,
      validationResults
    };
    
  } catch (error) {
    console.error(`[xmlFormParser] Error in validated parsing: ${error.message}`);
    return {
      entries: [],
      totalParsed: 0,
      validCount: 0,
      invalidCount: 0,
      validationResults: [],
      error: error.message
    };
  }
}

/**
 * Extract RSS feed metadata
 * @param {string} xmlData - Raw XML data
 * @returns {Object} - RSS feed metadata
 */
function extractFeedMetadata(xmlData) {
  try {
    const $ = cheerio.load(xmlData, { xmlMode: true });
    
    return {
      title: $('feed > title').text() || $('rss > channel > title').text() || '',
      description: $('feed > subtitle').text() || $('rss > channel > description').text() || '',
      lastUpdated: $('feed > updated').text() || $('rss > channel > lastBuildDate').text() || '',
      generator: $('feed > generator').text() || $('rss > channel > generator').text() || '',
      link: $('feed > link[rel="self"]').attr('href') || $('rss > channel > link').text() || '',
      totalEntries: $('entry').length || $('item').length || 0,
      feedType: xmlData.includes('<feed') ? 'atom' : 'rss'
    };
  } catch (error) {
    console.error(`[xmlFormParser] Error extracting feed metadata: ${error.message}`);
    return {
      title: '',
      description: '',
      lastUpdated: '',
      generator: '',
      link: '',
      totalEntries: 0,
      feedType: 'unknown'
    };
  }
}

/**
 * Parse specific entry by index
 * @param {string} xmlData - Raw XML data
 * @param {number} entryIndex - Index of entry to parse
 * @returns {Promise<Object|null>} - Parsed entry or null
 */
async function parseSpecificEntry(xmlData, entryIndex) {
  try {
    const allEntries = await parseXmlFeed(xmlData, entryIndex + 10); // Parse a bit extra to ensure we get the target
    
    if (entryIndex < allEntries.length) {
      return allEntries[entryIndex];
    }
    
    console.warn(`[xmlFormParser] Entry index ${entryIndex} not found (total entries: ${allEntries.length})`);
    return null;
    
  } catch (error) {
    console.error(`[xmlFormParser] Error parsing specific entry: ${error.message}`);
    return null;
  }
}

/**
 * Count total Form 4 entries in feed without full parsing
 * @param {string} xmlData - Raw XML data
 * @returns {number} - Count of Form 4 entries
 */
function countForm4Entries(xmlData) {
  try {
    const $ = cheerio.load(xmlData, { xmlMode: true });
    let count = 0;
    
    $('entry').each((i, elem) => {
      const title = $(elem).find('title').text();
      if (isForm4Filing(title)) {
        count++;
      }
    });
    
    console.log(`[xmlFormParser] Found ${count} Form 4 entries in feed`);
    return count;
  } catch (error) {
    console.error(`[xmlFormParser] Error counting Form 4 entries: ${error.message}`);
    return 0;
  }
}

module.exports = {
  parseXmlFeed,
  parseXmlFeedWithValidation,
  parseSpecificEntry,
  extractFeedMetadata,
  countForm4Entries,
  validateRssEntry
}; 