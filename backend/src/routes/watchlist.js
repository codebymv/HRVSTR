const express = require('express');
const router = express.Router();
const { pool } = require('../config/data-sources'); // Assuming data-sources.js is one level up
const authenticateToken = require('../middleware/authMiddleware'); // Import the authentication middleware

// GET user's watchlist
// Apply the authentication middleware to this route
router.get('/', authenticateToken, async (req, res) => {
  // user ID is now available on req.user.id due to the middleware
  const userId = req.user.id; 

  try {
    const result = await pool.query(
      'SELECT id, symbol, company_name, last_price, price_change FROM watchlist WHERE user_id = $1 ORDER BY symbol',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching watchlist:', err);
    res.status(500).json({ message: 'Error fetching watchlist', error: err.message });
  }
});

// You would add other watchlist related routes here (POST, DELETE, etc.)
// and apply the authenticateToken middleware to them as well.

module.exports = router; 