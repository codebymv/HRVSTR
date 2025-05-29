# HRVSTR API Authentication

## Overview

The HRVSTR API uses modern JWT (JSON Web Token) authentication with Google OAuth integration. This system provides secure, long-lived sessions with automatic token refresh capabilities, replacing the previous API key system.

## Authentication Flow

### Google OAuth Integration

The primary authentication method is Google OAuth 2.0:

1. **Frontend Initiation**: User clicks "Sign in with Google"
2. **Google OAuth**: User authenticates with Google
3. **Token Exchange**: Frontend receives Google credentials
4. **Backend Processing**: Backend validates Google token and creates user account
5. **JWT Generation**: Backend generates access and refresh tokens
6. **Session Establishment**: Tokens stored securely in frontend

### Token Types

#### Access Tokens
- **Purpose**: Authenticate API requests
- **Expiry**: 7 days (extended for better UX)
- **Format**: JWT with user information
- **Usage**: Include in Authorization header

#### Refresh Tokens
- **Purpose**: Generate new access tokens
- **Expiry**: 30 days
- **Storage**: LocalStorage (HttpOnly cookies recommended for production)
- **Usage**: Automatic refresh via interceptors

## Authentication Implementation

### Google Login Endpoint

```http
POST /api/auth/google-login
```

**Request Body:**
```json
{
  "googleId": "google_user_id",
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://lh3.googleusercontent.com/..."
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800,
  "user": {
    "id": "uuid",
    "name": "User Name",
    "email": "user@example.com",
    "picture": "https://lh3.googleusercontent.com/..."
  }
}
```

### Token Refresh Endpoint

```http
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "token": "expired_or_expiring_access_token"
}
```

**Response:**
```json
{
  "token": "new_access_token",
  "refreshToken": "new_refresh_token",
  "expiresIn": 604800,
  "user": {
    "id": "uuid",
    "name": "User Name",
    "email": "user@example.com"
  }
}
```

### User Profile Endpoint

```http
GET /api/auth/profile
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "tier": "free",
  "credits_remaining": 50,
  "credits_monthly_limit": 50,
  "created_at": "2024-01-01T00:00:00Z",
  "subscription_status": "active"
}
```

## Frontend Authentication

### Token Storage and Management

```javascript
// Token storage in localStorage
const AUTH_CONFIG = {
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    REFRESH_TOKEN: 'refresh_token',
    TOKEN_EXPIRY: 'token_expiry',
    USER_DATA: 'user'
  }
};

// Store tokens after login
const storeTokens = (tokenData) => {
  localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_TOKEN, tokenData.token);
  localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.REFRESH_TOKEN, tokenData.refreshToken);
  localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.TOKEN_EXPIRY, 
    (Date.now() + tokenData.expiresIn * 1000).toString());
  localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER_DATA, 
    JSON.stringify(tokenData.user));
};
```

### Automatic Token Refresh

```javascript
// Axios interceptor for automatic token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshResult = await refreshToken();
        if (refreshResult) {
          originalRequest.headers['Authorization'] = `Bearer ${refreshResult.token}`;
          return axios(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

### Making Authenticated Requests

```javascript
// Include JWT token in requests
const fetchUserData = async () => {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch('/api/auth/profile', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  return await response.json();
};
```

## Backend Authentication Middleware

### JWT Verification

```javascript
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};
```

### Token Generation

```javascript
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: '7d' }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' }, 
    process.env.JWT_SECRET, 
    { expiresIn: '30d' }
  );
  
  return { accessToken, refreshToken };
};
```

## Session Management Features

### Extended Session Duration
- **7-day access tokens**: Reduces need for frequent re-authentication
- **30-day refresh tokens**: Enables month-long sessions
- **Automatic refresh**: Seamless token renewal before expiration

### Smart Refresh Logic
- **Daily checks**: Token validity checked every 24 hours
- **Expiration buffer**: Refresh 1 day before expiry
- **Error handling**: Graceful fallback to re-authentication

### Cross-Session Persistence
- **Browser restart survival**: Sessions persist across browser restarts
- **Multiple tab support**: Shared session state across tabs
- **Background refresh**: Automatic token refresh even when app is inactive

## Security Considerations

### Token Security
- **Server-side validation**: All tokens validated server-side
- **Short-lived access tokens**: Despite 7-day expiry, tokens are refreshed regularly
- **Secure storage**: Tokens stored in localStorage (consider HttpOnly cookies for production)
- **No credentials in URL**: Tokens never passed in query parameters

### Protection Against Attacks
- **CSRF Protection**: JWT tokens in Authorization header prevent CSRF
- **XSS Mitigation**: Sanitize all user inputs and outputs
- **Replay Attack Prevention**: Token expiration limits replay window
- **Rate Limiting**: Authentication endpoints are rate-limited

### Production Security Enhancements

```javascript
// Recommended production setup
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://accounts.google.com"]
    }
  }
}));

// Use HttpOnly cookies for refresh tokens
res.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
});
```

## Error Handling

### Authentication Errors

| Status Code | Error | Description |
|-------------|-------|-------------|
| 401 | `Access token required` | No token provided |
| 403 | `Invalid or expired token` | Token verification failed |
| 401 | `Token refresh failed` | Refresh token invalid/expired |

### Example Error Response

```json
{
  "message": "Invalid or expired token",
  "status": 403
}
```

## Environment Configuration

Required environment variables:

```bash
# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Google OAuth (for frontend)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

## Migration from API Key Authentication

The system has migrated from API key to JWT authentication:

### Legacy API Key System (Deprecated)
```javascript
// Old system - no longer used
headers: {
  'X-API-Key': 'your_api_key_here'
}
```

### New JWT System
```javascript
// Current system
headers: {
  'Authorization': `Bearer ${jwt_token}`
}
```

## User Tier Integration

Authentication integrates with the tier system:

```javascript
// Middleware can access user tier
const checkTierAccess = (requiredTier) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const user = await getUserById(req.user.userId);
    if (!hasTierAccess(user.tier, requiredTier)) {
      return res.status(403).json({ message: 'Insufficient tier access' });
    }
    
    req.userTier = user.tier;
    next();
  };
};
```

## Development vs Production

### Development Settings
- More verbose error messages
- Longer token expiry for testing
- Local Google OAuth redirect URLs

### Production Settings
- Secure cookie settings
- Shorter error messages
- Production OAuth configuration
- Enhanced security headers

## Monitoring and Logging

### Authentication Metrics
- Login success/failure rates
- Token refresh frequency
- Session duration analytics
- Geographic login patterns

### Security Monitoring
- Failed authentication attempts
- Unusual access patterns
- Token usage anomalies
- Potential security threats

## Related Files

- `backend/src/routes/auth.js` - Authentication endpoints
- `backend/src/middleware/authMiddleware.js` - JWT verification middleware
- `frontend/src/contexts/AuthContext.tsx` - Frontend authentication context
- `frontend/src/config/auth.ts` - Authentication configuration
- `frontend/src/utils/tokenManager.ts` - Token management utilities

## Future Enhancements

### Planned Security Improvements
1. **HttpOnly Cookies**: Move refresh tokens to secure cookies
2. **Multi-Factor Authentication**: Add 2FA for enhanced security
3. **Device Management**: Track and manage user devices
4. **Session Analytics**: Advanced session monitoring and analytics
5. **OAuth Providers**: Support for additional OAuth providers
