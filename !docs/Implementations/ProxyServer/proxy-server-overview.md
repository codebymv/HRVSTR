# Proxy Server Implementation Overview

## Introduction

The HRVSTR application utilizes a custom proxy server as a critical infrastructure component to facilitate secure and efficient communication between the frontend application and various third-party APIs. This document outlines the implementation details, architecture, and benefits of this approach.

## Core Functionality

The proxy server serves as an intermediary layer between the frontend React application and external data sources, fulfilling several key roles:

1. **CORS Mitigation**: Bypasses Cross-Origin Resource Sharing (CORS) restrictions that would otherwise prevent direct browser-to-API communication
2. **API Request Consolidation**: Centralizes all external API calls through a single, controlled gateway
3. **Request Transformation**: Modifies outgoing requests to meet the requirements of various external APIs
4. **Response Normalization**: Standardizes API responses into consistent formats for frontend consumption
5. **Caching Layer**: Provides an additional caching mechanism to reduce redundant API calls
6. **Rate Limiting**: Manages API request frequency to comply with third-party rate limits
7. **Security Enhancement**: Secures API keys and credentials by keeping them on the server side

## Technical Implementation

The proxy server is implemented as a Node.js/Express application with the following key components:

```javascript
// server.js - Main proxy server implementation
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const axios = require('axios');
const NodeCache = require('node-cache');

const app = express();
const PORT = process.env.PORT || 3001;

// Server-side cache with configurable TTL
const apiCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60 // Check for expired items every minute
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://hrvstr-app.com' 
    : 'http://localhost:3000'
}));

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  message: 'Too many requests, please try again later'
});
app.use(limiter);

// Route handlers for different external APIs
app.use('/api/reddit', require('./routes/redditRoutes'));
app.use('/api/earnings', require('./routes/earningsRoutes'));
app.use('/api/sec', require('./routes/secRoutes'));
app.use('/api/sentiment', require('./routes/sentimentRoutes'));

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
```

### Route Implementation Example

Each external API has its own dedicated route handler that manages specific endpoints:

```javascript
// routes/redditRoutes.js - Example route implementation
const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const router = express.Router();

// Route-specific cache with custom TTL
const redditCache = new NodeCache({ stdTTL: 600 }); // 10 minutes

// Get posts from a subreddit
router.get('/subreddit/:subreddit', async (req, res) => {
  const { subreddit } = req.params;
  const { limit = 25 } = req.query;
  
  const cacheKey = `${subreddit}:${limit}`;
  
  // Check cache first
  const cachedData = redditCache.get(cacheKey);
  if (cachedData) {
    console.log(`Cache hit for ${cacheKey}`);
    return res.json(cachedData);
  }
  
  try {
    // Fetch from Reddit API
    const response = await axios.get(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`,
      {
        headers: {
          'User-Agent': 'HRVSTR/1.0.0'
        }
      }
    );
    
    // Transform and normalize data for frontend
    const posts = response.data.data.children.map(child => ({
      id: child.data.id,
      title: child.data.title,
      author: child.data.author,
      created: child.data.created_utc,
      url: child.data.url,
      permalink: child.data.permalink,
      selftext: child.data.selftext,
      score: child.data.score,
      num_comments: child.data.num_comments
    }));
    
    // Cache the processed results
    redditCache.set(cacheKey, posts);
    
    res.json(posts);
  } catch (error) {
    console.error(`Error fetching from Reddit: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to fetch from Reddit API',
      details: error.message
    });
  }
});

module.exports = router;
```

## Integration with Frontend

The frontend React application interacts with the proxy server through a set of service modules that abstract the API communication details:

```typescript
// redditClient.ts - Frontend service example
import { RedditPost } from '../types';

const PROXY_URL = process.env.REACT_APP_PROXY_URL || 'http://localhost:3001';

export async function fetchRedditPosts(
  subreddit: string, 
  limit = 25,
  signal?: AbortSignal
): Promise<RedditPost[]> {
  try {
    const response = await fetch(
      `${PROXY_URL}/api/reddit/subreddit/${subreddit}?limit=${limit}`,
      { signal }
    );
    
    if (!response.ok) {
      throw new Error(`Proxy server error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Reddit fetch error:', error);
    throw new Error('Failed to fetch Reddit posts');
  }
}
```

### Configuration Management

The proxy server URL is configured via environment variables to support different deployment environments:

```typescript
// Configuration utility
export function getProxyUrl(): string {
  return process.env.REACT_APP_PROXY_URL || 'http://localhost:3001';
}
```

## External APIs Accessed Through Proxy

The proxy server mediates access to multiple external data sources:

1. **Reddit API**
   - Fetches posts from investment and financial subreddits
   - Handles Reddit's specific rate limiting and authentication requirements
   - Transforms verbose Reddit API responses into streamlined data structures

2. **Financial Data APIs**
   - Retrieves earnings data from financial data providers
   - Fetches historical price data for analysis
   - Normalizes data formats across different providers

3. **SEC EDGAR API**
   - Accesses regulatory filings (Forms 4, 13F, etc.)
   - Downloads, parses, and extracts key data from filings
   - Manages SEC.gov's strict rate limiting and user-agent requirements

4. **Sentiment Analysis Services**
   - Interfaces with NLP services for text sentiment analysis
   - Processes and aggregates sentiment data
   - Caches results to minimize expensive API calls

## Caching Strategy

The proxy server implements a multi-level caching strategy:

1. **Memory Cache**:
   - First-level caching using NodeCache
   - Configurable TTL based on data volatility
   - Route-specific cache instances for fine-grained control

2. **Response Headers**:
   - Sets appropriate Cache-Control headers
   - Configures ETag values for client-side validation
   - Implements conditional GET support

3. **Data Freshness Controls**:
   - Force-refresh capabilities via query parameters
   - Staggered cache expiration to prevent cache stampedes
   - Background refresh for high-demand data

Example cache configuration:

```javascript
// Differentiated cache TTLs by data type
const cacheTTLs = {
  reddit: 600,        // 10 minutes
  earnings: 3600,     // 1 hour
  secFilings: 86400,  // 24 hours
  sentiment: 1800     // 30 minutes
};

// Create cache instances with appropriate TTLs
Object.entries(cacheTTLs).forEach(([type, ttl]) => {
  caches[type] = new NodeCache({ 
    stdTTL: ttl,
    checkperiod: Math.min(ttl / 5, 60)
  });
});
```

## Error Handling and Resilience

The proxy server implements robust error handling strategies:

1. **Graceful Degradation**:
   - Returns cached data when live API calls fail
   - Implements circuit breaker patterns for unreliable APIs
   - Provides meaningful error responses to the frontend

2. **Retries and Fallbacks**:
   - Automatic retry logic for transient failures
   - Multiple data source fallbacks for critical information
   - Exponential backoff for rate limit handling

3. **Comprehensive Logging**:
   - Detailed error logging with context
   - Performance monitoring for slow endpoints
   - Usage statistics for optimization

## Deployment Architecture

The proxy server is deployed with the following considerations:

1. **Environment Isolation**:
   - Development proxy for local development
   - Staging proxy for testing
   - Production proxy with enhanced security and performance

2. **Scaling Strategy**:
   - Horizontal scaling for handling increased load
   - Load balancing across multiple instances
   - Region-specific deployments for reduced latency

3. **Security Measures**:
   - TLS encryption for all communications
   - API key rotation and secure storage
   - IP-based access controls

## Benefits of the Proxy Approach

This proxy server architecture provides several key advantages:

1. **Simplified Frontend Code**:
   - Centralized API access logic
   - Consistent error handling patterns
   - Reduced redundancy in data fetching logic

2. **Enhanced Security**:
   - API keys never exposed to client browsers
   - Restricted endpoint access
   - Request filtering and validation

3. **Improved Performance**:
   - Reduced API calls through caching
   - Optimized responses (smaller payloads)
   - Parallel request handling

4. **Better Maintainability**:
   - Single point for API integration changes
   - Centralized monitoring and logging
   - Consistent patterns across all external services

## Future Enhancements

Planned improvements to the proxy server include:

1. **GraphQL Integration**:
   - Implementing a GraphQL layer for more flexible data querying
   - Combining multiple API calls into single requests
   - Type-safe API interactions

2. **Enhanced Caching**:
   - Distributed cache implementation (Redis)
   - Predictive pre-caching for common requests
   - User-specific cached responses

3. **Authentication Proxy**:
   - Integrating with Auth0 for authenticated API access
   - Implementing user-specific rate limits
   - Role-based API access control
