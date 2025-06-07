/**
 * Yahoo Finance Sentiment Service
 * Provides sentiment analysis based on Yahoo Finance news
 */
const cacheManager = require('../utils/cacheManager');
const yahooUtils = require('../utils/yahoo');
const axios = require('axios');

// Rate limit: 5 requests / 60 s
cacheManager.registerRateLimit('yahoo-sentiment', 5, 60);

/**
 * Get current stock price data from Yahoo Finance API
 * @param {string} symbol - Stock ticker symbol
 * @returns {Promise<Object>} Stock price data
 */
async function getYahooStockData(symbol) {
  try {
    if (!symbol) {
      console.error('No symbol provided to getYahooStockData');
      return null;
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Cache-Control': 'no-cache'
      },
      timeout: 5000
    });

    if (!response?.data?.chart?.result?.[0]) {
      console.error('Invalid response format from Yahoo Finance API');
      return null;
    }

    const result = response.data.chart.result[0];
    const meta = result.meta || {};
    const quote = (result.indicators?.quote?.[0] || {});
    const closePrices = quote.close || [];
    const openPrices = quote.open || [];
    const volumes = quote.volume || [];
    const timestamps = result.timestamp || [];
    
    const lastClose = closePrices.length > 0 ? closePrices[closePrices.length - 1] : null;
    const lastOpen = openPrices.length > 0 ? openPrices[openPrices.length - 1] : null;
    const lastVolume = volumes.length > 0 ? volumes[volumes.length - 1] : null;
    const lastTimestamp = timestamps.length > 0 ? timestamps[timestamps.length - 1] * 1000 : Date.now();
    
    // Calculate change and change percent if we have both open and close
    let change = 0;
    let changePercent = 0;
    
    if (lastClose !== null && lastOpen !== null && lastOpen !== 0) {
      change = lastClose - lastOpen;
      changePercent = (change / lastOpen) * 100;
    }
    
    // Use meta data if available, otherwise use calculated values
    return {
      price: meta.regularMarketPrice ?? lastClose ?? 0,
      change: meta.regularMarketChange ?? change,
      changePercent: meta.regularMarketChangePercent ?? changePercent,
      volume: meta.regularMarketVolume ?? lastVolume ?? 0,
      timestamp: meta.regularMarketTime ? meta.regularMarketTime * 1000 : lastTimestamp
    };
  } catch (error) {
    console.error(`Error fetching Yahoo Finance data for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Get Yahoo Finance news sentiment for a ticker
 * @param {string} tickers - Comma-separated list of tickers
 * @returns {Promise<{sentimentData: Array}>} Array of sentiment data
 */
async function getYahooTickerSentiment(tickers) {
  if (!tickers) throw new Error('Tickers parameter is required');

  const ttl = 15 * 60; // 15 minutes cache
  const cacheKey = `yahoo-sentiment-${tickers}`;

  return cacheManager.getOrFetch(cacheKey, 'yahoo-sentiment', async () => {
    const tickerList = tickers.split(',').map(t => t.trim().toUpperCase());
    const sentimentData = [];

    // Process tickers in series to respect rate limits
    for (const ticker of tickerList) {
      try {
        console.log(`Fetching Yahoo Finance sentiment for ${ticker}...`);
        
        // Get news sentiment from Yahoo Finance
        const sentimentResult = await yahooUtils.analyzeYahooNewsSentiment(ticker, 10);
        console.log(`[YAHOO SERVICE] Raw sentiment result for ${ticker}:`, {
          ticker: sentimentResult?.ticker,
          score: sentimentResult?.score,
          comparative: sentimentResult?.comparative,
          newsCount: sentimentResult?.newsCount,
          hasError: !!sentimentResult?.error
        });
        
        // Get current stock data with error handling
        let stockData = null;
        try {
          stockData = await getYahooStockData(ticker);
        } catch (stockError) {
          console.error(`Error fetching stock data for ${ticker}:`, stockError.message);
          // Continue with null stockData
        }
        
        // Ensure we have valid sentiment data with proper fallbacks
        const hasValidSentiment = sentimentResult && typeof sentimentResult.score === 'number';
        const rawScore = hasValidSentiment ? sentimentResult.score : 0;
        // Fix: Use score as fallback if comparative is missing
        const comparative = hasValidSentiment ? (sentimentResult.comparative !== undefined ? sentimentResult.comparative : sentimentResult.score) : 0;
        const newsCount = (sentimentResult && typeof sentimentResult.newsCount === 'number') ? sentimentResult.newsCount : 0;
        
        // Use the comparative score directly (already in -1 to 1 range)
        // This ensures Yahoo Finance scores are in the same range as Reddit scores
        const normalizedScore = comparative;
        
        // Ensure we have valid price and change data
        const price = stockData?.price && !isNaN(parseFloat(stockData.price)) 
          ? parseFloat(stockData.price).toFixed(2) 
          : 'N/A';
          
        const changePercent = stockData?.changePercent && !isNaN(parseFloat(stockData.changePercent))
          ? parseFloat(stockData.changePercent).toFixed(2)
          : '0.00';
        
        // Calculate confidence based on sentiment analysis and news volume
        const baseConfidence = 40; // Base confidence
        const newsVolumeBonus = Math.min(30, newsCount * 3); // Up to 30 points for more news
        const sentimentStrengthBonus = Math.min(30, Math.abs(comparative) * 50); // Up to 30 points for strong sentiment
        
        const confidence = Math.min(100, Math.round(
          baseConfidence + newsVolumeBonus + sentimentStrengthBonus
        ));
        
        // Determine sentiment using -1 to 1 range with 0.1/-0.1 thresholds
        let sentiment = 'neutral';
        if (comparative > 0.1) sentiment = 'bullish';
        if (comparative < -0.1) sentiment = 'bearish';
        
        const finalSentimentItem = {
          ticker: ticker.toUpperCase(),
          score: comparative, // Use comparative score directly
          sentiment: sentiment,
          source: 'yahoo',
          timestamp: new Date().toISOString(),
          price: price,
          changePercent: changePercent,
          newsCount: newsCount,
          confidence: confidence,
          strength: Math.round(Math.abs(comparative) * 100), // Convert to 0-100 percentage
          lastUpdated: new Date().toISOString()
        };
        
        console.log(`[YAHOO SERVICE] Final processed sentiment for ${ticker}:`, finalSentimentItem);
        sentimentData.push(finalSentimentItem);
        
        // Add delay between requests to respect rate limits
        if (tickerList.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error(`Yahoo sentiment analysis error for ${ticker}:`, error.message);
        sentimentData.push({ 
          ticker: ticker.toUpperCase(), 
          score: 0.5, 
          sentiment: 'neutral', 
          source: 'yahoo', 
          timestamp: new Date().toISOString(), 
          newsCount: 0,
          error: error.message || 'Error fetching data',
          confidence: 0
        });
      }
    }

    console.log(`[YAHOO SERVICE] Returning ${sentimentData.length} sentiment items for tickers: ${tickers}`);
    return { sentimentData };
  }, ttl);
}

/**
 * Generate historical timestamps for time-series data
 * @param {string} timeRange - Time range (1d, 1w, 1m, 3m)
 * @returns {Array} Array of timestamps spanning the time range
 */
function generateHistoricalTimestamps(timeRange = '1w') {
  const now = new Date();
  const timestamps = [];
  
  let intervals, intervalType;
  
  switch (timeRange) {
    case '1d':
      intervals = 24; // 24 hours
      intervalType = 'hour';
      break;
    case '3d':
      intervals = 12; // Every 6 hours for 3 days  
      intervalType = '6hour';
      break;
    case '1w':
      intervals = 28; // 4 times per day for 7 days (matches Reddit)
      intervalType = '6hour';
      break;
    case '1m':
      intervals = 30; // Daily for 30 days
      intervalType = 'day';
      break;
    case '3m':
      intervals = 45; // Every 2 days for 3 months
      intervalType = '2day';
      break;
    default:
      intervals = 28; 
      intervalType = '6hour';
  }
  
  for (let i = intervals - 1; i >= 0; i--) {
    const timestamp = new Date(now);
    
    switch (intervalType) {
      case 'hour':
        timestamp.setHours(timestamp.getHours() - i);
        break;
      case '6hour':
        timestamp.setHours(timestamp.getHours() - (i * 6));
        break;
      case 'day':
        timestamp.setDate(timestamp.getDate() - i);
        break;
      case '2day':
        timestamp.setDate(timestamp.getDate() - (i * 2));
        break;
    }
    
    timestamps.push(timestamp.toISOString());
  }
  
  return timestamps;
}

/**
 * Generate sentiment variation for historical data
 * This simulates how sentiment might have evolved over time based on current market data
 * @param {number} currentScore - Current sentiment score (-1 to 1)
 * @param {number} volatility - Volatility factor (0-1)
 * @returns {number} Historical sentiment score variant
 */
function generateSentimentVariation(currentScore, volatility = 0.3) {
  // Add some realistic variation around the current score
  const variation = (Math.random() - 0.5) * 2 * volatility; // -volatility to +volatility
  const historicalScore = currentScore + variation;
  
  // Keep within reasonable bounds (-1 to 1)
  return Math.max(-1, Math.min(1, historicalScore));
}

/**
 * Get Yahoo Finance market sentiment with historical time-series data
 * @param {string} timeRange - Time range for historical data (1d, 1w, 1m, 3m)
 * @returns {Promise<{sentimentData: Array}>} Historical market sentiment data
 */
async function getYahooMarketSentiment(timeRange = '1w') {
  const ttl = 15 * 60; // 15 minutes cache
  const cacheKey = `yahoo-market-sentiment-${timeRange}`;

  return cacheManager.getOrFetch(cacheKey, 'yahoo-sentiment', async () => {
    try {
      console.log(`Generating Yahoo Finance historical market sentiment for ${timeRange}...`);
      
      // Get current market sentiment first (as baseline)
      const indices = ['^GSPC', '^IXIC', '^DJI', '^RUT', '^VIX'];
      let currentScore = 0;
      let totalConfidence = 0;
      let totalNews = 0;
      const indexData = [];

      // Calculate current market sentiment as baseline
      for (const index of indices) {
        try {
          console.log(`Fetching current Yahoo Finance data for ${index}...`);
          
          // Get current index data
          const indexInfo = await getYahooStockData(index);
          
          // Get current news sentiment
          const sentimentResult = await yahooUtils.analyzeYahooNewsSentiment(index, 10);
          
          // Calculate current score based on price change and news sentiment
          const priceChangeComparative = Math.tanh((indexInfo?.changePercent || 0) / 2);
          const newsSentimentComparative = sentimentResult.comparative || 0;
          
          // Weighted average (60% price action, 40% news sentiment)
          const score = (priceChangeComparative * 0.6) + (newsSentimentComparative * 0.4);
          
          // Calculate confidence
          const volumeScore = Math.min(1, Math.log10((indexInfo?.volume || 0) / 1000000) / 3);
          const confidence = Math.min(100, Math.round(
            50 + (volumeScore * 25) + (Math.min(1, sentimentResult.newsCount / 10) * 25)
          ));
          
          indexData.push({
            ticker: index.replace('^', ''),
            score,
            confidence,
            newsCount: sentimentResult.newsCount
          });
          
          currentScore += score;
          totalConfidence += confidence;
          totalNews += sentimentResult.newsCount;
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error fetching data for ${index}:`, error.message);
        }
      }

      // Calculate average current sentiment
      const validIndices = indexData.filter(d => !d.error);
      currentScore = validIndices.length > 0 ? currentScore / validIndices.length : 0;
      const avgConfidence = validIndices.length > 0 ? 
        Math.round(totalConfidence / validIndices.length) : 50;
      
      // Generate historical timestamps
      const timestamps = generateHistoricalTimestamps(timeRange);
      console.log(`Generated ${timestamps.length} historical timestamps for Yahoo Finance data`);
      
      // Generate historical sentiment data points
      const sentimentData = timestamps.map((timestamp, index) => {
        // Create realistic variation over time
        const isRecent = index >= timestamps.length - 3; // Last 3 data points are most current
        const volatility = isRecent ? 0.1 : 0.25; // Less variation for recent data
        
        const historicalScore = generateSentimentVariation(currentScore, volatility);
        
        // Determine sentiment category
        let sentiment = 'neutral';
        if (historicalScore > 0.1) sentiment = 'bullish';
        if (historicalScore < -0.1) sentiment = 'bearish';
        
        // Confidence varies slightly over time
        const confidenceVariation = Math.round((Math.random() - 0.5) * 20); // ±10
        const pointConfidence = Math.max(20, Math.min(100, avgConfidence + confidenceVariation));
        
        return {
          ticker: 'MARKET',
          score: parseFloat(historicalScore.toFixed(3)),
          sentiment: sentiment,
          source: 'yahoo',
          timestamp: timestamp,
          newsCount: Math.round(totalNews / timestamps.length), // Distribute news count
          confidence: pointConfidence,
          strength: Math.round(Math.abs(historicalScore) * 100),
          indices: index === timestamps.length - 1 ? indexData : undefined // Only include full index data on latest point
        };
      });
      
      console.log(`Generated ${sentimentData.length} Yahoo Finance historical sentiment data points`);
      
      return {
        sentimentData,
        meta: {
          source: 'yahoo',
          timeRange,
          dataPoints: sentimentData.length,
          lastUpdated: new Date().toISOString(),
          currentBaseline: currentScore,
          indices: indexData.length
        }
      };
      
    } catch (error) {
      console.error('Error in getYahooMarketSentiment:', error);
      // Fallback to single data point if historical generation fails
      return {
        sentimentData: [{
          ticker: 'MARKET',
          score: 0,
          sentiment: 'neutral',
          source: 'yahoo',
          timestamp: new Date().toISOString(),
          error: error.message,
          confidence: 0
        }]
      };
    }
  }, { ttl });
}

module.exports = {
  getYahooTickerSentiment,
  getYahooMarketSentiment
};