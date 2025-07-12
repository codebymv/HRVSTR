/**
 * Enhanced Sentiment Routes
 * Provides endpoints for both basic and advanced Python-based sentiment analysis
 */

const express = require('express');
const router = express.Router();
const enhancedSentimentController = require('../controllers/enhancedSentimentController');
const { createRateLimit } = require('../middleware/rateLimit');
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

// Rate limiting configurations
const basicRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many basic sentiment requests, please try again later'
});

const enhancedRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 requests per window (more restrictive for enhanced)
    message: 'Too many enhanced sentiment requests, please try again later'
});

const customTextRateLimit = createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 requests per window
    message: 'Too many custom text analysis requests, please try again later'
});

// Validation schemas
const tickerSchema = Joi.object({
    ticker: Joi.string()
        .pattern(/^[A-Z]{1,5}$/)
        .required()
        .messages({
            'string.pattern.base': 'Ticker must be 1-5 uppercase letters',
            'any.required': 'Ticker is required'
        })
});

const enhancedTickerQuerySchema = Joi.object({
    enhanced: Joi.boolean().default(false),
    sources: Joi.string().valid('all', 'reddit', 'finviz', 'yahoo').default('all'),
    timeframe: Joi.string().valid('1h', '6h', '12h', '24h', '7d').default('24h'),
    confidence_threshold: Joi.number().min(0).max(1).default(0.7),
    use_finbert: Joi.boolean().default(true),
    extract_entities: Joi.boolean().default(true)
});

const compareTickersSchema = Joi.object({
    tickers: Joi.array()
        .items(Joi.string().pattern(/^[A-Z]{1,5}$/))
        .min(2)
        .max(5)
        .required()
        .messages({
            'array.min': 'At least 2 tickers required for comparison',
            'array.max': 'Maximum 5 tickers allowed for comparison',
            'any.required': 'Tickers array is required'
        })
});

const compareQuerySchema = Joi.object({
    enhanced: Joi.boolean().default(false),
    timeframe: Joi.string().valid('1h', '6h', '12h', '24h', '7d').default('24h'),
    confidence_threshold: Joi.number().min(0).max(1).default(0.7),
    max_tickers: Joi.number().integer().min(2).max(10).default(5)
});

const customTextSchema = Joi.object({
    text: Joi.string()
        .min(1)
        .max(5000)
        .required()
        .messages({
            'string.min': 'Text cannot be empty',
            'string.max': 'Text must be less than 5000 characters',
            'any.required': 'Text is required'
        }),
    ticker: Joi.string()
        .pattern(/^[A-Z]{1,5}$/)
        .optional()
        .messages({
            'string.pattern.base': 'Ticker must be 1-5 uppercase letters'
        }),
    source: Joi.string().max(50).default('custom')
});

const customTextQuerySchema = Joi.object({
    enhanced: Joi.boolean().default(true),
    confidence_threshold: Joi.number().min(0).max(1).default(0.7),
    extract_entities: Joi.boolean().default(true),
    use_finbert: Joi.boolean().default(true)
});

/**
 * @route GET /api/enhanced-sentiment/ticker/:ticker
 * @desc Get enhanced sentiment analysis for a specific ticker
 * @access Public (with rate limiting)
 * @param {string} ticker - Stock ticker symbol (1-5 uppercase letters)
 * @query {boolean} enhanced - Use enhanced Python-based analysis (default: false)
 * @query {string} sources - Data sources to use: 'all', 'reddit', 'finviz', 'yahoo' (default: 'all')
 * @query {string} timeframe - Time window: '1h', '6h', '12h', '24h', '7d' (default: '24h')
 * @query {number} confidence_threshold - Minimum confidence threshold 0-1 (default: 0.7)
 * @query {boolean} use_finbert - Use FinBERT model for analysis (default: true)
 * @query {boolean} extract_entities - Extract financial entities (default: true)
 */
router.get('/ticker/:ticker', 
    basicRateLimit,
    validateRequest({ params: tickerSchema, query: enhancedTickerQuerySchema }),
    async (req, res) => {
        // Apply enhanced rate limiting for enhanced requests
        if (req.query.enhanced === 'true' || req.query.enhanced === true) {
            return enhancedRateLimit(req, res, () => {
                enhancedSentimentController.getEnhancedTickerSentiment(req, res);
            });
        }
        
        enhancedSentimentController.getEnhancedTickerSentiment(req, res);
    }
);

/**
 * @route POST /api/enhanced-sentiment/compare
 * @desc Compare sentiment analysis between multiple tickers
 * @access Public (with rate limiting)
 * @body {string[]} tickers - Array of ticker symbols (2-5 tickers)
 * @query {boolean} enhanced - Use enhanced Python-based analysis (default: false)
 * @query {string} timeframe - Time window: '1h', '6h', '12h', '24h', '7d' (default: '24h')
 * @query {number} confidence_threshold - Minimum confidence threshold 0-1 (default: 0.7)
 * @query {number} max_tickers - Maximum number of tickers to compare (default: 5)
 */
router.post('/compare',
    enhancedRateLimit,
    validateRequest({ body: compareTickersSchema, query: compareQuerySchema }),
    enhancedSentimentController.compareEnhancedTickerSentiment
);

/**
 * @route POST /api/enhanced-sentiment/analyze-text
 * @desc Analyze sentiment of custom text with optional ticker context
 * @access Public (with rate limiting)
 * @body {string} text - Text to analyze (1-5000 characters)
 * @body {string} [ticker] - Optional ticker symbol for context
 * @body {string} [source] - Source identifier (default: 'custom')
 * @query {boolean} enhanced - Use enhanced Python-based analysis (default: true)
 * @query {number} confidence_threshold - Minimum confidence threshold 0-1 (default: 0.7)
 * @query {boolean} extract_entities - Extract financial entities (default: true)
 * @query {boolean} use_finbert - Use FinBERT model for analysis (default: true)
 */
router.post('/analyze-text',
    customTextRateLimit,
    validateRequest({ body: customTextSchema, query: customTextQuerySchema }),
    enhancedSentimentController.analyzeCustomText
);

/**
 * @route GET /api/enhanced-sentiment/status
 * @desc Get service status and model information
 * @access Public
 */
router.get('/status',
    createRateLimit({
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 20, // 20 requests per window
        message: 'Too many status requests, please try again later'
    }),
    enhancedSentimentController.getServiceStatus
);

/**
 * @route GET /api/enhanced-sentiment/health
 * @desc Simple health check endpoint
 * @access Public
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'enhanced-sentiment-api',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

/**
 * @route GET /api/enhanced-sentiment/pricing
 * @desc Get pricing information for different analysis types
 * @access Public
 */
router.get('/pricing', (req, res) => {
    res.json({
        credit_costs: {
            basic_analysis: {
                cost: 1,
                description: 'Basic sentiment analysis using existing models',
                features: [
                    'Multi-source aggregation',
                    'Basic sentiment scoring',
                    'Ticker extraction',
                    'Standard caching'
                ]
            },
            enhanced_analysis: {
                cost: 3,
                description: 'Advanced sentiment analysis using Python ML models',
                features: [
                    'FinBERT financial sentiment model',
                    'VADER sentiment analysis',
                    'Entity extraction',
                    'Confidence scoring',
                    'Model ensemble',
                    'Enhanced caching'
                ]
            },
            premium_analysis: {
                cost: 5,
                description: 'Premium analysis with full feature set',
                features: [
                    'All enhanced features',
                    'Custom financial lexicon',
                    'Advanced entity recognition',
                    'Batch processing',
                    'Priority processing',
                    'Extended caching'
                ]
            }
        },
        rate_limits: {
            basic_requests: '100 per 15 minutes',
            enhanced_requests: '30 per 15 minutes',
            custom_text_analysis: '50 per 15 minutes',
            status_checks: '20 per 5 minutes'
        },
        supported_features: {
            timeframes: ['1h', '6h', '12h', '24h', '7d'],
            sources: ['reddit', 'finviz', 'yahoo', 'all'],
            models: ['basic', 'finbert', 'vader', 'ensemble'],
            max_text_length: 5000,
            max_comparison_tickers: 5
        }
    });
});

/**
 * Error handling middleware for this router
 */
router.use((error, req, res, next) => {
    console.error('Enhanced Sentiment Route Error:', error);
    
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            message: error.message,
            details: error.details
        });
    }
    
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
        return res.status(429).json({
            error: 'Rate Limit Exceeded',
            message: error.message,
            retry_after: error.retryAfter
        });
    }
    
    res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred in sentiment analysis'
    });
});

module.exports = router;