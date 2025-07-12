/**
 * Rate Limiting Middleware
 * Provides configurable rate limiting for API endpoints
 */

const logger = require('../utils/logger');

// In-memory store for rate limiting (consider Redis for production)
const rateLimitStore = new Map();

/**
 * Create a rate limiter middleware
 * @param {Object} options - Rate limiting options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.max - Maximum number of requests per window (default: 100)
 * @param {string} options.message - Error message when limit exceeded
 * @param {Function} options.keyGenerator - Function to generate unique keys for clients
 * @param {boolean} options.standardHeaders - Send rate limit info in headers
 * @param {boolean} options.legacyHeaders - Send rate limit info in legacy headers
 * @returns {Function} Express middleware function
 */
function createRateLimit(options = {}) {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        max = 100, // limit each IP to 100 requests per windowMs
        message = 'Too many requests from this IP, please try again later.',
        keyGenerator = (req) => req.ip || req.connection.remoteAddress,
        standardHeaders = true,
        legacyHeaders = false,
        skipSuccessfulRequests = false,
        skipFailedRequests = false
    } = options;

    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();
        const windowStart = now - windowMs;

        // Get or create client record
        let clientRecord = rateLimitStore.get(key);
        if (!clientRecord) {
            clientRecord = {
                requests: [],
                resetTime: now + windowMs
            };
            rateLimitStore.set(key, clientRecord);
        }

        // Clean old requests outside the window
        clientRecord.requests = clientRecord.requests.filter(timestamp => timestamp > windowStart);

        // Check if limit exceeded
        if (clientRecord.requests.length >= max) {
            const resetTime = Math.ceil(clientRecord.resetTime / 1000);
            const retryAfter = Math.ceil((clientRecord.resetTime - now) / 1000);

            // Set rate limit headers
            if (standardHeaders) {
                res.set({
                    'RateLimit-Limit': max,
                    'RateLimit-Remaining': 0,
                    'RateLimit-Reset': resetTime
                });
            }

            if (legacyHeaders) {
                res.set({
                    'X-RateLimit-Limit': max,
                    'X-RateLimit-Remaining': 0,
                    'X-RateLimit-Reset': resetTime
                });
            }

            res.set('Retry-After', retryAfter);

            logger.warn(`Rate limit exceeded for ${key}`, {
                ip: key,
                requests: clientRecord.requests.length,
                limit: max,
                windowMs
            });

            return res.status(429).json({
                error: 'Too Many Requests',
                message,
                retryAfter
            });
        }

        // Add current request timestamp
        clientRecord.requests.push(now);

        // Update reset time if needed
        if (now >= clientRecord.resetTime) {
            clientRecord.resetTime = now + windowMs;
        }

        // Set rate limit headers for successful requests
        const remaining = Math.max(0, max - clientRecord.requests.length);
        const resetTime = Math.ceil(clientRecord.resetTime / 1000);

        if (standardHeaders) {
            res.set({
                'RateLimit-Limit': max,
                'RateLimit-Remaining': remaining,
                'RateLimit-Reset': resetTime
            });
        }

        if (legacyHeaders) {
            res.set({
                'X-RateLimit-Limit': max,
                'X-RateLimit-Remaining': remaining,
                'X-RateLimit-Reset': resetTime
            });
        }

        // Handle response tracking for skip options
        if (skipSuccessfulRequests || skipFailedRequests) {
            const originalSend = res.send;
            res.send = function(body) {
                const shouldSkip = 
                    (skipSuccessfulRequests && res.statusCode < 400) ||
                    (skipFailedRequests && res.statusCode >= 400);

                if (shouldSkip) {
                    // Remove the request from tracking
                    clientRecord.requests.pop();
                }

                return originalSend.call(this, body);
            };
        }

        next();
    };
}

/**
 * Predefined rate limiters for common use cases
 */
const rateLimiters = {
    // Strict rate limiting for sensitive endpoints
    strict: createRateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 requests per 15 minutes
        message: 'Too many requests. Please wait before trying again.'
    }),

    // Moderate rate limiting for API endpoints
    moderate: createRateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per 15 minutes
        message: 'Rate limit exceeded. Please slow down your requests.'
    }),

    // Lenient rate limiting for general endpoints
    lenient: createRateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // 1000 requests per 15 minutes
        message: 'Too many requests from this IP.'
    }),

    // Per-minute rate limiting
    perMinute: createRateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 60, // 60 requests per minute
        message: 'Too many requests per minute.'
    }),

    // Per-hour rate limiting
    perHour: createRateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 1000, // 1000 requests per hour
        message: 'Hourly rate limit exceeded.'
    })
};

/**
 * Clean up old entries from the rate limit store
 * Should be called periodically to prevent memory leaks
 */
function cleanupRateLimitStore() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, record] of rateLimitStore.entries()) {
        // Remove records that are completely expired
        if (record.resetTime < now && record.requests.length === 0) {
            rateLimitStore.delete(key);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        logger.debug(`Cleaned up ${cleaned} expired rate limit records`);
    }
}

// Clean up every 10 minutes
setInterval(cleanupRateLimitStore, 10 * 60 * 1000);

module.exports = {
    createRateLimit,
    rateLimiters,
    cleanupRateLimitStore,
    // Export default rate limiter
    rateLimit: rateLimiters.moderate
};