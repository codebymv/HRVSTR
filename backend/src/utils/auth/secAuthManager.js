/**
 * SEC Authentication Manager - Handles user authentication and tier validation for SEC endpoints
 */

/**
 * Validate user authentication and extract user info
 * @param {Object} req - Express request object
 * @returns {Object} - User authentication result
 */
function validateUserAuth(req) {
  const userId = req.user?.id;
  const userTier = req.user?.tier || 'free';
  
  return {
    isAuthenticated: !!userId,
    userId,
    userTier,
    user: req.user || null
  };
}

/**
 * Check if user has access to specific SEC data type based on tier
 * @param {string} userTier - User's subscription tier
 * @param {string} dataType - Type of SEC data being requested
 * @returns {Object} - Access validation result
 */
function validateTierAccess(userTier, dataType) {
  const accessRules = {
    'insider_trades': ['free', 'pro', 'premium'],
    'institutional_holdings': ['pro', 'premium'],
    'abnormal_activity': ['pro', 'premium'],
    'filing_details': ['free', 'pro', 'premium'],
    'ticker_summary': ['free', 'pro', 'premium'],
    'streaming': ['pro', 'premium'],
    'parallel_data': ['pro', 'premium']
  };

  const allowedTiers = accessRules[dataType] || ['premium'];
  const hasAccess = allowedTiers.includes(userTier);

  return {
    hasAccess,
    userTier,
    dataType,
    allowedTiers,
    tierRequired: hasAccess ? null : getMinimumTier(allowedTiers),
    upgradeRequired: !hasAccess
  };
}

/**
 * Get minimum tier required from list of allowed tiers
 * @param {Array} allowedTiers - List of allowed tiers
 * @returns {string} - Minimum required tier
 */
function getMinimumTier(allowedTiers) {
  const tierHierarchy = ['free', 'pro', 'premium'];
  
  for (const tier of tierHierarchy) {
    if (allowedTiers.includes(tier)) {
      return tier;
    }
  }
  
  return 'premium'; // Default to premium if no match
}

/**
 * Create standardized access denied response
 * @param {string} dataType - Type of data being accessed
 * @param {string} userTier - User's current tier
 * @param {string} tierRequired - Minimum tier required
 * @returns {Object} - Standardized error response
 */
function createAccessDeniedResponse(dataType, userTier, tierRequired) {
  const dataTypeNames = {
    'insider_trades': 'Insider Trades',
    'institutional_holdings': 'Institutional Holdings',
    'abnormal_activity': 'Abnormal Activity Analysis',
    'filing_details': 'Filing Details',
    'ticker_summary': 'Ticker Summary',
    'streaming': 'Real-time Streaming',
    'parallel_data': 'Parallel Data Loading'
  };

  const tierNames = {
    'free': 'Free',
    'pro': 'Pro',
    'premium': 'Premium'
  };

  return {
    error: 'TIER_RESTRICTION',
    message: `${dataTypeNames[dataType] || dataType} requires ${tierNames[tierRequired] || tierRequired} tier or higher`,
    userMessage: `Upgrade to ${tierNames[tierRequired] || tierRequired} to access ${dataTypeNames[dataType] || dataType}`,
    currentTier: userTier,
    tierRequired,
    upgradeUrl: `/upgrade?from=${userTier}&to=${tierRequired}`,
    dataType
  };
}

/**
 * Extract authentication token from query parameters (for EventSource requests)
 * @param {Object} req - Express request object
 * @returns {Object} - Token validation result
 */
function extractTokenAuth(req) {
  const { token } = req.query;
  
  if (!token) {
    return {
      isValid: false,
      error: 'TOKEN_MISSING',
      message: 'Authentication token required for streaming'
    };
  }

  try {
    // In a real implementation, you'd validate the JWT token here
    // For now, returning a placeholder structure
    return {
      isValid: true,
      userId: null, // Would be extracted from token
      userTier: 'free', // Would be extracted from token
      token
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'TOKEN_INVALID',
      message: 'Invalid authentication token',
      details: error.message
    };
  }
}

/**
 * Comprehensive authentication and authorization check
 * @param {Object} req - Express request object
 * @param {string} dataType - Type of SEC data being requested
 * @param {boolean} allowTokenAuth - Whether to allow token-based auth (for streaming)
 * @returns {Object} - Complete auth result
 */
function validateSecAccess(req, dataType, allowTokenAuth = false) {
  // First try standard authentication
  let authResult = validateUserAuth(req);

  // If not authenticated and token auth is allowed, try token
  if (!authResult.isAuthenticated && allowTokenAuth) {
    const tokenResult = extractTokenAuth(req);
    if (tokenResult.isValid) {
      authResult = {
        isAuthenticated: true,
        userId: tokenResult.userId,
        userTier: tokenResult.userTier,
        user: { id: tokenResult.userId, tier: tokenResult.userTier },
        authMethod: 'token'
      };
    } else {
      return {
        success: false,
        error: 'AUTHENTICATION_FAILED',
        message: tokenResult.message,
        authRequired: true
      };
    }
  }

  // Check if authentication is required but missing
  if (!authResult.isAuthenticated) {
    return {
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'User authentication required for this endpoint',
      authRequired: true
    };
  }

  // Check tier access
  const accessResult = validateTierAccess(authResult.userTier, dataType);
  
  if (!accessResult.hasAccess) {
    return {
      success: false,
      ...createAccessDeniedResponse(dataType, authResult.userTier, accessResult.tierRequired)
    };
  }

  // Success - user is authenticated and has access
  return {
    success: true,
    userId: authResult.userId,
    userTier: authResult.userTier,
    user: authResult.user,
    dataType,
    authMethod: authResult.authMethod || 'session'
  };
}

/**
 * Check if user has sufficient credits for the operation
 * @param {string} userId - User ID
 * @param {string} operation - Operation type
 * @param {number} creditsRequired - Credits required for operation
 * @returns {Promise<Object>} - Credit validation result
 */
async function validateCredits(userId, operation, creditsRequired = 1) {
  try {
    // This would integrate with a credits/billing system
    // For now, returning a placeholder structure
    
    const userCredits = 100; // Would be fetched from database
    const hasCredits = userCredits >= creditsRequired;

    return {
      hasCredits,
      creditsRequired,
      creditsAvailable: userCredits,
      operation,
      userId
    };
  } catch (error) {
    return {
      hasCredits: false,
      error: 'CREDIT_CHECK_FAILED',
      message: 'Unable to verify user credits',
      details: error.message
    };
  }
}

/**
 * Create insufficient credits response
 * @param {number} creditsRequired - Credits required
 * @param {number} creditsAvailable - Credits available
 * @param {string} operation - Operation type
 * @returns {Object} - Standardized error response
 */
function createInsufficientCreditsResponse(creditsRequired, creditsAvailable, operation) {
  return {
    error: 'INSUFFICIENT_CREDITS',
    message: `Insufficient credits for ${operation}. Required: ${creditsRequired}, Available: ${creditsAvailable}`,
    userMessage: `You need ${creditsRequired} credits for this operation, but only have ${creditsAvailable} available`,
    creditsRequired,
    creditsAvailable,
    creditsNeeded: creditsRequired - creditsAvailable,
    operation,
    upgradeUrl: '/credits'
  };
}

/**
 * Get user limits based on tier
 * @param {string} userTier - User's subscription tier
 * @param {string} dataType - Type of data being requested
 * @returns {Object} - User limits
 */
function getUserLimits(userTier, dataType) {
  const limits = {
    free: {
      insider_trades: { maxResults: 50, requestsPerHour: 20 },
      filing_details: { maxResults: 20, requestsPerHour: 10 },
      ticker_summary: { maxResults: 10, requestsPerHour: 15 }
    },
    pro: {
      insider_trades: { maxResults: 200, requestsPerHour: 100 },
      institutional_holdings: { maxResults: 100, requestsPerHour: 50 },
      abnormal_activity: { maxResults: 50, requestsPerHour: 30 },
      filing_details: { maxResults: 100, requestsPerHour: 60 },
      ticker_summary: { maxResults: 50, requestsPerHour: 80 },
      streaming: { connectionsPerUser: 2, requestsPerHour: 200 }
    },
    premium: {
      insider_trades: { maxResults: 1000, requestsPerHour: 500 },
      institutional_holdings: { maxResults: 500, requestsPerHour: 250 },
      abnormal_activity: { maxResults: 200, requestsPerHour: 150 },
      filing_details: { maxResults: 500, requestsPerHour: 300 },
      ticker_summary: { maxResults: 200, requestsPerHour: 400 },
      streaming: { connectionsPerUser: 5, requestsPerHour: 1000 },
      parallel_data: { maxConcurrent: 5, requestsPerHour: 200 }
    }
  };

  const tierLimits = limits[userTier] || limits.free;
  return tierLimits[dataType] || { maxResults: 10, requestsPerHour: 5 };
}

module.exports = {
  validateUserAuth,
  validateTierAccess,
  createAccessDeniedResponse,
  extractTokenAuth,
  validateSecAccess,
  validateCredits,
  createInsufficientCreditsResponse,
  getUserLimits,
  getMinimumTier
}; 