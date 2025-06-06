/**
 * SEC Response Formatter - Standardized response formatting for SEC data
 */

/**
 * Create standardized success response
 * @param {*} data - Response data
 * @param {Object} metadata - Additional metadata
 * @param {Object} options - Formatting options
 * @returns {Object} - Standardized response
 */
function createSuccessResponse(data, metadata = {}, options = {}) {
  const response = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    ...metadata
  };
  return response;
}

/**
 * Format insider trades response
 * @param {Array} trades - Raw insider trades data
 * @param {Object} options - Formatting options
 * @returns {Object} - Formatted response
 */
function formatInsiderTradesResponse(trades, options = {}) {
  const formattedTrades = trades.map(trade => formatInsiderTrade(trade));
  const metadata = {
    dataType: 'insider_trades',
    stats: calculateTradeStats(formattedTrades)
  };
  return createSuccessResponse(formattedTrades, metadata);
}

/**
 * Format individual insider trade
 * @param {Object} trade - Raw trade data
 * @returns {Object} - Formatted trade
 */
function formatInsiderTrade(trade) {
  return {
    id: trade.id,
    ticker: trade.ticker?.toUpperCase(),
    companyName: trade.companyName,
    insider: {
      name: trade.insiderName,
      title: trade.insiderTitle,
      relationship: trade.relationship
    },
    transaction: {
      type: trade.transactionType,
      date: trade.transactionDate,
      shares: formatNumber(trade.shares),
      pricePerShare: formatCurrency(trade.pricePerShare),
      totalValue: formatCurrency(trade.totalValue),
      acquiredDisposed: trade.acquiredDisposed
    },
    filingDate: trade.filingDate,
    source: trade.source || 'SEC',
    documentUrl: trade.documentUrl,
    confidence: trade.confidence || 1.0
  };
}

/**
 * Format institutional holdings response
 * @param {Array} holdings - Raw holdings data
 * @param {Object} options - Formatting options
 * @returns {Object} - Formatted response
 */
function formatInstitutionalHoldingsResponse(holdings, options = {}) {
  const {
    ticker = null,
    quarter = null,
    includeChanges = true
  } = options;

  const formattedHoldings = holdings.map(holding => formatInstitutionalHolding(holding));

  const metadata = {
    dataType: 'institutional_holdings',
    ticker,
    quarter,
    stats: calculateHoldingsStats(formattedHoldings)
  };

  if (includeChanges) {
    metadata.changes = analyzeHoldingsChanges(formattedHoldings);
  }

  return createSuccessResponse(formattedHoldings, metadata, {
    includeStats: true
  });
}

/**
 * Format individual institutional holding
 * @param {Object} holding - Raw holding data
 * @returns {Object} - Formatted holding
 */
function formatInstitutionalHolding(holding) {
  return {
    id: holding.id,
    ticker: holding.ticker?.toUpperCase(),
    institution: {
      name: holding.institutionName,
      cik: holding.institutionCik,
      type: holding.institutionType
    },
    holding: {
      shares: formatNumber(holding.shares),
      value: formatCurrency(holding.value),
      percentOwnership: formatPercentage(holding.percentOwnership),
      rank: holding.rank
    },
    quarter: holding.quarter,
    filingDate: holding.filingDate,
    reportDate: holding.reportDate,
    change: holding.previousShares ? {
      shares: formatNumber(holding.shares - holding.previousShares),
      percentage: formatPercentage(
        ((holding.shares - holding.previousShares) / holding.previousShares) * 100
      ),
      type: holding.shares > holding.previousShares ? 'increase' : 'decrease'
    } : null
  };
}

/**
 * Format abnormal activity response
 * @param {Array} activities - Raw activity data
 * @param {Object} options - Formatting options
 * @returns {Object} - Formatted response
 */
function formatAbnormalActivityResponse(activities, options = {}) {
  const {
    minScore = 0,
    timeRange = '1w',
    includeDetails = true
  } = options;

  const formattedActivities = activities.map(activity => formatAbnormalActivity(activity));

  const metadata = {
    dataType: 'abnormal_activity',
    timeRange,
    minScore,
    stats: calculateActivityStats(formattedActivities)
  };

  if (includeDetails) {
    metadata.patterns = identifyActivityPatterns(formattedActivities);
  }

  return createSuccessResponse(formattedActivities, metadata, {
    includeStats: true,
    includeCache: true
  });
}

/**
 * Format individual abnormal activity
 * @param {Object} activity - Raw activity data
 * @returns {Object} - Formatted activity
 */
function formatAbnormalActivity(activity) {
  return {
    id: activity.id,
    ticker: activity.ticker?.toUpperCase(),
    companyName: activity.companyName,
    activity: {
      type: activity.activityType,
      description: activity.description,
      score: activity.score,
      severity: getActivitySeverity(activity.score),
      detectedDate: activity.detectedDate
    },
    metrics: {
      volumeIncrease: formatPercentage(activity.volumeIncrease),
      priceMovement: formatPercentage(activity.priceMovement),
      tradingIntensity: activity.tradingIntensity,
      insiderActivity: activity.insiderActivity
    },
    timeWindow: {
      start: activity.windowStart,
      end: activity.windowEnd,
      duration: activity.windowDuration
    },
    relatedEvents: activity.relatedEvents || [],
    confidence: activity.confidence || 0.8
  };
}

/**
 * Format filing details response
 * @param {Array} filings - Raw filing data
 * @param {Object} options - Formatting options
 * @returns {Object} - Formatted response
 */
function formatFilingDetailsResponse(filings, options = {}) {
  const {
    ticker = null,
    formType = null,
    includeContent = false
  } = options;

  const formattedFilings = filings.map(filing => formatFilingDetail(filing, { includeContent }));

  const metadata = {
    dataType: 'filing_details',
    ticker,
    formType,
    stats: calculateFilingStats(formattedFilings)
  };

  return createSuccessResponse(formattedFilings, metadata, {
    includeStats: true
  });
}

/**
 * Format individual filing detail
 * @param {Object} filing - Raw filing data
 * @param {Object} options - Formatting options
 * @returns {Object} - Formatted filing
 */
function formatFilingDetail(filing, options = {}) {
  const { includeContent = false } = options;

  const formatted = {
    id: filing.id,
    ticker: filing.ticker?.toUpperCase(),
    companyName: filing.companyName,
    filing: {
      type: filing.formType,
      description: filing.formDescription,
      filingDate: filing.filingDate,
      acceptedDate: filing.acceptedDate,
      reportDate: filing.reportDate
    },
    urls: {
      document: filing.documentUrl,
      html: filing.htmlUrl,
      xml: filing.xmlUrl
    },
    size: filing.size,
    pages: filing.pages
  };

  if (includeContent && filing.content) {
    formatted.content = {
      summary: filing.contentSummary,
      keyItems: filing.keyItems,
      fullText: filing.fullContent
    };
  }

  return formatted;
}

/**
 * Format ticker summary response
 * @param {Object} summary - Raw summary data
 * @param {Object} options - Formatting options
 * @returns {Object} - Formatted response
 */
function formatTickerSummaryResponse(summary, options = {}) {
  const {
    timeRange = '1m',
    includeHistory = true
  } = options;

  const formattedSummary = {
    ticker: summary.ticker?.toUpperCase(),
    companyName: summary.companyName,
    summary: {
      timeRange,
      generatedAt: new Date().toISOString(),
      lastUpdated: summary.lastUpdated
    },
    insiderActivity: {
      totalTrades: summary.insiderTrades?.length || 0,
      totalValue: formatCurrency(summary.totalInsiderValue || 0),
      netActivity: summary.netInsiderActivity,
      topInsiders: summary.topInsiders?.slice(0, 5) || []
    },
    institutionalActivity: {
      totalHolders: summary.institutionalHolders?.length || 0,
      totalShares: formatNumber(summary.totalInstitutionalShares || 0),
      topHolders: summary.topInstitutionalHolders?.slice(0, 10) || [],
      ownershipPercentage: formatPercentage(summary.institutionalOwnership || 0)
    },
    filingActivity: {
      recentFilings: summary.recentFilings?.length || 0,
      lastFiling: summary.lastFilingDate,
      filingTypes: summary.filingTypes || []
    }
  };

  if (includeHistory && summary.historicalData) {
    formattedSummary.historicalTrends = formatHistoricalTrends(summary.historicalData);
  }

  const metadata = {
    dataType: 'ticker_summary',
    timeRange,
    ticker: summary.ticker
  };

  return createSuccessResponse(formattedSummary, metadata);
}

/**
 * Format pagination information
 * @param {Object} pagination - Raw pagination data
 * @returns {Object} - Formatted pagination
 */
function formatPagination(pagination) {
  return {
    currentPage: pagination.page || 1,
    pageSize: pagination.limit || 100,
    totalItems: pagination.total || 0,
    totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 100)),
    hasNext: pagination.hasNext || false,
    hasPrevious: pagination.hasPrevious || false,
    nextPage: pagination.nextPage || null,
    previousPage: pagination.previousPage || null
  };
}

/**
 * Format cache information
 * @param {Object} cache - Raw cache data
 * @returns {Object} - Formatted cache info
 */
function formatCacheInfo(cache) {
  return {
    cached: cache.fromCache || false,
    cacheKey: cache.key,
    cachedAt: cache.cachedAt,
    expiresAt: cache.expiresAt,
    ttl: cache.ttl,
    fresh: cache.fresh || false
  };
}

/**
 * Calculate trade statistics
 * @param {Array} trades - Formatted trades
 * @returns {Object} - Trade statistics
 */
function calculateTradeStats(trades) {
  const totalValue = trades.reduce((sum, trade) => sum + (trade.transaction.totalValue || 0), 0);
  const buyTrades = trades.filter(t => t.transaction.acquiredDisposed === 'A');
  const sellTrades = trades.filter(t => t.transaction.acquiredDisposed === 'D');

  return {
    totalTrades: trades.length,
    totalValue: formatCurrency(totalValue),
    buyTrades: buyTrades.length,
    sellTrades: sellTrades.length,
    uniqueTickers: new Set(trades.map(t => t.ticker)).size,
    uniqueInsiders: new Set(trades.map(t => t.insider.name)).size
  };
}

/**
 * Get activity severity based on score
 * @param {number} score - Activity score
 * @returns {string} - Severity level
 */
function getActivitySeverity(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  if (score >= 0.4) return 'low';
  return 'minimal';
}

/**
 * Format number with thousands separators
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
function formatNumber(num) {
  if (num === null || num === undefined) return null;
  return num.toLocaleString();
}

/**
 * Format currency value
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format percentage value
 * @param {number} percent - Percentage to format
 * @returns {string} - Formatted percentage
 */
function formatPercentage(percent) {
  if (percent === null || percent === undefined) return null;
  return `${percent.toFixed(2)}%`;
}

/**
 * Calculate holdings statistics
 * @param {Array} holdings - Formatted holdings
 * @returns {Object} - Holdings statistics
 */
function calculateHoldingsStats(holdings) {
  const totalValue = holdings.reduce((sum, h) => sum + (h.holding.value || 0), 0);
  const totalShares = holdings.reduce((sum, h) => sum + (h.holding.shares || 0), 0);

  return {
    totalHoldings: holdings.length,
    totalValue: formatCurrency(totalValue),
    totalShares: formatNumber(totalShares),
    uniqueInstitutions: new Set(holdings.map(h => h.institution.name)).size,
    averagePosition: formatCurrency(totalValue / holdings.length)
  };
}

/**
 * Calculate activity statistics
 * @param {Array} activities - Formatted activities
 * @returns {Object} - Activity statistics
 */
function calculateActivityStats(activities) {
  const averageScore = activities.reduce((sum, a) => sum + a.activity.score, 0) / activities.length;
  const severityCounts = activities.reduce((counts, a) => {
    counts[a.activity.severity] = (counts[a.activity.severity] || 0) + 1;
    return counts;
  }, {});

  return {
    totalActivities: activities.length,
    averageScore: averageScore.toFixed(3),
    severityBreakdown: severityCounts,
    uniqueTickers: new Set(activities.map(a => a.ticker)).size,
    timeRange: {
      earliest: Math.min(...activities.map(a => new Date(a.activity.detectedDate).getTime())),
      latest: Math.max(...activities.map(a => new Date(a.activity.detectedDate).getTime()))
    }
  };
}

/**
 * Calculate filing statistics
 * @param {Array} filings - Formatted filings
 * @returns {Object} - Filing statistics
 */
function calculateFilingStats(filings) {
  const formTypes = filings.reduce((counts, f) => {
    counts[f.filing.type] = (counts[f.filing.type] || 0) + 1;
    return counts;
  }, {});

  return {
    totalFilings: filings.length,
    formTypeBreakdown: formTypes,
    uniqueCompanies: new Set(filings.map(f => f.ticker)).size,
    dateRange: {
      earliest: Math.min(...filings.map(f => new Date(f.filing.filingDate).getTime())),
      latest: Math.max(...filings.map(f => new Date(f.filing.filingDate).getTime()))
    }
  };
}

// Placeholder functions for advanced analysis
function analyzeInsiderActivity(trades) { return { pattern: 'analyzing...' }; }
function analyzeHoldingsChanges(holdings) { return { trend: 'analyzing...' }; }
function identifyActivityPatterns(activities) { return { patterns: 'analyzing...' }; }
function formatHistoricalTrends(data) { return { trends: 'analyzing...' }; }

module.exports = {
  createSuccessResponse,
  formatInsiderTradesResponse,
  formatInstitutionalHoldingsResponse,
  formatAbnormalActivityResponse,
  formatFilingDetailsResponse,
  formatTickerSummaryResponse,
  formatInsiderTrade,
  formatInstitutionalHolding,
  formatAbnormalActivity,
  formatFilingDetail,
  formatPagination,
  formatCacheInfo,
  formatNumber,
  formatCurrency,
  formatPercentage
}; 