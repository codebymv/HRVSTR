const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

/**
 * AI Analysis Cache Service
 * Implements three-tier caching pattern for AI analysis results:
 * 1. Check active session
 * 2. Check cache
 * 3. Generate fresh analysis and charge credits
 */

/**
 * Get cache duration based on user tier
 */
function getCacheDuration(userTier) {
  const durations = {
    'free': 24,      // 24 hours for free tier
    'pro': 72,       // 72 hours for pro tier  
    'premium': 168   // 1 week for premium tier
  };
  return durations[userTier] || durations['free'];
}

/**
 * Get component name for research session
 */
function getComponentName(analysisType) {
  const componentMap = {
    'sentiment_chart_analysis': 'sentimentChartAnalysis',
    'ticker_sentiment_analysis': 'sentimentScoreAnalysis', 
    'reddit_post_analysis': 'redditPostAnalysis',
    'combined_sentiment_analysis': 'sentimentChartAnalysis'
  };
  return componentMap[analysisType] || 'sentimentChartAnalysis';
}

/**
 * Check if user has active session for AI analysis component
 */
async function checkActiveSession(userId, analysisType) {
  try {
    const componentName = getComponentName(analysisType);
    
    const sessionQuery = `
      SELECT session_id, expires_at, credits_used, metadata
      FROM research_sessions 
      WHERE user_id = $1 
        AND component = $2 
        AND status = 'active' 
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY unlocked_at DESC 
      LIMIT 1
    `;
    
    const result = await db.query(sessionQuery, [userId, componentName]);
    
    if (result.rows.length > 0) {
      console.log(`✅ [AI CACHE] Active session found for ${componentName}: ${result.rows[0].session_id}`);
      return result.rows[0];
    }
    
    console.log(`❌ [AI CACHE] No active session for ${componentName}`);
    return null;
  } catch (error) {
    console.error('❌ [AI CACHE] Error checking active session:', error);
    return null;
  }
}

/**
 * Get cached AI analysis data
 */
async function getCachedAnalysis(userId, analysisType, tickers, timeRange) {
  try {
    const cacheQuery = `
      SELECT 
        id,
        analysis_data,
        metadata,
        expires_at,
        credits_used,
        created_at,
        EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))/60 as minutes_remaining
      FROM user_ai_analysis_cache
      WHERE user_id = $1 
        AND analysis_type = $2 
        AND tickers = $3 
        AND time_range = $4
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await db.query(cacheQuery, [userId, analysisType, tickers, timeRange]);
    
    if (result.rows.length > 0) {
      const cachedData = result.rows[0];
      console.log(`✅ [AI CACHE] Cache hit for ${analysisType} - ${Math.round(cachedData.minutes_remaining)} minutes remaining`);
      
      return {
        success: true,
        data: cachedData.analysis_data,
        metadata: {
          ...cachedData.metadata,
          fromCache: true,
          cacheId: cachedData.id,
          creditsUsed: cachedData.credits_used,
          cachedAt: cachedData.created_at,
          minutesRemaining: Math.round(cachedData.minutes_remaining)
        }
      };
    }
    
    console.log(`❌ [AI CACHE] No valid cache for ${analysisType}`);
    return { success: false, reason: 'NO_CACHE' };
  } catch (error) {
    console.error('❌ [AI CACHE] Error getting cached analysis:', error);
    return { success: false, reason: 'CACHE_ERROR', error: error.message };
  }
}

/**
 * Store AI analysis in cache
 */
async function storeAnalysisInCache(userId, sessionId, analysisType, tickers, timeRange, analysisData, creditsUsed, userTier) {
  try {
    const cacheId = uuidv4();
    const cacheDurationHours = getCacheDuration(userTier);
    const expiresAt = new Date(Date.now() + (cacheDurationHours * 60 * 60 * 1000));
    
    // Store main cache entry
    const insertQuery = `
      INSERT INTO user_ai_analysis_cache (
        id, user_id, session_id, analysis_type, tickers, time_range,
        analysis_data, metadata, expires_at, credits_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id, analysis_type, tickers, time_range)
      DO UPDATE SET
        analysis_data = EXCLUDED.analysis_data,
        metadata = EXCLUDED.metadata,
        expires_at = EXCLUDED.expires_at,
        credits_used = EXCLUDED.credits_used,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;
    
    const metadata = {
      generatedAt: new Date().toISOString(),
      userTier,
      cacheDurationHours,
      tickerCount: Array.isArray(tickers) ? tickers.length : 1,
      analysisLength: typeof analysisData === 'string' ? analysisData.length : 
                     typeof analysisData === 'object' ? JSON.stringify(analysisData).length : 0
    };
    
    const result = await db.query(insertQuery, [
      cacheId, userId, sessionId, analysisType, tickers, timeRange,
      JSON.stringify(analysisData), JSON.stringify(metadata), expiresAt, creditsUsed
    ]);
    
    // Store detailed analysis records if analysisData contains individual ticker analyses
    if (typeof analysisData === 'object' && analysisData.tickerAnalyses) {
      await storeDetailedAnalysis(result.rows[0].id, userId, analysisType, analysisData.tickerAnalyses);
    }
    
    console.log(`✅ [AI CACHE] Stored analysis cache for ${analysisType} (expires: ${expiresAt.toISOString()})`);
    
    return { success: true, cacheId: result.rows[0].id };
  } catch (error) {
    console.error('❌ [AI CACHE] Error storing analysis cache:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Store detailed analysis records for individual tickers
 */
async function storeDetailedAnalysis(cacheId, userId, analysisType, tickerAnalyses) {
  try {
    if (!Array.isArray(tickerAnalyses)) return;
    
    for (const tickerAnalysis of tickerAnalyses) {
      const detailQuery = `
        INSERT INTO user_ai_analysis_details (
          cache_id, user_id, ticker, analysis_type, analysis_text,
          confidence_score, sentiment_score, key_insights, risk_factors, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      
      await db.query(detailQuery, [
        cacheId,
        userId,
        tickerAnalysis.ticker,
        analysisType,
        tickerAnalysis.analysis || tickerAnalysis.text,
        tickerAnalysis.confidence,
        tickerAnalysis.sentimentScore,
        tickerAnalysis.keyInsights || [],
        tickerAnalysis.riskFactors || [],
        JSON.stringify(tickerAnalysis.metadata || {})
      ]);
    }
    
    console.log(`✅ [AI CACHE] Stored ${tickerAnalyses.length} detailed analysis records`);
  } catch (error) {
    console.error('❌ [AI CACHE] Error storing detailed analysis:', error);
  }
}

/**
 * Create or update research session for AI analysis
 */
async function createOrUpdateSession(userId, componentName, creditsUsed, userTier, metadata = {}) {
  try {
    const sessionId = `ai_${componentName}_${userId}_${Date.now()}`;
    const durationHours = getCacheDuration(userTier);
    const expiresAt = new Date(Date.now() + (durationHours * 60 * 60 * 1000));
    
    const insertQuery = `
      INSERT INTO research_sessions (
        user_id, session_id, component, credits_used, expires_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING session_id
    `;
    
    const result = await db.query(insertQuery, [
      userId, sessionId, componentName, creditsUsed, expiresAt, JSON.stringify(metadata)
    ]);
    
    console.log(`✅ [AI CACHE] Created session ${sessionId} for ${componentName} (expires: ${expiresAt.toISOString()})`);
    
    return { success: true, sessionId: result.rows[0].session_id };
  } catch (error) {
    console.error('❌ [AI CACHE] Error creating session:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Main function to get AI analysis with caching
 * Implements the three-tier pattern
 */
async function getAiAnalysisWithCache(userId, analysisType, tickers, timeRange, userTier, generateAnalysisFunction, forceRefresh = false) {
  try {
    console.log(`🔍 [AI CACHE] Getting AI analysis for ${analysisType} - user: ${userId}, tickers: ${tickers}, timeRange: ${timeRange}`);
    
    // Normalize tickers array for consistent caching
    const normalizedTickers = Array.isArray(tickers) ? tickers.sort() : [tickers];
    
    // Tier 1: Check for active session
    const activeSession = await checkActiveSession(userId, analysisType);
    
    if (activeSession && !forceRefresh) {
      // User has active session - check cache first
      const cachedData = await getCachedAnalysis(userId, analysisType, normalizedTickers, timeRange);
      
      if (cachedData.success) {
        console.log('✅ [AI CACHE] Returning cached data (active session, no credits charged)');
        return {
          success: true,
          data: cachedData.data,
          metadata: {
            ...cachedData.metadata,
            creditsUsed: 0,
            hasActiveSession: true
          }
        };
      }
      
      // No cache but has session - generate fresh analysis without charging
      console.log('🔄 [AI CACHE] No cache but has active session - generating fresh analysis');
      const freshAnalysis = await generateAnalysisFunction();
      
      if (freshAnalysis.success) {
        await storeAnalysisInCache(
          userId, activeSession.session_id, analysisType, normalizedTickers, 
          timeRange, freshAnalysis.data, 0, userTier
        );
        
        return {
          success: true,
          data: freshAnalysis.data,
          metadata: {
            creditsUsed: 0,
            hasActiveSession: true,
            freshlyGenerated: true
          }
        };
      }
    }
    
    // Tier 2: No active session - check cache
    if (!forceRefresh) {
      const cachedData = await getCachedAnalysis(userId, analysisType, normalizedTickers, timeRange);
      
      if (cachedData.success) {
        console.log('✅ [AI CACHE] Returning cached data (no active session, no credits charged)');
        return {
          success: true,
          data: cachedData.data,
          metadata: {
            ...cachedData.metadata,
            creditsUsed: 0,
            hasActiveSession: false
          }
        };
      }
    }
    
    // Tier 3: No cache or forced refresh - generate fresh and charge credits
    console.log('💰 [AI CACHE] No cache found - generating fresh analysis and charging credits');
    
    const freshAnalysis = await generateAnalysisFunction();
    
    if (!freshAnalysis.success) {
      return freshAnalysis;
    }
    
    // Create new session
    const componentName = getComponentName(analysisType);
    const sessionResult = await createOrUpdateSession(
      userId, componentName, freshAnalysis.creditsUsed || 1, userTier,
      { analysisType, tickers: normalizedTickers, timeRange }
    );
    
    if (!sessionResult.success) {
      console.error('❌ [AI CACHE] Failed to create session, but returning analysis anyway');
    }
    
    // Store in cache
    await storeAnalysisInCache(
      userId, sessionResult.sessionId || 'fallback', analysisType, normalizedTickers,
      timeRange, freshAnalysis.data, freshAnalysis.creditsUsed || 1, userTier
    );
    
    return {
      success: true,
      data: freshAnalysis.data,
      metadata: {
        creditsUsed: freshAnalysis.creditsUsed || 1,
        hasActiveSession: false,
        freshlyGenerated: true,
        sessionId: sessionResult.sessionId
      }
    };
    
  } catch (error) {
    console.error('❌ [AI CACHE] Error in getAiAnalysisWithCache:', error);
    return {
      success: false,
      error: 'CACHE_SERVICE_ERROR',
      message: error.message
    };
  }
}

/**
 * Clear user's AI analysis cache
 */
async function clearUserAiAnalysisCache(userId) {
  try {
    const result = await db.query(
      'DELETE FROM user_ai_analysis_cache WHERE user_id = $1',
      [userId]
    );
    
    console.log(`✅ [AI CACHE] Cleared ${result.rowCount} cache entries for user ${userId}`);
    return { success: true, deletedCount: result.rowCount };
  } catch (error) {
    console.error('❌ [AI CACHE] Error clearing cache:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's AI analysis cache status
 */
async function getUserAiAnalysisCacheStatus(userId) {
  try {
    const statusQuery = `
      SELECT 
        analysis_type,
        COUNT(*) as cache_entries,
        MAX(expires_at) as latest_expiry,
        SUM(credits_used) as total_credits_used,
        array_agg(DISTINCT tickers) as cached_ticker_sets
      FROM user_ai_analysis_cache
      WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
      GROUP BY analysis_type
    `;
    
    const result = await db.query(statusQuery, [userId]);
    
    return {
      success: true,
      cacheStatus: result.rows,
      totalActiveEntries: result.rows.reduce((sum, row) => sum + parseInt(row.cache_entries), 0)
    };
  } catch (error) {
    console.error('❌ [AI CACHE] Error getting cache status:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getAiAnalysisWithCache,
  checkActiveSession,
  getCachedAnalysis,
  storeAnalysisInCache,
  createOrUpdateSession,
  clearUserAiAnalysisCache,
  getUserAiAnalysisCacheStatus,
  getCacheDuration,
  getComponentName
}; 