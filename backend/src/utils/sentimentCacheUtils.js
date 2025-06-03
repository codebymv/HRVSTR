const { pool } = require('../config/data-sources');

/**
 * Utility functions for managing sentiment research data cache
 * These functions ensure cache respects tier-based session durations
 */

/**
 * Get comprehensive cache statistics
 */
async function getCacheStats() {
  try {
    const result = await pool.query('SELECT * FROM get_sentiment_cache_stats()');
    
    if (result.rows.length > 0) {
      const stats = result.rows[0];
      return {
        success: true,
        stats: {
          totalCachedRecords: stats.total_cached_records,
          activeSessions: stats.active_sessions,
          expiredRecords: stats.expired_records,
          totalDataSizeMB: parseFloat(stats.total_data_size_mb) || 0,
          oldestCacheAgeHours: parseFloat(stats.oldest_cache_age_hours) || 0,
          newestCacheAgeMinutes: parseFloat(stats.newest_cache_age_minutes) || 0
        }
      };
    }
    
    return { success: false, error: 'No stats available' };
    
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clean up expired cache data
 */
async function cleanupExpiredCache() {
  try {
    const result = await pool.query('SELECT * FROM cleanup_expired_sentiment_data()');
    
    if (result.rows.length > 0) {
      const cleanup = result.rows[0];
      return {
        success: true,
        cleaned: {
          expiredData: cleanup.expired_data_count,
          expiredSessionData: cleanup.expired_session_data_count,
          total: cleanup.total_cleaned
        }
      };
    }
    
    return { success: false, error: 'Cleanup function returned no results' };
    
  } catch (error) {
    console.error('Error cleaning up cache:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get cache data for a specific user and session
 */
async function getUserCacheData(userId, sessionId = null) {
  try {
    let query, params;
    
    if (sessionId) {
      query = `
        SELECT 
          srd.*,
          rs.component,
          rs.status as session_status,
          rs.expires_at as session_expires_at,
          EXTRACT(EPOCH FROM (rs.expires_at - CURRENT_TIMESTAMP))/60 as session_minutes_remaining,
          EXTRACT(EPOCH FROM (srd.expires_at - CURRENT_TIMESTAMP))/60 as cache_minutes_remaining
        FROM sentiment_research_data srd
        JOIN research_sessions rs ON srd.session_id = rs.session_id
        WHERE srd.user_id = $1 AND srd.session_id = $2
        ORDER BY srd.fetched_at DESC
      `;
      params = [userId, sessionId];
    } else {
      query = `
        SELECT 
          srd.*,
          rs.component,
          rs.status as session_status,
          rs.expires_at as session_expires_at,
          EXTRACT(EPOCH FROM (rs.expires_at - CURRENT_TIMESTAMP))/60 as session_minutes_remaining,
          EXTRACT(EPOCH FROM (srd.expires_at - CURRENT_TIMESTAMP))/60 as cache_minutes_remaining
        FROM sentiment_research_data srd
        JOIN research_sessions rs ON srd.session_id = rs.session_id
        WHERE srd.user_id = $1
        ORDER BY srd.fetched_at DESC
      `;
      params = [userId];
    }
    
    const result = await pool.query(query, params);
    
    return {
      success: true,
      cacheData: result.rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        queryType: row.query_type,
        tickers: row.tickers,
        timeRange: row.time_range,
        fetchedAt: row.fetched_at,
        expiresAt: row.expires_at,
        sessionExpiresAt: row.session_expires_at,
        sessionStatus: row.session_status,
        sessionMinutesRemaining: Math.round(row.session_minutes_remaining || 0),
        cacheMinutesRemaining: Math.round(row.cache_minutes_remaining || 0),
        dataCount: row.api_metadata?.dataCount || 0,
        creditsConsumed: row.credits_consumed || 0
      }))
    };
    
  } catch (error) {
    console.error('Error getting user cache data:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clear cache for a specific user (e.g., when they log out)
 */
async function clearUserCache(userId) {
  try {
    const result = await pool.query(
      'DELETE FROM sentiment_research_data WHERE user_id = $1',
      [userId]
    );
    
    return {
      success: true,
      deletedRecords: result.rowCount
    };
    
  } catch (error) {
    console.error('Error clearing user cache:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clear cache for a specific session
 */
async function clearSessionCache(sessionId) {
  try {
    const result = await pool.query(
      'DELETE FROM sentiment_research_data WHERE session_id = $1',
      [sessionId]
    );
    
    return {
      success: true,
      deletedRecords: result.rowCount
    };
    
  } catch (error) {
    console.error('Error clearing session cache:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get cache efficiency metrics
 */
async function getCacheEfficiencyMetrics(userId = null, days = 7) {
  try {
    let query, params;
    
    if (userId) {
      query = `
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN credits_consumed > 0 THEN 1 ELSE 0 END) as api_calls,
          SUM(CASE WHEN credits_consumed = 0 THEN 1 ELSE 0 END) as cache_hits,
          AVG(fetch_duration_ms) as avg_fetch_time_ms,
          SUM(credits_consumed) as total_credits_used
        FROM sentiment_research_data 
        WHERE user_id = $1 
          AND created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
      `;
      params = [userId];
    } else {
      query = `
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN credits_consumed > 0 THEN 1 ELSE 0 END) as api_calls,
          SUM(CASE WHEN credits_consumed = 0 THEN 1 ELSE 0 END) as cache_hits,
          AVG(fetch_duration_ms) as avg_fetch_time_ms,
          SUM(credits_consumed) as total_credits_used
        FROM sentiment_research_data 
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
      `;
      params = [];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length > 0) {
      const metrics = result.rows[0];
      const totalRequests = parseInt(metrics.total_requests);
      const apiCalls = parseInt(metrics.api_calls);
      const cacheHits = parseInt(metrics.cache_hits);
      
      return {
        success: true,
        metrics: {
          totalRequests,
          apiCalls,
          cacheHits,
          cacheHitRate: totalRequests > 0 ? (cacheHits / totalRequests * 100).toFixed(2) : '0.00',
          avgFetchTimeMs: Math.round(parseFloat(metrics.avg_fetch_time_ms) || 0),
          totalCreditsUsed: parseInt(metrics.total_credits_used) || 0,
          creditsSaved: cacheHits * 3 // Assuming average 3 credits per sentiment call
        }
      };
    }
    
    return { success: false, error: 'No metrics data available' };
    
  } catch (error) {
    console.error('Error getting cache efficiency metrics:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Schedule automatic cache cleanup (call this periodically)
 */
async function scheduleCleanup() {
  try {
    console.log('🧹 Running scheduled sentiment cache cleanup...');
    
    const cleanup = await cleanupExpiredCache();
    
    if (cleanup.success) {
      const { expiredData, expiredSessionData, total } = cleanup.cleaned;
      console.log(`✅ Cleanup complete: ${total} records removed (${expiredData} expired data, ${expiredSessionData} expired sessions)`);
      
      // Get updated stats
      const stats = await getCacheStats();
      if (stats.success) {
        console.log(`📊 Cache stats: ${stats.stats.totalCachedRecords} active records, ${stats.stats.totalDataSizeMB}MB`);
      }
    } else {
      console.error('❌ Cache cleanup failed:', cleanup.error);
    }
    
    return cleanup;
    
  } catch (error) {
    console.error('Error in scheduled cleanup:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getCacheStats,
  cleanupExpiredCache,
  getUserCacheData,
  clearUserCache,
  clearSessionCache,
  getCacheEfficiencyMetrics,
  scheduleCleanup
}; 