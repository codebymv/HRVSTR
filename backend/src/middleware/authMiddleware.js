const jwt = require('jsonwebtoken');
const { pool } = require('../config/data-sources');

// This middleware assumes a JWT is sent in the Authorization: Bearer <token> header
// It verifies the token and attaches the user to the request object (req.user = { id: userId, tier: userTier })
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Authentication token required' }); // No token provided
  }

  try {
    // Verify the token using your backend's JWT secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Use a strong secret from environment variables

    // Check if the user exists in the database and get their tier
    const userResult = await pool.query('SELECT id, tier FROM users WHERE id = $1', [decoded.userId]); // Get both id and tier
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];
    
    // Attach the user ID and tier to the request object
    req.user = { 
      id: user.id, 
      tier: user.tier || 'free' // Default to 'free' if tier is null
    };
    
    console.log(`[AUTH] User authenticated: ${user.id} (Tier: ${req.user.tier})`);
    next(); // Proceed to the next middleware/route handler
  } catch (err) {
    console.error('Error verifying token:', err.message);
    return res.status(403).json({ message: 'Invalid or expired token' }); // Token is invalid or expired
  }
};

module.exports = authenticateToken; 