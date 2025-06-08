const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ GEMINI_API_KEY not found - Market AI analysis will be disabled');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Analyze market sentiment chart data and explain trends over time
 */
async function analyzeMarketChart(data) {
  if (!genAI) {
    console.warn('🤖 Gemini API not available - using fallback explanation');
    return getFallbackMarketExplanation(data);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = createMarketAnalysisPrompt(data);
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 200, // Slightly more for chart analysis
        temperature: 0.1,     // Consistent responses
        topP: 0.8,
        topK: 40
      }
    });

    const explanation = result.response.text().trim();
    
    console.log(`✅ Market chart AI analysis generated for ${data.timeRange} (${explanation.length} chars)`);
    
    return explanation;
  } catch (error) {
    console.error('❌ Market chart AI analysis error:', error.message);
    return getFallbackMarketExplanation(data);
  }
}

/**
 * Create optimized prompt for market sentiment chart analysis
 */
function createMarketAnalysisPrompt(data) {
  const { chartData, timeRange, context } = data;
  
  // Analyze chart trends
  const trends = analyzeChartTrends(chartData);
  const summary = generateChartSummary(chartData);
  
  return `Analyze this market sentiment chart over ${timeRange}:

Trend: ${trends.direction} (${trends.strength})
Overall: ${summary.avgBullish}% bullish, ${summary.avgNeutral}% neutral, ${summary.avgBearish}% bearish
Volatility: ${trends.volatility}
Data Points: ${chartData.length}

Explain in 2-3 sentences:
1. What the overall market sentiment trend shows
2. Key patterns or shifts in investor mood
3. What this suggests for market outlook

Focus on actionable insights for retail investors based on this ${timeRange} sentiment data.`;
}

/**
 * Analyze chart data for trends and patterns
 */
function analyzeChartTrends(chartData) {
  if (!chartData || chartData.length === 0) {
    return {
      direction: 'unclear',
      strength: 'low',
      volatility: 'unknown'
    };
  }
  
  // Calculate trend direction
  const first = chartData[0];
  const last = chartData[chartData.length - 1];
  
  const firstSentiment = first.bullish - first.bearish;
  const lastSentiment = last.bullish - last.bearish;
  
  const change = lastSentiment - firstSentiment;
  
  let direction = 'stable';
  let strength = 'moderate';
  
  if (change > 10) {
    direction = 'increasingly bullish';
    strength = change > 20 ? 'strong' : 'moderate';
  } else if (change < -10) {
    direction = 'increasingly bearish';
    strength = change < -20 ? 'strong' : 'moderate';
  } else {
    direction = 'stable';
    strength = 'low';
  }
  
  // Calculate volatility
  const sentimentValues = chartData.map(d => d.bullish - d.bearish);
  const avgSentiment = sentimentValues.reduce((sum, val) => sum + val, 0) / sentimentValues.length;
  const variance = sentimentValues.reduce((sum, val) => sum + Math.pow(val - avgSentiment, 2), 0) / sentimentValues.length;
  const volatility = variance > 100 ? 'high' : variance > 50 ? 'moderate' : 'low';
  
  return {
    direction,
    strength,
    volatility
  };
}

/**
 * Generate summary statistics for chart data
 */
function generateChartSummary(chartData) {
  if (!chartData || chartData.length === 0) {
    return {
      avgBullish: 0,
      avgNeutral: 0,
      avgBearish: 0
    };
  }
  
  const totals = chartData.reduce((acc, item) => ({
    bullish: acc.bullish + item.bullish,
    neutral: acc.neutral + item.neutral,
    bearish: acc.bearish + item.bearish
  }), { bullish: 0, neutral: 0, bearish: 0 });
  
  const count = chartData.length;
  
  return {
    avgBullish: Math.round(totals.bullish / count),
    avgNeutral: Math.round(totals.neutral / count),
    avgBearish: Math.round(totals.bearish / count)
  };
}

/**
 * Fallback explanation when AI is unavailable
 */
function getFallbackMarketExplanation(data) {
  const { chartData, timeRange } = data;
  
  if (!chartData || chartData.length === 0) {
    return `Market sentiment data for ${timeRange} shows insufficient data for comprehensive analysis. Consider checking back when more market activity is available.`;
  }
  
  const summary = generateChartSummary(chartData);
  const trends = analyzeChartTrends(chartData);
  
  const templates = {
    'increasingly bullish': [
      `Market sentiment has been ${trends.direction} over the ${timeRange} period, with ${summary.avgBullish}% bullish sentiment on average. This suggests growing investor confidence and potential upward market momentum.`,
      `The ${timeRange} chart shows ${trends.direction} sentiment trends with ${summary.avgBullish}% bullish readings. Investors appear increasingly optimistic about market conditions.`
    ],
    'increasingly bearish': [
      `Market sentiment has turned ${trends.direction} over ${timeRange}, averaging ${summary.avgBearish}% bearish sentiment. This indicates growing investor caution and potential market headwinds.`,
      `The ${timeRange} period shows ${trends.direction} sentiment with ${summary.avgBearish}% bearish readings on average. Market participants appear increasingly cautious.`
    ],
    'stable': [
      `Market sentiment has remained ${trends.direction} over ${timeRange} with balanced readings: ${summary.avgBullish}% bullish, ${summary.avgNeutral}% neutral, ${summary.avgBearish}% bearish. This suggests a period of market indecision.`,
      `The ${timeRange} chart shows ${trends.direction} sentiment patterns with no clear directional bias. Investors appear to be in a wait-and-see mode.`
    ]
  };
  
  const templateArray = templates[trends.direction] || templates.stable;
  return templateArray[Math.floor(Math.random() * templateArray.length)];
}

module.exports = {
  analyzeMarketChart
}; 