/**
 * Session Cleanup Scheduler
 * Handles automatic cleanup of expired sessions and cache data
 */
const { pool } = require('../config/data-sources');
const { scheduleCleanup } = require('./sentimentCacheUtils');

class SessionCleanupScheduler {
  constructor() {
    this.intervals = new Map();
    this.isRunning = false;
  }

  /**
   * Start the cleanup scheduler with configurable intervals
   */
  start(config = {}) {
    if (this.isRunning) {
      console.log('🔄 Session cleanup scheduler is already running');
      return;
    }

    const defaultConfig = {
      sessionCleanupInterval: 15 * 60 * 1000,      // 15 minutes
      cacheCleanupInterval: 30 * 60 * 1000,       // 30 minutes
      longRunningCheckInterval: 60 * 60 * 1000,   // 1 hour
      enabled: true
    };

    const finalConfig = { ...defaultConfig, ...config };

    if (!finalConfig.enabled) {
      console.log('🛑 Session cleanup scheduler is disabled');
      return;
    }

    console.log('🚀 Starting session cleanup scheduler...');
    console.log(`   📅 Session cleanup: every ${finalConfig.sessionCleanupInterval / 60000} minutes`);
    console.log(`   📅 Cache cleanup: every ${finalConfig.cacheCleanupInterval / 60000} minutes`);
    console.log(`   📅 Long-running check: every ${finalConfig.longRunningCheckInterval / 60000} minutes`);

    // Schedule session cleanup
    const sessionInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, finalConfig.sessionCleanupInterval);
    this.intervals.set('session', sessionInterval);

    // Schedule cache cleanup
    const cacheInterval = setInterval(async () => {
      await this.cleanupExpiredCache();
    }, finalConfig.cacheCleanupInterval);
    this.intervals.set('cache', cacheInterval);

    // Schedule long-running session check
    const longRunningInterval = setInterval(async () => {
      await this.checkLongRunningSessions();
    }, finalConfig.longRunningCheckInterval);
    this.intervals.set('longRunning', longRunningInterval);

    // Run initial cleanup
    this.cleanupExpiredSessions();
    this.cleanupExpiredCache();

    this.isRunning = true;
    console.log('✅ Session cleanup scheduler started successfully');
  }

  /**
   * Stop the cleanup scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('🛑 Session cleanup scheduler is not running');
      return;
    }

    console.log('🛑 Stopping session cleanup scheduler...');
    
    this.intervals.forEach((interval, name) => {
      clearInterval(interval);
      console.log(`   ✅ Stopped ${name} cleanup interval`);
    });
    
    this.intervals.clear();
    this.isRunning = false;
    console.log('✅ Session cleanup scheduler stopped');
  }

  /**
   * Clean up expired research sessions
   */
  async cleanupExpiredSessions() {
    try {
      const startTime = Date.now();
      const result = await pool.query('SELECT cleanup_expired_sessions()');
      const expiredCount = result.rows[0].cleanup_expired_sessions;
      const duration = Date.now() - startTime;

      if (expiredCount > 0) {
        console.log(`🧹 [Session Cleanup] Marked ${expiredCount} expired sessions as expired (${duration}ms)`);
      }

      return { success: true, expired: expiredCount, duration };
    } catch (error) {
      console.error('❌ [Session Cleanup] Error cleaning expired sessions:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up expired cache data
   */
  async cleanupExpiredCache() {
    try {
      const startTime = Date.now();
      
      // Clean sentiment cache
      const sentimentResult = await scheduleCleanup();
      
      // Clean SEC cache if function exists
      let secCleanedCount = 0;
      try {
        const secResult = await pool.query('SELECT cleanup_expired_sec_cache()');
        secCleanedCount = secResult.rows[0].cleanup_expired_sec_cache;
      } catch (error) {
        // SEC cache cleanup function might not exist
      }

      // Clean earnings cache if function exists
      let earningsCleanedCount = 0;
      try {
        const earningsResult = await pool.query('SELECT cleanup_expired_earnings_cache()');
        earningsCleanedCount = earningsResult.rows[0].cleanup_expired_earnings_cache;
      } catch (error) {
        // Earnings cache cleanup function might not exist
      }

      const duration = Date.now() - startTime;
      const totalCleaned = (sentimentResult.success ? sentimentResult.cleaned.total : 0) + 
                          secCleanedCount + earningsCleanedCount;

      if (totalCleaned > 0) {
        console.log(`🧹 [Cache Cleanup] Cleaned ${totalCleaned} expired cache records (${duration}ms)`);
        if (sentimentResult.success) {
          console.log(`   📊 Sentiment: ${sentimentResult.cleaned.total} records`);
        }
        if (secCleanedCount > 0) {
          console.log(`   📊 SEC: ${secCleanedCount} records`);
        }
        if (earningsCleanedCount > 0) {
          console.log(`   📊 Earnings: ${earningsCleanedCount} records`);
        }
      }

      return { 
        success: true, 
        cleaned: totalCleaned, 
        duration,
        breakdown: {
          sentiment: sentimentResult.success ? sentimentResult.cleaned.total : 0,
          sec: secCleanedCount,
          earnings: earningsCleanedCount
        }
      };
    } catch (error) {
      console.error('❌ [Cache Cleanup] Error cleaning expired cache:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check for sessions that have been running longer than their tier allows
   */
  async checkLongRunningSessions() {
    try {
      const startTime = Date.now();
      
      // Define maximum allowed durations by tier (in hours)
      const maxDurations = {
        'free': 0.5,        // 30 minutes
        'pro': 2,           // 2 hours
        'elite': 4,         // 4 hours
        'institutional': 8  // 8 hours
      };

      // Check for sessions exceeding their tier limits
      const longRunningSessions = await pool.query(`
        SELECT 
          rs.*,
          EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - rs.unlocked_at))/3600 as hours_running,
          rs.metadata->>'tier' as tier
        FROM research_sessions rs
        WHERE rs.status = 'active'
          AND (
            (rs.metadata->>'tier' = 'free' AND rs.unlocked_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '30 minutes') OR
            (rs.metadata->>'tier' = 'pro' AND rs.unlocked_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '2 hours') OR
            (rs.metadata->>'tier' = 'elite' AND rs.unlocked_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '4 hours') OR
            (rs.metadata->>'tier' = 'institutional' AND rs.unlocked_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '8 hours') OR
            (rs.metadata->>'tier' IS NULL AND rs.unlocked_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '30 minutes')
          )
      `);

      let forcedExpirations = 0;
      
      if (longRunningSessions.rows.length > 0) {
        console.log(`⚠️  [Long Running Check] Found ${longRunningSessions.rows.length} sessions exceeding tier limits`);
        
        // Force expire these sessions
        const sessionIds = longRunningSessions.rows.map(s => s.session_id);
        await pool.query(`
          UPDATE research_sessions 
          SET status = 'expired', updated_at = (NOW() AT TIME ZONE 'UTC')
          WHERE session_id = ANY($1)
        `, [sessionIds]);
        
        forcedExpirations = sessionIds.length;
        
        console.log(`🔒 [Long Running Check] Force-expired ${forcedExpirations} sessions exceeding limits`);
        
        // Log details of force-expired sessions
        longRunningSessions.rows.forEach(session => {
          const tier = session.tier || 'free';
          const hoursRunning = Math.round(session.hours_running * 100) / 100;
          const maxAllowed = maxDurations[tier] || maxDurations.free;
          console.log(`   📋 ${session.component} (${tier}): ${hoursRunning}h running > ${maxAllowed}h limit`);
        });
      }

      const duration = Date.now() - startTime;
      return { 
        success: true, 
        checked: longRunningSessions.rows.length, 
        forcedExpirations,
        duration 
      };
    } catch (error) {
      console.error('❌ [Long Running Check] Error checking long-running sessions:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    try {
      // Get session stats
      const sessionStats = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active' AND expires_at > (NOW() AT TIME ZONE 'UTC')) as active_sessions,
          COUNT(*) FILTER (WHERE status = 'active' AND expires_at <= (NOW() AT TIME ZONE 'UTC')) as expired_sessions,
          COUNT(*) FILTER (WHERE status = 'expired') as cleaned_sessions
        FROM research_sessions
      `);

      // Get cache stats
      let cacheStats = null;
      try {
        const cacheResult = await pool.query('SELECT * FROM get_sentiment_cache_stats()');
        cacheStats = cacheResult.rows[0];
      } catch (error) {
        // Cache stats function might not exist
      }

      return {
        success: true,
        sessions: sessionStats.rows[0],
        cache: cacheStats,
        scheduler: {
          isRunning: this.isRunning,
          activeIntervals: this.intervals.size
        }
      };
    } catch (error) {
      console.error('❌ Error getting cleanup stats:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Manual cleanup trigger (for testing or immediate cleanup)
   */
  async runManualCleanup() {
    console.log('🧹 Running manual cleanup...');
    
    const sessionResult = await this.cleanupExpiredSessions();
    const cacheResult = await this.cleanupExpiredCache();
    const longRunningResult = await this.checkLongRunningSessions();
    
    console.log('✅ Manual cleanup completed');
    
    return {
      sessions: sessionResult,
      cache: cacheResult,
      longRunning: longRunningResult
    };
  }
}

// Create singleton instance
const sessionCleanupScheduler = new SessionCleanupScheduler();

module.exports = {
  SessionCleanupScheduler,
  sessionCleanupScheduler
}; 