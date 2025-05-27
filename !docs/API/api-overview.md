# HRVSTR API Overview

## Introduction

The HRVSTR API serves as a unified backend interface for the HRVSTR financial analysis platform. It primarily functions as a proxy and data processing layer that interfaces with various financial data sources, including SEC EDGAR, Reddit, FinViz, and earnings data providers. The API is designed to overcome CORS limitations, manage API keys securely, and provide standardized data formats for the frontend application.

## API Philosophy

The HRVSTR API follows several key design principles:

1. **Unified Access**: Provides a single entry point for multiple financial data sources
2. **Data Transformation**: Converts raw financial data into standardized, analysis-ready formats
3. **Caching Strategy**: Implements efficient caching to reduce external API calls and improve performance
4. **Security First**: Protects API keys and sensitive data by keeping them server-side
5. **Resilient Design**: Handles external API outages gracefully with fallbacks and error handling

## Core Functionality

The API provides several categories of endpoints:

### Data Retrieval Endpoints

- **SEC EDGAR Integration**: Access to insider trading (Form 4) and institutional holdings (13F) data
- **Reddit Sentiment**: Analysis of social media sentiment from financial subreddits
- **FinViz Data**: Market news, analyst ratings, and technical indicators
- **Earnings Information**: Corporate earnings announcements and results

### Processing Endpoints

- **Sentiment Analysis**: Text processing and sentiment classification for financial content
- **Filing Analysis**: Processing and interpretation of SEC regulatory filings
- **Data Aggregation**: Combining data from multiple sources for comprehensive analysis

### Management Endpoints

- **Settings**: User preferences and application configuration
- **API Keys**: Secure storage and management of third-party API credentials

## Technical Details

- **Base URL**: `http://localhost:3001` (development) or `https://api.hrvstr.finance` (production)
- **Response Format**: All API responses are in JSON format
- **Authentication**: API key authentication for protected endpoints
- **Rate Limiting**: Implements rate limiting to prevent abuse
- **Error Handling**: Standard error response format with appropriate HTTP status codes

## Getting Started

To use the HRVSTR API:

1. Ensure the backend server is running (`npm start` from the backend directory)
2. Configure any required API keys in your environment variables
3. Make requests to the appropriate endpoints as documented in the endpoints directory
4. Handle responses and errors according to the documented formats

## Error Handling

All API errors follow a consistent format:

```json
{
  "error": true,
  "message": "Descriptive error message",
  "code": "ERROR_CODE",
  "status": 400
}
```

Common error status codes:
- `400`: Bad request (invalid parameters)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found (endpoint or resource doesn't exist)
- `429`: Too many requests (rate limit exceeded)
- `500`: Internal server error (unexpected error occurred)

## Environment Configuration

The API relies on several environment variables for configuration:

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment setting (`development` or `production`)
- `REDDIT_CLIENT_ID`: Reddit API client ID
- `REDDIT_CLIENT_SECRET`: Reddit API client secret
- `SEC_USER_AGENT`: User agent for SEC EDGAR requests

See `.env.example` for a complete list of configuration options.

## API Versioning

The current API version is v1, with the version included in the URL path: `/api/v1/[endpoint]`

Future versions will maintain backward compatibility where possible, with new features and breaking changes introduced in newer versions.

## Cross-Origin Resource Sharing (CORS)

The API implements CORS to allow requests from:
- `http://localhost:5173` (development frontend)
- `https://hrvstr.finance` (production frontend)

See the CORS configuration documentation for more details.

## Additional Resources

- [API Structure](./api-structure.md): Details about the API architecture
- [Authentication](./authentication.md): Authentication methods and security
- [Error Handling](./error-handling.md): Detailed error codes and recovery strategies
- [Endpoints Directory](./endpoints/): Specific documentation for each endpoint

## Support

For issues or questions about the API, please file an issue in the HRVSTR repository or contact the development team.


## API Architecture

The HRVSTR API is built using a modern, RESTful architecture with the following characteristics:

- **API Version**: v1
- **Base URL**: `http://localhost:3001/api/v1` (development) or `https://api.hrvstr.finance/api/v1` (production)
- **Data Format**: JSON for all requests and responses
- **Authentication**: API key-based authentication via the `X-API-Key` header
- **Error Handling**: Consistent error objects with status codes, error messages, and error codes
- **Rate Limiting**: Endpoint-specific rate limits to ensure system stability
- **Caching**: Optimized caching strategies for different data types

### API Gateway

All requests pass through an API gateway that provides:

1. **Request Validation**: Validates request parameters, headers, and body
2. **Authentication**: Verifies API keys and permissions
3. **Rate Limiting**: Enforces request limits per client
4. **Request Logging**: Records API usage for monitoring and debugging
5. **CORS Handling**: Manages cross-origin resource sharing
6. **Proxy Logic**: Routes requests to the appropriate microservices

## Core API Categories

The HRVSTR API is organized into the following primary categories:

### 1. Sentiment Analysis

Endpoints that aggregate and analyze sentiment data from multiple sources, including social media, news outlets, and financial platforms.

**Base Path**: `/api/v1/sentiment`

**Key Features**:
- Ticker-specific sentiment analysis with historical trends
- Multi-source sentiment aggregation (Reddit, FinViz, news)
- Sector and market-wide sentiment indicators
- Sentiment comparison between multiple tickers
- Sentiment alerts for significant changes

[→ Full Sentiment API Documentation](./endpoints/sentiment.md)

### 2. SEC Filings

Endpoints that retrieve and process data from SEC EDGAR filings, focusing on Form 4 (insider trading) and Form 13F (institutional holdings).

**Base Path**: `/api/v1/sec`

**Key Features**:
- Insider trading activity with transaction details
- Institutional holding patterns and changes
- Abnormal trading detection
- Detailed filing retrieval and parsing
- Transaction clustering and significance analysis

[→ Full SEC API Documentation](./endpoints/sec.md)

### 3. Reddit Data

Endpoints that interact with Reddit to gather financial discussions and sentiment from subreddits like WallStreetBets, Stocks, and Investing.

**Base Path**: `/api/v1/reddit`

**Key Features**:
- Subreddit post retrieval and analysis
- Ticker-specific sentiment extraction
- Trending ticker identification
- Post search and filtering
- Volume and mention tracking

[→ Full Reddit API Documentation](./endpoints/reddit.md)

### 4. FinViz Data

Endpoints that provide financial data from FinViz, including news, analyst ratings, and technical indicators.

**Base Path**: `/api/v1/finviz`

**Key Features**:
- Stock-specific news aggregation
- Analyst ratings and price targets
- Technical indicator analysis
- Stock screening based on multiple criteria
- Sentiment extraction from financial news

[→ Full FinViz API Documentation](./endpoints/finviz.md)

### 5. Earnings Information

Endpoints that provide earnings announcements, historical data, and analysis of earnings events.

**Base Path**: `/api/v1/earnings`

**Key Features**:
- Earnings calendar for upcoming announcements
- Historical earnings data with surprise metrics
- Earnings movers identification
- Detailed earnings report analysis
- Earnings surprise alerts

[→ Full Earnings API Documentation](./endpoints/earnings.md)

### 6. User Settings

Endpoints that manage user preferences, watchlists, dashboard layouts, and API keys.

**Base Path**: `/api/v1/settings`

**Key Features**:
- User preference management
- Watchlist creation and management
- Dashboard layout customization
- API key storage and validation
- Chart and display preferences

[→ Full Settings API Documentation](./endpoints/settings.md)

## Authentication and Security

The HRVSTR API employs a robust security model to protect user data and API access:

1. **API Key Authentication**: All requests require a valid API key
2. **HTTPS Encryption**: All production API traffic is encrypted
3. **CORS Restrictions**: Strict origin policies limit cross-site request forgery
4. **Rate Limiting**: Prevents abuse and ensures fair usage
5. **Input Validation**: Protects against injection and malformed requests
6. **Secure Credential Storage**: Encrypted storage for user API keys

[→ Full Authentication Documentation](./authentication.md)
[→ Full CORS Configuration Documentation](./cors-configuration.md)

## Error Handling

The API provides consistent error responses across all endpoints:

```json
{
  "error": true,
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "status": 400, // HTTP status code
  "details": {
    // Optional additional details
  }
}
```

### Common Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing API key |
| 403 | Forbidden - Invalid API key |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 502 | Bad Gateway - Error from upstream service |

## Caching Strategy

Different endpoints implement varying caching strategies based on data volatility:

| Data Type | Cache Duration | Considerations |
|-----------|----------------|----------------|
| Sentiment Data | 30-60 minutes | Balance between freshness and performance |
| SEC Filings | 6-24 hours | Slow-changing data with large response size |
| Reddit Data | 15-60 minutes | Moderate change frequency |
| FinViz Data | 15 minutes - 4 hours | Varies by data type (news vs. ratings) |
| Earnings Data | 6-24 hours | Event-based updates |
| User Settings | No caching | Real-time access to user preferences |

## Rate Limiting

Rate limits are implemented to ensure API stability and fair usage:

| Endpoint Category | Rate Limit |
|-------------------|------------|
| Sentiment Analysis | 60 requests per minute |
| SEC Filings | 30 requests per minute |
| Reddit Data | 60 requests per minute |
| FinViz Data | 30 requests per minute |
| Earnings Information | 60 requests per minute |
| User Settings | 60 requests per minute |

When a rate limit is exceeded, the API returns a 429 status code with a `Retry-After` header.

## Integration Patterns

### Frontend Integration

The HRVSTR frontend integrates with the API using the following patterns:

1. **Authentication Flow**:
   - Store API key securely in browser storage
   - Include key with every request
   - Handle 401/403 responses with re-authentication

2. **Data Fetching Strategy**:
   - Implement client-side caching where appropriate
   - Batch requests to minimize network overhead
   - Progressive loading for large datasets
   - Polling for time-sensitive data

3. **Error Handling**:
   - Consistent error display components
   - Retry logic for transient errors
   - Graceful degradation when services are unavailable

### Third-Party Integration

For external systems integrating with the HRVSTR API:

1. **API Key Management**:
   - Request an API key through the HRVSTR platform
   - Use server-to-server communication rather than client-side
   - Implement key rotation practices

2. **Webhook Support**:
   - Subscribe to relevant events (e.g., sentiment alerts)
   - Provide a secure endpoint to receive webhooks
   - Implement signature verification for webhooks

3. **Data Synchronization**:
   - Use incremental data fetching where possible
   - Implement idempotent operations
   - Maintain consistent IDs across systems

## Development and Testing

### Development Environment

The API can be run locally with minimal setup:

```bash
# Clone the repository
git clone https://github.com/your-username/hrvstr-api.git

# Install dependencies
cd hrvstr-api
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the development server
npm run dev
```

The API will be available at `http://localhost:3001/api/v1`.

### API Testing

#### Postman Collection

A comprehensive Postman collection is available to test all API endpoints:

1. Import the collection from `./postman/hrvstr-api.json`
2. Set up the environment variables in Postman
3. Run individual requests or the entire collection

#### Automated Testing

The API includes automated tests:

```bash
# Run unit tests
npm run test

# Run integration tests (requires a running database)
npm run test:integration

# Run API end-to-end tests
npm run test:e2e
```

## API Versioning

The HRVSTR API follows semantic versioning principles:

1. **Major Version Changes** (v1, v2): Breaking changes that require client updates
2. **Minor Version Changes** (v1.1, v1.2): New features with backward compatibility
3. **Patch Version Changes** (v1.1.1, v1.1.2): Bug fixes and non-breaking improvements

Version information is exposed through:
- The URL path (`/api/v1/...`)
- The `X-API-Version` response header
- The version field in the API root endpoint response

## Future API Roadmap

Planned enhancements to the HRVSTR API include:

1. **Enhanced Authentication**:
   - OAuth 2.0 support
   - JWT-based authentication
   - Multi-factor authentication for sensitive operations

2. **Advanced Analytics**:
   - Machine learning-based sentiment predictions
   - Correlation analysis between sentiment and price action
   - Advanced pattern recognition in insider trading

3. **Expanded Data Sources**:
   - Twitter/X sentiment analysis
   - StockTwits integration
   - Expanded news sources

4. **Performance Optimizations**:
   - GraphQL support for selective data fetching
   - Enhanced caching strategies
   - Streaming data for real-time updates

5. **Developer Tools**:
   - SDKs for popular programming languages
   - Enhanced documentation with interactive examples
   - Sandbox environment for testing

## Conclusion

The HRVSTR API provides a comprehensive set of endpoints for financial sentiment analysis, SEC filing data, and user preference management. By following RESTful principles and implementing robust security measures, the API enables seamless integration with the HRVSTR platform and third-party applications.

For detailed information about specific endpoints, refer to the individual documentation files linked above.

## Support and Contact

For questions, feature requests, or bug reports:

- **Email**: api-support@hrvstr.finance
- **Developer Portal**: https://developers.hrvstr.finance
- **GitHub Issues**: https://github.com/your-username/hrvstr-api/issues
