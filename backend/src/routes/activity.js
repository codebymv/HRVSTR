const express = require('express');
const router = express.Router();
const { pool } = require('../config/data-sources');
const authenticateToken = require('../middleware/authMiddleware'); // Import the authentication middleware

// GET user's recent activity
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id; // User ID from authentication middleware

  try {
    // Fetch recent activities for the user from the database
    // Limited to 100 most recent activities for performance
    const result = await pool.query(
      'SELECT id, activity_type, title, description, symbol, created_at FROM activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [userId]
    );
    res.json(result.rows);
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