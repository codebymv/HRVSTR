import { RedditPost } from '../types';

interface AnalysisResponse {
  success: boolean;
  data?: {
    analysis: string;
    model: string;
    timestamp: string;
  };
  error?: string;
  message?: string;
  upgradeRequired?: boolean;
  feature?: string;
  creditInfo?: {
    used: number;
    remaining: number;
  };
}

/**
 * Analyze a Reddit post with AI
 */
export async function analyzeRedditPost(post: RedditPost): Promise<AnalysisResponse> {
  try {
    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const response = await fetch(`${proxyUrl}/api/sentiment-unified/reddit/analyze-post`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ post })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'ANALYSIS_FAILED',
        message: result.message || 'Failed to analyze post',
        upgradeRequired: result.upgradeRequired,
        feature: result.feature
      };
    }
    
    return result;
    
  } catch (error) {
    console.error('Error analyzing Reddit post:', error);
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: 'Failed to connect to analysis service'
    };
  }
} 