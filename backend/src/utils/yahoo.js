/**
 * Yahoo Finance utility functions
 * Provides methods to fetch and process Yahoo Finance news data
 */
const axios = require('axios');
const sentimentUtils = require('./sentiment');

/**
 * Fetch Yahoo Finance news for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @param {number} limit - Maximum number of news items to fetch
 * @returns {Promise<Array>} Array of news items
 */
async function fetchYahooFinanceNews(ticker, limit = 10) {
  console.log(`Starting Yahoo Finance news fetch for ${ticker}...`);
  
  if (!ticker || typeof ticker !== 'string' || ticker.trim() === '') {
    console.error('Invalid ticker provided to fetchYahooFinanceNews');
    return [];
  }
  
  try {
    // Use Yahoo Finance RSS feed - a more reliable way to get news data
    const rssUrl = `https://finance.yahoo.com/rss/headline?s=${ticker}`;
    console.log(`Fetching Yahoo Finance RSS feed for ${ticker} from ${rssUrl}`);
    
    const response = await axios.get(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/xml, text/xml',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 10000,
      responseType: 'text',
      transformResponse: [data => data] // Prevent axios from trying to parse as JSON
    });
    
    // Check if we got a valid response
    if (!response.data || typeof response.data !== 'string') {
      console.log(`No valid data returned from Yahoo Finance RSS feed for ${ticker}`);
      return [];
    }
    
    console.log(`RSS feed data received for ${ticker}, size: ${response.data.length} bytes`);
    
    // Parse XML data with better error handling
    const newsItems = [];
    const itemRegex = /<item>[\s\S]*?<title>([^<]+)<\/title>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<pubDate>([^<]+)<\/pubDate>[\s\S]*?<description>([^<]*)<\/description>[\s\S]*?<\/item>/g;
    
    let match;
    let matchCount = 0;
    
    try {
      while ((match = itemRegex.exec(response.data)) !== null && matchCount < limit) {
        try {
          const title = match[1]?.trim() || 'No title';
          const link = match[2]?.trim() || '#';
          const pubDate = match[3]?.trim() || new Date().toISOString();
          const description = match[4]?.trim() || '';
          
          // Validate date
          const pubDateObj = pubDate ? new Date(pubDate) : new Date();
          
          newsItems.push({
            title,
            link,
            source: 'Yahoo Finance',
            time: pubDateObj.toLocaleString(),
            timestamp: pubDateObj.toISOString(),
            description
          });
          
          matchCount++;
        } catch (parseError) {
          console.error(`Error parsing news item ${matchCount + 1} for ${ticker}:`, parseError.message);
          // Continue with next item
        }
      }
    } catch (error) {
      console.error(`Error processing Yahoo Finance RSS feed for ${ticker}:`, error.message);
      // Return whatever items we've successfully parsed so far
      return newsItems;
    }
    
    console.log(`Successfully extracted ${newsItems.length} news items for ${ticker} from RSS feed`);
    return newsItems;
  } catch (error) {
    console.error(`Error fetching Yahoo Finance news for ${ticker}:`, error.message);
    return [];
  }
}

/**
 * Analyze sentiment of Yahoo Finance news
 * @param {string} ticker - Stock ticker symbol
 * @param {number} limit - Maximum number of news items to analyze
 * @returns {Promise<Object>} Sentiment analysis result
 */
async function analyzeYahooNewsSentiment(ticker, limit = 10) {
  console.log(`Starting Yahoo sentiment analysis for ${ticker}...`);
  
  // Input validation
  if (!ticker || typeof ticker !== 'string' || ticker.trim() === '') {
    console.error('Invalid ticker provided to analyzeYahooNewsSentiment');
    return getNeutralSentiment(ticker, 'Invalid ticker provided');
  }
  
  // Ensure limit is a reasonable number
  const safeLimit = Math.min(Number(limit) || 10, 50);
  
  try {
    let newsItems = [];
    try {
      newsItems = await fetchYahooFinanceNews(ticker, safeLimit);
      if (!Array.isArray(newsItems)) {
        console.error(`Unexpected news items format for ${ticker}, defaulting to empty array`);
        newsItems = [];
      }
    } catch (newsError) {
      console.error(`Error fetching news for ${ticker}:`, newsError.message);
      // Continue with empty news items
      newsItems = [];
    }
    
    if (newsItems.length === 0) {
      console.log(`No valid news items found for ${ticker}, returning neutral sentiment`);
      return getNeutralSentiment(ticker, 'No news items found');
    }
    
    // Helper function to get neutral sentiment response
    function getNeutralSentiment(ticker, reason = '') {
      const message = reason ? ` (${reason})` : '';
      console.log(`Returning neutral sentiment for ${ticker}${message}`);
      
      return {
        ticker,
        score: 0.5,  // Neutral score
        comparative: 0,
        sentiment: 'neutral',
        source: 'yahoo',
        timestamp: new Date().toISOString(),
        newsCount: 0,
        confidence: 0,
        strength: 0,
        newsItems: [],
        error: reason || undefined
      };
    }
    
    let totalScore = 0;
    let totalConfidence = 0;
    let validSentiments = 0;
    const sentimentResults = [];
    
    // Analyze sentiment for each news item
    for (const item of newsItems) {
      try {
        if (!item || typeof item !== 'object') {
          console.warn('Invalid news item format, skipping');
          continue;
        }
        
        const title = item.title || '';
        const description = item.description || '';
        const text = `${title}. ${description}`.substring(0, 1000); // Limit text length for performance
        
        if (!text.trim()) {
          console.warn('Empty text for sentiment analysis, skipping');
          continue;
        }
        
        const sentiment = sentimentUtils.analyzeSentiment(text);
        
        // Validate sentiment result
        if (typeof sentiment !== 'object' || 
            typeof sentiment.score !== 'number' || 
            typeof sentiment.comparative !== 'number') {
          console.warn('Invalid sentiment result format, skipping');
          continue;
        }
        
        const sentimentResult = {
          ...item,
          sentimentScore: sentiment.score,
          comparative: sentiment.comparative,
          confidence: Math.max(0, Math.min(1, sentiment.confidence || 0)), // Ensure 0-1 range
          positive: Array.isArray(sentiment.positive) ? sentiment.positive : [],
          negative: Array.isArray(sentiment.negative) ? sentiment.negative : []
        };
        
        sentimentResults.push(sentimentResult);
        
        // Update running totals using comparative score for better sentiment analysis
        totalScore += sentiment.comparative;
        totalConfidence += sentimentResult.confidence || 0;
        validSentiments++;
        
      } catch (sentimentError) {
        console.error(`Error analyzing sentiment for news item:`, sentimentError.message);
        // Continue with next item
      }
    }
    
    // Calculate average scores
    const hasValidSentiments = validSentiments > 0;
    const avgScore = hasValidSentiments ? totalScore / validSentiments : 0;
    const avgConfidence = hasValidSentiments 
      ? Math.min(100, Math.round((totalConfidence / validSentiments) * 1.5))
      : 0;
      
    if (!hasValidSentiments) {
      console.warn(`No valid sentiment results for ${ticker}, returning neutral`);
      return getNeutralSentiment(ticker, 'No valid sentiment results');
    }
    
    // Format the sentiment data using the utility function
    const sentimentData = sentimentUtils.formatSentimentData(
      ticker,
      avgScore,
      newsItems.length, // postCount
      0, // commentCount (not applicable for Yahoo)
      'yahoo',
      new Date().toISOString()
    );
    
    // Add additional Yahoo-specific fields
    return {
      ...sentimentData,
      comparative: avgScore,
      newsItems: sentimentResults,
      strength: Math.min(10, Math.abs(avgScore) * 5), // Scale to 0-10 range
      confidence: Math.max(sentimentData.confidence, avgConfidence) // Use the higher confidence value
    };
  } catch (error) {
    console.error(`Error analyzing Yahoo news sentiment for ${ticker}:`, error.message);
    return {
      ticker,
      score: 0.5,  // Neutral score
      comparative: 0,
      sentiment: 'neutral',
      source: 'yahoo',
      timestamp: new Date().toISOString(),
      newsCount: 0,
      error: error.message,
      confidence: 0,
      strength: 0,
      newsItems: []
    };
  }
}

module.exports = {
  fetchYahooFinanceNews,
  analyzeYahooNewsSentiment
};
