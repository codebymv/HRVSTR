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

// Helper function to generate tokens with longer expiry
const generateTokens = (userId) => {
  // Access token expires in 7 days (much longer than 1 hour)
  const accessToken = jwt.sign({ userId: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  
  // Refresh token expires in 30 days
  const refreshToken = jwt.sign({ userId: userId, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '30d' });
  
  return { accessToken, refreshToken };
};

// POST endpoint for token refresh
router.post('/refresh', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  try {
    // Verify the existing token (allow expired access tokens)
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    
    if (!decoded.userId) {
      return res.status(403).json({ message: 'Invalid token format' });
    }

    // Check if user still exists in database
    const userResult = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate new tokens
    const { accessToken, refreshToken } = generateTokens(decoded.userId);
    const userData = userResult.rows[0];

    res.json({
      token: accessToken,
      refreshToken: refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email
      }
    });

  } catch (err) {
    console.error('Error refreshing token:', err);
    
    // If token is completely invalid or malformed
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ message: 'Invalid token' });
    }
    
    // For other errors, require re-authentication
    return res.status(401).json({ message: 'Token refresh failed, please login again' });
  }
});

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

    // Generate tokens with longer expiry
    const { accessToken, refreshToken } = generateTokens(userId);

    // Return the backend token and user info to the frontend
    res.json({
      token: accessToken,
      refreshToken: refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      user: {
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

// POST endpoint for logout (optional - for cleanup)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Here you could add logic to blacklist the token if you implement token blacklisting
    // For now, just return success since the frontend will remove the token
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Error during logout:', err);
    res.status(500).json({ message: 'Internal server error during logout' });
  }
});

module.exports = router; 