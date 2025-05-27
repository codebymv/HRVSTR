import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProxyUrl, updateServerApiKeys, loadApiKeys } from '../src/services/apiService';

// Mock fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage with all required Storage interface properties
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    // Additional required Storage interface properties
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() { return Object.keys(store).length; },
    // Custom helper for tests
    getAll: () => store
  };
})();

// Always apply our mock implementation, regardless of whether localStorage was defined before
// This ensures our spy functions are always used
global.localStorage = mockLocalStorage;

// For environments that use window instead of global
if (typeof window !== 'undefined') {
  window.localStorage = mockLocalStorage;
}

// Set up mocks before each test
beforeEach(() => {
  // Clear mock data and setup default behavior
  mockLocalStorage.clear();
  mockFetch.mockClear();
  
  // Mock environment variables
  vi.stubEnv('VITE_PROXY_URL', 'http://test-proxy:3001');
});

// Clean up after each test
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('API Service', () => {
  describe('getProxyUrl', () => {
    it('should return the proxy URL from environment variables', () => {
      const proxyUrl = getProxyUrl();
      expect(proxyUrl).toBe('http://test-proxy:3001');
    });
    
    it('should return the default URL when environment variable is not set', () => {
      vi.unstubAllEnvs(); // Clear environment variables
      const proxyUrl = getProxyUrl();
      expect(proxyUrl).toBe('http://localhost:3001');
    });
  });
  
  describe('loadApiKeys', () => {
    it('should return an empty object when no keys are stored', () => {
      const keys = loadApiKeys();
      expect(keys).toEqual({});
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('swApiKeys');
    });
    
    it('should load and convert array-format API keys from localStorage', () => {
      // Setup localStorage with mock array-formatted keys
      const mockKeys = [
        { name: 'reddit_client_id', key: 'test-client-id' },
        { name: 'reddit_client_secret', key: 'test-client-secret' }
      ];
      mockLocalStorage.setItem('swApiKeys', JSON.stringify(mockKeys));
      
      // Test the function
      const keys = loadApiKeys();
      
      // Verify the correct object conversion
      expect(keys).toEqual({
        reddit_client_id: 'test-client-id',
        reddit_client_secret: 'test-client-secret'
      });
    });
    
    it('should handle invalid JSON data gracefully', () => {
      // Set invalid JSON data
      mockLocalStorage.setItem('swApiKeys', 'invalid-json');
      
      // Test the function
      const keys = loadApiKeys();
      
      // Should return empty object and log error
      expect(keys).toEqual({});
      // We would test console.error was called, but it's not easily mockable in this setup
    });
    
    it('should ignore items without name or key properties', () => {
      // Setup localStorage with some invalid items
      const mockKeys = [
        { name: 'valid_key', key: 'valid-value' },
        { name: 'missing_key' },
        { key: 'missing_name' },
        {}
      ];
      mockLocalStorage.setItem('swApiKeys', JSON.stringify(mockKeys));
      
      // Test the function
      const keys = loadApiKeys();
      
      // Only the valid item should be included
      expect(keys).toEqual({
        valid_key: 'valid-value'
      });
    });
  });
  
  describe('updateServerApiKeys', () => {
    it('should send API keys to the server and return success', async () => {
      // Mock a successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Keys updated successfully' })
      });
      
      // Test data
      const testKeys = {
        reddit_client_id: 'new-client-id',
        reddit_client_secret: 'new-client-secret'
      };
      
      // Call the function
      const result = await updateServerApiKeys(testKeys);
      
      // Check the function called fetch with correct arguments
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-proxy:3001/api/settings/update-keys',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: testKeys })
        }
      );
      
      // Check the result
      expect(result).toEqual({
        success: true,
        message: 'Keys updated successfully'
      });
    });
    
    it('should handle server errors correctly', async () => {
      // Mock a failed response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid API key format' })
      });
      
      // Test data
      const testKeys = { reddit_client_id: 'invalid-id' };
      
      // Call the function
      const result = await updateServerApiKeys(testKeys);
      
      // Check the result
      expect(result).toEqual({
        success: false,
        message: 'Invalid API key format'
      });
    });
    
    it('should handle network errors gracefully', async () => {
      // Mock a network error
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));
      
      // Call the function
      const result = await updateServerApiKeys({});
      
      // Check the result
      expect(result).toEqual({
        success: false,
        message: 'Network failure'
      });
    });
    
    it('should use default error message when server response is missing message', async () => {
      // Mock an error response with no message
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({})
      });
      
      // Call the function
      const result = await updateServerApiKeys({});
      
      // Check the result has the default error message
      expect(result).toEqual({
        success: false,
        message: 'Failed to update API keys on server'
      });
    });
  });
  
  // Integration test to simulate the typical key update flow
  describe('API key management flow', () => {
    it('should update keys on the server and maintain correct state', async () => {
      // Setup initial state with some keys
      const initialKeys = [
        { name: 'reddit_client_id', key: 'old-client-id' },
        { name: 'reddit_client_secret', key: 'old-client-secret' }
      ];
      mockLocalStorage.setItem('swApiKeys', JSON.stringify(initialKeys));
      
      // Verify keys are loaded correctly
      const loadedKeys = loadApiKeys();
      expect(loadedKeys).toEqual({
        reddit_client_id: 'old-client-id',
        reddit_client_secret: 'old-client-secret'
      });
      
      // Mock a successful update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Keys updated successfully' })
      });
      
      // Update to new keys
      const newKeys = {
        reddit_client_id: 'new-client-id',
        reddit_client_secret: 'new-client-secret'
      };
      
      const updateResult = await updateServerApiKeys(newKeys);
      expect(updateResult.success).toBe(true);
      
      // Verify the update call was made correctly
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/settings/update-keys'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ keys: newKeys })
        })
      );
    });
  });
});
