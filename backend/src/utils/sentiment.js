/**
 * Sentiment analysis utility functions
 * Provides functions for analyzing sentiment in text
 */
const Sentiment = require('sentiment');

// Initialize sentiment analyzer
const sentimentAnalyzer = new Sentiment();

// Add custom financial terms to improve accuracy
sentimentAnalyzer.registerLanguage('en', {
  labels: {
    // Bullish terms
    'moon': 2, 'rocket': 2, 'bullish': 3, 'calls': 1, 'long': 1, 'buy': 1, 'hodl': 2,
    'undervalued': 2, 'breakout': 2, 'upside': 2, 'gains': 1, 'rip': 1,
    
    // Bearish terms
    'puts': -1, 'short': -1, 'bearish': -3, 'overvalued': -2, 'crash': -3, 'dump': -2,
    'sell': -1, 'downside': -2, 'tank': -2, 'bubble': -1, 'drill': -2, 'rekt': -2,
    
    // Neutral/amplifying terms
    'yolo': 0.5, 'fomo': 0.5, 'volatile': -0.5, 'dip': 0.5
  }
});

/**
 * Analyze sentiment in text
 * @param {string} text - Text to analyze
 * @returns {Object} Sentiment analysis result
 */
function analyzeSentiment(text) {
  if (!text || typeof text !== 'string') {
    return { score: 0, comparative: 0 };
  }
  
  // Preprocess text
  const processedText = preprocessText(text);
  
  // Analyze sentiment
  const result = sentimentAnalyzer.analyze(processedText);
  
  // Normalize score to -1 to 1 range
  const normalizedScore = result.comparative;
  
  return {
    score: normalizedScore,
    comparative: normalizedScore,
    words: result.words,
    positive: result.positive,
    negative: result.negative,
    confidence: calculateConfidence(result)
  };
}

/**
 * Preprocess text for sentiment analysis
 * @param {string} text - Raw text to process
 * @returns {string} Processed text
 */
function preprocessText(text) {
  return text
    .replace(/\$([A-Z]+)/g, '$1') // Remove $ from cashtags
    .replace(/https?:\/\/\S+/g, '') // Remove URLs
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate confidence score for sentiment analysis
 * @param {Object} result - Sentiment analysis result
 * @returns {number} Confidence score (0-100)
 */
function calculateConfidence(result) {
  // Calculate confidence based on:
  // 1. Number of sentiment words found
  // 2. Strength of sentiment
  // 3. Length of text
  
  const wordCount = result.words.length;
  const sentimentStrength = Math.abs(result.score);
  
  // Base confidence on word count
  let confidence = Math.min(50, wordCount * 5);
  
  // Add confidence based on sentiment strength
  confidence += Math.min(30, sentimentStrength * 10);
  
  // Add confidence based on comparative score strength
  confidence += Math.min(20, Math.abs(result.comparative) * 50);
  
  // Cap at 100
  return Math.min(100, Math.round(confidence));
}

/**
 * Format sentiment data for API response
 * @param {string} ticker - Ticker symbol
 * @param {number} score - Sentiment score
 * @param {number} postCount - Number of posts
 * @param {number} commentCount - Number of comments
 * @param {string} source - Data source
 * @param {string} timestamp - ISO timestamp
 * @returns {Object} Formatted sentiment data
 */
function formatSentimentData(ticker, score, postCount, commentCount, source, timestamp) {
  // Determine sentiment category
  let sentiment;
  if (score > 0.6) sentiment = 'bullish';
  else if (score < 0.4) sentiment = 'bearish';
  else sentiment = 'neutral';
  
  // Calculate confidence based on data quality
  let confidence;
  if (source === 'reddit') {
    // More posts and comments = higher confidence
    confidence = Math.min(100, Math.round(30 + (postCount * 5) + (commentCount * 0.1)));
  } else if (source === 'finviz' || source === 'yahoo') {
    // News articles are more trustworthy but still need volume
    confidence = Math.min(100, Math.round(50 + (postCount * 10)));
  } else {
    // Default baseline
    confidence = 50;
  }
  
  return {
    ticker,
    score,
    sentiment,
    source,
    timestamp,
    postCount,
    commentCount,
    confidence
  };
}

module.exports = {
  analyzeSentiment,
  preprocessText,
  formatSentimentData,
  calculateConfidence
};