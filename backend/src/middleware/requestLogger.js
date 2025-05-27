/**
 * Request Logger Middleware
 * Tracks API request patterns and performance
 */

/**
 * Middleware to log request details and response times
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requestLogger(req, res, next) {
  // Generate a unique ID for this request
  const reqId = Math.random().toString(36).substring(2, 10);
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  // Add request ID to the request object for consistent logging
  req.reqId = reqId;
  
  // Log request start
  console.log(`[${timestamp}] [${reqId}] ${req.method} ${req.originalUrl} started`);
  
  // Track API endpoint usage by path
  const path = req.originalUrl.split('?')[0]; // Remove query params
  
  // Track response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const statusCategory = Math.floor(statusCode / 100);
    
    // Use different log levels based on status code
    if (statusCategory === 5) {
      console.error(`[${reqId}] ${req.method} ${req.originalUrl} completed with status ${statusCode} in ${duration}ms`);
    } else if (statusCategory === 4) {
      console.warn(`[${reqId}] ${req.method} ${req.originalUrl} completed with status ${statusCode} in ${duration}ms`);
    } else {
      console.log(`[${reqId}] ${req.method} ${req.originalUrl} completed with status ${statusCode} in ${duration}ms`);
    }
    
    // Log slow requests
    if (duration > 1000) { // 1 second threshold
      console.warn(`[${reqId}] Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });
  
  // Continue to the next middleware
  next();
}

module.exports = requestLogger;
