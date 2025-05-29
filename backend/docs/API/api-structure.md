# HRVSTR API Structure

## Architecture Overview

The HRVSTR API follows a modular architecture designed for flexibility, maintainability, and scalability. It uses Node.js with Express as its foundation and employs a layered approach to separate concerns effectively.

```
Client Application
      ↓ ↑
    HTTP/S
      ↓ ↑
+-------------+
|   Express   |     ← Middleware (CORS, Rate Limiting, Auth, Error Handling)
+-------------+
      ↓ ↑
+-------------+
|   Routes    |     ← URL Endpoints & Request Routing
+-------------+
      ↓ ↑
+-------------+
| Controllers |     ← Business Logic & Request Handling
+-------------+
      ↓ ↑
+-------------+
|  Services   |     ← External API Integration & Data Processing
+-------------+
      ↓ ↑
  External APIs    ← SEC, Reddit, FinViz, etc.
```

## Directory Structure

The API codebase is organized as follows:

```
src/
├── config/               # Configuration files and environment setup
├── controllers/          # Request handlers for each endpoint
│   ├── earningsController.js
│   ├── finvizController.js
│   ├── redditController.js
│   ├── secController.js
│   └── sentimentController.js
├── middleware/           # Express middleware functions
│   ├── auth.js           # Authentication middleware
│   ├── errorHandler.js   # Centralized error handling
│   └── rateLimiter.js    # Rate limiting implementation
├── routes/               # Route definitions and HTTP method handlers
│   └── proxy/            # Proxy routes for external APIs
│       ├── earnings.js   # Earnings data endpoints
│       ├── finviz.js     # FinViz data endpoints
│       ├── reddit.js     # Reddit API endpoints
│       ├── sec.js        # SEC EDGAR endpoints
│       └── sentiment.js  # Sentiment analysis endpoints
├── services/             # Business logic and external API integration
│   ├── sec/              # SEC EDGAR integration services
│   │   ├── parsers/      # SEC filing parsers
│   │   └── extractors/   # Data extraction utilities
│   ├── reddit/           # Reddit API integration
│   └── finviz/           # FinViz scraping utilities
├── utils/                # Utility functions and helpers
│   ├── cacheManager.js   # Data caching utilities
│   ├── sentiment.js      # Sentiment analysis utilities
│   └── reddit.js         # Reddit-specific utilities
└── index.js              # Main application entry point
```

## Component Responsibilities

### 1. Routes

Routes define the API endpoints and map HTTP methods to controller functions. They handle URL parameter parsing and request validation.

Example route definition:
```javascript
// src/routes/proxy/reddit.js
const express = require('express');
const router = express.Router();
const redditController = require('../../controllers/redditController');

// Get Reddit posts for a specific subreddit
router.get('/r/:subreddit/posts', redditController.getSubredditPosts);

// Get sentiment analysis for a ticker from Reddit data
router.get('/sentiment/:ticker', redditController.getTickerSentiment);

module.exports = router;
```

### 2. Controllers

Controllers contain request handling logic, parameter validation, and coordinate between multiple services. They transform external requests into internal actions and format responses.

Example controller:
```javascript
// src/controllers/redditController.js
const redditService = require('../services/reddit/redditService');
const cacheManager = require('../utils/cacheManager');

exports.getSubredditPosts = async (req, res, next) => {
  try {
    const { subreddit } = req.params;
    const { timeRange = '1w', limit = 100 } = req.query;
    
    // Get cached or fresh data
    const cacheKey = `reddit-${subreddit}-${timeRange}-${limit}`;
    const cachedData = await cacheManager.get(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }
    
    // Fetch from Reddit API
    const posts = await redditService.getPosts(subreddit, timeRange, limit);
    
    // Cache response
    await cacheManager.set(cacheKey, posts, 3600); // 1 hour TTL
    
    res.json(posts);
  } catch (error) {
    next(error);
  }
};
```

### 3. Services

Services encapsulate the business logic, external API interactions, and data transformations. They are independent of the HTTP layer and focus on domain-specific operations.

Example service:
```javascript
// src/services/reddit/redditService.js
const fetch = require('node-fetch');
const authService = require('./authService');

exports.getPosts = async (subreddit, timeRange, limit) => {
  // Get or refresh access token
  const accessToken = await authService.getAccessToken();
  
  // Make authenticated request to Reddit API
  const response = await fetch(
    `https://oauth.reddit.com/r/${subreddit}/top?t=${timeRange}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'HRVSTR/1.0'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Transform response to our standard format
  return data.data.children.map(post => ({
    id: post.data.id,
    title: post.data.title,
    author: post.data.author,
    created: post.data.created_utc,
    score: post.data.score,
    commentCount: post.data.num_comments,
    url: post.data.url
  }));
};
```

### 4. Middleware

Middleware functions handle cross-cutting concerns like authentication, logging, error handling, and rate limiting.

Example middleware:
```javascript
// src/middleware/errorHandler.js
module.exports = (err, req, res, next) => {
  // Log error details
  console.error('API Error:', err);
  
  // Determine response status code
  const statusCode = err.statusCode || 500;
  
  // Format error response
  const errorResponse = {
    error: true,
    message: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
    status: statusCode
  };
  
  // Include stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
};
```

### 5. Configuration

Configuration files manage environment-specific settings, constants, and external API credentials.

Example configuration:
```javascript
// src/config/redditConfig.js
require('dotenv').config();

module.exports = {
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  userAgent: 'HRVSTR/1.0',
  refreshToken: process.env.REDDIT_REFRESH_TOKEN,
  tokenExpiryBuffer: 300, // seconds before expiry to refresh
  requestTimeout: 10000,  // ms
  defaultSubreddits: ['wallstreetbets', 'investing', 'stocks']
};
```

## Request Flow

1. **Client Request**: Frontend makes a request to an API endpoint
2. **Middleware Processing**: Request passes through CORS, authentication, and other middleware
3. **Route Matching**: Express matches the URL to the appropriate route handler
4. **Controller Processing**: Controller validates input and coordinates the response
5. **Service Execution**: Services perform business logic and external API calls
6. **Response Formatting**: Controller formats the data for response
7. **Error Handling**: Any errors are caught and formatted by the error middleware
8. **Client Response**: Formatted response returned to the client

## API Versioning Strategy

The API uses URL-based versioning (e.g., `/api/v1/sentiment`) to manage changes over time:

1. **Major Versions (v1, v2)**: For breaking changes or significant architectural shifts
2. **Minor Updates**: Non-breaking changes are made within the same major version
3. **Deprecation Policy**: Older versions are supported for a minimum of 6 months after a new version is released
4. **Documentation**: Each version has separate documentation with migration guides

## Future Architecture Considerations

The current architecture can evolve in several directions:

1. **Microservices**: Splitting the proxy routes into dedicated microservices
2. **GraphQL**: Adding a GraphQL layer for more flexible data querying
3. **WebSockets**: Real-time updates for rapidly changing financial data
4. **Worker Processes**: Moving heavy processing to background workers
5. **Serverless Functions**: Migrating specific endpoints to serverless architecture
