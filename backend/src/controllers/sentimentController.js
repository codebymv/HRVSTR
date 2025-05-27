/**
 * Sentiment Controller
 * Handles business logic for sentiment analysis API endpoints
 */
const redditSentimentService = require('../services/redditSentimentService');
const finvizSentimentService = require('../services/finvizSentimentService');
const yahooSentimentService = require('../services/yahooSentimentService');
const aggregatedSentimentService = require('../services/aggregatedSentimentService');

/**
 * Get ticker sentiment data from Reddit
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getRedditTickerSentiment(req, res, next) {
  try {
    const { timeRange = '1w' } = req.query;
    const result = await redditSentimentService.getRedditTickerSentiment(timeRange);
    res.json(result);
  } catch (error) {
    console.error('Error fetching Reddit ticker sentiment:', error.message);
    next(error);
  }
}

/**
 * Get market sentiment data from Reddit
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getRedditMarketSentiment(req, res, next) {
  try {
    const { timeRange = '1w' } = req.query;
    const result = await redditSentimentService.getRedditMarketSentiment(timeRange);
    res.json(result);
  } catch (error) {
    console.error('Error fetching Reddit market sentiment:', error.message);
    next(error);
  }
}

/**
 * Get ticker sentiment data from Finviz
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getFinvizSentiment(req, res) {
  try {
    const { tickers } = req.query;
    if (!tickers) {
      return res.status(400).json({ error: 'Tickers parameter is required' });
    }
    
    const result = await finvizSentimentService.getFinvizTickerSentiment(tickers);
    res.json(result);
  } catch (error) {
    console.error('Finviz sentiment error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get ticker sentiment data from Yahoo Finance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getYahooSentiment(req, res) {
  try {
    const { tickers } = req.query;
    if (!tickers) {
      return res.status(400).json({ error: 'Tickers parameter is required' });
    }
    
    const result = await yahooSentimentService.getYahooTickerSentiment(tickers);
    res.json(result);
  } catch (error) {
    console.error('Yahoo sentiment error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get market sentiment data from Yahoo Finance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getYahooMarketSentiment(req, res) {
  try {
    const result = await yahooSentimentService.getYahooMarketSentiment();
    res.json(result);
  } catch (error) {
    console.error('Yahoo market sentiment error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get aggregated sentiment data from multiple sources
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getAggregatedSentiment(req, res, next) {
  try {
    const { tickers, timeRange = '1w', sources = 'reddit,finviz' } = req.query;
    
    if (!tickers) {
      return res.status(400).json({ error: 'Tickers parameter is required' });
    }
    
    const sourcesList = sources.split(',');
    const result = await aggregatedSentimentService.getAggregatedSentiment(tickers, timeRange, sourcesList);
    res.json(result);
  } catch (error) {
    console.error('Error fetching aggregated sentiment:', error.message);
    next(error);
  }
}

module.exports = {
  getRedditTickerSentiment,
  getRedditMarketSentiment,
  getFinvizSentiment,
  getYahooSentiment,
  getYahooMarketSentiment,
  getAggregatedSentiment
};
