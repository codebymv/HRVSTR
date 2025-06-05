import { InsiderTrade, TimeRange } from '../../types';
import { getProxyUrl } from '../apiService';

// Helper function for cleaning insider names (extracted for reuse)
const cleanInsiderName = (rawName: string): string => {
  if (!rawName) return 'Unknown';
  
  // If it contains "Insider (Name Not Available)", return a better placeholder
  if (rawName.includes('Insider (Name Not Available)')) {
    return 'Insider';
  }

  // Remove any HTML tags
  let clean = rawName.replace(/<[^>]*>/g, '');
  
  // Remove CIK numbers and other metadata
  clean = clean.replace(/\(\d{10}\)/g, '');
  clean = clean.replace(/\(\d+\)/g, '');
  clean = clean.replace(/\(Reporting\)/g, '');
  clean = clean.replace(/\(Issuer\)/g, '');
  clean = clean.replace(/\(Filer\)/g, '');
  
  // If string contains AccNo metadata, chop off at AccNo:
  if (clean.includes('AccNo:')) {
    clean = clean.split('AccNo:')[0].trim();
  }
  
  // Extract the actual name from the filing data if possible
  const reportingPersonMatch = clean.match(/Reporting Person:\s*([^\n(]+)/i);
  if (reportingPersonMatch && reportingPersonMatch[1]) {
    clean = reportingPersonMatch[1].trim();
  }
  
  // Check if this is likely a company name rather than a person
  const companyIndicators = ['Inc', 'Corp', 'LLC', 'Ltd', 'LP', 'REIT', 'Group', 'Fund', 'Trust', 'Solutions', 'Investment', 'Financial'];
  const isLikelyCompany = companyIndicators.some(indicator => 
    clean.includes(indicator) || 
    clean.includes(indicator.toUpperCase()) || 
    clean.includes(indicator.toLowerCase())
  );
  
  // If it's a company, just ensure proper capitalization but don't format as a person name
  if (!isLikelyCompany) {
    // Ensure proper capitalization for person names
    if (clean.toUpperCase() === clean || clean.toLowerCase() === clean) {
      clean = clean.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }
  
  return clean;
};

/**
 * Fetch insider trades from SEC Form 4 filings
 * Returns insider trading data for the specified time range
 */
export const fetchInsiderTrades = async (timeRange: TimeRange = '1w', refresh: boolean = false, signal?: AbortSignal): Promise<InsiderTrade[]> => {
  try {
    const proxyUrl = getProxyUrl();
    const refreshParam = refresh ? '&refresh=true' : '';
    const response = await fetch(`${proxyUrl}/api/sec/insider-trades?timeRange=${timeRange}${refreshParam}`, { signal });
    
    if (!response.ok) {
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Raw insider trades data:', data);
    
    // Ensure we have valid data with all required fields
    if (!data.insiderTrades || !Array.isArray(data.insiderTrades)) {
      throw new Error('Invalid insider trades data format');
    }
    
    // Process each trade to ensure it matches our interface
    const processedTrades = data.insiderTrades.map((trade: any): InsiderTrade => {
      // Clean the insider name
      const cleanedName = cleanInsiderName(trade.insiderName);
      
      // Clean the ticker if it's malformed
      let ticker = trade.ticker || '-';
      if (ticker === '-' || !ticker) {
        // Try to extract ticker from the filing data
        const tickerMatch = trade.insiderName?.match(/\b([A-Z]{1,5})\b/);
        if (tickerMatch && tickerMatch[1]) {
          ticker = tickerMatch[1];
        }
      }
      
      // Ensure all required fields are present with correct types
      return {
        id: trade.id || `trade-${Date.now()}-${Math.random()}`,
        ticker: ticker,
        insiderName: cleanedName,
        title: trade.title || 'Executive',
        tradeType: trade.tradeType || 'BUY',
        shares: typeof trade.shares === 'number' ? trade.shares : 0,
        price: typeof trade.price === 'number' ? trade.price : 0,
        value: typeof trade.value === 'number' ? trade.value : 0,
        filingDate: trade.filingDate || new Date().toISOString(),
        transactionDate: trade.transactionDate || new Date().toISOString(),
        formType: trade.formType || 'Form 4'
      };
    });
    
    // Calculate values if missing but we have shares and price
    processedTrades.forEach((trade: InsiderTrade) => {
      if (trade.value === 0 && trade.shares > 0 && trade.price > 0) {
        trade.value = trade.shares * trade.price;
      }
    });
    
    console.log(`Processed ${processedTrades.length} insider trades`);
    return processedTrades;
  } catch (error) {
    console.error('Insider trades API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch insider trades data');
  }
};

/**
 * Fetch insider trades using the new user-specific caching system
 * This function integrates with the backend's user-specific database caching
 */
export const fetchInsiderTradesWithUserCache = async (
  timeRange: TimeRange = '1w', 
  refresh: boolean = false, 
  signal?: AbortSignal,
  onProgress?: (progressData: any) => void
): Promise<InsiderTrade[]> => {
  try {
    const proxyUrl = getProxyUrl();
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      // Fall back to old API for non-authenticated users
      return fetchInsiderTrades(timeRange, refresh, signal);
    }
    
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    const refreshParam = refresh ? '&refresh=true' : '';
    const response = await fetch(
      `${proxyUrl}/api/sec/insider-trades?timeRange=${timeRange}${refreshParam}`, 
      { signal, headers }
    );
    
    if (!response.ok) {
      if (response.status === 402) {
        const errorData = await response.json();
        throw new Error(errorData.userMessage || 'Insufficient credits for this request');
      } else if (response.status === 403) {
        const errorData = await response.json();
        throw new Error(errorData.userMessage || 'Access denied - upgrade required');
      }
      throw new Error(`Server returned error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle cached vs fresh data response - ensure we always get an array
    if (data && Array.isArray(data.insiderTrades)) {
      console.log(`Fetched ${data.insiderTrades.length} insider trades using user cache system`);
      if (data.fromCache) {
        console.log('Data served from user-specific cache');
      } else {
        console.log('Fresh data fetched and cached for user');
      }
      return data.insiderTrades as InsiderTrade[];
    } else if (data && data.insiderTrades === null) {
      // Handle explicit null response (no data available)
      console.log('No insider trades data available from user cache system');
      return [];
    } else {
      // Handle undefined, missing property, or invalid format
      console.warn('Invalid or missing insider trades data in response:', data);
      return [];
    }
  } catch (error) {
    console.error('User cache insider trades API error:', error);
    throw error;
  }
};

/**
 * Stream insider trades with real-time progress updates using Server-Sent Events
 */
export const streamInsiderTrades = (
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
  }) => void,
  onComplete: (data: any) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): EventSource => {
  const proxyUrl = getProxyUrl();
  const refreshParam = refresh ? '&refresh=true' : '';
  const streamUrl = `${proxyUrl}/api/sec/insider-trades/stream?timeRange=${timeRange}${refreshParam}`;
  
  console.log('Starting SSE stream for insider trades:', streamUrl);
  
  const eventSource = new EventSource(streamUrl);
  
  eventSource.onmessage = (event) => {
    try {
      const progressData = JSON.parse(event.data);
      console.log('SSE Progress:', progressData);
      
      // Call progress callback
      onProgress(progressData);
      
      // If this is the completion event, call onComplete and close
      if (progressData.completed) {
        if (progressData.error) {
          onError(progressData.error);
        } else if (progressData.data) {
          onComplete(progressData.data);
        }
        eventSource.close();
      }
    } catch (error) {
      console.error('Error parsing SSE data:', error);
      onError('Error parsing server response');
      eventSource.close();
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('SSE Error:', error);
    onError('Connection error during streaming');
    eventSource.close();
  };
  
  // Handle abort signal
  if (signal) {
    signal.addEventListener('abort', () => {
      eventSource.close();
    });
  }
  
  return eventSource;
};

/**
 * Stream insider trades using the new user-specific caching system
 * This integrates with the backend's SSE streaming that uses user-specific caching
 */
export const streamInsiderTradesWithUserCache = (
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
  
  if (!token) {
    // Fall back to old streaming API for non-authenticated users
    return streamInsiderTrades(timeRange, refresh, onProgress, onComplete, onError, signal);
  }
  
  const refreshParam = refresh ? '&refresh=true' : '';
  
  // For authenticated requests, we need to pass the token as a query parameter
  // since EventSource doesn't support custom headers
  const tokenParam = `&token=${encodeURIComponent(token)}`;
  const url = `${proxyUrl}/api/sec/insider-trades/stream?timeRange=${timeRange}${refreshParam}${tokenParam}`;
  
  console.log('Starting SSE stream for insider trades with user cache:', url.replace(tokenParam, '&token=[REDACTED]'));
  
  // Create EventSource
  const eventSource = new EventSource(url);
  
  eventSource.onmessage = (event) => {
    try {
      const progressData = JSON.parse(event.data);
      console.log('SSE Progress (User Cache):', progressData);
      
      if (progressData.completed) {
        if (progressData.error) {
          onError(progressData.error.userMessage || progressData.error.message || 'Stream error');
        } else if (progressData.data) {
          onComplete(progressData.data);
        }
        eventSource.close();
      } else {
        onProgress(progressData);
      }
    } catch (error) {
      console.error('Error parsing SSE data:', error);
      onError('Error parsing progress data');
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('SSE Error:', error);
    onError('Connection error occurred');
    eventSource.close();
  };
  
  // Handle abort signal
  if (signal) {
    signal.addEventListener('abort', () => {
      eventSource.close();
    });
  }
  
  return eventSource;
}; 