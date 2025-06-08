const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ GEMINI_API_KEY not found - Reddit AI analysis will be disabled');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Analyze a Reddit post and explain its sentiment contribution
 */
async function analyzeRedditPost(post) {
  if (!genAI) {
    console.warn('🤖 Gemini API not available - using fallback explanation');
    return getFallbackExplanation(post);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Analyze this Reddit post from r/${post.subreddit} and explain:
1. What the post is saying (summarize the main points)
2. How this contributes to overall market sentiment for any mentioned stocks/tickers
3. Whether this represents bullish, bearish, or neutral sentiment and why

Post Title: "${post.title}"
Post Content: "${post.content}"
Upvotes: ${post.upvotes}
Comments: ${post.commentCount}

Provide a concise 2-3 sentence analysis focusing on the sentiment implications for financial markets. Be specific about what makes this bullish/bearish/neutral.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const explanation = response.text().trim();
    
    console.log(`✅ Reddit AI analysis generated for post "${post.title.substring(0, 50)}..." (${explanation.length} chars)`);
    
    return explanation;
  } catch (error) {
    console.error('❌ Reddit AI analysis error:', error.message);
    return getFallbackExplanation(post);
  }
}

/**
 * Fallback explanation when AI is unavailable
 */
function getFallbackExplanation(post) {
  // Determine basic sentiment based on keywords
  const content = `${post.title} ${post.content}`.toLowerCase();
  const bullishKeywords = ['bull', 'buy', 'calls', 'moon', 'rocket', 'pump', 'gains', 'rise', 'up'];
  const bearishKeywords = ['bear', 'sell', 'puts', 'crash', 'dump', 'fall', 'down', 'short'];
  
  const bullishCount = bullishKeywords.filter(word => content.includes(word)).length;
  const bearishCount = bearishKeywords.filter(word => content.includes(word)).length;
  
  let sentiment = 'neutral';
  let sentimentReason = 'mixed or unclear signals';
  
  if (bullishCount > bearishCount) {
    sentiment = 'bullish';
    sentimentReason = 'positive language and optimistic outlook';
  } else if (bearishCount > bullishCount) {
    sentiment = 'bearish';
    sentimentReason = 'negative language and pessimistic outlook';
  }
  
  const engagementLevel = post.upvotes > 50 ? 'high' : post.upvotes > 10 ? 'moderate' : 'low';
  
  return `This post from r/${post.subreddit} expresses ${sentiment} sentiment based on ${sentimentReason}. With ${post.upvotes} upvotes and ${post.commentCount} comments, it shows ${engagementLevel} community engagement, contributing to the overall ${sentiment} sentiment calculation for any mentioned stocks.`;
}

module.exports = {
  analyzeRedditPost
}; 