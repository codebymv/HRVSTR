const axios = require('axios');
const cheerio = require('cheerio');
const cacheManager = require('../utils/cacheManager');

// Rate-limit: 10 requests / 60 s
cacheManager.registerRateLimit('finviz-sentiment', 10, 60);

/**
 * Fetch real FinViz sentiment for one or more tickers.
 * @param {string} tickers="AAPL,MSFT" Comma-separated list.
 * @returns {Promise<{sentimentData:Array}>}
 */
async function getFinvizTickerSentiment(tickers) {
  if (!tickers) throw new Error('Tickers parameter is required');

  const ttl = 30 * 60; // 30 minutes cache
  const cacheKey = `finviz-sentiment-${tickers}`;

  return cacheManager.getOrFetch(cacheKey, 'finviz-sentiment', async () => {
    const list = tickers.split(',');
    const sentimentData = [];

    for (const ticker of list) {
      try {
        console.log(`Fetching FinViz sentiment data for ${ticker}`);
        
        // Fetch data from FinViz
        const url = `https://finviz.com/quote.ashx?t=${ticker.toUpperCase()}&p=d`;
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
        
        const response = await axios.get(url, { headers, timeout: 10000 });
        const $ = cheerio.load(response.data);
        
        // Extract price and change
        const priceText = $('body > table > tbody > tr:nth-child(4) > td > div > table > tbody > tr > td > div > table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(1) > td:nth-child(3) > div > span').text().trim();
        const changeText = $('body > table > tbody > tr:nth-child(4) > td > div > table > tbody > tr > td > div > table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(1) > td:nth-child(3) > div > span > span').text().trim();
        
        const price = parseFloat(priceText.replace(/[^0-9.-]+/g, ''));
        const changePercent = parseFloat(changeText.replace(/[^0-9.-]+/g, ''));
        
        // Extract analyst ratings
        const ratings = [];
        $('td.snapshot-td2').each((i, el) => {
          const text = $(el).text().trim();
          if (text.includes('Analyst')) {
            const rating = $(el).next().text().trim();
            ratings.push(rating);
          }
        });
        
        // Extract news count (approximate based on news section)
        const newsCount = $('table.news-table tr').length;
        
        // Calculate sentiment score based on price change and news volume
        let score = 0.5; // neutral
        if (changePercent > 0) score = 0.5 + Math.min(0.4, changePercent / 10);
        else score = 0.5 - Math.min(0.4, Math.abs(changePercent) / 10);
        
        // Determine sentiment category
        let sentiment;
        if (score > 0.6) sentiment = 'bullish';
        else if (score < 0.4) sentiment = 'bearish';
        else sentiment = 'neutral';
        
        // Calculate confidence based on news volume and price movement
        const confidence = Math.min(100, Math.round(30 + (newsCount * 2) + (Math.abs(changePercent) * 5)));
        
        const tickerData = {
          ticker: ticker.toUpperCase(),
          sentiment,
          source: 'finviz',
          timestamp: new Date().toISOString(),
          confidence,
          score: parseFloat(score.toFixed(2)),
          price: price.toFixed(2),
          changePercent: changePercent.toFixed(2),
          analystRating: ratings[0] || 'N/A',
          newsCount,
          url
        };

        sentimentData.push(tickerData);
      } catch (error) {
        console.error(`Error fetching FinViz data for ${ticker}:`, error.message);
        // Fallback to neutral sentiment on error
        sentimentData.push({
          ticker: ticker.toUpperCase(),
          score: 0.5,
          sentiment: 'neutral',
          source: 'finviz',
          confidence: 0,
          error: error.message || 'Error fetching data from FinViz',
          timestamp: new Date().toISOString()
        });
      }
      
      // Add a small delay between requests to be respectful to FinViz
      if (list.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay to 2s
      }
    }

    return { sentimentData };
  }, ttl);
}

module.exports = { getFinvizTickerSentiment };