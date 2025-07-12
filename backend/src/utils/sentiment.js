/**
 * Sentiment analysis utility functions
 * Provides functions for analyzing sentiment in text
 */
const Sentiment = require('sentiment');

// Initialize sentiment analyzer
const sentimentAnalyzer = new Sentiment();

// Import Python sentiment service for enhanced analysis
let PythonSentimentService;
try {
  const { PythonSentimentService: PSS } = require('../services/pythonSentimentService');
  PythonSentimentService = PSS;
} catch (error) {
  console.warn('Python sentiment service not available:', error.message);
}

// Enhanced custom financial terms to improve accuracy
sentimentAnalyzer.registerLanguage('en', {
  labels: {
    // Strong Bullish terms (3-5 points)
    'moon': 4, 'rocket': 4, 'bullish': 4, 'surge': 3, 'rally': 3, 'breakout': 4, 
    'explosive': 4, 'skyrocket': 5, 'massive gains': 5, 'huge upside': 4,
    'strong buy': 4, 'buy the dip': 3, 'undervalued': 3, 'oversold': 2,
    
    // Moderate Bullish terms (1-2 points)
    'calls': 2, 'long': 2, 'buy': 2, 'hodl': 2, 'hold': 1, 'upside': 2, 
    'gains': 2, 'rip': 2, 'green': 1, 'up': 1, 'rise': 1, 'pump': 2,
    'bullish momentum': 3, 'positive': 1, 'good news': 2, 'beat expectations': 3,
    
    // Strong Bearish terms (-3 to -5 points)
    'crash': -4, 'dump': -4, 'bearish': -4, 'collapse': -5, 'tank': -4,
    'drill': -4, 'plummet': -4, 'disaster': -5, 'terrible': -4, 'awful': -4,
    'strong sell': -4, 'avoid': -3, 'overvalued': -3, 'bubble': -3,
    
    // Moderate Bearish terms (-1 to -2 points)
    'puts': -2, 'short': -2, 'sell': -2, 'downside': -2, 'fall': -1,
    'drop': -1, 'red': -1, 'down': -1, 'decline': -1, 'weak': -2,
    'miss expectations': -3, 'disappointing': -2, 'concerning': -2,
    
    // Neutral/amplifying terms
    'yolo': 1, 'fomo': 1, 'volatile': 0, 'dip': 1, 'sideways': 0,
    'consolidation': 0, 'range bound': 0, 'flat': 0,
    
    // Market sentiment terms
    'bull market': 3, 'bear market': -3, 'correction': -2, 'recovery': 2,
    'momentum': 1, 'trend': 1, 'support': 1, 'resistance': -1,
    
    // Earnings and fundamentals
    'earnings beat': 3, 'earnings miss': -3, 'guidance raised': 3, 'guidance lowered': -3,
    'revenue growth': 2, 'profit margin': 1, 'debt concerns': -2, 'cash flow': 1
  }
});

/**
 * Analyze sentiment in text with enhanced Python integration
 * @param {string} text - Text to analyze
 * @param {string} ticker - Optional ticker symbol for context
 * @param {string} source - Data source for context
 * @param {boolean} useEnhanced - Whether to use Python enhancement (default: true)
 * @returns {Object} Sentiment analysis result
 */
async function analyzeSentiment(text, ticker = null, source = 'unknown', useEnhanced = true) {
  if (!text || typeof text !== 'string') {
    return { score: 0, comparative: 0, confidence: 0 };
  }
  
  // Try Python enhanced analysis first if available and requested
  if (useEnhanced && PythonSentimentService) {
    try {
      const pythonService = new PythonSentimentService();
      if (pythonService.isServiceRunning) {
        const enhancedResult = await pythonService.analyzeSingleText(text, ticker, source);
        
        // Convert Python result to our format
        return {
          score: enhancedResult.sentiment.score,
          comparative: enhancedResult.sentiment.score,
          confidence: enhancedResult.sentiment.confidence,
          words: enhancedResult.entities || [],
          positive: enhancedResult.sentiment.score > 0 ? [enhancedResult.sentiment.label] : [],
          negative: enhancedResult.sentiment.score < 0 ? [enhancedResult.sentiment.label] : [],
          wordCount: text.split(' ').length,
          sentimentWordCount: enhancedResult.entities ? enhancedResult.entities.length : 0,
          enhanced: true,
          finbert: enhancedResult.finbert,
          vader: enhancedResult.vader
        };
      }
    } catch (error) {
      console.warn('Python sentiment analysis failed, falling back to basic analysis:', error.message);
    }
  }
  
  // Fallback to basic sentiment analysis
  return analyzeSentimentBasic(text);
}

/**
 * Basic sentiment analysis (original implementation)
 * @param {string} text - Text to analyze
 * @returns {Object} Sentiment analysis result
 */
function analyzeSentimentBasic(text) {
  if (!text || typeof text !== 'string') {
    return { score: 0, comparative: 0, confidence: 0 };
  }
  
  // Preprocess text
  const processedText = preprocessText(text);
  
  // Analyze sentiment
  const result = sentimentAnalyzer.analyze(processedText);
  
  // Enhanced normalization - amplify the comparative score for better sensitivity
  let normalizedScore = result.comparative;
  
  // Apply amplification for financial text (multiply by 2 and apply sigmoid for better range)
  normalizedScore = normalizedScore * 2;
  
  // Apply sigmoid-like function to improve score distribution while keeping -1 to 1 range
  if (normalizedScore !== 0) {
    normalizedScore = Math.tanh(normalizedScore * 1.5);
  }
  
  // Ensure we're within bounds
  normalizedScore = Math.max(-1, Math.min(1, normalizedScore));
  
  // Calculate enhanced confidence
  const confidence = calculateEnhancedConfidence(result, processedText);
  
  return {
    score: normalizedScore,
    comparative: normalizedScore,
    words: result.words,
    positive: result.positive,
    negative: result.negative,
    confidence: confidence,
    wordCount: processedText.split(' ').length,
    sentimentWordCount: result.words.length,
    enhanced: false
  };
}

/**
 * Enhanced preprocessing for financial text
 * @param {string} text - Raw text to process
 * @returns {string} Processed text
 */
function preprocessText(text) {
  return text
    .toLowerCase() // Convert to lowercase for better matching
    .replace(/\$([A-Z]+)/g, '$1') // Remove $ from cashtags but keep ticker
    .replace(/https?:\/\/\S+/g, '') // Remove URLs
    .replace(/[^\w\s$]/g, ' ') // Remove special characters but keep $
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate enhanced confidence score for sentiment analysis
 * @param {Object} result - Sentiment analysis result
 * @param {string} processedText - Processed text
 * @returns {number} Confidence score (0-100)
 */
function calculateEnhancedConfidence(result, processedText) {
  const wordCount = processedText.split(' ').length;
  const sentimentWordCount = result.words.length;
  const sentimentStrength = Math.abs(result.score);
  const comparativeStrength = Math.abs(result.comparative);
  
  // Base confidence on sentiment word density (percentage of words that carry sentiment)
  const sentimentDensity = wordCount > 0 ? (sentimentWordCount / wordCount) : 0;
  let confidence = sentimentDensity * 40; // Up to 40 points for high density
  
  // Add confidence based on absolute sentiment strength
  confidence += Math.min(30, sentimentStrength * 15); // Up to 30 points for strong sentiment
  
  // Add confidence based on comparative score strength
  confidence += Math.min(20, comparativeStrength * 40); // Up to 20 points for strong comparative
  
  // Bonus for longer texts (more context)
  if (wordCount > 10) {
    confidence += Math.min(10, (wordCount - 10) * 0.5); // Up to 10 points for longer texts
  }
  
  // Ensure minimum confidence for any sentiment analysis
  if (sentimentWordCount > 0) {
    confidence = Math.max(confidence, 15); // Minimum 15% confidence if any sentiment words found
  }
  
  // Cap at 100 and round
  return Math.min(100, Math.round(confidence));
}

/**
 * Enhanced sentiment data formatting with better confidence calculation
 * @param {string} ticker - Ticker symbol
 * @param {number} score - Sentiment score (-1 to 1)
 * @param {number} postCount - Number of posts
 * @param {number} commentCount - Number of comments
 * @param {string} source - Data source
 * @param {string} timestamp - ISO timestamp
 * @param {number} baseConfidence - Base confidence from sentiment analysis
 * @param {number} strength - Sentiment strength (optional)
 * @returns {Object} Formatted sentiment data
 */
function formatSentimentData(ticker, score, postCount, commentCount, source, timestamp, baseConfidence = 0, strength = 0) {
  // Determine sentiment category with improved thresholds
  let sentiment;
  if (score > 0.15) sentiment = 'bullish';      // Raised threshold for bullish
  else if (score < -0.15) sentiment = 'bearish'; // Raised threshold for bearish  
  else sentiment = 'neutral';
  
  // Calculate enhanced confidence based on data quality
  let confidence = baseConfidence || 0;
  
  if (source === 'reddit') {
    // More posts and comments = higher confidence, but diminishing returns
    const postBonus = Math.min(25, Math.sqrt(postCount) * 5);
    const commentBonus = Math.min(15, Math.sqrt(commentCount) * 0.5);
    confidence = Math.max(confidence, 20) + postBonus + commentBonus;
  } else if (source === 'finviz' || source === 'yahoo') {
    // News articles are more trustworthy, higher base confidence
    const newsBonus = Math.min(20, postCount * 8); // Fewer news articles but higher value
    confidence = Math.max(confidence, 40) + newsBonus;
  } else if (source === 'combined') {
    // Combined sources get bonus confidence
    const volumeBonus = Math.min(20, Math.sqrt(postCount + commentCount) * 2);
    confidence = Math.max(confidence, 30) + volumeBonus;
  }
  
  // Boost confidence based on sentiment strength
  const strengthBonus = Math.min(15, Math.abs(score) * 30);
  confidence += strengthBonus;
  
  // Cap at 100
  confidence = Math.min(100, Math.round(confidence));
  
  return {
    ticker,
    score: Math.round(score * 1000) / 1000, // Round to 3 decimal places
    sentiment,
    source,
    timestamp,
    postCount,
    commentCount,
    confidence,
    strength: strength || Math.round(Math.abs(score) * 100), // Convert to 0-100 percentage
    // Add debug info for troubleshooting
    debug: {
      rawScore: score,
      sentimentThreshold: sentiment === 'bullish' ? '>0.15' : sentiment === 'bearish' ? '<-0.15' : '±0.15',
      confidenceBreakdown: {
        base: baseConfidence || 0,
        source: source,
        dataVolume: postCount + commentCount,
        final: confidence
      }
    }
  };
}

/**
 * Get sentiment strength category
 * @param {number} score - Sentiment score (-1 to 1)
 * @returns {string} Strength category
 */
function getSentimentStrength(score) {
  const absScore = Math.abs(score);
  if (absScore >= 0.7) return 'very strong';
  if (absScore >= 0.4) return 'strong'; 
  if (absScore >= 0.2) return 'moderate';
  if (absScore >= 0.1) return 'weak';
  return 'very weak';
}

/**
 * Analyze sentiment for multiple texts with enhanced Python integration
 * @param {Array} texts - Array of texts to analyze
 * @param {Array} tickers - Array of ticker symbols (optional)
 * @param {string} source - Data source for context
 * @param {boolean} useEnhanced - Whether to use Python enhancement (default: true)
 * @returns {Promise<Array>} Array of sentiment analysis results
 */
async function analyzeBatchSentiment(texts, tickers = [], source = 'unknown', useEnhanced = true) {
  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    return [];
  }
  
  // Try Python enhanced batch analysis first if available and requested
  if (useEnhanced && PythonSentimentService) {
    try {
      const pythonService = new PythonSentimentService();
      if (pythonService.isServiceRunning) {
        const enhancedResults = await pythonService.analyzeBatchTexts(texts, tickers, source);
        
        // Convert Python results to our format
        return enhancedResults.results.map((result, index) => ({
          score: result.sentiment.score,
          comparative: result.sentiment.score,
          confidence: result.sentiment.confidence,
          words: result.entities || [],
          positive: result.sentiment.score > 0 ? [result.sentiment.label] : [],
          negative: result.sentiment.score < 0 ? [result.sentiment.label] : [],
          wordCount: texts[index].split(' ').length,
          sentimentWordCount: result.entities ? result.entities.length : 0,
          enhanced: true,
          finbert: result.finbert,
          vader: result.vader,
          text: texts[index]
        }));
      }
    } catch (error) {
      console.warn('Python batch sentiment analysis failed, falling back to basic analysis:', error.message);
    }
  }
  
  // Fallback to basic sentiment analysis for each text
  return texts.map(text => ({
    ...analyzeSentimentBasic(text),
    text: text
  }));
}

module.exports = {
  analyzeSentiment,
  analyzeSentimentBasic,
  analyzeBatchSentiment,
  preprocessText,
  formatSentimentData,
  calculateEnhancedConfidence,
  getSentimentStrength
};