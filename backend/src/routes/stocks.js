const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool } = require('../config/data-sources');
const authenticateToken = require('../middleware/authMiddleware');
const { FinancialCalendarService } = require('../services/financialCalendar');

const financialCalendarService = new FinancialCalendarService();

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

  if (!query) {
    return res.status(400).json({ message: 'Query parameter is required' });
  }

  try {
    // First, try to find in our database
    const dbResult = await pool.query(
      'SELECT symbol, company_name FROM companies WHERE symbol ILIKE $1 OR company_name ILIKE $1 LIMIT 10',
      [`%${query}%`]
    );

    if (dbResult.rows.length > 0) {
      return res.json(dbResult.rows);
    }

    // If not found in database, try Alpha Vantage
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'SYMBOL_SEARCH',
        keywords: query,
        apikey: process.env.ALPHA_VANTAGE_API_KEY
      }
    });

    const results = response.data.bestMatches || [];
    const formattedResults = results.map(match => ({
      symbol: match['1. symbol'],
      name: match['2. name']
    }));

    // Store new results in database
    for (const result of formattedResults) {
      await pool.query(
        'INSERT INTO companies (symbol, company_name) VALUES ($1, $2) ON CONFLICT (symbol) DO UPDATE SET company_name = $2',
        [result.symbol, result.name]
      );
    }

    res.json(formattedResults);
  } catch (error) {
    console.error('Error searching stocks:', error);
    res.status(500).json({ message: 'Error searching stocks', error: error.message });
  }
});

// Add stock to watchlist
router.post('/watchlist', authenticateToken, async (req, res) => {
  const { symbol } = req.body;
  const userId = req.user.id;

  if (!symbol) {
    return res.status(400).json({ message: 'Symbol is required' });
  }

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

    // Fetch latest price data
    const priceResponse = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol,
        apikey: process.env.ALPHA_VANTAGE_API_KEY
      }
    });

    console.log('Alpha Vantage GLOBAL_QUOTE API response:', priceResponse.data);

    if (priceResponse.data['Global Quote'] && priceResponse.data['Global Quote']['05. price'] && priceResponse.data['Global Quote']['09. change']) {
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

    res.json({ message: 'Stock added to watchlist' });
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