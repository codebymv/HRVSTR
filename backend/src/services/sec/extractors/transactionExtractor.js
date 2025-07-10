/**
 * Transaction Extractor - Backward compatibility wrapper
 * 
 * This file re-exports functions from transactionExtractorRefactored.js
 * to maintain compatibility with existing test files.
 */

const {
  extractTransactionDetails,
  extractTransactionType,
  extractShares,
  extractPrice,
  extractValue
} = require('./transactionExtractorRefactored');

module.exports = {
  extractTransactionDetails,
  extractTransactionType,
  extractShares,
  extractPrice,
  extractValue
};