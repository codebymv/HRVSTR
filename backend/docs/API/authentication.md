# HRVSTR API Authentication

## Overview

The HRVSTR API employs multiple authentication mechanisms to secure both its own endpoints and its interaction with third-party APIs. This document outlines the authentication strategies implemented by the HRVSTR backend.

## API Key Authentication

### Client-to-HRVSTR Authentication

For frontend applications to access the HRVSTR API, a simple API key authentication system is implemented:

1. **Header-Based Authentication**:
   ```
   X-API-Key: your_api_key_here
   ```

2. **Key Generation and Management**:
   - API keys are generated for authorized users
   - Keys are stored securely in the backend
   - Keys can be revoked or rotated as needed

3. **Protected Endpoints**:
   - `/api/v1/settings/*` - All settings endpoints
   - Any endpoints that expose sensitive information

### Example Usage

```javascript
// Example of authenticating a request to the HRVSTR API
const fetchSentimentData = async (ticker) => {
  const response = await fetch(`http://localhost:3001/api/v1/sentiment/${ticker}`, {
    headers: {
      'X-API-Key': 'your_api_key_here'
    }
  });
  
  return await response.json();
};
```

## Third-Party API Authentication

The HRVSTR backend manages authentication with external APIs on behalf of the application to keep credentials secure.

### Reddit API Authentication

1. **OAuth 2.0 Implementation**:
   - Uses client credentials flow
   - Automatically refreshes access tokens
   - Stores credentials securely server-side

2. **Configuration**:
   - `REDDIT_CLIENT_ID`: Reddit application client ID
   - `REDDIT_CLIENT_SECRET`: Reddit application client secret
   - `REDDIT_USER_AGENT`: Custom user agent for API requests

3. **Token Management**:
   - Access tokens cached for their lifetime
   - Automatic refresh before expiration
   - Error handling for authentication failures

### SEC EDGAR Authentication

1. **User Agent Requirements**:
   - SEC EDGAR requires identifying user agents
   - No formal authentication but proper identification required

2. **Configuration**:
   - `SEC_USER_AGENT`: User agent string including company name and contact info

### FinViz Scraping Authentication

1. **Request Headers**:
   - Proper browser-like headers to avoid blocking
   - No formal authentication required

2. **IP Rotation** (if implemented):
   - Rotate IP addresses to avoid rate limiting 
   - Use of proxy services if needed

## User Settings and API Keys

The HRVSTR platform allows users to provide their own API keys for certain services.

### User-Provided API Keys

1. **Storage**:
   - Keys stored securely in encrypted format
   - Keys never exposed in client-side code

2. **Key Management**:
   - Web interface for users to add/update their keys
   - Validation of keys before storing
   - Option to use platform-provided keys (if available)

### API Key Update Endpoint

```
POST /api/v1/settings/update-keys
```

**Request body**:
```json
{
  "keys": {
    "reddit_client_id": "your_reddit_client_id",
    "reddit_client_secret": "your_reddit_client_secret"
  }
}
```

**Successful response**:
```json
{
  "success": true,
  "message": "API keys updated successfully"
}
```

## Authentication Middleware

The API uses Express middleware to enforce authentication:

```javascript
// Example authentication middleware
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      error: true,
      message: 'API key is required',
      code: 'AUTH_REQUIRED',
      status: 401
    });
  }
  
  // Validate API key against stored keys
  if (!isValidApiKey(apiKey)) {
    return res.status(403).json({
      error: true,
      message: 'Invalid API key',
      code: 'INVALID_KEY',
      status: 403
    });
  }
  
  // Authentication successful, proceed to the next middleware
  next();
};
```

## Security Considerations

1. **HTTPS Enforcement**:
   - All API requests should use HTTPS in production
   - HTTP requests are redirected to HTTPS

2. **Key Rotation Policy**:
   - Regular rotation of internal API keys
   - Automatic expiry of unused keys
   - Immediate revocation capabilities

3. **Rate Limiting**:
   - Prevents brute force attacks on authentication endpoints
   - Graduated timeout for repeated failures
   - IP-based blocking for suspicious activity

4. **Credential Storage**:
   - Environment variables for server-side secrets
   - No credentials in source code
   - Encrypted storage for user-provided keys

5. **Access Logging**:
   - Logging of authentication attempts
   - Audit trail for sensitive operations
   - Anomaly detection for unusual access patterns

## Development vs. Production

Different authentication strategies may be employed in different environments:

1. **Development**:
   - Simplified authentication for local testing
   - Development-specific API keys
   - More verbose error messages

2. **Production**:
   - Strict authentication enforcement
   - Production-specific API keys
   - Limited error information to prevent information leakage

## Future Authentication Enhancements

Potential future enhancements to the authentication system include:

1. **JWT Authentication**:
   - Token-based authentication with JWTs
   - Support for more complex access control

2. **OAuth Integration**:
   - User authentication via OAuth providers
   - User-specific data access

3. **Two-Factor Authentication**:
   - Enhanced security for sensitive operations
   - Time-based one-time passwords (TOTP)

4. **API Key Scopes**:
   - Fine-grained permissions for different API operations
   - Limited-scope keys for different client applications
