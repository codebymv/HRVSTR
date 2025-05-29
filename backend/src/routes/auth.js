const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../config/data-sources');

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// GET endpoint for user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Fetch user profile data from the users table
    const userResult = await pool.query(
      `SELECT 
        id, 
        email, 
        name, 
        created_at, 
        updated_at, 
        tier, 
        credits_remaining, 
        credits_monthly_limit, 
        credits_reset_date, 
        subscription_status, 
        stripe_customer_id, 
        stripe_subscription_id 
      FROM users 
      WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = userResult.rows[0];
    
    res.json(userData);

  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});

// POST endpoint for Google login callback
router.post('/google-login', async (req, res) => {
  const { googleId, email, name, picture } = req.body;

  if (!googleId || !email || !name) {
    return res.status(400).json({ message: 'Missing required user information' });
  }

  try {
    // Check if user already exists in the database
    let userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;

    if (userResult.rows.length > 0) {
      // User exists, get their ID
      userId = userResult.rows[0].id;
    } else {
      // User does not exist, create a new user
      const newUserResult = await pool.query(
        'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
        [email, name]
      );
      userId = newUserResult.rows[0].id;
    }

    // Create a backend JWT
    const token = jwt.sign({ userId: userId }, process.env.JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour

    // Return the backend token and user info to the frontend
    res.json({
      token: token,
      user: { // Return basic user info, you can add more if needed
        id: userId,
        name: name,
        email: email,
        picture: picture,
      }
    });

  } catch (err) {
    console.error('Error processing Google login:', err);
    res.status(500).json({ message: 'Internal server error during login', error: err.message });
  }
});

module.exports = router; 