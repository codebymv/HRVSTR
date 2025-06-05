import { InstitutionalHolding, InsiderTrade, TimeRange } from '../../types';
import { getProxyUrl } from '../apiService';

// Helper function for cleaning insider names (shared with insider trades)
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
 * Fetch institutional holdings from SEC 13F filings
 * Returns institutional holdings data for the specified time range
 */
export const fetchInstitutionalHoldings = async (timeRange: TimeRange = '1w', refresh: boolean = false, signal?: AbortSignal): Promise<InstitutionalHolding[]> => {
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
    
    const response = await fetch(`${proxyUrl}/api/sec/institutional-holdings?timeRange=${timeRange}${refreshParam}`, { 
      signal,
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.institutionalHoldings as InstitutionalHolding[];
  } catch (error) {
    console.error('Institutional holdings API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch institutional holdings data');
  }
};

/**
 * Fetch institutional holdings using the new user-specific caching system
 * This function integrates with the backend's user-specific database caching
 */
export const fetchInstitutionalHoldingsWithUserCache = async (
  timeRange: TimeRange = '1w', 
  refresh: boolean = false, 
  signal?: AbortSignal
): Promise<InstitutionalHolding[]> => {
  try {
    const proxyUrl = getProxyUrl();
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      throw new Error('Authentication required for institutional holdings');
    }
    
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    const refreshParam = refresh ? '&refresh=true' : '';
    const response = await fetch(
      `${proxyUrl}/api/sec/institutional-holdings?timeRange=${timeRange}${refreshParam}`, 
      { signal, headers }
    );
    
    if (!response.ok) {
      if (response.status === 402) {
        const errorData = await response.json();
        throw new Error(errorData.userMessage || 'Insufficient credits for this request');
      } else if (response.status === 403) {
        const errorData = await response.json();
        throw new Error(errorData.userMessage || 'Upgrade to Pro to access institutional holdings');
      }
      throw new Error(`Server returned error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle cached vs fresh data response - ensure we always get an array
    if (data && Array.isArray(data.institutionalHoldings)) {
      console.log(`Fetched ${data.institutionalHoldings.length} institutional holdings using user cache system`);
      if (data.fromCache) {
        console.log('Data served from user-specific cache');
      } else {
        console.log('Fresh data fetched and cached for user');
      }
      return data.institutionalHoldings as InstitutionalHolding[];
    } else if (data && data.institutionalHoldings === null) {
      // Handle explicit null response (no data available)
      console.log('No institutional holdings data available from user cache system');
      return [];
    } else {
      // Handle undefined, missing property, or invalid format
      console.warn('Invalid or missing institutional holdings data in response:', data);
      return [];
    }
  } catch (error) {
    console.error('User cache institutional holdings API error:', error);
    throw error;
  }
};

/**
 * Fetch both insider trades and institutional holdings in parallel for optimal loading
 * This reduces the number of API calls and improves overall loading performance
 */
export const fetchSecDataParallel = async (timeRange: TimeRange = '1w', refresh: boolean = false, signal?: AbortSignal): Promise<{
  insiderTrades: InsiderTrade[];
  institutionalHoldings: InstitutionalHolding[];
  metadata: { fetchedAt: string; refreshed: boolean };
}> => {
  try {
    const proxyUrl = getProxyUrl();
    const refreshParam = refresh ? '&refresh=true' : '';
    const response = await fetch(`${proxyUrl}/api/sec/parallel?timeRange=${timeRange}${refreshParam}`, { signal });
    
    if (!response.ok) {
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Parallel SEC data response:', data);
    
    // Process insider trades with the same cleaning logic
    const processedInsiderTrades = data.insiderTrades?.data ? 
      data.insiderTrades.data.map((trade: any): InsiderTrade => {
        // Apply the same cleaning logic as the individual endpoint
        const cleanedName = cleanInsiderName(trade.insiderName || 'Unknown');
        let ticker = trade.ticker || '-';
        
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
      }) : [];
    
    // Institutional holdings need minimal processing
    const processedInstitutionalHoldings = data.institutionalHoldings?.data || [];
    
    console.log(`Processed ${processedInsiderTrades.length} insider trades and ${processedInstitutionalHoldings.length} institutional holdings in parallel`);
    
    return {
      insiderTrades: processedInsiderTrades,
      institutionalHoldings: processedInstitutionalHoldings,
      metadata: {
        fetchedAt: data.fetchedAt,
        refreshed: data.refreshed
      }
    };
  } catch (error) {
    console.error('Parallel SEC data API error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch SEC data');
  }
}; 