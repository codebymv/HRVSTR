const express = require('express');
const router = express.Router();
const { pool } = require('../config/data-sources');
const authenticateToken = require('../middleware/authMiddleware');
const { FinancialCalendarService } = require('../services/financialCalendar');

const calendarService = new FinancialCalendarService();

// GET upcoming events
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { importance, type } = req.query;

  try {
    // Fetch upcoming events for the user's watchlist
    // Removed: await financialCalendarService.updateEventsForWatchlist(userId);

    let query = `
      SELECT
          e.id,
          e.symbol,
          e.event_type,
          e.scheduled_at,
          e.status,
          e.title,
          e.description,
          e.importance
      FROM events e
      JOIN watchlist w ON e.symbol = w.symbol
      WHERE w.user_id = $1 AND e.scheduled_at >= CURRENT_TIMESTAMP
    `;

    const params = [userId];

    if (importance) {
      query += ' AND e.importance = $2';
      params.push(importance);
    }

    if (type) {
      // Adjust index if importance filter is also present
      const typeParamIndex = importance ? 3 : 2;
      query += ` AND e.event_type = $${typeParamIndex}`;
      params.push(type);
    }

    query += ' ORDER BY e.scheduled_at ASC';

    console.log('Executing events query:', query, params);

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET events for a specific symbol
router.get('/:symbol', authenticateToken, async (req, res) => {
  const { symbol } = req.params;
  const now = new Date();
  const { importance, type } = req.query;

  try {
    // Update events for the symbol
    await calendarService.fetchEarningsCalendar(symbol);
    await calendarService.fetchDividendCalendar(symbol);
    await calendarService.fetchNewsAndSentiment(symbol);

    // Build the query based on filters
    let query = `
      SELECT id, symbol, event_type, scheduled_at, status,
             title, description, importance
      FROM events 
      WHERE symbol = $1 AND scheduled_at >= $2
    `;
    const params = [symbol, now];

    if (importance) {
      query += ` AND importance = $${params.length + 1}`;
      params.push(importance);
    }

    if (type) {
      query += ` AND event_type = $${params.length + 1}`;
      params.push(type);
    }

    query += ' ORDER BY scheduled_at ASC';

    // Fetch the events
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching events for symbol:', err);
    res.status(500).json({ message: 'Error fetching events for symbol', error: err.message });
  }
});

module.exports = router; 