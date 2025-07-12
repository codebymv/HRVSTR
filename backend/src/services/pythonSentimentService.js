/**
 * Python Sentiment Service Integration
 * Handles communication with the Python-based advanced sentiment analysis service
 */

const axios = require('axios');
const cacheManager = require('../utils/cacheManager');
const logger = require('../utils/logger');

class PythonSentimentService {
    constructor() {
        this.pythonServiceUrl = process.env.PYTHON_SENTIMENT_URL || 'http://localhost:5000';
        this.isServiceRunning = false;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
        
        // Initialize service
        this.initializeService();
    }

    /**
     * Initialize the Python sentiment service
     */
    async initializeService() {
        try {
            // Check if service is already running
            const isRunning = await this.checkServiceHealth();
            
            if (isRunning) {
                logger.info('Python sentiment service is already running and healthy');
                this.isServiceRunning = true;
            } else {
                logger.warn('Python sentiment service is not running. Please start it manually by running: python app.py in the python-sentiment-service directory');
                this.isServiceRunning = false;
            }
        } catch (error) {
            logger.error('Failed to initialize Python sentiment service:', error);
            logger.warn('Python sentiment service is not available. Please start it manually.');
            this.isServiceRunning = false;
        }
    }

    /**
     * Check if the Python service should be restarted (for manual management)
     */
    async recheckServiceHealth() {
        const isRunning = await this.checkServiceHealth();
        this.isServiceRunning = isRunning;
        
        if (isRunning) {
            logger.info('Python sentiment service is now available');
        } else {
            logger.warn('Python sentiment service is still not available');
        }
        
        return isRunning;
    }

    /**
     * Check if the Python service is healthy
     */
    async checkServiceHealth() {
        try {
            const response = await axios.get(`${this.pythonServiceUrl}/health`, {
                timeout: 3000
            });
            return response.status === 200 && response.data.status === 'healthy';
        } catch (error) {
            return false;
        }
    }

    /**
     * Analyze sentiment for a single text using Python service
     */
    async analyzeSingleText(text, ticker = null, source = 'unknown', options = {}) {
        const cacheKey = `python-sentiment:single:${this.generateCacheKey([text], [ticker], source, options)}`;
        
        try {
            // Check cache first
            const cachedResult = await cacheManager.get(cacheKey);
            if (cachedResult) {
                logger.debug('Using cached Python sentiment result');
                return cachedResult;
            }

            // Require Python service to be running - no fallback
            if (!this.isServiceRunning) {
                throw new Error('Python sentiment service is not available. Real-time sentiment analysis requires the Python service to be running.');
            }

            const result = await this.callPythonService('/analyze/single', {
                text,
                ticker,
                source,
                options: {
                    use_finbert: true,
                    use_vader: true,
                    extract_entities: true,
                    confidence_threshold: 0.7,
                    ...options
                }
            });

            // Cache result
            await cacheManager.set(cacheKey, result, 1800); // 30 minutes
            return result;
        } catch (error) {
            logger.error('Error in Python sentiment analysis:', error);
            throw error; // Re-throw error instead of using fallback
        }
    }

    /**
     * Analyze sentiment for multiple texts using Python service
     */
    async analyzeBatchTexts(texts, tickers = [], source = 'unknown', options = {}) {
        const cacheKey = `python-sentiment:batch:${this.generateCacheKey(texts, tickers, source, options)}`;
        
        try {
            // Check cache first
            const cachedResult = await cacheManager.get(cacheKey);
            if (cachedResult) {
                logger.debug('Using cached Python batch sentiment result');
                return cachedResult;
            }

            // Require Python service to be running - no fallback
            if (!this.isServiceRunning) {
                throw new Error('Python sentiment service is not available. Real-time sentiment analysis requires the Python service to be running.');
            }

            const result = await this.callPythonService('/analyze', {
                texts,
                tickers,
                source,
                options: {
                    use_finbert: true,
                    use_vader: true,
                    extract_entities: true,
                    confidence_threshold: 0.7,
                    ...options
                }
            });

            // Cache result
            await cacheManager.set(cacheKey, result, 1800); // 30 minutes
            return result;
        } catch (error) {
            logger.error('Error in Python batch sentiment analysis:', error);
            throw error; // Re-throw error instead of using fallback
        }
    }

    /**
     * Call the Python service with retry logic
     */
    async callPythonService(endpoint, data, retryCount = 0) {
        try {
            const response = await axios.post(`${this.pythonServiceUrl}${endpoint}`, data, {
                timeout: 30000, // 30 seconds
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            if (retryCount < this.maxRetries) {
                logger.warn(`Python service call failed, retrying (${retryCount + 1}/${this.maxRetries})...`);
                await this.delay(this.retryDelay * (retryCount + 1));
                return this.callPythonService(endpoint, data, retryCount + 1);
            } else {
                throw error;
            }
        }
    }



    /**
     * Calculate summary for batch results
     */
    calculateBatchSummary(results) {
        if (!results || results.length === 0) {
            return {
                total_texts: 0,
                average_sentiment: { score: 0, label: 'neutral', confidence: 0 },
                sentiment_distribution: { bullish: 0, bearish: 0, neutral: 0 },
                quality_distribution: { high: 0, medium: 0, low: 0, very_low: 0 }
            };
        }

        const scores = results.map(r => r.sentiment.score);
        const confidences = results.map(r => r.sentiment.confidence);
        
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        
        const distribution = { bullish: 0, bearish: 0, neutral: 0 };
        results.forEach(r => {
            distribution[r.sentiment.label]++;
        });

        return {
            total_texts: results.length,
            average_sentiment: {
                score: Math.round(avgScore * 1000) / 1000,
                label: avgScore > 0.1 ? 'bullish' : avgScore < -0.1 ? 'bearish' : 'neutral',
                confidence: Math.round(avgConfidence * 1000) / 1000
            },
            sentiment_distribution: distribution,
            processing_timestamp: new Date().toISOString()
        };
    }

    /**
     * Generate cache key for sentiment analysis
     */
    generateCacheKey(texts, tickers, source, options) {
        const data = {
            texts: texts.sort(),
            tickers: (tickers || []).sort(),
            source,
            options: Object.keys(options).sort().reduce((obj, key) => {
                obj[key] = options[key];
                return obj;
            }, {})
        };
        
        return require('crypto')
            .createHash('sha256')
            .update(JSON.stringify(data))
            .digest('hex')
            .substring(0, 16);
    }

    /**
     * Get service status and statistics
     */
    async getServiceStatus() {
        try {
            const isHealthy = await this.checkServiceHealth();
            
            let pythonStats = null;
            if (isHealthy) {
                try {
                    const response = await axios.get(`${this.pythonServiceUrl}/models/info`, { timeout: 5000 });
                    pythonStats = response.data;
                } catch (error) {
                    logger.warn('Failed to get Python service model info:', error.message);
                }
            }

            return {
                python_service_running: this.isServiceRunning,
                python_service_healthy: isHealthy,
                python_service_url: this.pythonServiceUrl,
                model_info: pythonStats,
                last_check: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error getting service status:', error);
            return {
                python_service_running: false,
                python_service_healthy: false,
                error: error.message,
                last_check: new Date().toISOString()
            };
        }
    }



    /**
     * Utility function for delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new PythonSentimentService();