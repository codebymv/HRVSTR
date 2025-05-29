# SEC EDGAR API Endpoints

## Overview

The SEC EDGAR API endpoints provide access to financial filing data from the U.S. Securities and Exchange Commission's EDGAR (Electronic Data Gathering, Analysis, and Retrieval) system. These endpoints focus on retrieving, parsing, and analyzing Form 4 (insider trading) and Form 13F (institutional holdings) filings.

## Base URL

```
/api/v1/sec
```

## Available Endpoints

### Get Insider Trades

Retrieves insider trading information (Form 4 filings) for a specific stock ticker.

```
GET /api/v1/sec/insider/:ticker
```

#### Path Parameters

| Parameter | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| ticker    | string | Yes      | Stock symbol to retrieve filings for (e.g., "AAPL") |

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| limit     | number | No       | 20      | Maximum number of filings to retrieve (1-100)         |
| timeRange | string | No       | "3m"    | Time range: "1w", "1m", "3m", "6m", "1y", "all"      |
| type      | string | No       | "all"   | Filing types: "buy", "sell", "all"                   |
| roles     | string | No       | "all"   | Filter by insider roles: "director", "officer", "10pct", "all" |

#### Response Format

```json
{
  "ticker": "AAPL",
  "trades": [
    {
      "id": "0001234567-22-000123",
      "filingDate": "2025-04-15",
      "transactionDate": "2025-04-12",
      "insiderName": "John Smith",
      "insiderTitle": "Chief Executive Officer",
      "transactionType": "P",
      "transactionTypeDescription": "Purchase",
      "sharesTraded": 5000,
      "sharePrice": 162.45,
      "totalValue": 812250,
      "sharesOwned": 35000,
      "formUrl": "https://www.sec.gov/Archives/edgar/data/..."
    },
    // Additional insider trades...
  ],
  "summary": {
    "buyCount": 5,
    "sellCount": 2,
    "totalBuyValue": 2500000,
    "totalSellValue": 750000,
    "netShareChange": 12500,
    "distinctInsiders": 3
  },
  "abnormalActivity": {
    "clusterBuying": true,
    "largeTransactions": true,
    "unusualVolume": false,
    "significanceScore": 0.85
  }
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/sec/insider/AAPL?limit=10&timeRange=1m&type=buy')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Institutional Holdings

Retrieves institutional holdings (Form 13F filings) for a specific stock ticker.

```
GET /api/v1/sec/institutional/:ticker
```

#### Path Parameters

| Parameter | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| ticker    | string | Yes      | Stock symbol to retrieve holdings for (e.g., "AAPL") |

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| limit     | number | No       | 20      | Maximum number of institutions to retrieve (1-100)    |
| quarter   | string | No       | "latest"| Quarter in the format "YYYY-QX" or "latest"          |
| minShares | number | No       | 0       | Minimum number of shares held                        |
| sortBy    | string | No       | "shares"| Sort by: "shares", "value", "change"                 |

#### Response Format

```json
{
  "ticker": "AAPL",
  "quarter": "2025-Q1",
  "filingDate": "2025-05-15",
  "holdings": [
    {
      "institutionName": "BlackRock Inc.",
      "cik": "0001364742",
      "shares": 1234567,
      "valueUSD": 200345678,
      "percentOfPortfolio": 3.42,
      "percentOfOutstanding": 0.78,
      "quarterlyChange": 50000,
      "percentChange": 4.23,
      "filingUrl": "https://www.sec.gov/Archives/edgar/data/..."
    },
    // Additional institutional holdings...
  ],
  "summary": {
    "totalInstitutions": 342,
    "totalShares": 8532145678,
    "percentInstitutionalOwnership": 67.8,
    "netShareChange": 125000000,
    "netPercentChange": 1.5
  }
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/sec/institutional/AAPL?limit=5&sortBy=value')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Filing Details

Retrieves detailed information for a specific SEC filing by its accession number.

```
GET /api/v1/sec/filing/:accessionNumber
```

#### Path Parameters

| Parameter        | Type   | Required | Description                                              |
|------------------|--------|----------|----------------------------------------------------------|
| accessionNumber  | string | Yes      | SEC filing accession number (e.g., "0001234567-22-000123") |

#### Response Format

```json
{
  "accessionNumber": "0001234567-22-000123",
  "formType": "4",
  "filingDate": "2025-04-15",
  "issuer": {
    "name": "Apple Inc.",
    "ticker": "AAPL",
    "cik": "0000320193"
  },
  "reportingPerson": {
    "name": "John Smith",
    "cik": "0001688535",
    "address": "One Apple Park Way, Cupertino, CA 95014",
    "relationship": "Chief Executive Officer, Director"
  },
  "transactions": [
    {
      "transactionDate": "2025-04-12",
      "coding": "P",
      "formType": "4",
      "transactionDescription": "Purchase",
      "securitiesOwned": 35000,
      "directOrIndirectOwnership": "D",
      "securityTitle": "Common Stock",
      "securityType": "Common Stock",
      "sharesTraded": 5000,
      "sharePrice": 162.45,
      "totalValue": 812250
    }
  ],
  "filingUrl": "https://www.sec.gov/Archives/edgar/data/...",
  "rawText": "...filing text content if requested..."
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/sec/filing/0001234567-22-000123')
  .then(response => response.json())
  .then(data => console.log(data));
```

### Get Abnormal Trading Activity

Identifies stocks with unusual insider trading patterns.

```
GET /api/v1/sec/abnormal
```

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                           |
|-----------|--------|----------|---------|-------------------------------------------------------|
| limit     | number | No       | 20      | Maximum number of stocks to retrieve (1-100)          |
| timeRange | string | No       | "1m"    | Time range: "1w", "1m", "3m", "6m"                   |
| minScore  | number | No       | 0.7     | Minimum abnormality score (0.0-1.0)                  |
| type      | string | No       | "all"   | Activity type: "cluster", "large", "dip", "all"      |

#### Response Format

```json
{
  "abnormalActivity": [
    {
      "ticker": "XYZ",
      "companyName": "XYZ Corporation",
      "abnormalityScore": 0.92,
      "activityTypes": ["cluster_buying", "large_transaction"],
      "insiderCount": 5,
      "totalValue": 15000000,
      "priceChange": -8.5,
      "latestFiling": "2025-05-01",
      "noteworthy": "5 executives bought shares after a 15% price dip"
    },
    // Additional stocks with abnormal activity...
  ],
  "timeRange": "1m",
  "timestamp": "2025-05-06T12:00:00Z"
}
```

#### Example Request

```javascript
fetch('http://localhost:3001/api/v1/sec/abnormal?limit=5&minScore=0.8')
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

### Filing Not Found

```json
{
  "error": true,
  "message": "Filing not found",
  "code": "FILING_NOT_FOUND",
  "status": 404
}
```

### SEC API Error

```json
{
  "error": true,
  "message": "Error retrieving data from SEC EDGAR",
  "code": "SEC_API_ERROR",
  "status": 502
}
```

### Rate Limiting

```json
{
  "error": true,
  "message": "SEC EDGAR rate limit exceeded. Please try again later.",
  "code": "SEC_RATE_LIMIT",
  "status": 429,
  "retryAfter": 300
}
```

## Caching Behavior

The SEC EDGAR API endpoints implement caching to optimize performance and respect SEC's request guidelines:

| Endpoint           | Cache Duration | Cache Key Components                     |
|--------------------|----------------|------------------------------------------|
| /insider/:ticker   | 12 hours       | ticker, limit, timeRange, type, roles    |
| /institutional/:ticker | 24 hours    | ticker, limit, quarter, minShares, sortBy|
| /filing/:accessionNumber | 7 days    | accessionNumber                          |
| /abnormal         | 6 hours        | limit, timeRange, minScore, type         |

## Limitations

1. **Rate Limits**: Respects SEC EDGAR's request guidelines (max 10 requests per second)
2. **Historical Data**: Limited to SEC EDGAR's available filings (generally from 1994 to present)
3. **Filing Types**: Currently supports only Form 4 and Form 13F filings
4. **Processing Time**: Complex queries may take longer to complete due to the need to process multiple filings
