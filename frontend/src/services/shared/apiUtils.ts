import { getProxyUrl } from '../apiService';

// Re-export TimeRange from types
export type { TimeRange } from '../../types';

/**
 * Helper function for cleaning insider names (extracted for reuse across SEC APIs)
 */
export const cleanInsiderName = (name: string): string => {
  if (!name || typeof name !== 'string') return 'Unknown';
  
  // Remove common suffixes
  return name
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical content
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

/**
 * Helper to get authentication headers for authenticated API calls
 */
export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Helper to check if authentication is required and throw appropriate error
 */
export const requireAuth = (): void => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('Authentication required');
  }
};

/**
 * Helper to build API URL with proxy
 */
export const buildApiUrl = (endpoint: string): string => {
  const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
  return `${proxyUrl}${endpoint}`;
};

/**
 * Helper to handle API response errors consistently
 */
export const handleApiResponse = async (response: Response): Promise<any> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

/**
 * Common type definitions used across API services
 */
export interface ProgressData {
  progress?: number;
  stage?: string;
  completed?: boolean;
  error?: string | { message: string; userMessage?: string };
  data?: any;
  source?: string;
}

export interface StreamCallbacks {
  onProgress: (progressData: ProgressData) => void;
  onComplete: (data: any) => void;
  onError: (error: string) => void;
} 