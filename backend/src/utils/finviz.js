const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Calculate sentiment score based on price change, analyst rating, and news count
 * @param {number} changePercent - Price change percentage
 * @param {string} analystRating - Analyst recommendation
 * @param {number} newsCount - Number of news articles
 * @returns {number} Sentiment score between 0 and 1
 */
function calculateSentimentScore(changePercent, analystRating, newsCount) {
  // Base score from price change (normalized to 0-1 range)
  // Assuming typical daily moves between -5% and +5%
  let score = 0.5 + (changePercent / 10);
  
  // Adjust based on analyst rating
  if (analystRating) {
    const rating = analystRating.toLowerCase();
    if (rating.includes('buy') || rating.includes('outperform')) {
      score += 0.15;
    } else if (rating.includes('underperform') || rating.includes('sell')) {
      score -= 0.15;
    }
  }
  
  // Adjust slightly based on news volume
  if (newsCount > 10) {
    score += 0.05; // More news could indicate increased interest
  }
  
  // Ensure score stays within bounds
  return Math.min(0.99, Math.max(0.01, score));
}

/**
 * Calculate confidence score based on price volatility and news volume
 * @param {number} changePercent - Price change percentage
 * @param {number} newsCount - Number of news articles
 * @returns {number} Confidence score between 0 and 100
 */
function calculateConfidence(changePercent, newsCount) {
  // Base confidence on news volume
  let confidence = Math.min(100, 30 + (newsCount * 3));
  
  // Increase confidence for larger price moves (more conviction)
  if (Math.abs(changePercent) > 2) {
    confidence = Math.min(100, confidence + 15);
  }
  
  // Ensure confidence stays within bounds
  return Math.min(100, Math.max(10, confidence));
}

/**
 * Finviz utility functions
 * Handles scraping and data processing for Finviz
 */

/**
 * Scrape real sentiment data for a ticker from Finviz
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} Sentiment data
 */
async function scrapeFinvizSentiment(ticker) {
  try {
    console.log(`Fetching real FinViz data for ${ticker}`);
    
    // Make request to FinViz
    const url = `https://finviz.com/quote.ashx?t=${ticker.toUpperCase()}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract price and change
    const priceText = $('body > div > table > tbody > tr > td > div > table > tbody > tr > td > div > table > tbody > tr > td > div > table > tbody > tr:nth-child(1) > td > div > span').first().text().trim();
    const price = parseFloat(priceText.replace(/[^0-9.-]+/g, ''));
    
    // Extract change percentage
    const changeText = $('body > div > table > tbody > tr > td > div > table > tbody > tr > td > div > table > tbody > tr > td > div > table > tbody > tr:nth-child(1) > td > div > span').eq(1).text().trim();
    const changePercent = parseFloat(changeText.replace(/[^0-9.-]+/g, ''));
    
    // Extract analyst recommendations
    const analystRating = $('td:contains("Analyst Recommendation")').next().text().trim();
    
    // Extract news count (last 7 days)
    const newsCount = parseInt($('td:contains("News")').next().text().trim()) || 0;
    
    // Calculate sentiment score based on price change and other factors
    const score = calculateSentimentScore(changePercent, analystRating, newsCount);
    
    // Determine sentiment category
    let sentiment;
    if (score > 0.6) sentiment = 'bullish';
    else if (score < 0.4) sentiment = 'bearish';
    else sentiment = 'neutral';
    
    // Calculate confidence based on news volume and other factors
    const confidence = calculateConfidence(changePercent, newsCount);
    
    return {
      ticker: ticker.toUpperCase(),
      price,
      changePercent,
      score: parseFloat(score.toFixed(2)),
      sentiment,
      source: 'finviz',
      timestamp: new Date().toISOString(),
      analystRating: analystRating || 'N/A',
      newsCount,
      confidence
    };
  } catch (error) {
    console.error(`Error fetching FinViz data for ${ticker}:`, error.message);
    // Fall back to error state rather than throwing
    return {
      ticker,
      score: 0.5,
      sentiment: 'neutral',
      source: 'finviz',
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

module.exports = {
  scrapeFinvizSentiment
};