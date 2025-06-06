/**
 * SEC Error Handler - Centralized error handling for SEC operations
 */

/**
 * Error types and their classifications
 */
const ERROR_TYPES = {
  // Authentication/Authorization errors
  AUTH_REQUIRED: 'AUTHENTICATION_REQUIRED',
  AUTH_FAILED: 'AUTHENTICATION_FAILED',
  TIER_RESTRICTION: 'TIER_RESTRICTION',
  TOKEN_INVALID: 'TOKEN_INVALID',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',

  // Data/Request errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_TICKER: 'INVALID_TICKER',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  DATA_NOT_FOUND: 'DATA_NOT_FOUND',

  // External service errors
  SEC_SERVICE_ERROR: 'SEC_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',

  // Cache/Database errors
  CACHE_ERROR: 'CACHE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',

  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  MEMORY_ERROR: 'MEMORY_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR'
};

/**
 * HTTP status codes for different error types
 */
const ERROR_STATUS_CODES = {
  [ERROR_TYPES.AUTH_REQUIRED]: 401,
  [ERROR_TYPES.AUTH_FAILED]: 401,
  [ERROR_TYPES.TIER_RESTRICTION]: 403,
  [ERROR_TYPES.TOKEN_INVALID]: 401,
  [ERROR_TYPES.INSUFFICIENT_CREDITS]: 402,

  [ERROR_TYPES.VALIDATION_ERROR]: 400,
  [ERROR_TYPES.INVALID_TICKER]: 400,
  [ERROR_TYPES.INVALID_DATE_RANGE]: 400,
  [ERROR_TYPES.INVALID_PARAMETERS]: 400,
  [ERROR_TYPES.DATA_NOT_FOUND]: 404,

  [ERROR_TYPES.SEC_SERVICE_ERROR]: 502,
  [ERROR_TYPES.RATE_LIMIT_EXCEEDED]: 429,
  [ERROR_TYPES.SERVICE_UNAVAILABLE]: 503,
  [ERROR_TYPES.TIMEOUT_ERROR]: 504,

  [ERROR_TYPES.CACHE_ERROR]: 500,
  [ERROR_TYPES.DATABASE_ERROR]: 500,
  [ERROR_TYPES.CONNECTION_ERROR]: 500,

  [ERROR_TYPES.INTERNAL_ERROR]: 500,
  [ERROR_TYPES.MEMORY_ERROR]: 500,
  [ERROR_TYPES.PROCESSING_ERROR]: 500
};

/**
 * Create standardized error response
 * @param {string} errorType - Type of error
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @param {Object} context - Request context
 * @returns {Object} - Standardized error response
 */
function createErrorResponse(errorType, message, details = {}, context = {}) {
  const statusCode = ERROR_STATUS_CODES[errorType] || 500;
  const timestamp = new Date().toISOString();

  const errorResponse = {
    success: false,
    error: errorType,
    message,
    statusCode,
    timestamp,
    requestId: context.requestId || generateRequestId(),
    ...details
  };

  // Add user-friendly message if not provided
  if (!errorResponse.userMessage) {
    errorResponse.userMessage = getUserFriendlyMessage(errorType, message);
  }

  // Add retry information for retryable errors
  if (isRetryableError(errorType)) {
    errorResponse.retryable = true;
    errorResponse.retryAfter = getRetryDelay(errorType);
  }

  return errorResponse;
}

/**
 * Handle different types of errors with appropriate responses
 * @param {Error} error - The error object
 * @param {Object} context - Request context
 * @returns {Object} - Standardized error response
 */
function handleError(error, context = {}) {
  const {
    endpoint = 'unknown',
    userId = null,
    operation = 'unknown'
  } = context;

  // Log error for monitoring
  logError(error, context);

  // Handle known error types
  if (error.type && ERROR_TYPES[error.type]) {
    return createErrorResponse(
      error.type,
      error.message,
      error.details || {},
      context
    );
  }

  // Handle common error patterns
  if (error.name === 'ValidationError') {
    return createErrorResponse(
      ERROR_TYPES.VALIDATION_ERROR,
      error.message,
      { validationErrors: error.errors },
      context
    );
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return createErrorResponse(
      ERROR_TYPES.CONNECTION_ERROR,
      'Unable to connect to external service',
      { originalError: error.code },
      context
    );
  }

  if (error.code === 'ETIMEDOUT') {
    return createErrorResponse(
      ERROR_TYPES.TIMEOUT_ERROR,
      'Request timed out',
      { originalError: error.code },
      context
    );
  }

  // Handle specific SEC API errors
  if (error.response && error.response.status) {
    return handleHttpError(error, context);
  }

  // Default to internal error
  return createErrorResponse(
    ERROR_TYPES.INTERNAL_ERROR,
    'An unexpected error occurred',
    { 
      originalMessage: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    },
    context
  );
}

/**
 * Handle HTTP errors from external services
 * @param {Error} error - HTTP error
 * @param {Object} context - Request context
 * @returns {Object} - Standardized error response
 */
function handleHttpError(error, context) {
  const status = error.response.status;
  const data = error.response.data || {};

  switch (status) {
    case 400:
      return createErrorResponse(
        ERROR_TYPES.VALIDATION_ERROR,
        data.message || 'Bad request to external service',
        { httpStatus: status, serviceResponse: data },
        context
      );

    case 401:
      return createErrorResponse(
        ERROR_TYPES.SEC_SERVICE_ERROR,
        'Authentication failed with SEC service',
        { httpStatus: status },
        context
      );

    case 403:
      return createErrorResponse(
        ERROR_TYPES.SEC_SERVICE_ERROR,
        'Access forbidden by SEC service',
        { httpStatus: status },
        context
      );

    case 404:
      return createErrorResponse(
        ERROR_TYPES.DATA_NOT_FOUND,
        data.message || 'Requested data not found',
        { httpStatus: status },
        context
      );

    case 429:
      return createErrorResponse(
        ERROR_TYPES.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded for SEC service',
        { 
          httpStatus: status,
          retryAfter: error.response.headers['retry-after'] || 60
        },
        context
      );

    case 500:
    case 502:
    case 503:
    case 504:
      return createErrorResponse(
        ERROR_TYPES.SERVICE_UNAVAILABLE,
        'SEC service temporarily unavailable',
        { httpStatus: status },
        context
      );

    default:
      return createErrorResponse(
        ERROR_TYPES.SEC_SERVICE_ERROR,
        `SEC service error: ${status}`,
        { httpStatus: status, serviceResponse: data },
        context
      );
  }
}

/**
 * Get user-friendly error message
 * @param {string} errorType - Type of error
 * @param {string} originalMessage - Original error message
 * @returns {string} - User-friendly message
 */
function getUserFriendlyMessage(errorType, originalMessage) {
  const userMessages = {
    [ERROR_TYPES.AUTH_REQUIRED]: 'Please log in to access this feature',
    [ERROR_TYPES.AUTH_FAILED]: 'Authentication failed. Please log in again',
    [ERROR_TYPES.TIER_RESTRICTION]: 'This feature requires a higher subscription tier',
    [ERROR_TYPES.TOKEN_INVALID]: 'Your session has expired. Please log in again',
    [ERROR_TYPES.INSUFFICIENT_CREDITS]: 'You don\'t have enough credits for this operation',

    [ERROR_TYPES.VALIDATION_ERROR]: 'Please check your input parameters',
    [ERROR_TYPES.INVALID_TICKER]: 'Please provide a valid stock ticker symbol',
    [ERROR_TYPES.INVALID_DATE_RANGE]: 'Please provide a valid date range',
    [ERROR_TYPES.INVALID_PARAMETERS]: 'Please check your request parameters',
    [ERROR_TYPES.DATA_NOT_FOUND]: 'No data found for your request',

    [ERROR_TYPES.SEC_SERVICE_ERROR]: 'There was an issue accessing SEC data. Please try again',
    [ERROR_TYPES.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait before trying again',
    [ERROR_TYPES.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later',
    [ERROR_TYPES.TIMEOUT_ERROR]: 'Request timed out. Please try again',

    [ERROR_TYPES.CACHE_ERROR]: 'Temporary issue with data cache. Please try again',
    [ERROR_TYPES.DATABASE_ERROR]: 'Database temporarily unavailable. Please try again',
    [ERROR_TYPES.CONNECTION_ERROR]: 'Connection issue. Please check your internet and try again',

    [ERROR_TYPES.INTERNAL_ERROR]: 'Something went wrong. Please try again',
    [ERROR_TYPES.MEMORY_ERROR]: 'System temporarily overloaded. Please try again',
    [ERROR_TYPES.PROCESSING_ERROR]: 'Error processing your request. Please try again'
  };

  return userMessages[errorType] || originalMessage || 'An error occurred';
}

/**
 * Check if error is retryable
 * @param {string} errorType - Type of error
 * @returns {boolean} - Whether error is retryable
 */
function isRetryableError(errorType) {
  const retryableErrors = [
    ERROR_TYPES.RATE_LIMIT_EXCEEDED,
    ERROR_TYPES.SERVICE_UNAVAILABLE,
    ERROR_TYPES.TIMEOUT_ERROR,
    ERROR_TYPES.CONNECTION_ERROR,
    ERROR_TYPES.CACHE_ERROR,
    ERROR_TYPES.DATABASE_ERROR,
    ERROR_TYPES.INTERNAL_ERROR
  ];

  return retryableErrors.includes(errorType);
}

/**
 * Get retry delay for retryable errors
 * @param {string} errorType - Type of error
 * @returns {number} - Retry delay in seconds
 */
function getRetryDelay(errorType) {
  const retryDelays = {
    [ERROR_TYPES.RATE_LIMIT_EXCEEDED]: 60,
    [ERROR_TYPES.SERVICE_UNAVAILABLE]: 30,
    [ERROR_TYPES.TIMEOUT_ERROR]: 10,
    [ERROR_TYPES.CONNECTION_ERROR]: 15,
    [ERROR_TYPES.CACHE_ERROR]: 5,
    [ERROR_TYPES.DATABASE_ERROR]: 20,
    [ERROR_TYPES.INTERNAL_ERROR]: 10
  };

  return retryDelays[errorType] || 30;
}

/**
 * Log error for monitoring and debugging
 * @param {Error} error - The error object
 * @param {Object} context - Request context
 */
function logError(error, context) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      type: error.type
    },
    context,
    level: getErrorLevel(error)
  };

  // In a real implementation, this would send to your logging service
  console.error('SEC Error:', JSON.stringify(logEntry, null, 2));
}

/**
 * Get error severity level
 * @param {Error} error - The error object
 * @returns {string} - Error level
 */
function getErrorLevel(error) {
  if (error.type) {
    const criticalErrors = [
      ERROR_TYPES.DATABASE_ERROR,
      ERROR_TYPES.MEMORY_ERROR,
      ERROR_TYPES.INTERNAL_ERROR
    ];

    const warningErrors = [
      ERROR_TYPES.RATE_LIMIT_EXCEEDED,
      ERROR_TYPES.SERVICE_UNAVAILABLE,
      ERROR_TYPES.TIMEOUT_ERROR
    ];

    if (criticalErrors.includes(error.type)) {
      return 'critical';
    } else if (warningErrors.includes(error.type)) {
      return 'warning';
    } else {
      return 'info';
    }
  }

  return 'error';
}

/**
 * Generate unique request ID for tracking
 * @returns {string} - Unique request ID
 */
function generateRequestId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Create validation error
 * @param {string} field - Field that failed validation
 * @param {string} message - Validation message
 * @param {*} value - Invalid value
 * @returns {Error} - Validation error
 */
function createValidationError(field, message, value) {
  const error = new Error(`Validation failed for ${field}: ${message}`);
  error.type = ERROR_TYPES.VALIDATION_ERROR;
  error.details = {
    field,
    message,
    value,
    validationError: true
  };
  return error;
}

/**
 * Create authentication error
 * @param {string} reason - Reason for auth failure
 * @param {Object} details - Additional details
 * @returns {Error} - Authentication error
 */
function createAuthError(reason, details = {}) {
  const error = new Error(`Authentication failed: ${reason}`);
  error.type = ERROR_TYPES.AUTH_FAILED;
  error.details = details;
  return error;
}

/**
 * Create tier restriction error
 * @param {string} dataType - Data type requiring upgrade
 * @param {string} currentTier - User's current tier
 * @param {string} requiredTier - Required tier
 * @returns {Error} - Tier restriction error
 */
function createTierError(dataType, currentTier, requiredTier) {
  const error = new Error(`${dataType} requires ${requiredTier} tier`);
  error.type = ERROR_TYPES.TIER_RESTRICTION;
  error.details = {
    dataType,
    currentTier,
    requiredTier,
    upgradeRequired: true
  };
  return error;
}

/**
 * Middleware for Express error handling
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function errorMiddleware(err, req, res, next) {
  const context = {
    endpoint: req.path,
    method: req.method,
    userId: req.user?.id,
    operation: req.operation || 'unknown',
    requestId: req.requestId || generateRequestId()
  };

  const errorResponse = handleError(err, context);
  res.status(errorResponse.statusCode).json(errorResponse);
}

module.exports = {
  ERROR_TYPES,
  ERROR_STATUS_CODES,
  createErrorResponse,
  handleError,
  handleHttpError,
  getUserFriendlyMessage,
  isRetryableError,
  getRetryDelay,
  logError,
  createValidationError,
  createAuthError,
  createTierError,
  errorMiddleware,
  generateRequestId
}; 