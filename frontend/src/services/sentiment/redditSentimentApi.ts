import { SentimentData, RedditPost } from '../../types';
import { TimeRange, buildApiUrl, handleApiResponse, getAuthHeaders } from '../shared/apiUtils';
import { fetchRedditPosts as fetchRedditPostsReal } from '../redditClient';

/**
 * Fetch per-ticker sentiment scores aggregated across recent posts.
 * Returns an array of SentimentData (one per ticker) ordered by backend.
 */
export const fetchTickerSentiments = async (timeRange: TimeRange = '1w', signal?: AbortSignal): Promise<SentimentData[]> => {
  try {
    console.log(`[REDDIT API DEBUG] Starting fetchTickerSentiments call for timeRange: ${timeRange}`);
    const url = buildApiUrl(`/api/sentiment/reddit/tickers?timeRange=${timeRange}`);
    console.log(`[REDDIT API DEBUG] Making request to: ${url}`);

    const headers = getAuthHeaders();
    console.log(`[REDDIT API DEBUG] Using auth token: ${headers['Authorization'] ? 'Present' : 'Missing'}`);

    const response = await fetch(url, { signal, headers });

    console.log(`[REDDIT API DEBUG] Response status: ${response.status}`);
    console.log(`[REDDIT API DEBUG] Response headers:`, response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[REDDIT API ERROR] ${response.status}: ${errorText}`);
      throw new Error(`Proxy server returned error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[REDDIT API DEBUG] Response data:`, data);
    
    // Check if sentimentData exists and is an array
    if (!data || !data.sentimentData || !Array.isArray(data.sentimentData)) {
      console.warn('[REDDIT API WARNING] Unexpected response format from ticker sentiment API:', data);
      return []; // Return empty array instead of throwing
    }
    
    // 🔧 FIX: Add additional validation and logging
    const sentimentArray = data.sentimentData as SentimentData[];
    console.log(`[REDDIT API DEBUG] Successfully received ${sentimentArray.length} sentiment items`);
    
    // 🔧 FIX: Validate each item has required fields
    const validatedData = sentimentArray.filter((item, index) => {
      const isValid = item && 
                     typeof item.ticker === 'string' && 
                     typeof item.score === 'number' && 
                     typeof item.sentiment === 'string' &&
                     typeof item.source === 'string';
      
      if (!isValid) {
        console.warn(`[REDDIT API WARNING] Invalid sentiment item at index ${index}:`, item);
        return false;
      }
      
      console.log(`[REDDIT API DEBUG] Valid sentiment item: ${item.ticker} - score: ${item.score}, confidence: ${item.confidence}`);
      return true;
    });
    
    console.log(`[REDDIT API DEBUG] Returning ${validatedData.length} validated sentiment items`);
    
    return validatedData;
  } catch (error) {
    console.error('[REDDIT API ERROR] Ticker sentiment API error:', error);
    console.error('[REDDIT API ERROR] Error type:', typeof error);
    console.error('[REDDIT API ERROR] Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[REDDIT API ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    // 🔧 FIX: Return empty array but also log this as a critical issue
    console.error('[REDDIT API ERROR] CRITICAL: Returning empty array due to API failure');
    return []; // Return empty array instead of throwing
  }
};

/**
 * Fetch sentiment data from Reddit API - no fallbacks
 * @throws {Error} When the API returns an error or unexpected format
 */
export const fetchSentimentData = async (timeRange: TimeRange = '1w', signal?: AbortSignal): Promise<SentimentData[]> => {
  try {
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Starting fetchSentimentData for timeRange: ${timeRange}`);
    
    const url = buildApiUrl(`/api/sentiment/reddit/market?timeRange=${timeRange}`);
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Making request to: ${url}`);
    
    const headers = getAuthHeaders();
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Using auth token for market sentiment: ${headers['Authorization'] ? 'Present' : 'Missing'}`);
    
    const response = await fetch(url, { signal, headers });
    
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Response status: ${response.status}`);
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Response headers:`, response.headers);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[REDDIT MARKET SENTIMENT ERROR] API error ${response.status}: ${errorText}`);
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`[REDDIT MARKET SENTIMENT DEBUG] Response data:`, data);
    
    // Validate the response contains the expected data structure
    if (!data) {
      console.error('[REDDIT MARKET SENTIMENT ERROR] Empty response from sentiment API');
      throw new Error('Empty response from sentiment API');
    }
    
    // Handle time series format with timestamps, bullish, bearish, neutral arrays
    if (data.timestamps && Array.isArray(data.timestamps) && 
        data.bullish && Array.isArray(data.bullish) &&
        data.bearish && Array.isArray(data.bearish) &&
        data.neutral && Array.isArray(data.neutral)) {
      
      console.log('=== REDDIT MARKET SENTIMENT BREAKDOWN ===');
      console.log('Timestamps:', data.timestamps);
      console.log('Bullish percentages:', data.bullish);
      console.log('Bearish percentages:', data.bearish);
      console.log('Neutral percentages:', data.neutral);
      console.log('Total counts:', data.total);
      
      const sentimentData: SentimentData[] = [];
      
      // Create a sentiment data point for each timestamp
      data.timestamps.forEach((timestamp: string, index: number) => {
        const bullishPercent = data.bullish[index] || 0;
        const bearishPercent = data.bearish[index] || 0;
        const neutralPercent = data.neutral[index] || 0;
        
        console.log(`Time point ${index}: Bullish=${bullishPercent}, Bearish=${bearishPercent}, Neutral=${neutralPercent}`);
        
        // Determine the dominant sentiment based on highest percentage
        let dominantSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        let sentimentScore = 0;
        
        // Use actual dominant sentiment - this is real data for trading decisions
        if (bullishPercent > bearishPercent && bullishPercent > neutralPercent) {
          dominantSentiment = 'bullish';
          sentimentScore = bullishPercent;
          console.log(`→ Determined as BULLISH (${(bullishPercent * 100).toFixed(1)}% vs ${(bearishPercent * 100).toFixed(1)}% bearish, ${(neutralPercent * 100).toFixed(1)}% neutral)`);
        } else if (bearishPercent > bullishPercent && bearishPercent > neutralPercent) {
          dominantSentiment = 'bearish';
          sentimentScore = -bearishPercent; // Negative for bearish
          console.log(`→ Determined as BEARISH (${(bearishPercent * 100).toFixed(1)}% vs ${(bullishPercent * 100).toFixed(1)}% bullish, ${(neutralPercent * 100).toFixed(1)}% neutral)`);
        } else {
          dominantSentiment = 'neutral';
          sentimentScore = 0;
          console.log(`→ Determined as NEUTRAL (${(neutralPercent * 100).toFixed(1)}% neutral, ${(bullishPercent * 100).toFixed(1)}% bullish, ${(bearishPercent * 100).toFixed(1)}% bearish)`);
        }
        
        sentimentData.push({
          timestamp,
          bullish: bullishPercent,
          bearish: bearishPercent,
          neutral: neutralPercent,
          // Add required fields with calculated values
          ticker: 'MARKET',
          source: 'reddit',
          score: sentimentScore,
          sentiment: dominantSentiment,
          confidence: Math.max(bullishPercent, bearishPercent, neutralPercent), // Confidence based on strongest sentiment
          postCount: data.total ? data.total[index] || 0 : 0,
          commentCount: 0,
          upvotes: 0
        });
      });
      
      console.log(`[REDDIT MARKET SENTIMENT DEBUG] Returning ${sentimentData.length} sentiment data points`);
      return sentimentData;
    }
    
    console.error('[REDDIT MARKET SENTIMENT ERROR] Unexpected response format:', data);
    throw new Error('Unexpected response format from sentiment API');
    
  } catch (error) {
    console.error('[REDDIT MARKET SENTIMENT ERROR] Market sentiment API error:', error);
    console.error('[REDDIT MARKET SENTIMENT ERROR] Error type:', typeof error);
    console.error('[REDDIT MARKET SENTIMENT ERROR] Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[REDDIT MARKET SENTIMENT ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    throw error; // Re-throw the error for proper handling
  }
};

/**
 * Fetch Reddit posts
 * @param signal Optional abort signal for cancellation
 * @returns Promise of Reddit posts array
 */
export const fetchRedditPosts = async (signal?: AbortSignal): Promise<RedditPost[]> => {
  try {
    console.log('[REDDIT POSTS API] Fetching Reddit posts...');
    
    const url = buildApiUrl('/api/sentiment/reddit/posts');
    console.log(`[REDDIT POSTS API] Making request to: ${url}`);

    const headers = getAuthHeaders();
    const response = await fetch(url, { signal, headers });
    const data = await handleApiResponse(response);
    
    console.log(`[REDDIT POSTS API] Response data:`, data);
    
    // Check if posts exist and is an array
    if (!data || !data.posts || !Array.isArray(data.posts)) {
      console.warn('[REDDIT POSTS API] Unexpected response format, using Reddit client fallback');
      // Fallback to real Reddit API
      return fetchRedditPostsReal(signal);
    }
    
    const postsArray = data.posts as RedditPost[];
    console.log(`[REDDIT POSTS API] Successfully received ${postsArray.length} posts`);
    
    // Validate each post has required fields
    const validatedPosts = postsArray.filter((post, index) => {
      const isValid = post && 
                     typeof post.id === 'string' && 
                     typeof post.title === 'string' &&
                     typeof post.content === 'string' &&
                     typeof post.author === 'string' &&
                     typeof post.subreddit === 'string';
      
      if (!isValid) {
        console.warn(`[REDDIT POSTS API] Invalid post at index ${index}:`, post);
        return false;
      }
      
      return true;
    });
    
    console.log(`[REDDIT POSTS API] Returning ${validatedPosts.length} validated posts`);
    return validatedPosts;
    
  } catch (error) {
    console.error('[REDDIT POSTS API] Reddit posts API error:', error);
    console.warn('[REDDIT POSTS API] Falling back to Reddit client');
    
    // Fallback to real Reddit API
    return fetchRedditPostsReal(signal);
  }
}; 