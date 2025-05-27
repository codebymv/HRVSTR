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
        const score = hasValidSentiment ? sentimentResult.score : 0.5;
        const comparative = hasValidSentiment ? (sentimentResult.comparative || 0) : 0;
        const newsCount = (sentimentResult && typeof sentimentResult.newsCount === 'number') ? sentimentResult.newsCount : 0;
        
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
        
        // Determine sentiment
        let sentiment = 'neutral';
        if (comparative > 0.1) sentiment = 'bullish';
        if (comparative < -0.1) sentiment = 'bearish';
        
        sentimentData.push({
          ticker: ticker.toUpperCase(),
          score: score,
          sentiment: sentiment,
          source: 'yahoo',
          timestamp: new Date().toISOString(),
          price: price,
          changePercent: changePercent,
          newsCount: newsCount,
          confidence: confidence,
          strength: Math.min(10, Math.abs(comparative) * 2), // Strength from 0-10
          lastUpdated: new Date().toISOString()
        });
        
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

    return { sentimentData };
  }, ttl);
}

/**
 * Get Yahoo Finance market sentiment based on major indices
 * @returns {Promise<{sentimentData: Array}>} Market sentiment data
 */
async function getYahooMarketSentiment() {
  const ttl = 15 * 60; // 15 minutes cache
  const cacheKey = 'yahoo-market-sentiment';

  return cacheManager.getOrFetch(cacheKey, 'yahoo-sentiment', async () => {
    try {
      // Major market indices to analyze
      const indices = ['^GSPC', '^IXIC', '^DJI', '^RUT', '^VIX'];
      const indexData = [];
      let totalScore = 0;
      let totalConfidence = 0;
      let totalNews = 0;

      // Process each index
      for (const index of indices) {
        try {
          console.log(`Fetching Yahoo Finance data for ${index}...`);
          
          // Get index data
          const indexInfo = await getYahooStockData(index);
          
          // Get news sentiment for the index
          const sentimentResult = await yahooUtils.analyzeYahooNewsSentiment(index, 15);
          
          // Calculate score based on price change and news sentiment
          const priceChangeScore = Math.tanh((indexInfo?.changePercent || 0) / 2) * 0.5 + 0.5;
          const newsSentimentScore = sentimentResult.score;
          
          // Weighted average (60% price action, 40% news sentiment)
          const score = (priceChangeScore * 0.6) + (newsSentimentScore * 0.4);
          
          // Calculate confidence based on volume and news count
          const volumeScore = Math.min(1, Math.log10((indexInfo?.volume || 0) / 1000000) / 3);
          const confidence = Math.min(100, Math.round(
            50 + // Base confidence
            (volumeScore * 25) + // Higher volume = higher confidence
            (Math.min(1, sentimentResult.newsCount / 10) * 25) // More news = higher confidence
          ));
          
          const sentiment = {
            ticker: index.replace('^', ''), // Remove ^ symbol for display
            score,
            sentiment: score > 0.6 ? 'bullish' : score < 0.4 ? 'bearish' : 'neutral',
            source: 'yahoo',
            timestamp: new Date().toISOString(),
            price: indexInfo?.price.toFixed(2) || 'N/A',
            changePercent: indexInfo?.changePercent.toFixed(2) || '0.00',
            volume: indexInfo?.volume || 0,
            newsCount: sentimentResult.newsCount,
            confidence,
            strength: sentimentResult.strength
          };
          
          indexData.push(sentiment);
          totalScore += score;
          totalConfidence += confidence;
          totalNews += sentimentResult.newsCount;
          
          // Add delay between requests to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error fetching data for ${index}:`, error.message);
          // Continue with other indices if one fails
          indexData.push({
            ticker: index.replace('^', ''),
            score: 0.5,
            sentiment: 'neutral',
            source: 'yahoo',
            timestamp: new Date().toISOString(),
            error: error.message,
            confidence: 0
          });
        }
      }

      // Calculate overall market sentiment
      const validIndices = indexData.filter(d => !d.error);
      const avgScore = validIndices.length > 0 ? 
        validIndices.reduce((sum, d) => sum + d.score, 0) / validIndices.length : 0.5;
      const avgConfidence = validIndices.length > 0 ? 
        Math.round(validIndices.reduce((sum, d) => sum + d.confidence, 0) / validIndices.length) : 0;
      
      return {
        sentimentData: [{
          ticker: 'MARKET',
          score: avgScore,
          sentiment: avgScore > 0.6 ? 'bullish' : avgScore < 0.4 ? 'bearish' : 'neutral',
          source: 'yahoo',
          timestamp: new Date().toISOString(),
          price: 'N/A',
          changePercent: '0.00',
          volume: 0,
          newsCount: totalNews,
          confidence: avgConfidence,
          indices: indexData
        }]
      };
    } catch (error) {
      console.error('Error in getYahooMarketSentiment:', error);
      return {
        sentimentData: [{
          ticker: 'MARKET',
          score: 0.5,
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