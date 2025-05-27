/**
 * Data Source Validator Middleware
 * Checks if a data source is enabled before processing requests
 */
const dataSources = require('../config/data-sources');

/**
 * Middleware to validate if a data source is enabled
 * @param {string} source - Name of the data source to check
 * @returns {Function} Express middleware function
 */
function validateDataSource(source) {
  return (req, res, next) => {
    if (!dataSources.isDataSourceEnabled(source)) {
      return res.status(403).json({ 
        error: `${source} data source is disabled` 
      });
    }
    next();
  };
}

module.exports = validateDataSource;
