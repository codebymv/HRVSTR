/**
 * Enhanced Sentiment Controller
 * Integrates both basic sentiment analysis and advanced Python-based sentiment analysis
 * Routes high-value requests to Python service while maintaining existing functionality
 */

const pythonSentimentService = require('../services/pythonSentimentService');
const aggregatedSentimentService = require('../services/aggregatedSentimentService');
const redditSentimentService = require('../services/redditSentimentService');
const cacheManager = require('../utils/cacheManager');
const logger = require('../utils/logger');
const { validateTicker } = require('../utils/validation');
const rateLimit = require('../middleware/rateLimit');

class EnhancedSentimentController {
    constructor() {
        this.requestCostThreshold = {
            basic: 1,      // Basic requests (1 credit)
            enhanced: 3,   // Enhanced requests (3 credits)
            premium: 5     // Premium requests (5 credits)
        };
    }

    /**
     * Get enhanced sentiment analysis for a ticker
     * Uses Python service for high-value requests
     */
    async getEnhancedTickerSentiment(req, res) {
        try {
            const { ticker } = req.params;
            const { 
                enhanced = false, 
                sources = 'all',
                timeframe = '24h',
                confidence_threshold = 0.7,
                use_finbert = true,
                extract_entities = true
            } = req.query;

            // Validate ticker
            if (!validateTicker(ticker)) {
                return res.status(400).json({
                    error: 'Invalid ticker format',
                    message: 'Ticker must be 1-5 uppercase letters'
                });
            }

            // Determine analysis type and cost
            const analysisType = enhanced === 'true' || enhanced === true ? 'enhanced' : 'basic';
            const creditCost = this.requestCostThreshold[analysisType];

            // Check user credits (if authentication is implemented)
            // const userCredits = await this.checkUserCredits(req.user?.id);
            // if (userCredits < creditCost) {
            //     return res.status(402).json({ error: 'Insufficient credits' });
            // }

            const cacheKey = `enhanced-sentiment:${ticker}:${analysisType}:${timeframe}:${sources}`;
            
            // Check cache first
            const cachedResult = await cacheManager.get(cacheKey);
            if (cachedResult) {
                logger.debug(`Using cached enhanced sentiment for ${ticker}`);
                return res.json({
                    ...cachedResult,
                    cached: true,
                    credit_cost: creditCost
                });
            }

            let sentimentData;

            if (analysisType === 'enhanced') {
                // Use Python service for enhanced analysis
                sentimentData = await this.getEnhancedSentimentData(ticker, {
                    sources,
                    timeframe,
                    confidence_threshold: parseFloat(confidence_threshold),
                    use_finbert: use_finbert === 'true',
                    extract_entities: extract_entities === 'true'
                });
            } else {
                // Use existing basic sentiment analysis
                sentimentData = await aggregatedSentimentService.getTickerSentiment(ticker, timeframe);
                sentimentData = this.formatBasicSentimentResponse(sentimentData, ticker);
            }

            // Cache the result
            const cacheTime = analysisType === 'enhanced' ? 1800 : 900; // 30min for enhanced, 15min for basic
            await cacheManager.set(cacheKey, sentimentData, cacheTime);

            // Deduct credits (if authentication is implemented)
            // await this.deductUserCredits(req.user?.id, creditCost);

            res.json({
                ...sentimentData,
                cached: false,
                credit_cost: creditCost,
                analysis_type: analysisType
            });

        } catch (error) {
            logger.error('Error in enhanced ticker sentiment analysis:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to analyze ticker sentiment'
            });
        }
    }

    /**
     * Compare sentiment between multiple tickers using enhanced analysis
     */
    async compareEnhancedTickerSentiment(req, res) {
        try {
            const { tickers } = req.body;
            const { 
                enhanced = false,
                timeframe = '24h',
                confidence_threshold = 0.7,
                max_tickers = 5
            } = req.query;

            // Validate input
            if (!Array.isArray(tickers) || tickers.length === 0) {
                return res.status(400).json({
                    error: 'Invalid input',
                    message: 'Tickers must be a non-empty array'
                });
            }

            if (tickers.length > max_tickers) {
                return res.status(400).json({
                    error: 'Too many tickers',
                    message: `Maximum ${max_tickers} tickers allowed for comparison`
                });
            }

            // Validate all tickers
            const invalidTickers = tickers.filter(ticker => !validateTicker(ticker));
            if (invalidTickers.length > 0) {
                return res.status(400).json({
                    error: 'Invalid tickers',
                    message: `Invalid ticker format: ${invalidTickers.join(', ')}`
                });
            }

            const analysisType = enhanced === 'true' || enhanced === true ? 'enhanced' : 'basic';
            const creditCost = this.requestCostThreshold[analysisType] * tickers.length;

            const cacheKey = `enhanced-compare:${tickers.sort().join(',')}:${analysisType}:${timeframe}`;
            
            // Check cache
            const cachedResult = await cacheManager.get(cacheKey);
            if (cachedResult) {
                return res.json({
                    ...cachedResult,
                    cached: true,
                    credit_cost: creditCost
                });
            }

            // Analyze each ticker
            const tickerAnalyses = [];
            for (const ticker of tickers) {
                try {
                    let sentimentData;
                    
                    if (analysisType === 'enhanced') {
                        sentimentData = await this.getEnhancedSentimentData(ticker, {
                            timeframe,
                            confidence_threshold: parseFloat(confidence_threshold)
                        });
                    } else {
                        sentimentData = await aggregatedSentimentService.getTickerSentiment(ticker, timeframe);
                        sentimentData = this.formatBasicSentimentResponse(sentimentData, ticker);
                    }
                    
                    tickerAnalyses.push({
                        ticker,
                        sentiment: sentimentData.sentiment,
                        analysis: sentimentData.analysis,
                        success: true
                    });
                } catch (error) {
                    logger.error(`Error analyzing ${ticker}:`, error);
                    tickerAnalyses.push({
                        ticker,
                        error: 'Analysis failed',
                        success: false
                    });
                }
            }

            // Calculate comparison metrics
            const comparison = this.calculateTickerComparison(tickerAnalyses);
            
            const result = {
                tickers: tickerAnalyses,
                comparison,
                metadata: {
                    analysis_type: analysisType,
                    timeframe,
                    total_tickers: tickers.length,
                    successful_analyses: tickerAnalyses.filter(t => t.success).length,
                    timestamp: new Date().toISOString()
                }
            };

            // Cache result
            await cacheManager.set(cacheKey, result, 1200); // 20 minutes

            res.json({
                ...result,
                cached: false,
                credit_cost: creditCost
            });

        } catch (error) {
            logger.error('Error in enhanced ticker comparison:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to compare ticker sentiments'
            });
        }
    }

    /**
     * Analyze custom text with enhanced sentiment analysis
     */
    async analyzeCustomText(req, res) {
        try {
            const { text, ticker, source = 'custom' } = req.body;
            const { 
                enhanced = true,
                confidence_threshold = 0.7,
                extract_entities = true,
                use_finbert = true
            } = req.query;

            // Validate input
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                return res.status(400).json({
                    error: 'Invalid input',
                    message: 'Text is required and must be a non-empty string'
                });
            }

            if (text.length > 5000) {
                return res.status(400).json({
                    error: 'Text too long',
                    message: 'Text must be less than 5000 characters'
                });
            }

            if (ticker && !validateTicker(ticker)) {
                return res.status(400).json({
                    error: 'Invalid ticker format',
                    message: 'Ticker must be 1-5 uppercase letters'
                });
            }

            const analysisType = enhanced === 'true' || enhanced === true ? 'enhanced' : 'basic';
            const creditCost = this.requestCostThreshold[analysisType];

            let result;

            if (analysisType === 'enhanced') {
                // Use Python service for enhanced analysis
                result = await pythonSentimentService.analyzeSingleText(text, ticker, source, {
                    confidence_threshold: parseFloat(confidence_threshold),
                    extract_entities: extract_entities === 'true',
                    use_finbert: use_finbert === 'true',
                    use_vader: true
                });
            } else {
                // Use basic sentiment analysis
                const basicSentiment = require('../utils/sentiment');
                const basicResult = basicSentiment.analyzeSentiment(text);
                result = this.formatBasicSentimentResponse({ sentiment: basicResult }, ticker);
            }

            res.json({
                ...result,
                metadata: {
                    ...result.metadata,
                    analysis_type: analysisType,
                    credit_cost: creditCost,
                    custom_analysis: true
                }
            });

        } catch (error) {
            logger.error('Error in custom text analysis:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to analyze custom text'
            });
        }
    }

    /**
     * Get service status and model information
     */
    async getServiceStatus(req, res) {
        try {
            const pythonStatus = await pythonSentimentService.getServiceStatus();
            
            const status = {
                enhanced_sentiment_available: pythonStatus.python_service_healthy,
                basic_sentiment_available: true,
                python_service: pythonStatus,
                cache_status: await cacheManager.getStats(),
                supported_analysis_types: ['basic', 'enhanced'],
                credit_costs: this.requestCostThreshold,
                system_health: pythonStatus.python_service_healthy ? 'healthy' : 'degraded',
                timestamp: new Date().toISOString()
            };

            res.json(status);
        } catch (error) {
            logger.error('Error getting service status:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to get service status'
            });
        }
    }

    /**
     * Get enhanced sentiment data using Python service and existing services
     */
    async getEnhancedSentimentData(ticker, options = {}) {
        const {
            sources = 'all',
            timeframe = '24h',
            confidence_threshold = 0.7,
            use_finbert = true,
            extract_entities = true
        } = options;

        try {
            // Get data from multiple sources
            const [redditData, basicSentiment] = await Promise.allSettled([
                redditSentimentService.getRedditSentiment(ticker, { timeframe }),
                aggregatedSentimentService.getTickerSentiment(ticker, timeframe)
            ]);

            // Collect texts for Python analysis
            const textsToAnalyze = [];
            const textSources = [];

            // Add Reddit posts if available
            if (redditData.status === 'fulfilled' && redditData.value?.posts) {
                redditData.value.posts.forEach(post => {
                    if (post.title) {
                        textsToAnalyze.push(post.title);
                        textSources.push('reddit_title');
                    }
                    if (post.selftext && post.selftext.length > 10) {
                        textsToAnalyze.push(post.selftext.substring(0, 1000)); // Limit length
                        textSources.push('reddit_content');
                    }
                });
            }

            // Limit to most recent/relevant texts to manage costs
            const maxTexts = 20;
            const limitedTexts = textsToAnalyze.slice(0, maxTexts);
            const limitedSources = textSources.slice(0, maxTexts);

            let enhancedAnalysis = null;
            if (limitedTexts.length > 0) {
                // Use Python service for enhanced analysis
                enhancedAnalysis = await pythonSentimentService.analyzeBatchTexts(
                    limitedTexts,
                    new Array(limitedTexts.length).fill(ticker),
                    'mixed',
                    {
                        confidence_threshold,
                        use_finbert,
                        extract_entities,
                        use_vader: true
                    }
                );
            }

            // Combine results
            const result = {
                ticker,
                sentiment: this.combineEnhancedSentiment(enhancedAnalysis, basicSentiment.value),
                analysis: {
                    enhanced_analysis: enhancedAnalysis !== null,
                    texts_analyzed: limitedTexts.length,
                    sources_used: [...new Set(limitedSources)],
                    confidence_threshold,
                    timeframe,
                    processing_timestamp: new Date().toISOString()
                },
                sources: {
                    reddit: redditData.status === 'fulfilled' ? redditData.value : null,
                    basic_sentiment: basicSentiment.status === 'fulfilled' ? basicSentiment.value : null
                },
                enhanced_results: enhancedAnalysis,
                metadata: {
                    analysis_version: '2.0.0-enhanced',
                    model_info: enhancedAnalysis?.summary || null,
                    fallback_used: enhancedAnalysis === null
                }
            };

            return result;
        } catch (error) {
            logger.error('Error in enhanced sentiment data collection:', error);
            throw error;
        }
    }

    /**
     * Combine enhanced Python analysis with basic sentiment
     */
    combineEnhancedSentiment(enhancedAnalysis, basicSentiment) {
        if (!enhancedAnalysis || !enhancedAnalysis.summary) {
            // Fallback to basic sentiment
            return {
                score: basicSentiment?.sentiment?.score || 0,
                label: basicSentiment?.sentiment?.sentiment || 'neutral',
                confidence: basicSentiment?.sentiment?.confidence || 0.5,
                strength: 'moderate',
                quality: 'basic',
                source: 'fallback'
            };
        }

        const enhanced = enhancedAnalysis.summary.average_sentiment;
        const basic = basicSentiment?.sentiment;

        // Weight enhanced analysis more heavily
        const enhancedWeight = 0.7;
        const basicWeight = 0.3;

        const combinedScore = basic ? 
            (enhanced.score * enhancedWeight + basic.score * basicWeight) :
            enhanced.score;

        const combinedConfidence = basic ?
            (enhanced.confidence * enhancedWeight + basic.confidence * basicWeight) :
            enhanced.confidence;

        return {
            score: Math.round(combinedScore * 1000) / 1000,
            label: enhanced.label,
            confidence: Math.round(combinedConfidence * 1000) / 1000,
            strength: Math.abs(combinedScore) > 0.6 ? 'strong' : 
                     Math.abs(combinedScore) > 0.3 ? 'moderate' : 'weak',
            quality: 'enhanced',
            source: 'combined',
            distribution: enhancedAnalysis.summary.sentiment_distribution
        };
    }

    /**
     * Format basic sentiment response to match enhanced format
     */
    formatBasicSentimentResponse(sentimentData, ticker) {
        return {
            ticker,
            sentiment: {
                score: sentimentData.sentiment?.score || 0,
                label: sentimentData.sentiment?.sentiment || 'neutral',
                confidence: sentimentData.sentiment?.confidence || 0.5,
                strength: 'moderate',
                quality: 'basic',
                source: 'basic'
            },
            analysis: {
                enhanced_analysis: false,
                processing_timestamp: new Date().toISOString()
            },
            metadata: {
                analysis_version: '1.0.0-basic',
                fallback_used: false
            }
        };
    }

    /**
     * Calculate comparison metrics between tickers
     */
    calculateTickerComparison(tickerAnalyses) {
        const successful = tickerAnalyses.filter(t => t.success);
        
        if (successful.length === 0) {
            return { error: 'No successful analyses to compare' };
        }

        const scores = successful.map(t => t.sentiment.score);
        const confidences = successful.map(t => t.sentiment.confidence);

        // Find most/least bullish
        const mostBullish = successful.reduce((prev, current) => 
            (current.sentiment.score > prev.sentiment.score) ? current : prev
        );
        
        const mostBearish = successful.reduce((prev, current) => 
            (current.sentiment.score < prev.sentiment.score) ? current : prev
        );

        return {
            most_bullish: {
                ticker: mostBullish.ticker,
                score: mostBullish.sentiment.score,
                confidence: mostBullish.sentiment.confidence
            },
            most_bearish: {
                ticker: mostBearish.ticker,
                score: mostBearish.sentiment.score,
                confidence: mostBearish.sentiment.confidence
            },
            average_sentiment: {
                score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 1000) / 1000,
                confidence: Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 1000) / 1000
            },
            sentiment_range: {
                min: Math.min(...scores),
                max: Math.max(...scores),
                spread: Math.max(...scores) - Math.min(...scores)
            },
            consensus: scores.every(s => s > 0.1) ? 'bullish' :
                      scores.every(s => s < -0.1) ? 'bearish' : 'mixed'
        };
    }
}

module.exports = new EnhancedSentimentController();