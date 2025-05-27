/**
 * SEC Relationship Resolver
 * Resolves relationships between SEC entities (e.g., reporting persons and issuers)
 * using the SEC EDGAR Full-Text Search API
 */
const { searchSecFilings } = require('./searchUtil');
const { secTickersByCik, secTickersByName } = require('./companyDatabase');
const cacheUtils = require('../../utils/cache');

/**
 * Find the issuer (company) for a reporting person using SEC EDGAR search
 * 
 * @param {Object} personInfo - Information about the reporting person
 * @param {string} [personInfo.name] - The reporting person's name
 * @param {string} [personInfo.cik] - The reporting person's CIK
 * @returns {Promise<Object>} - Information about the issuer (company)
 */
async function findIssuerForPerson(personInfo = {}) {
  const { name, cik } = personInfo;
  
  if (!name && !cik) {
    throw new Error('Either name or CIK must be provided to find issuer');
  }
  
  // Generate cache key
  const cacheKey = `person-${cik || name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  
  // Check cache first
  if (cacheUtils.hasCachedItem('sec-relationships', cacheKey)) {
    console.log(`[relationshipResolver] Using cached issuer for ${name || cik}`);
    return cacheUtils.getCachedItem('sec-relationships', cacheKey);
  }
  
  // Construct search query - prioritize CIK if available
  let query;
  if (cik) {
    query = `rptOwnerCik:${cik} AND formType:4`;
  } else {
    // Format name for search - use quotes for exact match
    const formattedName = `"${name.replace(/['"]/g, '')}"`;
    query = `rptOwnerName:${formattedName} AND formType:4`;
  }
  
  console.log(`[relationshipResolver] Finding issuer for ${name || cik}`);
  
  try {
    // Search for Form 4 filings by this person
    const searchResults = await searchSecFilings(query, { 
      category: 'form-4',
      size: 20, // Get more results for better analysis
      cacheTtl: 7 * 24 * 60 * 60 * 1000 // Cache for 1 week
    });
    
    // Extract issuers from search results
    const issuers = extractIssuersFromResults(searchResults);
    
    if (issuers.length === 0) {
      console.log(`[relationshipResolver] No issuers found for ${name || cik}`);
      return null;
    }
    
    // Find the most frequent issuer
    const primaryIssuer = findMostFrequentIssuer(issuers);
    
    // Get ticker symbol from our database
    if (primaryIssuer.cik && secTickersByCik[primaryIssuer.cik]) {
      primaryIssuer.ticker = secTickersByCik[primaryIssuer.cik];
    } else if (primaryIssuer.name) {
      const upperName = primaryIssuer.name.toUpperCase();
      if (secTickersByName[upperName]) {
        primaryIssuer.ticker = secTickersByName[upperName];
      }
    }
    
    // Cache the result
    cacheUtils.setCachedItem('sec-relationships', cacheKey, primaryIssuer, 30 * 24 * 60 * 60 * 1000); // 30 days
    
    console.log(`[relationshipResolver] Found issuer ${primaryIssuer.name} (${primaryIssuer.ticker || 'no ticker'}) for ${name || cik}`);
    return primaryIssuer;
  } catch (error) {
    console.error(`[relationshipResolver] Error finding issuer for ${name || cik}:`, error.message);
    return null;
  }
}

/**
 * Extract issuer information from search results
 * 
 * @param {Object} searchResults - The search results from SEC EDGAR
 * @returns {Array} - Array of issuer objects
 */
function extractIssuersFromResults(searchResults) {
  if (!searchResults.hits || !searchResults.hits.hits || searchResults.hits.hits.length === 0) {
    return [];
  }
  
  // Extract issuer info from each hit
  return searchResults.hits.hits.map(hit => {
    const filing = hit._source;
    
    // Extract issuer info
    const issuerInfo = {
      cik: filing.issuerCik || filing.cik,
      name: filing.issuerName || filing.companyName,
      filingCount: 1
    };
    
    return issuerInfo;
  }).filter(issuer => issuer.cik || issuer.name); // Filter out empty issuers
}

/**
 * Find the most frequent issuer in a list of issuers
 * 
 * @param {Array} issuers - Array of issuer objects
 * @returns {Object} - The most frequent issuer
 */
function findMostFrequentIssuer(issuers) {
  // Group issuers by CIK
  const issuersByCik = {};
  
  issuers.forEach(issuer => {
    const key = issuer.cik || issuer.name;
    if (!key) return;
    
    if (!issuersByCik[key]) {
      issuersByCik[key] = issuer;
    } else {
      issuersByCik[key].filingCount += issuer.filingCount;
    }
  });
  
  // Find the issuer with the highest filing count
  let mostFrequent = null;
  let maxCount = 0;
  
  Object.values(issuersByCik).forEach(issuer => {
    if (issuer.filingCount > maxCount) {
      mostFrequent = issuer;
      maxCount = issuer.filingCount;
    }
  });
  
  return mostFrequent;
}

module.exports = {
  findIssuerForPerson
};
