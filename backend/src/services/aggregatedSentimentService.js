const { getRedditTickerSentiment } = require('./redditSentimentService');
const { getFinvizTickerSentiment } = require('./finvizSentimentService');
const { getYahooTickerSentiment } = require('./yahooSentimentService');
const sentimentUtils = require('../utils/sentiment');
const cacheManager = require('../utils/cacheManager');

/**
 * Aggregate sentiment across multiple sources.
 * @param {string} tickers - Comma-separated list of tickers
 * @param {string} timeRange - Time range for Reddit data (1d, 1w, 1m, 3m)
 * @param {Array<string>} sources - Sources to use (reddit, finviz, yahoo)
 * @returns {Promise<Object>} Aggregated sentiment data
 */
async function getAggregatedSentiment(tickers, timeRange = '1w', sources = ['reddit', 'finviz', 'yahoo']) {
  if (!tickers) throw new Error('Tickers parameter is required');
  const ttl = 30 * 60; // 30 min
  const cacheKey = `aggregated-sentiment-${tickers}-${timeRange}-${sources.join('-')}`;

  return cacheManager.getOrFetch(cacheKey, 'aggregated-sentiment', async () => {
    const results = {};
    const sourceResults = await Promise.allSettled(
      sources.map(async (s) => {
        if (s === 'reddit') return { source: 'reddit', data: await getRedditTickerSentiment(timeRange) };
        if (s === 'finviz') return { source: 'finviz', data: await getFinvizTickerSentiment(tickers) };
        if (s === 'yahoo') return { source: 'yahoo', data: await getYahooTickerSentiment(tickers) };
        throw new Error(`Unknown source ${s}`);
      })
    );

    const all = [];
    sourceResults.forEach(r => {
      if (r.status === 'fulfilled') {
        results[r.value.source] = r.value.data;
        if (r.value.data.sentimentData) all.push(...r.value.data.sentimentData);
      } else {
        console.error('Aggregated source error:', r.reason);
      }
    });

    const byTicker = {};
    all.forEach(item => {
      if (!byTicker[item.ticker]) {
        byTicker[item.ticker] = { 
          ticker: item.ticker, 
          sources: [], 
          scoreSum: 0, 
          scoreCount: 0, 
          postCount: 0, 
          commentCount: 0,
          confidenceSum: 0,
          confidenceCount: 0,
          strengthSum: 0,
          strengthCount: 0,
          volumeSum: 0,
          volumeCount: 0
        };
      }
      
      const tgt = byTicker[item.ticker];
      tgt.sources.push(item.source);
      tgt.scoreSum += item.score;
      tgt.scoreCount += 1;
      tgt.postCount += item.postCount || 0;
      tgt.commentCount += item.commentCount || 0;
      
      // Track enhanced metrics if available
      if (item.confidence !== undefined) {
        tgt.confidenceSum += item.confidence;
        tgt.confidenceCount += 1;
      }
      
      if (item.strength !== undefined) {
        tgt.strengthSum += item.strength;
        tgt.strengthCount += 1;
      }
      
      if (item.volume !== undefined) {
        tgt.volumeSum += item.volume;
        tgt.volumeCount += 1;
      }
    });

    // Calculate average confidence and strength for each ticker
  const aggregatedSentimentData = Object.values(byTicker).map(t => {
    // Calculate weighted average score
    const avgScore = t.scoreCount ? t.scoreSum / t.scoreCount : 0;
    
    // Calculate average confidence if available
    let confidence = 70; // Default confidence
    if (t.confidenceSum && t.confidenceCount) {
      confidence = Math.round(t.confidenceSum / t.confidenceCount);
    }
    
    // Use strength if available, otherwise calculate from score
    const strength = t.strengthSum && t.strengthCount 
      ? Math.round(t.strengthSum / t.strengthCount)
      : sentimentUtils.getSentimentStrength(avgScore);
    
    return sentimentUtils.formatSentimentData(
      t.ticker, 
      avgScore, 
      t.postCount, 
      t.commentCount, 
      t.sources.join(','), 
      new Date().toISOString(),
      confidence,
      strength
    );
  }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

    return { 
      aggregatedSentimentData, 
      sourceData: results, 
      timeRange, 
      tickers: tickers.split(','),
      meta: {
        sources: Object.keys(results),
        timestamp: new Date().toISOString(),
        sourceCounts: Object.fromEntries(
          Object.entries(results).map(([source, data]) => 
            [source, data.sentimentData ? data.sentimentData.length : 0]
          )
        )
      }
    };
  }, { ttl });
}

module.exports = { getAggregatedSentiment };
