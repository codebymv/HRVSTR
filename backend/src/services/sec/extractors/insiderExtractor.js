/**
 * Insider Extractor - Extracts insider information from SEC filings
 * 
 * This module specializes in extracting insider names, relationships,
 * and other relevant information from SEC Form 4 filings.
 */

/**
 * Extract insider details from filing title, summary, and content
 * 
 * @param {string} title - Filing title from SEC RSS feed
 * @param {string} summary - Filing summary from SEC RSS feed
 * @param {string} content - Filing content (full text or summary)
 * @returns {Object} - Object with insiderName and personCIK
 */
function extractInsiderDetails(title, summary, content) {
  // Default values
  let insiderName = 'Unknown';
  let personCIK = null;
  
  try {
    // Extract insider name from title
    const titleMatch = title.match(/(.*?)\s+\(([0-9]+)\)\s+\(Reporting\)/) || 
                       title.match(/(.*?)\s+\(([0-9]+)\).*?Reporting/);
    
    if (titleMatch) {
      insiderName = titleMatch[1].trim();
      personCIK = titleMatch[2];
      console.log(`Found insider name ${insiderName} from title with CIK ${personCIK}`);
    } else {
      // Alternative pattern matching for the title
      const altMatch = title.match(/(.*?)\s+\(([0-9]+)\)/) || 
                      title.match(/for (.+?) \([^)]+\)/) ||
                      title.match(/^([^(\/:]+)\s+\-/); // Simple name before dash
      
      if (altMatch && altMatch[1]) {
        insiderName = altMatch[1].trim();
        personCIK = altMatch[2] || null;
        console.log(`Found insider name ${insiderName} from alternate title pattern`);
      }
    }
    
    // If we still have Unknown and the title contains part of a name, extract it
    if (insiderName === 'Unknown') {
      // Try to extract from summary text if insider name is unknown
      const summaryInsiderMatch = summary.match(/Reporting Person:\s*([^\n(]+)/) ||
                                 summary.match(/filed by:\s*([^\n(]+)/) ||
                                 summary.match(/by ([^(\n:]+)[(:]/i);
                                 
      if (summaryInsiderMatch && summaryInsiderMatch[1]) {
        insiderName = summaryInsiderMatch[1].trim();
        console.log(`Found insider name ${insiderName} from summary`);
      } else {
        // Last resort - try to extract from content
        const contentInsiderMatch = content.match(/Reporting Person:\s*([^\n(]+)/) ||
                                   content.match(/NAME OF REPORTING PERSON\s*(.+?)\s*\n/) ||
                                   content.match(/filed by:\s*([^\n(]+)/);
        
        if (contentInsiderMatch && contentInsiderMatch[1]) {
          insiderName = contentInsiderMatch[1].trim();
          console.log(`Found insider name ${insiderName} from content`);
        }
      }
    }
    
    // Clean up the extracted name
    if (insiderName !== 'Unknown') {
      // Remove any "Form 4" text or special characters from the name
      insiderName = insiderName.replace(/\bForm\s*4\b/i, '').replace(/[\*\^\+\=]/g, '').trim();
      
      // If name is unusually long, try to extract just the actual name part
      if (insiderName.length > 40) {
        const shorterName = insiderName.split(/[,\-\(]/)[0].trim();
        if (shorterName.length >= 3) {
          console.log(`Shortened long insider name from ${insiderName} to ${shorterName}`);
          insiderName = shorterName;
        }
      }
    }
    
    return { insiderName, personCIK };
  } catch (error) {
    console.error(`[insiderExtractor] Error extracting insider details: ${error.message}`);
    return { insiderName: 'Unknown', personCIK: null };
  }
}

/**
 * Extract insider's role/position from filing content
 * 
 * @param {string} content - Filing content
 * @returns {string} - Insider role/position
 */
function extractInsiderRole(content) {
  try {
    // Default role if nothing else is found
    let role = 'Unknown Position';
    
    // Enhanced role mapping for common abbreviations and titles
    const roleMapping = {
      'md': 'Managing Director',
      'ceo': 'Chief Executive Officer',
      'cfo': 'Chief Financial Officer',
      'coo': 'Chief Operating Officer',
      'cto': 'Chief Technology Officer',
      'vp': 'Vice President',
      'evp': 'Executive Vice President',
      'svp': 'Senior Vice President',
      'pao': 'Principal Accounting Officer',
      'gc': 'General Counsel',
      'chair': 'Chairman',
      'chairperson': 'Chairman',
      'pres': 'President',
      'treas': 'Treasurer',
      'sec': 'Secretary',
      'dir': 'Director',
      'officer': 'Officer',
      'director': 'Director',
      'trustee': 'Trustee',
      'partner': 'Partner',
      'founder': 'Founder',
      'owner': '10% Owner',
      '10%': '10% Owner',
      'ten percent': '10% Owner'
    };
    
    // Helper function to decode HTML entities and clean text
    function cleanExtractedRole(text) {
      if (!text) return '';
      
      // Decode common HTML entities
      const decoded = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
      
      // Clean up whitespace and normalize
      return decoded.replace(/\s+/g, ' ').trim();
    }
    
    // Helper function to validate if extracted text is a real position
    function isValidPosition(text) {
      if (!text || text.length < 3) return false;
      
      // Reject document titles and form references
      const invalidPatterns = [
        /\bsec\s*form\s*4\b/i,
        /\bform\s*4\b/i,
        /\bdocument\b/i,
        /\bxml\b/i,
        /\bhtml\b/i,
        /\bfiling\b/i,
        /\btitle\b/i,
        /\bheader\b/i,
        /\bpage\b/i
      ];
      
      return !invalidPatterns.some(pattern => pattern.test(text));
    }
    
    // Clean the content for better pattern matching
    const cleanContent = content.toLowerCase().replace(/[^\w\s]/g, ' ');
    
    // FIRST: Check for XML boolean flags specifically (these need special handling)
    if (content.includes('isDirector') && (content.includes('>true<') || content.includes('="true"') || /isDirector[^>]*>[^<]*true/i.test(content))) {
      role = 'Director';
      console.log('Detected Director role from XML isDirector flag');
      return role;
    } else if (content.includes('isOfficer') && (content.includes('>true<') || content.includes('="true"') || /isOfficer[^>]*>[^<]*true/i.test(content))) {
      role = 'Officer';
      console.log('Detected Officer role from XML isOfficer flag');
      return role;
    } else if (content.includes('isTenPercentOwner') && (content.includes('>true<') || content.includes('="true"') || /isTenPercentOwner[^>]*>[^<]*true/i.test(content))) {
      role = '10% Owner';
      console.log('Detected 10% Owner role from XML isTenPercentOwner flag');
      return role;
    }
    
    // Enhanced pattern matching for roles in various contexts
    const rolePatterns = [
      // XML-specific patterns for actual position fields (not document titles)
      /<officertitle[^>]*>([^<]+)<\/officertitle>/i,
      /<directortitle[^>]*>([^<]+)<\/directortitle>/i,
      /<positiontitle[^>]*>([^<]+)<\/positiontitle>/i,
      /<relationship[^>]*>([^<]+)<\/relationship>/i,
      
      // Text-based patterns with better context
      /\bofficer\s+title[:\s]+([^.\n]+)/i,
      /\bdirector\s+title[:\s]+([^.\n]+)/i,
      /\bposition[:\s]+([^.\n]+)/i,
      /\brole[:\s]+([^.\n]+)/i,
      /\btitle[:\s]+([^.\n]+)/i,
      
      // Common role patterns with capture groups
      /\b(chief\s+executive\s+officer|ceo)\b/i,
      /\b(chief\s+financial\s+officer|cfo)\b/i,
      /\b(chief\s+operating\s+officer|coo)\b/i,
      /\b(chief\s+technology\s+officer|cto)\b/i,
      /\b(managing\s+director|md)\b/i,
      /\b(vice\s+president|vp)\b/i,
      /\b(executive\s+vice\s+president|evp)\b/i,
      /\b(senior\s+vice\s+president|svp)\b/i,
      /\b(chairman)\b/i,
      /\b(chairperson)\b/i,
      /\b(president)\b/i,
      /\b(treasurer)\b/i,
      /\b(secretary)\b/i,
      /\b(director)\b/i,
      /\b(officer)\b/i,
      /\b(trustee)\b/i,
      /\b(partner)\b/i,
      /\b(founder)\b/i,
      /\b(10\s*%\s*owner)\b/i,
      /\b(ten\s*percent\s*owner)\b/i
    ];
    
    // Try each pattern
    for (const pattern of rolePatterns) {
      const match = content.match(pattern);
      if (match) {
        let foundRole = match[1] || match[0];
        foundRole = cleanExtractedRole(foundRole);
        
        console.log(`Found role pattern: "${foundRole}" using pattern: ${pattern}`);
        
        // Validate that this is actually a position, not a document title
        if (!isValidPosition(foundRole)) {
          console.log(`Rejected invalid position: "${foundRole}"`);
          continue;
        }
        
        // Convert to lowercase for mapping check
        const lowerRole = foundRole.toLowerCase();
        
        // Check if it's a mapped abbreviation
        if (roleMapping[lowerRole]) {
          role = roleMapping[lowerRole];
          console.log(`Mapped "${foundRole}" to "${role}"`);
          break;
        }
        
        // Clean up and capitalize properly
        if (foundRole.length >= 3 && foundRole.length <= 50) {
          // Clean up any remaining XML artifacts
          foundRole = foundRole.replace(/[<>]/g, '').replace(/\btrue\b/g, '').trim();
          
          // Skip if it's still mostly XML junk
          if (foundRole.includes('>') || foundRole.includes('<') || foundRole.includes('xml')) {
            continue;
          }
          
          // Properly capitalize the role
          role = foundRole
            .split(' ')
            .map(word => {
              // Handle special cases like & and common abbreviations
              if (word === '&') return '&';
              if (word.toUpperCase() === 'CEO' || word.toUpperCase() === 'CFO' || 
                  word.toUpperCase() === 'COO' || word.toUpperCase() === 'CTO') {
                return word.toUpperCase();
              }
              return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join(' ');
          console.log(`Cleaned role: "${role}"`);
          break;
        }
      }
    }
    
    // Final fallback: look for context clues
    if (role === 'Unknown Position') {
      const contextClues = [
        { pattern: /\bissuer\b/i, role: 'Issuer' },
        { pattern: /\bboard\s*member\b/i, role: 'Board Member' },
        { pattern: /\bexecutive\b/i, role: 'Executive' },
        { pattern: /\bmember\b/i, role: 'Board Member' },
        { pattern: /\bmanager\b/i, role: 'Manager' },
        { pattern: /\banalyst\b/i, role: 'Analyst' }
      ];
      
      for (const clue of contextClues) {
        if (clue.pattern.test(content)) {
          role = clue.role;
          console.log(`Assigned role "${role}" based on context clue`);
          break;
        }
      }
    }
    
    // If still unknown, try to infer from company indicators
    if (role === 'Unknown Position') {
      // If content suggests this is a company/entity filing
      if (/\b(inc|corp|corporation|llc|ltd|company|holding|fund|trust|group)\b/i.test(content)) {
        role = 'Entity/Issuer';
        console.log('Assigned "Entity/Issuer" role based on company indicators');
      } else {
        // Default for individual persons
        role = 'Executive';
        console.log('Assigned default "Executive" role for individual');
      }
    }
    
    console.log(`Final extracted role: ${role}`);
    return role;
  } catch (error) {
    console.error(`[insiderExtractor] Error extracting role: ${error.message}`);
    return 'Executive'; // Default fallback
  }
}

module.exports = {
  extractInsiderDetails,
  extractInsiderRole
};