/**
 * Position Extractor - Specialized extraction of insider positions and roles
 */

const { lookupInsiderRole, cleanPosition } = require('../utils/form4Utils');
const insiderExtractor = require('../../extractors/insiderExtractor');

/**
 * Extract insider position using multiple detection methods
 * @param {Object} params - Parameters for position extraction
 * @returns {Promise<string>} - Position/role
 */
async function extractPosition(params) {
  const { title, content, insiderName, ticker } = params;
  
  console.log(`[positionExtractor] Starting position extraction for insider: ${insiderName}`);
  
  let position = 'Unknown Position';
  
  // Method 1: Extract from title (filing metadata)
  if (title && position === 'Unknown Position') {
    position = await extractPositionFromTitle(title);
  }
  
  // Method 2: Database role lookup
  if (insiderName && position === 'Unknown Position') {
    position = await extractPositionFromDatabase(insiderName);
  }
  
  // Method 3: Specialized extractor
  if (content && position === 'Unknown Position') {
    position = await extractPositionFromContent(content);
  }
  
  // Method 4: Advanced pattern matching
  if (content && position === 'Unknown Position') {
    position = await extractPositionWithPatterns(content);
  }
  
  // Method 5: Context-based inference
  if (position === 'Unknown Position') {
    position = await inferPositionFromContext(insiderName, ticker);
  }
  
  // Method 6: Generic fallback based on content keywords
  if (content && position === 'Unknown Position') {
    position = await extractPositionFromKeywords(content);
  }
  
  // Clean and validate the final position
  const cleanedPosition = cleanPosition(position);
  
  console.log(`[positionExtractor] Final position result: "${cleanedPosition}"`);
  return cleanedPosition;
}

/**
 * Method 1: Extract position from filing title
 * @param {string} title - Filing title
 * @returns {Promise<string>} - Position or 'Unknown Position'
 */
async function extractPositionFromTitle(title) {
  try {
    if (!title) return 'Unknown Position';
    
    // Pattern: "4 - COMPANY (CIK) (Reporting Person - POSITION)"
    const titlePositionMatch = title.match(/\(Reporting Person[^)]*-\s*([^)]+)\)/i) ||
                              title.match(/\(([^)]*(?:Officer|Director|President|CEO|CFO|COO|CTO|Chairman|Vice President|VP)[^)]*)\)/i);
                              
    if (titlePositionMatch) {
      const position = titlePositionMatch[1].trim();
      console.log(`[positionExtractor] Method 1 SUCCESS: Extracted position from title: "${position}"`);
      return position;
    }
    
    console.log(`[positionExtractor] Method 1 FAILED: No position pattern found in title`);
    return 'Unknown Position';
    
  } catch (error) {
    console.error(`[positionExtractor] Method 1 ERROR: ${error.message}`);
    return 'Unknown Position';
  }
}

/**
 * Method 2: Extract position from database lookup
 * @param {string} insiderName - Insider name
 * @returns {Promise<string>} - Position or 'Unknown Position'
 */
async function extractPositionFromDatabase(insiderName) {
  try {
    const role = lookupInsiderRole(insiderName);
    if (role) {
      console.log(`[positionExtractor] Method 2 SUCCESS: Found role from database: "${role}"`);
      return role;
    }
    
    console.log(`[positionExtractor] Method 2 FAILED: No role found in database for ${insiderName}`);
    return 'Unknown Position';
    
  } catch (error) {
    console.error(`[positionExtractor] Method 2 ERROR: ${error.message}`);
    return 'Unknown Position';
  }
}

/**
 * Method 3: Extract position using specialized extractor
 * @param {string} content - Filing content
 * @returns {Promise<string>} - Position or 'Unknown Position'
 */
async function extractPositionFromContent(content) {
  try {
    const extractedRole = insiderExtractor.extractInsiderRole(content);
    if (extractedRole && extractedRole !== 'Unknown Position') {
      console.log(`[positionExtractor] Method 3 SUCCESS: Extracted role via specialized extractor: "${extractedRole}"`);
      return extractedRole;
    }
    
    console.log(`[positionExtractor] Method 3 FAILED: Specialized extractor found no role`);
    return 'Unknown Position';
    
  } catch (error) {
    console.error(`[positionExtractor] Method 3 ERROR: ${error.message}`);
    return 'Unknown Position';
  }
}

/**
 * Method 4: Extract position using advanced pattern matching
 * @param {string} content - Filing content
 * @returns {Promise<string>} - Position or 'Unknown Position'
 */
async function extractPositionWithPatterns(content) {
  try {
    if (!content) return 'Unknown Position';
    
    // Enhanced pattern matching for positions
    const advancedPatterns = [
      // Standard role patterns with context
      /(?:Title|Position|Role)\s*[:\-]\s*([^,\n\r;]+(?:Officer|Director|President|CEO|CFO|COO|CTO|Chairman|Vice President|VP|Secretary|Treasurer|Manager|Executive)[^,\n\r;]*)/i,
      
      // XML-style tags
      /<(?:title|position|role)>([^<]+)<\/(?:title|position|role)>/i,
      
      // Direct role mentions with boundaries
      /\b(Chief Executive Officer|Chief Financial Officer|Chief Operating Officer|Chief Technology Officer|President|Chairman|Vice President|VP|Director|Secretary|Treasurer|Executive Vice President|Senior Vice President|General Counsel|Chief Marketing Officer|Chief Human Resources Officer|Chief Accounting Officer|10% Owner|Beneficial Owner)\b/i,
      
      // Role indicators in sentences
      /(?:is|serves as|appointed as|acting as|position of)\s+(?:a\s+|an\s+|the\s+)?([^,\n\r;]+(?:Officer|Director|President|CEO|CFO|COO|CTO|Chairman|Vice President|VP|Secretary|Treasurer|Manager|Executive)[^,\n\r;]*)/i,
      
      // Form 4 specific patterns
      /Relationship[^:]*:\s*([^,\n\r;]+)/i,
      /Officer Title[^:]*:\s*([^,\n\r;]+)/i,
      /Director Title[^:]*:\s*([^,\n\r;]+)/i,
      
      // Ownership patterns
      /\b(10\s*%\s*Owner|Ten\s*Percent\s*Owner|Beneficial\s*Owner)\b/i,
      
      // Generic patterns with word boundaries
      /\b([A-Z][a-z]+\s+(?:Officer|Director|President|CEO|CFO|COO|CTO|Chairman|Vice President|VP|Secretary|Treasurer|Manager|Executive))\b/,
      /\b((?:Senior|Executive|Assistant|Deputy)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/,
      
      // Board and committee roles
      /\b(Board\s+(?:Member|Director|Chair|Chairman))\b/i,
      /\b(Committee\s+(?:Member|Chair|Chairman))\b/i,
      
      // Abbreviated titles
      /\b(SVP|EVP|AVP|DVP)\b/i
    ];
    
    for (const pattern of advancedPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const position = match[1].trim();
        
        // Validate the extracted position
        if (isValidPosition(position)) {
          console.log(`[positionExtractor] Method 4 SUCCESS: Found position via advanced pattern: "${position}"`);
          return position;
        }
      }
    }
    
    console.log(`[positionExtractor] Method 4 FAILED: No position found via advanced patterns`);
    return 'Unknown Position';
    
  } catch (error) {
    console.error(`[positionExtractor] Method 4 ERROR: ${error.message}`);
    return 'Unknown Position';
  }
}

/**
 * Method 5: Infer position from context (name patterns, company matching)
 * @param {string} insiderName - Insider name
 * @param {string} ticker - Company ticker
 * @returns {Promise<string>} - Position or 'Unknown Position'
 */
async function inferPositionFromContext(insiderName, ticker) {
  try {
    if (!insiderName) return 'Unknown Position';
    
    // If insider name contains company-like suffixes, it's likely an issuer
    if (/\b(Inc\.?|Corp\.?|Corporation|LLC|Ltd\.?|Co\.?|Company|LP|LLP)\b/i.test(insiderName)) {
      console.log(`[positionExtractor] Method 5 SUCCESS: Inferred position as Issuer based on name pattern`);
      return 'Issuer';
    }
    
    // If name matches ticker, it's likely an issuer  
    if (ticker && ticker !== '-' && insiderName.toUpperCase().includes(ticker)) {
      console.log(`[positionExtractor] Method 5 SUCCESS: Inferred position as Issuer based on ticker match`);
      return 'Issuer';
    }
    
    // Check for common executive name patterns
    const executivePatterns = [
      /\b(CEO|CFO|COO|CTO|President|Chairman)\b/i,
      /\b(Chief\s+\w+\s+Officer)\b/i,
      /\b(Vice\s+President)\b/i
    ];
    
    for (const pattern of executivePatterns) {
      if (pattern.test(insiderName)) {
        const match = insiderName.match(pattern);
        if (match) {
          console.log(`[positionExtractor] Method 5 SUCCESS: Inferred position from name pattern: "${match[0]}"`);
          return match[0];
        }
      }
    }
    
    console.log(`[positionExtractor] Method 5 FAILED: No context-based inference possible`);
    return 'Unknown Position';
    
  } catch (error) {
    console.error(`[positionExtractor] Method 5 ERROR: ${error.message}`);
    return 'Unknown Position';
  }
}

/**
 * Method 6: Extract position from content keywords (generic fallback)
 * @param {string} content - Filing content
 * @returns {Promise<string>} - Position or 'Unknown Position'
 */
async function extractPositionFromKeywords(content) {
  try {
    if (!content) return 'Unknown Position';
    
    const lowerContent = content.toLowerCase();
    
    // Keyword-based detection with priority order
    const keywordMappings = [
      { keywords: ['chief executive officer', 'ceo'], position: 'Chief Executive Officer' },
      { keywords: ['chief financial officer', 'cfo'], position: 'Chief Financial Officer' },
      { keywords: ['chief operating officer', 'coo'], position: 'Chief Operating Officer' },
      { keywords: ['chief technology officer', 'cto'], position: 'Chief Technology Officer' },
      { keywords: ['president'], position: 'President' },
      { keywords: ['chairman', 'chair'], position: 'Chairman' },
      { keywords: ['vice president', 'vp'], position: 'Vice President' },
      { keywords: ['director'], position: 'Director' },
      { keywords: ['secretary'], position: 'Secretary' },
      { keywords: ['treasurer'], position: 'Treasurer' },
      { keywords: ['10%', 'ten percent'], position: '10% Owner' },
      { keywords: ['officer'], position: 'Officer' },
      { keywords: ['executive'], position: 'Executive' }
    ];
    
    for (const mapping of keywordMappings) {
      for (const keyword of mapping.keywords) {
        if (lowerContent.includes(keyword)) {
          console.log(`[positionExtractor] Method 6 SUCCESS: Found position via keyword "${keyword}": "${mapping.position}"`);
          return mapping.position;
        }
      }
    }
    
    console.log(`[positionExtractor] Method 6 FAILED: No position keywords found`);
    return 'Unknown Position';
    
  } catch (error) {
    console.error(`[positionExtractor] Method 6 ERROR: ${error.message}`);
    return 'Unknown Position';
  }
}

/**
 * Validate if extracted position is reasonable
 * @param {string} position - Position to validate
 * @returns {boolean} - True if valid
 */
function isValidPosition(position) {
  if (!position || typeof position !== 'string') {
    return false;
  }
  
  const trimmed = position.trim();
  
  // Too short or empty
  if (trimmed.length < 2) {
    return false;
  }
  
  // Invalid patterns
  const invalidPatterns = [
    /^[^a-zA-Z]*$/,  // No letters
    /^[0-9]+$/,      // Only numbers
    /^\W+$/,         // Only special characters
    /^.{100,}$/,     // Too long (over 100 chars)
    /^(unknown|null|undefined|error)$/i  // Invalid keywords
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Extract position with detailed method tracking
 * @param {Object} params - Parameters for position extraction
 * @returns {Promise<Object>} - Result with position and method used
 */
async function extractPositionWithDetails(params) {
  const methods = [
    { name: 'Title Extraction', func: () => extractPositionFromTitle(params.title) },
    { name: 'Database Lookup', func: () => extractPositionFromDatabase(params.insiderName) },
    { name: 'Content Extractor', func: () => extractPositionFromContent(params.content) },
    { name: 'Pattern Matching', func: () => extractPositionWithPatterns(params.content) },
    { name: 'Context Inference', func: () => inferPositionFromContext(params.insiderName, params.ticker) },
    { name: 'Keyword Detection', func: () => extractPositionFromKeywords(params.content) }
  ];
  
  for (const method of methods) {
    try {
      const position = await method.func();
      if (position && position !== 'Unknown Position') {
        return {
          position: cleanPosition(position),
          method: method.name,
          success: true
        };
      }
    } catch (error) {
      console.error(`[positionExtractor] ${method.name} failed: ${error.message}`);
    }
  }
  
  // Final fallback based on content presence
  let fallbackPosition = 'Unknown Position';
  
  if (params.content && params.content.includes('director')) {
    fallbackPosition = 'Director';
  } else if (params.content && params.content.includes('officer')) {
    fallbackPosition = 'Officer';
  } else if (params.content && params.content.includes('10%')) {
    fallbackPosition = '10% Owner';
  } else {
    fallbackPosition = 'Executive';
  }
  
  return {
    position: fallbackPosition,
    method: 'Generic Fallback',
    success: false
  };
}

/**
 * Batch extract positions for multiple entries
 * @param {Array} entries - Array of parameter objects
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Promise<Array>} - Array of position results
 */
async function batchExtractPositions(entries, progressCallback = null) {
  const results = [];
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    if (progressCallback) {
      progressCallback({
        current: i + 1,
        total: entries.length,
        entry: entry.insiderName || 'Unknown'
      });
    }
    
    try {
      const result = await extractPositionWithDetails(entry);
      results.push({
        ...entry,
        ...result
      });
    } catch (error) {
      console.error(`[positionExtractor] Batch extraction failed for entry ${i}: ${error.message}`);
      results.push({
        ...entry,
        position: 'Unknown Position',
        method: 'Error',
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Get position hierarchy level (for sorting/ranking)
 * @param {string} position - Position title
 * @returns {number} - Hierarchy level (lower = higher ranking)
 */
function getPositionHierarchy(position) {
  const hierarchyMap = {
    'Chief Executive Officer': 1,
    'CEO': 1,
    'President': 2,
    'Chairman': 2,
    'Chief Financial Officer': 3,
    'CFO': 3,
    'Chief Operating Officer': 3,
    'COO': 3,
    'Chief Technology Officer': 4,
    'CTO': 4,
    'Executive Vice President': 5,
    'Senior Vice President': 6,
    'Vice President': 7,
    'VP': 7,
    'Director': 8,
    'Secretary': 9,
    'Treasurer': 9,
    'Officer': 10,
    '10% Owner': 11,
    'Executive': 12,
    'Unknown Position': 99
  };
  
  return hierarchyMap[position] || 50;
}

module.exports = {
  extractPosition,
  extractPositionWithDetails,
  batchExtractPositions,
  getPositionHierarchy,
  isValidPosition
}; 