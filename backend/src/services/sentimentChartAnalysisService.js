const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getAiAnalysisWithCache } = require('./userAiAnalysisCacheService');

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ GEMINI_API_KEY not found - Sentiment chart AI analysis will be disabled');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Analyze sentiment chart data with caching
 */
async function analyzeTickerSentimentChart(chartData, userId, userTier = 'free', forceRefresh = false) {
  if (!userId) {
    return await generateChartAnalysis(chartData);
  }

  try {
    console.log(`🤖 [CHART ANALYSIS] Analyzing sentiment chart for ${chartData.tickers?.join(', ')} (user: ${userId})`);
    
    const analysisType = 'sentiment_chart_analysis';
    const tickers = chartData.tickers || ['UNKNOWN'];
    const timeRange = chartData.timeRange || '1w';
    
    // Use the caching service
    const result = await getAiAnalysisWithCache(
      userId,
      analysisType,
      tickers,
      timeRange,
      userTier,
      () => generateChartAnalysis(chartData),
      forceRefresh
    );
    
    if (result.success) {
      return {
        analysis: result.data,
        metadata: result.metadata
      };
    } else {
      console.error('❌ [CHART ANALYSIS] Cache service failed:', result.message);
      return await generateChartAnalysis(chartData);
    }
  } catch (error) {
    console.error('❌ [CHART ANALYSIS] Error in cached analysis:', error);
    return await generateChartAnalysis(chartData);
  }
}

/**
 * Generate fresh chart analysis (internal function)
 */
async function generateChartAnalysis(chartData) {
  if (!genAI) {
    console.warn('🤖 Gemini API not available - using fallback chart explanation');
    return {
      success: true,
      data: getFallbackChartExplanation(chartData),
      creditsUsed: 0
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Build context from chart data
    const context = buildChartContext(chartData);
    
    const prompt = `Analyze this sentiment chart data and provide insights:

${context}

Please provide a comprehensive 3-4 sentence analysis covering:
1. Overall sentiment trends and patterns across the time period
2. Key insights about the tickers being analyzed (momentum, volatility, correlations)
3. What the current sentiment data suggests about market sentiment and investor positioning
4. Actionable takeaways for investors regarding these tickers

Focus on identifying meaningful patterns, trend changes, and what the sentiment data reveals about market psychology for these specific stocks.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const explanation = response.text().trim();
    
    console.log(`✅ Chart AI analysis generated for ${chartData.tickers?.join(', ')} (${explanation.length} chars)`);
    
    return {
      success: true,
      data: explanation,
      creditsUsed: 1
    };
  } catch (error) {
    console.error('❌ Chart AI analysis error:', error.message);
    return {
      success: true,
      data: getFallbackChartExplanation(chartData),
      creditsUsed: 0
    };
  }
}

/**
 * Build context string from chart data
 */
function buildChartContext(data) {
  const {
    tickers = [],
    timeRange = '1w',
    dataPoints = [],
    totalDataPoints = 0,
    viewMode = 'ticker'
  } = data;

  let context = `Analysis Type: ${viewMode === 'ticker' ? 'Individual Ticker Analysis' : 'Market Overview'}\n`;
  context += `Tickers: ${tickers.join(', ')}\n`;
  context += `Time Range: ${timeRange}\n`;
  context += `Total Data Points: ${totalDataPoints}\n\n`;

  if (dataPoints && dataPoints.length > 0) {
    context += `Recent Sentiment Data:\n`;
    
    // Show the last 5-10 data points for context
    const recentPoints = dataPoints.slice(-Math.min(10, dataPoints.length));
    
    recentPoints.forEach(point => {
      if (point.timestamp && point.sentiment_score !== undefined) {
        const date = new Date(point.timestamp).toLocaleDateString();
        const score = parseFloat(point.sentiment_score).toFixed(2);
        const ticker = point.ticker || 'Unknown';
        context += `${date} - ${ticker}: ${score} (${getSentimentLabel(score)})\n`;
      }
    });
    
    // Calculate basic statistics
    const scores = dataPoints.map(p => parseFloat(p.sentiment_score)).filter(s => !isNaN(s));
    if (scores.length > 0) {
      const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
      const minScore = Math.min(...scores).toFixed(2);
      const maxScore = Math.max(...scores).toFixed(2);
      
      context += `\nSentiment Statistics:\n`;
      context += `Average Score: ${avgScore}\n`;
      context += `Range: ${minScore} to ${maxScore}\n`;
      context += `Data Volatility: ${(maxScore - minScore).toFixed(2)}\n`;
    }
  }

  return context;
}

/**
 * Get sentiment label from score
 */
function getSentimentLabel(score) {
  const numScore = parseFloat(score);
  if (numScore > 0.1) return 'Bullish';
  if (numScore < -0.1) return 'Bearish';
  return 'Neutral';
}

/**
 * Fallback explanation when AI is unavailable
 */
function getFallbackChartExplanation(data) {
  const { tickers = [], timeRange = '1w', totalDataPoints = 0 } = data;
  
  let explanation = `Sentiment analysis for ${tickers.join(', ')} over ${timeRange} period with ${totalDataPoints} data points. `;
  
  if (totalDataPoints > 100) {
    explanation += 'The substantial data volume provides reliable sentiment readings. ';
  } else if (totalDataPoints > 50) {
    explanation += 'Moderate data volume offers reasonable sentiment insights. ';
  } else {
    explanation += 'Limited data volume suggests these readings should be considered alongside other analysis. ';
  }
  
  explanation += `This ${timeRange === '1d' ? 'daily' : timeRange === '1w' ? 'weekly' : 'extended'} sentiment overview captures market psychology and investor positioning. `;
  explanation += 'Consider these sentiment trends as part of a comprehensive investment analysis framework.';
  
  return explanation;
}

/**
 * Analyze Reddit posts with caching
 */
async function analyzeRedditPosts(postsData, userId, userTier = 'free', forceRefresh = false) {
  if (!userId) {
    return await generateRedditAnalysis(postsData);
  }

  try {
    console.log(`🤖 [REDDIT ANALYSIS] Analyzing ${postsData.posts?.length || 0} Reddit posts (user: ${userId})`);
    
    const analysisType = 'reddit_post_analysis';
    const tickers = postsData.tickers || ['REDDIT'];
    const timeRange = postsData.timeRange || '1d';
    
    // Use the caching service
    const result = await getAiAnalysisWithCache(
      userId,
      analysisType,
      tickers,
      timeRange,
      userTier,
      () => generateRedditAnalysis(postsData),
      forceRefresh
    );
    
    if (result.success) {
      return {
        analysis: result.data,
        metadata: result.metadata
      };
    } else {
      console.error('❌ [REDDIT ANALYSIS] Cache service failed:', result.message);
      return await generateRedditAnalysis(postsData);
    }
  } catch (error) {
    console.error('❌ [REDDIT ANALYSIS] Error in cached analysis:', error);
    return await generateRedditAnalysis(postsData);
  }
}

/**
 * Generate fresh Reddit post analysis
 */
async function generateRedditAnalysis(postsData) {
  if (!genAI) {
    console.warn('🤖 Gemini API not available - using fallback Reddit explanation');
    return {
      success: true,
      data: getFallbackRedditExplanation(postsData),
      creditsUsed: 0
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const context = buildRedditContext(postsData);
    
    const prompt = `Analyze these Reddit posts about stocks and provide insights:

${context}

Please provide a 2-3 sentence analysis covering:
1. What the posts reveal about retail investor sentiment and concerns
2. Key themes, trends, or catalysts mentioned by the community
3. How this social sentiment might impact the mentioned stocks

Focus on extracting meaningful insights about market psychology from these social media discussions.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const explanation = response.text().trim();
    
    console.log(`✅ Reddit AI analysis generated (${explanation.length} chars)`);
    
    return {
      success: true,
      data: explanation,
      creditsUsed: 1
    };
  } catch (error) {
    console.error('❌ Reddit AI analysis error:', error.message);
    return {
      success: true,
      data: getFallbackRedditExplanation(postsData),
      creditsUsed: 0
    };
  }
}

/**
 * Build context from Reddit posts data
 */
function buildRedditContext(data) {
  const { posts = [], tickers = [], timeRange = '1d' } = data;
  
  let context = `Reddit Posts Analysis\n`;
  context += `Time Range: ${timeRange}\n`;
  context += `Mentioned Tickers: ${tickers.join(', ')}\n`;
  context += `Total Posts: ${posts.length}\n\n`;
  
  if (posts.length > 0) {
    context += `Sample Posts:\n`;
    
    // Show top 3-5 posts
    const samplePosts = posts.slice(0, Math.min(5, posts.length));
    
    samplePosts.forEach((post, index) => {
      if (post.title) {
        context += `${index + 1}. "${post.title}"`;
        if (post.score) context += ` (${post.score} upvotes)`;
        if (post.num_comments) context += ` (${post.num_comments} comments)`;
        context += '\n';
        
        // Add snippet of content if available
        if (post.selftext && post.selftext.length > 0) {
          const snippet = post.selftext.substring(0, 150);
          context += `   Content: ${snippet}${post.selftext.length > 150 ? '...' : ''}\n`;
        }
        context += '\n';
      }
    });
  }
  
  return context;
}

/**
 * Fallback explanation for Reddit analysis
 */
function getFallbackRedditExplanation(data) {
  const { posts = [], tickers = [] } = data;
  
  let explanation = `Analysis of ${posts.length} Reddit posts discussing ${tickers.join(', ')}. `;
  
  if (posts.length > 10) {
    explanation += 'Strong community engagement suggests active retail interest in these stocks. ';
  } else if (posts.length > 5) {
    explanation += 'Moderate community discussion indicates some retail sentiment around these tickers. ';
  } else {
    explanation += 'Limited social media discussion suggests lower retail engagement for these stocks. ';
  }
  
  explanation += 'Social sentiment can provide early indicators of retail investor behavior and market momentum shifts.';
  
  return explanation;
}

module.exports = {
  analyzeTickerSentimentChart,
  generateChartAnalysis,
  analyzeRedditPosts,
  generateRedditAnalysis
}; 