const express = require('express');
const router = express.Router();
const { pool } = require('../config/data-sources');
const { authenticateToken } = require('../middleware/auth');
const redditSentimentService = require('../services/redditSentimentService');
const yahooSentimentService = require('../services/yahooSentimentService');

router.get('/yahoo/tickers', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔧 [SENTIMENT DEBUG] Starting Yahoo tickers sentiment request, timeRange: ${req.query.timeRange || '1w'}`);
    console.log(`🔧 [SENTIMENT DEBUG] User: ${req.user.id}, Tier: ${req.user.tier}, Query params:`, req.query);
    
    const timeRange = req.query.timeRange || '1w';
    const userId = req.user.id;
    
    let userTickers = null;
    try {
      // Fetch user watchlist for ALL users, not just Pro users
      const result = await pool.query('SELECT symbol FROM watchlist WHERE user_id = $1', [userId]);
      if (result.rows.length > 0) {
        userTickers = result.rows.map(row => row.symbol);
        console.log(`🔧 [SENTIMENT DEBUG] Using user watchlist for ${req.user.tier} user: ${userTickers.length} tickers`, userTickers);
      } else {
        console.log(`🔧 [SENTIMENT DEBUG] User has empty watchlist, will use default tickers`);
      }
    } catch (error) {
      console.error('Error fetching user watchlist:', error);
    }

    console.log(`🔧 [SENTIMENT DEBUG] Calling yahooSentimentService.getYahooTickerSentiment...`);
    const sentimentData = await yahooSentimentService.getYahooTickerSentiment(timeRange, userId, userTickers);
    console.log(`🔧 [SENTIMENT DEBUG] Yahoo ticker sentiment data received: ${sentimentData?.sentimentData?.length || 0} items`);

    const fetchDuration = Date.now() - startTime;
    res.locals.fetchDuration = fetchDuration;

    res.json({
      sentimentData: sentimentData.sentimentData || [],
      credits: req.user.tier !== 'free' ? 0 : Math.ceil((sentimentData.sentimentData?.length || 0) / 10),
      meta: {
        source: 'yahoo',
        timeRange,
        fetchDuration: `${fetchDuration}ms`,
        dataCount: sentimentData.sentimentData?.length || 0,
        ...sentimentData.meta
      }
    });
  } catch (error) {
    console.error('🔧 [SENTIMENT ERROR] Error in Yahoo tickers sentiment:', error);
    res.status(500).json({ 
      error: 'Failed to fetch sentiment data', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timeRange: req.query.timeRange,
      debugInfo: {
        endpoint: 'yahoo/tickers',
        timestamp: new Date().toISOString(),
        userId: req.user.id
      }
    });
  }
});

router.get('/reddit/tickers', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔧 [SENTIMENT DEBUG] Starting Reddit tickers sentiment request, timeRange: ${req.query.timeRange || '1w'}`);
    console.log(`🔧 [SENTIMENT DEBUG] User: ${req.user.id}, Tier: ${req.user.tier}, Query params:`, req.query);
    
    const timeRange = req.query.timeRange || '1w';
    const userId = req.user.id;
    
    let userTickers = null;
    try {
      // Fetch user watchlist for ALL users, not just Pro users
      const result = await pool.query('SELECT symbol FROM watchlist WHERE user_id = $1', [userId]);
      if (result.rows.length > 0) {
        userTickers = result.rows.map(row => row.symbol);
        console.log(`🔧 [SENTIMENT DEBUG] Using user watchlist for ${req.user.tier} user: ${userTickers.length} tickers`, userTickers);
      } else {
        console.log(`🔧 [SENTIMENT DEBUG] User has empty watchlist, will use default tickers`);
      }
    } catch (error) {
      console.error('Error fetching user watchlist:', error);
    }

    console.log(`🔧 [SENTIMENT DEBUG] Calling redditSentimentService.getRedditTickerSentiment...`);
    const sentimentData = await redditSentimentService.getRedditTickerSentiment(timeRange, userId, userTickers);
    console.log(`🔧 [SENTIMENT DEBUG] Reddit ticker sentiment data received: ${sentimentData?.sentimentData?.length || 0} items`);

    const fetchDuration = Date.now() - startTime;
    res.locals.fetchDuration = fetchDuration;

    res.json({
      sentimentData: sentimentData.sentimentData || [],
      credits: req.user.tier !== 'free' ? 0 : Math.ceil((sentimentData.sentimentData?.length || 0) / 10),
      meta: {
        source: 'reddit',
        timeRange,
        fetchDuration: `${fetchDuration}ms`,
        dataCount: sentimentData.sentimentData?.length || 0,
        ...sentimentData.meta
      }
    });
  } catch (error) {
    console.error('🔧 [SENTIMENT ERROR] Error in Reddit tickers sentiment:', error);
    res.status(500).json({ 
      error: 'Failed to fetch sentiment data', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timeRange: req.query.timeRange,
      debugInfo: {
        endpoint: 'reddit/tickers',
        timestamp: new Date().toISOString(),
        userId: req.user.id
      }
    });
  }
});

module.exports = router; 