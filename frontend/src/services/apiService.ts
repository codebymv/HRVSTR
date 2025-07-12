/**
 * API Service - Manages proxy URL and API configuration
 */

// Function to get API URL for server-side environments
export function getApiUrl(): string {
  return process.env.VITE_API_URL || 'http://localhost:3001';
}

// Function to get API URL for client-side environments
export function getApiUrlClient(): string {
  return (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';
}

// Legacy function for backward compatibility
export function getProxyUrl(): string {
  return (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';
}

/**
 * Send API keys to the proxy server
 * @param keys - Object containing API keys
 */
export const updateServerApiKeys = async (keys: {
  reddit_client_id?: string;
  reddit_client_secret?: string;
}): Promise<{ success: boolean; message: string }> => {
  try {
    const proxyUrl = getProxyUrl();
    const response = await fetch(`${proxyUrl}/api/settings/update-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keys })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update API keys on server');
    }
    
    const result = await response.json();
    return {
      success: true,
      message: result.message || 'API keys updated successfully'
    };
  } catch (error) {
    console.error('Error updating server API keys:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Loads API keys from localStorage
 */
export const loadApiKeys = (): Record<string, string> => {
  try {
    const keysJson = localStorage.getItem('swApiKeys');
    if (!keysJson) return {};
    
    const keys = JSON.parse(keysJson);
    const result: Record<string, string> = {};
    
    // Convert from array format to object format
    if (Array.isArray(keys)) {
      keys.forEach(item => {
        if (item.name && item.key) {
          result[item.name] = item.key;
        }
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error loading API keys from localStorage:', error);
    return {};
  }
};

export default {
  getProxyUrl,
  updateServerApiKeys,
  loadApiKeys
};