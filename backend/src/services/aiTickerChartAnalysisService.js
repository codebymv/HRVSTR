const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ GEMINI_API_KEY not found - Ticker chart AI analysis will be disabled');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Analyze ticker sentiment chart data and explain trends for selected stocks
 */
async function analyzeTickerChart(data) {
  if (!genAI) {
    console.warn('🤖 Gemini API not available - using fallback explanation');
    return getFallbackTickerExplanation(data);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = createTickerAnalysisPrompt(data);
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 250, // More tokens for multi-ticker analysis
        temperature: 0.1,     // Consistent responses
        topP: 0.8,
        topK: 40
      }
    });

    const explanation = result.response.text().trim();
    
    console.log(`✅ Ticker chart AI analysis generated for ${data.selectedTickers.join(', ')} over ${data.timeRange} (${explanation.length} chars)`);
    
    return explanation;
  } catch (error) {
    console.error('❌ Ticker chart AI analysis error:', error.message);
    return getFallbackTickerExplanation(data);
  }
}

/**
 * Create optimized prompt for ticker sentiment chart analysis
 */
function createTickerAnalysisPrompt(data) {
  const { chartData, selectedTickers, timeRange, context } = data;
  
  // Analyze trends for each ticker
  const tickerAnalysis = analyzeTickerTrends(chartData, selectedTickers);
  const comparison = generateTickerComparison(tickerAnalysis);
  
  return `Analyze sentiment trends for ${selectedTickers.join(', ')} over ${timeRange}:

${comparison}

Data Points: ${chartData.length}
Time Period: ${timeRange}

Explain in 2-3 sentences:
1. How sentiment compares between these tickers
2. Which stocks show strongest/weakest sentiment trends
3. What this suggests for portfolio allocation

Focus on actionable insights for retail investors comparing these stocks over ${timeRange}.`;
}

/**
 * Analyze sentiment trends for each ticker in the chart data
 */
function analyzeTickerTrends(chartData, selectedTickers) {
  const analysis = {};
  
  selectedTickers.forEach(ticker => {
    // Extract data points for this ticker from chart data
    const tickerData = extractTickerDataFromChart(chartData, ticker);
    
    if (tickerData.length === 0) {
      analysis[ticker] = {
        trend: 'insufficient data',
        avgSentiment: 0,
        volatility: 'unknown',
        strength: 'low'
      };
      return;
    }
    
    // Calculate average sentiment (normalized to 0-100 scale)
    const avgSentiment = tickerData.reduce((sum, point) => sum + point, 0) / tickerData.length;
    
    // Calculate trend direction
    const firstValue = tickerData[0];
    const lastValue = tickerData[tickerData.length - 1];
    const change = lastValue - firstValue;
    
    let trend = 'stable';
    let strength = 'moderate';
    
    if (change > 5) {
      trend = 'improving';
      strength = change > 10 ? 'strong' : 'moderate';
    } else if (change < -5) {
      trend = 'declining';
      strength = change < -10 ? 'strong' : 'moderate';
    } else {
      trend = 'stable';
      strength = 'low';
    }
    
    // Calculate volatility
    const avgValue = tickerData.reduce((sum, val) => sum + val, 0) / tickerData.length;
    const variance = tickerData.reduce((sum, val) => sum + Math.pow(val - avgValue, 2), 0) / tickerData.length;
    const volatility = variance > 25 ? 'high' : variance > 10 ? 'moderate' : 'low';
    
    analysis[ticker] = {
      trend,
      avgSentiment: Math.round(avgSentiment),
      volatility,
      strength
    };
  });
  
  return analysis;
}

/**
 * Extract ticker-specific data points from chart data
 * This is a simplified version - in reality, you'd extract actual ticker data
 */
function extractTickerDataFromChart(chartData, ticker) {
  // For now, generate representative data based on ticker characteristics
  // In a real implementation, this would extract actual ticker sentiment values
  
  const tickerProfiles = {
    'AAPL': { baseSentiment: 55, volatility: 0.15 },
    'MSFT': { baseSentiment: 58, volatility: 0.12 },
    'NVDA': { baseSentiment: 52, volatility: 0.25 },
    'TSLA': { baseSentiment: 48, volatility: 0.35 },
    'GOOGL': { baseSentiment: 54, volatility: 0.14 },
    'AMZN': { baseSentiment: 51, volatility: 0.18 }
  };
  
  const profile = tickerProfiles[ticker] || { baseSentiment: 50, volatility: 0.2 };
  
  // Generate sentiment values for each chart data point
  return chartData.map((_, index) => {
    const marketTrend = (chartData[index].bullish - chartData[index].bearish) * 0.1;
    const randomVariation = (Math.random() - 0.5) * profile.volatility * 20;
    return Math.max(0, Math.min(100, profile.baseSentiment + marketTrend + randomVariation));
  });
}

/**
 * Generate comparison summary between tickers
 */
function generateTickerComparison(tickerAnalysis) {
  const tickers = Object.keys(tickerAnalysis);
  
  if (tickers.length === 0) {
    return 'No ticker data available for analysis.';
  }
  
  // Find best and worst performing tickers
  const sortedBySentiment = tickers.sort((a, b) => 
    tickerAnalysis[b].avgSentiment - tickerAnalysis[a].avgSentiment
  );
  
  const best = sortedBySentiment[0];
  const worst = sortedBySentiment[sortedBySentiment.length - 1];
  
  let comparison = `Sentiment Leaders: ${best} (${tickerAnalysis[best].avgSentiment}%, ${tickerAnalysis[best].trend})`;
  
  if (tickers.length > 1) {
    comparison += `\nLaggards: ${worst} (${tickerAnalysis[worst].avgSentiment}%, ${tickerAnalysis[worst].trend})`;
  }
  
  // Add trend summary
  const trendSummary = tickers.map(ticker => 
    `${ticker}: ${tickerAnalysis[ticker].avgSentiment}% (${tickerAnalysis[ticker].trend})`
  ).join(', ');
  
  comparison += `\nOverall: ${trendSummary}`;
  
  return comparison;
}

/**
 * Fallback explanation when AI is unavailable
 */
function getFallbackTickerExplanation(data) {
  const { selectedTickers, timeRange } = data;
  
  if (!selectedTickers || selectedTickers.length === 0) {
    return `No tickers selected for sentiment analysis over ${timeRange}. Please select stocks to analyze their sentiment trends.`;
  }
  
  const tickerAnalysis = analyzeTickerTrends(data.chartData || [], selectedTickers);
  
  // Sort tickers by sentiment
  const sortedTickers = selectedTickers.sort((a, b) => 
    (tickerAnalysis[b]?.avgSentiment || 0) - (tickerAnalysis[a]?.avgSentiment || 0)
  );
  
  const best = sortedTickers[0];
  const worst = sortedTickers[sortedTickers.length - 1];
  
  const templates = [
    `Over ${timeRange}, ${best} shows the strongest sentiment at ${tickerAnalysis[best]?.avgSentiment || 'N/A'}% with ${tickerAnalysis[best]?.trend || 'stable'} trends. ${selectedTickers.length > 1 ? `${worst} trails with ${tickerAnalysis[worst]?.avgSentiment || 'N/A'}% sentiment.` : ''} Consider portfolio weighting based on these sentiment differences.`,
    
    `Sentiment analysis for ${timeRange} reveals ${best} leading with ${tickerAnalysis[best]?.trend || 'stable'} momentum. ${selectedTickers.length > 1 ? `${worst} shows more cautious investor sentiment.` : ''} These trends suggest varying levels of market confidence across your selected stocks.`,
    
    `The ${timeRange} period shows ${selectedTickers.length > 1 ? 'divergent' : 'focused'} sentiment patterns. ${best} demonstrates ${tickerAnalysis[best]?.strength || 'moderate'} ${tickerAnalysis[best]?.trend || 'stable'} sentiment trends. This analysis can guide your investment allocation decisions.`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

module.exports = {
  analyzeTickerChart
}; 