import { AUTH_CONFIG, getApiUrl, isTokenExpiringSoon, formatExpiryTime } from '../config/auth';
import axios from 'axios';

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user?: any;
}

export class TokenManager {
  /**
   * Store tokens in localStorage
   */
  static storeTokens(tokenData: TokenData): void {
    try {
      localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_TOKEN, tokenData.accessToken);
      localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.TOKEN_EXPIRY, formatExpiryTime(tokenData.expiresIn));
      
      if (tokenData.refreshToken) {
        localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.REFRESH_TOKEN, tokenData.refreshToken);
      }
      
      if (tokenData.user) {
        localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(tokenData.user));
      }
      
      console.log(`[TokenManager] Tokens stored. Expires in ${tokenData.expiresIn} seconds`);
    } catch (error) {
      console.error('[TokenManager] Error storing tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  /**
   * Retrieve stored tokens
   */
  static getStoredTokens(): { accessToken: string | null; refreshToken: string | null; expiryTime: number | null } {
    try {
      const accessToken = localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      const refreshToken = localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
      const expiryTimeString = localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.TOKEN_EXPIRY);
      
      const expiryTime = expiryTimeString ? parseInt(expiryTimeString) : null;
      
      return { accessToken, refreshToken, expiryTime };
    } catch (error) {
      console.error('[TokenManager] Error retrieving tokens:', error);
      return { accessToken: null, refreshToken: null, expiryTime: null };
    }
  }

  /**
   * Check if current access token is valid (not expired)
   */
  static isAccessTokenValid(): boolean {
    const { accessToken, expiryTime } = this.getStoredTokens();
    
    if (!accessToken || !expiryTime) {
      return false;
    }
    
    return Date.now() < expiryTime;
  }

  /**
   * Check if access token is expiring soon and needs refresh
   */
  static shouldRefreshToken(): boolean {
    const { accessToken, expiryTime } = this.getStoredTokens();
    
    if (!accessToken || !expiryTime) {
      return false;
    }
    
    return isTokenExpiringSoon(expiryTime);
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(): Promise<TokenData | null> {
    const { accessToken, refreshToken } = this.getStoredTokens();
    
    if (!accessToken) {
      console.log('[TokenManager] No access token available for refresh');
      return null;
    }

    try {
      console.log('[TokenManager] Attempting to refresh access token...');
      
      const response = await axios.post(`${getApiUrl()}${AUTH_CONFIG.ENDPOINTS.REFRESH_TOKEN}`, {
        token: accessToken
      });

      const tokenData: TokenData = {
        accessToken: response.data.token,
        refreshToken: response.data.refreshToken,
        expiresIn: response.data.expiresIn,
        user: response.data.user
      };

      // Store the new tokens
      this.storeTokens(tokenData);
      
      console.log('[TokenManager] Access token refreshed successfully');
      return tokenData;
    } catch (error) {
      console.error('[TokenManager] Token refresh failed:', error);
      
      // Clear invalid tokens
      this.clearTokens();
      return null;
    }
  }

  /**
   * Clear all stored tokens
   */
  static clearTokens(): void {
    try {
      localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.TOKEN_EXPIRY);
      localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.USER_DATA);
      
      console.log('[TokenManager] All tokens cleared');
    } catch (error) {
      console.error('[TokenManager] Error clearing tokens:', error);
    }
  }

  /**
   * Get stored user data
   */
  static getStoredUser(): any | null {
    try {
      const userData = localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('[TokenManager] Error parsing stored user data:', error);
      return null;
    }
  }

  /**
   * Get current access token for API requests
   */
  static getAccessToken(): string | null {
    const { accessToken } = this.getStoredTokens();
    return accessToken;
  }

  /**
   * Check token status and return detailed information
   */
  static getTokenStatus(): {
    isValid: boolean;
    shouldRefresh: boolean;
    expiresAt: Date | null;
    timeUntilExpiry: number | null;
  } {
    const { expiryTime } = this.getStoredTokens();
    
    if (!expiryTime) {
      return {
        isValid: false,
        shouldRefresh: false,
        expiresAt: null,
        timeUntilExpiry: null
      };
    }

    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;
    
    return {
      isValid: timeUntilExpiry > 0,
      shouldRefresh: isTokenExpiringSoon(expiryTime),
      expiresAt: new Date(expiryTime),
      timeUntilExpiry: timeUntilExpiry
    };
  }

  /**
   * Auto-refresh token if needed
   */
  static async autoRefreshIfNeeded(): Promise<boolean> {
    if (!this.shouldRefreshToken()) {
      return true; // Token is still valid, no refresh needed
    }

    const refreshResult = await this.refreshAccessToken();
    return refreshResult !== null;
  }
} 