import { getProxyUrl } from '../apiService';

/**
 * Get user's earnings cache status
 */
export const getUserEarningsCacheStatus = async (signal?: AbortSignal): Promise<any> => {
  try {
    const proxyUrl = getProxyUrl();
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    const response = await fetch(`${proxyUrl}/api/earnings/cache/status`, { signal, headers });
    
    if (!response.ok) {
      throw new Error(`Server returned error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching earnings cache status:', error);
    throw error;
  }
};

/**
 * Clear user's earnings cache
 */
export const clearUserEarningsCache = async (
  dataType?: string, 
  timeRange?: string, 
  signal?: AbortSignal
): Promise<any> => {
  try {
    const proxyUrl = getProxyUrl();
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    let url = `${proxyUrl}/api/earnings/cache/clear`;
    const params = new URLSearchParams();
    if (dataType) params.append('dataType', dataType);
    if (timeRange) params.append('timeRange', timeRange);
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await fetch(url, { 
      method: 'DELETE',
      signal, 
      headers 
    });
    
    if (!response.ok) {
      throw new Error(`Server returned error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error clearing earnings cache:', error);
    throw error;
  }
};

/**
 * Clear the earnings data cache on the server
 * This forces the next data fetch to get fresh data
 */
export const clearEarningsCache = async (signal?: AbortSignal): Promise<{success: boolean, message: string}> => {
  try {
    const proxyUrl = getProxyUrl();
    const response = await fetch(`${proxyUrl}/api/earnings/clear-cache`, { signal });
    
    if (!response.ok) {
      throw new Error(`Proxy server returned error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error clearing earnings cache:', error);
    throw error;
  }
}; 