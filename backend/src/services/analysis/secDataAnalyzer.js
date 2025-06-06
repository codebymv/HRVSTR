/**
 * SEC Data Analyzer - Analysis functions for SEC data patterns and trends
 */

/**
 * Analyze abnormal insider trading activity
 * @param {Array} trades - Insider trades data
 * @param {Object} options - Analysis options
 * @returns {Object} - Analysis results
 */
function analyzeAbnormalActivity(trades, options = {}) {
  const results = {
    totalTrades: trades.length,
    abnormalTrades: [],
    patterns: [],
    riskScore: 0,
    summary: {}
  };

  // Group trades by ticker and analyze patterns
  const tradesByTicker = groupTradesByTicker(trades);
  
  for (const [ticker, tickerTrades] of Object.entries(tradesByTicker)) {
    const tickerAnalysis = analyzeTickerActivity(ticker, tickerTrades, options);
    
    if (tickerAnalysis.riskScore >= 0.7) {
      results.abnormalTrades.push(tickerAnalysis);
    }
    
    results.patterns.push(...tickerAnalysis.patterns);
    results.riskScore = Math.max(results.riskScore, tickerAnalysis.riskScore);
  }

  results.summary = calculateActivitySummary(results.abnormalTrades);
  return results;
}

/**
 * Analyze insider trading patterns for specific ticker
 * @param {string} ticker - Stock ticker
 * @param {Array} trades - Trades for this ticker
 * @param {Object} options - Analysis options
 * @returns {Object} - Ticker analysis
 */
function analyzeTickerActivity(ticker, trades, options = {}) {
  const analysis = {
    ticker,
    totalTrades: trades.length,
    patterns: [],
    riskScore: 0,
    metrics: calculateTradeMetrics(trades)
  };

  // Detect clustering patterns
  const clustering = detectTradeClustering(trades, 30);
  if (clustering.score > 0.5) {
    analysis.patterns.push({
      type: 'clustering',
      description: `${clustering.clusterCount} trade clusters detected`,
      score: clustering.score,
      details: clustering
    });
  }

  // Detect volume anomalies
  const volumeAnomalies = detectVolumeAnomalies(trades, 2.0);
  if (volumeAnomalies.length > 0) {
    analysis.patterns.push({
      type: 'volume_anomaly',
      description: `${volumeAnomalies.length} volume anomalies detected`,
      score: Math.min(volumeAnomalies.length * 0.2, 1.0),
      details: volumeAnomalies
    });
  }

  // Calculate overall risk score
  analysis.riskScore = calculateRiskScore(analysis.patterns, analysis.metrics);
  return analysis;
}

/**
 * Detect unusual trading volume patterns
 * @param {Array} trades - Trading data
 * @param {number} threshold - Volume threshold multiplier
 * @returns {Array} - Detected anomalies
 */
function detectVolumeAnomalies(trades, threshold = 2.0) {
  const anomalies = [];
  
  if (trades.length < 3) return anomalies;

  // Calculate average and standard deviation
  const volumes = trades.map(t => t.shares || 0);
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  const stdDev = Math.sqrt(
    volumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / volumes.length
  );

  // Find trades exceeding threshold
  trades.forEach(trade => {
    const volume = trade.shares || 0;
    const zScore = (volume - avgVolume) / stdDev;
    
    if (Math.abs(zScore) > threshold) {
      anomalies.push({
        tradeId: trade.id,
        volume,
        avgVolume,
        zScore,
        anomalyType: zScore > 0 ? 'unusually_high' : 'unusually_low',
        date: trade.transactionDate
      });
    }
  });

  return anomalies;
}

/**
 * Detect trade clustering in time
 * @param {Array} trades - Trading data
 * @param {number} windowDays - Time window in days
 * @returns {Object} - Clustering analysis
 */
function detectTradeClustering(trades, windowDays = 30) {
  if (trades.length < 2) {
    return { score: 0, clusterCount: 0, clusters: [] };
  }

  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const sortedTrades = trades.sort((a, b) => 
    new Date(a.transactionDate) - new Date(b.transactionDate)
  );

  const clusters = [];
  let currentCluster = [sortedTrades[0]];

  for (let i = 1; i < sortedTrades.length; i++) {
    const timeDiff = new Date(sortedTrades[i].transactionDate) - 
                    new Date(currentCluster[currentCluster.length - 1].transactionDate);

    if (timeDiff <= windowMs) {
      currentCluster.push(sortedTrades[i]);
    } else {
      if (currentCluster.length > 1) {
        clusters.push({
          trades: currentCluster,
          startDate: currentCluster[0].transactionDate,
          endDate: currentCluster[currentCluster.length - 1].transactionDate,
          count: currentCluster.length
        });
      }
      currentCluster = [sortedTrades[i]];
    }
  }

  // Add final cluster if it has multiple trades
  if (currentCluster.length > 1) {
    clusters.push({
      trades: currentCluster,
      startDate: currentCluster[0].transactionDate,
      endDate: currentCluster[currentCluster.length - 1].transactionDate,
      count: currentCluster.length
    });
  }

  // Calculate clustering score
  const totalClustered = clusters.reduce((sum, cluster) => sum + cluster.count, 0);
  const clusteringScore = totalClustered / trades.length;

  return {
    score: clusteringScore,
    clusterCount: clusters.length,
    clusters,
    totalClustered
  };
}

/**
 * Detect timing patterns in trades
 * @param {Array} trades - Trading data
 * @returns {Object} - Timing pattern analysis
 */
function detectTimingPatterns(trades) {
  const patterns = {
    score: 0,
    description: 'No significant timing patterns',
    details: {}
  };

  if (trades.length < 3) return patterns;

  // Analyze day-of-week patterns
  const dayPattern = analyzeDayOfWeekPattern(trades);
  
  // Analyze pre-earnings patterns
  const earningsPattern = analyzeEarningsPattern(trades);
  
  // Analyze end-of-quarter patterns
  const quarterPattern = analyzeQuarterEndPattern(trades);

  // Combine patterns
  const patternScores = [dayPattern.score, earningsPattern.score, quarterPattern.score];
  patterns.score = Math.max(...patternScores);

  if (patterns.score > 0.4) {
    const dominantPattern = [dayPattern, earningsPattern, quarterPattern]
      .find(p => p.score === patterns.score);
    patterns.description = dominantPattern.description;
    patterns.details = dominantPattern.details;
  }

  return patterns;
}

/**
 * Analyze day-of-week trading patterns
 * @param {Array} trades - Trading data
 * @returns {Object} - Day pattern analysis
 */
function analyzeDayOfWeekPattern(trades) {
  const dayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  
  trades.forEach(trade => {
    const dayOfWeek = new Date(trade.transactionDate).getDay();
    dayCounts[dayOfWeek]++;
  });

  // Calculate concentration (higher = more concentrated on specific days)
  const totalTrades = trades.length;
  const expectedPerDay = totalTrades / 7;
  const variance = Object.values(dayCounts)
    .reduce((sum, count) => sum + Math.pow(count - expectedPerDay, 2), 0) / 7;
  
  const concentration = variance / (expectedPerDay * expectedPerDay);

  return {
    score: Math.min(concentration, 1.0),
    description: concentration > 0.5 ? 'Trades concentrated on specific days' : 'Even distribution across days',
    details: { dayCounts, concentration, variance }
  };
}

/**
 * Analyze earnings-related timing patterns
 * @param {Array} trades - Trading data
 * @returns {Object} - Earnings pattern analysis
 */
function analyzeEarningsPattern(trades) {
  // This would require earnings dates data - simplified for now
  return {
    score: 0,
    description: 'Earnings pattern analysis requires earnings dates',
    details: { message: 'Not implemented - requires earnings calendar data' }
  };
}

/**
 * Analyze quarter-end timing patterns
 * @param {Array} trades - Trading data
 * @returns {Object} - Quarter pattern analysis
 */
function analyzeQuarterEndPattern(trades) {
  let quarterEndTrades = 0;
  
  trades.forEach(trade => {
    const date = new Date(trade.transactionDate);
    const month = date.getMonth();
    const day = date.getDate();
    
    // Check if within last 10 days of quarter
    const isQuarterEnd = (month === 2 && day > 21) || // March
                        (month === 5 && day > 20) || // June
                        (month === 8 && day > 21) || // September
                        (month === 11 && day > 21);  // December
    
    if (isQuarterEnd) quarterEndTrades++;
  });

  const quarterEndRatio = quarterEndTrades / trades.length;

  return {
    score: quarterEndRatio > 0.3 ? quarterEndRatio : 0,
    description: quarterEndRatio > 0.3 ? 
      `${Math.round(quarterEndRatio * 100)}% of trades near quarter-end` : 
      'No quarter-end concentration',
    details: { quarterEndTrades, quarterEndRatio }
  };
}

/**
 * Calculate risk score from patterns and metrics
 * @param {Array} patterns - Detected patterns
 * @param {Object} metrics - Trade metrics
 * @returns {number} - Risk score (0-1)
 */
function calculateRiskScore(patterns, metrics) {
  if (patterns.length === 0) return 0;

  // Weight different pattern types
  const weights = {
    clustering: 0.4,
    volume_anomaly: 0.3,
    timing_pattern: 0.3
  };

  let weightedScore = 0;
  let totalWeight = 0;

  patterns.forEach(pattern => {
    const weight = weights[pattern.type] || 0.2;
    weightedScore += pattern.score * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedScore / totalWeight : 0;
}

/**
 * Calculate trade metrics
 * @param {Array} trades - Trading data
 * @returns {Object} - Trade metrics
 */
function calculateTradeMetrics(trades) {
  const totalValue = trades.reduce((sum, t) => sum + (t.totalValue || 0), 0);
  const totalShares = trades.reduce((sum, t) => sum + (t.shares || 0), 0);
  const buyTrades = trades.filter(t => t.acquiredDisposed === 'A');
  const sellTrades = trades.filter(t => t.acquiredDisposed === 'D');

  return {
    totalTrades: trades.length,
    totalValue,
    totalShares,
    buyTrades: buyTrades.length,
    sellTrades: sellTrades.length,
    avgTradeValue: totalValue / trades.length,
    buyVsSellRatio: buyTrades.length / (sellTrades.length || 1),
    netValue: buyTrades.reduce((sum, t) => sum + (t.totalValue || 0), 0) -
              sellTrades.reduce((sum, t) => sum + (t.totalValue || 0), 0),
    dateRange: {
      earliest: Math.min(...trades.map(t => new Date(t.transactionDate).getTime())),
      latest: Math.max(...trades.map(t => new Date(t.transactionDate).getTime()))
    }
  };
}

/**
 * Calculate activity summary
 * @param {Array} abnormalTrades - Abnormal trading activities
 * @returns {Object} - Activity summary
 */
function calculateActivitySummary(abnormalTrades) {
  return {
    totalAbnormal: abnormalTrades.length,
    avgRiskScore: abnormalTrades.reduce((sum, t) => sum + t.riskScore, 0) / abnormalTrades.length,
    highRiskCount: abnormalTrades.filter(t => t.riskScore > 0.8).length,
    mediumRiskCount: abnormalTrades.filter(t => t.riskScore > 0.5 && t.riskScore <= 0.8).length,
    lowRiskCount: abnormalTrades.filter(t => t.riskScore <= 0.5).length,
    patternTypes: getPatternTypeFrequency(abnormalTrades)
  };
}

/**
 * Group trades by ticker symbol
 * @param {Array} trades - Trading data
 * @returns {Object} - Trades grouped by ticker
 */
function groupTradesByTicker(trades) {
  return trades.reduce((groups, trade) => {
    const ticker = trade.ticker || 'UNKNOWN';
    if (!groups[ticker]) groups[ticker] = [];
    groups[ticker].push(trade);
    return groups;
  }, {});
}

/**
 * Get frequency of pattern types
 * @param {Array} abnormalTrades - Abnormal trading activities
 * @returns {Object} - Pattern type frequencies
 */
function getPatternTypeFrequency(abnormalTrades) {
  const frequencies = {};
  
  abnormalTrades.forEach(trade => {
    trade.patterns.forEach(pattern => {
      frequencies[pattern.type] = (frequencies[pattern.type] || 0) + 1;
    });
  });

  return frequencies;
}

/**
 * Analyze institutional holdings changes
 * @param {Array} holdings - Holdings data with historical comparison
 * @param {Object} options - Analysis options
 * @returns {Object} - Holdings analysis
 */
function analyzeInstitutionalHoldings(holdings, options = {}) {
  const {
    significantChangeThreshold = 0.05, // 5%
    minHoldingValue = 1000000 // $1M
  } = options;

  const analysis = {
    totalHoldings: holdings.length,
    significantChanges: [],
    trends: {},
    summary: {}
  };

  // Analyze significant changes
  holdings.forEach(holding => {
    if (holding.change && holding.holding.value >= minHoldingValue) {
      const changePercent = Math.abs(holding.change.percentage);
      
      if (changePercent >= significantChangeThreshold * 100) {
        analysis.significantChanges.push({
          institution: holding.institution.name,
          ticker: holding.ticker,
          changeType: holding.change.type,
          changePercent: holding.change.percentage,
          value: holding.holding.value,
          shares: holding.holding.shares
        });
      }
    }
  });

  // Calculate trends
  analysis.trends = calculateHoldingsTrends(analysis.significantChanges);
  analysis.summary = summarizeHoldingsChanges(analysis.significantChanges);

  return analysis;
}

/**
 * Calculate holdings trends
 * @param {Array} changes - Significant changes
 * @returns {Object} - Trends analysis
 */
function calculateHoldingsTrends(changes) {
  const increases = changes.filter(c => c.changeType === 'increase');
  const decreases = changes.filter(c => c.changeType === 'decrease');

  return {
    increaseTrend: increases.length > decreases.length,
    increaseCount: increases.length,
    decreaseCount: decreases.length,
    netTrend: increases.length - decreases.length,
    avgIncreasePercent: increases.length > 0 ? 
      increases.reduce((sum, c) => sum + c.changePercent, 0) / increases.length : 0,
    avgDecreasePercent: decreases.length > 0 ? 
      decreases.reduce((sum, c) => sum + Math.abs(c.changePercent), 0) / decreases.length : 0
  };
}

/**
 * Summarize holdings changes
 * @param {Array} changes - Significant changes
 * @returns {Object} - Summary statistics
 */
function summarizeHoldingsChanges(changes) {
  return {
    totalSignificantChanges: changes.length,
    uniqueInstitutions: new Set(changes.map(c => c.institution)).size,
    uniqueTickers: new Set(changes.map(c => c.ticker)).size,
    totalValueImpacted: changes.reduce((sum, c) => sum + c.value, 0),
    largestIncrease: changes
      .filter(c => c.changeType === 'increase')
      .sort((a, b) => b.changePercent - a.changePercent)[0] || null,
    largestDecrease: changes
      .filter(c => c.changeType === 'decrease')
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))[0] || null
  };
}

module.exports = {
  analyzeAbnormalActivity,
  analyzeTickerActivity,
  detectVolumeAnomalies,
  detectTradeClustering,
  detectTimingPatterns,
  calculateRiskScore,
  calculateTradeMetrics,
  analyzeInstitutionalHoldings,
  groupTradesByTicker
}; 