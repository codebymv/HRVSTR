const express = require('express');
const router = express.Router();
const { pool } = require('../config/data-sources'); // Assuming data-sources.js is one level up
const authenticateToken = require('../middleware/authMiddleware'); // Import the authentication middleware
const { checkWatchlistLimit, checkCredits, deductCredits, getUserTierInfo } = require('../middleware/tierMiddleware');

// GET user's watchlist
// Apply the authentication middleware to this route
router.get('/', authenticateToken, async (req, res) => {
  // user ID is now available on req.user.id due to the middleware
  const userId = req.user.id; 

  try {
    const result = await pool.query(
      'SELECT id, symbol, company_name, last_price, price_change, created_at FROM watchlist WHERE user_id = $1 ORDER BY symbol',
      [userId]
    );

    // Get user's tier info for watchlist limits
    const tierInfo = await getUserTierInfo(userId);

    res.json({
      success: true,
      data: {
        stocks: result.rows,
        limits: {
          current: result.rows.length,
          max: tierInfo?.limits.watchlistLimit || -1,
          tier: tierInfo?.tier || 'free'
        }
      }
    });
  } catch (err) {
    console.error('Error fetching watchlist:', err);
    res.status(500).json({ message: 'Error fetching watchlist', error: err.message });
  }
});

// POST add stock to watchlist
router.post('/', authenticateToken, checkWatchlistLimit, checkCredits('sentiment-basic'), async (req, res) => {
  const userId = req.user.id;
  const { symbol, company_name, last_price, price_change } = req.body;

  if (!symbol || !company_name) {
    return res.status(400).json({ error: 'Symbol and company name are required' });
  }

  try {
    // Check if stock already exists in watchlist
    const existingResult = await pool.query(
      'SELECT id FROM watchlist WHERE user_id = $1 AND symbol = $2',
      [userId, symbol.toUpperCase()]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({ error: 'Stock already in watchlist' });
    }

    // Add stock to watchlist
    const result = await pool.query(
      'INSERT INTO watchlist (user_id, symbol, company_name, last_price, price_change) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, symbol.toUpperCase(), company_name, last_price || null, price_change || null]
    );

    // Log activity
    await pool.query(
      'INSERT INTO activities (user_id, activity_type, title, description, symbol) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'watchlist_add', `Added ${symbol.toUpperCase()} to Watchlist`, `Added ${company_name} to your watchlist`, symbol.toUpperCase()]
    );

    res.json({
      success: true,
      message: 'Stock added to watchlist',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Error adding to watchlist:', err);
    res.status(500).json({ message: 'Error adding to watchlist', error: err.message });
  }
}, deductCredits);

// DELETE remove stock from watchlist
router.delete('/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const stockId = req.params.id;

  try {
    // Get stock info before deleting for activity log
    const stockResult = await pool.query(
      'SELECT symbol, company_name FROM watchlist WHERE id = $1 AND user_id = $2',
      [stockId, userId]
    );

    if (stockResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stock not found in watchlist' });
    }

    const stock = stockResult.rows[0];

    // Delete the stock
    await pool.query(
      'DELETE FROM watchlist WHERE id = $1 AND user_id = $2',
      [stockId, userId]
    );

    // Log activity
    await pool.query(
      'INSERT INTO activities (user_id, activity_type, title, description, symbol) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'watchlist_remove', `Removed ${stock.symbol} from Watchlist`, `Removed ${stock.company_name} from your watchlist`, stock.symbol]
    );

    res.json({
      success: true,
      message: 'Stock removed from watchlist'
    });

  } catch (err) {
    console.error('Error removing from watchlist:', err);
    res.status(500).json({ message: 'Error removing from watchlist', error: err.message });
  }
});

// PUT update stock prices in watchlist
router.put('/:id/price', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const stockId = req.params.id;
  const { last_price, price_change } = req.body;

  try {
    const result = await pool.query(
      'UPDATE watchlist SET last_price = $1, price_change = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
      [last_price, price_change, stockId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock not found in watchlist' });
    }

    res.json({
      success: true,
      message: 'Stock price updated',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Error updating stock price:', err);
    res.status(500).json({ message: 'Error updating stock price', error: err.message });
  }
});

// You would add other watchlist related routes here (POST, DELETE, etc.)
// and apply the authenticateToken middleware to them as well.

module.exports = router; 