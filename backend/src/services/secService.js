const { fetchInsiderTrades, fetchInstitutionalHoldings } = require('./sec/filingsFetcher');
const {
  parseSecForm4Data,
  parseSecForm13FData
} = require('./sec/filingsParser');
const { initSecTickerDatabase } = require('./sec/companyDatabase');

// Initialize the SEC ticker database when this module is loaded
initSecTickerDatabase();

module.exports = {
  fetchInsiderTrades,
  fetchInstitutionalHoldings,
  parseSecForm4Data,
  parseSecForm13FData
};