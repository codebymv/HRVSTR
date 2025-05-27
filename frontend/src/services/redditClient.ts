// @ts-ignore - ignore missing typings for the sentiment module
import Sentiment from 'sentiment';
import { RedditPost, SentimentData } from '../types';

// Configuration
const SUBS = ['wallstreetbets', 'stocks', 'investing'] as const;
const DEFAULT_LIMIT = 25;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // Initialize sentiment analyzer
const sentiment = new (Sentiment as any)();

/**
 * Error class for API fetch failures with source and retry information
 */
export class ApiError extends Error {
  constructor(
    message: string, 
    public readonly source: string,
    public readonly isRetryable: boolean = true,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Get the proxy URL for API requests
 * Uses Vite's import.meta.env for environment variables in development
 */
export function getProxyUrl(): string {
  // For Vite/React apps, use import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
  }
  
  // Fallback for other environments
  return 'http://localhost:3001';
}

/**
 * Fetch data from a subreddit with retry logic and error handling
 */
async function fetchSubreddit(
  subreddit: typeof SUBS[number], 
  limit: number = DEFAULT_LIMIT, 
  signal?: AbortSignal,
  retryCount: number = 0
): Promise<any> {
  const proxyUrl = getProxyUrl();
  const url = `${proxyUrl}/api/reddit/subreddit/${subreddit}?limit=${limit}`;
  
  try {
    console.log(`[Reddit] Fetching ${limit} posts from r/${subreddit}`);
    
    const response = await fetch(url, { 
      signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      const isRetryable = response.status >= 500 || response.status === 429; // Server errors or rate limited
      throw new ApiError(
        `Proxy server error: ${response.status} ${response.statusText}`,
        'reddit',
        isRetryable,
        response.status
      );
    }
    
    const data = await response.json();
    
    // Validate response structure
    if (!data || !Array.isArray(data.data?.children)) {
      throw new ApiError(
        'Invalid response format from Reddit API',
        'reddit',
        true
      );
    }
    
    return data;
  } catch (error: unknown) {
    const apiError = error instanceof ApiError 
      ? error 
      : new ApiError(
          error instanceof Error ? error.message : 'Unknown error fetching subreddit',
          'reddit',
          true
        );
    
    // Log the error
    console.error(`[Reddit] Error fetching r/${subreddit}:`, apiError.message);
    
    // If we have retries left and the error is retryable, wait and retry
    if (retryCount < MAX_RETRIES && apiError.isRetryable) {
      const delay = RETRY_DELAY * (retryCount + 1);
      console.log(`[Reddit] Retrying r/${subreddit} in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchSubreddit(subreddit, limit, signal, retryCount + 1);
    }
    
    // If we've exhausted retries or this isn't a retryable error, rethrow
    throw apiError;
  }
}

/**
 * Validate and normalize a Reddit post
 */
function normalizeRedditPost(postData: any): RedditPost | null {
  try {
    if (!postData?.id || !postData.title) {
      throw new Error('Missing required fields in post data');
    }
    
    return {
      id: String(postData.id),
      title: String(postData.title),
      content: postData.selftext ? String(postData.selftext) : '',
      author: postData.author ? String(postData.author) : '[deleted]',
      upvotes: Math.max(0, Number(postData.ups) || 0),
      commentCount: Math.max(0, Number(postData.num_comments) || 0),
      url: postData.permalink 
        ? `https://reddit.com${postData.permalink}` 
        : `https://reddit.com/r/${postData.subreddit}/comments/${postData.id}`,
      created: postData.created_utc 
        ? new Date(postData.created_utc * 1000).toISOString() 
        : new Date().toISOString(),
      subreddit: postData.subreddit ? String(postData.subreddit) : 'unknown',
      // Additional Reddit post metadata can be added here if needed
    };
  } catch (error) {
    console.error('Error normalizing Reddit post:', error);
    return null;
  }
}

/**
 * Fetches Reddit posts from the backend API
 */
export async function fetchRedditPosts(signal?: AbortSignal): Promise<RedditPost[]> {
  try {
    console.log('[Reddit] Fetching posts');
    
    // Fetch from all subreddits in parallel
    const responses = await Promise.all(
      SUBS.map(sub => 
        fetchSubreddit(sub, DEFAULT_LIMIT, signal).catch(error => {
          console.error(`[Reddit] Failed to fetch r/${sub}:`, error);
          return { data: { children: [] } }; // Return empty data for failed fetches
        })
      )
    );

    // Process and normalize posts
    const allPosts: RedditPost[] = [];
    
    for (const response of responses) {
      try {
        const posts = response.data.children
          .map((child: any) => normalizeRedditPost(child?.data))
          .filter((post: RedditPost | null): post is RedditPost => post !== null);
        
        allPosts.push(...posts);
      } catch (error) {
        console.error('Error processing subreddit response:', error);
        // Continue with other subreddits if one fails
      }
    }

    // Sort by newest first
    allPosts.sort((a, b) => 
      new Date(b.created).getTime() - new Date(a.created).getTime()
    );

    console.log(`[Reddit] Successfully fetched ${allPosts.length} posts`);
    return allPosts;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Reddit] Failed to fetch Reddit posts:', errorMessage);
    
    // Re-throw as ApiError if it isn't already
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      errorMessage,
      'reddit',
      false // Don't retry on aggregation errors
    );
  }
}

/**
 * Convert Reddit posts into per-ticker SentimentData[]
 */
export async function fetchSentimentFromReddit(signal?: AbortSignal): Promise<SentimentData[]> {
  try {
    // This may throw errors from fetchRedditPosts, which we want to propagate up
    const posts = await fetchRedditPosts(signal);
    const sentimentData: SentimentData[] = [];

    for (const post of posts) {
      const text = `${post.title} ${post.content || ''}`.toLowerCase();
      const result = sentiment.analyze(text);
      const score = result.comparative; // Get comparative score
      
      const sentimentItem: SentimentData = {
        ticker: 'UNKNOWN', // Will be set by the backend
        source: 'reddit',
        timestamp: new Date().toISOString(),
        score: Number(score.toFixed(3)),
        sentiment: score > 0.1 ? 'bullish' : score < -0.1 ? 'bearish' : 'neutral',
        confidence: Math.min(Math.abs(score) / 5, 1), // Normalize to 0-1 range
        postCount: 1,
        commentCount: post.commentCount || 0,
        upvotes: post.upvotes || 0
      };
      
      sentimentData.push(sentimentItem);
    }

    return sentimentData;
  } catch (error) {
    console.error('Error in fetchSentimentFromReddit:', error);
    throw error;
  }
}