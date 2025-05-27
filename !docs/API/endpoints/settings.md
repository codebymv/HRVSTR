# Settings API Endpoints

## Overview

The Settings API endpoints enable users to store, retrieve, and manage their preferences and configurations for the HRVSTR platform. These endpoints handle user-specific settings, theme preferences, chart configurations, and API key management.

## Base URL

```
/api/v1/settings
```

## Authentication

All settings endpoints require authentication using the API key method:

```
X-API-Key: your_api_key_here
```

## Available Endpoints

### Get User Settings

Retrieves all settings for the authenticated user.

```
GET /api/v1/settings
```

#### Response Format

```json
{
  "settings": {
    "user": {
      "id": "user123",
      "displayName": "TradingPro",
      "email": "user@example.com",
      "createdAt": "2025-01-15T08:30:00Z",
      "lastLogin": "2025-05-06T09:15:22Z"
    },
    "preferences": {
      "theme": "dark",
      "timezone": "America/New_York",
      "dateFormat": "MM/DD/YYYY",
      "notifications": {
        "email": true,
        "browser": true,
        "mobile": false
      },
      "defaultView": "dashboard"
    },
    "dashboardLayout": {
      "widgets": [
        {
          "id": "sentiment-overview",
          "position": {
            "x": 0,
            "y": 0,
            "w": 6,
            "h": 4
          },
          "config": {
            "tickers": ["AAPL", "MSFT", "GOOG"],
            "timeRange": "1w",
            "showChart": true
          }
        },
        {
          "id": "insider-trading",
          "position": {
            "x": 6,
            "y": 0,
            "w": 6,
            "h": 4
          },
          "config": {
            "sortBy": "value",
            "direction": "buy",
            "limit": 10
          }
        },
        // Additional widgets...
      ],
      "lastModified": "2025-05-01T14:22:35Z"
    },
    "chartDefaults": {
      "sentimentCharts": {
        "timeRange": "1m",
        "resolution": "day",
        "sources": ["reddit", "finviz", "news"],
        "showVolume": true,
        "colorScheme": "default"
      },
      "secFilingsCharts": {
        "timeRange": "6m",
        "showPrice": true,
        "transactionTypes": ["P", "S"],
        "minValue": 100000
      }
    },
    "watchlists": [
      {
        "id": "main",
        "name": "Main Watchlist",
        "tickers": ["AAPL", "MSFT", "GOOG", "AMZN", "META"],
        "sortOrder": "alphabetical",
        "lastModified": "2025-05-02T10:15:00Z"
      },
      {
        "id": "tech",
        "name": "Tech Stocks",
        "tickers": ["AAPL", "MSFT", "GOOG", "NVDA", "AMD"],
        "sortOrder": "custom",
        "lastModified": "2025-04-28T15:30:00Z"
      },
      // Additional watchlists...
    ],
    "apiKeys": {
      "hasRedditKeys": true,
      "hasFinvizKeys": false,
      "thirdPartyIntegrations": ["tradingview", "stocktwits"]
    }
  },
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/settings', {
  headers: {
    'X-API-Key': 'your_api_key_here'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

### Update User Settings

Updates specific settings for the authenticated user.

```
PUT /api/v1/settings
```

#### Request Body

```json
{
  "preferences": {
    "theme": "light",
    "timezone": "Europe/London"
  },
  "chartDefaults": {
    "sentimentCharts": {
      "timeRange": "2w",
      "showVolume": false
    }
  }
}
```

#### Response Format

```json
{
  "success": true,
  "message": "Settings updated successfully",
  "updated": ["preferences.theme", "preferences.timezone", "chartDefaults.sentimentCharts.timeRange", "chartDefaults.sentimentCharts.showVolume"],
  "timestamp": "2025-05-06T12:05:33Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/settings', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here'
  },
  body: JSON.stringify({
    preferences: {
      theme: 'light',
      timezone: 'Europe/London'
    }
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

### Get Specific Setting

Retrieves a specific setting by path.

```
GET /api/v1/settings/path/:path
```

#### Path Parameters

| Parameter | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| path      | string | Yes      | Dot-notation path to the setting (e.g., "preferences.theme") |

#### Response Format

```json
{
  "path": "preferences.theme",
  "value": "dark",
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/settings/path/preferences.theme', {
  headers: {
    'X-API-Key': 'your_api_key_here'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

### Manage Watchlists

#### Get All Watchlists

```
GET /api/v1/settings/watchlists
```

#### Response Format

```json
{
  "watchlists": [
    {
      "id": "main",
      "name": "Main Watchlist",
      "tickers": ["AAPL", "MSFT", "GOOG", "AMZN", "META"],
      "sortOrder": "alphabetical",
      "lastModified": "2025-05-02T10:15:00Z"
    },
    {
      "id": "tech",
      "name": "Tech Stocks",
      "tickers": ["AAPL", "MSFT", "GOOG", "NVDA", "AMD"],
      "sortOrder": "custom",
      "lastModified": "2025-04-28T15:30:00Z"
    },
    // Additional watchlists...
  ],
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Create Watchlist

```
POST /api/v1/settings/watchlists
```

##### Request Body

```json
{
  "name": "Energy Stocks",
  "tickers": ["XOM", "CVX", "COP", "SLB", "EOG"],
  "sortOrder": "alphabetical"
}
```

##### Response Format

```json
{
  "success": true,
  "watchlist": {
    "id": "energy",
    "name": "Energy Stocks",
    "tickers": ["XOM", "CVX", "COP", "SLB", "EOG"],
    "sortOrder": "alphabetical",
    "lastModified": "2025-05-06T12:10:45Z"
  },
  "timestamp": "2025-05-06T12:10:45Z"
}
```

#### Update Watchlist

```
PUT /api/v1/settings/watchlists/:id
```

##### Path Parameters

| Parameter | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| id        | string | Yes      | Watchlist ID                                  |

##### Request Body

```json
{
  "name": "Energy Leaders",
  "tickers": ["XOM", "CVX", "COP", "SLB", "EOG", "PSX"],
  "sortOrder": "custom"
}
```

##### Response Format

```json
{
  "success": true,
  "watchlist": {
    "id": "energy",
    "name": "Energy Leaders",
    "tickers": ["XOM", "CVX", "COP", "SLB", "EOG", "PSX"],
    "sortOrder": "custom",
    "lastModified": "2025-05-06T12:15:22Z"
  },
  "timestamp": "2025-05-06T12:15:22Z"
}
```

#### Delete Watchlist

```
DELETE /api/v1/settings/watchlists/:id
```

##### Path Parameters

| Parameter | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| id        | string | Yes      | Watchlist ID                                  |

##### Response Format

```json
{
  "success": true,
  "message": "Watchlist deleted successfully",
  "id": "energy",
  "timestamp": "2025-05-06T12:20:10Z"
}
```

### Manage Dashboard Layout

#### Get Dashboard Layout

```
GET /api/v1/settings/dashboard
```

#### Response Format

```json
{
  "widgets": [
    {
      "id": "sentiment-overview",
      "position": {
        "x": 0,
        "y": 0,
        "w": 6,
        "h": 4
      },
      "config": {
        "tickers": ["AAPL", "MSFT", "GOOG"],
        "timeRange": "1w",
        "showChart": true
      }
    },
    {
      "id": "insider-trading",
      "position": {
        "x": 6,
        "y": 0,
        "w": 6,
        "h": 4
      },
      "config": {
        "sortBy": "value",
        "direction": "buy",
        "limit": 10
      }
    },
    // Additional widgets...
  ],
  "lastModified": "2025-05-01T14:22:35Z",
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Update Dashboard Layout

```
PUT /api/v1/settings/dashboard
```

##### Request Body

```json
{
  "widgets": [
    {
      "id": "sentiment-overview",
      "position": {
        "x": 0,
        "y": 0,
        "w": 12,
        "h": 4
      },
      "config": {
        "tickers": ["AAPL", "MSFT", "GOOG", "AMZN"],
        "timeRange": "2w",
        "showChart": true
      }
    },
    {
      "id": "insider-trading",
      "position": {
        "x": 0,
        "y": 4,
        "w": 6,
        "h": 4
      },
      "config": {
        "sortBy": "value",
        "direction": "buy",
        "limit": 10
      }
    },
    // Additional widgets...
  ]
}
```

##### Response Format

```json
{
  "success": true,
  "message": "Dashboard layout updated successfully",
  "lastModified": "2025-05-06T12:25:40Z",
  "timestamp": "2025-05-06T12:25:40Z"
}
```

### Manage API Keys

#### Get API Key Status

```
GET /api/v1/settings/api-keys
```

#### Response Format

```json
{
  "apiKeys": {
    "reddit": {
      "configured": true,
      "valid": true,
      "lastValidated": "2025-05-05T10:30:15Z"
    },
    "finviz": {
      "configured": false,
      "valid": null,
      "lastValidated": null
    },
    "thirdPartyIntegrations": [
      {
        "name": "tradingview",
        "configured": true,
        "valid": true,
        "lastValidated": "2025-05-04T18:22:10Z"
      },
      {
        "name": "stocktwits",
        "configured": true,
        "valid": true,
        "lastValidated": "2025-05-06T09:15:33Z"
      }
    ]
  },
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Update API Keys

```
PUT /api/v1/settings/api-keys
```

##### Request Body

```json
{
  "reddit": {
    "clientId": "your_reddit_client_id",
    "clientSecret": "your_reddit_client_secret",
    "username": "your_reddit_username",
    "password": "your_reddit_password"
  },
  "finviz": {
    "apiKey": "your_finviz_api_key"
  },
  "thirdPartyIntegrations": {
    "tradingview": {
      "username": "your_tradingview_username",
      "password": "your_tradingview_password"
    }
  }
}
```

##### Response Format

```json
{
  "success": true,
  "message": "API keys updated successfully",
  "updated": ["reddit", "finviz", "thirdPartyIntegrations.tradingview"],
  "validation": {
    "reddit": {
      "valid": true,
      "message": "Successfully authenticated with Reddit API"
    },
    "finviz": {
      "valid": true,
      "message": "Successfully authenticated with FinViz API"
    },
    "thirdPartyIntegrations": {
      "tradingview": {
        "valid": true,
        "message": "Successfully authenticated with TradingView"
      }
    }
  },
  "timestamp": "2025-05-06T12:30:55Z"
}
```

#### Delete API Keys

```
DELETE /api/v1/settings/api-keys/:provider
```

##### Path Parameters

| Parameter | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| provider  | string | Yes      | API provider (e.g., "reddit", "finviz")       |

##### Response Format

```json
{
  "success": true,
  "message": "API keys for reddit deleted successfully",
  "timestamp": "2025-05-06T12:35:20Z"
}
```

## Error Responses

### Authentication Error

```json
{
  "error": true,
  "message": "Authentication required",
  "code": "AUTH_REQUIRED",
  "status": 401
}
```

### Invalid API Key

```json
{
  "error": true,
  "message": "Invalid API key",
  "code": "INVALID_KEY",
  "status": 403
}
```

### Setting Not Found

```json
{
  "error": true,
  "message": "Setting not found: preferences.unknown",
  "code": "SETTING_NOT_FOUND",
  "status": 404
}
```

### Watchlist Not Found

```json
{
  "error": true,
  "message": "Watchlist not found with ID: unknown",
  "code": "WATCHLIST_NOT_FOUND",
  "status": 404
}
```

### Invalid Request

```json
{
  "error": true,
  "message": "Invalid request",
  "code": "INVALID_REQUEST",
  "status": 400,
  "details": {
    "watchlist.name": "Name is required",
    "watchlist.tickers": "Tickers must be an array"
  }
}
```

### API Key Validation Error

```json
{
  "error": true,
  "message": "API key validation failed",
  "code": "API_KEY_VALIDATION_ERROR",
  "status": 400,
  "details": {
    "reddit": "Invalid client ID or client secret"
  }
}
```

## Data Storage and Security

1. **Encryption**: All sensitive data, such as API keys and passwords, are encrypted in the database
2. **Access Control**: Settings are user-specific and not accessible by other users
3. **Data Isolation**: Each user's settings are isolated in separate database records
4. **Validation**: All input is validated to prevent injection attacks or data corruption
5. **Audit Logging**: Changes to API keys and sensitive settings are logged for security purposes

## Limitations

1. **Data Size**: Individual settings values are limited to 100KB in size
2. **Rate Limiting**: Settings API is limited to 60 requests per minute per user
3. **Watchlist Size**: Each watchlist can contain a maximum of 100 tickers
4. **Dashboard Widgets**: Maximum of 20 widgets per dashboard layout
5. **API Key Storage**: Only supported third-party integrations can have their API keys stored
