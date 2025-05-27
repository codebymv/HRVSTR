/**
 * Test script for SEC EDGAR API lookup functions
 * 
 * Run this with: node src/services/sec/testApiLookup.js
 */

const { lookupCompanyByCIK, initSecTickerDatabase } = require('./companyDatabase');

// Sample CIKs to test
const TEST_CIKS = [
  '0001318605', // Tesla
  '0001438533', // Travere Therapeutics
  '0001789617', // Heerma Peter
  '0001537544', // Smith Mark Peter
  '0001883365'  // Random recent CIK
];

async function runTests() {
  console.log('==== SEC EDGAR API LOOKUP TEST ====');
  console.log('Initializing SEC ticker database...');
  await initSecTickerDatabase();
  
  console.log('\nRunning CIK lookups:');
  for (const cik of TEST_CIKS) {
    try {
      console.log(`\nLooking up CIK: ${cik}`);
      const result = await lookupCompanyByCIK(cik);
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`Error looking up CIK ${cik}:`, error.message);
    }
  }
  
  console.log('\n==== TEST COMPLETE ====');
}

runTests().catch(err => {
  console.error('Test failed:', err);
});
