// Authentication configuration
export const AUTH_CONFIG = {
  // Token expiry times (in milliseconds)
  ACCESS_TOKEN_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 days
  REFRESH_TOKEN_EXPIRY: 30 * 24 * 60 * 60 * 1000, // 30 days
  
  // Refresh intervals and buffers
  REFRESH_CHECK_INTERVAL: 24 * 60 * 60 * 1000, // Check every 24 hours
  EXPIRATION_BUFFER: 24 * 60 * 60 * 1000, // Refresh 1 day before expiry
  
  // LocalStorage keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    REFRESH_TOKEN: 'refresh_token',
    TOKEN_EXPIRY: 'token_expiry',
    USER_DATA: 'user',
    POST_SIGNIN_REDIRECT: 'post_signin_redirect'
  },
  
  // API endpoints
  ENDPOINTS: {
    GOOGLE_LOGIN: '/api/auth/google-login',
    REFRESH_TOKEN: '/api/auth/refresh',
    LOGOUT: '/api/auth/logout',
    PROFILE: '/api/auth/profile'
  },
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY_MS: 1000,
    BACKOFF_FACTOR: 2
  }
} as const;

// Helper function to get API URL
export const getApiUrl = (): string => {
  return import.meta.env.VITE_API_URL || 'http://localhost:3001';
};

// Helper function to check if token is expiring soon
export const isTokenExpiringSoon = (expiryTime: number): boolean => {
  return Date.now() >= expiryTime - AUTH_CONFIG.EXPIRATION_BUFFER;
};

// Helper function to format expiry time for storage
export const formatExpiryTime = (expiresInSeconds: number): string => {
  return (Date.now() + (expiresInSeconds * 1000)).toString();
}; 