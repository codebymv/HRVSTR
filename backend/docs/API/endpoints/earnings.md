# Earnings API Endpoints

## Overview

The Earnings API endpoints provide access to upcoming earnings announcements and historical earnings data. These endpoints integrate with external data sources to help users track important earnings events for their watchlist stocks.

## Base URL

```
/api/earnings
```

## Authentication

All earnings endpoints require authentication:

```http
Authorization: Bearer <jwt_token>
```

## Available Endpoints

### Get Upcoming Earnings

Retrieves upcoming earnings announcements.

```http
GET /api/earnings/upcoming
```

#### Authentication
- **Required**: Yes
- **Tier Access**: Available to all user tiers

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| limit     | number | No       | 50      | Maximum number of announcements to retrieve (1-200)   |
| days      | number | No       | 30      | Number of days ahead to look (1-90)                  |

#### Response Format

```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "companyName": "Apple Inc.",
      "reportDate": "2024-07-30",
      "fiscalQuarter": "Q3 2024",
      "timeOfDay": "after",
      "epsEstimate": 1.52,
      "sector": "Technology"
    }
  ],
  "count": 25,
  "timestamp": "2024-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
const response = await fetch('/api/earnings/upcoming?limit=20', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

### Get Historical Earnings for Ticker

Retrieves historical earnings data for a specific stock ticker.

```http
GET /api/earnings/historical/:ticker
```

#### Authentication
- **Required**: Yes
- **Tier Access**: Available to all user tiers

#### Path Parameters

| Parameter | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| ticker    | string | Yes      | Stock symbol (e.g., "AAPL")                   |

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| limit     | number | No       | 8       | Maximum number of quarters to retrieve (1-20)         |

#### Response Format

```json
{
  "success": true,
  "ticker": "AAPL",
  "companyName": "Apple Inc.",
  "data": [
    {
      "reportDate": "2024-04-25",
      "fiscalQuarter": "Q2 2024",
      "fiscalYear": "2024",
      "epsEstimate": 1.43,
      "epsActual": 1.55,
      "epsSurprise": 8.4,
      "revenueEstimate": "79.5B",
      "revenueActual": "82.1B"
    }
  ],
  "count": 4,
  "timestamp": "2024-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
const response = await fetch('/api/earnings/historical/AAPL?limit=4', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

### Get Earnings Analysis for Ticker

Retrieves earnings analysis and insights for a specific ticker.

```http
GET /api/earnings/analysis/:ticker
```

#### Authentication
- **Required**: Yes
- **Tier Access**: Pro tier and above

#### Path Parameters

| Parameter | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| ticker    | string | Yes      | Stock symbol (e.g., "AAPL")                   |

#### Response Format

```json
{
  "success": true,
  "ticker": "AAPL",
  "analysis": {
    "averageEpsSurprise": 5.6,
    "averageRevenueSurprise": 2.8,
    "beatCount": 7,
    "missCount": 1,
    "nextEarningsDate": "2024-07-30",
    "confidence": "high"
  },
  "timestamp": "2024-05-06T12:00:00Z"
}
```

## Data Sources

The earnings endpoints aggregate data from multiple sources:

- **Alpha Vantage**: Primary earnings calendar data
- **SEC Filings**: Official earnings reports
- **Company Websites**: Earnings announcements
- **Financial News**: Earnings previews and analysis

## Rate Limiting

### Free Tier
- 25 requests per day across all earnings endpoints
- Rate limits are tracked in the `api_usage` table

### Pro/Elite/Institutional Tiers
- Unlimited requests
- No daily limits for paid tiers

## Error Handling

### Common Errors

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | `Invalid ticker symbol` | Ticker format is invalid |
| 401 | `Authentication required` | Missing or invalid JWT token |
| 403 | `Insufficient tier access` | Feature requires higher tier |
| 404 | `Ticker not found` | No earnings data for this ticker |
| 429 | `Rate limit exceeded` | Too many requests for current tier |
| 500 | `Internal server error` | Server-side error occurred |

### Example Error Response

```json
{
  "error": true,
  "message": "Rate limit exceeded. Upgrade to Pro for unlimited access.",
  "status": 429
}
```

## Caching Strategy

- **Upcoming Earnings**: Cached for 6 hours
- **Historical Data**: Cached for 24 hours  
- **Analysis Data**: Cached for 12 hours

Cache headers are included in responses:

```http
Cache-Control: public, max-age=21600
ETag: "abc123def456"
```

## Integration with Watchlist

Earnings data integrates with the user's watchlist:

```javascript
// Get earnings for watchlist stocks
const response = await fetch('/api/earnings/upcoming', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Filter for watchlist symbols
const watchlistSymbols = ['AAPL', 'MSFT', 'GOOGL'];
const watchlistEarnings = data.filter(earning => 
  watchlistSymbols.includes(earning.symbol)
);
```

## Event Calendar Integration

Earnings data is also stored in the `events` table:

```sql
-- Earnings events in database
SELECT * FROM events 
WHERE event_type = 'earnings' 
AND scheduled_at >= CURRENT_DATE 
ORDER BY scheduled_at ASC;
```

## Data Validation

### Input Validation
- Ticker symbols: Must be 1-10 uppercase letters
- Limit parameters: Must be positive integers within allowed ranges
- Date parameters: Must be valid ISO date format

### Response Validation
- All numeric values are validated for reasonableness
- Dates are normalized to ISO format
- Missing data is handled gracefully with null values

## Usage Examples

### Get Next Week's Earnings

```javascript
const getUpcomingEarnings = async () => {
  try {
    const response = await fetch('/api/earnings/upcoming?days=7&limit=50', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching earnings:', error);
    return [];
  }
};
```

### Get Earnings History with Error Handling

```javascript
const getEarningsHistory = async (ticker) => {
  try {
    const response = await fetch(`/api/earnings/historical/${ticker}?limit=8`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch earnings history');
    }

    return data.data;
  } catch (error) {
    if (error.message.includes('Rate limit')) {
      // Handle rate limiting
      showUpgradePrompt();
    } else {
      console.error('Error fetching earnings history:', error);
    }
    return [];
  }
};
```

## Related Endpoints

### Stock Search
- `GET /api/stocks/search` - Search for stocks to get earnings data

### Watchlist  
- `GET /api/watchlist` - Get user's watchlist for earnings filtering

### Events Calendar
- `GET /api/events` - Calendar events including earnings

### User Settings
- `GET /api/settings/keys` - Manage API keys for data sources

## Migration Notes

### Changes from Previous Version
1. **Removed API versioning**: Endpoints moved from `/api/v1/earnings` to `/api/earnings`
2. **Added authentication**: All endpoints now require JWT tokens
3. **Tier-based access**: Some features restricted by user tier
4. **Rate limiting**: Implemented tier-based rate limits
5. **Database integration**: Earnings stored in `events` table

### Backward Compatibility
- Response formats maintained for existing integrations
- Error message format updated for consistency
- New optional parameters added without breaking existing calls

## Performance Considerations

### Response Times
- Upcoming earnings: < 500ms (cached)
- Historical data: < 1s (API dependent)
- Analysis data: < 2s (computation required)

### Optimization Tips
1. Use appropriate limit parameters to avoid large responses
2. Implement client-side caching for frequently accessed data
3. Use conditional requests with ETag headers
4. Consider pagination for large datasets

## Related Files

- `backend/src/routes/proxy/earnings.js` - Route definitions
- `backend/src/controllers/earningsController.js` - Business logic
- `backend/src/middleware/dataSourceValidator.js` - Validation middleware
- `frontend/src/services/earningsService.js` - Frontend integration
