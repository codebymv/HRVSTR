/**
 * AI Explanation Service
 * Generates human-readable explanations for sentiment data using Google Gemini Flash
 * Implements smart caching and fallback patterns for cost optimization
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIExplanationService {
  constructor() {
    this.genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
    this.model = null;
    this.cache = new Map(); // Simple in-memory cache
    this.requestCount = 0;
    this.maxCacheSize = 1000;
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    
    if (this.genAI) {
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      console.log('✅ AI Explanation Service initialized with Gemini Flash');
    } else {
      console.log('⚠️ AI Explanation Service initialized without API key - will use fallback explanations');
    }
  }

  /**
   * Generate explanation for sentiment data
   * @param {Object} sentimentData - The sentiment data object
   * @returns {Promise<string>} - Human-readable explanation
   */
  async explainSentiment(sentimentData) {
    try {
      // Input validation
      if (!sentimentData || !sentimentData.ticker) {
        return this.getFallbackExplanation(sentimentData);
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(sentimentData);
      const cached = this.getCachedExplanation(cacheKey);
      if (cached) {
        console.log(`📦 Using cached AI explanation for ${sentimentData.ticker}`);
        return cached;
      }

      // Try AI generation
      if (this.model) {
        const explanation = await this.generateAIExplanation(sentimentData);
        if (explanation) {
          this.setCachedExplanation(cacheKey, explanation);
          return explanation;
        }
      }

      // Fallback to template-based explanation
      return this.getFallbackExplanation(sentimentData);

    } catch (error) {
      console.error('❌ Error generating AI explanation:', error);
      return this.getFallbackExplanation(sentimentData);
    }
  }

  /**
   * Generate AI explanation using Gemini Flash
   * @param {Object} sentimentData - The sentiment data
   * @returns {Promise<string|null>} - AI-generated explanation or null
   */
  async generateAIExplanation(sentimentData) {
    try {
      const prompt = this.createOptimizedPrompt(sentimentData);
      
      console.log(`🤖 Generating AI explanation for ${sentimentData.ticker}...`);
      this.requestCount++;
      
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 150, // Keep responses short to minimize costs
          temperature: 0.1,     // Consistent responses
          topP: 0.8,
          topK: 40
        }
      });

      const explanation = result.response.text().trim();
      
      if (explanation && explanation.length > 10) {
        console.log(`✅ AI explanation generated for ${sentimentData.ticker} (${explanation.length} chars)`);
        return explanation;
      }

      return null;

    } catch (error) {
      console.error('❌ Gemini API error:', error);
      return null;
    }
  }

  /**
   * Create optimized prompt for cost efficiency
   * @param {Object} sentimentData - The sentiment data
   * @returns {string} - Optimized prompt
   */
  createOptimizedPrompt(sentimentData) {
    const {
      ticker,
      score = 0,
      source,
      confidence = 0,
      postCount = 0,
      commentCount = 0,
      newsCount = 0,
      strength = 0
    } = sentimentData;

    // Keep prompt concise to minimize input token costs
    const sentiment = score > 0.15 ? 'bullish' : score < -0.15 ? 'bearish' : 'neutral';
    const sources = source === 'combined' ? 'multiple sources' : source;
    const dataVolume = postCount + commentCount + (newsCount || 0);

    return `${ticker}: ${sentiment} sentiment (${score.toFixed(2)}) from ${sources}, ${dataVolume} data points, ${confidence}% confidence. Explain why in 1-2 sentences for retail investors.`;
  }

  /**
   * Generate fallback explanation using templates
   * @param {Object} sentimentData - The sentiment data
   * @returns {string} - Template-based explanation
   */
  getFallbackExplanation(sentimentData) {
    if (!sentimentData || !sentimentData.ticker) {
      return 'Unable to analyze sentiment due to insufficient data.';
    }

    const {
      ticker,
      score = 0,
      source,
      postCount = 0,
      commentCount = 0,
      newsCount = 0,
      confidence = 0
    } = sentimentData;

    const sentiment = score > 0.15 ? 'bullish' : score < -0.15 ? 'bearish' : 'neutral';
    const dataVolume = postCount + commentCount + (newsCount || 0);
    
    // Template-based explanations
    const templates = {
      bullish: [
        `${ticker} shows ${sentiment} sentiment based on positive discussions across ${source}. ${dataVolume > 0 ? `With ${dataVolume} data points, ` : ''}investor optimism appears to be driving positive sentiment.`,
        `${ticker} sentiment is ${sentiment} with a score of ${score.toFixed(2)}. ${source === 'reddit' ? 'Social media discussions' : 'News analysis'} indicates positive investor mood.`
      ],
      bearish: [
        `${ticker} exhibits ${sentiment} sentiment with concerns reflected in recent ${source} activity. ${dataVolume > 0 ? `${dataVolume} discussions ` : ''}Market participants appear cautious.`,
        `${ticker} sentiment is ${sentiment} (${score.toFixed(2)}) suggesting investor pessimism based on ${source} analysis.`
      ],
      neutral: [
        `${ticker} shows ${sentiment} sentiment with mixed signals from ${source}. ${dataVolume > 0 ? `${dataVolume} data points ` : ''}Investors appear undecided.`,
        `${ticker} sentiment is ${sentiment} indicating balanced investor opinion with no clear directional bias.`
      ]
    };

    const templateArray = templates[sentiment] || templates.neutral;
    const randomTemplate = templateArray[Math.floor(Math.random() * templateArray.length)];
    
    return randomTemplate;
  }

  /**
   * Generate cache key for sentiment data
   * @param {Object} sentimentData - The sentiment data
   * @returns {string} - Cache key
   */
  generateCacheKey(sentimentData) {
    const {
      ticker,
      score,
      source,
      postCount = 0,
      commentCount = 0,
      newsCount = 0
    } = sentimentData;

    // Create hash of key parameters
    const dataHash = Math.round(score * 100) + (postCount + commentCount + newsCount);
    return `${ticker}-${source}-${dataHash}`;
  }

  /**
   * Get cached explanation
   * @param {string} key - Cache key
   * @returns {string|null} - Cached explanation or null
   */
  getCachedExplanation(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.explanation;
    }
    if (cached) {
      this.cache.delete(key); // Remove expired cache
    }
    return null;
  }

  /**
   * Set cached explanation
   * @param {string} key - Cache key
   * @param {string} explanation - Explanation to cache
   */
  setCachedExplanation(key, explanation) {
    // Manage cache size
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < Math.floor(this.maxCacheSize * 0.1); i++) {
        this.cache.delete(entries[i][0]);
      }
    }

    this.cache.set(key, {
      explanation,
      timestamp: Date.now()
    });
  }

  /**
   * Get service statistics
   * @returns {Object} - Service stats
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      cacheSize: this.cache.size,
      hasApiKey: !!this.genAI,
      model: this.model ? 'gemini-1.5-flash' : 'fallback-templates'
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 AI explanation cache cleared');
  }
}

// Export singleton instance
module.exports = new AIExplanationService(); 