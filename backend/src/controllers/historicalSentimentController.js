const { 
  getHistoricalSentiment, 
  getSentimentTrends, 
  getComparativeHistorical 
} = require('../services/historicalSentimentService');

/**
 * Get historical sentiment data for a ticker
 * GET /api/sentiment/historical/:ticker?days=30
 */
async function getHistoricalSentimentController(req, res) {
  try {
    const { ticker } = req.params;
    const { days = 30 } = req.query;

    if (!ticker) {
      return res.status(400).json({
        error: 'Ticker parameter is required'
      });
    }

    // Validate days parameter
    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum <= 0 || daysNum > 365) {
      return res.status(400).json({
        error: 'Days parameter must be a number between 1 and 365'
      });
    }

    const historicalData = await getHistoricalSentiment(ticker.toUpperCase(), daysNum);

    res.json({
      success: true,
      data: {
        ticker: ticker.toUpperCase(),
        historicalSentiment: historicalData,
        timeframe: `${daysNum} days`,
        dataPoints: historicalData.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in getHistoricalSentimentController:', error);
    res.status(500).json({
      error: 'Failed to fetch historical sentiment data',
      message: error.message
    });
  }
}

/**
 * Get sentiment trends for a ticker
 * GET /api/sentiment/trends/:ticker?days=30
 */
async function getSentimentTrendsController(req, res) {
  try {
    const { ticker } = req.params;
    const { days = 30 } = req.query;

    if (!ticker) {
      return res.status(400).json({
        error: 'Ticker parameter is required'
      });
    }

    // Validate days parameter
    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum < 7 || daysNum > 365) {
      return res.status(400).json({
        error: 'Days parameter must be a number between 7 and 365'
      });
    }

    const trends = await getSentimentTrends(ticker.toUpperCase(), daysNum);

    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    console.error('Error in getSentimentTrendsController:', error);
    res.status(500).json({
      error: 'Failed to fetch sentiment trends',
      message: error.message
    });
  }
}

/**
 * Get comparative historical sentiment for multiple tickers
 * GET /api/sentiment/comparative?tickers=AAPL,MSFT,GOOGL&days=30
 */
async function getComparativeHistoricalController(req, res) {
  try {
    const { tickers, days = 30 } = req.query;

    if (!tickers) {
      return res.status(400).json({
        error: 'Tickers parameter is required'
      });
    }

    // Parse and validate tickers
    const tickerArray = tickers.split(',').map(t => t.trim().toUpperCase()).filter(t => t.length > 0);
    
    if (tickerArray.length === 0) {
      return res.status(400).json({
        error: 'At least one valid ticker is required'
      });
    }

    if (tickerArray.length > 10) {
      return res.status(400).json({
        error: 'Maximum 10 tickers allowed for comparison'
      });
    }

    // Validate days parameter
    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum <= 0 || daysNum > 365) {
      return res.status(400).json({
        error: 'Days parameter must be a number between 1 and 365'
      });
    }

    const comparativeData = await getComparativeHistorical(tickerArray, daysNum);

    res.json({
      success: true,
      data: comparativeData
    });

  } catch (error) {
    console.error('Error in getComparativeHistoricalController:', error);
    res.status(500).json({
      error: 'Failed to fetch comparative historical data',
      message: error.message
    });
  }
}

/**
 * Get historical sentiment summary with key metrics
 * GET /api/sentiment/summary/:ticker?days=30
 */
async function getHistoricalSummaryController(req, res) {
  try {
    const { ticker } = req.params;
    const { days = 30 } = req.query;

    if (!ticker) {
      return res.status(400).json({
        error: 'Ticker parameter is required'
      });
    }

    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum < 7 || daysNum > 365) {
      return res.status(400).json({
        error: 'Days parameter must be a number between 7 and 365'
      });
    }

    // Get both historical data and trends
    const [historicalData, trends] = await Promise.all([
      getHistoricalSentiment(ticker.toUpperCase(), daysNum),
      getSentimentTrends(ticker.toUpperCase(), daysNum)
    ]);

    // Calculate additional summary metrics
    const scores = historicalData.map(d => d.sentiment_score);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    
    // Count sentiment labels
    const sentimentCounts = historicalData.reduce((acc, d) => {
      acc[d.sentiment_label] = (acc[d.sentiment_label] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        ticker: ticker.toUpperCase(),
        summary: {
          timeframe: `${daysNum} days`,
          dataPoints: historicalData.length,
          averageScore: Math.round(avgScore * 1000) / 1000,
          maxScore: Math.round(maxScore * 1000) / 1000,
          minScore: Math.round(minScore * 1000) / 1000,
          sentimentDistribution: sentimentCounts,
          trends
        },
        recentData: historicalData.slice(0, 7) // Last 7 days
      }
    });

  } catch (error) {
    console.error('Error in getHistoricalSummaryController:', error);
    res.status(500).json({
      error: 'Failed to fetch historical summary',
      message: error.message
    });
  }
}

module.exports = {
  getHistoricalSentimentController,
  getSentimentTrendsController,
  getComparativeHistoricalController,
  getHistoricalSummaryController
}; 