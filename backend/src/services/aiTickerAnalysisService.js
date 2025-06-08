const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getAiAnalysisWithCache } = require('./userAiAnalysisCacheService');

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ GEMINI_API_KEY not found - Ticker AI analysis will be disabled');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Analyze individual ticker sentiment data and explain the analysis (cached version)
 */
async function analyzeTickerSentiment(sentimentData, userId = null, userTier = 'free', forceRefresh = false) {
  // If no user provided, use original non-cached version
  if (!userId) {
    return await generateTickerAnalysis(sentimentData);
  }

  try {
    console.log(`🤖 [AI ANALYSIS] Analyzing ticker sentiment for ${sentimentData.ticker} (user: ${userId})`);
    
    const analysisType = 'ticker_sentiment_analysis';
    const tickers = [sentimentData.ticker];
    const timeRange = '1d'; // Default for single ticker analysis
    
    // Use the caching service
    const result = await getAiAnalysisWithCache(
      userId,
      analysisType,
      tickers,
      timeRange,
      userTier,
      () => generateTickerAnalysis(sentimentData),
      forceRefresh
    );
    
    if (result.success) {
      return {
        analysis: result.data,
        metadata: result.metadata
      };
    } else {
      console.error('❌ [AI ANALYSIS] Cache service failed:', result.message);
      return await generateTickerAnalysis(sentimentData);
    }
  } catch (error) {
    console.error('❌ [AI ANALYSIS] Error in cached analysis:', error);
    return await generateTickerAnalysis(sentimentData);
  }
}

/**
 * Generate fresh ticker analysis (internal function)
 */
async function generateTickerAnalysis(sentimentData) {
  if (!genAI) {
    console.warn('🤖 Gemini API not available - using fallback explanation');
    return { 
      success: true, 
      data: getFallbackExplanation(sentimentData),
      creditsUsed: 0
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Build context from sentiment data
    const context = buildSentimentContext(sentimentData);
    
    const prompt = `Analyze this stock sentiment data for ${sentimentData.ticker} and provide insights:

${context}

Please provide a concise 2-3 sentence analysis covering:
1. What the current sentiment score indicates about investor sentiment
2. Key factors driving this sentiment (data volume, source reliability, recent trends)
3. What this might mean for the stock's near-term outlook

Focus on actionable insights for investors and be specific about what makes this analysis bullish, bearish, or neutral.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const explanation = response.text().trim();
    
    console.log(`✅ Ticker AI analysis generated for ${sentimentData.ticker} (${explanation.length} chars)`);
    
    return {
      success: true,
      data: explanation,
      creditsUsed: 1
    };
  } catch (error) {
    console.error('❌ Ticker AI analysis error:', error.message);
    return {
      success: true,
      data: getFallbackExplanation(sentimentData),
      creditsUsed: 0
    };
  }
}

/**
 * Build context string from sentiment data
 */
function buildSentimentContext(data) {
  const {
    ticker,
    score,
    sentiment,
    source,
    confidence,
    postCount = 0,
    commentCount = 0,
    newsCount = 0,
    price,
    changePercent
  } = data;

  let context = `Ticker: ${ticker}\n`;
  context += `Sentiment Score: ${score} (${sentiment})\n`;
  context += `Data Source: ${source}\n`;
  
  if (confidence) {
    context += `Confidence Level: ${confidence}%\n`;
  }

  // Add data volume context
  if (source === 'reddit') {
    const totalActivity = postCount + commentCount;
    context += `Discussion Activity: ${totalActivity} total (${postCount} posts, ${commentCount} comments)\n`;
  } else if (source === 'finviz' || source === 'yahoo') {
    context += `News Coverage: ${newsCount} articles\n`;
  } else if (source === 'combined') {
    const discussions = postCount + commentCount;
    context += `Combined Data: ${discussions} discussions, ${newsCount} news articles\n`;
  }

  // Add price context if available
  if (price !== undefined && price !== null) {
    context += `Current Price: $${price}`;
    if (changePercent !== undefined && changePercent !== null) {
      context += ` (${changePercent >= 0 ? '+' : ''}${changePercent}%)`;
    }
    context += '\n';
  }

  return context;
}

/**
 * Fallback explanation when AI is unavailable
 */
function getFallbackExplanation(data) {
  const { ticker, score, sentiment, source, confidence } = data;
  
  let explanation = `${ticker} shows ${sentiment} sentiment with a score of ${score}. `;
  
  if (source === 'reddit') {
    explanation += 'This assessment is based on social media discussions and community sentiment. ';
  } else if (source === 'finviz' || source === 'yahoo') {
    explanation += 'This assessment is based on financial news analysis and market coverage. ';
  } else if (source === 'combined') {
    explanation += 'This assessment combines multiple data sources including social media and financial news. ';
  }
  
  if (confidence) {
    if (confidence >= 70) {
      explanation += `The high confidence level (${confidence}%) suggests this sentiment reading is reliable for investment consideration.`;
    } else if (confidence >= 50) {
      explanation += `The moderate confidence level (${confidence}%) suggests this sentiment should be considered alongside other factors.`;
    } else {
      explanation += `The lower confidence level (${confidence}%) suggests this sentiment should be interpreted with caution.`;
    }
  } else {
    explanation += 'Consider this sentiment alongside other fundamental and technical analysis for investment decisions.';
  }
  
  return explanation;
}

module.exports = {
  analyzeTickerSentiment,
  generateTickerAnalysis
}; 