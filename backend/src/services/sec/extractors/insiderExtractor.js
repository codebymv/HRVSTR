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
    
    // Common executive titles to look for
    const commonTitles = [
      // C-suite
      'Chief Executive Officer', 'CEO', 'Chief Financial Officer', 'CFO',
      'Chief Operating Officer', 'COO', 'Chief Technology Officer', 'CTO',
      // Directors and officers
      'Director', 'Board Member', 'Chairman', 'Chairperson', 'Chair',
      'President', 'Vice President', 'VP', 'Executive Vice President', 'EVP',
      'Senior Vice President', 'SVP', 'Managing Director', 'MD',
      // Other roles
      'Treasurer', 'Secretary', 'General Counsel', 'Controller',
      '10% Owner', 'Principal Accounting Officer', 'PAO'
    ];
    
    // First, try to find a common title directly in the content
    const titlePattern = new RegExp(`(${commonTitles.join('|')})`, 'i');
    const directMatch = content.match(titlePattern);
    
    if (directMatch) {
      role = directMatch[1];
      console.log(`Found role directly in content: ${role}`);
    } else {
      // Next, try to extract from specific title fields
      const titleFieldPatterns = [
        /\bTitle\b[^:]*:\s*([^\n]+)/i,
        /\bPosition\b[^:]*:\s*([^\n]+)/i,
        /Relationship[^:]*:\s*([^\n]+)/i,
        /Relationship of Reporting Person[^:]*:\s*([^\n]+)/i,
        /\bOfficer\b[^:]*:\s*([^\n]+)/i,
        /\bRole\b[^:]*:\s*([^\n]+)/i
      ];
      
      for (const pattern of titleFieldPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          const extractedRole = match[1].trim();
          if (extractedRole && extractedRole.length < 50) { // Sanity check on length
            role = extractedRole;
            console.log(`Found role in title field: ${role}`);
            break;
          }
        }
      }
      
      // If we still don't have a good title, look for individual words that indicate a role
      if (role === 'Unknown Position') {
        // Look for keywords that might indicate a role
        const roleKeywords = [
          'director', 'officer', 'executive', 'president', 'chief', 'chairman', 
          'owner', 'principal', 'vice', 'senior', 'managing', 'general', 'counsel',
          'secretary', 'treasurer', 'controller', 'member', 'partner', 'trustee'
        ];
        
        for (const keyword of roleKeywords) {
          const keywordPattern = new RegExp(`\\b${keyword}\\b[^\\n\\r,.]*`, 'i');
          const match = content.match(keywordPattern);
          if (match) {
            role = match[0].trim();
            console.log(`Found role using keyword '${keyword}': ${role}`);
            break;
          }
        }
      }
    }
    
    // Clean up the role if we found something
    if (role !== 'Unknown Position') {
      // Remove any Form 4 text
      role = role.replace(/\bForm\s*4\b/i, '').trim();
      
      // Capitalize first letter of each word for consistency
      role = role.split(' ').map(word => {
        if (word.length > 0) {
          return word[0].toUpperCase() + word.substring(1).toLowerCase();
        }
        return word;
      }).join(' ');
    }
    
    return role;
  } catch (error) {
    console.error(`[insiderExtractor] Error extracting insider role: ${error.message}`);
    return 'Unknown Position';
  }
}

module.exports = {
  extractInsiderDetails,
  extractInsiderRole
};