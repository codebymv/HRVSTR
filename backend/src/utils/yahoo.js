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
    
    console.log(`Processing ${newsItems.length} news items for ${ticker} sentiment analysis...`);
    
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
    
    // Try enhanced batch sentiment analysis first
    let enhancedAnalysisUsed = false;
    try {
      // Extract texts for batch analysis
      const texts = newsItems.map(item => {
        const title = item.title || '';
        const description = item.description || '';
        return `${title}. ${description}`.substring(0, 1000);
      }).filter(text => text.trim());
      
      if (texts.length > 0) {
        console.log(`[${ticker}] Attempting enhanced batch sentiment analysis for ${texts.length} news items...`);
        
        const batchResults = await sentimentUtils.analyzeBatchSentiment(
          texts,
          ticker,
          'yahoo',
          true // useEnhanced
        );
        
        if (batchResults && Array.isArray(batchResults) && batchResults.length > 0) {
          console.log(`[${ticker}] Enhanced batch analysis successful, processing ${batchResults.length} results`);
          enhancedAnalysisUsed = true;
          
          // Process enhanced results
          for (let i = 0; i < Math.min(batchResults.length, newsItems.length); i++) {
            const result = batchResults[i];
            const item = newsItems[i];
            
            if (result && typeof result.score === 'number') {
              const sentimentResult = {
                ...item,
                sentimentScore: result.score,
                comparative: result.comparative || 0,
                confidence: Math.max(0, Math.min(1, result.confidence || 0)),
                positive: Array.isArray(result.positive) ? result.positive : [],
                negative: Array.isArray(result.negative) ? result.negative : [],
                enhanced: result.enhanced || false,
                finbert: result.finbert || false,
                vader: result.vader || false,
                entities: result.entities || []
              };
              
              sentimentResults.push(sentimentResult);
              totalScore += result.comparative || 0;
              totalConfidence += result.confidence || 0;
              validSentiments++;
            }
          }
        }
      }
    } catch (enhancedError) {
      console.log(`[${ticker}] Enhanced analysis failed, falling back to basic analysis:`, enhancedError.message);
    }
    
    // Fallback to individual analysis if enhanced failed or wasn't used
    if (!enhancedAnalysisUsed) {
      console.log(`[${ticker}] Using basic sentiment analysis for news items...`);
      
      for (const item of newsItems) {
        try {
          if (!item || typeof item !== 'object') {
            console.warn('Invalid news item format, skipping');
            continue;
          }
          
          const title = item.title || '';
          const description = item.description || '';
          const text = `${title}. ${description}`.substring(0, 1000);
          
          if (!text.trim()) {
            console.warn('Empty text for sentiment analysis, skipping');
            continue;
          }
          
          const sentiment = await sentimentUtils.analyzeSentiment(text, ticker, 'yahoo', false);
          
          // Validate sentiment result
          if (typeof sentiment !== 'object' || 
              typeof sentiment.score !== 'number') {
            console.warn(`[${ticker}] Invalid sentiment result format, skipping:`, sentiment);
            continue;
          }
          
          const sentimentResult = {
            ...item,
            sentimentScore: sentiment.score,
            comparative: sentiment.comparative || 0,
            confidence: Math.max(0, Math.min(1, sentiment.confidence || 0)),
            positive: Array.isArray(sentiment.positive) ? sentiment.positive : [],
            negative: Array.isArray(sentiment.negative) ? sentiment.negative : []
          };
          
          sentimentResults.push(sentimentResult);
          totalScore += sentiment.comparative || 0;
          totalConfidence += sentimentResult.confidence || 0;
          validSentiments++;
          
        } catch (sentimentError) {
          console.error(`Error analyzing sentiment for news item:`, sentimentError.message);
        }
      }
    }
    
    // Calculate average scores
    const hasValidSentiments = validSentiments > 0;
    const avgScore = hasValidSentiments ? totalScore / validSentiments : 0;
    const avgConfidence = hasValidSentiments 
      ? Math.min(100, Math.round((totalConfidence / validSentiments) * 100))
      : 0;
      
    if (!hasValidSentiments) {
      console.warn(`No valid sentiment results for ${ticker}, returning neutral`);
      return getNeutralSentiment(ticker, 'No valid sentiment results');
    }
    
    console.log(`[${ticker}] Sentiment analysis summary: validSentiments=${validSentiments}, avgScore=${avgScore}, avgConfidence=${avgConfidence}`);
    
    // Use the enhanced formatSentimentData function
    const sentimentData = sentimentUtils.formatSentimentData(
      ticker,
      avgScore,
      newsItems.length, // postCount (using news count)
      0, // commentCount (not applicable for Yahoo)
      'yahoo',
      new Date().toISOString(),
      avgConfidence, // baseConfidence from sentiment analysis
      Math.round(Math.abs(avgScore) * 100) // strength as percentage
    );
    
    console.log(`[${ticker}] Final sentiment data:`, {
      ticker: sentimentData.ticker,
      score: sentimentData.score,
      sentiment: sentimentData.sentiment,
      confidence: sentimentData.confidence,
      newsCount: newsItems.length
    });
    
    // Add additional Yahoo-specific fields
    const result = {
      ...sentimentData,
      newsItems: sentimentResults,
      newsCount: newsItems.length
    };
    
    console.log(`[${ticker}] Returning sentiment result with ${result.newsItems?.length || 0} news items`);
    return result;
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
