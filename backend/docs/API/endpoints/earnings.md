# Earnings API Endpoints

## Overview

The Earnings API endpoints provide access to corporate earnings announcements, reports, and related market data. These endpoints gather, process, and analyze earnings releases to help identify potential trading opportunities around earnings events.

## Base URL

```
/api/v1/earnings
```

## Available Endpoints

### Get Earnings Calendar

Retrieves upcoming and recent earnings announcements.

```
GET /api/v1/earnings/calendar
```

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| startDate | string | No       | today   | Start date in YYYY-MM-DD format                       |
| endDate   | string | No       | +30 days| End date in YYYY-MM-DD format                         |
| limit     | number | No       | 50      | Maximum number of announcements to retrieve (1-200)   |
| offset    | number | No       | 0       | Number of announcements to skip (for pagination)      |
| marketCap | string | No       | null    | Filter by market cap: "large", "mid", "small", "micro" |

#### Response Format

```json
{
  "calendar": [
    {
      "ticker": "AAPL",
      "companyName": "Apple Inc.",
      "reportDate": "2025-07-30",
      "fiscalQuarter": "Q3 2025",
      "timeOfDay": "after",
      "epsEstimate": 1.52,
      "epsYearAgo": 1.46,
      "revenueEstimate": "84.2B",
      "revenueYearAgo": "81.8B",
      "marketCap": "2.72T",
      "sector": "Technology",
      "surprise": {
        "history": [
          {
            "quarter": "Q2 2025",
            "estimate": 1.43,
            "actual": 1.55,
            "surprise": 8.4
          },
          {
            "quarter": "Q1 2025",
            "estimate": 2.10,
            "actual": 2.18,
            "surprise": 3.8
          }
        ]
      }
    },
    // Additional earnings announcements...
  ],
  "dateRange": {
    "start": "2025-05-06",
    "end": "2025-06-05"
  },
  "count": 50,
  "totalCount": 320,
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/earnings/calendar?startDate=2025-05-10&endDate=2025-05-17&marketCap=large')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Ticker Earnings

Retrieves earnings history and upcoming announcements for a specific ticker.

```
GET /api/v1/earnings/:ticker
```

#### Path Parameters

| Parameter | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| ticker    | string | Yes      | Stock symbol (e.g., "AAPL")                   |

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| limit     | number | No       | 8       | Maximum number of quarters to retrieve (1-20)         |
| upcoming  | boolean| No       | true    | Whether to include upcoming earnings if available     |

#### Response Format

```json
{
  "ticker": "AAPL",
  "companyName": "Apple Inc.",
  "upcoming": {
    "reportDate": "2025-07-30",
    "fiscalQuarter": "Q3 2025",
    "timeOfDay": "after",
    "epsEstimate": 1.52,
    "revenueEstimate": "84.2B",
    "daysUntil": 85
  },
  "history": [
    {
      "reportDate": "2025-04-25",
      "fiscalQuarter": "Q2 2025",
      "fiscalYear": "2025",
      "timeOfDay": "after",
      "epsEstimate": 1.43,
      "epsActual": 1.55,
      "epsSurprise": 8.4,
      "revenueEstimate": "79.5B",
      "revenueActual": "82.1B",
      "revenueSurprise": 3.3,
      "priceAction": {
        "beforeReport": 165.32,
        "afterReport": 172.45,
        "percentChange": 4.31
      },
      "callTranscript": "https://www.example.com/transcript/aapl-q2-2025"
    },
    // Additional quarters...
  ],
  "statistics": {
    "averageEpsSurprise": 5.6,
    "averageRevenueSurprise": 2.8,
    "averagePriceMove": 3.2,
    "beatCount": 7,
    "missCount": 1,
    "metCount": 0
  },
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/earnings/AAPL?limit=4')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Earnings Surprises

Retrieves stocks with significant earnings surprises.

```
GET /api/v1/earnings/surprises
```

#### Query Parameters

| Parameter   | Type   | Required | Default | Description                                           |
|-------------|--------|----------|---------|-------------------------------------------------------|
| limit       | number | No       | 20      | Maximum number of stocks to retrieve (1-100)          |
| days        | number | No       | 7       | Number of days to look back (1-30)                    |
| minSurprise | number | No       | 10      | Minimum EPS surprise percentage (1-1000)              |
| direction   | string | No       | "both"  | Surprise direction: "positive", "negative", "both"    |
| marketCap   | string | No       | null    | Filter by market cap: "large", "mid", "small", "micro" |

#### Response Format

```json
{
  "surprises": [
    {
      "ticker": "XYZ",
      "companyName": "XYZ Corporation",
      "reportDate": "2025-05-03",
      "timeOfDay": "after",
      "epsEstimate": 0.85,
      "epsActual": 1.20,
      "epsSurprise": 41.2,
      "revenueEstimate": "550M",
      "revenueActual": "612M",
      "revenueSurprise": 11.3,
      "priceAction": {
        "beforeReport": 42.50,
        "afterReport": 48.75,
        "nextDay": 51.20,
        "percentChange": {
          "immediate": 14.7,
          "nextDay": 20.5
        }
      },
      "marketCap": "2.1B",
      "sector": "Consumer Cyclical",
      "averageVolume": 850000,
      "volumeChange": 320
    },
    // Additional earnings surprises...
  ],
  "timeRange": {
    "start": "2025-04-29",
    "end": "2025-05-06"
  },
  "count": 20,
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/earnings/surprises?days=10&minSurprise=15&direction=positive')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Earnings Movers

Retrieves stocks with significant price movements following earnings reports.

```
GET /api/v1/earnings/movers
```

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| limit     | number | No       | 20      | Maximum number of stocks to retrieve (1-100)          |
| days      | number | No       | 7       | Number of days to look back (1-30)                    |
| minMove   | number | No       | 5       | Minimum price movement percentage (1-100)             |
| direction | string | No       | "both"  | Price movement direction: "up", "down", "both"        |
| marketCap | string | No       | null    | Filter by market cap: "large", "mid", "small", "micro" |

#### Response Format

```json
{
  "movers": [
    {
      "ticker": "ABC",
      "companyName": "ABC Inc.",
      "reportDate": "2025-05-04",
      "timeOfDay": "before",
      "epsEstimate": 0.72,
      "epsActual": 0.65,
      "epsSurprise": -9.7,
      "priceAction": {
        "beforeReport": 85.32,
        "afterReport": 68.75,
        "percentChange": -19.4,
        "volume": {
          "average": 2500000,
          "onReport": 12500000,
          "percentChange": 400
        }
      },
      "marketCap": "5.2B",
      "sector": "Healthcare",
      "analystNotes": "Revenue growth slowed; guidance reduced"
    },
    // Additional earnings movers...
  ],
  "timeRange": {
    "start": "2025-04-29",
    "end": "2025-05-06"
  },
  "count": 20,
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/earnings/movers?days=10&minMove=10&direction=down')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Earnings Analysis

Retrieves detailed analysis of a specific earnings report.

```
GET /api/v1/earnings/analysis/:ticker/:fiscalQuarter/:fiscalYear
```

#### Path Parameters

| Parameter     | Type   | Required | Description                                   |
|---------------|--------|----------|-----------------------------------------------|
| ticker        | string | Yes      | Stock symbol (e.g., "AAPL")                   |
| fiscalQuarter | string | Yes      | Fiscal quarter (e.g., "Q1", "Q2", "Q3", "Q4") |
| fiscalYear    | string | Yes      | Fiscal year (e.g., "2025")                    |

#### Response Format

```json
{
  "ticker": "AAPL",
  "companyName": "Apple Inc.",
  "reportInfo": {
    "reportDate": "2025-04-25",
    "fiscalQuarter": "Q2",
    "fiscalYear": "2025",
    "callTime": "17:00 ET",
    "callTranscript": "https://www.example.com/transcript/aapl-q2-2025",
    "presenters": ["Tim Cook", "Luca Maestri"]
  },
  "financialResults": {
    "eps": {
      "actual": 1.55,
      "estimate": 1.43,
      "surprise": 8.4,
      "yearOverYear": 6.2
    },
    "revenue": {
      "actual": "82.1B",
      "estimate": "79.5B",
      "surprise": 3.3,
      "yearOverYear": 2.8,
      "segments": [
        {
          "name": "iPhone",
          "revenue": "38.2B",
          "yearOverYear": 2.1
        },
        {
          "name": "Services",
          "revenue": "21.5B",
          "yearOverYear": 8.3
        },
        // Additional segments...
      ]
    },
    "otherMetrics": {
      "grossMargin": 45.3,
      "operatingMargin": 30.1,
      "netIncome": "24.3B",
      "cashFlow": "28.6B",
      "cashOnHand": "62.5B"
    }
  },
  "marketReaction": {
    "priceAction": {
      "beforeReport": 165.32,
      "afterHours": 172.45,
      "nextDay": 171.80,
      "oneWeekLater": 175.20,
      "percentChanges": {
        "immediate": 4.31,
        "nextDay": 3.92,
        "oneWeek": 5.98
      }
    },
    "volume": {
      "average": 65000000,
      "onReportDay": 98000000,
      "nextDay": 85000000,
      "percentChange": 50.8
    },
    "options": {
      "impliedMove": 4.5,
      "actualMove": 4.31,
      "volumeChange": 210
    }
  },
  "analysis": {
    "keyHighlights": [
      "Services revenue reached all-time high",
      "Strong growth in emerging markets",
      "Higher than expected margins"
    ],
    "concerns": [
      "iPhone sales growth slowing",
      "Supply chain challenges in China"
    ],
    "analystReactions": [
      {
        "firm": "Morgan Stanley",
        "analyst": "Jane Smith",
        "rating": "Overweight",
        "priceTarget": {
          "before": 195,
          "after": 205
        },
        "comment": "Services growth accelerating, margins expanding"
      },
      // Additional analyst reactions...
    ],
    "guidance": {
      "provided": true,
      "revenue": {
        "range": "84-87B",
        "vsEstimate": "inline"
      },
      "eps": {
        "range": "1.50-1.55",
        "vsEstimate": "above"
      },
      "commentary": "Expects continued strong services growth, stable margins"
    },
    "sentiment": {
      "callTone": "positive",
      "guidanceTone": "cautiously optimistic",
      "analystTone": "positive",
      "socialMediaReaction": "very positive"
    }
  },
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/earnings/analysis/AAPL/Q2/2025')
  .then(response => response.json())
  .then(data => console.log(data));
```

## Error Responses

### Invalid Ticker

```json
{
  "error": true,
  "message": "Invalid ticker symbol",
  "code": "INVALID_TICKER",
  "status": 400
}
```

### Invalid Date Range

```json
{
  "error": true,
  "message": "Invalid date range. Start date must be before end date.",
  "code": "INVALID_DATE_RANGE",
  "status": 400
}
```

### Earnings Not Found

```json
{
  "error": true,
  "message": "Earnings report not found for the specified quarter",
  "code": "EARNINGS_NOT_FOUND",
  "status": 404
}
```

### No Recent Surprises

```json
{
  "error": false,
  "message": "No earnings surprises found matching the criteria",
  "code": "NO_SURPRISES_FOUND",
  "status": 200,
  "data": {
    "surprises": [],
    "timeRange": {
      "start": "2025-04-29",
      "end": "2025-05-06"
    }
  }
}
```

### Server Error

```json
{
  "error": true,
  "message": "Error retrieving earnings data",
  "code": "EARNINGS_ERROR",
  "status": 500
}
```

## Caching Behavior

The Earnings API endpoints implement caching to optimize performance:

| Endpoint                     | Cache Duration | Cache Key Components                          |
|------------------------------|----------------|----------------------------------------------|
| /calendar                    | 6 hours        | startDate, endDate, limit, offset, marketCap  |
| /:ticker                     | 6 hours        | ticker, limit, upcoming                       |
| /surprises                   | 12 hours       | limit, days, minSurprise, direction, marketCap|
| /movers                      | 12 hours       | limit, days, minMove, direction, marketCap    |
| /analysis/:ticker/:qtr/:year | 24 hours       | ticker, fiscalQuarter, fiscalYear             |

## Data Sources

The earnings data is aggregated from multiple sources:

1. **Company Press Releases**: Direct earnings announcements from companies
2. **SEC Filings**: Official quarterly and annual reports (10-Q, 10-K)
3. **Earnings Calls**: Transcripts and audio recordings of earnings conference calls
4. **Analyst Estimates**: Consensus estimates from Wall Street analysts
5. **Financial News**: Reporting on earnings from financial media

## Limitations

1. **Data Freshness**: Earnings data may be delayed by 15-30 minutes after official release
2. **Coverage**: Comprehensive coverage for US-listed companies; limited coverage for international stocks
3. **Historical Data**: Generally limited to the past 5 years for most companies
4. **Accuracy**: While we strive for accuracy, earnings data should be verified with official sources for critical decisions
5. **Analysis Depth**: The depth of earnings analysis varies based on company size and trading volume
