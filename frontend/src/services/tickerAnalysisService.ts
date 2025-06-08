import { SentimentData } from '../types';

interface TickerAnalysisResponse {
  success: boolean;
  data?: {
    analysis: string;
    ticker: string;
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
 * Analyze a ticker's sentiment data with AI
 */
export async function analyzeTickerSentiment(sentimentData: SentimentData): Promise<TickerAnalysisResponse> {
  try {
    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const response = await fetch(`${proxyUrl}/api/sentiment-unified/ticker/analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sentimentData })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'ANALYSIS_FAILED',
        message: result.message || 'Failed to analyze ticker sentiment',
        upgradeRequired: result.upgradeRequired,
        feature: result.feature
      };
    }
    
    return result;
    
  } catch (error) {
    console.error('Error analyzing ticker sentiment:', error);
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: 'Failed to connect to analysis service'
    };
  }
} 