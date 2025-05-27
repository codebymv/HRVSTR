/**
 * Finviz Controller
 * Handles business logic for Finviz API endpoints
 */
const sentimentService = require('../services/sentimentService');

/**
 * Get ticker sentiment data from Finviz
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getTickerSentiment(req, res, next) {
  try {
    const { tickers } = req.query;
    
    if (!tickers) {
      return res.status(400).json({ error: 'Tickers parameter is required' });
    }
    
    const result = await sentimentService.getFinvizTickerSentiment(tickers);
    res.json(result);
  } catch (error) {
    console.error('Error fetching FinViz sentiment:', error.message);
    next(error);
  }
}

module.exports = {
  getTickerSentiment
};
