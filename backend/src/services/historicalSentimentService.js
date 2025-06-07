const db = require('../database/db');
const cacheManager = require('../utils/cacheManager');

/**
 * Save daily sentiment data to history
 * @param {Object} sentimentData - Aggregated sentiment data for a ticker
 * @returns {Promise<Object>} Success result
 */
async function saveDailySentiment(sentimentData) {
  try {
    const {
      ticker,
      score,
      sentiment,
      confidence,
      postCount = 0,
      commentCount = 0,
      sources = [],
      sourceBreakdown = null,
      priceChange = null,
      volume = null,
      marketCap = null
    } = sentimentData;

    // Use current date
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    const query = `
      INSERT INTO sentiment_history (
        ticker, date, sentiment_score, sentiment_label, confidence,
        post_count, comment_count, sources, source_breakdown,
        price_change, volume, market_cap
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (ticker, date)
      DO UPDATE SET
        sentiment_score = EXCLUDED.sentiment_score,
        sentiment_label = EXCLUDED.sentiment_label,
        confidence = EXCLUDED.confidence,
        post_count = EXCLUDED.post_count,
        comment_count = EXCLUDED.comment_count,
        sources = EXCLUDED.sources,
        source_breakdown = EXCLUDED.source_breakdown,
        price_change = EXCLUDED.price_change,
        volume = EXCLUDED.volume,
        market_cap = EXCLUDED.market_cap,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id;
    `;

    const values = [
      ticker,
      currentDate,
      score,
      sentiment,
      confidence,
      postCount,
      commentCount,
      sources, // PostgreSQL will handle the array directly
      sourceBreakdown ? JSON.stringify(sourceBreakdown) : null,
      priceChange,
      volume,
      marketCap
    ];

    const result = await db.query(query, values);
    
    console.log(`✅ Saved sentiment history for ${ticker} on ${currentDate}`);
    return { success: true, id: result.rows[0].id };
    
  } catch (error) {
    console.error('Error saving daily sentiment:', error);
    throw new Error(`Failed to save sentiment history: ${error.message}`);
  }
}

/**
 * Get historical sentiment data for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @param {number} days - Number of days to retrieve (default: 30)
 * @returns {Promise<Array>} Historical sentiment data
 */
async function getHistoricalSentiment(ticker, days = 30) {
  const cacheKey = `historical-sentiment-${ticker}-${days}d`;
  const ttl = 6 * 60 * 60; // 6 hours cache

  return cacheManager.getOrFetch(cacheKey, 'historical-sentiment', async () => {
    try {
      const query = `
        SELECT 
          ticker,
          date,
          sentiment_score,
          sentiment_label,
          confidence,
          post_count,
          comment_count,
          sources,
          source_breakdown,
          price_change,
          volume,
          market_cap,
          created_at
        FROM sentiment_history 
        WHERE ticker = $1 
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY date DESC;
      `;

      const result = await db.query(query, [ticker.toUpperCase()]);
      
      return result.rows.map(row => ({
        ...row,
        sources: Array.isArray(row.sources) ? row.sources : (row.sources || []),
        sourceBreakdown: row.source_breakdown ? JSON.parse(row.source_breakdown) : null,
        date: row.date.toISOString().split('T')[0] // Ensure consistent date format
      }));
      
    } catch (error) {
      console.error('Error fetching historical sentiment:', error);
      throw new Error(`Failed to fetch historical sentiment: ${error.message}`);
    }
  }, { ttl });
}

/**
 * Get historical sentiment trends for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @param {number} days - Number of days to analyze (default: 30)
 * @returns {Promise<Object>} Trend analysis
 */
async function getSentimentTrends(ticker, days = 30) {
  const cacheKey = `sentiment-trends-${ticker}-${days}d`;
  const ttl = 12 * 60 * 60; // 12 hours cache

  return cacheManager.getOrFetch(cacheKey, 'sentiment-trends', async () => {
    try {
      const historicalData = await getHistoricalSentiment(ticker, days);
      
      if (historicalData.length < 7) {
        return {
          ticker,
          trend: 'insufficient_data',
          trendDirection: 'neutral',
          volatility: 0,
          consistency: 0,
          dataPoints: historicalData.length
        };
      }

      // Calculate trends
      const scores = historicalData.map(d => d.sentiment_score);
      const recent7Days = scores.slice(0, 7);
      const previous7Days = scores.slice(7, 14);
      
      const recentAvg = recent7Days.reduce((a, b) => a + b, 0) / recent7Days.length;
      const previousAvg = previous7Days.length > 0 
        ? previous7Days.reduce((a, b) => a + b, 0) / previous7Days.length 
        : recentAvg;

      // Determine trend direction
      const trendChange = recentAvg - previousAvg;
      let trendDirection = 'neutral';
      if (Math.abs(trendChange) > 0.1) {
        trendDirection = trendChange > 0 ? 'improving' : 'declining';
      }

      // Calculate volatility (standard deviation of scores)
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
      const volatility = Math.sqrt(variance);

      // Calculate consistency (inverse of volatility, normalized to 0-100)
      const consistency = Math.max(0, Math.min(100, Math.round((1 - volatility) * 100)));

      return {
        ticker,
        trend: trendDirection,
        trendDirection,
        volatility: Math.round(volatility * 100) / 100,
        consistency,
        recentAverage: Math.round(recentAvg * 1000) / 1000,
        previousAverage: Math.round(previousAvg * 1000) / 1000,
        trendChange: Math.round(trendChange * 1000) / 1000,
        dataPoints: historicalData.length,
        timeframe: `${days} days`
      };
      
    } catch (error) {
      console.error('Error calculating sentiment trends:', error);
      throw new Error(`Failed to calculate sentiment trends: ${error.message}`);
    }
  }, { ttl });
}

/**
 * Get multiple tickers' historical data for comparison
 * @param {Array<string>} tickers - Array of ticker symbols
 * @param {number} days - Number of days to retrieve
 * @returns {Promise<Object>} Comparative historical data
 */
async function getComparativeHistorical(tickers, days = 30) {
  const cacheKey = `comparative-historical-${tickers.join(',')}-${days}d`;
  const ttl = 6 * 60 * 60; // 6 hours cache

  return cacheManager.getOrFetch(cacheKey, 'comparative-historical', async () => {
    try {
      const historicalPromises = tickers.map(ticker => 
        getHistoricalSentiment(ticker, days)
      );
      
      const results = await Promise.allSettled(historicalPromises);
      const historicalData = {};
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          historicalData[tickers[index]] = result.value;
        } else {
          console.warn(`Failed to get historical data for ${tickers[index]}:`, result.reason);
          historicalData[tickers[index]] = [];
        }
      });

      return {
        tickers,
        historicalData,
        timeframe: `${days} days`,
        generatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error fetching comparative historical data:', error);
      throw new Error(`Failed to fetch comparative historical data: ${error.message}`);
    }
  }, { ttl });
}

module.exports = {
  saveDailySentiment,
  getHistoricalSentiment,
  getSentimentTrends,
  getComparativeHistorical
}; 