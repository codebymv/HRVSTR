# HRVSTR API CORS Configuration

## Overview

Cross-Origin Resource Sharing (CORS) is a critical security mechanism that allows the HRVSTR frontend application to make API requests to the backend server when they are hosted on different domains or ports. This document outlines the CORS configuration implemented in the HRVSTR API.

## CORS Implementation

The HRVSTR API implements CORS using the `cors` middleware for Express.js. This configuration ensures that only approved origins can access the API resources while preventing unauthorized cross-origin requests.

### Middleware Implementation

```javascript
// CORS middleware configuration in Express
const express = require('express');
const cors = require('cors');
const app = express();

// Determine allowed origins based on environment
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://hrvstr.finance']
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Configure CORS middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('CORS policy violation: Origin not allowed'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));
```

## Configuration Options

The HRVSTR API's CORS configuration includes the following settings:

### 1. Allowed Origins

Controls which domains can access the API:

- **Development**: `http://localhost:5173`, `http://127.0.0.1:5173`
- **Production**: `https://hrvstr.finance`

### 2. Allowed Methods

HTTP methods permitted in cross-origin requests:

- GET: For data retrieval operations
- POST: For data creation and processing operations
- PUT: For data update operations
- DELETE: For data deletion operations
- OPTIONS: For CORS preflight requests

### 3. Allowed Headers

Headers that can be used in requests:

- `Content-Type`: Specifies the content type of the request body
- `Authorization`: Used for authentication tokens
- `X-API-Key`: Used for API key authentication

### 4. Credentials

The `credentials: true` setting allows cookies, authorization headers, and TLS client certificates to be included in cross-origin requests.

### 5. Max Age

The `maxAge: 86400` setting specifies how long (in seconds) the results of a preflight request can be cached. In this case, 24 hours.

## Preflight Requests

For certain types of requests, browsers will first send an OPTIONS request (preflight) to check if the CORS protocol is understood and if the actual request is permitted. The server responds with headers indicating which origins, methods, and headers are allowed.

### Example Preflight Request

```
OPTIONS /api/v1/sentiment/AAPL HTTP/1.1
Host: api.hrvstr.finance
Origin: https://hrvstr.finance
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, X-API-Key
```

### Example Preflight Response

```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://hrvstr.finance
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
Vary: Origin
```

## CORS Error Handling

When a request violates the CORS policy, the API returns a 403 Forbidden response:

```javascript
// Error handling for CORS violations
app.use((err, req, res, next) => {
  if (err.message.includes('CORS policy violation')) {
    return res.status(403).json({
      error: true,
      message: 'CORS policy violation: Origin not allowed',
      code: 'CORS_ERROR',
      status: 403
    });
  }
  next(err);
});
```

## Environment-Specific Configurations

CORS settings are environment-specific to accommodate different security requirements:

### Development Environment

- Relaxed CORS settings to facilitate local development
- Multiple localhost origins allowed
- Detailed error messages for troubleshooting

### Production Environment

- Strict CORS settings to enhance security
- Only the official production domain allowed
- Limited error information to prevent information leakage

## Testing CORS Configuration

To verify CORS configuration is working correctly:

1. **Browser Test**:
   ```javascript
   // Test from the browser console on a different origin
   fetch('https://api.hrvstr.finance/api/v1/health', {
     method: 'GET',
     headers: {
       'X-API-Key': 'your-api-key'
     }
   })
   .then(response => response.json())
   .then(data => console.log(data))
   .catch(error => console.error('Error:', error));
   ```

2. **curl Test**:
   ```bash
   # Simulate a CORS preflight request
   curl -i -X OPTIONS \
     -H "Origin: https://hrvstr.finance" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-API-Key, Content-Type" \
     https://api.hrvstr.finance/api/v1/sentiment/AAPL
   ```

## Security Considerations

While CORS is necessary for modern web applications, it's important to maintain proper security:

1. **Specific Origin Listing**: Always specify exact origins rather than using wildcards
2. **Credentials Handling**: Only enable credentials for trusted origins
3. **Minimal Method Exposure**: Only expose HTTP methods that are actually needed
4. **Regular Review**: Periodically review and update CORS settings as application needs change
5. **Environment Variables**: Store allowed origins in environment variables for easier management

## Troubleshooting CORS Issues

Common CORS issues and solutions:

1. **Missing Headers**: Ensure the server is returning all required CORS headers
2. **Origin Mismatch**: Check that the request origin exactly matches an allowed origin
3. **Preflight Failures**: Verify that OPTIONS requests are handled correctly
4. **Credentials Issues**: Ensure both client and server have matching credentials settings
5. **Header Problems**: Confirm that all required custom headers are included in `allowedHeaders`
