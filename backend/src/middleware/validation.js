/**
 * Validation Middleware
 * Provides request validation using Joi schemas
 */

const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Create a validation middleware for request validation
 * @param {Object} schemas - Object containing validation schemas
 * @param {Object} schemas.params - Joi schema for request params
 * @param {Object} schemas.query - Joi schema for request query
 * @param {Object} schemas.body - Joi schema for request body
 * @param {Object} schemas.headers - Joi schema for request headers
 * @returns {Function} Express middleware function
 */
const validateRequest = (schemas = {}) => {
    return (req, res, next) => {
        const validationErrors = [];

        // Validate params
        if (schemas.params) {
            const { error, value } = schemas.params.validate(req.params, {
                abortEarly: false,
                stripUnknown: true
            });
            if (error) {
                validationErrors.push({
                    location: 'params',
                    errors: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message,
                        value: detail.context?.value
                    }))
                });
            } else {
                req.params = value;
            }
        }

        // Validate query
        if (schemas.query) {
            const { error, value } = schemas.query.validate(req.query, {
                abortEarly: false,
                stripUnknown: true
            });
            if (error) {
                validationErrors.push({
                    location: 'query',
                    errors: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message,
                        value: detail.context?.value
                    }))
                });
            } else {
                req.query = value;
            }
        }

        // Validate body
        if (schemas.body) {
            const { error, value } = schemas.body.validate(req.body, {
                abortEarly: false,
                stripUnknown: true
            });
            if (error) {
                validationErrors.push({
                    location: 'body',
                    errors: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message,
                        value: detail.context?.value
                    }))
                });
            } else {
                req.body = value;
            }
        }

        // Validate headers
        if (schemas.headers) {
            const { error, value } = schemas.headers.validate(req.headers, {
                abortEarly: false,
                stripUnknown: true
            });
            if (error) {
                validationErrors.push({
                    location: 'headers',
                    errors: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message,
                        value: detail.context?.value
                    }))
                });
            } else {
                req.headers = { ...req.headers, ...value };
            }
        }

        // If there are validation errors, return 400
        if (validationErrors.length > 0) {
            logger.warn('Request validation failed', {
                url: req.url,
                method: req.method,
                errors: validationErrors,
                ip: req.ip
            });

            return res.status(400).json({
                error: 'Validation Error',
                message: 'Request validation failed',
                details: validationErrors,
                timestamp: new Date().toISOString()
            });
        }

        next();
    };
};

/**
 * Validate a single value against a Joi schema
 * @param {any} value - Value to validate
 * @param {Object} schema - Joi schema
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with error and value
 */
const validateValue = (value, schema, options = {}) => {
    const defaultOptions = {
        abortEarly: false,
        stripUnknown: true,
        ...options
    };

    return schema.validate(value, defaultOptions);
};

/**
 * Create a validation function for async operations
 * @param {Object} schema - Joi schema
 * @param {Object} options - Validation options
 * @returns {Function} Async validation function
 */
const createAsyncValidator = (schema, options = {}) => {
    return async (value) => {
        try {
            const result = await schema.validateAsync(value, {
                abortEarly: false,
                stripUnknown: true,
                ...options
            });
            return { value: result, error: null };
        } catch (error) {
            return { value: null, error };
        }
    };
};

/**
 * Common validation schemas
 */
const commonSchemas = {
    // Ticker validation
    ticker: Joi.string()
        .pattern(/^[A-Z]{1,5}$/)
        .required()
        .messages({
            'string.pattern.base': 'Ticker must be 1-5 uppercase letters',
            'any.required': 'Ticker is required'
        }),

    // Pagination
    pagination: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        sort: Joi.string().valid('asc', 'desc').default('desc')
    }),

    // Timeframe
    timeframe: Joi.string()
        .valid('1h', '6h', '12h', '24h', '7d', '30d')
        .default('24h'),

    // Confidence threshold
    confidence: Joi.number().min(0).max(1).default(0.7),

    // Boolean flags
    booleanFlag: Joi.boolean().default(false)
};

module.exports = {
    validateRequest,
    validateValue,
    createAsyncValidator,
    commonSchemas
};