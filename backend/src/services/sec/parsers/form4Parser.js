/**
 * Form 4 Parser - Compatibility wrapper for form4ParserRefactored
 * 
 * This module provides backward compatibility by re-exporting functions
 * from the refactored form4Parser implementation.
 */

const {
  parseForm4Data,
  parseForm4DataWithDetails,
  parseSingleForm4Entry,
  validateForm4XmlData,
  processXmlEntries
} = require('./form4ParserRefactored');

module.exports = {
  parseForm4Data,
  parseForm4DataWithDetails,
  parseSingleForm4Entry,
  validateForm4XmlData,
  processXmlEntries
};