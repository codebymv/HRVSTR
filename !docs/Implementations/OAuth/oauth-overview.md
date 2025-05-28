# OAuth Overview - HRVSTR Authentication Flow

## Introduction

HRVSTR implements OAuth 2.0 authentication flows to securely access external financial data APIs. The primary OAuth implementation is for Reddit API access to gather financial sentiment data from subreddits like r/wallstreetbets, r/stocks, and r/investing.

## OAuth 2.0 Flow Types Used

### 1. Client Credentials Flow (Primary)
Used for server-to-server communication with Reddit API for public data access.

### 2. Authorization Code Flow (Future Enhancement)
Planned for user authentication and personalized data access.

## Reddit API OAuth Implementation

### Authentication Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   HRVSTR API    │    │   Reddit API    │    │   Redis Cache   │
│                 │    │                 │    │                 │
│  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────┐  │
│  │   OAuth   │◄─┼────┼─►│   OAuth   │  │    │  │   Token   │  │
│  │ Manager   │  │    │  │  Server   │  │    │  │   Store   │  │
│  └───────────┘  │    │  └───────────┘  │    │  └───────────┘  │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### OAuth Configuration

#### Environment Variables
```env
# Reddit OAuth Configuration
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=HRVSTR/1.0 (your.email@example.com)
REDDIT_BASE_URL=https://www.reddit.com
REDDIT_OAUTH_URL=https://www.reddit.com/api/v1/access_token
```

#### OAuth Client Setup
```typescript
// src/services/reddit/oauth.ts
import axios from 'axios';
import { CacheManager } from '../../utils/cache';

export class RedditOAuthService {
  private static clientId = process.env.REDDIT_CLIENT_ID!;
  private static clientSecret = process.env.REDDIT_CLIENT_SECRET!;
  private static userAgent = process.env.REDDIT_USER_AGENT!;
  private static baseUrl = process.env.REDDIT_BASE_URL!;
  private static oauthUrl = process.env.REDDIT_OAUTH_URL!;
  
  private static readonly CACHE_KEY = 'reddit:oauth:token';
  private static readonly TOKEN_TTL = 3600; // 1 hour
  
  /**
   * Get access token using Client Credentials flow
   */
  static async getAccessToken(): Promise<string> {
    // Check cache first
    const cachedToken = await CacheManager.get(this.CACHE_KEY);
    if (cachedToken && cachedToken.expires_at > Date.now()) {
      return cachedToken.access_token;
    }
    
    // Request new token
    const token = await this.requestNewToken();
    
    // Cache the token
    await CacheManager.set(this.CACHE_KEY, {
      access_token: token.access_token,
      expires_at: Date.now() + (token.expires_in * 1000) - 60000 // 1 min buffer
    }, this.TOKEN_TTL);
    
    return token.access_token;
  }
  
  /**
   * Request new access token from Reddit OAuth server
   */
  private static async requestNewToken(): Promise<any> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    try {
      const response = await axios.post(this.oauthUrl, 
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'User-Agent': this.userAgent,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      if (response.data.access_token) {
        console.log('Reddit OAuth token obtained successfully');
        return response.data;
      } else {
        throw new Error('No access token in response');
      }
    } catch (error) {
      console.error('Reddit OAuth error:', error);
      throw new Error(`Failed to obtain Reddit access token: ${error.message}`);
    }
  }
  
  /**
   * Refresh token if needed
   */
  static async refreshTokenIfNeeded(): Promise<void> {
    const cachedToken = await CacheManager.get(this.CACHE_KEY);
    
    if (!cachedToken || cachedToken.expires_at <= Date.now() + 300000) { // 5 min buffer
      console.log('Refreshing Reddit OAuth token...');
      await this.getAccessToken();
    }
  }
  
  /**
   * Validate current token
   */
  static async validateToken(token: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': this.userAgent
        }
      });
      
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}
```

## Client Credentials Flow (Reddit API)

### Flow Diagram
```
┌─────────────┐                    ┌─────────────┐
│   HRVSTR    │                    │   Reddit    │
│   Backend   │                    │   OAuth     │
│             │                    │   Server    │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ 1. Request Access Token          │
       │ POST /api/v1/access_token        │
       │ grant_type=client_credentials    │
       │ Authorization: Basic <encoded>   │
       ├─────────────────────────────────►│
       │                                  │
       │ 2. Access Token Response         │
       │ {                                │
       │   "access_token": "...",         │
       │   "token_type": "bearer",        │
       │   "expires_in": 3600             │
       │ }                                │
       │◄─────────────────────────────────┤
       │                                  │
       │ 3. API Requests with Token       │
       │ Authorization: Bearer <token>    │
       │ GET /r/wallstreetbets/hot        │
       ├─────────────────────────────────►│
       │                                  │
       │ 4. Protected Resource Response   │
       │◄─────────────────────────────────┤
       │                                  │
```

### Implementation Details

#### 1. Token Request
```typescript
// Token request implementation
const requestToken = async (): Promise<OAuthToken> => {
  const credentials = `${clientId}:${clientSecret}`;
  const encodedCredentials = Buffer.from(credentials).toString('base64');
  
  const response = await axios.post('https://www.reddit.com/api/v1/access_token', 
    'grant_type=client_credentials',
    {
      headers: {
        'Authorization': `Basic ${encodedCredentials}`,
        'User-Agent': 'HRVSTR/1.0 (contact@hrvstr.com)',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  
  return {
    access_token: response.data.access_token,
    token_type: response.data.token_type,
    expires_in: response.data.expires_in,
    expires_at: Date.now() + (response.data.expires_in * 1000)
  };
};
```

#### 2. Token Caching Strategy
```typescript
// Token caching with Redis
export class TokenManager {
  private static readonly CACHE_PREFIX = 'oauth:reddit:';
  
  static async storeToken(token: OAuthToken): Promise<void> {
    const key = `${this.CACHE_PREFIX}token`;
    const ttl = token.expires_in - 60; // 1 minute buffer
    
    await CacheManager.set(key, {
      access_token: token.access_token,
      expires_at: token.expires_at
    }, ttl);
  }
  
  static async getValidToken(): Promise<string | null> {
    const key = `${this.CACHE_PREFIX}token`;
    const tokenData = await CacheManager.get(key);
    
    if (tokenData && tokenData.expires_at > Date.now()) {
      return tokenData.access_token;
    }
    
    return null;
  }
}
```

#### 3. Authenticated API Requests
```typescript
// Reddit API service with OAuth
export class RedditAPIService {
  static async makeAuthenticatedRequest(endpoint: string): Promise<any> {
    const token = await RedditOAuthService.getAccessToken();
    
    try {
      const response = await axios.get(`${process.env.REDDIT_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': process.env.REDDIT_USER_AGENT!
        },
        timeout: 10000
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        // Token expired, clear cache and retry
        await CacheManager.del('reddit:oauth:token');
        const newToken = await RedditOAuthService.getAccessToken();
        
        const retryResponse = await axios.get(`${process.env.REDDIT_BASE_URL}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'User-Agent': process.env.REDDIT_USER_AGENT!
          }
        });
        
        return retryResponse.data;
      }
      
      throw error;
    }
  }
}
```

## Error Handling & Retry Logic

### OAuth Error Types
```typescript
export enum OAuthErrorType {
  INVALID_CLIENT = 'invalid_client',
  INVALID_GRANT = 'invalid_grant',
  INVALID_REQUEST = 'invalid_request',
  UNAUTHORIZED_CLIENT = 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE = 'unsupported_grant_type',
  NETWORK_ERROR = 'network_error',
  TOKEN_EXPIRED = 'token_expired'
}

export class OAuthError extends Error {
  constructor(
    public type: OAuthErrorType,
    public message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}
```

### Retry Strategy
```typescript
export class OAuthRetryHandler {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second
  
  static async withRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        console.warn(`OAuth operation failed, retrying... (${retries} attempts left)`);
        await this.delay(this.RETRY_DELAY);
        return this.withRetry(operation, retries - 1);
      }
      
      throw error;
    }
  }
  
  private static isRetryableError(error: any): boolean {
    // Retry on network errors or 5xx server errors
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      (error.response && error.response.status >= 500)
    );
  }
  
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Security Considerations

### 1. Client Credentials Protection
```typescript
// Secure credential handling
export class CredentialManager {
  static validateCredentials(): void {
    const requiredVars = [
      'REDDIT_CLIENT_ID',
      'REDDIT_CLIENT_SECRET',
      'REDDIT_USER_AGENT'
    ];
    
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing OAuth credentials: ${missing.join(', ')}`);
    }
    
    // Validate credential format
    if (process.env.REDDIT_CLIENT_ID!.length < 10) {
      throw new Error('Reddit client ID appears invalid');
    }
    
    if (process.env.REDDIT_CLIENT_SECRET!.length < 20) {
      throw new Error('Reddit client secret appears invalid');
    }
  }
}
```

### 2. Token Security
- Tokens are stored in Redis with automatic expiration
- No tokens are logged or exposed in error messages
- Tokens are transmitted only over HTTPS in production
- Failed authentication attempts are logged for monitoring

### 3. Rate Limiting Compliance
```typescript
// Reddit API rate limiting
export class RedditRateLimiter {
  private static requestQueue: Array<() => Promise<any>> = [];
  private static isProcessing = false;
  private static readonly RATE_LIMIT_DELAY = 1000; // 1 request per second
  
  static async queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }
  
  private static async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      await request();
      
      // Rate limiting delay
      if (this.requestQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY));
      }
    }
    
    this.isProcessing = false;
  }
}
```

## Testing OAuth Implementation

### Unit Tests
```typescript
// OAuth service tests
describe('RedditOAuthService', () => {
  beforeEach(() => {
    // Mock environment variables
    process.env.REDDIT_CLIENT_ID = 'test_client_id';
    process.env.REDDIT_CLIENT_SECRET = 'test_client_secret';
    process.env.REDDIT_USER_AGENT = 'TestApp/1.0';
  });
  
  it('should obtain access token successfully', async () => {
    // Mock successful token response
    const mockResponse = {
      data: {
        access_token: 'mock_token_12345',
        token_type: 'bearer',
        expires_in: 3600
      }
    };
    
    jest.spyOn(axios, 'post').mockResolvedValue(mockResponse);
    
    const token = await RedditOAuthService.getAccessToken();
    
    expect(token).toBe('mock_token_12345');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('access_token'),
      'grant_type=client_credentials',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('Basic ')
        })
      })
    );
  });
  
  it('should handle OAuth errors gracefully', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(new Error('Network error'));
    
    await expect(RedditOAuthService.getAccessToken()).rejects.toThrow();
  });
});
```

### Integration Tests
```typescript
// Integration test for Reddit API with OAuth
describe('Reddit API Integration', () => {
  it('should authenticate and fetch subreddit data', async () => {
    const data = await RedditAPIService.makeAuthenticatedRequest('/r/wallstreetbets/hot.json');
    
    expect(data).toBeDefined();
    expect(data.data).toBeDefined();
    expect(data.data.children).toBeInstanceOf(Array);
  });
});
```

## Monitoring & Logging

### OAuth Event Logging
```typescript
export class OAuthLogger {
  static logTokenRequest(success: boolean, error?: string): void {
    const logData = {
      event: 'oauth_token_request',
      success,
      timestamp: new Date().toISOString(),
      ...(error && { error })
    };
    
    console.log('[OAUTH]', JSON.stringify(logData));
  }
  
  static logTokenRefresh(): void {
    console.log('[OAUTH] Token refreshed successfully');
  }
  
  static logAuthFailure(endpoint: string, error: string): void {
    console.warn('[OAUTH] Authentication failed', {
      endpoint,
      error,
      timestamp: new Date().toISOString()
    });
  }
}
```

## Future Enhancements

### 1. Authorization Code Flow
For user-specific data access:
```typescript
// Future implementation for user authentication
export class UserOAuthService {
  static generateAuthURL(state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.REDDIT_CLIENT_ID!,
      response_type: 'code',
      state,
      redirect_uri: process.env.REDDIT_REDIRECT_URI!,
      duration: 'permanent',
      scope: 'read,identity'
    });
    
    return `https://www.reddit.com/api/v1/authorize?${params.toString()}`;
  }
  
  static async exchangeCodeForToken(code: string): Promise<OAuthToken> {
    // Implementation for authorization code exchange
  }
}
```

### 2. Multiple OAuth Providers
Framework for adding additional financial data sources:
- FinViz OAuth (if available)
- SEC.gov authentication
- Yahoo Finance OAuth
- Alpha Vantage API keys

This OAuth implementation ensures secure, reliable access to Reddit's financial discussion data while providing a foundation for future authentication needs in the HRVSTR platform. 