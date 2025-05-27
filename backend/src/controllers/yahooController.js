/**
 * Yahoo Finance Controller
 * Handles Yahoo Finance data requests
 */
const yahooSentimentService = require('../services/yahooSentimentService');

/**
 * Get ticker sentiment from Yahoo Finance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getTickerSentiment(req, res, next) {
  try {
    const { tickers } = req.query;
    
    if (!tickers) {
      return res.status(400).json({ 
        error: 'Missing required parameter: tickers' 
      });
    }
    
    console.log(`Yahoo Finance sentiment request for tickers: ${tickers}`);
    const sentimentData = await yahooSentimentService.getYahooTickerSentiment(tickers);
    res.json(sentimentData);
  } catch (error) {
    next(error);
  }
}

/**
 * Get market sentiment from Yahoo Finance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getMarketSentiment(req, res, next) {
  try {
    console.log('Yahoo Finance market sentiment request');
    const marketSentiment = await yahooSentimentService.getYahooMarketSentiment();
    res.json(marketSentiment);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTickerSentiment,
  getMarketSentiment
};
