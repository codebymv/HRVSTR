/**
 * Transaction Extractor - Extracts transaction details from SEC filings
 * 
 * This module specializes in extracting transaction details such as 
 * shares, prices, values, and transaction types from SEC Form 4 filings.
 */

/**
 * Extract transaction details from filing content
 * 
 * @param {string} content - Filing content (full text or summary)
 * @returns {Object} - Object with shares, price, value, and tradeType
 */
function extractTransactionDetails(content) {
  try {
    // Extract transaction type with enhanced patterns
    const tradeType = extractTransactionType(content);
    
    // Extract shares
    const shares = extractShares(content);
    
    // Extract price
    const price = extractPrice(content);
    
    // Extract or calculate total value
    const value = extractValue(content, shares, price);
    
    return { shares, price, value, tradeType };
  } catch (error) {
    console.error(`[transactionExtractor] Error extracting transaction details: ${error.message}`);
    return { shares: 0, price: 0, value: 0, tradeType: 'BUY' };
  }
}

/**
 * Extract transaction type from filing content
 * 
 * @param {string} content - Filing content
 * @returns {string} - Transaction type (BUY or SELL)
 */
function extractTransactionType(content) {
  try {
    // Extract transaction type with enhanced patterns
    const transTypeMatch = content.match(/transaction\\s+code[^:]*:[^A-Z]*(\\w)/i) || 
                          content.match(/Code\\s*\\(Instr\\)\\.?\\s*([PS])/i) ||
                          content.match(/Transaction\\s+Type\\s*:?\\s*([PS])/i) ||
                          content.match(/Transaction\\s+Code\\s*:?\\s*([PS])/i) ||
                          content.match(/Form 4\\s+Transaction\\s+Code\\s*:?\\s*([PS])/i) ||
                          content.match(/Code\\s*:?\\s*([PS])/i);
                          
    let transactionType = 'BUY'; // Default to buy if not found
    if (transTypeMatch) {
      const code = transTypeMatch[1].toUpperCase();
      // S = Sale, P = Purchase, A = Grant/Award, D = Disposition
      if (code === 'S' || code === 'D') {
        transactionType = 'SELL';
      } else if (code === 'P' || code === 'A') {
        transactionType = 'BUY';
      }
      console.log(`Identified transaction type: ${transactionType} from code ${code}`);
    } else {
      // Try to infer from context if no explicit code is found
      if (content.toLowerCase().includes('sale') || 
          content.toLowerCase().includes('sold') || 
          content.toLowerCase().includes('dispose')) {
        transactionType = 'SELL';
        console.log('Inferred SELL transaction type from context');
      } else if (content.toLowerCase().includes('purchase') || 
                content.toLowerCase().includes('bought') || 
                content.toLowerCase().includes('acquire')) {
        transactionType = 'BUY';
        console.log('Inferred BUY transaction type from context');
      }
    }
    
    return transactionType;
  } catch (error) {
    console.error(`[transactionExtractor] Error extracting transaction type: ${error.message}`);
    return 'BUY'; // Default to BUY on error
  }
}

/**
 * Extract number of shares from filing content
 * 
 * @param {string} content - Filing content
 * @returns {number} - Number of shares
 */
function extractShares(content) {
  try {
    // Attempt to extract shares with multiple patterns
    let shares = 0;
    const sharesPatterns = [
      // More specific patterns first
      /shares\\s+acquired[^:]*:\\s*([\\d,]+(\\.\\d+)?)/i,
      /shares\\s+disposed[^:]*:\\s*([\\d,]+(\\.\\d+)?)/i,
      /securities\\s+acquired[^:]*:\\s*([\\d,]+(\\.\\d+)?)/i,
      /securities\\s+disposed[^:]*:\\s*([\\d,]+(\\.\\d+)?)/i,
      /quantity[^:]*:\\s*([\\d,]+(\\.\\d+)?)/i,
      /amount[^:]*:\\s*([\\d,]+(\\.\\d+)?)/i,
      
      // Fallback patterns
      /Non-[Dd]erivative\\s+[Ss]ecurities\\s+[Aa]cquired[^\\n]*?\\s+([\\d,]+(\\.\\d+)?)/i,
      /Number\\s+of\\s+[Ss]hares[^:]*:\\s*([\\d,]+(\\.\\d+)?)/i,
      /Number\\s+of\\s+[Ss]ecurities[^:]*:\\s*([\\d,]+(\\.\\d+)?)/i,
      /[Ss]hares[^:]*:\\s*([\\d,]+(\\.\\d+)?)/i,
      
      // Last resort - just find numbers near certain keywords
      /[Ss]hares.{1,30}?([\\d,]+(\\.\\d+)?)/i,
      /[Aa]cquired.{1,30}?([\\d,]+(\\.\\d+)?)/i,
      /([\\d,]+)\\s*[Ss]hares/i
    ];
    
    for (const pattern of sharesPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        // Remove commas and convert to number
        shares = parseInt(match[1].replace(/,/g, ''));
        if (!isNaN(shares) && shares > 0) {
          console.log(`Found ${shares} shares using pattern ${pattern}`);
          break;
        }
      }
    }
    
    // If no shares found, try to extract from table format
    if (shares === 0) {
      // Look for table-like structures in the content
      const tableMatch = content.match(/Table\s+\d+[^\n]*\n(.*?\n)+?/i);
      if (tableMatch) {
        const tableContent = tableMatch[0];
        // Look for numbers in the table that could be share counts
        const numberMatches = tableContent.match(/\b\d{1,3}(,\d{3})+\b/g);
        if (numberMatches && numberMatches.length > 0) {
          // Use the first large number as a potential share count
          shares = parseInt(numberMatches[0].replace(/,/g, ''));
          console.log(`Extracted ${shares} shares from table structure`);
        }
      }
    }
    
    return shares;
  } catch (error) {
    console.error(`[transactionExtractor] Error extracting shares: ${error.message}`);
    return 0;
  }
}

/**
 * Extract price per share from filing content
 * 
 * @param {string} content - Filing content
 * @returns {number} - Price per share
 */
function extractPrice(content) {
  try {
    let price = 0;
    const pricePatterns = [
      // Common explicit price patterns
      /per\\s+share[^:]*:\\s*[$]?([\\d,.]+)/i,
      /price[^:]*:\\s*[$]?([\\d,.]+)/i,
      /exercise\\s+price[^:]*:\\s*[$]?([\\d,.]+)/i,
      /Price\\s+per\\s+unit[^:]*:\\s*[$]?([\\d,.]+)/i,
      /per\\s+security[^:]*:\\s*[$]?([\\d,.]+)/i,
      
      // More specific transaction price patterns
      /Per\\s+Unit\\s+Price:\\s*[$]?([\\d,.]+)/i,
      /Transaction\\s+Price.{1,30}?[$]?([\\d,.]+)/i,
      /price.{1,20}?[$]?([\\d,.]+)\\s*per/i,
      
      // Last resort patterns
      /[$]([\\d,.]+)/i,
      /([\\d,.]+)\\s*[Dd]ollars/i
    ];
    
    for (const pattern of pricePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        // Remove commas and convert to number
        price = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(price) && price > 0) {
          console.log(`Found price $${price} using pattern ${pattern}`);
          break;
        }
      }
    }
    
    // If no price found, try to calculate from value and shares
    if (price === 0 || isNaN(price)) {
      // Try to extract value first
      const valueMatch = content.match(/total\\s+value[^:]*:\\s*[$]?([\\d,.]+)/i) ||
                        content.match(/transaction\\s+value[^:]*:\\s*[$]?([\\d,.]+)/i);
      
      if (valueMatch && valueMatch[1]) {
        const value = parseFloat(valueMatch[1].replace(/,/g, ''));
        
        // Try to extract shares
        const sharesMatch = content.match(/shares[^:]*:\\s*([\\d,]+)/i);
        if (sharesMatch && sharesMatch[1] && value > 0) {
          const shares = parseInt(sharesMatch[1].replace(/,/g, ''));
          if (shares > 0) {
            price = value / shares;
            console.log(`Calculated price $${price.toFixed(2)} from value $${value} and ${shares} shares`);
          }
        }
      }
    }
    
    return price;
  } catch (error) {
    console.error(`[transactionExtractor] Error extracting price: ${error.message}`);
    return 0;
  }
}

/**
 * Extract or calculate transaction value from filing content
 * 
 * @param {string} content - Filing content
 * @param {number} shares - Number of shares (for calculation if direct extraction fails)
 * @param {number} price - Price per share (for calculation if direct extraction fails)
 * @returns {number} - Transaction value
 */
function extractValue(content, shares, price) {
  try {
    // Extract total value or calculate from shares and price
    let value = 0;
    
    // Try to extract value directly
    const valuePatterns = [
      /total\\s+value[^:]*:\\s*[$]?([\\d,.]+)/i,
      /transaction\\s+value[^:]*:\\s*[$]?([\\d,.]+)/i,
      /total\\s+transaction[^:]*:\\s*[$]?([\\d,.]+)/i,
      /[Aa]mount.{1,20}?[$]?([\\d,.]+)/i,
      /[Vv]alue.{1,20}?[$]?([\\d,.]+)/i,
      /[Tt]otal.{1,20}?[$]?([\\d,.]+)/i
    ];
    
    for (const pattern of valuePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        // Remove commas and convert to number
        value = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(value) && value > 0) {
          console.log(`Found direct transaction value $${value} using pattern ${pattern}`);
          break;
        }
      }
    }
    
    // If we couldn't extract value but have shares and price, calculate it
    if ((value === 0 || isNaN(value)) && shares > 0 && price > 0) {
      value = shares * price;
      console.log(`Calculated transaction value $${value} from shares and price`);
    }
    
    return value;
  } catch (error) {
    console.error(`[transactionExtractor] Error extracting value: ${error.message}`);
    
    // If we have shares and price, calculate value
    if (shares > 0 && price > 0) {
      return shares * price;
    }
    
    return 0;
  }
}

module.exports = {
  extractTransactionDetails,
  extractTransactionType,
  extractShares,
  extractPrice,
  extractValue
};