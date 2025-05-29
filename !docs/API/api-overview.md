# HRVSTR API Overview

## Introduction

The HRVSTR API serves as a unified backend interface for the HRVSTR financial analysis platform. It provides access to financial data, user management, watchlist functionality, and integrations with external data sources including SEC EDGAR, Reddit, FinViz, and earnings data providers. The API is designed with modern authentication, tier-based access controls, and robust session management.

## API Philosophy

The HRVSTR API follows several key design principles:

1. **Unified Access**: Single entry point for financial data and user management
2. **Data Transformation**: Converts raw financial data into standardized, analysis-ready formats
3. **Tiered Access**: Different feature access based on user subscription tiers
4. **Modern Authentication**: JWT-based authentication with refresh token support
5. **Rate Limiting**: Tier-based rate limits to ensure fair usage
6. **Security First**: Secure API key management and encrypted user data

## Core Functionality

The API provides several categories of endpoints:

### Authentication & User Management
- **User Authentication**: Google OAuth integration with JWT tokens
- **Session Management**: Long-lived sessions with automatic refresh
- **User Profiles**: User data and subscription tier management
- **API Key Management**: Secure storage of user-provided API keys

### Financial Data Endpoints
- **Stock Search**: Search for stocks and companies
- **Watchlist Management**: User-specific stock watchlists
- **Price Data**: Real-time and historical stock prices
- **Events Calendar**: Earnings announcements and corporate events

### External Data Integration
- **SEC EDGAR**: Insider trading and institutional holdings data
- **Reddit Sentiment**: Social media sentiment from financial subreddits
- **FinViz Data**: Market news and technical indicators
- **Earnings Information**: Corporate earnings announcements and analysis

### Subscription & Billing
- **Tier Management**: User subscription tier information
- **Usage Tracking**: API usage monitoring and limits
- **Billing Integration**: Stripe integration for subscription management

## Technical Details

- **Base URL**: `http://localhost:3001/api` (development) or `https://hrvstr.up.railway.app/api` (production)
- **Response Format**: All API responses are in JSON format
- **Authentication**: JWT Bearer token authentication
- **Rate Limiting**: Tier-based rate limiting with different limits per user tier
- **Error Handling**: Consistent error response format with appropriate HTTP status codes

## Authentication

The API uses JWT (JSON Web Token) authentication with the following features:

- **Access Tokens**: 7-day expiry for extended sessions
- **Refresh Tokens**: 30-day expiry for automatic token renewal
- **Google OAuth**: Primary authentication method
- **Session Management**: Automatic token refresh and session persistence

### Authentication Header
```
Authorization: Bearer <jwt_token>
```

## User Tiers & Rate Limits

The API implements a tier-based system with different access levels:

### Free Tier
- 25 searches per day
- 25 price updates per day
- Basic watchlist features
- Limited API access

### Pro Tier
- Unlimited searches
- Unlimited price updates
- Advanced features
- Priority support

### Elite Tier
- All Pro features
- Premium data sources
- Advanced analytics
- Enhanced support

### Institutional Tier
- All Elite features
- Custom integrations
- Dedicated support
- Enterprise SLA

## Getting Started

To use the HRVSTR API:

1. **Authentication**: Sign in via Google OAuth to get JWT tokens
2. **API Calls**: Include JWT token in Authorization header
3. **Rate Limits**: Monitor usage against tier limits
4. **Error Handling**: Handle responses according to documented formats

## Error Handling

All API errors follow a consistent format:

```json
{
  "error": true,
  "message": "Descriptive error message",
  "status": 400
}
```

Common error status codes:
- `400`: Bad request (invalid parameters)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found (endpoint or resource doesn't exist)
- `429`: Too many requests (rate limit exceeded)
- `500`: Internal server error (server-side error)

## Environment Configuration

The API relies on several environment variables:

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment setting (`development` or `production`)
- `JWT_SECRET`: Secret for JWT token signing
- `ALPHA_VANTAGE_API_KEY`: Alpha Vantage API key
- `REDDIT_CLIENT_ID`: Reddit API client ID
- `REDDIT_CLIENT_SECRET`: Reddit API client secret
- `DATABASE_URL`: PostgreSQL database connection string

## Cross-Origin Resource Sharing (CORS)

The API implements CORS to allow requests from:
- `http://localhost:5173` (development frontend)
- `http://localhost:3000` (alternative development port)
- `https://hrvstr.up.railway.app` (production frontend)

## Current API Endpoints

### Authentication
- `POST /api/auth/google-login` - Google OAuth login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Get user profile

### Stocks & Watchlist
- `GET /api/stocks/search` - Search for stocks
- `GET /api/watchlist` - Get user's watchlist
- `POST /api/watchlist` - Add stock to watchlist
- `DELETE /api/watchlist/:symbol` - Remove from watchlist

### External Data (Proxy Endpoints)
- `GET /api/sec/insider-trades` - SEC insider trading data
- `GET /api/sec/insider-trades/:ticker` - Ticker-specific insider trades
- `GET /api/reddit/subreddit/:subreddit` - Reddit posts from subreddit
- `GET /api/sentiment/aggregate` - Aggregated sentiment analysis
- `GET /api/finviz/*` - FinViz data endpoints
- `GET /api/earnings/upcoming` - Upcoming earnings

### User Management
- `GET /api/settings/key-status` - API key configuration status
- `POST /api/settings/update-keys` - Update user API keys
- `GET /api/settings/keys` - Get masked API keys

### Subscription & Billing
- `GET /api/subscription/tier-info` - User's subscription tier
- `GET /api/subscription/usage-stats` - Usage statistics
- `POST /api/billing/*` - Stripe billing endpoints

### System
- `GET /health` - Health check endpoint
- `GET /api/docs/*` - API documentation endpoints

## Migration from Legacy API

The current API has evolved from earlier versions with the following key changes:

1. **Authentication**: Moved from API key to JWT-based authentication
2. **User Management**: Added comprehensive user profiles and tiers
3. **Rate Limiting**: Implemented tier-based usage limits
4. **Session Management**: Enhanced with refresh tokens and longer sessions
5. **Database Integration**: Full PostgreSQL integration with user data

## Additional Resources

- [Authentication Documentation](./authentication.md): Detailed authentication guide
- [CORS Configuration](./cors-configuration.md): CORS setup and security
- [API Structure](./api-structure.md): Technical architecture details
- [Endpoints Directory](./endpoints/): Specific endpoint documentation

## Support

For API issues or questions, please refer to the documentation or contact the development team through the HRVSTR repository.
