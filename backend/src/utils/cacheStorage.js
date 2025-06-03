const { pool } = require('../config/data-sources');

/**
 * Store sentiment data in the database cache
 */
async function storeSentimentData(userId, sessionId, queryType, data, timeRange = '1w') {
  try {
    // Get tickers from data if available
    const tickers = data.sentimentData ? 
      data.sentimentData.map(item => item.ticker).filter(Boolean) : [];
    
    // Calculate expiry time (1 hour from now) - FORCE UTC
    const nowUtc = new Date();
    const expiresAtUtc = new Date(nowUtc.getTime() + 60 * 60 * 1000);
    
    console.log(`💾 [CACHE STORAGE] Storing ${queryType} data, expires: ${expiresAtUtc.toISOString()}`);
    
    // Store in database using explicit UTC timestamps
    // IMPORTANT: Store the complete API response object, not just sentimentData array
    await pool.query(`
      INSERT INTO sentiment_research_data (
        user_id, session_id, query_type, tickers, time_range,
        sentiment_data, api_metadata, fetched_at, expires_at,
        fetch_duration_ms, credits_consumed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8 AT TIME ZONE 'UTC', $9 AT TIME ZONE 'UTC', $10, $11)
    `, [
      userId,
      sessionId,
      queryType,
      tickers,
      timeRange,
      JSON.stringify(data), // Store the complete response object, not just sentimentData
      JSON.stringify({
        dataCount: Array.isArray(data.sentimentData) ? data.sentimentData.length : (Array.isArray(data) ? data.length : 1),
        dataFormat: 'complete_response',
        fetchDuration: null,
        sessionExpiresAt: expiresAtUtc.toISOString(),
        dataFreshnessMinutes: 60
      }),
      nowUtc.toISOString(),
      expiresAtUtc.toISOString(),
      null, // fetch_duration_ms
      0     // credits_consumed
    ]);
    
    console.log(`✅ [CACHE STORAGE] Successfully stored ${queryType} data for user ${userId}`);
    return true;
    
  } catch (error) {
    console.error(`❌ [CACHE STORAGE] Failed to store ${queryType} data:`, error.message);
    return false;
  }
}

/**
 * Get active session ID for a user and component
 */
async function getActiveSessionId(userId, component = 'chart') {
  try {
    const result = await pool.query(`
      SELECT session_id FROM research_sessions 
      WHERE user_id = $1 AND component = $2 AND status = 'active'
        AND expires_at > (NOW() AT TIME ZONE 'UTC')
      ORDER BY created_at DESC LIMIT 1
    `, [userId, component]);
    
    return result.rows[0]?.session_id || `session_${userId}_${component}_${Date.now()}`;
  } catch (error) {
    console.error('Error getting active session:', error);
    return `session_${userId}_${component}_${Date.now()}`;
  }
}

module.exports = {
  storeSentimentData,
  getActiveSessionId
}; 