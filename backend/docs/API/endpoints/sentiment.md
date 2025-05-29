# Sentiment Analysis API Endpoints

## Overview

The Sentiment Analysis API endpoints provide access to aggregated sentiment data from multiple sources, including Reddit, FinViz, and other financial news platforms. These endpoints process, analyze, and deliver normalized sentiment scores and trends for stocks, sectors, and the broader market.

## Base URL

```
/api/v1/sentiment
```

## Available Endpoints

### Get Ticker Sentiment

Retrieves comprehensive sentiment analysis for a specific ticker symbol.

```
GET /api/v1/sentiment/:ticker
```

#### Path Parameters

| Parameter | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| ticker    | string | Yes      | Stock symbol to analyze (e.g., "AAPL")        |

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| timeRange | string | No       | "1w"    | Time range: "1d", "3d", "1w", "2w", "1m", "3m"       |
| sources   | string | No       | "all"   | Comma-separated list of sources: "reddit", "finviz", "news", "twitter", "all" |
| resolution| string | No       | "day"   | Time resolution: "hour", "day", "week"               |

#### Response Format

```json
{
  "ticker": "AAPL",
  "sentiment": {
    "score": 0.72,
    "label": "bullish",
    "confidence": 0.89
  },
  "timeRange": "1w",
  "resolution": "day",
  "timeline": [
    {
      "date": "2025-05-01",
      "score": 0.85,
      "volume": 238,
      "significance": 0.92
    },
    {
      "date": "2025-04-30",
      "score": 0.65,
      "volume": 176,
      "significance": 0.78
    },
    // Additional days...
  ],
  "sources": {
    "reddit": {
      "score": 0.68,
      "volume": 420,
      "weight": 0.4
    },
    "finviz": {
      "score": 0.75,
      "volume": 32,
      "weight": 0.3
    },
    "news": {
      "score": 0.80,
      "volume": 15,
      "weight": 0.3
    }
  },
  "relatedTickers": [
    {
      "ticker": "MSFT",
      "correlation": 0.85,
      "score": 0.65
    },
    {
      "ticker": "GOOG",
      "correlation": 0.72,
      "score": 0.58
    }
  ],
  "keywords": [
    {
      "term": "earnings",
      "count": 87,
      "score": 0.92
    },
    {
      "term": "iphone",
      "count": 65,
      "score": 0.85
    },
    // Additional keywords...
  ],
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/sentiment/AAPL?timeRange=1m&sources=reddit,finviz')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Compare Ticker Sentiment

Compares sentiment analysis for multiple ticker symbols.

```
GET /api/v1/sentiment/compare
```

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| tickers   | string | Yes      | -       | Comma-separated list of tickers to compare (max 5)    |
| timeRange | string | No       | "1w"    | Time range: "1d", "3d", "1w", "2w", "1m", "3m"       |
| sources   | string | No       | "all"   | Comma-separated list of sources: "reddit", "finviz", "news", "twitter", "all" |

#### Response Format

```json
{
  "comparison": [
    {
      "ticker": "AAPL",
      "sentiment": {
        "score": 0.72,
        "label": "bullish",
        "confidence": 0.89
      },
      "volume": 647,
      "priceChange": 2.3
    },
    {
      "ticker": "MSFT",
      "sentiment": {
        "score": 0.65,
        "label": "bullish",
        "confidence": 0.82
      },
      "volume": 532,
      "priceChange": 1.7
    },
    // Additional tickers...
  ],
  "correlations": [
    {
      "pair": ["AAPL", "MSFT"],
      "sentimentCorrelation": 0.78,
      "priceCorrelation": 0.65
    }
  ],
  "timeRange": "1w",
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/sentiment/compare?tickers=AAPL,MSFT,GOOG&timeRange=1m')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Sector Sentiment

Retrieves aggregated sentiment analysis for a specific market sector.

```
GET /api/v1/sentiment/sector/:sectorName
```

#### Path Parameters

| Parameter  | Type   | Required | Description                                        |
|------------|--------|----------|----------------------------------------------------|
| sectorName | string | Yes      | Sector name (e.g., "technology", "healthcare")     |

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| timeRange | string | No       | "1w"    | Time range: "1d", "3d", "1w", "2w", "1m", "3m"       |
| limit     | number | No       | 10      | Maximum number of tickers to include (1-30)          |

#### Response Format

```json
{
  "sector": "technology",
  "sentiment": {
    "score": 0.68,
    "label": "bullish",
    "confidence": 0.85,
    "change": 0.05
  },
  "tickers": [
    {
      "ticker": "AAPL",
      "sentiment": 0.72,
      "weight": 0.15,
      "priceChange": 2.3
    },
    {
      "ticker": "MSFT",
      "sentiment": 0.65,
      "weight": 0.12,
      "priceChange": 1.7
    },
    // Additional tickers...
  ],
  "timeline": [
    {
      "date": "2025-05-01",
      "score": 0.75,
      "volume": 1250
    },
    {
      "date": "2025-04-30",
      "score": 0.62,
      "volume": 980
    },
    // Additional days...
  ],
  "relatedSectors": [
    {
      "sector": "communication services",
      "correlation": 0.72
    },
    {
      "sector": "consumer discretionary",
      "correlation": 0.65
    }
  ],
  "timeRange": "1w",
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/sentiment/sector/technology?timeRange=1m&limit=5')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Market Sentiment

Retrieves overall market sentiment analysis.

```
GET /api/v1/sentiment/market
```

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| timeRange | string | No       | "1w"    | Time range: "1d", "3d", "1w", "2w", "1m", "3m"       |
| index     | string | No       | "all"   | Market index: "sp500", "nasdaq", "dow", "russell", "all" |

#### Response Format

```json
{
  "market": {
    "overall": {
      "sentiment": {
        "score": 0.62,
        "label": "bullish",
        "confidence": 0.78
      },
      "priceChange": 1.2,
      "volatility": 0.85
    },
    "indices": [
      {
        "name": "S&P 500",
        "sentiment": 0.64,
        "priceChange": 1.5
      },
      {
        "name": "NASDAQ",
        "sentiment": 0.68,
        "priceChange": 1.8
      },
      {
        "name": "Dow Jones",
        "sentiment": 0.58,
        "priceChange": 0.9
      }
    ]
  },
  "sectors": [
    {
      "name": "technology",
      "sentiment": 0.68,
      "priceChange": 2.1,
      "trend": "improving"
    },
    {
      "name": "healthcare",
      "sentiment": 0.62,
      "priceChange": 1.4,
      "trend": "stable"
    },
    // Additional sectors...
  ],
  "timeline": [
    {
      "date": "2025-05-01",
      "score": 0.75,
      "volume": 7500
    },
    {
      "date": "2025-04-30",
      "score": 0.65,
      "volume": 6800
    },
    // Additional days...
  ],
  "timeRange": "1w",
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/sentiment/market?timeRange=1m&index=sp500')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Sentiment Alerts

Retrieves significant sentiment changes or anomalies.

```
GET /api/v1/sentiment/alerts
```

#### Query Parameters

| Parameter   | Type   | Required | Default | Description                                           |
|-------------|--------|----------|---------|-------------------------------------------------------|
| limit       | number | No       | 10      | Maximum number of alerts to retrieve (1-50)           |
| minChange   | number | No       | 0.2     | Minimum sentiment change to consider (0.0-1.0)        |
| timeRange   | string | No       | "1d"    | Time range: "1d", "3d", "1w"                         |
| watchlist   | string | No       | null    | Comma-separated list of tickers to focus on           |

#### Response Format

```json
{
  "alerts": [
    {
      "ticker": "XYZ",
      "companyName": "XYZ Corporation",
      "sentimentChange": 0.35,
      "direction": "positive",
      "previousSentiment": 0.45,
      "currentSentiment": 0.80,
      "timeFrame": "24h",
      "triggers": ["news release", "earnings beat"],
      "volumeChange": 285,
      "priceChange": 5.3,
      "significance": 0.92
    },
    {
      "ticker": "ABC",
      "companyName": "ABC Inc.",
      "sentimentChange": -0.28,
      "direction": "negative",
      "previousSentiment": 0.65,
      "currentSentiment": 0.37,
      "timeFrame": "24h",
      "triggers": ["analyst downgrade", "executive departure"],
      "volumeChange": 175,
      "priceChange": -4.2,
      "significance": 0.85
    },
    // Additional alerts...
  ],
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/sentiment/alerts?limit=5&minChange=0.3')
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

### Invalid Sector

```json
{
  "error": true,
  "message": "Invalid sector name",
  "code": "INVALID_SECTOR",
  "status": 400,
  "validSectors": ["technology", "healthcare", "financials", ...]
}
```

### Too Many Tickers

```json
{
  "error": true,
  "message": "Too many tickers requested. Maximum is 5.",
  "code": "TOO_MANY_TICKERS",
  "status": 400
}
```

### Insufficient Data

```json
{
  "error": true,
  "message": "Insufficient sentiment data available",
  "code": "INSUFFICIENT_DATA",
  "status": 404
}
```

### Server Error

```json
{
  "error": true,
  "message": "Error processing sentiment data",
  "code": "SENTIMENT_ERROR",
  "status": 500
}
```

## Caching Behavior

The Sentiment Analysis API endpoints implement caching to optimize performance:

| Endpoint            | Cache Duration | Cache Key Components                          |
|---------------------|----------------|----------------------------------------------|
| /:ticker            | 1 hour         | ticker, timeRange, sources, resolution        |
| /compare            | 1 hour         | tickers, timeRange, sources                   |
| /sector/:sectorName | 2 hours        | sectorName, timeRange, limit                 |
| /market             | 1 hour         | timeRange, index                             |
| /alerts             | 30 minutes     | limit, minChange, timeRange, watchlist       |

## Processing Details

The sentiment analysis endpoints process data through the following pipeline:

1. **Data Collection**: Aggregate raw sentiment data from multiple sources
2. **Noise Reduction**: Filter out low-quality or irrelevant mentions
3. **Sentiment Scoring**: Apply NLP algorithms to calculate sentiment scores
4. **Normalization**: Standardize scores across different sources
5. **Confidence Calculation**: Determine confidence level based on volume and consistency
6. **Trend Analysis**: Identify patterns and changes over time
7. **Correlation Analysis**: Find relationships between different tickers and sectors

## Limitations

1. **Data Freshness**: Due to caching and processing time, sentiment data may have a delay of up to 1 hour
2. **Coverage**: Limited to stocks with sufficient mentions across the monitored sources
3. **Accuracy**: Sentiment analysis is probabilistic and may not always reflect market reality
4. **Historical Data**: Limited to the retention period of the source data (typically 3-6 months)
5. **Processing Complexity**: Complex queries (e.g., comparing many tickers) may take longer to complete
