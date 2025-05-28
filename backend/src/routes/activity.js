const express = require('express');
const router = express.Router();
const { pool } = require('../config/data-sources');
const authenticateToken = require('../middleware/authMiddleware'); // Import the authentication middleware

// GET user's recent activity
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id; // User ID from authentication middleware

  try {
    // Fetch recent activities for the user from the database
    // You might want to limit the number of results and order by timestamp
    const result = await pool.query(
      'SELECT id, activity_type, title, description, symbol, created_at FROM activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', // Fetch last 10 activities
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent activity:', err);
    res.status(500).json({ message: 'Error fetching recent activity', error: err.message });
  }
});

module.exports = router; 