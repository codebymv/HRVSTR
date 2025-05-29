const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool } = require('../config/data-sources');
const authenticateToken = require('../middleware/authMiddleware');
const { FinancialCalendarService } = require('../services/financialCalendar');

const financialCalendarService = new FinancialCalendarService();

// Tier limits for API usage
const TIER_LIMITS = {
  free: { daily_searches: 25, daily_price_updates: 25 },
  pro: { daily_searches: null, daily_price_updates: null }, // unlimited
  elite: { daily_searches: null, daily_price_updates: null }, // unlimited
  institutional: { daily_searches: null, daily_price_updates: null } // unlimited
};

// Helper function to check and increment API usage
const checkAndIncrementUsage = async (userId, usageType, tier) => {
  console.log(`[TIER_DEBUG] checkAndIncrementUsage called with:`, { userId, usageType, tier });
  
  const limit = TIER_LIMITS[tier]?.[usageType];
  console.log(`[TIER_DEBUG] Tier limits for ${tier}:`, TIER_LIMITS[tier]);
  console.log(`[TIER_DEBUG] Limit for ${usageType}:`, limit);
  
  // If no limit for this tier, allow unlimited usage
  if (limit === null || limit === undefined) {
    console.log(`[TIER_DEBUG] No limit for tier ${tier}, allowing unlimited usage`);
    return { allowed: true, current: 0, limit: null };
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  console.log(`[TIER_DEBUG] Checking usage for date: ${today}`);
  
  try {
    // Get or create usage record for today
    console.log(`[TIER_DEBUG] Querying database for existing usage...`);
    const usageResult = await pool.query(
      'SELECT * FROM api_usage WHERE user_id = $1 AND usage_date = $2',
      [userId, today]
    );

    console.log(`[TIER_DEBUG] Usage query result:`, usageResult.rows);

    let currentUsage = 0;
    if (usageResult.rows.length > 0) {
      currentUsage = usageResult.rows[0][usageType] || 0;
      console.log(`[TIER_DEBUG] Found existing usage record. Current ${usageType}: ${currentUsage}`);
    } else {
      console.log(`[TIER_DEBUG] No existing usage record found for today`);
    }

    // Check if over limit
    if (currentUsage >= limit) {
      console.log(`[TIER_LIMIT] User ${userId} hit ${usageType} limit: ${currentUsage}/${limit}`);
      return { allowed: false, current: currentUsage, limit };
    }

    // Increment usage
    if (usageResult.rows.length > 0) {
      console.log(`[TIER_DEBUG] Updating existing usage record...`);
      const updateQuery = `UPDATE api_usage SET ${usageType} = ${usageType} + 1 WHERE user_id = $1 AND usage_date = $2`;
      console.log(`[TIER_DEBUG] Update query: ${updateQuery}`);
      await pool.query(updateQuery, [userId, today]);
    } else {
      console.log(`[TIER_DEBUG] Creating new usage record...`);
      const insertQuery = `INSERT INTO api_usage (user_id, usage_date, ${usageType}) VALUES ($1, $2, 1)`;
      console.log(`[TIER_DEBUG] Insert query: ${insertQuery}`);
      await pool.query(insertQuery, [userId, today]);
    }

    console.log(`[TIER_LIMIT] User ${userId} ${usageType}: ${currentUsage + 1}/${limit}`);
    return { allowed: true, current: currentUsage + 1, limit };
  } catch (error) {
    console.error(`[TIER_DEBUG] Error checking API usage:`, error);
    // On error, allow the request but log it
    return { allowed: true, current: 0, limit };
  }
};

// Helper function to clean up old activities for a user
const cleanupOldActivities = async (userId, maxActivities = 100) => {
  try {
    // Get count of current activities for user
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM activities WHERE user_id = $1',
      [userId]
    );
    
    const currentCount = parseInt(countResult.rows[0].count);
    
    if (currentCount > maxActivities) {
      // Delete oldest activities beyond the limit
      const deleteCount = currentCount - maxActivities;
      await pool.query(
        'DELETE FROM activities WHERE user_id = $1 AND id IN (SELECT id FROM activities WHERE user_id = $1 ORDER BY created_at ASC LIMIT $2)',
        [userId, deleteCount]
      );
      
      console.log(`Cleaned up ${deleteCount} old activities for user ${userId}. Total activities now: ${maxActivities}`);
    }
  } catch (error) {
    console.error('Error cleaning up old activities:', error);
    // Don't throw error to avoid breaking the main operation
  }
};

// Search stocks
router.get('/search', authenticateToken, async (req, res) => {
  const { query } = req.query;
  const userId = req.user.id;
  const userTier = req.user.tier || 'free';

  if (!query) {
    return res.status(400).json({ message: 'Query parameter is required' });
  }

  console.log(`[SEARCH] Starting search for: "${query}" (User: ${userId}, Tier: ${userTier})`);

  try {
    // First, try to find in our database
    console.log(`[SEARCH] Checking database for: "${query}"`);
    const dbResult = await pool.query(
      'SELECT symbol, company_name FROM companies WHERE symbol ILIKE $1 OR company_name ILIKE $1 LIMIT 10',
      [`%${query}%`]
    );

    console.log(`[SEARCH] Database returned ${dbResult.rows.length} results:`, dbResult.rows);

    if (dbResult.rows.length > 0) {
      console.log(`[SEARCH] Returning ${dbResult.rows.length} database results for "${query}"`);
      return res.json(dbResult.rows);
    }

    // Check tier limits before calling Alpha Vantage
    const usageCheck = await checkAndIncrementUsage(userId, 'daily_searches', userTier);
    
    if (!usageCheck.allowed) {
      console.log(`[SEARCH] Tier limit reached for user ${userId}: ${usageCheck.current}/${usageCheck.limit}`);
      return res.status(402).json({
        message: 'Daily search limit reached for your tier. Upgrade for unlimited searches.',
        error: 'tier_limit',
        tierLimitType: 'search',
        usage: { current: usageCheck.current, limit: usageCheck.limit },
        tier: userTier
      });
    }

    // If not found in database, try Alpha Vantage
    console.log(`[SEARCH] No database results, calling Alpha Vantage for: "${query}" (Usage: ${usageCheck.current}/${usageCheck.limit || '∞'})`);
    console.log(`[SEARCH] Alpha Vantage API Key present: ${!!process.env.ALPHA_VANTAGE_API_KEY}`);
    
    const startTime = Date.now();
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'SYMBOL_SEARCH',
        keywords: query,
        apikey: process.env.ALPHA_VANTAGE_API_KEY
      },
      timeout: 10000 // 10 second timeout
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`[SEARCH] Alpha Vantage response received in ${responseTime}ms`);
    console.log(`[SEARCH] Alpha Vantage response status: ${response.status}`);
    console.log(`[SEARCH] Alpha Vantage response headers:`, response.headers);
    console.log(`[SEARCH] Alpha Vantage full response:`, JSON.stringify(response.data, null, 2));

    // Check for Alpha Vantage error responses
    if (response.data.Note) {
      console.error(`[SEARCH] Alpha Vantage rate limit hit:`, response.data.Note);
      return res.status(402).json({
        message: 'Daily search limit reached for your tier. Upgrade for unlimited searches.',
        error: 'tier_limit',
        tierLimitType: 'search',
        usage: { current: usageCheck.current, limit: usageCheck.limit },
        tier: userTier,
        details: 'External data provider limit reached'
      });
    }

    if (response.data.Information) {
      console.error(`[SEARCH] Alpha Vantage API info message:`, response.data.Information);
      
      // Check if this is a rate limit message
      if (response.data.Information.includes('rate limit') || response.data.Information.includes('25 requests per day')) {
        return res.status(402).json({
          message: 'Daily search limit reached for your tier. Upgrade for unlimited searches.',
          error: 'tier_limit',
          tierLimitType: 'search',
          usage: { current: usageCheck.current, limit: usageCheck.limit },
          tier: userTier,
          details: 'External data provider limit reached'
        });
      }
      
      return res.status(503).json({ 
        message: 'Search service temporarily unavailable. Please try again.',
        error: 'Alpha Vantage service message'
      });
    }

    const results = response.data.bestMatches || [];
    console.log(`[SEARCH] Alpha Vantage bestMatches array length: ${results.length}`);
    
    if (results.length === 0) {
      console.log(`[SEARCH] Alpha Vantage returned empty bestMatches for "${query}"`);
      return res.json([]);
    }

    const formattedResults = results.map(match => ({
      symbol: match['1. symbol'],
      name: match['2. name']
    }));

    console.log(`[SEARCH] Formatted ${formattedResults.length} results:`, formattedResults);

    // Store new results in database
    console.log(`[SEARCH] Storing ${formattedResults.length} results in database`);
    for (const result of formattedResults) {
      try {
        await pool.query(
          'INSERT INTO companies (symbol, company_name) VALUES ($1, $2) ON CONFLICT (symbol) DO UPDATE SET company_name = $2',
          [result.symbol, result.name]
        );
        console.log(`[SEARCH] Stored: ${result.symbol} - ${result.name}`);
      } catch (dbError) {
        console.error(`[SEARCH] Error storing ${result.symbol}:`, dbError.message);
      }
    }

    console.log(`[SEARCH] Returning ${formattedResults.length} Alpha Vantage results for "${query}"`);
    res.json(formattedResults);
  } catch (error) {
    console.error(`[SEARCH] Error searching for "${query}":`, error);
    
    // More specific error handling
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ 
        message: 'Search request timed out. Please try again.',
        error: 'Request timeout'
      });
    }
    
    if (error.response) {
      console.error(`[SEARCH] Alpha Vantage HTTP error: ${error.response.status}`, error.response.data);
      return res.status(502).json({ 
        message: 'Search service error. Please try again.',
        error: `Alpha Vantage HTTP ${error.response.status}`
      });
    }
    
    if (error.request) {
      console.error(`[SEARCH] Network error - no response received`);
      return res.status(503).json({ 
        message: 'Search service unavailable. Please check your connection.',
        error: 'Network error'
      });
    }
    
    res.status(500).json({ 
      message: 'Error searching stocks', 
      error: error.message 
    });
  }
});

// Add stock to watchlist
router.post('/watchlist', authenticateToken, async (req, res) => {
  const { symbol } = req.body;
  const userId = req.user.id;
  const userTier = req.user.tier || 'free';

  if (!symbol) {
    return res.status(400).json({ message: 'Symbol is required' });
  }

  console.log(`[WATCHLIST] Adding ${symbol} for user ${userId} (Tier: ${userTier})`);

  let companyName = '';
  let lastPrice = null;
  let priceChange = null;

  try {
    // Check if company exists in our database
    const companyResult = await pool.query(
      'SELECT company_name FROM companies WHERE symbol = $1',
      [symbol]
    );

    if (companyResult.rows.length === 0) {
      // If not in database, fetch from Alpha Vantage
      const overviewResponse = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'OVERVIEW',
          symbol,
          apikey: process.env.ALPHA_VANTAGE_API_KEY
        }
      });

      if (!overviewResponse.data.Name) {
        return res.status(404).json({ message: 'Stock not found' });
      }
      companyName = overviewResponse.data.Name;

      // Store in database
      await pool.query(
        'INSERT INTO companies (symbol, company_name) VALUES ($1, $2) ON CONFLICT (symbol) DO UPDATE SET company_name = $2',
        [symbol, companyName]
      );
    } else {
      companyName = companyResult.rows[0].company_name;
    }

    // Check tier limits for price updates
    const usageCheck = await checkAndIncrementUsage(userId, 'daily_price_updates', userTier);
    
    if (!usageCheck.allowed) {
      console.log(`[WATCHLIST] Price update tier limit reached for user ${userId}: ${usageCheck.current}/${usageCheck.limit}`);
      // Add stock without price data and notify about tier limit
      await pool.query(
        'INSERT INTO watchlist (user_id, symbol, company_name, last_price, price_change) VALUES ($1, $2, $3, NULL, NULL) ON CONFLICT (user_id, symbol) DO UPDATE SET company_name = $3',
        [userId, symbol, companyName]
      );
      
      return res.status(202).json({ 
        message: 'Stock added to watchlist. Price data unavailable - daily limit reached for your tier.',
        tierLimitReached: true,
        usage: { current: usageCheck.current, limit: usageCheck.limit },
        tier: userTier
      });
    }

    // Fetch latest price data
    const priceResponse = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol,
        apikey: process.env.ALPHA_VANTAGE_API_KEY
      }
    });

    console.log('Alpha Vantage GLOBAL_QUOTE API response:', priceResponse.data);

    // Check for Alpha Vantage rate limit in price response - treat as tier limit
    if (priceResponse.data.Information && 
        (priceResponse.data.Information.includes('rate limit') || 
         priceResponse.data.Information.includes('25 requests per day'))) {
      console.warn(`[WATCHLIST] Alpha Vantage rate limit hit - blocking action as tier limit`);
      
      return res.status(202).json({ 
        message: 'Daily price update limit reached for your tier. Upgrade for unlimited real-time data.',
        tierLimitReached: true,
        usage: { current: usageCheck.limit, limit: usageCheck.limit }, // Show as maxed out
        tier: userTier,
        alphaVantageLimit: true
      });
    } else if (priceResponse.data['Global Quote'] && priceResponse.data['Global Quote']['05. price'] && priceResponse.data['Global Quote']['09. change']) {
      console.log('Successfully fetched price and change.');
      lastPrice = parseFloat(priceResponse.data['Global Quote']['05. price']);
      priceChange = parseFloat(priceResponse.data['Global Quote']['09. change']);
    } else {
      console.warn('Alpha Vantage GLOBAL_QUOTE API did not return expected price data for symbol:', symbol, priceResponse.data);
    }

    // Check if this is a new addition or update
    const existingWatchlistItem = await pool.query(
      'SELECT id FROM watchlist WHERE user_id = $1 AND symbol = $2',
      [userId, symbol]
    );

    const isNewAddition = existingWatchlistItem.rows.length === 0;

    // Add to watchlist
    await pool.query(
      'INSERT INTO watchlist (user_id, symbol, company_name, last_price, price_change) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, symbol) DO UPDATE SET company_name = $3, last_price = $4, price_change = $5',
      [userId, symbol, companyName, lastPrice, priceChange]
    );

    // Create activity record only for new additions (not updates)
    if (isNewAddition) {
      await pool.query(
        'INSERT INTO activities (user_id, activity_type, title, description, symbol) VALUES ($1, $2, $3, $4, $5)',
        [
          userId,
          'watchlist_add',
          `Added ${symbol} to watchlist`,
          `Added ${companyName} (${symbol}) to watchlist`,
          symbol
        ]
      );
      
      // Clean up old activities to maintain performance
      await cleanupOldActivities(userId);
    }

    const responseMessage = lastPrice !== null ? 
      'Stock added to watchlist with current price data' :
      'Stock added to watchlist. Price data unavailable due to external provider limits.';
    
    console.log(`[WATCHLIST] Successfully added ${symbol} for user ${userId} (Usage: ${usageCheck.current}/${usageCheck.limit || '∞'})`);
    
    res.json({ message: responseMessage });
  } catch (error) {
    console.error('Error adding stock to watchlist:', error);
    res.status(500).json({ message: 'Error adding stock to watchlist', error: error.message });
  }
});

// Remove stock from watchlist
router.delete('/watchlist', authenticateToken, async (req, res) => {
  const { symbol } = req.body;
  const userId = req.user.id; // Get user ID from authenticated token

  if (!symbol) {
    return res.status(400).json({ message: 'Symbol is required' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM watchlist WHERE user_id = $1 AND symbol = $2 RETURNING * ',
      [userId, symbol]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Ticker not found in watchlist' });
    }

    const removedStock = result.rows[0];

    // Create activity record for watchlist removal
    await pool.query(
      'INSERT INTO activities (user_id, activity_type, title, description, symbol) VALUES ($1, $2, $3, $4, $5)',
      [
        userId,
        'watchlist_remove',
        `Removed ${symbol} from watchlist`,
        `Removed ${removedStock.company_name} (${symbol}) from watchlist`,
        symbol
      ]
    );
    
    // Clean up old activities to maintain performance
    await cleanupOldActivities(userId);

    res.status(200).json({ message: 'Ticker removed from watchlist', removedTicker: removedStock });
  } catch (error) {
    console.error('Error removing ticker from watchlist:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get watchlist
router.get('/watchlist', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      'SELECT id, symbol, company_name, last_price, price_change FROM watchlist WHERE user_id = $1 ORDER BY symbol',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Refresh watchlist data (including events and price)
router.post('/refresh-watchlist-data', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    // This will trigger fetching earnings, dividends, news, and overview for watchlist
    await financialCalendarService.updateEventsForWatchlist(userId);
    res.status(200).json({ message: 'Watchlist data refresh triggered successfully' });
  } catch (error) {
    console.error('Error refreshing watchlist data:', error);
    res.status(500).json({ message: 'Error refreshing watchlist data', error: error.message });
  }
});

module.exports = router; 