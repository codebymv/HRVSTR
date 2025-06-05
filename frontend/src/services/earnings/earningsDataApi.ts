import { EarningsEvent, EarningsAnalysis, TimeRange } from '../../types';
import { getProxyUrl } from '../apiService';

/**
 * Fetch upcoming earnings with user-specific caching
 * Returns upcoming earnings data for the specified time range
 */
export const fetchUpcomingEarningsWithUserCache = async (
  timeRange: TimeRange = '1w', 
  refresh: boolean = false, 
  limit?: number,
  signal?: AbortSignal
): Promise<EarningsEvent[]> => {
  try {
    const proxyUrl = getProxyUrl();
    const refreshParam = refresh ? '&refresh=true' : '';
    const limitParam = limit ? `&limit=${limit}` : '';
    
    // Get authentication token and prepare headers
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(
      `${proxyUrl}/api/earnings/upcoming?timeRange=${timeRange}${refreshParam}${limitParam}`, 
      { signal, headers }
    );
    
    if (!response.ok) {
      throw new Error(`Server returned error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch earnings data');
    }
    
    console.log(`Fetched ${result.count} upcoming earnings events for ${timeRange}`);
    return result.data as EarningsEvent[];
  } catch (error) {
    console.error('Upcoming earnings API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch upcoming earnings data');
  }
};

/**
 * Stream upcoming earnings data with real-time progress updates using SSE
 */
export const streamUpcomingEarnings = (
  timeRange: TimeRange = '1w', 
  refresh: boolean = false,
  onProgress: (progressData: {
    stage: string;
    progress: number;
    total: number;
    current: number;
    error?: string;
    data?: any;
    completed?: boolean;
    timestamp: string;
    fromCache?: boolean;
  }) => void,
  onComplete: (data: any) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): EventSource => {
  const proxyUrl = getProxyUrl();
  const token = localStorage.getItem('auth_token');
  const refreshParam = refresh ? '&refresh=true' : '';
  
  // For authenticated requests, we need to pass the token as a query parameter
  // since EventSource doesn't support custom headers
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  const url = `${proxyUrl}/api/earnings/upcoming/stream?timeRange=${timeRange}${refreshParam}${tokenParam}`;
  
  console.log(`🌊 Starting earnings SSE stream: ${url.replace(tokenParam, tokenParam ? '&token=[REDACTED]' : '')}`);
  
  const eventSource = new EventSource(url);
  
  eventSource.onmessage = (event) => {
    try {
      const progressData = JSON.parse(event.data);
      console.log('📊 Earnings progress update:', progressData);
      
      if (progressData.completed && progressData.data) {
        console.log('✅ Earnings stream completed with data');
        onComplete(progressData.data);
        eventSource.close();
      } else if (progressData.error) {
        console.error('❌ Earnings stream error:', progressData.error);
        onError(progressData.error);
        eventSource.close();
      } else {
        onProgress(progressData);
      }
    } catch (error) {
      console.error('Error parsing earnings SSE data:', error);
      onError('Error parsing server response');
      eventSource.close();
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('Earnings SSE connection error:', error);
    onError('Connection error occurred');
    eventSource.close();
  };
  
  // Handle abort signal
  if (signal) {
    signal.addEventListener('abort', () => {
      console.log('📊 Aborting earnings SSE stream');
      eventSource.close();
    });
  }
  
  return eventSource;
};

/**
 * Fetch earnings analysis for a specific ticker with user caching
 */
export const fetchEarningsAnalysisWithUserCache = async (
  ticker: string,
  timeRange: TimeRange = '1m',
  refresh: boolean = false,
  signal?: AbortSignal
): Promise<{ analysis: EarningsAnalysis; source: string }> => {
  try {
    const proxyUrl = getProxyUrl();
    const refreshParam = refresh ? '&refresh=true' : '';
    
    // Get authentication token and prepare headers
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(
      `${proxyUrl}/api/earnings/analysis/${ticker.toUpperCase()}?timeRange=${timeRange}${refreshParam}`, 
      { signal, headers }
    );
    
    if (!response.ok) {
      throw new Error(`Server returned error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch earnings analysis');
    }
    
    console.log(`Fetched earnings analysis for ${ticker}, source: ${result.source}`);
    return {
      analysis: result.analysis as EarningsAnalysis,
      source: result.source || 'unknown'
    };
  } catch (error) {
    console.error('Earnings analysis API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch earnings analysis');
  }
};

/**
 * Fetch historical earnings for a specific ticker with user caching
 */
export const fetchHistoricalEarningsWithUserCache = async (
  ticker: string,
  timeRange: TimeRange = '1m',
  refresh: boolean = false,
  limit?: number,
  signal?: AbortSignal
): Promise<EarningsEvent[]> => {
  try {
    const proxyUrl = getProxyUrl();
    const refreshParam = refresh ? '&refresh=true' : '';
    const limitParam = limit ? `&limit=${limit}` : '';
    
    // Get authentication token and prepare headers
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      throw new Error('Authentication required for historical earnings data');
    }
    
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    const response = await fetch(
      `${proxyUrl}/api/earnings/historical/${ticker.toUpperCase()}?timeRange=${timeRange}${refreshParam}${limitParam}`, 
      { signal, headers }
    );
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required for historical earnings data');
      }
      if (response.status === 402) {
        throw new Error('Insufficient credits for historical earnings data');
      }
      throw new Error(`Server returned error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch historical earnings');
    }
    
    console.log(`Fetched ${result.count} historical earnings for ${ticker}`);
    return result.historicalEarnings as EarningsEvent[];
  } catch (error) {
    console.error('Historical earnings API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch historical earnings data');
  }
};

/**
 * Fetch company information for earnings context
 */
export const fetchCompanyInfoForEarnings = async (
  ticker: string,
  signal?: AbortSignal
): Promise<any> => {
  try {
    const proxyUrl = getProxyUrl();
    
    const response = await fetch(
      `${proxyUrl}/api/earnings/company/${ticker.toUpperCase()}`, 
      { signal }
    );
    
    if (!response.ok) {
      throw new Error(`Server returned error: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch company information');
    }
    
    console.log(`Fetched company info for ${ticker}`);
    return result.companyInfo;
  } catch (error) {
    console.error('Company info API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch company information');
  }
}; 