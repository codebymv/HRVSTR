const express = require('express');
const router = express.Router();
const { pool } = require('../config/data-sources');
const authenticateToken = require('../middleware/authMiddleware'); // Import the authentication middleware

// GET user's recent activity with optional pagination
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id; // User ID from authentication middleware
  
  // Parse pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100; // Default to 100 for backward compatibility
  const offset = (page - 1) * limit;

  // Validate pagination parameters
  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({ 
      message: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-100' 
    });
  }

  try {
    // Get total count of activities for pagination info
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM activities WHERE user_id = $1',
      [userId]
    );
    const totalActivities = parseInt(countResult.rows[0].count);
    
    // Fetch paginated activities for the user from the database
    const result = await pool.query(
      'SELECT id, activity_type, title, description, symbol, created_at FROM activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalActivities / limit);
    const hasMore = page < totalPages;
    
    // Return paginated response
    res.json({
      activities: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalActivities,
        hasMore,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ message: 'Failed to fetch activities' });
  }
});

// POST create new activity (for testing)
router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { activity_type, title, description, symbol } = req.body;

  if (!activity_type || !title) {
    return res.status(400).json({ message: 'Activity type and title are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO activities (user_id, activity_type, title, description, symbol) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, activity_type, title, description, symbol]
    );
    
    // Clean up old activities to maintain performance
    await cleanupOldActivities(userId);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ message: 'Failed to create activity' });
  }
});

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

module.exports = router; 