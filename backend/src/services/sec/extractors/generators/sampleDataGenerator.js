/**
 * Sample Data Generator - Generates realistic sample transaction data for testing/development
 * 
 * WARNING: This should NEVER be used as production fallback data.
 * It's only for testing the refactored extraction components.
 */

/**
 * Generate sample transaction data for testing
 * @returns {Object} - Sample transaction data clearly marked as test data
 */
function generateSampleTransactionData() {
  const tradeTypes = ['BUY', 'SELL'];
  const tradeType = tradeTypes[Math.floor(Math.random() * tradeTypes.length)];
  
  const shares = Math.floor(Math.random() * 5000) + 100;
  const price = Math.round((Math.random() * 200 + 10) * 100) / 100;
  const value = shares * price;
  
  return {
    shares,
    price,
    value,
    tradeType,
    _isTestData: true,
    _generated: new Date().toISOString(),
    _warning: 'This is test data - not real transaction information'
  };
}

/**
 * Generate realistic transaction data with weighted probabilities
 * @param {string} preferredType - Preferred transaction type ('BUY' or 'SELL')
 * @returns {Object} - Sample transaction data
 */
function generateRealisticTransactionData(preferredType = null) {
  // Realistic share ranges based on common insider transactions
  const shareRanges = [
    { min: 100, max: 1000, weight: 0.4 },      // Small transactions
    { min: 1000, max: 10000, weight: 0.35 },   // Medium transactions  
    { min: 10000, max: 100000, weight: 0.2 },  // Large transactions
    { min: 100000, max: 500000, weight: 0.05 } // Very large transactions
  ];
  
  // Realistic price ranges
  const priceRanges = [
    { min: 1, max: 25, weight: 0.3 },     // Low-priced stocks
    { min: 25, max: 100, weight: 0.4 },   // Mid-range stocks
    { min: 100, max: 500, weight: 0.25 }, // High-priced stocks
    { min: 500, max: 2000, weight: 0.05 } // Very high-priced stocks
  ];
  
  // Select weighted random share count
  const shareRange = selectWeightedRandom(shareRanges);
  const shares = Math.floor(Math.random() * (shareRange.max - shareRange.min) + shareRange.min);
  
  // Select weighted random price
  const priceRange = selectWeightedRandom(priceRanges);
  const price = Math.round((Math.random() * (priceRange.max - priceRange.min) + priceRange.min) * 100) / 100;
  
  const value = shares * price;
  
  const tradeType = preferredType || (Math.random() > 0.6 ? 'SELL' : 'BUY'); // Slight buy bias
  
  return {
    shares,
    price,
    value,
    tradeType,
    _isTestData: true,
    _generated: new Date().toISOString(),
    _warning: 'This is test data - not real transaction information'
  };
}

/**
 * Generate scenario-based test data
 * @param {string} scenario - Scenario type ('option-grant', 'large-sale', 'regular-purchase', etc.)
 * @returns {Object} - Scenario-specific sample data
 */
function generateScenarioData(scenario) {
  const baseData = {
    _isTestData: true,
    _scenario: scenario,
    _generated: new Date().toISOString(),
    _warning: 'This is test data - not real transaction information'
  };
  
  switch (scenario) {
    case 'option-grant':
      return {
        ...baseData,
        shares: Math.floor(Math.random() * 50000) + 5000,
        price: 0, // Options often have no price at grant
        value: 0,
        tradeType: 'GRANT',
        transactionNote: 'Stock option grant'
      };
      
    case 'large-sale':
      return {
        ...baseData,
        shares: Math.floor(Math.random() * 100000) + 25000,
        price: Math.round((Math.random() * 150 + 50) * 100) / 100,
        value: 0, // Will be calculated
        tradeType: 'SELL'
      };
      
    case 'regular-purchase':
      return {
        ...baseData,
        shares: Math.floor(Math.random() * 5000) + 100,
        price: Math.round((Math.random() * 100 + 20) * 100) / 100,
        value: 0, // Will be calculated
        tradeType: 'BUY'
      };
      
    case 'restricted-stock':
      return {
        ...baseData,
        shares: Math.floor(Math.random() * 10000) + 1000,
        price: 0,
        value: 0,
        tradeType: 'AWARD',
        transactionNote: 'Restricted stock award'
      };
      
    default:
      return generateRealisticTransactionData();
  }
}

/**
 * Generate multiple sample transactions
 * @param {number} count - Number of transactions to generate
 * @param {string} preferredType - Preferred transaction type
 * @returns {Array} - Array of sample transactions
 */
function generateMultipleSamples(count = 5, preferredType = null) {
  const samples = [];
  
  for (let i = 0; i < count; i++) {
    samples.push(generateRealisticTransactionData(preferredType));
  }
  
  return samples;
}

/**
 * Generate sample data with constraints
 * @param {Object} constraints - Constraints for generation
 * @returns {Object} - Constrained sample data
 */
function generateConstrainedSample(constraints = {}) {
  const {
    minShares = 100,
    maxShares = 10000,
    minPrice = 10,
    maxPrice = 200,
    tradeType = null
  } = constraints;
  
  const shares = Math.floor(Math.random() * (maxShares - minShares) + minShares);
  const price = Math.round((Math.random() * (maxPrice - minPrice) + minPrice) * 100) / 100;
  const value = shares * price;
  
  return {
    shares,
    price,
    value,
    tradeType: tradeType || (Math.random() > 0.5 ? 'BUY' : 'SELL'),
    _isTestData: true,
    _constraints: constraints,
    _generated: new Date().toISOString(),
    _warning: 'This is test data - not real transaction information'
  };
}

/**
 * Select item from weighted array
 * @param {Array} items - Array of items with weight property
 * @returns {Object} - Selected item
 */
function selectWeightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      return item;
    }
  }
  
  return items[items.length - 1]; // Fallback
}

module.exports = {
  generateSampleTransactionData,
  generateRealisticTransactionData,
  generateScenarioData,
  generateMultipleSamples,
  generateConstrainedSample
}; 