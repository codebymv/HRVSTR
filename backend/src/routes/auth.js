const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../config/data-sources');

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