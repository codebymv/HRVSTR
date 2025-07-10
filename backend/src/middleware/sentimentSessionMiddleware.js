const db = require('../database/db');

/**
 * Middleware to check if user has active session for sentiment components
 * Prevents unnecessary backend processing when components are not unlocked
 * 
 * This middleware implements the session-first approach:
 * 1. Check if user has active session for the requested component
 * 2. If no session, return empty/placeholder data without processing
 * 3. If session exists, proceed with normal data fetching
 */

/**
 * Map data types to component names for session checking
 */
const COMPONENT_MAP = {
  'reddit_tickers': 'sentimentReddit',
  'yahoo_tickers': 'sentimentScores', 
  'finviz_tickers': 'sentimentChart',
  'reddit_market': 'sentimentReddit',
  'yahoo_market': 'sentimentScores',
  'finviz_market': 'sentimentChart',
  'combined_tickers': 'sentimentChart',
  'aggregated_market': 'sentimentChart'
};

/**
 * Get component name from request path and data type
 * @param {Object} req - Express request object
 * @returns {string} - Component name
 */
function getComponentFromRequest(req) {
  const path = req.path;
  const { dataType } = req.query;
  
  // For streaming endpoint, use dataType query param
  if (path.includes('/stream') && dataType) {
    return COMPONENT_MAP[dataType] || 'sentimentChart';
  }
  
  // For specific endpoints, determine from path
  if (path.includes('/reddit/')) {
    return 'sentimentReddit';
  } else if (path.includes('/yahoo/')) {
    return 'sentimentScores';
  } else if (path.includes('/finviz/') || path.includes('/combined/') || path.includes('/aggregated/')) {
    return 'sentimentChart';
  }
  
  // Default fallback
  return 'sentimentChart';
}

/**
 * Check if user has active session for sentiment component
 * @param {string} userId - User ID
 * @param {string} componentName - Component name
 * @returns {Promise<Object|null>} - Session data or null
 */
async function checkActiveSession(userId, componentName) {
  try {
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
      const session = result.rows[0];
      const timeRemaining = new Date(session.expires_at) - new Date();
      const hoursRemaining = Math.round(timeRemaining / (1000 * 60 * 60) * 10) / 10;
      
      console.log(`✅ [SENTIMENT SESSION] Active session found for ${componentName}: ${session.session_id}, ${hoursRemaining}h remaining`);
      return {
        sessionId: session.session_id,
        expiresAt: session.expires_at,
        hoursRemaining,
        creditsUsed: session.credits_used,
        metadata: session.metadata
      };
    }
    
    console.log(`❌ [SENTIMENT SESSION] No active session for ${componentName}`);
    return null;
    
  } catch (error) {
    console.error('❌ [SENTIMENT SESSION] Error checking active session:', error);
    return null;
  }
}

/**
 * Generate placeholder/empty response for locked components
 * @param {string} componentName - Component name
 * @param {string} timeRange - Time range
 * @returns {Object} - Placeholder response
 */
function generatePlaceholderResponse(componentName, timeRange) {
  const baseResponse = {
    success: true,
    data: {
      data: [],
      metadata: {
        fromCache: false,
        isPlaceholder: true,
        requiresUnlock: true,
        component: componentName,
        timeRange,
        message: 'Component requires unlocking to access data'
      }
    },
    fromCache: false,
    hasActiveSession: false,
    creditsUsed: 0,
    requiresUnlock: true
  };
  
  // Customize response based on component type
  switch (componentName) {
    case 'sentimentReddit':
      baseResponse.data.data = {
        sentimentData: [],
        posts: [],
        summary: {
          totalPosts: 0,
          averageSentiment: 0,
          sentimentDistribution: { positive: 0, neutral: 0, negative: 0 }
        }
      };
      break;
      
    case 'sentimentScores':
      baseResponse.data.data = {
        sentimentData: [],
        scores: [],
        summary: {
          totalTickers: 0,
          averageScore: 0,
          scoreDistribution: { bullish: 0, neutral: 0, bearish: 0 }
        }
      };
      break;
      
    case 'sentimentChart':
      baseResponse.data.data = {
        sentimentData: [],
        chartData: [],
        summary: {
          totalDataPoints: 0,
          trendDirection: 'neutral',
          volatility: 0
        }
      };
      break;
      
    default:
      baseResponse.data.data = {
        sentimentData: [],
        summary: { message: 'Data requires component unlock' }
      };
  }
  
  return baseResponse;
}

/**
 * Middleware function to check sentiment component sessions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function checkSentimentSession(req, res, next) {
  try {
    const userId = req.user?.id;
    const { timeRange = '1w', refresh = 'false' } = req.query;
    const forceRefresh = refresh === 'true';
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for sentiment data'
      });
    }
    
    // Skip session check for cache management and health endpoints
    if (req.path.includes('/cache/') || req.path.includes('/health')) {
      return next();
    }
    
    // Skip session check if force refresh (for testing/admin purposes)
    if (forceRefresh && req.user?.role === 'admin') {
      console.log(`🔧 [SENTIMENT SESSION] Admin force refresh - skipping session check`);
      return next();
    }
    
    // Determine component name from request
    const componentName = getComponentFromRequest(req);
    console.log(`🔍 [SENTIMENT SESSION] Checking session for component: ${componentName}`);
    
    // Check for active session
    const activeSession = await checkActiveSession(userId, componentName);
    
    if (activeSession) {
      // User has active session - proceed with normal processing
      console.log(`✅ [SENTIMENT SESSION] Session valid - proceeding with data fetch`);
      req.sentimentSession = activeSession;
      return next();
    }
    
    // No active session - return placeholder data without processing
    console.log(`🔒 [SENTIMENT SESSION] No session found - returning placeholder data`);
    const placeholderResponse = generatePlaceholderResponse(componentName, timeRange);
    
    return res.json(placeholderResponse);
    
  } catch (error) {
    console.error('❌ [SENTIMENT SESSION] Middleware error:', error);
    
    // On error, allow request to proceed to avoid breaking functionality
    console.log('⚠️ [SENTIMENT SESSION] Error in middleware - allowing request to proceed');
    return next();
  }
}

module.exports = {
  checkSentimentSession,
  checkActiveSession,
  generatePlaceholderResponse,
  getComponentFromRequest,
  COMPONENT_MAP
};