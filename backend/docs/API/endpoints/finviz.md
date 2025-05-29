# FinViz API Endpoints

## Overview

The FinViz API endpoints provide access to financial news, analyst ratings, and technical indicators for stocks by proxying and transforming data from FinViz. These endpoints enable the HRVSTR platform to incorporate professional market sentiment and technical analysis into its financial insights.

## Base URL

```
/api/v1/finviz
```

## Available Endpoints

### Get Stock News

Retrieves recent news articles for a specific stock ticker.

```
GET /api/v1/finviz/news/:ticker
```

#### Path Parameters

| Parameter | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| ticker    | string | Yes      | Stock symbol to retrieve news for (e.g., "AAPL") |

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| limit     | number | No       | 20      | Maximum number of news items to retrieve (1-50)       |
| days      | number | No       | 7       | Number of days of news to retrieve (1-30)             |

#### Response Format

```json
{
  "ticker": "AAPL",
  "news": [
    {
      "title": "Apple Reports Record Q2 Earnings",
      "date": "2025-05-01T16:30:00Z",
      "source": "Bloomberg",
      "url": "https://www.bloomberg.com/news/...",
      "sentiment": {
        "score": 0.82,
        "label": "positive"
      }
    },
    {
      "title": "Analysts Question Apple's China Strategy",
      "date": "2025-04-30T12:15:00Z",
      "source": "CNBC",
      "url": "https://www.cnbc.com/news/...",
      "sentiment": {
        "score": -0.35,
        "label": "negative"
      }
    },
    // Additional news items...
  ],
  "sentiment": {
    "average": 0.53,
    "label": "positive",
    "distribution": {
      "positive": 12,
      "neutral": 5,
      "negative": 3
    }
  },
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/finviz/news/AAPL?limit=10&days=3')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Analyst Ratings

Retrieves recent analyst ratings and price targets for a stock.

```
GET /api/v1/finviz/ratings/:ticker
```

#### Path Parameters

| Parameter | Type   | Required | Description                                          |
|-----------|--------|----------|------------------------------------------------------|
| ticker    | string | Yes      | Stock symbol to retrieve ratings for (e.g., "AAPL")  |

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| limit     | number | No       | 10      | Maximum number of ratings to retrieve (1-30)          |
| days      | number | No       | 30      | Number of days of ratings to retrieve (1-90)          |

#### Response Format

```json
{
  "ticker": "AAPL",
  "ratings": [
    {
      "date": "2025-05-02",
      "firm": "Morgan Stanley",
      "action": "Upgrade",
      "rating": {
        "from": "Equal-Weight",
        "to": "Overweight"
      },
      "priceTarget": {
        "from": 175,
        "to": 210
      }
    },
    {
      "date": "2025-04-25",
      "firm": "Goldman Sachs",
      "action": "Reiterate",
      "rating": {
        "from": "Buy",
        "to": "Buy"
      },
      "priceTarget": {
        "from": 200,
        "to": 205
      }
    },
    // Additional ratings...
  ],
  "summary": {
    "consensus": {
      "buy": 18,
      "hold": 7,
      "sell": 2
    },
    "averagePriceTarget": 195.50,
    "highPriceTarget": 210.00,
    "lowPriceTarget": 150.00,
    "priceTargetUpside": 14.3, // percentage from current price
    "latestPriceAction": "2025-05-02"
  }
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/finviz/ratings/AAPL?limit=5')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Technical Indicators

Retrieves technical analysis indicators and data for a stock.

```
GET /api/v1/finviz/technicals/:ticker
```

#### Path Parameters

| Parameter | Type   | Required | Description                                            |
|-----------|--------|----------|--------------------------------------------------------|
| ticker    | string | Yes      | Stock symbol to retrieve technicals for (e.g., "AAPL") |

#### Response Format

```json
{
  "ticker": "AAPL",
  "price": {
    "current": 171.20,
    "open": 170.52,
    "high": 172.45,
    "low": 169.88,
    "previousClose": 170.42,
    "change": 0.78,
    "changePercent": 0.46
  },
  "fundamentals": {
    "marketCap": "2.72T",
    "pe": 28.45,
    "eps": 6.02,
    "dividend": 0.92,
    "dividendYield": 0.54,
    "volume": 65241200
  },
  "technicals": {
    "rsi": 54.3,
    "macd": 1.25,
    "sma20": 168.45,
    "sma50": 165.32,
    "sma200": 160.78,
    "beta": 1.28,
    "atr": 3.45,
    "volatility": {
      "weekly": 2.3,
      "monthly": 3.8
    }
  },
  "signals": {
    "rsi": "neutral",
    "macd": "bullish",
    "movingAverages": "bullish",
    "overall": "bullish"
  },
  "patterns": [
    {
      "name": "Golden Cross",
      "identified": "2025-04-15",
      "significance": "bullish",
      "description": "50-day SMA crossed above 200-day SMA"
    }
  ],
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/finviz/technicals/AAPL')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Stock Screener Results

Retrieves stocks matching specified screening criteria.

```
GET /api/v1/finviz/screener
```

#### Query Parameters

| Parameter  | Type   | Required | Default | Description                                           |
|------------|--------|----------|---------|-------------------------------------------------------|
| limit      | number | No       | 20      | Maximum number of stocks to retrieve (1-100)          |
| marketCap  | string | No       | null    | Market cap filter (e.g., "Large", "Mid", "Small")     |
| sector     | string | No       | null    | Sector filter (e.g., "Technology", "Healthcare")      |
| pe         | string | No       | null    | P/E ratio filter (e.g., "Under15", "Over50")         |
| price      | string | No       | null    | Price filter (e.g., "Under20", "Over50")             |
| change     | string | No       | null    | Price change filter (e.g., "Up", "Down5")            |
| volume     | string | No       | null    | Volume filter (e.g., "Over500K", "Over1M")           |

#### Response Format

```json
{
  "results": [
    {
      "ticker": "AAPL",
      "companyName": "Apple Inc.",
      "sector": "Technology",
      "industry": "Consumer Electronics",
      "country": "USA",
      "marketCap": "2.72T",
      "price": 171.20,
      "change": 0.46,
      "volume": 65241200,
      "pe": 28.45,
      "eps": 6.02,
      "dividend": 0.54,
      "rsi": 54.3,
      "beta": 1.28
    },
    // Additional stocks...
  ],
  "count": 20,
  "totalMatches": 42,
  "filters": {
    "marketCap": "Large",
    "sector": "Technology",
    "pe": null,
    "price": null,
    "change": null,
    "volume": "Over1M"
  },
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/finviz/screener?marketCap=Large&sector=Technology&volume=Over1M')
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

### Data Not Available

```json
{
  "error": true,
  "message": "FinViz data not available for this ticker",
  "code": "DATA_NOT_AVAILABLE",
  "status": 404
}
```

### Invalid Screener Parameters

```json
{
  "error": true,
  "message": "Invalid screener parameters",
  "code": "INVALID_PARAMETERS",
  "status": 400,
  "details": {
    "marketCap": "Invalid value: 'Huge' (valid values: Large, Mid, Small, Micro)"
  }
}
```

### Server Error

```json
{
  "error": true,
  "message": "Error retrieving data from FinViz",
  "code": "FINVIZ_ERROR",
  "status": 502
}
```

## Caching Behavior

The FinViz API endpoints implement caching to optimize performance and reduce load on the FinViz website:

| Endpoint            | Cache Duration | Cache Key Components                          |
|---------------------|----------------|----------------------------------------------|
| /news/:ticker       | 30 minutes     | ticker, limit, days                          |
| /ratings/:ticker    | 4 hours        | ticker, limit, days                          |
| /technicals/:ticker | 15 minutes     | ticker                                       |
| /screener           | 1 hour         | all query parameters                         |

## Limitations

1. **Data Freshness**: Due to caching and the nature of FinViz data updates, information may not reflect real-time market conditions
2. **Rate Limiting**: Respects FinViz's implicit rate limits to avoid IP blocking
3. **Coverage**: Limited to stocks available on FinViz (primarily US exchanges)
4. **Accuracy**: Data is sourced from FinViz and its accuracy is dependent on their data providers
5. **Availability**: Service may be unavailable if FinViz changes their site structure
